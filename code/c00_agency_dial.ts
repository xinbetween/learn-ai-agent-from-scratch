/**
 * C00 · What an Agent Actually Is
 *
 * The same customer-support task at five positions on the agency dial, so the
 * trade — coverage bought with predictability — is a table rather than an opinion.
 *
 *   node --experimental-strip-types code/c00_agency_dial.ts
 */

/* ------------------------------------------------------------------ the world */

export interface Env {
  tools: Record<string, (args: any) => Promise<string>>;
  model: (messages: Msg[]) => Promise<Decision>;
}
export interface Msg { role: "user" | "assistant" | "tool"; content: string }
export type Decision =
  | { kind: "answer"; text: string }
  | { kind: "call"; tool: string; args: Record<string, unknown> };

export interface Limits { maxSteps: number; wallClockMs: number }
export interface Result { ok: boolean; text?: string; why?: string; calls: number; messages: Msg[] }

/* ------------------------------------------------------------------ position 3 */

export async function agent(goal: string, env: Env, limits: Limits): Promise<Result> {
  const messages: Msg[] = [{ role: "user", content: goal }];
  let calls = 0;
  const deadline = Date.now() + limits.wallClockMs;

  for (;;) {
    // Guard 1: the loop cannot supply its own termination, so we do — and we
    // check BEFORE the call, so an exhausted budget costs nothing more.
    if (calls >= limits.maxSteps) return { ok: false, why: "step budget exhausted", calls, messages };
    if (Date.now() > deadline) return { ok: false, why: "deadline exceeded", calls, messages };

    const d = await env.model(messages);
    calls++;

    if (d.kind === "answer") return { ok: true, text: d.text, calls, messages };

    // Guard 2: the model names a tool; it does not get to invent one. A typo is
    // an observation it can correct from, not an exception that kills the run.
    const tool = env.tools[d.tool];
    const observation = tool
      ? await tool(d.args).catch((e: Error) => `ERROR: ${e.message}`)
      : `ERROR: no tool named "${d.tool}". Available: ${Object.keys(env.tools).join(", ")}`;

    messages.push({ role: "assistant", content: JSON.stringify(d) });
    messages.push({ role: "tool", content: String(observation) });
  }
}

/* ------------------------------------------------------------------ simulation */

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Position {
  name: string;
  /** Ceiling on how hard a request this position can handle at all. */
  ceiling: number;
  /** Model calls: a fixed base, plus a spread that only agency provides. */
  base: number;
  spread: number;
  tokens: number;
  latencyMs: number;
  blast: string;
}

const POSITIONS: Position[] = [
  { name: "0 · pipeline",   ceiling: 30, base: 0, spread: 0,  tokens: 0,     latencyMs: 40,    blast: "none" },
  { name: "1 · router",     ceiling: 48, base: 1, spread: 0,  tokens: 700,   latencyMs: 520,   blast: "read-only" },
  { name: "2 · chain",      ceiling: 66, base: 3, spread: 1,  tokens: 2600,  latencyMs: 1800,  blast: "read-only" },
  { name: "3 · agent",      ceiling: 91, base: 4, spread: 6,  tokens: 9000,  latencyMs: 7200,  blast: "whatever the tools can do" },
  { name: "4 · open-ended", ceiling: 95, base: 6, spread: 14, tokens: 24000, latencyMs: 21000, blast: "writes its own tools" },
];

interface Run { calls: number; solved: boolean; tokens: number; ms: number }

function simulate(p: Position, difficulty: number, n: number, seed = 7): Run[] {
  const rnd = mulberry32(seed);
  const runs: Run[] = [];
  for (let i = 0; i < n; i++) {
    // Harder requests take a little more work at every position…
    const base = p.base + Math.round(p.spread * 0.25 * (difficulty / 100));
    // …but only agency produces the long right tail. rnd()^5 is near zero for most
    // runs and occasionally large, which is what a p99 of ~4× the median looks like.
    const tail = p.spread ? Math.floor(Math.pow(rnd(), 5) * p.spread * 3) : 0;
    const calls = base + tail;

    // A fixed pipeline degrades fast with difficulty because it cannot add a step;
    // an agent degrades slowly because it can.
    const penalty = p.spread ? difficulty * 0.3 : difficulty * 0.55;
    const pSolve = Math.max(0, Math.min(1, (p.ceiling - penalty) / 100));

    runs.push({
      calls,
      solved: rnd() < pSolve,
      tokens: Math.round(p.tokens * (1 + Math.max(0, calls - p.base) * 0.25)),
      ms: Math.round(p.latencyMs * (1 + Math.max(0, calls - p.base) * 0.25)),
    });
  }
  return runs;
}

const pct = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const median = (xs: number[]): number => pct(xs, 0.5);

/* ------------------------------------------------------------------ demo */

async function main(): Promise<void> {
  console.log("\n  C00 · The agency dial — same task, five positions\n");

  // First: prove the loop above actually runs, including the typo recovery.
  const env: Env = {
    tools: {
      lookup_order: async ({ id }: { id: string }) => `Order ${id}: delivered 2024-01-28, €340, electronics.`,
      search_policy: async () => `Electronics: 14-day window unless a fault was reported.`,
    },
    model: async (messages) => {
      const n = messages.filter((m) => m.role === "assistant").length;
      if (n === 0) return { kind: "call", tool: "lookup_ordr", args: { id: "4471" } };   // deliberate typo
      if (n === 1) return { kind: "call", tool: "lookup_order", args: { id: "4471" } };
      if (n === 2) return { kind: "call", tool: "search_policy", args: { q: "electronics" } };
      return { kind: "answer", text: "Delivered 2024-01-28; the 14-day electronics window has passed." };
    },
  };
  const r = await agent("Is order 4471 refundable?", env, { maxSteps: 8, wallClockMs: 5_000 });
  console.log(`  live loop:  ${r.ok ? "answered" : r.why} in ${r.calls} calls`);
  console.log(`              recovered from an unknown-tool typo in one step — the observation carried the fix`);
  console.log(`              "${r.text}"\n`);

  // Then: the comparison across positions, at two difficulties.
  for (const difficulty of [25, 65]) {
    const label = difficulty < 50 ? "routine request" : "request nobody planned for";
    console.log(`  difficulty ${difficulty} · ${label}`);
    console.log(`  ${"position".padEnd(14)} ${"solved".padStart(7)} ${"med calls".padStart(10)} ${"p99".padStart(5)} ` +
                `${"med tokens".padStart(11)} ${"med latency".padStart(12)}  blast radius`);
    for (const p of POSITIONS) {
      const runs = simulate(p, difficulty, 400);
      const calls = runs.map((x) => x.calls);
      const solved = runs.filter((x) => x.solved).length / runs.length;
      console.log(`  ${p.name.padEnd(14)} ${(Math.round(solved * 100) + "%").padStart(7)} ` +
        `${String(median(calls)).padStart(10)} ${String(pct(calls, 0.99)).padStart(5)} ` +
        `${median(runs.map((x) => x.tokens)).toLocaleString().padStart(11)} ` +
        `${(median(runs.map((x) => x.ms)) / 1000).toFixed(1).padStart(11)}s  ${p.blast}`);
    }
    console.log();
  }

  console.log("  Two things to read off these tables:");
  console.log("    · positions 0–1 collapse as difficulty rises — a pipeline cannot invent a step");
  console.log("    · at position 3 the median is fine and the p99 is 4× it. capacity, timeouts and");
  console.log("      cost are all sized by that tail, and most of this course is about taming it.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
