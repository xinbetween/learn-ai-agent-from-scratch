/**
 * C05 · Context Engineering
 *
 * Four strategies over a 40-turn run, measuring what each costs and what each
 * destroys. The interesting column is fact retention, not survival.
 *
 *   node --experimental-strip-types code/c05_context.ts
 */

import type { Message } from "./c01_model_call.ts";
import { estimateTokens, userText } from "./c01_model_call.ts";

export type Strategy = "none" | "fifo" | "compact" | "offload+compact";

export interface RunState {
  system: string;
  systemTokens: number;
  goal: string;
  step: number;
  maxSteps: number;
  rolling: Message[];
  memory: string[];
  retrieved: string[];
  facts: Set<string>;          // every fact the agent has established
  recoverable: Set<string>;    // those still reachable from the context or from disk
}

/** Assemble from named regions. Nothing anywhere just pushes onto what gets sent. */
export function build(s: RunState, reserve = 8000): Message[] {
  return [
    // 1. FIXED — byte-identical, so the cache holds.
    { role: "system", content: s.system },
    // 2. PINNED — memory, early.
    ...(s.memory.length ? [userText(`What you know from previous sessions:\n${s.memory.join("\n")}`)] : []),
    // 3. ROLLING — the conversation.
    ...s.rolling,
    // 4. REFRESHED — retrieval for THIS turn, best chunk last.
    ...(s.retrieved.length ? [userText(s.retrieved.join("\n\n"))] : []),
    // 5. RESTATED GOAL — last position, highest attention. ~40 tokens, large effect.
    userText(`Current goal: ${s.goal}\nStep ${s.step} of at most ${s.maxSteps}.`),
  ];
}

export const sizeOf = (ms: Message[]): number =>
  ms.reduce((t, m) => t + estimateTokens(typeof m.content === "string" ? m.content : JSON.stringify(m.content)), 0);

/** Large results go to disk; an ACTIONABLE stub stays in the context. */
export function offload(result: string, tool: string, callId: string, threshold = 2000): string {
  if (estimateTokens(result) <= threshold) return result;
  const path = `/tmp/agent/${tool}-${callId}.txt`;
  const lines = result.split("\n");
  return [
    `[Result too large for context — written to ${path}]`,
    `Size: ${result.length.toLocaleString()} bytes, ~${estimateTokens(result).toLocaleString()} tokens, ${lines.length} lines.`,
    `First line: ${lines[0]?.slice(0, 80)}`,
    `Last line:  ${lines.at(-1)?.slice(0, 80)}`,
    `To inspect: read_lines("${path}", start, end).`,
  ].join("\n");
}

/** Compaction is destructive, so the prompt names what must survive, in order. */
export const COMPACT_PROMPT = `Summarise this portion of an agent's work log. This summary
REPLACES the original, so anything omitted is permanently lost to the agent.

Preserve, in this order:
1. FACTS ESTABLISHED — each with the tool call that produced it.
2. DEAD ENDS — what was tried and failed, and why. Without these the agent retries them.
3. OPEN QUESTIONS — what remains unresolved.
4. ARTEFACTS — file paths, IDs and URLs. Reproduce these EXACTLY.

Omit reasoning, pleasantries and superseded intermediate results.`;

/** Ordered eviction: a defensible order, and a fallback that needs no model call. */
export const EVICTION_ORDER = [
  "tool results superseded by a later call to the same tool with the same arguments",
  "assistant reasoning text older than the last 6 turns (the actions remain)",
  "large observations older than the last 20 messages, replaced by a one-line stub",
];
// Never eligible: the system prompt, the original goal, the last 6 turns, and any
// message carrying an artefact path or ID the agent may still need.

/* ------------------------------------------------------------------ simulation */

interface Outcome {
  strategy: Strategy;
  diedAtTurn: number | null;
  compactions: number;
  totalInputTokens: number;
  peak: number;
  factsRetained: number;
  goalInTail: boolean;
}

