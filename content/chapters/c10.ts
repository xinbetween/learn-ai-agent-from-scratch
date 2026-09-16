import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const VERIFY_SVG = `
<svg viewBox="0 0 700 280" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The verification ladder from ground truth to self-critique">
  <text x="14" y="18" class="d-label">ORDERED BY HOW MUCH THE CHECK KNOWS THAT THE AUTHOR DID NOT</text>

  <rect x="14" y="30" width="672" height="42" rx="6" class="d-box-t"/>
  <text x="28" y="48" class="d-text">1 · ground truth</text>
  <text x="28" y="64" class="d-mono" fill="var(--fg-faint)">run the test · compile it · call the API and read the status · diff the file — independent of the model</text>

  <rect x="14" y="78" width="672" height="42" rx="6" class="d-box-p"/>
  <text x="28" y="96" class="d-text">2 · rules you wrote</text>
  <text x="28" y="112" class="d-mono" fill="var(--fg-faint)">schema validity · invariants · "critical ⇒ needsHuman" · cited source actually contains the claim</text>

  <rect x="14" y="126" width="672" height="42" rx="6" class="d-box-a"/>
  <text x="28" y="144" class="d-text">3 · an independent critic</text>
  <text x="28" y="160" class="d-mono" fill="var(--fg-faint)">fresh context, sees the output not the reasoning, given a rubric and permission to fail it</text>

  <rect x="14" y="174" width="672" height="42" rx="6" class="d-box" stroke="var(--danger)" stroke-dasharray="4 3"/>
  <text x="28" y="192" class="d-text" fill="var(--danger)">4 · self-critique in the same context</text>
  <text x="28" y="208" class="d-mono" fill="var(--fg-faint)">"are you sure?" — the author reviewing its own work with all its assumptions still loaded</text>

  <line x1="14" y1="232" x2="686" y2="232" stroke="var(--border)"/>
  <text x="14" y="254" class="d-mono" fill="var(--ok)">rung 1 catches the errors that matter and cannot be argued with.</text>
  <text x="14" y="272" class="d-mono" fill="var(--danger)">rung 4 mostly produces confident agreement. it is not a verification strategy.</text>
</svg>`;

