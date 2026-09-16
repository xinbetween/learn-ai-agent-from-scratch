/**
 * C11 · Control Flow — five composition primitives with one signature, and the
 * cost of putting every request through an agent.
 *   node --experimental-strip-types code/c11_control_flow.ts
 */

export interface Ctx { log: (event: string, data?: unknown) => void }
export type Handler<I, O> = (input: I, ctx: Ctx) => Promise<O>;

export const rule = <I, O>(fn: (input: I) => O | null): Handler<I, O | null> =>
  async (input) => fn(input);

export const chain = <I, O>(...steps: Array<Handler<any, any>>): Handler<I, O> =>
  async (input, ctx) => {
    let v: any = input;
    for (const s of steps) v = await s(v, ctx);
    return v as O;
  };

export const route = <I, O>(
  classify: Handler<I, { route: string; confidence: number }>,
  routes: Record<string, Handler<I, O>>,
  fallback: Handler<I, O>,
  minConfidence = 0.7,
): Handler<I, O> =>
  async (input, ctx) => {
    const { route: r, confidence } = await classify(input, ctx);
    // Routing decisions with their confidence are the highest-value thing to log.
    ctx.log("route", { route: r, confidence, fellBack: !(confidence >= minConfidence && routes[r]) });
    return (confidence >= minConfidence && routes[r] ? routes[r] : fallback)(input, ctx);
  };

export const parallel = <I, O, R>(
  branches: Array<Handler<I, O>>,
  merge: (results: O[], input: I) => Promise<R>,
): Handler<I, R> =>
  async (input, ctx) => {
    const settled = await Promise.allSettled(branches.map((b) => b(input, ctx)));
    const ok = settled
      .filter((s): s is PromiseFulfilledResult<Awaited<O>> => s.status === "fulfilled")
      .map((s) => s.value as O);
    if (!ok.length) throw new AggregateError(settled.map((s) => (s as PromiseRejectedResult).reason), "every branch failed");
    return merge(ok, input);      // partial results still merge
  };

/* ---------------- simulation ---------------- */

interface Profile { cost: number; p50: number; p99: number; determinism: number; fit: Record<string, number> }

const P: Record<string, Profile> = {
  rule:  { cost: 0,      p50: 30,   p99: 60,    determinism: 1,    fit: { simple: .97, branch: .55, open: .12 } },
  chain: { cost: .0022,  p50: 1400, p99: 2600,  determinism: 1,    fit: { simple: .95, branch: .74, open: .34 } },
  route: { cost: .0035,  p50: 1900, p99: 4200,  determinism: 0.9,  fit: { simple: .95, branch: .93, open: .55 } },
  orch:  { cost: .0180,  p50: 5200, p99: 15000, determinism: 0.35, fit: { simple: .93, branch: .90, open: .82 } },
  agent: { cost: .0290,  p50: 7400, p99: 31000, determinism: 0,    fit: { simple: .91, branch: .89, open: .90 } },
};

interface Arch { name: string; simple: string; branch: string; open: string }

function evaluate(a: Arch, mix: { simple: number; branch: number; open: number }, volume: number) {
  const kinds = ["simple", "branch", "open"] as const;
  let cost = 0, success = 0, det = 0, p50 = 0, p99 = 0;
  for (const k of kinds) {
    const p = P[(a as any)[k] as string];
    const share = mix[k];
    cost += share * volume * p.cost;
    success += share * p.fit[k];
    det += share * p.determinism;
    p50 += share * p.p50;
    p99 = Math.max(p99, share > 0.05 ? p.p99 : 0);
  }
  return { cost, success, det, p50, p99 };
}

/* ---------------- demo ---------------- */

