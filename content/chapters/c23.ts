import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const ARCH_SVG = `
<svg viewBox="0 0 700 330" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Deep research agent architecture across five phases">
  <defs><marker id="a23" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker></defs>

  <text x="14" y="18" class="d-label">FIVE PHASES · EACH CHAPTER OF THE COURSE APPEARS SOMEWHERE HERE</text>

  <rect x="14" y="30" width="124" height="60" rx="6" class="d-box-p"/>
  <text x="76" y="50" class="d-text" text-anchor="middle">1 · scope</text>
  <text x="76" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">clarify, then plan</text>
  <text x="76" y="82" class="d-mono" text-anchor="middle" fill="var(--plan)">C09 · C16</text>
  <path d="M142 60 L168 60" class="d-arrow" marker-end="url(#a23)"/>

  <rect x="172" y="30" width="124" height="60" rx="6" class="d-box-a"/>
  <text x="234" y="50" class="d-text" text-anchor="middle">2 · gather</text>
  <text x="234" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">parallel subagents</text>
  <text x="234" y="82" class="d-mono" text-anchor="middle" fill="var(--accent)">C06 · C17</text>
  <path d="M300 60 L326 60" class="d-arrow" marker-end="url(#a23)"/>

  <rect x="330" y="30" width="124" height="60" rx="6" class="d-box-t"/>
  <text x="392" y="50" class="d-text" text-anchor="middle">3 · verify</text>
  <text x="392" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">ground every claim</text>
  <text x="392" y="82" class="d-mono" text-anchor="middle" fill="var(--tool)">C10 · C21</text>
  <path d="M458 60 L484 60" class="d-arrow" marker-end="url(#a23)"/>

  <rect x="488" y="30" width="124" height="60" rx="6" class="d-box-m"/>
  <text x="550" y="50" class="d-text" text-anchor="middle">4 · synthesise</text>
  <text x="550" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">one voice, cited</text>
  <text x="550" y="82" class="d-mono" text-anchor="middle" fill="var(--mem)">C05 · C10</text>

  <path d="M550 94 L550 118" class="d-arrow" marker-end="url(#a23)"/>
  <rect x="470" y="122" width="160" height="40" rx="6" class="d-box"/>
  <text x="550" y="140" class="d-text" text-anchor="middle">5 · report</text>
  <text x="550" y="155" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">gaps stated explicitly</text>

  <path d="M392 94 L392 118 L200 118 L200 94" class="d-arrow" marker-end="url(#a23)" stroke-dasharray="4 3"/>
  <text x="296" y="114" class="d-mono" text-anchor="middle" fill="var(--danger)">unsupported claim → gather again</text>

  <line x1="14" y1="182" x2="686" y2="182" stroke="var(--border)"/>
  <text x="14" y="204" class="d-label">THE DIFFERENCE BETWEEN A DEMO AND A RESEARCH TOOL</text>

  <rect x="14" y="216" width="216" height="52" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="26" y="236" class="d-mono" fill="var(--danger)">demo: searches, then writes</text>
  <text x="26" y="253" class="d-mono" fill="var(--fg-faint)">fluent, confident, uncheckable</text>

  <rect x="242" y="216" width="216" height="52" rx="6" class="d-box-t"/>
  <text x="254" y="236" class="d-mono">every claim ↔ a source span</text>
  <text x="254" y="253" class="d-mono" fill="var(--fg-faint)">checked mechanically, not by a judge</text>

  <rect x="470" y="216" width="216" height="52" rx="6" class="d-box-t"/>
  <text x="482" y="236" class="d-mono">gaps and conflicts stated</text>
  <text x="482" y="253" class="d-mono" fill="var(--fg-faint)">"I could not find X" is an output</text>

  <text x="14" y="296" class="d-mono" fill="var(--accent)">a research agent's product is not prose. it is a set of claims you can check.</text>
  <text x="14" y="318" class="d-mono" fill="var(--fg-faint)">design every phase around that and the quality problem becomes an engineering problem.</text>
</svg>`;

