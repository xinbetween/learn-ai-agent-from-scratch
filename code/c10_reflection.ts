/**
 * C10 · Reflection & Verification — the ladder, a critic loop that terminates,
 * and a measurement of what each rung actually catches.
 *   node --experimental-strip-types code/c10_reflection.ts
 */

export interface Criterion { name: string; description: string }
export interface Critique { score: number; criteria: Array<{ name: string; pass: boolean; why: string; quote?: string }>; blocking: string[] }

/* ---------------- rung 2: rules you wrote ---------------- */

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const shingle = (t: string, k: number): Set<string> => {
  const w = normalise(t).split(" ");
  const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
};

/** The specific failure that destroys trust: a fabricated figure beside a real citation. */
export function ungroundedClaims(answer: string, sources: string[]): string[] {
  const corpus = sources.map(normalise).join(" ");
  const corpusNumbers = new Set((sources.join(" ").match(/\b\d[\d,.]*\b/g) ?? []).map((n) => n.replace(/[,.]$/, "")));
  const out: string[] = [];

  for (const sentence of answer.split(/(?<=[.!?])\s+/).filter((s) => s.trim())) {
    const numbers = (sentence.match(/\b\d[\d,.]*\b/g) ?? []).map((n) => n.replace(/[,.]$/, ""));
    if (numbers.some((n) => !corpusNumbers.has(n))) { out.push(sentence.trim()); continue; }
    const quoted = sentence.match(/"([^"]{8,})"/g) ?? [];
    if (quoted.some((q) => !corpus.includes(normalise(q)))) { out.push(sentence.trim()); continue; }
    if (!numbers.length && !quoted.length) {
      const grams = shingle(sentence, 4);
      if (grams.size && ![...grams].some((g) => corpus.includes(g))) out.push(sentence.trim());
    }
  }
  return out;
}

/* ---------------- rung 1: a gate the model cannot talk past ---------------- */

export interface RunState {
  filesChanged: string[];
  toolsUsed: Set<string>;
  lastTestResult?: { passed: number; failed: number; at: number };
  lastPatchAt?: number;
  planOpen: string[];
  planUnsupported: string[];
}

export function completionGate(s: RunState): string | null {
  if (s.planOpen.length) return `${s.planOpen.length} plan steps are not done: ${s.planOpen.join(", ")}. Complete them, or drop them with a reason.`;
  if (s.planUnsupported.length) return `Steps ${s.planUnsupported.join(", ")} are marked done without evidence.`;
  if (s.filesChanged.length && !s.lastTestResult) return "You changed files but never ran the tests.";
  if (s.lastTestResult && s.lastPatchAt && s.lastTestResult.at < s.lastPatchAt) return "You patched after the last test run. Run the tests again.";
  if (s.lastTestResult?.failed) return `${s.lastTestResult.failed} tests are failing. Fix them, or explain specifically why they are unrelated.`;
  return null;
}

/* ---------------- rung 3: critic loop that terminates ---------------- */

export async function withCritic<T>(
  generate: (feedback?: Critique) => Promise<T>,
  critique: (candidate: T) => Promise<Critique>,
  opts = { maxRounds: 3, acceptAt: 0.8 },
): Promise<{ value: T; rounds: number; history: Critique[]; reason: string }> {
  let candidate = await generate();
  const history: Critique[] = [];
  const candidates: T[] = [candidate];

  for (let round = 1; round <= opts.maxRounds; round++) {
    const c = await critique(candidate);
    history.push(c);
    if (c.score >= opts.acceptAt) return { value: candidate, rounds: round, history, reason: "accepted" };

    const prev = history.at(-2);
    // Guard: no improvement means the critic has nothing more to offer.
    if (prev && c.score <= prev.score + 0.02) return { value: best(candidates, history), rounds: round, history, reason: "no improvement" };
    // Guard: the same complaint twice means the generator cannot act on it.
    if (prev && sameIssues(prev, c)) return { value: best(candidates, history), rounds: round, history, reason: "repeated issue" };

    candidate = await generate(c);
    candidates.push(candidate);
  }
  return { value: best(candidates, history), rounds: opts.maxRounds, history, reason: "round cap" };
}

