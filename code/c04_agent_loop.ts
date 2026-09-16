/**
 * C04 · The Agent Loop
 *
 * A complete agent: reason, act, observe — with the four guards that make it
 * survivable. Every later chapter modifies this file rather than replacing it.
 *
 *   node --experimental-strip-types code/c04_agent_loop.ts
 */

import type { Block, Message, Model, ModelResponse, Usage } from "./c01_model_call.ts";
import { Ledger, mockModel, textOf, userText } from "./c01_model_call.ts";
import { REGISTRY, runAll, toResultBlock, toSchema, type Tool, type ToolUse } from "./c03_tools.ts";

/* ------------------------------------------------------------------ budget */

export interface Limits { maxSteps: number; maxTokens: number; wallClockMs: number }
export type StopCause = "steps" | "tokens" | "time" | "cancelled";

export class Budget {
  readonly usage: Usage = { input: 0, output: 0 };
  steps = 0;
  private readonly ctrl = new AbortController();
  private readonly deadline: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  private limits: Limits;
  private cancelled = false;

  constructor(limits: Limits) {
    this.limits = { ...limits };
    this.deadline = Date.now() + limits.wallClockMs;
    this.timer = setTimeout(() => this.ctrl.abort(), limits.wallClockMs);
  }

  get signal(): AbortSignal { return this.ctrl.signal; }

  record(u: Usage): void {
    this.steps++;
    this.usage.input += u.input;
    this.usage.output += u.output;
  }

  /** Called at the TOP of the loop, before any money is spent. */
  exceeded(): StopCause | null {
    if (this.cancelled) return "cancelled";
    if (this.steps >= this.limits.maxSteps) return "steps";
    if (this.usage.input + this.usage.output >= this.limits.maxTokens) return "tokens";
    if (Date.now() >= this.deadline) return "time";
    return null;
  }

  /** degrade() needs a model call, but the budget is by definition spent. */
  releaseForFinalReport(): void {
    this.limits = { ...this.limits, maxSteps: this.limits.maxSteps + 1, maxTokens: this.limits.maxTokens + 4000 };
  }

  cancel(): void { this.cancelled = true; this.ctrl.abort(); }
  stop(): void { clearTimeout(this.timer); }        // or the process will not exit
  fractionUsed(): number {
    return Math.max(
      this.steps / this.limits.maxSteps,
      (this.usage.input + this.usage.output) / this.limits.maxTokens,
      (Date.now() - (this.deadline - this.limits.wallClockMs)) / this.limits.wallClockMs,
    );
  }
}

/* ------------------------------------------------------------------ repeat detection */

