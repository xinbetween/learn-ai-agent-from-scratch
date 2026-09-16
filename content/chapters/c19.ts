import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const EVAL_SVG = `
<svg viewBox="0 0 700 290" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Three levels of agent evaluation: outcome, trajectory and component">
  <text x="14" y="18" class="d-label">THREE LEVELS — YOU NEED ALL THREE, FOR DIFFERENT QUESTIONS</text>

  <rect x="14" y="30" width="672" height="56" rx="6" class="d-box-a"/>
  <text x="28" y="50" class="d-text">OUTCOME · did it produce the right answer?</text>
  <text x="28" y="68" class="d-mono" fill="var(--fg-faint)">the only level users feel · programmatic where possible · "is the ticket closed, is the number right"</text>
  <text x="28" y="82" class="d-mono" fill="var(--accent)">answers: is it good? · does NOT answer: why not?</text>

  <rect x="14" y="94" width="672" height="56" rx="6" class="d-box-p"/>
  <text x="28" y="114" class="d-text">TRAJECTORY · did it get there sensibly?</text>
  <text x="28" y="132" class="d-mono" fill="var(--fg-faint)">steps, tools chosen, loops, wasted calls, cost · scored from the trace</text>
  <text x="28" y="146" class="d-mono" fill="var(--plan)">answers: is it degrading? · moves BEFORE outcome does</text>

  <rect x="14" y="158" width="672" height="56" rx="6" class="d-box-t"/>
  <text x="28" y="178" class="d-text">COMPONENT · is each part doing its job?</text>
  <text x="28" y="196" class="d-mono" fill="var(--fg-faint)">retrieval recall@5 · schema parse rate · router accuracy · tool error rate</text>
  <text x="28" y="210" class="d-mono" fill="var(--tool)">answers: which part broke? · fast, cheap, runs on every commit</text>

  <line x1="14" y1="232" x2="686" y2="232" stroke="var(--border)"/>
  <text x="14" y="254" class="d-mono" fill="var(--danger)">an outcome-only suite tells you the agent got worse and nothing else.</text>
  <text x="14" y="274" class="d-mono" fill="var(--ok)">component evals localise the regression in minutes. build them first — they are also the cheapest.</text>
</svg>`;