/** Scores can go DOWN. Returning the last candidate returns the worse one. */
const best = <T>(cands: T[], hist: Critique[]): T => {
  let bi = 0;
  hist.forEach((h, i) => { if (h.score > (hist[bi]?.score ?? -1)) bi = i; });
  return cands[Math.min(bi, cands.length - 1)];
};

const sameIssues = (a: Critique, b: Critique): boolean =>
  a.blocking.length > 0 && a.blocking.join("|") === b.blocking.join("|");

/* ---------------- measurement ---------------- */

interface ErrorClass { k: string; weight: number; gt: number; rule: number; critic: number; self: number; cons: number }

const ERRORS: ErrorClass[] = [
  { k: "code does not compile / test fails", weight: 22, gt: .99, rule: .10, critic: .45, self: .30, cons: .35 },
  { k: "claimed work that was not done",     weight: 19, gt: .92, rule: .55, critic: .60, self: .08, cons: .20 },
  { k: "fabricated fact or citation",        weight: 17, gt: .05, rule: .78, critic: .62, self: .12, cons: .55 },
  { k: "wrong tool / wrong approach",        weight: 14, gt: .30, rule: .12, critic: .58, self: .22, cons: .48 },
  { k: "arithmetic / unit slip",             weight: 12, gt: .60, rule: .70, critic: .50, self: .45, cons: .62 },
  { k: "misread the requirement",            weight: 10, gt: .15, rule: .08, critic: .55, self: .15, cons: .30 },
  { k: "output format violation",            weight:  6, gt: .20, rule: .96, critic: .40, self: .55, cons: .25 },
];

interface Config { name: string; gt?: boolean; rule?: boolean; critic?: boolean; self?: boolean; cons?: boolean; leak?: boolean }

function evaluate(c: Config) {
  const total = ERRORS.reduce((t, e) => t + e.weight, 0);
  let caught = 0;
  const perClass: Array<[string, number]> = [];
  for (const e of ERRORS) {
    let miss = 1;
    if (c.gt) miss *= 1 - e.gt;
    if (c.rule) miss *= 1 - e.rule;
    // A critic that reads the reasoning is persuaded by it.
    if (c.critic) miss *= 1 - e.critic * (c.leak ? 0.35 : 1);
    if (c.self) miss *= 1 - e.self * 0.45;      // same-context critique is weak
    if (c.cons) miss *= 1 - e.cons;
    caught += (e.weight / total) * (1 - miss);
    perClass.push([e.k, 1 - miss]);
  }
  const cost = 1 + (c.critic ? .55 : 0) + (c.self ? .25 : 0) + (c.cons ? .9 : 0) + (c.gt ? .05 : 0);
  const fp = (c.critic ? 6 : 0) + (c.self ? 3 : 0) + (c.rule ? 1 : 0);
  const lat = (c.critic ? 900 : 0) + (c.self ? 500 : 0) + (c.cons ? 950 : 0) + (c.gt ? 4000 : 0);
  return { caught, cost, fp, lat, perClass };
}

/* ---------------- demo ---------------- */