const chapter: Chapter = {
  id: "c23",
  num: 23,
  layer: "capstone",
  title: "Capstone I · A Deep Research Agent",
  subtitle: "Plan, search in parallel, verify every claim, and report the gaps",
  blurb:
    "The first complete system: an orchestrator that decomposes a question, parallel research subagents with isolated contexts, mechanical claim grounding, and a report whose every sentence traces to a source.",
  lines: 379,
  file: "code/c23_research/",
  tags: ["capstone", "research agent", "orchestrator", "citations", "grounding", "verification", "parallel"],

  sections: [
    { id: "motivation", kicker: "The brief", title: "What you are building",
      html:
        p(`A question goes in — <em>"Which of these three vector databases should we use for a 50M-vector workload, and what are the operational trade-offs?"</em> — and a report comes out: structured, cited, with the disagreements between sources surfaced rather than averaged, and an explicit list of what could not be established.`) +
        p(`This is the task multi-agent architecture is genuinely good at (${ch("c17", "C17")}): many independent lookups, each generating far more intermediate material than the final answer needs. It is also the task where hallucination does the most damage, because a fluent, confident, uncheckable report is worse than no report.`) +
        note("key", "The design principle for the whole capstone", p(`<strong>The product is not prose; it is a set of claims you can check.</strong> Every phase is designed around that: gathering records spans, verification checks claims against spans mechanically, and the report renders claims with their provenance. Get this right and quality stops being a matter of taste.`)) +
        `<h3>What it must do</h3>` +
        ul([
          `Clarify an ambiguous question before spending money on it.`,
          `Decompose into independent sub-questions and research them in parallel.`,
          `Cite every factual claim to a specific passage, checked mechanically.`,
          `Surface conflicts between sources instead of smoothing them into an average.`,
          `Report what it could not find, and what it would do next.`,
          `Stay inside a budget, and degrade into a partial report rather than failing.`,
        ]) },

    { id: "architecture", kicker: "Architecture", title: "Five phases",
      html:
        fig({ label: "Diagram", title: "the pipeline, and where each chapter lands", body: ARCH_SVG,
          caption: `Note the loop from verify back to gather. A claim that cannot be grounded is not deleted; it becomes a new sub-question.` }) +
        code({ title: "code/c23_research/orchestrator.ts — the shape",
          src: `export async function research(question: string, cfg: ResearchConfig): Promise<Report> {
  const budget = new Budget(cfg.limits);
  const store = new EvidenceStore();          // every span ever retrieved, addressable

  // 1. SCOPE — clarify only when genuinely ambiguous (C16: attention is a budget).
  const scope = await clarify(question, cfg, budget);
  if (scope.needsUser) return { status: "needs_clarification", questions: scope.questions };

  // 2. PLAN — sub-questions, each independently answerable (C09).
  let plan = await planResearch(scope.question, cfg, budget);

  // 3. GATHER — parallel subagents, isolated contexts (C17).
  for (const wave of plan.waves()) {
    const found = await Promise.allSettled(wave.map((sq) =>
      researchSubagent(sq, { ...cfg, budget: budget.child(sq.id, WORKER_LIMITS), store })));
    plan.record(found);
    if (budget.exceeded()) break;             // C12: degrade, do not fail
  }

  // 4. VERIFY — mechanical grounding, then one more gather wave for what failed.
  const claims = await extractClaims(plan.findings, cfg, budget);
  const graded = claims.map((c) => ({ ...c, grounding: store.ground(c) }));
  const unsupported = graded.filter((c) => c.grounding.kind === "none");
  if (unsupported.length && !budget.exceeded()) {
    plan = plan.addSubQuestions(unsupported.map(toSubQuestion));
    // …one more gather wave, then re-verify. Bounded: at most one retry round.
  }

  // 5. REPORT — cited, conflicts surfaced, gaps named (C10).
  return synthesise(scope.question, graded, plan, budget, cfg);
}`,
        }) +
        `<h3>Phase 1 · Scope, and when to interrupt</h3>` +
        p(`Clarifying every question is annoying; clarifying none wastes whole runs on the wrong interpretation. The gate: ask only when the ambiguity would change the <em>shape</em> of the research, not merely its emphasis.`) +
        code({ title: "a clarification gate that fires rarely",
          src: `const scope = await structured(model, [{ role: "user", content:
\`Question: \${question}

Decide whether you can research this as asked. Ask for clarification ONLY if an
ambiguity would send the research in a materially different direction — a different
set of sources, a different comparison, a different definition of success.

Do NOT ask about: scope you can reasonably bound yourself, preferences you can
cover both ways, or details you can state as an assumption in the report.

If you can proceed, restate the question precisely, listing the assumptions you
are making. Those assumptions go in the report.\` }],
  obj({ needsUser: bool(), questions: arr(str()), question: str(), assumptions: arr(str()) }));`,
        }) +
        p(`The <code>assumptions</code> field is what makes the low-clarification default safe: an unasked question becomes a stated assumption in the report, which the reader can correct. That is nearly always better than an interruption.`) },

    { id: "gather", kicker: "Gather", title: "Subagents that return evidence, not prose",
      html:
        p(`The single most important design decision in this capstone: a research subagent's return value is not a summary. It is <strong>claims with source spans</strong>, and the raw spans go into a shared store the orchestrator can check against.`) +
        code({ title: "code/c23_research/subagent.ts — the contract",
          src: `export interface Evidence {
  id: string;
  url: string; title: string; retrievedAt: number;
  span: string;                    // the EXACT text, quoted verbatim — this is the ground truth
  offset: [number, number];        // where in the document, so it can be re-checked
  trust: "primary" | "secondary" | "unknown";   // official docs vs a blog post (C21: also untrusted)
}

export interface Finding {
  claim: string;                   // one falsifiable sentence
  evidenceIds: string[];           // ≥1, or this finding does not ship
  confidence: number;
  contradicts?: string[];          // other finding ids this conflicts with
}

// The subagent's whole job:
export async function researchSubagent(sq: SubQuestion, cfg): Promise<Finding[]> {
  const agent = runAgent(brief(sq), {
    tools: [webSearch, fetchPage, recordEvidence],   // recordEvidence writes to the shared store
    system: RESEARCH_SYSTEM,
    limits: cfg.budget.limits,
  });
  // 40 pages read, 12 evidence spans stored, ~6 findings returned.
  // The 40 pages never enter the orchestrator's context. That is the 100:1 (C17).
  return (await agent).findings;
}`,
        }) +
        code({ title: "the brief — objective, scope, format, non-goals (C17)",
          src: `function brief(sq: SubQuestion): string {
  return \`RESEARCH QUESTION: \${sq.question}

WHY IT MATTERS: \${sq.why}    // how it serves the parent question

SOURCES: prefer primary — official documentation, the project's own benchmarks,
release notes, source code. Use secondary sources only to locate primary ones,
and mark them as secondary.

FOR EACH FINDING: one falsifiable sentence, plus call record_evidence with the
EXACT quoted passage that supports it. A finding without evidence is not a finding —
do not report it.

IF YOU CANNOT FIND IT: say so explicitly and describe what you looked for. "Not
found" is a valid and useful result. Do not infer a plausible answer.

DO NOT: research \${sq.notMine.join(", ")} — other agents are covering those.
DO NOT: compare against our own systems. Under 600 words.\`;
}`,
        }) +
        note("", "\"Not found\" must be a first-class result", p(`Without that instruction, a subagent that cannot find a number will produce a plausible one, and it will be indistinguishable from a real one two phases later. Making absence reportable is the cheapest anti-hallucination measure in the system.`)) },

    { id: "verify", kicker: "Verify", title: "Grounding, mechanically",
      html:
        p(`${ch("c10", "C10")}'s ladder says prefer checks that do not involve asking a model. For citations, that check exists and almost nobody implements it: <strong>does the claim's supporting text actually appear in the retrieved span?</strong>`) +
        code({ title: "code/c23_research/grounding.ts",
          src: `export type Grounding =
  | { kind: "verbatim"; evidenceId: string }          // quoted text appears exactly
  | { kind: "paraphrase"; evidenceId: string; overlap: number }
  | { kind: "numeric_mismatch"; claimed: string; found: string }   // the dangerous one
  | { kind: "none" };

export function ground(claim: Finding, store: EvidenceStore): Grounding {
  const spans = claim.evidenceIds.map((id) => store.get(id));

  // 1. Numbers first. A fabricated figure beside a real citation is the failure
  //    that destroys trust, and it is trivially checkable.
  for (const n of numbersIn(claim.claim)) {
    const found = spans.some((s) => numbersIn(s.span).some((m) => sameNumber(n, m)));
    if (!found) return { kind: "numeric_mismatch", claimed: n.raw, found: allNumbers(spans) };
  }

  // 2. Quoted strings must appear verbatim.
  for (const q of quotedIn(claim.claim)) {
    if (!spans.some((s) => normalise(s.span).includes(normalise(q)))) return { kind: "none" };
  }

  // 3. Otherwise require substantial shingle overlap with some span.
  const best = Math.max(...spans.map((s) => overlap(shingle(claim.claim, 4), shingle(s.span, 4))));
  if (best >= 0.45) return { kind: "paraphrase", evidenceId: bestId, overlap: best };
  return { kind: "none" };
}`,
        }) +
        p(`Numeric checking is worth the extra twenty lines on its own. "Handles 50,000 QPS" next to a genuine citation to a page that says 5,000 is the characteristic research-agent failure, it is invisible to a human skimming, and a regex plus a comparison catches it every time.`) +
        `<h3>Conflicts are findings, not noise</h3>` +
        code({ title: "surface disagreement with its provenance",
          src: `export function findConflicts(findings: Finding[], store: EvidenceStore): Conflict[] {
  return pairsAboutSameSubject(findings)
    .filter(([a, b]) => contradicts(a, b))           // numeric disagreement, or opposed verdicts
    .map(([a, b]) => ({
      subject: subjectOf(a),
      sides: [render(a, store), render(b, store)],
      // Resolve by SOURCE QUALITY, not by picking one (C17's exercise).
      preferred: preferBy(["primary over secondary", "newer over older", "official over third-party"], a, b),
      resolvable: sameTrust(a, b) ? "no" : "yes",
    }));
}
// Unresolvable conflicts go in the report as conflicts. Averaging them is the
// single worst thing a research agent can do.`,
        }) },

    { id: "report", kicker: "Report", title: "The output, and what makes it trustworthy",
      html:
        code({ title: "the structure", lang: "text", plain: true,
          src: `# Vector database selection for 50M vectors

## Answer
Qdrant and Milvus both handle 50M vectors in a single cluster; Chroma does not
claim support at this scale [1][2][3]. The decision turns on operational model
rather than raw performance.

## Assumptions made
- "50M vectors" means 768-dimensional float32 unless stated otherwise.
- Self-hosted deployment; managed offerings compared separately in §4.

## Findings
### Scale
- Milvus documents deployments above 1B vectors with distributed indexing [1].
- Qdrant documents 50M+ on a single node with quantisation enabled [2].
- Chroma's documentation targets "millions" and gives no figure above 10M [3].

### Conflict · Qdrant memory footprint
Two sources disagree:
- The official benchmark page reports 4.2 GB for 10M × 768 with scalar
  quantisation (retrieved 2026-09-14) [2].
- A third-party blog post reports 11 GB for the same configuration [7].
Preferring [2] as primary and more recent. [7] does not state whether
quantisation was enabled, which likely explains the gap.

## Not established
- Real-world p99 latency at 50M under concurrent writes. No primary source
  publishes this. NEXT STEP: run the reference benchmark ourselves; it is ~2 hours.
- Pricing for Milvus managed above 100M vectors — requires a sales conversation.

## Sources
[1] Milvus docs, "Scalability" — retrieved 2026-09-14 — primary
    "Milvus has been deployed with over one billion vectors…"
…`,
        }) +
        p(`Four things make this trustworthy rather than merely confident, and all four are structural rather than stylistic.`) +
        ol([
          `<strong>Every claim carries a number.</strong> Not "according to the docs" but <code>[1]</code>, which resolves to a URL, a retrieval date, and the exact quoted span.`,
          `<strong>Assumptions are stated.</strong> The reader can correct the premise rather than discovering it was wrong at the end.`,
          `<strong>The conflict is a section.</strong> With both sides, both sources, the preference, and, most importantly, a hypothesis about <em>why</em> they differ.`,
          `<strong>"Not established" is a section, with next steps.</strong> This is the part that turns a report into a research plan, and it is what a demo never has.`,
        ]) +
        code({ title: "code/c23_research/report.ts — synthesis constraints",
          src: `const SYNTH = \`Write the report from these findings. Rules:

1. Every factual sentence must carry a citation marker. If a finding has no
   grounded evidence, you may not state it — put it under "Not established".
2. Do not average or split the difference on conflicting findings. Present both,
   say which you prefer and why, and hypothesise the cause of the difference.
3. State the assumptions from the scoping phase verbatim.
4. "Not established" is a required section. If it is empty, you have not looked
   hard enough — say what you checked to be confident it is empty.
5. Use only the findings supplied. You have no other knowledge for this report.\`;

// Then verify the output mechanically, before returning it:
const unsupported = ungroundedSentences(report, claims);
if (unsupported.length) throw new SynthesisError(unsupported);   // regenerate, do not ship`,
        }) +
        note("good", "Rule 5 matters more than it looks", p(`"Use only the findings supplied" moves the model from recall to composition. Model knowledge is frequently right, frequently stale, and never citable, and a report that mixes cited findings with uncited recall is exactly as untrustworthy as one with no citations, because the reader cannot tell which is which.`)) },

    { id: "explore", kicker: "Explore", title: "Tune the research agent",
      html:
        p(`Configure the agent and see the trade-off between depth, cost, and how much of the report is actually checkable.`) +
        lab({ label: "Simulator", title: "research configuration",
          body: `
<div class="controls">
  <div class="ctl"><label>sub-questions</label><input type="range" id="d23-q" min="1" max="12" step="1" value="5"><span class="val" id="d23-q-v">5</span></div>
  <div class="ctl"><label>sources per sub-question</label><input type="range" id="d23-s" min="2" max="25" step="1" value="8"><span class="val" id="d23-s-v">8</span></div>
  <div class="ctl"><label>architecture</label><select id="d23-a"><option value="single">single agent</option><option value="orch" selected>orchestrator + subagents</option></select></div>
  <div class="ctl"><label>grounding</label><select id="d23-g"><option value="none">none (trust the model)</option><option value="judge">LLM judge</option><option value="mech" selected>mechanical + numeric</option></select></div>
  <div class="ctl"><label>re-gather unsupported claims</label><select id="d23-r"><option value="0">no</option><option value="1" selected>yes (1 round)</option></select></div>
</div>
<div id="d23-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="d23-cost">—</b><span>$ / report</span></div>
  <div class="stat"><b id="d23-time">—</b><span>wall clock</span></div>
  <div class="stat"><b id="d23-tok">—</b><span>tokens in orchestrator ctx</span></div>
</div>
<div class="note" id="d23-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var Q = +document.getElementById("d23-q").value, S = +document.getElementById("d23-s").value,
      A = document.getElementById("d23-a").value, G = document.getElementById("d23-g").value,
      R = document.getElementById("d23-r").value === "1";
  document.getElementById("d23-q-v").textContent = Q;
  document.getElementById("d23-s-v").textContent = S;

  var pages = Q * S, pageTok = 2600;
  var orchTok = A === "orch" ? 6000 + Q * 900 : 6000 + pages * pageTok * 0.55;
  var totalTok = pages * pageTok + orchTok * (A === "orch" ? 1 : Q * 0.4);
  var wall = A === "orch" ? 18 + S * 2.1 + Q * 1.2 : 12 + pages * 2.4;

  var coverage = Math.min(.97, 1 - Math.exp(-Q / 3.4));
  var depth = Math.min(.96, 1 - Math.exp(-S / 5.5));
  var hallucRate = G === "none" ? .17 : G === "judge" ? .08 : .015;
  if (R && G !== "none") hallucRate *= .45;
  var checkable = G === "none" ? .35 : G === "judge" ? .72 : .97;
  var quality = Math.max(.1, coverage * .4 + depth * .35 + (1 - hallucRate) * .25);

  var rows = [["question coverage", coverage], ["depth per sub-question", depth],
              ["claims traceable to a span", checkable], ["overall usefulness", quality]];
  document.getElementById("d23-rows").innerHTML = rows.map(function (x) {
    var col = x[1] > .85 ? "var(--ok)" : x[1] > .6 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:14rem;color:var(--fg-muted)">' + x[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (x[1] * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(x[1] * 100) + '%</span></div>';
  }).join("") +
    '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
    '<span class="mono small" style="width:14rem;color:var(--fg-muted)">unsupported claims shipped</span>' +
    '<span class="meter" style="flex:1"><i style="width:' + (hallucRate * 300) + '%;background:var(--danger)"></i></span>' +
    '<span class="mono small" style="width:3rem;text-align:right">' + (hallucRate * 100).toFixed(1) + '%</span></div>';

  document.getElementById("d23-cost").textContent = "$" + (totalTok * 3 / 1e6 + Q * S * .0004).toFixed(2);
  document.getElementById("d23-time").textContent = Math.round(wall) + "s";
  document.getElementById("d23-tok").textContent = Math.round(orchTok).toLocaleString();

  var n = document.getElementById("d23-note");
  if (A === "single") n.innerHTML = "<b>Single agent.</b> Look at the orchestrator-context figure: every page read stays in one context and is re-sent on every subsequent turn. Wall clock is serial too. This is the case C17 was built for.";
  else if (G === "none") n.innerHTML = "<b>No grounding.</b> 17% of claims are unsupported — and they are indistinguishable from the rest, because they arrive with the same confident tone next to real citations. This is the demo that impresses people and cannot be used.";
  else if (G === "judge") n.innerHTML = "<b>LLM judge grounding.</b> Better, and it shares the writer's blind spots and costs a call per claim. Mechanical checking of numbers and quoted strings is cheaper AND more reliable — this is C10's ladder in one comparison.";
  else if (Q > 8 && S > 15) n.innerHTML = "<b>Very deep.</b> Excellent coverage at real cost and several minutes of wall clock. Worth it for a decision that matters; check whether the marginal sub-question is still adding findings or just confirming.";
  else n.innerHTML = "<b>A good configuration.</b> Parallel subagents keep the orchestrator context small, mechanical grounding makes nearly every claim checkable, and re-gathering rescues most of what failed verification.";
}
["d23-q","d23-s","d23-a","d23-g","d23-r"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set grounding to "none" and read the unsupported-claims bar, then switch to mechanical. The cost barely moves. That comparison is the entire argument for building the grounding layer.`,
        }) },

    { id: "build", kicker: "Build it", title: "Milestones",
      html:
        p(`Build it in six passes. Each is runnable, and each adds one chapter's mechanism to a system that already works.`) +
        table(["#", "Milestone", "Chapters", "Done when"], [
          ["1", "Single-agent researcher with search and fetch", "C01–C04", "It answers a simple question with a bare list of URLs"],
          ["2", "Evidence store and citations", "C03, C06", "Every claim carries a quoted span and a URL"],
          ["3", "Plan and parallel subagents", "C09, C17", "5 sub-questions researched concurrently; orchestrator context stays under 15K"],
          ["4", "Mechanical grounding and re-gather", "C10", "Numeric mismatches caught; unsupported claims become new sub-questions"],
          ["5", "Budgets, degradation, durability", "C08, C12", "Kill it mid-run: it resumes; exhaust the budget: it reports partially"],
          ["6", "Eval suite and tracing", "C19, C20", "20 questions with known answers; per-claim grounding rate reported"],
        ]) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c23_research/main.ts

#   C23 · Capstone I — Deep Research Agent
#
#   question: Which vector database for 50M vectors, and what are the operational trade-offs?
#
#   scope       1 call · 0 clarifications · 2 assumptions recorded
#   plan        3 sub-questions, 1 wave(s)
#   gather      3 subagents · 18 pages fetched · 6 evidence spans stored
#               orchestrator context: 6,156 tok   (single-agent equivalent: 46,800)
#   verify      7 claims · 6 verbatim · 1 numeric_mismatch
#               ✗ NUMERIC MISMATCH — claimed "120000", sources contain 50 million, 768, 4.2 gb
#                 "Qdrant sustains 120,000 queries per second on a single node."
#   re-gather   1 unsupported claim(s) → 1 bounded round → 1 still unsupported → "Not established"
#   synthesise  1 call · 1 conflict(s) surfaced · 2 gap(s) with next steps
#
#   ──────────────────────────────────────────────────────────────────────────────
#   # Which vector database for 50M vectors, and what are the operational trade-offs?
#
#   ## Assumptions made
#   - "50M vectors" means 768-dimensional float32 unless stated otherwise.
#   - Self-hosted deployment; managed offerings are out of scope.
#
#   ## Findings
#   - Milvus has been deployed with over one billion vectors using distributed indexing across a cluster. [1]
#   - A single node holds 50 million 768-dimensional vectors with scalar quantisation enabled, using 4.2 GB of RAM. [2]
#   - In our tests Qdrant used 11 GB for 10 million vectors at 768 dimensions. [3]
#   - Chroma is designed for collections in the millions of embeddings. Larger deployments are not currently supported. [4]
#   - A production Milvus cluster requires etcd, MinIO or S3, and Pulsar or Kafka as dependencies. [5]
#   - Qdrant runs as a single binary with no external dependencies. Clustering is optional. [6]
#
#   ## Conflicts
#   ### scale
#   - A single node holds 50 million 768-dimensional vectors with scalar quantisation enabled, using 4.2 GB of RAM. — Qdrant — Benchmarks, 2026-09-14 (primary) [2]
# …
#     ├ researcher[pricing]    1 calls     15,600 in      380 out  $0.0525`,
        }) +
        note("warn", "The milestone people skip", p(`Number 5. It is unglamorous and it is what separates a script from a tool: a four-minute research run that loses everything to a laptop sleeping, or that returns nothing when the budget runs out, will not get used twice.`)) },
  ],

  exercises: [
    { difficulty: "core",
      prompt: `Your agent reports "Qdrant handles 50M vectors on a single node" citing a page that actually says "Qdrant handles millions of vectors". Which check catches this, and why is it better than an LLM judge?`,
      answer: p(`The numeric check. <code>numbersIn(claim)</code> yields <code>50,000,000</code>; <code>numbersIn(span)</code> yields nothing comparable; the grounding is <code>numeric_mismatch</code>, and the claim cannot ship.`) +
        p(`<strong>Why it beats a judge:</strong> it is deterministic, it costs nothing, and it does not share the writer's blind spot. A judge reading "handles millions" and "handles 50M" has to decide whether one entails the other, and it will often say yes, because in loose prose it nearly does. The regex does not have an opinion.`) +
        p(`Extend it in three directions, all cheap: <strong>units</strong> (5 GB vs 5 MB), <strong>magnitude words</strong> ("millions" is not a number but bounds one, so a claim of 50M against "millions" without a figure should be flagged as <em>unbounded</em>), and <strong>dates</strong> (a claim about "the current version" citing a 2019 page). Each is a small function and each catches a failure a reader would not notice.`) },

    { difficulty: "core",
      prompt: `Two subagents return contradictory memory figures for the same configuration. Write the code path and the report text.`,
      answer: code({ title: "prefer by source quality, never by averaging",
        src: `const conflict = {
  subject: "qdrant memory, 10M × 768, scalar quantisation",
  sides: [
    { value: "4.2 GB", evidence: e2, trust: "primary",   retrievedAt: "2026-09-14" },
    { value: "11 GB",  evidence: e7, trust: "secondary", retrievedAt: "2024-03-02" },
  ],
};

// 1. Mechanical preference: primary beats secondary, newer beats older.
const preferred = byRules(conflict.sides, ["primary>secondary", "newer>older"]);

// 2. If both sides are equally strong, do NOT pick. Escalate to a targeted
//    sub-question: "what accounts for the difference between X and Y?"
if (!preferred) plan.addSubQuestion(explainDifference(conflict));

// 3. Either way, the conflict appears in the report. It is never resolved silently.` }) +
      p(`<strong>Report text:</strong>`) +
      code({ title: "", lang: "text", plain: true,
        src: `### Conflict · Qdrant memory footprint
Sources disagree on memory for 10M × 768 with scalar quantisation:
- 4.2 GB — Qdrant's own benchmark page, retrieved 2026-09-14 [2] (primary)
- 11 GB — third-party blog post, published 2024-03-02 [7] (secondary)

Preferring [2]: primary source, and 30 months newer. [7] does not state whether
quantisation was enabled, which would account for roughly the observed difference.
If this figure is load-bearing for your decision, measure it — the benchmark is
published and takes about 20 minutes to reproduce.` }) +
      p(`The last sentence is the part that makes a conflict section useful rather than merely honest: it tells the reader what it would cost to settle it.`) },

    { difficulty: "stretch",
      prompt: `Design the eval suite for a research agent. Ground truth is expensive and the output is long-form. How do you measure quality without grading essays?`,
      answer: p(`Decompose the essay into checkable properties. Four layers, none of which requires anyone to grade prose:`) +
        ol([
          `<strong>Grounding rate — free, on every run.</strong> The fraction of factual sentences with verifiable grounding, computed mechanically. This is your primary quality metric and it needs no reference answer at all. Track it per run and alert on drops.`,
          `<strong>Known-answer questions.</strong> 20 questions whose answer is a specific checkable fact you have verified by hand ("what is the default HNSW <code>ef_construct</code> in Qdrant?"). Programmatic check on the answer, plus a check that the citation points at a page that really contains it. Cheap to grade, and it catches retrieval and grounding regressions together.`,
          `<strong>Planted-gap questions.</strong> Questions where one sub-answer genuinely does not exist publicly. The agent passes if it reports it under "Not established" and fails if it invents one. This is the most valuable category and it is almost never built. It directly measures the failure that matters.`,
          `<strong>Coverage against a reference outline.</strong> For 10 questions, write by hand the 5–8 aspects a good report must address. Score the fraction covered by checking for the presence of claims about each aspect. Mechanical, stable, and it measures completeness without judging style.`,
        ]) +
        p(`<strong>Plus trajectory metrics from ${ch("c19", "C19")}:</strong> sources fetched per finding (rising means inefficient searching), re-gather rate (rising means the first pass is getting worse), conflicts surfaced per report (falling to zero is suspicious — real research finds disagreements).`) +
        p(`<strong>What to reserve for humans:</strong> twenty minutes a week reading two reports end to end. That is the only layer that catches problems nobody encoded — a report technically grounded and practically useless, a structure that buries the answer, a tone that overstates confidence. Everything else measures what you already knew to look for.`) },
  ],

  qa: [
    { q: "How many sub-questions is right?", a: p(`Three to seven for most questions. Below three you have not decomposed; above seven you are usually splitting one question into overlapping pieces, and the subagents duplicate each other's searches. The simulator's coverage curve flattens around five: the marginal sub-question confirms rather than discovers.`) },
    { q: "Should subagents be able to search the same sources?", a: p(`Yes, and the shared evidence store makes it cheap: a page already fetched is a cache hit rather than a duplicate fetch. What you want to avoid is overlapping <em>questions</em>, which the brief's explicit non-goals handle.`) },
    { q: "What about paywalled or login-required sources?", a: p(`Report them as identified-but-inaccessible under "Not established", with the URL. That is genuinely useful, because the reader may have access. Silently omitting them makes the report look more complete than it is, which is the same failure as inventing an answer.`) },
    { q: "Can I use a smaller model for the subagents?", a: p(`Usually yes, and it is the right cost split. Subagent work is search, read, extract, so it benefits from speed more than from depth. Keep the capable model for decomposition and synthesis, which is where the reasoning is hardest and the token count is lowest.`) },
    { q: "How does this interact with prompt injection?", a: p(`Directly: the agent reads arbitrary web pages and produces a report a human acts on. It is untrusted content plus an output channel (${ch("c21", "C21")}). Keep it away from private data, sanitise the report for images and suspicious links, and treat page content as untrusted throughout, which the evidence-span design already helps with, since only quoted spans cross into synthesis.`) },
  ],

  project: {
    title: "Capstone I · Deep Research Agent",
    brief:
      p(`Build the complete system. Choose a domain where you can verify the answers yourself — a technology comparison, a regulatory question, a literature summary — because you will need to judge whether it is right.`) +
      p(`Work through the six milestones. Each one is shippable; do not skip ahead to the interesting part, because the value of this capstone is watching the earlier chapters become necessary one at a time.`),
    spec: [
      "Scoping with a clarification gate that fires rarely and records assumptions in the report instead.",
      "A plan of 3–7 independently answerable sub-questions with declared dependencies and waves.",
      "Research subagents with isolated contexts, full briefs (objective, scope, format, non-goals), returning findings with evidence ids — never prose summaries.",
      "A shared evidence store holding exact quoted spans, URLs, retrieval timestamps and a primary/secondary trust marking.",
      "Mechanical grounding: numeric checks, verbatim quote checks, shingle overlap — with numeric mismatch as a distinct, loud result.",
      "One bounded re-gather round for unsupported claims; anything still unsupported goes under \"Not established\".",
      "Conflict detection with preference by source quality and a hypothesis about the cause — never averaging.",
      "A report with Answer, Assumptions, Findings, Conflicts, Not established (with next steps) and Sources, every factual sentence cited, verified mechanically before it is returned.",
      "Budgets with degradation to a partial report, durability so a killed run resumes, and per-subagent cost attribution.",
      "An eval suite: known-answer questions, planted-gap questions, coverage against reference outlines, and grounding rate on every run.",
    ],
    stretch: [
      "Add an interactive mode: stream the plan and findings as they arrive, and let the user steer mid-run (C16) — \"skip Chroma, add pgvector\".",
      "Add a follow-up mode where the report becomes session state and the user can ask questions answered from the evidence store without re-researching.",
      "Publish it behind the API from C22, with resumable streaming, and use it yourself for a real decision. That is the only test that matters.",
    ],
  },

  quiz: [
    { q: "What is the product of a research agent?",
      options: ["A set of claims that can be checked against sources — not prose", "A well-written summary", "A list of relevant URLs", "A confidence-scored answer"],
      answer: 0,
      why: "Designing every phase around checkable claims turns quality from a matter of taste into an engineering problem: gathering records spans, verification checks claims against them mechanically, and the report renders provenance." },
    { q: "Why must a research subagent return findings with evidence ids rather than a summary?",
      options: ["A summary cannot be verified afterwards, and the orchestrator needs the spans to ground claims mechanically", "Summaries use more tokens", "Evidence ids are easier to deduplicate", "The orchestrator cannot parse prose"],
      answer: 0,
      why: "Once a subagent has paraphrased, the link between claim and source text is gone and no later phase can restore it. The spans go to a shared store; only the findings cross into the orchestrator's context." },
    { q: "Which grounding check catches 'handles 50M vectors' citing a page that says 'handles millions'?",
      options: ["The numeric check — the claim's number has no counterpart in the span", "Shingle overlap", "An LLM judge", "The verbatim quote check"],
      answer: 0,
      why: "Overlap is high because the sentences are similar, and a judge often accepts the entailment. A regex extracting numbers and comparing them has no opinion, costs nothing, and catches it every time." },
    { q: "Two sources give different figures for the same configuration. What should the report do?",
      options: ["Present both with their sources, state which is preferred and why, and hypothesise the cause of the difference", "Average them", "Report the more recent one only", "Omit the figure entirely"],
      answer: 0,
      why: "Averaging destroys the most useful information in the report. Preference by source quality plus a hypothesis — 'the blog does not say whether quantisation was on' — tells the reader what to trust and what it would cost to settle it." },
    { q: "Why does the synthesis prompt forbid using the model's own knowledge?",
      options: ["A report mixing cited findings with uncited recall is as untrustworthy as one with no citations, because the reader cannot tell which is which", "Model knowledge is always wrong", "It reduces token usage", "It prevents prompt injection"],
      answer: 0,
      why: "Model knowledge is often right, frequently stale, and never citable. Restricting synthesis to supplied findings moves the model from recall to composition, which is what makes every sentence traceable." },
    { q: "Which eval category most directly measures the failure that matters for a research agent?",
      options: ["Planted-gap questions where one sub-answer genuinely does not exist publicly", "Known-answer factual questions", "Coverage against a reference outline", "Human grading of report quality"],
      answer: 0,
      why: "The failure that destroys trust is inventing an answer that cannot be found. A question with a genuine gap tests exactly that: the agent passes only by reporting 'not established', which no amount of fluency fakes." },
  ],

  continues: p(`The research agent reads the world and writes a document. The second capstone changes your files: it reads a repository, plans an edit, patches it, runs the tests, and fixes what it broke — with a permission model that means you can leave it running. ${ch("c24", "C24")} builds it.`),
};

export default chapter;