export const stableStringify = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  // Models reorder keys freely; without sorting, a repeat hides in plain sight.
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(",")}}`;
};

export class RepeatDetector {
  private counts = new Map<string, number>();
  private recent: string[] = [];

  check(calls: ToolUse[]): { name: string; kind: "repeat" | "cycle"; count: number } | null {
    for (const c of calls) {
      const key = `${c.name}:${stableStringify(c.input)}`;
      const n = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, n);
      this.recent.push(key);
      if (this.recent.length > 8) this.recent.shift();
      if (n >= 3) return { name: c.name, kind: "repeat", count: n };
      if (this.cycle(2) || this.cycle(3)) return { name: c.name, kind: "cycle", count: n };
    }
    return null;
  }

  private cycle(period: number): boolean {
    const r = this.recent;
    if (r.length < period * 2) return false;
    for (let i = 0; i < period; i++) if (r[r.length - 1 - i] !== r[r.length - 1 - i - period]) return false;
    return true;
  }

  reset(): void { this.counts.clear(); this.recent = []; }
}

/* ------------------------------------------------------------------ agent */

export interface AgentConfig {
  model: Model;
  system: string;
  tools: Tool[];
  registry?: Record<string, Tool>;
  limits?: Partial<Limits>;
  ledger?: Ledger;
  emit?: (e: AgentEvent) => void;
  workingDir?: string;
}

export type AgentEvent =
  | { type: "step"; n: number; kind: "model" }
  | { type: "tool_start"; name: string; summary: string }
  | { type: "tool_end"; name: string; ms: number; ok: boolean }
  | { type: "guard"; kind: string; message: string }
  | { type: "answer"; text: string };

export type Terminal = "answered" | "budget" | "stuck" | "blocked" | "error" | "cancelled";

export interface AgentResult {
  ok: boolean;
  terminal: Terminal;
  answer: string;
  partial?: boolean;
  messages: Message[];
  usage: Usage;
  steps: number;
  toolCalls: number;
  ms: number;
}

const DEFAULTS: Limits = { maxSteps: 10, maxTokens: 200_000, wallClockMs: 120_000 };

export async function runAgent(goal: string, cfg: AgentConfig): Promise<AgentResult> {
  const limits = { ...DEFAULTS, ...cfg.limits };
  const registry = cfg.registry ?? Object.fromEntries(cfg.tools.map((t) => [t.name, t]));
  const budget = new Budget(limits);
  const seen = new RepeatDetector();
  const started = Date.now();
  const messages: Message[] = [userText(goal)];
  let toolCalls = 0;
  let warnedLowBudget = false;

  const finish = (terminal: Terminal, answer: string, partial = false): AgentResult => {
    budget.stop();
    return { ok: terminal === "answered", terminal, answer, partial, messages,
             usage: budget.usage, steps: budget.steps, toolCalls, ms: Date.now() - started };
  };

  try {
    for (;;) {
      // GUARD 1 — before spending anything.
      const cause = budget.exceeded();
      if (cause) return await degrade(cause, messages, cfg, budget, finish);

      // A deadline warning late in the run measurably improves prioritisation;
      // showing the budget from the start makes models rush.
      if (!warnedLowBudget && budget.fractionUsed() > 0.7) {
        warnedLowBudget = true;
        messages.push(userText(`You have used about 70% of your budget for this task. ` +
          `Prioritise: finish what you can and report, rather than starting new lines of investigation.`));
      }

      // REASON
      const res: ModelResponse = await cfg.model(messages, {
        system: cfg.system,
        tools: cfg.tools.map(toSchema),
        temperature: 0,
        signal: budget.signal,
      });
      budget.record(res.usage);
      cfg.ledger?.record({ label: "model", usage: res.usage, ms: res.latencyMs, model: res.model });
      cfg.emit?.({ type: "step", n: budget.steps, kind: "model" });
      messages.push({ role: "assistant", content: res.content });

      // GUARD 2 — a truncated turn is not an answer.
      if (res.stopReason === "max_tokens") {
        messages.push(userText("Your response was cut off mid-sentence. Continue from exactly where you stopped."));
        continue;
      }

      // STOP
      const calls = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
      if (calls.length === 0) {
        const answer = textOf(res);
        cfg.emit?.({ type: "answer", text: answer });
        return finish("answered", answer);
      }

      // GUARD 3 — the same call three times is a stuck agent, not a persistent one.
      const repeat = seen.check(calls);
      if (repeat) {
        const msg = repeat.kind === "repeat"
          ? `You have called ${repeat.name} with identical arguments ${repeat.count} times and received the same result. ` +
            `That approach is not working. Either try different arguments or a different tool, or explain what information you are missing.`
          : `You are alternating between the same tools without making progress. ` +
            `If two sources disagree, report the disagreement rather than re-checking them.`;
        cfg.emit?.({ type: "guard", kind: repeat.kind, message: msg });
        messages.push(userText(msg));
        seen.reset();
        continue;
      }

      // ACT + OBSERVE
      for (const c of calls) cfg.emit?.({ type: "tool_start", name: c.name, summary: summarise(c) });
      const results = await runAll(calls, registry, { workingDir: cfg.workingDir ?? process.cwd(), log: () => {} }, budget.signal);
      toolCalls += results.length;
      results.forEach((r, i) => cfg.emit?.({ type: "tool_end", name: calls[i].name, ms: r.ms, ok: !r.isError }));
      messages.push({ role: "user", content: results.map(toResultBlock) });
    }
  } catch (e) {
    budget.stop();
    if (budget.signal.aborted) return await degrade("cancelled", messages, cfg, budget, finish);
    return finish("error", `Unrecoverable error: ${(e as Error).message}`);
  }
}

const summarise = (c: ToolUse): string => {
  const args = Object.entries(c.input as object).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
  return `${c.name} ${args}`.slice(0, 80);
};

/** One extra call turns "failed" into most of an answer — and into a resume point. */
async function degrade(
  cause: StopCause, messages: Message[], cfg: AgentConfig, budget: Budget,
  finish: (t: Terminal, a: string, p?: boolean) => AgentResult,
): Promise<AgentResult> {
  budget.releaseForFinalReport();
  const why = { steps: "step budget", tokens: "token budget", time: "time limit", cancelled: "cancellation by the user" }[cause];
  try {
    const res = await cfg.model([...messages, userText(
      `You must stop now: ${why} reached.\n\n` +
      `Write a final report. Do not call any tools.\n` +
      `1. ESTABLISHED — what you determined, each with the evidence that supports it.\n` +
      `2. IN PROGRESS — what you were doing when you stopped.\n` +
      `3. UNKNOWN — what you did not find out, and the exact next step for each.\n` +
      `Be concrete. "I made some progress" is worthless.`)],
      { system: cfg.system, temperature: 0 });
    return finish(cause === "cancelled" ? "cancelled" : "budget", textOf(res), true);
  } catch {
    return finish(cause === "cancelled" ? "cancelled" : "budget",
      `Stopped: ${why} reached, and the final report could not be generated.`, true);
  }
}

/* ------------------------------------------------------------------ demo */

const SYSTEM = `You are a customer support agent. Use the tools to establish facts before answering.`;

/** Five scripted scenarios: the control flow is real, the intelligence is canned. */
function scenario(name: string): Model {
  const use = (id: string, tool: string, input: unknown): ModelResponse =>
    ({ content: [{ type: "tool_use", id, name: tool, input }], stopReason: "tool_use",
       usage: { input: 1800, output: 90 }, model: "mock", latencyMs: 1 });
  const say = (text: string): ModelResponse =>
    ({ content: [{ type: "text", text }], stopReason: "end_turn",
       usage: { input: 2100, output: 120 }, model: "mock", latencyMs: 1 });

  /** Has this phrase appeared anywhere the model can see — injected text OR a tool result? */
  const saw = (m: Message[], phrase: string): boolean =>
    m.some((x) => typeof x.content === "string"
      ? x.content.includes(phrase)
      : (x.content as Block[]).some((b) =>
          (b.type === "text" && b.text.includes(phrase)) ||
          (b.type === "tool_result" && b.content.includes(phrase))));

  const turns = (m: Message[]): number => m.filter((x) => x.role === "assistant").length;

  const scripts: Record<string, (m: Message[]) => ModelResponse> = {
    // Happy path: three lookups, then the layered conclusion.
    happy: (m) => {
      const n = turns(m);
      if (n === 0) return use("1", "search_orders", { id: "4471" });
      if (n === 1) return use("2", "search_policies", { q: "electronics refund window" });
      if (n === 2) return use("3", "get_support_tickets", { order: "4471" });
      return say("Eligible: a fault was reported on 2024-02-05, three days after delivery (ticket #882), " +
                 "so the 14-day electronics window does not bar the refund.");
    },
    // Typo, then recovery from the observation alone — no guard needed.
    typo: (m) => {
      const n = turns(m);
      if (n === 0) return use("1", "search_ordrs", { id: "4471" });
      if (n === 1) return use("2", "search_orders", { id: "4471" });
      return say("Order 4471 was delivered on 2024-01-28 for €340.");
    },
    // Identical repeats until the detector describes the loop, then recovery.
    stuck: (m) => {
      if (!saw(m, "identical arguments")) return use("r", "search_policies", { q: "zzz" });
      if (!saw(m, "Returns Policy")) return use("r2", "search_policies", { q: "electronics refund" });
      return say("Returns are accepted within 30 days; electronics within 14 unless a fault is reported.");
    },
    // A,B,A,B oscillation until the detector names it.
    cycle: (m) => {
      if (saw(m, "alternating")) return say("The order system and the ticket system disagree; escalating rather than re-checking.");
      return turns(m) % 2 === 0 ? use(`o${turns(m)}`, "search_orders", { id: "4471" })
                                : use(`t${turns(m)}`, "get_support_tickets", { order: "4471" });
    },
    // Never stops on its own: the budget must.
    runaway: (m) => use(`x${m.length}`, "get_support_tickets", { order: String(4000 + m.length) }),
  };

  const script = scripts[name];
  return mockModel((m) => {
    // Every scenario must be able to answer the degrade prompt — that call has
    // no tools, and returning a tool_use there is how you get an empty report.
    if (saw(m, "You must stop now")) {
      return say(
        "1. ESTABLISHED — order 4471 was delivered on 2024-01-28 (search_orders); " +
        "the electronics return window is 14 days unless a fault is reported (search_policies).\n" +
        "2. IN PROGRESS — reading support tickets to check whether a fault was reported.\n" +
        "3. UNKNOWN — whether ticket #883 contains a fault report. NEXT STEP: call " +
        "get_support_tickets for 4471 and read #883 and #884.");
    }
    return script(m);
  });
}

async function main(): Promise<void> {
  console.log("\n  C04 · The Agent Loop\n");
  const tools = [REGISTRY.search_orders, REGISTRY.search_policies, REGISTRY.get_support_tickets];

  const cases: Array<[string, string, Partial<Limits>]> = [
    ["happy", "Is order 4471 eligible for a refund?", {}],
    ["typo", "What is the status of order 4471?", {}],
    ["stuck", "What is the returns policy?", {}],
    ["cycle", "Has order 4471 shipped?", {}],
    ["runaway", "Audit every ticket on this account.", { maxSteps: 5 }],
  ];

  console.log("  scenario     steps  tools  terminal            answer");
  console.log("  " + "─".repeat(100));
  for (const [name, goal, limits] of cases) {
    const events: AgentEvent[] = [];
    const r = await runAgent(goal, {
      model: scenario(name), system: SYSTEM, tools, limits,
      emit: (e) => events.push(e),
    });
    const guards = events.filter((e) => e.type === "guard").length;
    console.log(`  ${name.padEnd(12)} ${String(r.steps).padStart(5)} ${String(r.toolCalls).padStart(6)}  ` +
      `${(r.terminal + (r.partial ? " (partial)" : "")).padEnd(18)} ${r.answer.replace(/\n/g, " ").slice(0, 60)}` +
      (guards ? `   [${guards} guard fired]` : ""));
  }

  // The same stuck scenario with the repeat detector disabled, to show the cost.
  console.log("\n  the guards, quantified\n");
  const withGuard = await runAgent("What is the returns policy?", { model: scenario("stuck"), system: SYSTEM, tools });
  console.log(`    repeat detector ON   ${withGuard.steps} steps · ${withGuard.usage.input.toLocaleString()} input tok · ${withGuard.terminal}`);
  // The same agent, but the detector never fires because the model is never told.
  const noGuard = await runAgent("What is the returns policy?", {
    model: mockModel(() => ({ content: [{ type: "tool_use", id: "r", name: "search_policies", input: { q: "zzz" } }],
                              stopReason: "tool_use", usage: { input: 1800, output: 90 } })),
    system: SYSTEM, tools, limits: { maxSteps: 10 },
  });
  console.log(`    repeat detector OFF  ${noGuard.steps} steps · ${noGuard.usage.input.toLocaleString()} input tok · ${noGuard.terminal}` +
              `   ← same money, no progress`);

  console.log("\n  what the user receives when the budget runs out:\n");
  const partial = await runAgent("Audit every ticket on this account.", {
    model: scenario("runaway"), system: SYSTEM, tools, limits: { maxSteps: 4 },
  });
  console.log("    terminal: " + partial.terminal + (partial.partial ? " (partial report generated)" : ""));
  console.log("    " + partial.answer.split("\n").slice(0, 3).join("\n    "));
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