function simulate(strategy: Strategy, turns: number, obsTokens: number, windowTokens: number): Outcome {
  const FIXED = 6000, RESERVE = 8000;
  const usable = windowTokens - RESERVE;
  let ctx = FIXED + 400;
  let compactions = 0, total = 0, peak = 0;
  let died: number | null = null;
  const facts = new Set<string>();
  let retained = new Set<string>();

  for (let t = 1; t <= turns; t++) {
    const fact = `f${t}`;
    facts.add(fact);
    retained.add(fact);

    // Offloading turns a large observation into a ~110-token stub.
    const added = strategy === "offload+compact" ? Math.min(obsTokens + 200, 310) : obsTokens + 200;
    ctx += added;

    if (ctx > usable) {
      if (strategy === "none") { died = t; total += ctx; peak = Math.max(peak, ctx); break; }
      if (strategy === "fifo") {
        // Drops the OLDEST messages — which are the system prompt and the goal.
        while (ctx > usable * 0.8 && retained.size) {
          ctx -= (obsTokens + 200);
          const oldest = [...retained][0];
          retained.delete(oldest);
        }
      }
    }

    if ((strategy === "compact" || strategy === "offload+compact") && ctx > usable * 0.7) {
      compactions++;
      ctx = FIXED + 400 + 2200 + (strategy === "offload+compact" ? 1200 : 1800);
      // Generic summaries lose roughly a quarter of established facts; when the
      // material is on disk, the summary only has to remember that it is.
      const keep = strategy === "offload+compact" ? 0.9 : 0.74;
      retained = new Set([...retained].slice(-Math.max(1, Math.round(retained.size * keep))));
    }

    total += ctx;
    peak = Math.max(peak, ctx);
  }

  return {
    strategy,
    diedAtTurn: died,
    compactions,
    totalInputTokens: total,
    peak,
    factsRetained: retained.size / facts.size,
    goalInTail: strategy !== "none" && strategy !== "fifo",
  };
}

/* ------------------------------------------------------------------ demo */

function main(): void {
  console.log("\n  C05 · Context Engineering — 40 turns, 128K window, 3.5K observations\n");

  const rows = (["none", "fifo", "compact", "offload+compact"] as Strategy[])
    .map((s) => simulate(s, 40, 3500, 128_000));

  console.log(`  ${"strategy".padEnd(17)} ${"died".padStart(6)} ${"compactions".padStart(12)} ` +
              `${"input tokens".padStart(13)} ${"peak ctx".padStart(9)} ${"facts kept".padStart(11)}  goal in tail`);
  for (const r of rows) {
    console.log(`  ${r.strategy.padEnd(17)} ${(r.diedAtTurn ? `t=${r.diedAtTurn}` : "—").padStart(6)} ` +
      `${String(r.compactions).padStart(12)} ${r.totalInputTokens.toLocaleString().padStart(13)} ` +
      `${r.peak.toLocaleString().padStart(9)} ${(Math.round(r.factsRetained * 100) + "%").padStart(11)}  ` +
      `${r.goalInTail ? "yes" : "no"}`);
  }

  console.log(`\n  FIFO never exceeds the window, so it looks like it works. It drops the oldest`);
  console.log(`  messages — the system prompt and the goal — and the agent keeps running while`);
  console.log(`  quietly forgetting what it was doing. Nothing errors.\n`);

  // The assembly order, made concrete.
  const state: RunState = {
    system: "You are a support agent.".padEnd(2000),
    systemTokens: 540,
    goal: "Determine refund eligibility for order 4471",
    step: 9, maxSteps: 12,
    rolling: Array.from({ length: 6 }, (_, i) => userText(`turn ${i} observation`)),
    memory: ["Ana prefers PDF invoices (learned March, has changed before — confirm)"],
    retrieved: ["Returns Policy § 3: electronics 14 days unless faulty."],
    facts: new Set(), recoverable: new Set(),
  };
  console.log("  what build() actually sends, in order:\n");
  build(state).forEach((m, i) => {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    console.log(`    ${i + 1}. ${m.role.padEnd(9)} ${String(estimateTokens(text)).padStart(4)} tok  ${text.replace(/\s+/g, " ").slice(0, 62)}`);
  });
  console.log(`\n  The goal is the LAST block — about 40 tokens in the highest-attention position.`);

  // Offloading, made concrete.
  const huge = Array.from({ length: 1203 }, (_, i) => `{"id":${i},"status":"shipped","total":${40 + i}}`).join("\n");
  console.log(`\n  offload(): ${estimateTokens(huge).toLocaleString()} tokens becomes ${estimateTokens(offload(huge, "list_orders", "c1")).toLocaleString()}:\n`);
  console.log(offload(huge, "list_orders", "c1").split("\n").map((l) => "    " + l).join("\n"));
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
