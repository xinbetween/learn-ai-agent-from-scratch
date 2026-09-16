/**
 * C19 · Evaluation — Wilson intervals, McNemar's test, per-tag gating, and the
 * power calculation that explains why "I tried ten examples" is not evidence.
 *   node --experimental-strip-types code/c19_evals.ts
 */

export interface Grade { pass: boolean; why: string }
export interface Case { id: string; input: string; tags: string[]; check: (answer: string, world: World) => Grade }
export interface World { tickets: Array<{ order: string; category: string }> }

/* ---------------- statistics ---------------- */

/** Report an interval, never a bare percentage. 8/10 is [0.49, 0.94]. */
export function wilson(passes: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = passes / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

/** Paired comparison: only the cases where the two variants DISAGREE carry signal. */
export function mcnemar(aOnly: number, bOnly: number): { statistic: number; p: number; verdict: string } {
  const n = aOnly + bOnly;
  if (n === 0) return { statistic: 0, p: 1, verdict: "no discordant pairs" };
  // Continuity-corrected chi-squared with 1 df.
  const chi = Math.pow(Math.abs(aOnly - bOnly) - 1, 2) / n;
  // Upper tail of chi-squared with 1 df: P(X > x) = erfc(sqrt(x / 2)).
  const p = erfc(Math.sqrt(chi / 2));
  return { statistic: chi, p, verdict: p < 0.05 ? "significant" : "not significant" };
}

/** Abramowitz–Stegun 7.1.26; |error| < 1.5e-7, plenty for a p-value. */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const erfc = (x: number): number => 1 - erf(x);

/** n ≈ 16·p̄(1−p̄)/(p1−p0)² per arm (Lehr's rule), at 80% power and 5% two-sided significance. */
export const samplesNeeded = (p0: number, p1: number): number => {
  const pbar = (p0 + p1) / 2;
  return Math.ceil((16 * pbar * (1 - pbar)) / Math.pow(p1 - p0, 2));
};

/* ---------------- trajectory ---------------- */

export interface Trace { steps: number; tools: string[]; hadError: boolean; ok: boolean; inputTokens: number }
export interface Expectation { mustUse?: string[]; mustNotUse?: string[] }

export function trajectory(t: Trace, e: Expectation = {}) {
  const counts = new Map<string, number>();
  for (const x of t.tools) counts.set(x, (counts.get(x) ?? 0) + 1);
  return {
    steps: t.steps,
    wastedCalls: [...counts.values()].reduce((s, n) => s + Math.max(0, n - 1), 0),
    requiredToolsUsed: (e.mustUse ?? []).every((x) => t.tools.includes(x)),
    forbiddenToolsUsed: (e.mustNotUse ?? []).filter((x) => t.tools.includes(x)),
    recoveredFromError: t.hadError && t.ok,             // a GOOD signal
    tokensPerStep: Math.round(t.inputTokens / Math.max(1, t.steps)),
  };
}

/* ---------------- reporting ---------------- */

export interface CaseResult { case: Case; runs: Grade[]; passRate: number; trace: Trace }

export function aggregate(results: CaseResult[]) {
  const n = results.reduce((t, r) => t + r.runs.length, 0);
  const passes = results.reduce((t, r) => t + r.runs.filter((g) => g.pass).length, 0);
  const [lo, hi] = wilson(passes, n);
  return { n, passes, rate: n ? passes / n : 0, lo, hi };
}

export function byTag(results: CaseResult[]): Map<string, ReturnType<typeof aggregate>> {
  const tags = new Set(results.flatMap((r) => r.case.tags));
  return new Map([...tags].map((t) => [t, aggregate(results.filter((r) => r.case.tags.includes(t)))]));
}

/* ---------------- demo ---------------- */

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TAGS = ["refund", "multi-hop", "write", "from-prod", "regression"];

/** Two variants over the same cases: B is better overall and worse on multi-hop. */
function runSuite(variant: "A" | "B", cases: number, runsPerCase: number, seed: number) {
  const rnd = mulberry32(seed);
  const results: CaseResult[] = [];
  for (let i = 0; i < cases; i++) {
    const tag = TAGS[i % TAGS.length];
    const base = { refund: 0.9, "multi-hop": 0.68, write: 0.78, "from-prod": 0.63, regression: 0.97 }[tag]!;
    const delta = variant === "B" ? (tag === "multi-hop" ? -0.10 : +0.07) : 0;
    const p = Math.max(0.02, Math.min(0.99, base + delta));
    const runs: Grade[] = Array.from({ length: runsPerCase }, () =>
      rnd() < p ? { pass: true, why: "ok" } : { pass: false, why: "wrong conclusion" });
    results.push({
      case: { id: `${tag}/${i}`, input: "", tags: [tag], check: () => ({ pass: true, why: "" }) },
      runs, passRate: runs.filter((g) => g.pass).length / runs.length,
      trace: { steps: 3 + Math.floor(rnd() * (variant === "B" ? 9 : 5)), tools: ["search_orders", "search_policies", variant === "B" ? "search_orders" : "get_tickets"],
               hadError: rnd() < 0.2, ok: runs[0].pass, inputTokens: 18_000 },
    });
  }
  return results;
}

function main(): void {
  console.log("\n  C19 · Evaluation\n");

  // The experiment everyone actually runs.
  console.log("  \"I tried ten examples and it went from 7/10 to 9/10\"\n");
  for (const [k, n] of [[7, 10], [9, 10], [70, 100], [700, 1000]] as const) {
    const [lo, hi] = wilson(k, n);
    console.log(`    ${String(k).padStart(3)}/${String(n).padEnd(5)} = ${((k / n) * 100).toFixed(1).padStart(5)}%   95% CI [${(lo * 100).toFixed(0).padStart(2)}%, ${(hi * 100).toFixed(0)}%]`);
  }
  console.log(`\n    The first two intervals overlap almost entirely. That experiment cannot`);
  console.log(`    distinguish a real 20-point gain from nothing at all.`);

  console.log(`\n  runs needed per arm to detect a change, at 80% power\n`);
  for (const [p0, p1] of [[0.7, 0.75], [0.7, 0.8], [0.7, 0.85], [0.7, 0.9], [0.5, 0.8]] as const) {
    console.log(`    ${(p0 * 100).toFixed(0)}% → ${(p1 * 100).toFixed(0)}%   ${String(samplesNeeded(p0, p1)).padStart(5)} runs per arm`);
  }
  console.log(`\n    Most agent changes are 5–10 point effects. That is why casual comparison`);
  console.log(`    on a handful of examples is indistinguishable from guessing.`);

  // A real suite run, paired.
  const CASES = 85, RUNS = 3;
  const a = runSuite("A", CASES, RUNS, 3);
  const b = runSuite("B", CASES, RUNS, 3);
  const A = aggregate(a), B = aggregate(b);

  console.log(`\n  eval: ${CASES} cases × ${RUNS} runs = ${CASES * RUNS} runs per arm\n`);
  console.log(`    baseline   ${(A.rate * 100).toFixed(1)}%  95% CI [${(A.lo * 100).toFixed(1)}, ${(A.hi * 100).toFixed(1)}]`);
  console.log(`    variant    ${(B.rate * 100).toFixed(1)}%  95% CI [${(B.lo * 100).toFixed(1)}, ${(B.hi * 100).toFixed(1)}]   ${((B.rate - A.rate) * 100 >= 0 ? "+" : "")}${((B.rate - A.rate) * 100).toFixed(1)} pts`);

  // Paired: only discordant cases carry signal.
  let aOnly = 0, bOnly = 0;
  for (let i = 0; i < CASES; i++) {
    const pa = a[i].passRate >= 0.5, pb = b[i].passRate >= 0.5;
    if (pa && !pb) aOnly++; else if (!pa && pb) bOnly++;
  }
  const m = mcnemar(aOnly, bOnly);
  console.log(`    McNemar: variant wins ${bOnly}, loses ${aOnly}  (χ²=${m.statistic.toFixed(2)}, p≈${m.p.toFixed(3)}) → ${m.verdict}`);
  console.log(`\n    Note the honest outcome: the variant looks +3 points better overall, and`);
  console.log(`    the paired test says that is not distinguishable from noise at this sample`);
  console.log(`    size — exactly what the power table above predicts. The per-tag breakdown`);
  console.log(`    below is where the real signal is.`);

  // Per tag: where the regression hides.
  console.log(`\n  by tag — the breakdown the overall number hides\n`);
  const ta = byTag(a), tb = byTag(b);
  console.log(`    ${"tag".padEnd(12)} ${"baseline".padStart(9)} ${"variant".padStart(9)} ${"delta".padStart(8)}   gate`);
  let gateFailed = false;
  for (const tag of TAGS) {
    const x = ta.get(tag)!, y = tb.get(tag)!;
    const delta = (y.rate - x.rate) * 100;
    const fails = delta < -5;
    gateFailed ||= fails;
    console.log(`    ${tag.padEnd(12)} ${(x.rate * 100).toFixed(1).padStart(8)}% ${(y.rate * 100).toFixed(1).padStart(8)}% ` +
      `${((delta >= 0 ? "+" : "") + delta.toFixed(1)).padStart(8)}   ${fails ? "✗ REGRESSION (threshold −5.0)" : "ok"}`);
  }
  console.log(`\n    Overall the variant is better. Gating on the mean would merge a ${Math.abs((tb.get("multi-hop")!.rate - ta.get("multi-hop")!.rate) * 100).toFixed(0)}-point`);
  console.log(`    multi-hop regression silently. Gating per tag turns it into a decision.`);
  console.log(`\n  CI verdict: ${gateFailed ? "FAIL — a tagged capability regressed beyond threshold" : "PASS"}`);

  // Trajectory: the leading indicator.
  console.log(`\n  trajectory — p95 steps among SUCCESSFUL runs moves before the outcome does\n`);
  for (const [name, results] of [["baseline", a], ["variant", b]] as const) {
    const ok = results.filter((r) => r.passRate >= 0.5).map((r) => r.trace.steps).sort((x, y) => x - y);
    const p50 = ok[Math.floor(ok.length * 0.5)], p95 = ok[Math.floor(ok.length * 0.95)];
    const wasted = results.reduce((t, r) => t + trajectory(r.trace).wastedCalls, 0) / results.length;
    console.log(`    ${name.padEnd(10)} p50 ${String(p50).padStart(2)} steps   p95 ${String(p95).padStart(2)} steps   ${wasted.toFixed(2)} wasted calls/run`);
  }
  console.log(`\n    The variant succeeds more often AND works harder for it. Both numbers belong`);
  console.log(`    in the report — a change that lifts success while doubling cost is a decision`);
  console.log(`    for a person, not an automatic merge.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