async function main(): Promise<void> {
  console.log("\n  C11 · Control Flow\n");

  // A working hybrid, exercised for real.
  const ctx: Ctx = { log: () => {} };
  const routed: string[] = [];
  const logging: Ctx = { log: (e, d) => { if (e === "route") routed.push(`${(d as any).route}@${(d as any).confidence}`); } };

  const classify: Handler<string, { route: string; confidence: number }> = async (text) => {
    if (/refund|money back/i.test(text)) return { route: "refund", confidence: 0.94 };
    if (/where|track|deliver/i.test(text)) return { route: "tracking", confidence: 0.91 };
    if (/policy|rules|allowed/i.test(text)) return { route: "policy", confidence: 0.88 };
    return { route: "other", confidence: 0.41 };            // below threshold → fallback
  };

  const system = route<string, string>(
    classify,
    {
      tracking: chain<string, string>(
        async (t: string) => ({ id: t.match(/\d{4}/)?.[0] ?? "unknown" }),   // deterministic
        async (o: { id: string }) => ({ ...o, status: "in transit" }),        // deterministic
        async (o: any) => `Order ${o.id} is ${o.status}.`,                    // one model call for prose
      ),
      refund: async (t) => `[agent] worked out refund eligibility for: ${t.slice(0, 30)}…`,
      policy: chain<string, string>(async (t: string) => ({ q: t }), async (o: any) => `[chain] policy answer for "${o.q.slice(0, 24)}…"`),
    },
    async (t) => `[general agent] handling an unclassified request: ${t.slice(0, 30)}…`,
  );

  console.log("  a hybrid in action — one router, two chains, two agents:\n");
  for (const q of [
    "where is order 4471",
    "I want my money back for 4471",
    "what are the rules on returns",
    "my cat walked across the keyboard and now the app is purple",
  ]) {
    console.log(`    ${(await system(q, logging)).slice(0, 72)}`);
  }
  console.log(`\n    routing log: ${routed.join("  ")}`);
  console.log(`    the last one fell back to the general agent — which is what the fallback is for`);

  // Parallel with a failing branch.
  const voting = parallel<string, string, string>(
    [async () => "high", async () => { throw new Error("branch timed out"); }, async () => "high"],
    async (results) => `majority of ${results.length} surviving branches: ${results[0]}`,
  );
  console.log(`\n  parallel with one failed branch: ${await voting("incident text", ctx)}`);
  console.log(`  allSettled, not all — one rejection must not discard the others`);

  // The architecture comparison.
  const mix = { simple: 0.55, branch: 0.25, open: 0.20 };
  const volume = 10_000;
  const archs: Arch[] = [
    { name: "everything is an agent", simple: "agent", branch: "agent", open: "agent" },
    { name: "route → chain | agent", simple: "chain", branch: "route", open: "agent" },
    { name: "rules → route → chain|agent", simple: "rule", branch: "route", open: "agent" },
  ];

  console.log(`\n  ${volume.toLocaleString()} requests/day · 55% routine, 25% needs a branch, 20% open-ended\n`);
  console.log(`  ${"architecture".padEnd(30)} ${"$/day".padStart(8)} ${"p50".padStart(7)} ${"p99".padStart(8)} ${"success".padStart(8)} ${"predictable".padStart(12)}`);
  for (const a of archs) {
    const r = evaluate(a, mix, volume);
    console.log(`  ${a.name.padEnd(30)} ${("$" + r.cost.toFixed(0)).padStart(8)} ${(r.p50 / 1000).toFixed(1).padStart(6)}s ` +
      `${(r.p99 / 1000).toFixed(1).padStart(7)}s ${(Math.round(r.success * 100) + "%").padStart(8)} ${(Math.round(r.det * 100) + "%").padStart(12)}`);
  }
  console.log(`\n  Success barely moves. Cost falls by an order of magnitude, p50 by more, and`);
  console.log(`  83% of traffic becomes something you can test, explain and put an SLA on.`);

  // And the mirror-image mistake.
  const forced: Arch = { name: "force open-ended down a chain", simple: "rule", branch: "route", open: "chain" };
  const r = evaluate(forced, mix, volume);
  console.log(`\n  the opposite error — refusing to pay for agency where it is needed:`);
  console.log(`    ${forced.name.padEnd(30)} ${("$" + r.cost.toFixed(0)).padStart(8)} ${(r.p50 / 1000).toFixed(1).padStart(6)}s ` +
    `${(r.p99 / 1000).toFixed(1).padStart(7)}s ${(Math.round(r.success * 100) + "%").padStart(8)}`);
  console.log(`    cheapest of all, and a fifth of users are quietly failed.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
