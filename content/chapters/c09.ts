import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const PLAN_SVG = `
<svg viewBox="0 0 700 290" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Three planning styles: none, plan-then-execute, and interleaved">
  <text x="14" y="18" class="d-label">THREE WAYS TO SPEND A STEP BUDGET</text>

  <text x="14" y="42" class="d-mono" fill="var(--fg-faint)">no plan</text>
  <g>
    <rect x="86" y="30" width="54" height="20" rx="3" class="d-box-a"/><text x="113" y="44" class="d-mono" text-anchor="middle">act</text>
    <rect x="146" y="30" width="54" height="20" rx="3" class="d-box-a"/><text x="173" y="44" class="d-mono" text-anchor="middle">act</text>
    <rect x="206" y="30" width="54" height="20" rx="3" class="d-box-a"/><text x="233" y="44" class="d-mono" text-anchor="middle">act</text>
    <rect x="266" y="30" width="54" height="20" rx="3" class="d-box" stroke="var(--danger)"/><text x="293" y="44" class="d-mono" text-anchor="middle" fill="var(--danger)">?</text>
    <rect x="326" y="30" width="54" height="20" rx="3" class="d-box-a"/><text x="353" y="44" class="d-mono" text-anchor="middle">act</text>
    <rect x="386" y="30" width="54" height="20" rx="3" class="d-box" stroke="var(--danger)"/><text x="413" y="44" class="d-mono" text-anchor="middle" fill="var(--danger)">?</text>
  </g>
  <text x="456" y="44" class="d-mono" fill="var(--fg-faint)">works to ~6 steps, then drifts</text>

  <text x="14" y="102" class="d-mono" fill="var(--fg-faint)">plan first</text>
  <rect x="86" y="80" width="114" height="42" rx="4" class="d-box-p"/>
  <text x="143" y="98" class="d-mono" text-anchor="middle">PLAN</text>
  <text x="143" y="114" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">1 call, 5 steps</text>
  <g>
    <rect x="206" y="90" width="44" height="22" rx="3" class="d-box-a"/><text x="228" y="105" class="d-mono" text-anchor="middle">1</text>
    <rect x="256" y="90" width="44" height="22" rx="3" class="d-box-a"/><text x="278" y="105" class="d-mono" text-anchor="middle">2</text>
    <rect x="306" y="90" width="44" height="22" rx="3" class="d-box-a"/><text x="328" y="105" class="d-mono" text-anchor="middle">3</text>
    <rect x="356" y="90" width="44" height="22" rx="3" class="d-box" stroke="var(--danger)"/><text x="378" y="105" class="d-mono" text-anchor="middle" fill="var(--danger)">4✗</text>
    <rect x="406" y="90" width="44" height="22" rx="3" class="d-box" stroke-dasharray="2 2"/><text x="428" y="105" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">5</text>
  </g>
  <text x="466" y="105" class="d-mono" fill="var(--danger)">step 4 invalidates the plan</text>

  <text x="14" y="176" class="d-mono" fill="var(--fg-faint)">interleaved</text>
  <rect x="86" y="154" width="98" height="42" rx="4" class="d-box-p"/>
  <text x="135" y="172" class="d-mono" text-anchor="middle">SKETCH</text>
  <text x="135" y="188" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">3 phases</text>
  <g>
    <rect x="190" y="164" width="44" height="22" rx="3" class="d-box-a"/><text x="212" y="179" class="d-mono" text-anchor="middle">1</text>
    <rect x="240" y="164" width="44" height="22" rx="3" class="d-box-a"/><text x="262" y="179" class="d-mono" text-anchor="middle">2</text>
    <rect x="290" y="164" width="60" height="22" rx="3" class="d-box-p"/><text x="320" y="179" class="d-mono" text-anchor="middle">replan</text>
    <rect x="356" y="164" width="44" height="22" rx="3" class="d-box-a"/><text x="378" y="179" class="d-mono" text-anchor="middle">3'</text>
    <rect x="406" y="164" width="44" height="22" rx="3" class="d-box-a"/><text x="428" y="179" class="d-mono" text-anchor="middle">4'</text>
    <rect x="456" y="164" width="44" height="22" rx="3" class="d-box-t"/><text x="478" y="179" class="d-mono" text-anchor="middle">✓</text>
  </g>
  <text x="516" y="179" class="d-mono" fill="var(--ok)">plan survives contact</text>

  <line x1="14" y1="216" x2="686" y2="216" stroke="var(--border)"/>
  <text x="14" y="238" class="d-label">THE PLAN'S REAL JOB IS NOT SEQUENCING</text>
  <text x="14" y="258" class="d-mono">it is a <tspan fill="var(--accent)">compressed, pinned statement of intent</tspan> that survives compaction,</text>
  <text x="14" y="276" class="d-mono">and a <tspan fill="var(--accent)">checklist the agent can be held to</tspan> when it claims to be finished.</text>
</svg>`;