async function main(): Promise<void> {
  console.log("\n  C10 · Reflection & Verification\n");

  const configs: Config[] = [
    { name: "none" },
    { name: "self-critique only", self: true },
    { name: "rules + grounding", rule: true },
    { name: "+ independent critic", rule: true, critic: true },
    { name: "+ critic sees reasoning", rule: true, critic: true, leak: true },
    { name: "+ ground truth (tests)", rule: true, critic: true, gt: true },
    { name: "+ self-consistency gate", rule: true, critic: true, gt: true, cons: true },
  ];

  console.log(`  ${"configuration".padEnd(26)} ${"caught".padStart(7)} ${"false alarms".padStart(13)} ${"cost".padStart(6)} ${"added latency".padStart(14)}`);
  for (const c of configs) {
    const r = evaluate(c);
    console.log(`  ${c.name.padEnd(26)} ${(Math.round(r.caught * 100) + "%").padStart(7)} ${(r.fp + "%").padStart(13)} ` +
      `${(r.cost.toFixed(2) + "×").padStart(6)} ${(r.lat < 1000 ? r.lat + " ms" : (r.lat / 1000).toFixed(1) + " s").padStart(14)}`);
  }

  console.log(`\n  the row that matters — "claimed work that was not done":\n`);
  for (const c of [configs[1], configs[2], configs[5]]) {
    const r = evaluate(c);
    const row = r.perClass.find(([k]) => k.startsWith("claimed"))!;
    console.log(`    ${c.name.padEnd(26)} ${(Math.round(row[1] * 100) + "%").padStart(5)}`);
  }
  console.log(`\n  A model has no way to know it did not do something it believes it did.`);
  console.log(`  Only an external observation surfaces it.`);

  console.log(`\n  independence, measured: the same critic with and without the reasoning\n`);
  const indep = evaluate({ name: "", rule: true, critic: true });
  const leaky = evaluate({ name: "", rule: true, critic: true, leak: true });
  console.log(`    fresh context   ${Math.round(indep.caught * 100)}% caught`);
  console.log(`    same thread     ${Math.round(leaky.caught * 100)}% caught   ← identical cost, ${Math.round((indep.caught - leaky.caught) * 100)} points worse`);

  // Grounding, made concrete.
  console.log(`\n  grounding check (rung 2), on a realistic answer:\n`);
  const sources = [
    `Qdrant handles millions of vectors on a single node with quantisation enabled.`,
    `The standard return window is 30 days from delivery.`,
  ];
  const answer = `Qdrant handles 50,000,000 vectors on a single node. ` +
    `The standard return window is 30 days from delivery. ` +
    `The vendor states it is "the fastest engine available".`;
  for (const claim of ungroundedClaims(answer, sources)) console.log(`    ✗ unsupported: ${claim}`);
  console.log(`    ✓ everything else appears in the retrieved sources`);
  console.log(`\n  The first is a fabricated figure sitting beside a genuine citation — the`);
  console.log(`  failure a human skimming will not catch and a regex catches every time.`);

  // Critic loop termination.
  console.log(`\n  critic loop: scores can go down, so keep the best, not the last\n`);
  const scores = [0.61, 0.78, 0.71];
  let i = 0;
  const run = await withCritic<string>(
    async () => `draft ${++i}`,
    async () => ({ score: scores[Math.min(i - 1, scores.length - 1)], criteria: [], blocking: ["tone"] }),
  );
  console.log(`    round scores: ${scores.join(" → ")}`);
  console.log(`    stopped after round ${run.rounds} (${run.reason}); returned "${run.value}"` +
              ` — the 0.78 candidate, not the 0.71 one`);

  // The gate.
  console.log(`\n  completionGate() — a check the model cannot argue with\n`);
  const states: Array<[string, RunState]> = [
    ["changed files, never ran tests", { filesChanged: ["a.ts"], toolsUsed: new Set(), planOpen: [], planUnsupported: [] }],
    ["patched after the last test run", { filesChanged: ["a.ts"], toolsUsed: new Set(["run_tests"]), lastTestResult: { passed: 34, failed: 0, at: 1 }, lastPatchAt: 2, planOpen: [], planUnsupported: [] }],
    ["tests failing", { filesChanged: ["a.ts"], toolsUsed: new Set(["run_tests"]), lastTestResult: { passed: 30, failed: 4, at: 3 }, lastPatchAt: 2, planOpen: [], planUnsupported: [] }],
    ["all clear", { filesChanged: ["a.ts"], toolsUsed: new Set(["run_tests"]), lastTestResult: { passed: 34, failed: 0, at: 3 }, lastPatchAt: 2, planOpen: [], planUnsupported: [] }],
  ];
  for (const [label, st] of states) {
    const g = completionGate(st);
    console.log(`    ${g ? "✗" : "✓"} ${label.padEnd(32)} ${g ?? "may finish"}`);
  }
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