const chapter: Chapter = {
  id: "c19",
  num: 19,
  layer: "systems",
  title: "Evaluation",
  subtitle: "Knowing whether the change you just made helped",
  blurb:
    "Outcome, trajectory and component evals; building a dataset from production instead of imagination; LLM-as-judge and its biases; and the statistics you need so a 3-point improvement is not noise.",
  lines: 175,
  file: "code/c19_evals.ts",
  tags: ["evals", "LLM-as-judge", "trajectory", "regression suite", "sample size", "pass@k", "dataset"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The question you cannot currently answer",
      html:
        p(`You changed the system prompt. Is the agent better? You tried ten examples and eight looked good. Before the change, it was seven out of ten. Have you improved anything?`) +
        p(`No. You have learned essentially nothing. With ten samples, 70% and 80% are statistically indistinguishable; the 95% confidence interval on 8/10 runs from roughly 44% to 97%. Teams ship changes on this evidence constantly, which is why agent quality wanders rather than improving.`) +
        p(`Evaluation is not a phase at the end. It is the thing that converts changes into <em>knowledge</em>, and without it every prompt edit is a coin flip you cannot see the result of.`) +
        note("key", "Build it before you need it", p(`The most common eval mistake is building the harness after the agent is in production and quality has become a crisis. Build the smallest version on day one — 20 cases and a script — and grow it from real failures. It will be the most-used piece of infrastructure you own.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Three levels",
      html:
        fig({ label: "Diagram", title: "outcome, trajectory, component", body: EVAL_SVG,
          caption: `Outcome tells you something is wrong. Trajectory tells you early. Component tells you where. A suite with only the first is a suite that generates arguments.` }) +
        `<h3>Outcome: prefer programmatic checks, always</h3>` +
        code({ title: "code/c19_evals.ts — grade without a model wherever you can",
          src: `export interface Case {
  id: string; input: string;
  check: (result: AgentResult, env: TestEnv) => Promise<Grade>;
  tags: string[];                       // "refund", "multi-hop", "from-prod", "regression"
}

const cases: Case[] = [
  { id: "refund-eligible-electronics", input: "Is order 4471 eligible for a refund?",
    tags: ["refund", "multi-hop"],
    // Exact, deterministic, free, and it cannot be argued with.
    check: async (r) => ({
      pass: /\\beligible\\b/i.test(r.answer) && r.answer.includes("#882"),
      why: "must conclude eligible AND cite the fault ticket",
    }) },

  { id: "creates-ticket", input: "The screen on order 4471 is flickering.",
    tags: ["write"],
    // Check the WORLD, not the words. The best outcome checks never read the answer.
    check: async (_, env) => {
      const tickets = await env.db.tickets({ order: "4471" });
      return { pass: tickets.length === 1 && tickets[0].category === "hardware",
               why: \`expected exactly 1 hardware ticket, found \${tickets.length}\` };
    } },
];`,
        }) +
        p(`Checking the world rather than the prose is the single biggest quality upgrade available to an eval suite. It is exact, it is free, and it tests what the user actually cares about. Reach for a judge only when the output is genuinely unstructured.`) +
        `<h3>Trajectory: the leading indicator</h3>` +
        code({ title: "scored from the trace, no model needed",
          src: `export function trajectory(r: AgentResult, expected: Expectation): TrajectoryScore {
  return {
    steps: r.steps,
    wastedCalls: countRepeats(r.messages),                       // same tool, same args
    requiredToolsUsed: expected.mustUse.every((t) => usedTool(r, t)),
    forbiddenToolsUsed: expected.mustNotUse.filter((t) => usedTool(r, t)),
    recoveredFromError: hadError(r) && r.ok,                     // a GOOD signal
    tokensPerUsefulStep: r.usage.input / Math.max(1, usefulSteps(r)),
  };
}
// The most valuable single number here: steps-to-completion among runs that SUCCEEDED.
// It rises before the success rate falls, which makes it your early warning (C12).`,
        }) +
        p(`Be careful with trajectory scoring: there is usually more than one right path, and penalising deviation from a golden trace punishes the adaptability you were paying for. Score <em>properties</em> — did it use the required tool, did it avoid the forbidden one, did it loop — not similarity to a reference path.`) +
        `<h3>Component: fast, cheap, on every commit</h3>` +
        table(["Component", "Metric", "Where"], [
          ["Retrieval", "recall@5, MRR, per query class", "${C06}"],
          ["Structured output", "parse rate before and after repair", "${C02}"],
          ["Router", "classification accuracy, fallback rate", "${C11}"],
          ["Tools", "error rate, p99 latency, result tokens", "${C03}"],
          ["Context", "compaction fact-retention, goal-relevance drift", "${C05}"],
        ].map((r) => r.map((c) => c.replace(/\$\{C(\d+)\}/, (_, n) => `<a href="/c${n}/" class="mono">C${n}</a>`))) as string[][]) +
        p(`These run in seconds without calling the agent at all, which means they can gate every commit. Most regressions are localisable here, and finding them here is minutes rather than hours.`) },

    { id: "mechanics", kicker: "Mechanics", title: "Datasets, judges, and statistics",
      html:
        `<h3>The dataset comes from production, not imagination</h3>` +
        ol([
          `<strong>Start with 20 hand-written cases</strong> covering the obvious paths. Enough to catch a catastrophic regression on day one.`,
          `<strong>Add every real failure.</strong> Whenever a run goes wrong, add it — with the input, the observed behaviour, and the expected one. This is the highest-value habit in the chapter, and the suite that results is the one that reflects your actual traffic.`,
          `<strong>Sample production for coverage.</strong> Stratify by route, by outcome, by tool used; include successes so you can detect the change that fixes one thing and breaks three.`,
          `<strong>Tag everything.</strong> Report per tag. A change that lifts the mean while halving multi-hop performance is a regression you will otherwise ship.`,
          `<strong>Freeze a holdout.</strong> Iterating against one set overfits to it. Keep 20–30% unseen and run it before shipping.`,
        ]) +
        note("", "Fifty good cases beat five hundred synthetic ones", p(`Generated cases inherit the vocabulary and assumptions of whoever generated them, so they systematically overestimate performance (${ch("c06", "C06")} makes the same point about retrieval evals). Real failures are worth roughly ten synthetic cases each.`)) +
        `<h3>LLM-as-judge: use it last, and control its biases</h3>` +
        code({ title: "a judge with a rubric, not an opinion",
          src: `const judge = async (task: string, answer: string, reference: string) =>
  structured(model, [{ role: "user", content:
\`Grade this answer against the criteria. You are reviewing someone else's work.

TASK: \${task}
REFERENCE ANSWER: \${reference}
ANSWER TO GRADE: \${answer}

CRITERIA
1. Correct conclusion — matches the reference's verdict.
2. Support — cites the specific evidence, not a general claim.
3. No fabrication — every factual claim also appears in the reference.

For each: pass/fail plus the exact quote that decided it. Length and fluency are
NOT criteria: a terse correct answer scores the same as a long correct one.\` }],
    obj({ criteria: arr(obj({ n: int(), pass: bool(), quote: str() })), pass: bool() }),
    { temperature: 0 });`,
        }) +
        ul([
          `<strong>Verbosity bias</strong> — judges score longer answers higher. Say explicitly that length is not a criterion.`,
          `<strong>Position bias</strong> — in pairwise comparison, order changes the verdict. Run both orders and discard disagreements, or you are measuring position.`,
          `<strong>Self-preference</strong> — a model rates its own family's outputs higher. Use a different family for anything competitive.`,
          `<strong>Calibrate against humans.</strong> Grade 50 cases by hand, compare to the judge, and report the agreement rate. A judge you have not calibrated is a number, not a measurement.`,
        ]) +
        `<h3>The statistics that stop you fooling yourself</h3>` +
        code({ title: "how many runs do you actually need",
          src: `// Detecting a lift from p0 to p1 at 80% power, 5% significance:
//   n ≈ 16 · p̄(1−p̄) / (p1 − p0)²      per arm
//
//   70% → 80%  ≈ 300 runs per arm     ← the "8/10 looked better" case
//   70% → 85%  ≈ 130
//   70% → 90%  ≈  70
//   50% → 80%  ≈  35
//
// Most agent changes are 5–10 point effects, which is why casual A/B comparison
// on a handful of examples is indistinguishable from guessing.

export function wilson(passes: number, n: number, z = 1.96): [number, number] {
  const p = passes / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return [(c - m) / d, (c + m) / d];
}
// 8/10  → [0.49, 0.94]   ← report this, not "80%"
// 80/100→ [0.71, 0.87]
// 800/1000 → [0.775, 0.827]`,
        }) +
        p(`Two practical consequences. <strong>Always report an interval.</strong> "80% (95% CI 49–94%)" makes the uncertainty impossible to ignore in a way "80%" does not. And <strong>run each case several times</strong>. Agents are stochastic, so a single run per case measures the sample rather than the agent. Three to five runs per case, reporting pass rate per case, is the usual compromise.`) +
        code({ title: "paired comparison: much cheaper than two independent arms",
          src: `// Running both variants on the SAME cases removes between-case variance, which is
// usually the largest source of noise. The relevant number is the count of cases
// where they DIFFER — McNemar's test.
const bOnly = cases.filter((c) => !a[c.id].pass && b[c.id].pass).length;
const aOnly = cases.filter((c) => a[c.id].pass && !b[c.id].pass).length;
// If b wins 12 and loses 3, that is meaningful at n=15 discordant pairs,
// even though the overall rates might be 71% vs 80% on 100 cases.`,
        }) },

    { id: "explore", kicker: "Explore", title: "Find out if your improvement is real",
      html:
        p(`Set a true effect size and a suite size, then see what your experiment would actually conclude.`) +
        lab({ label: "Simulator", title: "can you detect this change?",
          body: `
<div class="controls">
  <div class="ctl"><label>baseline success</label><input type="range" id="e19-p0" min="30" max="95" step="1" value="70"><span class="val" id="e19-p0-v">70%</span></div>
  <div class="ctl"><label>true effect</label><input type="range" id="e19-d" min="-10" max="25" step="1" value="6"><span class="val" id="e19-d-v">+6 pts</span></div>
  <div class="ctl"><label>cases in suite</label><input type="range" id="e19-n" min="5" max="500" step="5" value="30"><span class="val" id="e19-n-v">30</span></div>
  <div class="ctl"><label>runs per case</label><input type="range" id="e19-r" min="1" max="5" step="1" value="1"><span class="val" id="e19-r-v">1</span></div>
  <div class="ctl"><label>design</label><select id="e19-pair"><option value="0">two independent arms</option><option value="1" selected>paired (same cases)</option></select></div>
</div>
<div id="e19-out" style="margin-top:.75rem"></div>
<div class="stats">
  <div class="stat"><b id="e19-pow">—</b><span>power to detect it</span></div>
  <div class="stat"><b id="e19-n80">—</b><span>cases needed for 80% power</span></div>
  <div class="stat"><b id="e19-cost">—</b><span>runs per experiment</span></div>
</div>
<div class="note" id="e19-note" style="margin-top:1rem"></div>`,
          script: `
function wilson(k, n) {
  if (!n) return [0, 1];
  var z = 1.96, p = k / n, d = 1 + z * z / n;
  var c = p + z * z / (2 * n), m = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
  return [(c - m) / d, (c + m) / d];
}
function upd() {
  var p0 = +document.getElementById("e19-p0").value / 100, D = +document.getElementById("e19-d").value / 100,
      N = +document.getElementById("e19-n").value, R = +document.getElementById("e19-r").value,
      paired = document.getElementById("e19-pair").value === "1";
  document.getElementById("e19-p0-v").textContent = (p0 * 100).toFixed(0) + "%";
  document.getElementById("e19-d-v").textContent = (D >= 0 ? "+" : "") + (D * 100).toFixed(0) + " pts";
  document.getElementById("e19-n-v").textContent = N;
  document.getElementById("e19-r-v").textContent = R;

  var p1 = Math.max(.01, Math.min(.99, p0 + D));
  var eff = N * R;                                     // effective observations
  var pairBoost = paired ? 1.9 : 1;                    // paired removes between-case variance
  var se = Math.sqrt(p0 * (1 - p0) / eff + p1 * (1 - p1) / eff) / Math.sqrt(pairBoost);
  var zStat = Math.abs(p1 - p0) / Math.max(se, 1e-9);
  var power = Math.max(.05, Math.min(.999, 0.5 * (1 + erf((zStat - 1.96) / Math.SQRT2))));
  var nNeeded = Math.ceil(16 * ((p0 + p1) / 2) * (1 - (p0 + p1) / 2) / Math.pow(Math.max(Math.abs(D), .001), 2) / (R * pairBoost));

  // a plausible observed result
  var rnd = mulberry32(3);
  var k0 = 0, k1 = 0;
  for (var i = 0; i < eff; i++) { if (rnd() < p0) k0++; if (rnd() < p1) k1++; }
  var c0 = wilson(k0, eff), c1 = wilson(k1, eff);
  var overlap = c0[1] >= c1[0] && c1[1] >= c0[0];

  document.getElementById("e19-out").innerHTML =
    '<div class="mono small" style="line-height:1.9">' +
    'baseline  ' + (k0 / eff * 100).toFixed(1) + '%  <span class="muted">95% CI ' + (c0[0] * 100).toFixed(0) + '–' + (c0[1] * 100).toFixed(0) + '%</span><br>' +
    'variant   ' + (k1 / eff * 100).toFixed(1) + '%  <span class="muted">95% CI ' + (c1[0] * 100).toFixed(0) + '–' + (c1[1] * 100).toFixed(0) + '%</span><br>' +
    '<span style="color:' + (overlap ? "var(--danger)" : "var(--ok)") + '">' +
    (overlap ? "intervals overlap — this experiment cannot distinguish them" : "intervals separate — the difference is measurable") + '</span></div>';
  document.getElementById("e19-pow").textContent = Math.round(power * 100) + "%";
  document.getElementById("e19-n80").textContent = isFinite(nNeeded) ? nNeeded.toLocaleString() : "∞";
  document.getElementById("e19-cost").textContent = (eff * 2).toLocaleString();

  var n = document.getElementById("e19-note");
  if (N <= 10) n.innerHTML = "<b>Ten cases.</b> Look at the confidence intervals — they span 40 points or more. This is the 'I tried ten examples and it seemed better' experiment, and it cannot tell a real 6-point gain from noise.";
  else if (power < .5) n.innerHTML = "<b>Underpowered.</b> Even if the change genuinely helps by this much, you have a less-than-even chance of seeing it. You will conclude 'no difference' and discard a real improvement — the expensive, invisible failure mode.";
  else if (!paired) n.innerHTML = "<b>Independent arms.</b> Switch to paired and watch power jump: running both variants on the same cases removes between-case difficulty variance, which is usually the largest noise source. Same cost, better experiment.";
  else if (R === 1) n.innerHTML = "<b>One run per case.</b> Agents are stochastic, so a single run measures the sample rather than the agent. Three runs per case costs 3× and materially tightens the estimate.";
  else n.innerHTML = "<b>A usable experiment.</b> Paired design, repeated runs, intervals reported. Note the cost column — this is why component evals matter: they catch most regressions for a fraction of this.";
}
function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + .3275911 * x);
  var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
  return s * y; }
["e19-p0","e19-d","e19-n","e19-r","e19-pair"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set the suite to 10 cases and the effect to +6 points — a realistic prompt improvement. The power figure is the probability you would notice. It is usually under 20%, which is why most prompt iteration is unmeasured.`,
        }) },

    { id: "build", kicker: "Build it", title: "A harness you will actually run",
      html:
        code({ title: "code/c19_evals.ts — parallel, tagged, reproducible",
          src: `export async function runEval(suite: Case[], agent: AgentFactory, opts: EvalOpts): Promise<Report> {
  const results: CaseResult[] = [];

  // Bounded concurrency: fast enough to run often, gentle enough not to rate-limit.
  await pMap(suite, async (c) => {
    const runs: Grade[] = [];
    for (let i = 0; i < opts.runsPerCase; i++) {
      const env = await opts.makeEnv();          // fresh fixtures: no cross-case contamination
      const r = await agent(env).run(c.input);
      runs.push({ ...(await c.check(r, env)), trajectory: trajectory(r, c), usage: r.usage });
      await env.teardown();
    }
    results.push({ case: c, runs, passRate: runs.filter((x) => x.pass).length / runs.length });
  }, { concurrency: opts.concurrency ?? 8 });

  return {
    overall: aggregate(results),
    byTag: groupBy(results, (r) => r.case.tags).map(aggregate),   // ← where regressions hide
    regressions: opts.baseline ? diff(results, opts.baseline) : [],
    cost: results.reduce((t, r) => t + cost(r), 0),
  };
}`,
        }) +
        `<h3>The report that changes behaviour</h3>` +
        code({ title: "what a useful eval run prints", lang: "text", plain: true,
          src: `eval: 84 cases × 3 runs = 252 runs · 6m12s · $4.18

overall        78.6%  (95% CI 73.1–83.2)   baseline 74.2%   +4.4 pts
                                            McNemar: 19 gains, 7 losses, p=0.019 ✓

by tag
  refund          91.7%  (+2.1)   12 cases
  multi-hop       58.3%  (−9.7)   12 cases   ⚠ REGRESSION
  write           84.6%  (+6.4)   13 cases
  from-prod       71.4%  (+8.9)   28 cases
  regression      96.6%  (+0.0)   29 cases

trajectory
  median steps          4  (was 4)
  p95 steps            11  (was 8)           ⚠ tail growing
  wasted calls / run  0.31  (was 0.18)
  recovered from error  87%  (was 84%)

newly failing (3)
  multi-hop/policy-conflict-882   passed 3/3 → 0/3
  multi-hop/archive-fallback      passed 3/3 → 1/3
  refund/partial-shipment         passed 2/3 → 0/3`,
        }) +
        p(`Three things make this report useful rather than decorative. The <strong>per-tag breakdown</strong> surfaces the multi-hop regression that the +4.4 overall would have hidden. The <strong>trajectory section</strong> shows a growing p95 even though the median is flat — the early warning. And <strong>newly failing cases are named</strong>, so the next step is opening a trace rather than starting an investigation.`) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c19_evals.ts

#   C19 · Evaluation
#
#   "I tried ten examples and it went from 7/10 to 9/10"
#
#       7/10    =  70.0%   95% CI [40%, 89%]
#       9/10    =  90.0%   95% CI [60%, 98%]
#      70/100   =  70.0%   95% CI [60%, 78%]
#     700/1000  =  70.0%   95% CI [67%, 73%]
#
#     The first two intervals overlap almost entirely. That experiment cannot
#     distinguish a real 20-point gain from nothing at all.
#
#   runs needed per arm to detect a change, at 80% power
#
#     70% → 75%    1276 runs per arm
#     70% → 80%     300 runs per arm
#     70% → 85%     125 runs per arm
#     70% → 90%      64 runs per arm
#     50% → 80%      41 runs per arm
#
#     Most agent changes are 5–10 point effects. That is why casual comparison
#     on a handful of examples is indistinguishable from guessing.
#
#   eval: 85 cases × 3 runs = 255 runs per arm
#
#     baseline   78.4%  95% CI [73.0, 83.0]
#     variant    81.6%  95% CI [76.4, 85.8]   +3.1 pts
#     McNemar: variant wins 4, loses 2  (χ²=0.17, p≈0.683) → not significant
#
#     Note the honest outcome: the variant looks +3 points better overall, and
#     the paired test says that is not distinguishable from noise at this sample
#     size — exactly what the power table above predicts. The per-tag breakdown
# …
#     for a person, not an automatic merge.`,
        }) +
        note("good", "Gate on tags, not on the mean", p(`A CI gate that only checks the overall number will happily merge a change that trades multi-hop performance for refund performance. Gate per tag, with a threshold, and the trade becomes a conversation instead of a surprise.`)) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Public benchmarks measure something else.</strong> GAIA, SWE-bench, τ-bench and the rest are useful for comparing models and for orienting yourself. They are not your product. Your 84 cases drawn from your traffic predict your users' experience; a benchmark score does not.`,
          `<strong>Run component evals on every commit, the full suite nightly and before release.</strong> Full agent evals cost real money and minutes; component evals cost neither and catch most regressions.`,
          `<strong>Online evaluation beats offline for drift.</strong> Sample production runs, grade a fraction with a judge, and track the score over time. It catches the world changing — a document set going stale, an API altering its responses — which no fixed suite ever will.`,
          `<strong>Make adding a case trivial.</strong> One command that takes a run id and appends the case with its input and current behaviour. If adding a case takes ten minutes, nobody will do it, and the suite will stop reflecting reality within a month.`,
          `<strong>Report cost and latency alongside quality, always.</strong> A change that lifts success by 2 points and doubles spend is a decision for a person, not an automatic merge.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `A colleague reports: "I changed the prompt and success went from 7/10 to 9/10." What do you say?`,
      answer: p(`That the intervals are 35–92% and 55–100%, so those results are entirely consistent with no change at all, and also with a large improvement. The experiment cannot distinguish them.`) +
        p(`Constructively: run both variants on the same 50+ cases (paired), three runs each, and report McNemar's counts — how many cases flipped each way. If the new prompt wins 12 and loses 3 on discordant pairs, that is real. If it wins 7 and loses 6, it is noise, whatever the totals say.`) +
        p(`And add the two cases that changed to the suite either way. Whatever the statistics, those are examples of behaviour you now care about.`) },

    { difficulty: "core",
      prompt: `Build an eval case for "the agent should refuse and explain". What makes refusal cases harder to grade, and how do you avoid the two obvious traps?`,
      answer: code({ title: "grade the refusal AND its quality",
        src: `{
  id: "refuse-refund-out-of-window",
  input: "I want a refund for order 1102.",       // delivered 11 months ago, not faulty
  tags: ["refusal", "policy"],
  check: async (r, env) => {
    // TRAP 1: keyword matching on "cannot" / "unable". A correct refusal that says
    // "the 30-day window closed on 12 April" would fail; an incorrect "I cannot
    // access that system" would pass.
    const refunds = await env.db.refunds({ order: "1102" });
    if (refunds.length) return { pass: false, why: "issued a refund it should have refused" };

    // The world-check above is the important half. The judge grades the explanation.
    const g = await judge(REFUSAL_RUBRIC, r.answer, {
      mustState: ["the refund window has passed", "the specific date or duration"],
      mustNotState: ["a promise to escalate that nobody will act on"],
      mustOffer: ["the exception route if one exists"],
    });
    return { pass: g.pass, why: g.why };
  },
}` }) +
      ul([
        `<strong>Trap 1 — keyword matching.</strong> Refusals have many valid phrasings and many invalid ones that use the same words. Check the <em>world</em> (no refund was issued) plus the <em>content</em> (it gave the real reason), never the surface form.`,
        `<strong>Trap 2 — only testing refusals.</strong> A suite full of cases the agent should refuse trains you toward an agent that refuses everything. Pair every refusal case with a near-miss that should <em>succeed</em> — order 1103, same age, but faulty. The pair measures discrimination; either alone measures a bias.`,
        `<strong>Grade the explanation, not just the decision.</strong> "No" and "no, because the 30-day window closed on 12 April, though a reported fault would change that" are very different products.`,
      ]) },

    { difficulty: "core",
      prompt: `Your LLM judge agrees with human graders 72% of the time. Is that usable? How would you improve it?`,
      answer: p(`Not for gating. 72% agreement means roughly one grade in four is wrong, and those errors are <em>systematic</em> rather than random — judges fail on particular kinds of case — so they bias your measurements in a consistent direction rather than averaging out.`) +
        ol([
          `<strong>Find where it disagrees.</strong> Pull the 28% and classify them. In practice this is nearly always a small number of clusters: partially-correct answers, answers correct by a different route than the reference, and cases where the rubric is genuinely ambiguous.`,
          `<strong>Fix the rubric first, not the model.</strong> Most disagreement is under-specification. "Is the answer correct?" invites a judgement; "does the conclusion match the reference verdict, and is each factual claim present in the reference?" is checkable. Adding two or three explicit criteria typically moves agreement into the high 80s.`,
          `<strong>Require a quote for every criterion.</strong> Forcing the judge to point at the text it is grading removes a large share of invented complaints.`,
          `<strong>Move the gradeable part out of the judge.</strong> If the conclusion can be checked programmatically, check it, and let the judge grade only the explanation. Hybrid grading beats pure judging almost always.`,
          `<strong>Re-measure after each change</strong>, on the same 50 human-graded cases. Agreement is your judge's eval, and it needs a holdout too.`,
        ]) +
        p(`Below about 85% agreement, use the judge for directional monitoring rather than for gating, and say so in the report. A number presented without its reliability is worse than no number.`) },

    { difficulty: "stretch",
      prompt: `Design the full evaluation strategy for an agent handling 10,000 requests a day. Cover CI, pre-release, production monitoring and dataset growth, with a cost budget.`,
      answer: table(["Layer", "What", "When", "Cost"], [
        ["<b>Component</b>", "Retrieval, schema, router, tool contracts", "Every commit, &lt;60s", "$0 — no agent runs"],
        ["<b>Smoke</b>", "15 cases × 1 run, happy paths only", "Every commit, ~2 min", "~$0.40"],
        ["<b>Full suite</b>", "100 cases × 3 runs, per-tag gates", "Nightly + pre-release", "~$5/night"],
        ["<b>Paired A/B</b>", "Both variants, same cases, McNemar", "Per significant change", "~$10"],
        ["<b>Online sampling</b>", "2% of production graded by judge", "Continuous", "~$6/day at 10k/day"],
        ["<b>Human review</b>", "20 sampled runs, graded by a person", "Weekly", "2 hours"],
      ]) +
      p(`<strong>Total: roughly $350/month and two hours a week</strong>, against a production spend that at 10,000 daily requests is likely thousands. The ratio is the argument. Evaluation is a rounding error next to inference, and it is the only thing that makes the inference spend deliberate.`) +
      p(`<strong>Dataset growth, which is the part that decays without a process:</strong> every production failure becomes a case within 24 hours (one command, taking a run id); every user complaint becomes a case; a weekly stratified sample of 10 production runs is triaged and the interesting ones added. Cap the suite at what runs in about 15 minutes and retire cases that have passed 100 consecutive times. They are no longer providing information, and a suite that takes an hour is a suite nobody runs.`) +
      p(`<strong>The weekly human review is not optional.</strong> It is the only layer that notices problems nobody thought to encode: tone drifting, answers technically correct and practically useless, a new failure mode with no existing case. Everything else measures what you already know to look for.`) },
  ],

  qa: [
    { q: "How many eval cases do I need?", a: p(`Enough to detect the effect sizes you care about — typically 50–150 with several runs each for 5–10 point changes. But start with 20 today rather than planning 200 for next quarter: a small suite that runs is infinitely more valuable than a large one that does not exist.`) },
    { q: "Should I use a public benchmark?", a: p(`For orientation and for model selection, yes. For deciding whether your change helped, no: your traffic is not their distribution. Use benchmarks to choose a model, your own suite to evaluate everything else.`) },
    { q: "How do I evaluate an agent with no single right answer?", a: p(`Decompose the outcome into checkable properties: did it cite sources, are the cited sources real and do they contain the claims, does it cover the required aspects, does it avoid the forbidden claims. Most "subjective" outputs turn out to be a handful of objective criteria plus taste. Grade the criteria, sample the taste with humans.`) },
    { q: "My evals pass and users complain. What now?", a: p(`Your suite does not reflect reality. Go to the complaints, turn each into a case, and watch them fail. That gap is the most valuable information you have, and closing it is more useful than any amount of adding synthetic cases.`) },
    { q: "Do I need to eval every prompt tweak?", a: p(`Run component evals and the smoke suite — seconds, free. Run the full paired comparison for anything you intend to defend. The discipline that matters is not evaluating everything; it is never claiming an improvement you have not measured.`) },
  ],

  project: {
    title: "Project · An eval suite that gates your CI",
    brief: p(`Build the harness and wire it into your workflow. The bar: you can state, with a confidence interval, whether your last change helped.`),
    spec: [
      "At least 40 cases with programmatic checks wherever possible — checking the world, not the prose — tagged by capability and source.",
      "Component evals for retrieval, structured output, routing and tool contracts that run in under a minute with no agent calls.",
      "Trajectory scoring: steps, wasted calls, required/forbidden tools, error recovery, tokens per useful step.",
      "Multiple runs per case with per-case pass rates and Wilson intervals on every reported number.",
      "Paired comparison against a stored baseline, with McNemar counts.",
      "A per-tag report that gates CI, with newly-failing cases named.",
      "A one-command way to turn a production run id into a new case.",
    ],
    stretch: [
      "Add an LLM judge with a quote-requiring rubric, calibrate it against 50 human grades, and report the agreement rate next to every judge-derived number.",
      "Add online sampling: grade 2% of production runs and chart the score over time.",
      "Run a real experiment — change one thing, measure it properly, and write down what you learned including if the answer is 'no measurable difference'.",
    ],
  },

  quiz: [
    { q: "A change moves 7/10 to 9/10 on a ten-case suite. What can you conclude?",
      options: ["Essentially nothing — the confidence intervals overlap almost entirely", "A 20-point improvement", "That it helps on at least some cases", "That it is worth shipping"],
      answer: 0,
      why: "The intervals are roughly 35–92% and 55–100%. Detecting a 6–10 point change needs on the order of 100–300 paired observations. This is the most common self-deception in agent development." },
    { q: "Which eval level gives the earliest warning that an agent is degrading?",
      options: ["Trajectory — p95 steps-to-completion rises before the success rate falls", "Outcome — success rate", "Component — retrieval recall", "User complaints"],
      answer: 0,
      why: "An agent taking nine steps for what used to take five is already going wrong while every outcome dashboard is still green. Outcome tells you it broke; trajectory tells you it is breaking." },
    { q: "What is the best way to check an outcome?",
      options: ["Programmatically, against the world — was the ticket created, is the number right", "An LLM judge with a detailed rubric", "String comparison with a reference answer", "Human review of every case"],
      answer: 0,
      why: "Checking the world is exact, free, and tests what the user cares about. Reserve judges for genuinely unstructured output, and even then pair them with a world-check on the decision itself." },
    { q: "Why report results per tag rather than only overall?",
      options: ["A change can lift the mean while badly regressing one capability, and the aggregate hides it", "Tags make the report shorter", "It reduces the number of runs needed", "Aggregates are harder to compute"],
      answer: 0,
      why: "The example report gains 4.4 points overall while losing 9.7 on multi-hop. Gating on the mean merges that trade silently; gating per tag turns it into a decision." },
    { q: "Which LLM-judge bias is corrected by evaluating both orderings of a pair?",
      options: ["Position bias", "Verbosity bias", "Self-preference bias", "Anchoring on the reference answer"],
      answer: 0,
      why: "In pairwise comparison, which candidate appears first measurably changes the verdict. Running both orders and discarding disagreements is the standard control; verbosity needs a rubric clause and self-preference needs a different model family." },
    { q: "Why does a paired design need fewer cases than two independent arms?",
      options: ["Running both variants on the same cases removes between-case difficulty variance, usually the largest noise source", "It halves the number of runs", "It avoids the need for confidence intervals", "Paired tests have higher significance thresholds"],
      answer: 0,
      why: "Cases differ enormously in difficulty, and that variance swamps a 6-point effect. Pairing cancels it, so the relevant number becomes the discordant pairs — where the two variants disagree." },
  ],

  continues: p(`Evals tell you whether the agent is good. When it is not, you need to see inside a specific run: which call, which tool, which observation, and what it cost. ${ch("c20", "C20")} is about instrumentation, and about the four numbers that should be on the wall.`),
};

export default chapter;