const chapter: Chapter = {
  id: "c09",
  num: 9,
  layer: "reasoning",
  title: "Planning",
  subtitle: "Decomposition, replanning, and when a plan is expensive theatre",
  blurb:
    "Explicit plans help on long, dependency-ordered tasks and hurt on short ones. Task decomposition, the todo list as a context artefact, replanning triggers, and how to tell which kind of task you have.",
  lines: 197,
  file: "code/c09_planning.ts",
  tags: ["task decomposition", "plan-then-execute", "todo list", "replanning", "dependencies", "goal drift"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "Where the loop alone stops working",
      html:
        p(`The ${ch("c04", "C04")} loop handles four-step tasks beautifully. Give it <em>"migrate the auth module to the new session API, update the tests, and check nothing else imports the old one"</em> and it will do the first thing well, the second thing partially, and forget the third. Not because it cannot do them, but because by step nine the goal is 30,000 tokens up-scroll and the agent is optimising locally.`) +
        p(`A plan fixes this. A plan also makes short tasks slower, more expensive and occasionally worse, because the model commits to a decomposition before it knows anything. Knowing which situation you are in is the actual skill.`) +
        note("key", "The reframe", p(`A plan's value is not that it sequences the work; the model can sequence fine. Its value is that it is a <strong>short, pinned, re-readable statement of intent</strong> that survives compaction, and a <strong>checklist the agent can be measured against</strong> when it claims to be done. Both of those are context-engineering benefits, not reasoning benefits.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Three planning styles",
      html:
        fig({ label: "Diagram", title: "no plan, plan-first, interleaved", body: PLAN_SVG,
          caption: `Plan-then-execute fails on exactly the tasks that need planning most: the ones with unknowns. Interleaved planning — a coarse sketch, refined as facts arrive — is the shape that survives.` }) +
        table(["Style", "Good for", "Fails when"], [
          ["<b>None (ReAct)</b>", "≤6 steps, no ordering constraints", "The goal drifts; the agent declares victory early"],
          ["<b>Plan-then-execute</b>", "Known, stable procedures; parallelisable independent work", "Any step can invalidate the plan — which is most real work"],
          ["<b>Interleaved</b>", "<b>Default.</b> Long tasks with unknowns", "Adds a model call per replan; overkill under ~6 steps"],
          ["<b>Hierarchical</b>", "Very large tasks — phases, each decomposed on entry", "Complexity; needs subagents (${C17}) to be worth it"],
        ].map((r) => r.map((c) => c.replace("${C17}", `<a href="/c17/" class="mono">C17</a>`))) as string[][]) +
        `<h3>The plan is a data structure, not a paragraph</h3>` +
        code({ title: "code/c09_planning.ts — a plan you can enforce",
          src: `export interface Step {
  id: string;
  what: string;                       // imperative, one action
  why: string;                        // how it serves the goal — this is what catches drift
  dependsOn: string[];
  status: "pending" | "active" | "done" | "blocked" | "dropped";
  evidence?: string;                  // what proved it done. required to mark done.
  note?: string;                      // why blocked, or why dropped
}

export interface Plan { goal: string; steps: Step[]; revision: number }`,
        }) +
        p(`Three fields carry their weight. <code>why</code> is the drift detector: a step whose justification no longer connects to the goal is visible to a reviewer and to the model. <code>evidence</code> makes "done" a claim that must be supported. An agent cannot mark a step complete without naming the observation that completed it, which removes most premature-completion behaviour. And <code>dependsOn</code> is what lets you parallelise safely.`) +
        `<h3>Render it small and pin it</h3>` +
        code({ title: "about 120 tokens, sent every turn, in the high-attention tail",
          src: `export function renderPlan(plan: Plan): string {
  const mark = { done: "[x]", active: "[>]", pending: "[ ]", blocked: "[!]", dropped: "[-]" };
  return \`PLAN (rev \${plan.revision}) — \${plan.goal}\\n\` +
    plan.steps.map((s) =>
      \`\${mark[s.status]} \${s.id}. \${s.what}\` +
      (s.status === "done" && s.evidence ? \`  ← \${truncate(s.evidence, 60)}\` : "") +
      (s.status === "blocked" ? \`  ⚠ \${s.note}\` : "")
    ).join("\\n") +
    \`\\n\\nNext: \${nextActionable(plan)?.what ?? "nothing actionable — replan or finish"}\`;
}`,
        }) +
        p(`This block goes in ${ch("c05", "C05")}'s pinned region, restated at the end of every request. It is the cheapest fix for goal drift there is: about 120 tokens against 30,000 tokens of scrollback.`) },

    { id: "mechanics", kicker: "Mechanics", title: "Replanning: triggers, not vibes",
      html:
        p(`"Replan when needed" is not implementable. Fire on specific conditions:`) +
        table(["Trigger", "Detection", "Response"], [
          ["A step is impossible", "Tool error the agent cannot route around", "Mark blocked, replan from there"],
          ["An assumption broke", "Observation contradicts the step's <code>why</code>", "Replan; keep completed steps"],
          ["New work appeared", "Discovery implies steps that do not exist", "Insert, do not rewrite"],
          ["Steps became unnecessary", "Goal already satisfied by an earlier result", "Mark dropped with a reason"],
          ["N steps, no progress", "Repeat/drift detectors (${C04})", "Replan — the plan is probably wrong"],
        ].map((r) => r.map((c) => c.replace("${C04}", `<a href="/c04/" class="mono">C04</a>`))) as string[][]) +
        code({ title: "replan as a tool the model calls",
          src: `const updatePlan = defineTool({
  name: "update_plan",
  description: \`Revise the plan. Call this when a step became impossible, an assumption
was disproven, or you discovered work the plan does not contain.
DO NOT call it to restate the plan unchanged, or after every step.
Completed steps cannot be modified — their evidence is the run's record.\`,
  input: obj({
    reason: str({ description: "what you learned that makes the old plan wrong" }),
    add: opt(arr(obj({ what: str(), why: str(), after: opt(str()) }))),
    block: opt(arr(obj({ id: str(), note: str() }))),
    drop: opt(arr(obj({ id: str(), note: str() }))),
  }),
  async run(input, ctx) {
    const plan = ctx.state.plan;
    // Structural guard: the model cannot rewrite history or silently abandon the goal.
    assertNoCompletedStepsTouched(plan, input);
    return renderPlan(applyPatch(plan, input));
  },
});`,
        }) +
        note("warn", "Patch, never replace", p(`A <code>replan()</code> that regenerates the whole plan lets the model quietly drop the steps it found difficult and declare a smaller goal. Patching — add, block, drop, each with a reason — makes every abandonment explicit and auditable. This is one of those constraints that looks bureaucratic and changes behaviour immediately.`)) +
        `<h3>Dependencies buy parallelism</h3>` +
        p(`Once steps declare <code>dependsOn</code>, the ready set is computable and independent work can run concurrently — either as parallel tool calls (${ch("c03", "C03")}) or as subagents (${ch("c17", "C17")}).`) +
        code({ title: "the ready set",
          src: `export function ready(plan: Plan): Step[] {
  const done = new Set(plan.steps.filter((s) => s.status === "done").map((s) => s.id));
  return plan.steps.filter((s) => s.status === "pending" && s.dependsOn.every((d) => done.has(d)));
}

// A research task with 5 independent searches and 1 synthesis goes from
// 6 sequential steps (~14s) to 2 waves (~4s). The dependency declaration is what
// makes that safe — without it, parallelising is a guess.`,
        }) },

    { id: "explore", kicker: "Explore", title: "When does planning pay?",
      html:
        p(`Compare planning styles across task length and how often the world surprises the agent. The crossover point is the thing to find.`) +
        lab({ label: "Simulator", title: "planning styles vs task shape",
          body: `
<div class="controls">
  <div class="ctl"><label>true task length</label>
    <input type="range" id="p9-len" min="2" max="30" step="1" value="12"><span class="val" id="p9-len-v">12 steps</span></div>
  <div class="ctl"><label>surprise rate</label>
    <input type="range" id="p9-sur" min="0" max="60" step="5" value="25"><span class="val" id="p9-sur-v">25%</span></div>
  <div class="ctl"><label>independent steps</label>
    <input type="range" id="p9-par" min="0" max="80" step="10" value="30"><span class="val" id="p9-par-v">30%</span></div>
  <div class="ctl"><label>plan pinned in context</label>
    <select id="p9-pin"><option value="1" selected>yes</option><option value="0">no</option></select></div>
</div>
<div id="p9-rows" style="margin-top:.5rem"></div>
<div class="note" id="p9-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var L = +document.getElementById("p9-len").value, S = +document.getElementById("p9-sur").value / 100,
      P = +document.getElementById("p9-par").value / 100, pin = document.getElementById("p9-pin").value === "1";
  document.getElementById("p9-len-v").textContent = L + " steps";
  document.getElementById("p9-sur-v").textContent = (S * 100) + "%";
  document.getElementById("p9-par-v").textContent = (P * 100) + "%";

  var styles = [
    { k: "none (ReAct)", extra: 0, driftAt: 6 },
    { k: "plan-then-execute", extra: 1, driftAt: 99, brittle: true },
    { k: "interleaved", extra: 1 + Math.round(L * S * 0.5), driftAt: 99 },
    { k: "hierarchical", extra: 2 + Math.round(L / 6), driftAt: 99, overhead: true }
  ];
  var rows = styles.map(function (st) {
    // drift: without a pinned plan, long tasks lose the goal
    var drift = (st.k === "none (ReAct)" || !pin) ? Math.max(0, (L - st.driftAt) * 0.055) : 0.02;
    // brittleness: a fixed plan shatters on surprises
    var brittle = st.brittle ? S * 1.5 : S * 0.25;
    // overhead cost on short tasks
    var over = st.overhead && L < 10 ? 0.12 : 0;
    var success = Math.max(0.05, Math.min(0.97, 0.94 - drift - brittle - over));
    var steps = L + st.extra + Math.round(L * S * (st.brittle ? 1.2 : 0.35));
    var par = st.k === "none (ReAct)" ? 1 : 1 + P * 1.4;
    return { k: st.k, success: success, steps: steps, wall: (steps / par * 1.6).toFixed(1) };
  });
  var best = rows.reduce(function (a, b) { return b.success > a.success ? b : a; });
  document.getElementById("p9-rows").innerHTML = rows.map(function (r) {
    var col = r.success > .8 ? "var(--ok)" : r.success > .6 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.35rem 0">' +
      '<span class="mono small" style="width:11rem;color:' + (r === best ? "var(--accent)" : "var(--fg-muted)") + ';font-weight:' + (r === best ? 600 : 400) + '">' + r.k + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (r.success * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(r.success * 100) + '%</span>' +
      '<span class="mono small muted" style="width:8.5rem;text-align:right">' + r.steps + ' steps · ' + r.wall + 's</span></div>';
  }).join("");

  var n = document.getElementById("p9-note");
  if (L <= 5) n.innerHTML = "<b>Short task: planning is overhead.</b> The plan costs a call, adds tokens to every turn, and the loop was never going to lose track of five steps. Ship ReAct.";
  else if (S > .4) n.innerHTML = "<b>High surprise: plan-then-execute collapses.</b> Look at its bar. Every surprise invalidates the fixed plan, and rigid execution against a wrong plan is worse than no plan. Interleaved wins because it replans at each break.";
  else if (!pin) n.innerHTML = "<b>The plan is not pinned.</b> Notice that every style now drifts on long tasks. A plan that is created and then scrolls out of the attention window is a plan that does nothing. Pinning is most of the benefit.";
  else if (P > .5) n.innerHTML = "<b>Highly parallel task.</b> Compare wall-clock, not success. Declared dependencies let independent steps run in waves — the ReAct row cannot do this at all, because nothing knows which steps are independent.";
  else n.innerHTML = "<b>The default region.</b> Long enough to drift, uncertain enough to need replanning: interleaved planning with a pinned todo list. This is what most production coding and research agents do.";
}
["p9-len","p9-sur","p9-par","p9-pin"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Two findings worth internalising. Below about six steps, planning is pure overhead. And turning "plan pinned" off collapses every style to roughly the no-plan row, which tells you that the benefit was context engineering rather than reasoning.`,
        }) },

    { id: "build", kicker: "Build it", title: "Plan as state, not as prose",
      html:
        code({ title: "code/c09_planning.ts — creating the plan",
          src: `export async function makePlan(goal: string, tools: Tool[], model: Model): Promise<Plan> {
  const steps = await structured(model, [{ role: "user", content:
    \`Goal: \${goal}\\n\\nAvailable tools:\\n\${tools.map((t) => \`- \${t.name}: \${t.description.split("\\n")[0]}\`).join("\\n")}\\n\\n\` +
    \`Break this into 3–7 steps. Rules:\\n\` +
    \`- Each step must be verifiable — someone else could tell whether it is done.\\n\` +
    \`- Each step must be achievable with the tools listed. If something is not, make it\\n\` +
    \`  a step that discovers how, rather than assuming.\\n\` +
    \`- State dependencies only where they are real. Independent steps run in parallel.\\n\` +
    \`- If the goal needs fewer than 3 steps, return fewer. Do not pad.\\n\` +
    \`- Do not plan past the first genuine unknown. Make discovering it the last step.\` }],
    arr(obj({ what: str(), why: str(), dependsOn: arr(str()) })));

  return { goal, revision: 1, steps: steps.map((s, i) => ({ ...s, id: String(i + 1), status: "pending" })) };
}`,
        }) +
        p(`The last two rules do the most work. "Do not pad" prevents the five-step plan for a two-step task that models produce when asked for a plan. "Do not plan past the first unknown" is what converts plan-then-execute into interleaved planning without any extra machinery. The plan is deliberately short, and replanning happens because the plan ran out rather than because something failed.`) +
        code({ title: "completion requires evidence",
          src: `const completeStep = defineTool({
  name: "complete_step",
  description: \`Mark a plan step done. You must cite the specific observation that
proves it — a tool result, a file written, a test that passed. "I did it" is not evidence.\`,
  input: obj({ id: str(), evidence: str({ minLength: 20 }) }),
  async run({ id, evidence }, ctx) {
    const step = ctx.state.plan.steps.find((s) => s.id === id);
    if (!step) return \`No step \${id}. Current plan:\\n\${renderPlan(ctx.state.plan)}\`;
    if (step.dependsOn.some((d) => statusOf(ctx.state.plan, d) !== "done")) {
      return \`Step \${id} depends on \${step.dependsOn.join(", ")}, which are not done. \` +
             \`Either complete them first or call update_plan if the dependency is wrong.\`;
    }
    step.status = "done"; step.evidence = evidence;
    return renderPlan(ctx.state.plan);
  },
});`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c09_planning.ts

#   C09 · Planning
#
#   PLAN (rev 1) — Migrate auth to the new session API, update tests, check for stale imports
#   [ ] 1. Find every caller of getSession
#   [ ] 2. Update callers in packages we own
#   [ ] 3. Update the auth tests
#   [ ] 4. Grep for stale imports of the old module
#
#   Next: Find every caller of getSession
#
#   a step blocked mid-run, revised by patch:
#
#   PLAN (rev 2) — Migrate auth to the new session API, update tests, check for stale imports
#   [x] 1. Find every caller of getSession  ← grep found 11 call sites across 6 files
#   [!] 2. Update callers in packages we own  ⚠ 2 call sites are in @vendor/sdk
#   [ ] 3. Update the auth tests
#   [ ] 4. Grep for stale imports of the old module
#   [ ] 5. Open an issue against @vendor/sdk
#
#   Next: Open an issue against @vendor/sdk
#
#   the guards, exercised:
#
#   ✗ complete a step without evidence             refused: Step 4 needs specific evidence — cite the tool result or file
#   ✗ complete a step whose dependency is blocked  refused: Step 3 depends on 2, which are not done.
#   ✗ drop a completed step                        refused: cannot drop completed step 1 — its evidence is the run's recor
#   ✗ drop a step others depend on                 refused: step 2 is required by 3, 4
#   ✗ revise with no reason                        refused: a revision must state what was learned
#   ✓ drop EVERY remaining step (legitimate)       allowed
#
#   dependency waves — what can run in parallel:
#
# …
#     PLAN  Migrate auth to the new session API, update tests, and che   (1 conjunctions, 3 imperatives)`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>The todo list is the dominant production pattern.</strong> Claude Code's <code>TodoWrite</code> and Codex's plan tool are both this chapter: a short structured list the agent maintains, rendered into context every turn, visible to the user. The user-visibility is not decoration; it is how a person decides whether to interrupt.`,
          `<strong>LangGraph's plan-and-execute</strong> makes the plan explicit graph state with a replan node. Worth reading for how it handles the "plan changed mid-execution" edge, which is where hand-rolled versions break.`,
          `<strong>Do not let the plan become the product.</strong> An agent that spends four calls planning a three-step task has made itself worse. Gate plan creation on an estimated-complexity check, or simply on the first tool result suggesting the task is bigger than it looked.`,
          `<strong>Plans are excellent UI.</strong> Streaming the todo list as it updates is the single best progress indicator for a long-running agent, far better than token streaming, because it shows intent rather than activity.`,
          `<strong>Tree-of-thought and similar search methods</strong> explore multiple plans and score them. They are expensive and mostly beaten, in practice, by a single plan plus real verification (${ch("c10", "C10")}), because the bottleneck is usually knowing whether a step worked rather than generating candidate steps.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `For each task, pick a planning style: (a) "what's the weather in Lisbon"; (b) "summarise these 40 PDFs"; (c) "find why the nightly job started failing on Tuesday"; (d) "migrate the codebase from Jest to Vitest".`,
      answer: ul([
        `<b>(a) None.</b> One tool call. A plan would cost more than the task.`,
        `<b>(b) Plan-then-execute</b>, and it is the case where it genuinely shines: 40 independent steps plus one synthesis, no unknowns, fully parallelisable. Declared dependencies turn it into two waves.`,
        `<b>(c) Interleaved, minimally.</b> Debugging is unknowns all the way down; a detailed plan would be fiction. Plan one or two steps ("find what changed Tuesday"), then replan on what you find.`,
        `<b>(d) Hierarchical.</b> Phases (inventory, config, mechanical rewrite, fix the ones that are not mechanical, verify), each decomposed on entry, probably with subagents per package. Too big to hold in one plan.`,
      ]) + p(`The diagnostic question is <em>how much do I know before I start</em>. High knowledge and independence → plan first. Low knowledge → plan one step ahead. Large and structured → hierarchy.`) },

    { difficulty: "core",
      prompt: `Your agent marks steps complete that are not. Give three mechanisms to make "done" mean something, ordered by cost.`,
      answer: ol([
        `<strong>Required evidence (free).</strong> <code>complete_step</code> demands a citation of the observation that proves it, with a minimum length. This alone removes most of the behaviour, because the model must produce something specific and will not invent a test output when it is easier to run one.`,
        `<strong>Programmatic verification (cheap, where it exists).</strong> A step whose completion is checkable in code — file exists, tests pass, endpoint returns 200 — carries a <code>verify</code> function that runs automatically. The agent's claim is not trusted. It is checked. Where this is available it is strictly the best option.`,
        `<strong>A verification pass (one call).</strong> At the end, a separate model call gets the goal, the plan with evidence, and the final answer, and answers "is each step genuinely done, given this evidence". Separate call, no tools, deliberately adversarial framing. This is ${ch("c10", "C10")}.`,
      ]) + p(`A fourth that is worth more than any of them: <strong>make the definition of done part of the step</strong> at planning time. "Update the tests" is unfalsifiable; "npm test passes with zero skipped tests in auth/" is checkable by anyone. The planning prompt's "each step must be verifiable" rule is doing this work upfront.`) },

    { difficulty: "core",
      prompt: `Implement <code>applyPatch(plan, patch)</code> with the guard that completed steps cannot be modified. What else must it refuse, and what must it allow that looks suspicious?`,
      answer: code({ title: "the guards are the feature",
        src: `export function applyPatch(plan: Plan, patch: PlanPatch): Plan {
  const next: Plan = { ...plan, revision: plan.revision + 1, steps: plan.steps.map((s) => ({ ...s })) };

  for (const d of patch.drop ?? []) {
    const s = find(next, d.id);
    if (s.status === "done") throw new PlanError(\`cannot drop completed step \${d.id}\`);
    // Dropping a step others depend on orphans them — refuse unless they go too.
    const dependents = next.steps.filter((x) => x.dependsOn.includes(d.id) && x.status !== "dropped");
    if (dependents.length) throw new PlanError(
      \`step \${d.id} is required by \${dependents.map((x) => x.id).join(", ")}\`);
    s.status = "dropped"; s.note = d.note;
  }

  for (const b of patch.block ?? []) { const s = find(next, b.id); assertNotDone(s); s.status = "blocked"; s.note = b.note; }

  for (const a of patch.add ?? []) {
    next.steps.push({ id: nextId(next), what: a.what, why: a.why,
                      dependsOn: a.after ? [a.after] : [], status: "pending" });
  }

  assertAcyclic(next);          // an added dependency can create a cycle
  return next;
}` }) +
      ul([
        `<strong>Must refuse:</strong> modifying or dropping a completed step (its evidence is the run's record); dropping a step that others depend on; any edit that creates a dependency cycle; and a patch with no <code>reason</code>.`,
        `<strong>Must allow, despite looking wrong:</strong> dropping <em>every</em> remaining step. That is the legitimate "the goal turned out to be already satisfied" case, and blocking it forces the agent to fake work. Require a reason and log it loudly instead.`,
        `<strong>Also allow:</strong> adding a step that depends on a blocked one. That is how an agent plans around an obstacle it expects to clear.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Design the decision procedure for whether to plan at all, computed before the first tool call, cheap enough to run every time.`,
      answer: code({ title: "a gate, not a guess",
        src: `async function shouldPlan(goal: string, model: Model, history: RunStats): Promise<boolean> {
  // 1. FREE: structural signals from the goal text.
  const conjunctions = (goal.match(/\\b(and|then|after|also|plus)\\b/gi) ?? []).length;
  const imperatives = (goal.match(/\\b(create|update|delete|migrate|refactor|check|verify|deploy)\\b/gi) ?? []).length;
  if (conjunctions === 0 && imperatives <= 1 && goal.length < 120) return false;   // clearly small

  // 2. FREE: what happened last time on a task like this.
  const similar = history.similarTasks(goal, 5);
  if (similar.length >= 3) {
    const medianSteps = median(similar.map((t) => t.steps));
    return medianSteps > 6;          // empirical beats any heuristic
  }

  // 3. CHEAP: one small-model call, only when the first two are inconclusive.
  const est = await structured(model, [{ role: "user", content:
    \`How many distinct actions would this require? Answer with a number only.\\n\${goal}\` }],
    obj({ steps: int({ min: 1, max: 50 }) }), { model: "small" });
  return est.steps > 6;
}` }) +
      p(`Three design points. <strong>Order by cost</strong> — the free signals resolve the obvious cases, and the obvious cases are most cases. <strong>History beats heuristics</strong>: once you have run a few hundred tasks, "similar tasks took a median of 9 steps" is a far better predictor than any feature of the prompt, and it improves on its own. <strong>Fail toward not planning</strong>, because an unplanned long task degrades gracefully (it just drifts, and the replan trigger can catch it at step 6) while a planned short task is immediately and permanently more expensive.`) +
      p(`The escape hatch matters too: if the agent reaches step 6 with no plan and the repeat or drift detectors from ${ch("c04", "C04")} have fired, create one then. Planning late is cheap; planning unnecessarily is not.`) },
  ],

  qa: [
    { q: "Should the plan live in the system prompt or as a message?", a: p(`As a rendered block in the pinned region, restated near the end of the request (${ch("c05", "C05")}). Not in the system prompt: it changes, and mutating the system prompt destroys prompt caching on every revision.`) },
    { q: "How detailed should a step be?", a: p(`One verifiable outcome, not one tool call. "Find all callers of <code>getSession</code>" is a step; "run grep" is a tool call. If a step maps to exactly one tool call you have built a workflow and should just write the workflow (${ch("c11", "C11")}).`) },
    { q: "What if the model refuses to replan and keeps pushing a broken plan?", a: p(`Detect it externally: N consecutive steps with no completed step and no plan revision. Then inject the observation — "steps 3 and 4 have failed four times; the plan may be wrong, call update_plan or explain why it is still correct". Same shape as the repeat detector, and for the same reason: the model cannot see the pattern from inside.`) },
    { q: "Can the plan be generated by a cheaper model?", a: p(`Often yes, and it is a good cost split: a small model decomposes, the capable model executes. It works because decomposition is mostly restating a goal at the right granularity. Check it on your hardest tasks before committing — a bad plan is worse than none, since the agent will follow it.`) },
    { q: "Do plans help or hurt when the agent is wrong about the domain?", a: p(`They hurt, and visibly — which is their virtue. A wrong plan is legible to a human in ten seconds, whereas a wrong unplanned run reveals itself after nine steps. Show the plan to the user before executing on anything expensive; that is ${ch("c16", "C16")}'s cheapest intervention point.`) },
  ],

  project: {
    title: "Project · A plan your agent can be held to",
    brief: p(`Add interleaved planning to your agent, with a pinned todo list and evidence-backed completion. Then prove with numbers that it helps on long tasks and hurts on short ones.`),
    spec: [
      "A <code>Plan</code> structure with <code>what</code>, <code>why</code>, <code>dependsOn</code>, <code>status</code> and <code>evidence</code>.",
      "<code>makePlan()</code> whose prompt forbids padding and stops at the first genuine unknown.",
      "<code>update_plan</code> as a patch tool — add, block, drop, each with a reason. Completed steps immutable; cycles and orphaned dependencies refused.",
      "<code>complete_step</code> requiring evidence and checking dependencies.",
      "The rendered plan pinned into every request, under 150 tokens, with the next actionable step named.",
      "A <code>shouldPlan()</code> gate so short tasks skip planning entirely.",
      "Measurements: success rate and step count for no-plan vs planned, on a set of short tasks and a set of 12+ step tasks.",
    ],
    stretch: [
      "Run the ready set in parallel and report the wall-clock difference on a task with independent steps.",
      "Add the stalled-plan detector (N steps, no completion, no revision) with the injected intervention.",
      "Stream plan updates to a terminal UI and compare, informally, how quickly you can tell a run is going wrong versus reading the raw trace.",
    ],
  },

  quiz: [
    { q: "What is the primary benefit of an explicit plan in an agent?",
      options: ["A short pinned statement of intent that survives compaction, plus a checklist completion can be measured against", "Models cannot sequence actions without one", "It reduces the number of model calls", "It guarantees the agent cannot fail a step"],
      answer: 0,
      why: "Models sequence fine. The plan's value is context engineering: a 120-token block in the high-attention region against 30,000 tokens of scrollback, and an enumerated set of outcomes the agent can be checked against when it claims to be done." },
    { q: "Why does plan-then-execute fail on exactly the tasks that most need planning?",
      options: ["Those tasks contain unknowns, and any step can invalidate a plan committed to before anything was learned", "Those tasks have too many steps to enumerate", "Models cannot produce long plans", "Parallel execution is unsafe"],
      answer: 0,
      why: "Committing to a full decomposition before the first observation means the plan is fiction wherever there were unknowns — and rigidly executing a wrong plan is worse than having no plan. Interleaved planning stops at the first unknown deliberately." },
    { q: "Why should replanning patch the plan rather than regenerate it?",
      options: ["Regeneration lets the model silently drop hard steps and declare a smaller goal; a patch makes every abandonment explicit", "Patching uses fewer tokens", "Regeneration breaks prompt caching", "Patches are easier to serialise"],
      answer: 0,
      why: "It is an accountability constraint. Add/block/drop each carry a reason and appear in the log, so scope reduction is visible to a reviewer rather than being absorbed into a fresh plan that happens to be easier." },
    { q: "What makes 'step complete' mean something?",
      options: ["Requiring the agent to cite the specific observation that proves it, and verifying programmatically wherever possible", "Asking the model to double-check its work", "Setting a lower temperature on the completion call", "Requiring all steps to be completed in order"],
      answer: 0,
      why: "Evidence citation is free and removes most premature completion, because inventing a plausible test output is harder than running the test. Where completion is checkable in code, check it rather than trusting the claim." },
    { q: "What did the simulator show happens when the plan is not pinned into every request?",
      options: ["Every planning style collapses toward the no-plan result, showing the benefit was context engineering", "Plans become more accurate because the model is less anchored", "Token usage rises", "Replanning triggers more often and compensates"],
      answer: 0,
      why: "A plan created once and then scrolled out of the attention window does nothing. That the benefit disappears without pinning is the clearest evidence that planning is a context technique, not a reasoning one." },
    { q: "Below roughly how many steps is explicit planning usually net-negative?",
      options: ["About six", "About twenty", "About two", "It is never net-negative"],
      answer: 0,
      why: "Under about six steps the loop will not lose track of the goal, and the plan costs a model call plus tokens on every subsequent turn. Gate planning on estimated length — and fail toward not planning, since an unplanned long task can be rescued at step six." },
  ],

  continues: p(`A plan tells the agent what to do. It does not tell it whether what it did was any good — and models are systematically over-confident about their own output, marking steps complete on evidence that does not support the claim. ${ch("c10", "C10")} is about checking the work, and about why the obvious approach of "ask the model if it is sure" does almost nothing.`),
};

export default chapter;