const chapter: Chapter = {
  id: "c10",
  num: 10,
  layer: "reasoning",
  title: "Reflection & Verification",
  subtitle: "Checking the work, and why 'are you sure?' does almost nothing",
  blurb:
    "Models are over-confident about their own output. The verification ladder, critic loops that actually converge, when reflection helps and when it just burns tokens, and the one design rule: the checker must know something the author did not.",
  lines: 213,
  file: "code/c10_reflection.ts",
  tags: ["self-critique", "LLM-as-judge", "verification", "critic loop", "grounding", "over-confidence"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The agent that was sure",
      html:
        p(`Your agent finishes: <em>"I've updated all six call sites and the tests pass."</em> Four call sites were updated. The tests were not run. Nothing is lying. The model genuinely believes this, because from inside its context it made six edits and the last observation was a successful write.`) +
        p(`The reflex is to add <em>"double-check your work before answering"</em> to the system prompt. Measured effect: small, and sometimes negative, because a model asked to re-examine its own reasoning in the same context produces a fluent justification of what it already concluded. Its assumptions are still loaded; that is precisely the problem.`) +
        note("key", "The one rule in this chapter", p(`A verification step is only worth its cost if <strong>the checker knows something the author did not</strong>. A test result. A rule you wrote. A fresh context with no memory of the reasoning. If the check has exactly the same information as the thing being checked, it will mostly agree, and you have paid for a second opinion from the same person.`)) },

    { id: "core-idea", kicker: "Core idea", title: "The verification ladder",
      html:
        fig({ label: "Diagram", title: "four rungs, by independence", body: VERIFY_SVG,
          caption: `Spend effort at the top. Most teams spend it at the bottom, because rung 4 is one line of prompt and rung 1 is engineering.` }) +
        `<h3>1 · Ground truth, wherever it exists</h3>` +
        p(`The most valuable thing you can give an agent is a way to find out it was wrong that does not involve asking a model. This is why coding agents work as well as they do: the compiler and the test suite are ground truth, they are cheap, and they are not persuadable.`) +
        code({ title: "make the verifier a tool, and make the loop use it",
          src: `const runTests = defineTool({
  name: "run_tests",
  description: \`Run the test suite. Returns pass/fail counts and the first 3 failures with
their assertion messages. CALL THIS before claiming any code change works.\`,
  readOnly: false, idempotent: true, timeoutMs: 300_000,
  input: obj({ pattern: opt(str({ description: "test file glob; omit to run all" })) }),
  run: async ({ pattern }, ctx) => summarise(await exec("npm", ["test", ...(pattern ? ["--", pattern] : [])], ctx)),
});

// And the part that matters more than the tool: the agent is not permitted to
// finish without it.
function canFinish(state: RunState): string | null {
  if (state.filesChanged.length && !state.toolsUsed.has("run_tests"))
    return "You changed files but never ran the tests. Run them before answering.";
  if (state.lastTestResult?.failed)
    return \`\${state.lastTestResult.failed} tests are failing. Fix them or explain why they are unrelated.\`;
  return null;
}`,
        }) +
        p(`That <code>canFinish</code> gate is a <em>structural</em> verification: it lives in your loop, not in a prompt, so the model cannot talk its way past it. Where you can express a completion condition in code, do. It is free, deterministic, and it never has a bad day.`) +
        `<h3>2 · Rules you wrote</h3>` +
        p(`Cheap invariants catch a surprising share of nonsense. Schema validity (${ch("c02", "C02")}), cross-field consistency, and one that is specific to agents and underused: <strong>citation grounding</strong> — check mechanically that every quoted claim appears in a document that was actually retrieved.`) +
        code({ title: "grounding without a model",
          src: `export function ungrounded(answer: string, sources: Chunk[]): string[] {
  const corpus = sources.map((s) => normalise(s.text)).join(" ");
  return extractClaims(answer)                       // sentences containing a number, name, or quote
    .filter((c) => {
      // A claim is grounded if a long-enough shingle of it appears in the sources.
      const grams = shingle(normalise(c), 6);
      return ![...grams].some((g) => corpus.includes(g));
    });
}
// Catches the specific failure that damages trust most: a fabricated figure or
// quotation presented with a real citation next to it.`,
        }) +
        `<h3>3 · An independent critic</h3>` +
        p(`A second model call, though the design matters more than the existence:`) +
        ul([
          `<strong>Fresh context.</strong> The critic sees the task and the output, not the reasoning that produced it. Including the reasoning is the single most common mistake, and it converts an independent check into agreement.`,
          `<strong>A rubric, not "is this good".</strong> Specific criteria produce specific findings; open-ended judging produces prose.`,
          `<strong>Permission to pass.</strong> A critic asked to "find problems" will find problems in flawless work. That is instruction-following, not judgement. Ask it to score against criteria and explicitly allow "no issues".`,
          `<strong>Position bias is real.</strong> When comparing two candidates, order affects the verdict. Evaluate both orders and discard disagreements, or you are measuring position.`,
        ]) +
        `<h3>4 · Self-critique</h3>` +
        p(`Worth roughly what it costs, which is not much. It catches arithmetic slips and format violations. It does not catch "I thought I edited six files". Use it as a cheap last pass, never as the verification strategy.`) },

    { id: "mechanics", kicker: "Mechanics", title: "Critic loops that terminate",
      html:
        code({ title: "code/c10_reflection.ts — generate, critique, revise",
          src: `export async function withCritic<T>(
  generate: (feedback?: Critique) => Promise<T>,
  critique: (candidate: T) => Promise<Critique>,
  opts = { maxRounds: 3, acceptAt: 0.8 },
): Promise<{ value: T; rounds: number; history: Critique[] }> {
  let candidate = await generate();
  const history: Critique[] = [];

  for (let round = 1; round <= opts.maxRounds; round++) {
    const c = await critique(candidate);
    history.push(c);

    if (c.score >= opts.acceptAt) return { value: candidate, rounds: round, history };

    // Guard 1: no improvement means the critic has nothing more to offer.
    const prev = history.at(-2);
    if (prev && c.score <= prev.score + 0.02) return { value: best(candidate, history), rounds: round, history };

    // Guard 2: the same complaint twice means the generator cannot act on it.
    if (prev && sameIssues(prev, c)) return { value: candidate, rounds: round, history };

    candidate = await generate(c);
  }
  return { value: candidate, rounds: opts.maxRounds, history };
}`,
        }) +
        p(`Both guards exist because critic loops oscillate. Round 1 finds three real problems. Round 2 finds two smaller ones. Round 3 finds stylistic preferences, the generator "fixes" them, and the output gets worse. The measured pattern is consistent: <strong>round 1 is worth a lot, round 2 a little, round 3 usually nothing</strong>. Cap at two revisions unless you have data saying otherwise.`) +
        note("warn", "Keep the best, not the last", p(`If scores go 0.6 → 0.78 → 0.71, returning the final candidate returns the worse one. Track candidates alongside scores and return the maximum. This is a three-line change that a surprising number of implementations miss.`)) +
        `<h3>Spend verification where it pays</h3>` +
        p(`Verifying everything doubles cost and latency. Verify by <em>stakes</em> × <em>uncertainty</em>:`) +
        table(["Signal", "How to get it", "Action"], [
          ["Irreversible action", "Tool metadata — <code>readOnly</code>, write scope", "Always verify (and see ${C16})"],
          ["Self-consistency", "Sample twice at temp 0.3; do they agree?", "Verify only on disagreement"],
          ["Low retrieval score", "Best chunk below threshold", "Verify, and consider searching again"],
          ["Long chain", "Steps since last ground-truth check", "Verify at intervals, not only at the end"],
          ["Historical failure", "This task type fails 12% of the time (${C19})", "Always verify"],
        ].map((r) => r.map((c) => c.replace("${C16}", `<a href="/c16/" class="mono">C16</a>`).replace("${C19}", `<a href="/c19/" class="mono">C19</a>`))) as string[][]) +
        p(`Self-consistency is the best value of these: two samples at moderate temperature, verify only when they differ. It concentrates spend on the genuinely ambiguous cases, which are usually 5–15% of traffic, rather than taxing all of it.`) },

    { id: "explore", kicker: "Explore", title: "Buy accuracy at various prices",
      html:
        p(`Each strategy has a cost and a catch rate that depends on the error type. Find the combination that catches the errors you actually have.`) +
        lab({ label: "Simulator", title: "verification strategies vs error types",
          body: `
<div class="controls">
  <div class="ctl"><label>strategies</label>
    <div style="display:flex;flex-direction:column;gap:.15rem;font-size:.8125rem">
      <label><input type="checkbox" id="v10-gt"> ground truth (tests/compiler)</label>
      <label><input type="checkbox" id="v10-rule" checked> rules + grounding check</label>
      <label><input type="checkbox" id="v10-critic"> independent critic (fresh ctx)</label>
      <label><input type="checkbox" id="v10-self" checked> self-critique ("are you sure?")</label>
      <label><input type="checkbox" id="v10-cons"> self-consistency gate (2 samples)</label>
    </div></div>
  <div class="ctl"><label>base error rate</label>
    <input type="range" id="v10-err" min="2" max="40" step="1" value="14"><span class="val" id="v10-err-v">14%</span></div>
  <div class="ctl"><label>critic sees reasoning</label>
    <select id="v10-leak"><option value="0" selected>no (fresh context)</option><option value="1">yes (same thread)</option></select></div>
</div>
<div id="v10-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="v10-caught">—</b><span>errors caught</span></div>
  <div class="stat"><b id="v10-fp">—</b><span>false alarms</span></div>
  <div class="stat"><b id="v10-cost">—</b><span>cost multiplier</span></div>
  <div class="stat"><b id="v10-lat">—</b><span>added latency</span></div>
</div>
<div class="note" id="v10-note" style="margin-top:1rem"></div>`,
          script: `
var ERRS = [
  { k: "code does not compile / test fails", w: 22, gt: .99, rule: .10, critic: .45, self: .30, cons: .35 },
  { k: "claimed work that was not done",     w: 19, gt: .92, rule: .55, critic: .60, self: .08, cons: .20 },
  { k: "fabricated fact or citation",        w: 17, gt: .05, rule: .78, critic: .62, self: .12, cons: .55 },
  { k: "wrong tool / wrong approach",        w: 14, gt: .30, rule: .12, critic: .58, self: .22, cons: .48 },
  { k: "arithmetic / unit slip",             w: 12, gt: .60, rule: .70, critic: .50, self: .45, cons: .62 },
  { k: "misread the requirement",            w: 10, gt: .15, rule: .08, critic: .55, self: .15, cons: .30 },
  { k: "output format violation",            w:  6, gt: .20, rule: .96, critic: .40, self: .55, cons: .25 }
];
function upd() {
  var on = { gt: document.getElementById("v10-gt").checked, rule: document.getElementById("v10-rule").checked,
             critic: document.getElementById("v10-critic").checked, self: document.getElementById("v10-self").checked,
             cons: document.getElementById("v10-cons").checked };
  var leak = document.getElementById("v10-leak").value === "1";
  var base = +document.getElementById("v10-err").value / 100;
  document.getElementById("v10-err-v").textContent = (base * 100) + "%";

  var totW = ERRS.reduce(function (a, e) { return a + e.w; }, 0), caught = 0, rows = [];
  ERRS.forEach(function (e) {
    var miss = 1;
    if (on.gt) miss *= (1 - e.gt);
    if (on.rule) miss *= (1 - e.rule);
    if (on.critic) miss *= (1 - e.critic * (leak ? 0.35 : 1));   // leaking reasoning guts the critic
    if (on.self) miss *= (1 - e.self * 0.45);                    // same-context critique is weak
    if (on.cons) miss *= (1 - e.cons);
    var share = e.w / totW;
    caught += share * (1 - miss);
    rows.push([e.k, 1 - miss, share]);
  });
  document.getElementById("v10-rows").innerHTML = rows.map(function (r) {
    var col = r[1] > .8 ? "var(--ok)" : r[1] > .5 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:16rem;color:var(--fg-muted)">' + r[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (r[1] * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(r[1] * 100) + '%</span></div>';
  }).join("");

  var cost = 1 + (on.critic ? .55 : 0) + (on.self ? .25 : 0) + (on.cons ? .9 : 0) + (on.gt ? .05 : 0);
  var lat = (on.critic ? 900 : 0) + (on.self ? 500 : 0) + (on.cons ? 950 : 0) + (on.gt ? 4000 : 0);
  var fp = (on.critic ? 6 : 0) + (on.self ? 3 : 0) + (on.rule ? 1 : 0);
  document.getElementById("v10-caught").textContent = Math.round(caught * 100) + "%";
  document.getElementById("v10-fp").textContent = fp + "%";
  document.getElementById("v10-cost").textContent = cost.toFixed(2) + "×";
  document.getElementById("v10-lat").textContent = lat < 1000 ? lat + " ms" : (lat / 1000).toFixed(1) + " s";

  var n = document.getElementById("v10-note");
  if (leak && on.critic) n.innerHTML = "<b>The critic is reading the reasoning.</b> Catch rates collapse across the board. A critic that sees how the answer was produced tends to be persuaded by it — which is the whole reason independence is the design requirement, not a nicety.";
  else if (on.self && !on.gt && !on.critic && !on.cons) n.innerHTML = "<b>Self-critique alone.</b> Look at 'claimed work that was not done': 4%. The model has no way to know it did not do something it believes it did. This is the configuration most teams actually ship.";
  else if (on.gt && on.rule) n.innerHTML = "<b>The good configuration.</b> Ground truth plus rules costs almost nothing per run and catches the two most damaging classes. Note that fabricated facts still need the grounding check — a compiler has no opinion about citations.";
  else if (on.cons && on.critic) n.innerHTML = "<b>Expensive and effective.</b> 2.4× cost for broad coverage. Worth it for irreversible actions; wasteful as a blanket policy. Gate it on stakes × uncertainty rather than running it every time.";
  else n.innerHTML = "<b>Try ground truth.</b> It is the only rung that cannot be argued with, and for code it is nearly free. The rows it cannot help with — fabricated citations, misread requirements — are exactly where the other rungs earn their place.";
}
["v10-gt","v10-rule","v10-critic","v10-self","v10-cons","v10-err","v10-leak"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Tick only self-critique — the most commonly shipped configuration — and read the "claimed work that was not done" row. Then add ground truth. The gap between those two states is most of what this chapter is for.`,
        }) },

    { id: "build", kicker: "Build it", title: "A critic worth its call",
      html:
        code({ title: "code/c10_reflection.ts — independence by construction",
          src: `export async function critique(
  task: string, output: string, rubric: Criterion[], model: Model,
): Promise<Critique> {
  // Note what is NOT passed: the agent's messages, its reasoning, its tool trace.
  // The critic evaluates the artefact, not the process that produced it.
  return structured(model, [{ role: "user", content:
\`Evaluate this output against the criteria. You are reviewing work produced by
someone else. You have no information about how it was produced.

TASK GIVEN:
\${task}

OUTPUT:
\${output}

CRITERIA:
\${rubric.map((c, i) => \`\${i + 1}. \${c.name}: \${c.description}\`).join("\\n")}

For each criterion give pass/fail and one sentence of justification citing the
specific part of the output. If the output satisfies every criterion, say so —
do not invent problems. Then give an overall score from 0 to 1.\` }],
    obj({
      criteria: arr(obj({ name: str(), pass: bool(), why: str(), quote: opt(str()) })),
      score: num({ min: 0, max: 1 }),
      blocking: arr(str({ description: "issues that must be fixed; empty if none" })),
    }), { temperature: 0 });
}`,
        }) +
        p(`Three specifics. <strong>"Produced by someone else"</strong> measurably reduces agreement bias. <strong>The quote field</strong> forces the critic to point at the text. A criticism that cannot cite the output is usually invented. <strong>The explicit permission to pass</strong> prevents the manufactured-findings behaviour that makes critics useless as gates.`) +
        code({ title: "the completion gate, in code",
          src: `// Verification that a model cannot talk its way past.
export function completionGate(state: RunState, plan: Plan): string | null {
  const incomplete = plan.steps.filter((s) => s.status === "pending" || s.status === "active");
  if (incomplete.length)
    return \`\${incomplete.length} plan steps are not done: \${incomplete.map((s) => s.id).join(", ")}. \` +
           \`Complete them, or call update_plan to drop them with a reason.\`;

  const unsupported = plan.steps.filter((s) => s.status === "done" && (s.evidence?.length ?? 0) < 20);
  if (unsupported.length) return \`Steps \${unsupported.map((s) => s.id).join(", ")} are marked done without evidence.\`;

  if (state.filesChanged.length && !state.lastTestResult)
    return "You changed files but never ran the tests.";

  return null;   // only now may the loop return an answer
}`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c10_reflection.ts

#   C10 · Reflection & Verification
#
#   configuration               caught  false alarms   cost  added latency
#   none                            0%            0%  1.00×           0 ms
#   self-critique only             11%            3%  1.25×         500 ms
#   rules + grounding              43%            1%  1.00×           0 ms
#   + independent critic           73%            7%  1.55×         900 ms
#   + critic sees reasoning        53%            7%  1.55×         900 ms
#   + ground truth (tests)         90%            7%  1.60×          4.9 s
#   + self-consistency gate        94%            7%  2.50×          5.8 s
#
#   the row that matters — "claimed work that was not done":
#
#     self-critique only            4%
#     rules + grounding            55%
#     + ground truth (tests)       99%
#
#   A model has no way to know it did not do something it believes it did.
#   Only an external observation surfaces it.
#
#   independence, measured: the same critic with and without the reasoning
#
#     fresh context   73% caught
#     same thread     53% caught   ← identical cost, 20 points worse
#
#   grounding check (rung 2), on a realistic answer:
#
#     ✗ unsupported: Qdrant handles 50,000,000 vectors on a single node.
#     ✗ unsupported: The vendor states it is "the fastest engine available".
#     ✓ everything else appears in the retrieved sources
#
#   The first is a fabricated figure sitting beside a genuine citation — the
# …
#     ✓ all clear                        may finish`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Coding agents are the proof of this chapter.</strong> They outperform agents in other domains largely because ground truth is available and cheap. The generalisable lesson is to <em>manufacture</em> ground truth where it does not exist: a validation endpoint, a dry-run mode, a linter for your domain's output. Building one is usually worth more than any prompt work.`,
          `<strong>LLM-as-judge has known biases:</strong> position, verbosity (longer answers score higher), and self-preference (a model rates its own outputs above equivalent ones). Randomise order, control for length in the rubric, and use a different model family as judge where the stakes justify it.`,
          `<strong>Reflexion and self-refine</strong> are the research names for the critic loop. The literature's reported gains are real and are largest where an external signal is available, which is the same finding as rung 1.`,
          `<strong>Constitutional-AI-style critique</strong> (critique against written principles, then revise) is this pattern with the rubric as the constitution. The mechanism is identical. The difference is who writes the criteria.`,
          `<strong>Put verification in the loop, not after it.</strong> Verifying at the end tells you the run failed. Verifying at each ground-truth boundary lets the agent fix it while the context is still relevant and cheap.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Why does adding "double-check your answer before responding" to the system prompt produce so little improvement?`,
      answer: p(`Because the check has the same information as the thing being checked. The model re-reads its own reasoning with every assumption still loaded, and a plausible chain of reasoning re-reads as plausible. What it produces is a fluent justification, not a discovery.`) +
        p(`It does catch a narrow class: arithmetic slips, format violations, and internal contradictions that are visible on a second pass. It cannot catch "I believe I edited six files", because nothing in the context contradicts that belief. For that you need a source of information the model did not have — a file listing, a test result, a fresh reader.`) },

    { difficulty: "core",
      prompt: `Design verification for an agent that drafts customer emails. There is no compiler. What are your rungs 1 and 2?`,
      answer: p(`"No ground truth" is usually "no ground truth <em>yet</em>". Manufacture it:`) +
        ol([
          `<strong>Rung 1 — checks against real systems.</strong> Every factual claim in the draft is verifiable against the data the agent already has access to: does order 4471 exist, is its status what the email says, is the refund amount equal to the order total, does the promised date match the carrier's estimate? Each is a read tool call, cheap and unarguable. This catches the errors that cause real harm.`,
          `<strong>Rung 2 — rules you write.</strong> Forbidden phrases ("guarantee", "immediately", anything committing to a date not returned by a tool); required elements (order reference, a next step, the correct signature); tone and length limits; and a regex pass for anything that looks like a leaked internal identifier or another customer's data.`,
        ]) +
        code({ title: "the claim-check loop", src: `const claims = await extractClaims(draft);          // structured: {text, kind, refersTo}
const results = await Promise.all(claims.map(verifyAgainstSystems));
const wrong = results.filter((r) => !r.ok);
if (wrong.length) {
  // Feed back as an observation, not an exception — the agent rewrites and re-checks.
  return \`These claims do not match the system of record:\\n\` +
    wrong.map((w) => \`- "\${w.claim}" → actual: \${w.actual}\`).join("\\n");
}` }) +
        p(`Rung 3 (an independent critic scoring tone, clarity and completeness against a rubric) is a reasonable addition. Rung 4 is not worth the call here. And note that the highest-value rung was available all along. It just had to be built.`) },

    { difficulty: "core",
      prompt: `Implement the self-consistency gate: sample twice, verify only on disagreement. What counts as "disagreement" for a tool-calling decision, and what for a written answer?`,
      answer: code({ title: "cheap agreement, expensive only when it matters",
        src: `export async function consistencyGated<T>(
  sample: () => Promise<T>, agree: (a: T, b: T) => boolean,
  verify: (candidates: [T, T]) => Promise<T>,
): Promise<{ value: T; verified: boolean }> {
  const [a, b] = await Promise.all([sample(), sample()]);   // parallel: no added latency
  if (agree(a, b)) return { value: a, verified: false };
  return { value: await verify([a, b]), verified: true };
}

// Tool decision: same tool name AND semantically equivalent arguments.
const agreeOnCall = (a: ToolUse, b: ToolUse) =>
  a.name === b.name && stableStringify(normaliseArgs(a.input)) === stableStringify(normaliseArgs(b.input));

// Written answer: agreement on the CLAIMS, not the wording.
const agreeOnAnswer = (a: string, b: string) => {
  const fa = new Set(extractFacts(a)), fb = new Set(extractFacts(b));   // numbers, names, dates, verdicts
  return jaccard(fa, fb) > 0.85;
}` }) +
      ul([
        `<strong>For tool decisions,</strong> normalise arguments before comparing — key order, whitespace, and semantically equivalent forms (<code>"2024-03-14"</code> vs <code>"14 March 2024"</code>). Without normalisation your disagreement rate is noise and the gate fires constantly.`,
        `<strong>For prose,</strong> never compare text. Two correct answers differ in wording almost always. Extract the claims — figures, names, dates, the actual verdict — and compare those.`,
        `<strong>Sample in parallel</strong> so the gate costs tokens but not wall-clock. This is what makes it affordable at 100% of traffic.`,
        `<strong>Temperature matters:</strong> at 0 the two samples agree nearly always and the gate never fires; at 1.0 they disagree on wording constantly. Around 0.3 is where disagreement tracks genuine ambiguity.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Your critic loop sometimes makes output worse. Design the instrumentation that would prove it, and the policy change it implies.`,
      answer: ol([
        `<strong>Record every candidate, not just the final one.</strong> Each round's output, its score, and the critique that prompted the revision. Without this you cannot tell a regression from a noisy scorer.`,
        `<strong>Score with an independent judge, not the critic.</strong> The critic's own score is the thing under suspicion. Use a separate rubric-based scorer, or better, ground truth where it exists.`,
        `<strong>Chart score by round.</strong> The expected shape is a steep rise into round 1, a small rise into round 2, and flat or down after. Your data will tell you where your own curve turns.`,
        `<strong>Classify the regressions.</strong> Nearly always one of three: the critic raised a <em>stylistic preference</em> and the generator sacrificed substance for it; the critic <em>misread</em> the output and the generator "fixed" something correct; or the revision <em>dropped</em> content while addressing a narrow complaint.`,
      ]) +
      p(`<strong>Policy changes implied.</strong> Cap at the round where your curve flattens — usually two. Return the <em>best-scoring</em> candidate rather than the last. Separate blocking issues from suggestions in the critique schema and only revise for blocking ones. And add a regression guard: if a revision scores worse than its predecessor, stop and keep the predecessor.`) +
      p(`The deeper fix is the third failure mode: instruct the generator to <em>patch</em> rather than rewrite — "address only the blocking issues; leave everything else byte-identical". Content loss during revision is the most common and least noticed way critic loops destroy value, and it has the same shape as the patch-versus-regenerate rule in ${ch("c09", "C09")}.`) },
  ],

  qa: [
    { q: "Should the critic use a different model?", a: p(`It helps for subjective judgements — models show a measurable preference for their own outputs — but it matters far less than fresh context and a specific rubric. Fix independence and the rubric first; switch models only if you are comparing candidates or the stakes justify the operational cost of a second provider.`) },
    { q: "How many critic rounds?", a: p(`Two revisions maximum, with the guards. Measured returns are steep into round 1, small into round 2, and negative after. If you need more, the problem is the generator's prompt or the task decomposition, not the number of rounds.`) },
    { q: "Is verification worth it for read-only agents?", a: p(`Yes, for a different reason: a read-only agent that fabricates a citation causes real harm even though it changed nothing. The grounding check (rung 2) is nearly free and targets exactly that failure. What you can skip is the expensive approval machinery of ${ch("c16", "C16")}.`) },
    { q: "Can the agent verify itself by re-reading the files it edited?", a: p(`Yes, and that is genuinely rung 1 rather than rung 4, because the file system is an external source of truth, so re-reading is a real observation. It catches the "I believe I edited six files" error directly. The limitation is that it verifies the edit happened, not that it was correct. That still needs the tests.`) },
    { q: "How do I stop the critic from inventing problems?", a: p(`Three things together: a rubric with explicit pass/fail criteria rather than open-ended judging; an explicit statement that no issues is an acceptable finding; and a required quote from the output for every criticism. That last one is the most effective. A complaint that cannot cite the text usually evaporates when the citation is required.`) },
  ],

  project: {
    title: "Project · A verification layer",
    brief: p(`Add verification to your agent at three rungs, then measure what each one actually catches. The deliverable is the measurement. You should be able to say which rung earns its cost on your task.`),
    spec: [
      "At least one ground-truth verifier exposed as a tool, and a <code>completionGate()</code> in the loop that refuses to return an answer without it.",
      "Rule-based checks including a grounding check that flags claims not supported by any retrieved source.",
      "An independent critic with a fresh context, a rubric, required quotes, and explicit permission to pass.",
      "<code>withCritic()</code> with a maximum of two revisions, a no-improvement guard, a repeated-issue guard, and best-candidate-wins rather than last.",
      "A gating policy so verification runs on stakes × uncertainty, not on everything.",
      "A results table over at least 50 runs: catch rate, false-alarm rate, cost multiplier and added latency per configuration.",
    ],
    stretch: [
      "Add the self-consistency gate with parallel sampling and claim-level agreement, and report what fraction of traffic it escalates.",
      "Run the critic with and without the agent's reasoning in its context and report the difference. It is the most convincing experiment in this chapter.",
      "Chart critique score by round for 30 tasks and find the round where your own curve turns.",
    ],
  },

  quiz: [
    { q: "What makes a verification step worth its cost?",
      options: ["The checker knows something the author did not — a test result, a written rule, or a fresh context", "It uses a larger model than the generator", "It runs at temperature 0", "It is repeated several times"],
      answer: 0,
      why: "A check with identical information to the thing being checked mostly produces agreement. Independence is the design requirement; everything else is detail." },
    { q: "Why must the critic NOT see the agent's reasoning?",
      options: ["A critic that reads the reasoning is persuaded by it, which converts an independent check into agreement", "It would exceed the context window", "It would slow the critic down", "The reasoning may contain secrets"],
      answer: 0,
      why: "The simulator makes this vivid: leaking the reasoning collapses catch rates across every error class. The critic should evaluate the artefact, not the process, which is also how human code review works best." },
    { q: "Which error class does self-critique essentially fail to catch?",
      options: ["Claiming work that was not done", "Arithmetic slips", "Output format violations", "Internal contradictions"],
      answer: 0,
      why: "The model has no way to know it did not do something it believes it did, because nothing in its context contradicts the belief. Only an external observation (re-read the files, run the tests, list the changes) surfaces it." },
    { q: "In a generate-critique-revise loop, which round gives most of the benefit?",
      options: ["Round 1; round 2 is small and round 3 is often negative", "Round 3, once the critic has calibrated", "All rounds improve equally", "The final round always produces the best output"],
      answer: 0,
      why: "The measured pattern is consistent. Later rounds drift into stylistic preference, and revising for style tends to sacrifice substance. Cap at two and keep the best-scoring candidate rather than the last." },
    { q: "What is a `completionGate` and why is it stronger than a prompt instruction?",
      options: ["A check in the loop code that refuses to return an answer until conditions are met — the model cannot talk its way past it", "A stricter system prompt about finishing", "A higher confidence threshold on the final answer", "A limit on the number of steps"],
      answer: 0,
      why: "Prompt instructions are suggestions to a stochastic process. A structural check is deterministic: 'you changed files and never ran the tests' is decided by your code, not negotiated with the model." },
    { q: "What is the self-consistency gate, and why is it good value?",
      options: ["Sample twice in parallel and run expensive verification only when the samples disagree — concentrating spend on genuinely ambiguous cases", "Ask the model the same question twice and take the second answer", "Run the same prompt at two temperatures and average", "Compare the output against a cached previous answer"],
      answer: 0,
      why: "Disagreement between samples is a decent proxy for the cases where the model is uncertain, which is usually 5–15% of traffic. Sampling in parallel means it costs tokens but not wall-clock." },
  ],

  continues: p(`Planning and verification both add model calls to buy reliability. Sometimes the cheaper answer is to take the decision away from the model entirely: notice that this branch never actually needed judgement, and write an <code>if</code> statement. ${ch("c11", "C11")} is about where to draw that line, and it is the most useful architectural chapter in the course.`),
};

export default chapter;
