import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const LOOP_SVG = `
<svg viewBox="0 0 700 340" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The ReAct loop with guards, and the message array growing beneath it">
  <defs><marker id="l4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="l4a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="18" class="d-label">THE GUARDS RUN BEFORE THE MONEY IS SPENT</text>

  <rect x="14" y="30" width="150" height="72" rx="6" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="48" class="d-mono" fill="var(--fg-faint)">top of loop</text>
  <text x="26" y="66" class="d-mono">steps &lt; maxSteps ?</text>
  <text x="26" y="82" class="d-mono">tokens &lt; budget ?</text>
  <text x="26" y="98" class="d-mono">now &lt; deadline ?</text>

  <path d="M168 66 L204 66" class="d-arrow" marker-end="url(#l4)"/>

  <rect x="208" y="40" width="120" height="52" rx="6" class="d-box-a"/>
  <text x="268" y="62" class="d-text" text-anchor="middle">REASON</text>
  <text x="268" y="80" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model(messages)</text>

  <path d="M332 66 L368 66" class="d-arrow-a" marker-end="url(#l4a)"/>

  <path d="M372 66 L428 40 L484 66 L428 92 Z" class="d-box"/>
  <text x="428" y="70" class="d-mono" text-anchor="middle">stopReason?</text>

  <path d="M484 52 L560 52 L560 38" class="d-arrow" marker-end="url(#l4)"/>
  <text x="522" y="46" class="d-mono" fill="var(--fg-faint)">end_turn</text>
  <rect x="500" y="8" width="186" height="30" rx="6" class="d-box"/>
  <text x="593" y="28" class="d-text" text-anchor="middle">return the answer</text>

  <path d="M428 96 L428 128" class="d-arrow-a" marker-end="url(#l4a)"/>
  <text x="436" y="116" class="d-mono" fill="var(--accent)">tool_use</text>

  <rect x="340" y="132" width="176" height="52" rx="6" class="d-box-t"/>
  <text x="428" y="154" class="d-text" text-anchor="middle">ACT</text>
  <text x="428" y="172" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">executeTool ×N (C03)</text>

  <path d="M340 158 L212 158" class="d-arrow-a" marker-end="url(#l4a)"/>

  <rect x="72" y="132" width="140" height="52" rx="6" class="d-box-m"/>
  <text x="142" y="154" class="d-text" text-anchor="middle">OBSERVE</text>
  <text x="142" y="172" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">append results</text>

  <path d="M88 132 L88 66" class="d-arrow-a" marker-end="url(#l4a)"/>
  <text x="80" y="122" class="d-mono" text-anchor="end" fill="var(--accent)">loop</text>

  <line x1="14" y1="204" x2="686" y2="204" stroke="var(--border)"/>
  <text x="14" y="226" class="d-label">WHAT THE MODEL SEES ON ITERATION 4 — THE TRACE IS THE PROGRAM</text>

  <rect x="14" y="238" width="96" height="22" rx="4" class="d-box-m"/><text x="62" y="253" class="d-mono" text-anchor="middle">system</text>
  <rect x="114" y="238" width="80" height="22" rx="4" class="d-box"/><text x="154" y="253" class="d-mono" text-anchor="middle">goal</text>
  <rect x="198" y="238" width="104" height="22" rx="4" class="d-box-a"/><text x="250" y="253" class="d-mono" text-anchor="middle">tool_use ①</text>
  <rect x="306" y="238" width="112" height="22" rx="4" class="d-box-t"/><text x="362" y="253" class="d-mono" text-anchor="middle">result ①</text>
  <rect x="422" y="238" width="104" height="22" rx="4" class="d-box-a"/><text x="474" y="253" class="d-mono" text-anchor="middle">tool_use ②</text>
  <rect x="530" y="238" width="112" height="22" rx="4" class="d-box-t"/><text x="586" y="253" class="d-mono" text-anchor="middle">result ②</text>
  <rect x="646" y="238" width="40" height="22" rx="4" class="d-box-a" opacity=".5"/><text x="666" y="253" class="d-mono" text-anchor="middle" opacity=".6">③…</text>

  <text x="14" y="284" class="d-mono" fill="var(--fg-faint)">there is no hidden state — no scratchpad, no variables, no plan object.</text>
  <text x="14" y="302" class="d-mono" fill="var(--accent)">whatever is not in this array does not exist. that is the whole of C05–C08.</text>
  <text x="14" y="324" class="d-mono" fill="var(--fg-faint)">and every box is re-sent, every iteration, at full price.</text>
</svg>`;

const chapter: Chapter = {
  id: "c04",
  num: 4,
  layer: "model",
  title: "The Agent Loop",
  subtitle: "Reason, act, observe — and the four guards that make it survivable",
  blurb:
    "The chapter everything else hangs off. A complete working agent in about 120 lines: the ReAct cycle, stop conditions, budget enforcement, loop detection, and why the message array is the only state there is.",
  lines: 374,
  file: "code/c04_agent_loop.ts",
  tags: ["ReAct", "agent loop", "stop conditions", "budgets", "loop detection", "trace", "termination"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "Everything so far, joined up",
      html:
        p(`${ch("c01", "C01")} gave you a typed model call. ${ch("c02", "C02")} made its output a value you can branch on. ${ch("c03", "C03")} gave you functions the model can request without anything ever throwing. This chapter spends about forty lines joining them, and the result is an agent that genuinely works. It will book the meeting, find the bug, answer the layered question.`) +
        p(`Then it spends the rest of the chapter on the eighty lines that make it survivable, which is the part nobody puts in the tutorial: what stops it, what happens when it will not stop, and what you hand the user when the budget runs out mid-task.`) +
        note("key", "Carry this file forward", p(`Every chapter from here modifies this loop rather than replacing it. C05 changes what goes into <code>messages</code>. C09 adds a plan to it. C12 hardens the guards. C17 makes the loop itself a tool. If you write one file in this course, write this one.`)),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Reason, act, observe",
      html:
        p(`ReAct — <em>reasoning and acting</em>, from Yao et al. 2022 — is the observation that interleaving the two beats doing either alone. A model that reasons without acting hallucinates facts; a model that acts without reasoning flails. Alternating them means each thought is grounded by the last observation and each action is chosen by the last thought.`) +
        p(`The original paper prompted the model to emit <code>Thought: … Action: … Observation: …</code> as literal text, and you parsed it. Native tool calling replaced the parsing, but the <em>shape</em> is unchanged and worth seeing plainly:`) +
        code({
          title: "ReAct, made literal",
          lang: "text",
          plain: true,
          src: `Goal: Is order 4471 eligible for a refund?

Thought:      I need the order before I can apply any policy.
Action:       search_orders({ id: "4471" })
Observation:  Delivered 2024-02-02. €340. Category: electronics.

Thought:      Delivered 41 days ago. Electronics may differ from the standard window.
Action:       search_policies({ q: "refund window electronics" })
Observation:  Standard 30 days. Electronics 14 days unless faulty.

Thought:      41 > 14, so ineligible — unless it is faulty, which I have not checked.
Action:       get_support_tickets({ order: "4471" })
Observation:  Ticket #882, 2024-02-05: "screen flickers". Status: open.

Thought:      Faulty and reported inside the window. Eligible under the exception.
Answer:       Yes — the 14-day window does not apply because a fault was reported
              on 2024-02-05, three days after delivery (ticket #882).`,
        }) +
        p(`Read the third thought again. The agent noticed a <em>gap in its own evidence</em> — "unless it is faulty, which I have not checked" — and spent a step closing it. No branch in your code produced that. It came from the model having both the policy text and the order in its context at the same moment, and that is the entire value proposition of the loop.`) +
        `<h3>The loop</h3>` +
        code({
          title: "code/c04_agent_loop.ts — the core",
          src: `export async function runAgent(goal: string, cfg: AgentConfig): Promise<AgentResult> {
  const messages: Message[] = [{ role: "user", content: goal }];
  const budget = new Budget(cfg.limits);        // steps, tokens, wall clock
  const seen = new RepeatDetector();            // (tool, args) hashes

  while (true) {
    // GUARD 1 — before spending anything.
    const stop = budget.exceeded();
    if (stop) return degrade(stop, messages, cfg);

    // REASON
    const res = await cfg.model(messages, {
      system: cfg.system,
      tools: cfg.tools.map(toSchema),
      signal: budget.signal,
      temperature: 0,
    });
    budget.record(res.usage);
    messages.push({ role: "assistant", content: res.content });

    // GUARD 2 — a truncated turn is not an answer.
    if (res.stopReason === "max_tokens") {
      messages.push(userText("Your response was cut off. Continue from where you stopped."));
      continue;
    }

    // STOP
    const calls = res.content.filter(isToolUse);
    if (calls.length === 0) {
      return { ok: true, answer: textOf(res.content), messages, usage: budget.usage, steps: budget.steps };
    }

    // GUARD 3 — the same call three times is a stuck agent, not a persistent one.
    const repeat = seen.check(calls);
    if (repeat) {
      messages.push(userText(
        \`You have called \${repeat.name} with identical arguments \${repeat.count} times \` +
        \`and received the same result. That approach is not working. Either try a \` +
        \`different tool or different arguments, or explain what you are missing.\`));
      seen.reset();
      continue;
    }

    // ACT + OBSERVE
    const results = await runAll(calls, cfg.registry, budget.ctx());
    messages.push({ role: "user", content: results.map(toResultBlock) });
  }
}`,
        }) +
        p(`That is the whole agent. Note what is <em>not</em> there: no plan object, no state machine, no memory store, no scratchpad. The <code>messages</code> array is the complete state of the system, and every later chapter is a technique for managing that array.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "The trace is the program",
      html:
        fig({
          label: "Diagram",
          title: "one iteration, and what it leaves behind",
          body: LOOP_SVG,
          caption: `The lower half is the point. There is no hidden state: what the model knows on iteration 4 is exactly the boxes shown, in that order, re-sent in full.`,
        }) +
        `<h3>Four ways a loop ends, and only one is good</h3>` +
        table(
          ["Terminal state", "Cause", "What the user gets"],
          [
            ["<b>answered</b>", "Model emitted no tool calls", "The answer"],
            ["<b>budget</b>", "Steps, tokens or deadline exhausted", "<b>Partial work + what is still unknown.</b> Never an empty failure"],
            ["<b>stuck</b>", "Repeat detector fired repeatedly", "What it tried and why it did not work"],
            ["<b>error</b>", "Unrecoverable — auth, network after retries, cancellation", "The error, plus anything already established"],
          ]
        ) +
        p(`The second row is where most implementations are lazy, and it is the one users actually encounter. An agent that hits its step budget has usually done seven useful things; throwing them away and returning <code>"I was unable to complete this request"</code> destroys real value and teaches the user not to trust it.`) +
        code({
          title: "degrade, do not fail",
          src: `async function degrade(reason: StopCause, messages: Message[], cfg: AgentConfig): Promise<AgentResult> {
  // One final call, tools disabled, asking for an honest partial report.
  const res = await cfg.model([...messages, userText(
    \`You have reached the \${reason} limit and must stop now. Write a final report:\\n\` +
    \`1. What you established, with the evidence.\\n\` +
    \`2. What you were in the middle of.\\n\` +
    \`3. What remains unknown, and the exact next step you would take.\\n\` +
    \`Do not call any tools.\`)], { system: cfg.system, temperature: 0 });

  return { ok: false, reason, answer: textOf(res.content), messages, partial: true };
}`,
        }) +
        note("good", "Cheap, and it changes the product", p(`One extra model call turns "failed" into "here is 70% of your answer and precisely what is missing". It also makes the failure <em>resumable</em>: the report is a handoff note, which is exactly what ${ch("c08", "C08")} needs to restart the task without repeating the first seven steps.`)) +
        `<h3>Loop detection: the three flavours</h3>` +
        ul([
          `<strong>Identical repeat</strong> — same tool, same arguments, same result. Hash <code>(name, canonical(args))</code>; three strikes and you intervene. Cheap and catches most of it.`,
          `<strong>Oscillation</strong> — A, B, A, B, A. Keep the last six call hashes and look for a period-2 or period-3 cycle. Common when two tools give contradictory answers and the model keeps re-checking.`,
          `<strong>Semantic drift</strong> — different arguments, no progress: <code>search("refund policy")</code>, <code>search("return policy")</code>, <code>search("refund rules")</code>. Hardest to detect mechanically. The practical signal is <em>no new information</em>: if the last three observations are near-duplicates of earlier ones, intervene.`,
        ]) +
        p(`In every case the intervention is the same shape: <em>tell the model what it is doing</em>. Models are good at breaking their own loops once the loop is described to them, and terrible at noticing it unaided, because from inside the context each repeat looks like a fresh reasonable idea.`),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Run the loop, then break it",
      html:
        p(`Step through a real task and watch the message array grow. Then turn on the failure injectors and see which guard catches what. The model here is a small scripted one: the control flow is real, the intelligence is canned.`) +
        lab({
          label: "Simulator",
          title: "the ReAct loop, with failure injection",
          body: `
<div class="controls">
  <div class="ctl"><label>task</label>
    <select id="a4-task">
      <option value="0">refund eligibility (happy path)</option>
      <option value="1">tool typo → recovery</option>
      <option value="2">stuck: identical repeats</option>
      <option value="3">oscillation A↔B</option>
      <option value="4">budget exhausted → degrade</option>
    </select></div>
  <div class="ctl"><label>max steps</label>
    <input type="range" id="a4-max" min="2" max="14" step="1" value="10"><span class="val" id="a4-max-v">10</span></div>
  <div class="ctl"><label>guards</label>
    <div style="display:flex;flex-direction:column;gap:.15rem;font-size:.8125rem">
      <label><input type="checkbox" id="a4-g1" checked> budget</label>
      <label><input type="checkbox" id="a4-g3" checked> repeat detector</label>
      <label><input type="checkbox" id="a4-gd" checked> degrade on stop</label>
    </div></div>
  <div class="ctl"><label>&nbsp;</label><div class="btn-row">
    <button class="btn" id="a4-step" type="button">step ▸</button>
    <button class="btn primary" id="a4-run" type="button">▶ run</button>
    <button class="btn" id="a4-reset" type="button">↺ reset</button></div></div>
</div>
<div class="trace" id="a4-trace"></div>
<div style="margin-top:.7rem">
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">messages[] — what is re-sent next iteration</div>
  <div class="ctxstrip" id="a4-ctx"></div>
</div>
<div class="stats">
  <div class="stat"><b id="a4-step-n">0</b><span>steps</span></div>
  <div class="stat"><b id="a4-tok">0</b><span>cumulative input tok</span></div>
  <div class="stat"><b id="a4-state">running</b><span>terminal state</span></div>
</div>`,
          script: `
var TASKS = [
  [ // 0 happy path
    { r: "think", t: "I need the order before I can apply any policy." },
    { r: "act", t: "search_orders({id:\\"4471\\"})", tok: 180 },
    { r: "obs", t: "Delivered 2024-02-02. €340. Category: electronics.", tok: 120 },
    { r: "think", t: "41 days ago. Electronics may have a shorter window." },
    { r: "act", t: "search_policies({q:\\"refund window electronics\\"})", tok: 170 },
    { r: "obs", t: "Standard 30d. Electronics 14d unless faulty.", tok: 140 },
    { r: "think", t: "Ineligible — unless faulty. I have not checked that." },
    { r: "act", t: "get_support_tickets({order:\\"4471\\"})", tok: 160 },
    { r: "obs", t: "#882 2024-02-05 \\"screen flickers\\" — open.", tok: 110 },
    { r: "ans", t: "Eligible: fault reported 2024-02-05, 3 days after delivery (#882)." }
  ],
  [ // 1 typo recovery
    { r: "act", t: "search_ordrs({id:\\"4471\\"})", tok: 170 },
    { r: "err", t: "No tool named \\"search_ordrs\\". Available: search_orders, search_policies, get_support_tickets. Did you mean \\"search_orders\\"?", tok: 90 },
    { r: "think", t: "Typo. Correcting." },
    { r: "act", t: "search_orders({id:\\"4471\\"})", tok: 180 },
    { r: "obs", t: "Delivered 2024-02-02. €340.", tok: 120 },
    { r: "ans", t: "Order 4471 was delivered on 2 February for €340." }
  ],
  [ // 2 identical repeats
    { r: "act", t: "search_policies({q:\\"refund\\"})", tok: 170 },
    { r: "obs", t: "No exact match. 0 results.", tok: 60 },
    { r: "act", t: "search_policies({q:\\"refund\\"})", tok: 170 },
    { r: "obs", t: "No exact match. 0 results.", tok: 60 },
    { r: "act", t: "search_policies({q:\\"refund\\"})", tok: 170 },
    { r: "guard", t: "REPEAT DETECTOR: search_policies called 3× with identical args. Injecting: \\"that approach is not working — try different arguments or explain what you are missing.\\"", tok: 80 },
    { r: "think", t: "The index may use \\"returns\\" rather than \\"refund\\"." },
    { r: "act", t: "search_policies({q:\\"returns window\\"})", tok: 170 },
    { r: "obs", t: "Returns accepted within 30 days of delivery.", tok: 110 },
    { r: "ans", t: "Returns are accepted within 30 days of delivery." }
  ],
  [ // 3 oscillation
    { r: "act", t: "search_orders({id:\\"4471\\"})", tok: 180 },
    { r: "obs", t: "Status: delivered.", tok: 60 },
    { r: "act", t: "get_tracking({id:\\"4471\\"})", tok: 170 },
    { r: "obs", t: "Status: in transit.", tok: 60 },
    { r: "act", t: "search_orders({id:\\"4471\\"})", tok: 180 },
    { r: "obs", t: "Status: delivered.", tok: 60 },
    { r: "act", t: "get_tracking({id:\\"4471\\"})", tok: 170 },
    { r: "guard", t: "OSCILLATION: period-2 cycle over [search_orders, get_tracking]. Injecting: \\"these two sources disagree. Report the disagreement rather than re-checking.\\"", tok: 90 },
    { r: "ans", t: "The two systems disagree: orders says delivered, tracking says in transit. Escalating." }
  ],
  [ // 4 budget
    { r: "act", t: "search_orders({id:\\"4471\\"})", tok: 180 },
    { r: "obs", t: "Delivered 2024-02-02.", tok: 120 },
    { r: "act", t: "search_policies({q:\\"electronics\\"})", tok: 170 },
    { r: "obs", t: "14-day window unless faulty.", tok: 130 },
    { r: "act", t: "get_support_tickets({order:\\"4471\\"})", tok: 160 },
    { r: "obs", t: "3 tickets. Fetching details…", tok: 140 },
    { r: "act", t: "get_ticket({id:882})", tok: 150 },
    { r: "obs", t: "\\"screen flickers\\", open, 2024-02-05.", tok: 120 },
    { r: "act", t: "get_ticket({id:883})", tok: 150 },
    { r: "budget", t: "STEP BUDGET REACHED.", tok: 0 },
    { r: "deg", t: "PARTIAL: Delivered 2024-02-02; electronics window is 14 days unless faulty; ticket #882 reports a fault on 2024-02-05 (inside the window). UNKNOWN: tickets #883, #884. NEXT STEP: read #883 and #884, then decide.", tok: 200 }
  ]
];
var i = 0, tok = 1200, state = "running";
var tr = document.getElementById("a4-trace"), cx = document.getElementById("a4-ctx");
var taskSel = document.getElementById("a4-task"), maxEl = document.getElementById("a4-max");

function reset() { i = 0; tok = 1200; state = "running"; render(); }
function steps() { return TASKS[+taskSel.value]; }
function guardsOn(id) { return document.getElementById(id).checked; }

function step() {
  var S = steps();
  if (i >= S.length || state !== "running") return;
  var ev = S[i];
  // guards can be switched off — the run then continues into the failure
  if (ev.r === "guard" && !guardsOn("a4-g3")) { state = "stuck"; render(); return; }
  if (ev.r === "budget" && !guardsOn("a4-g1")) { i++; render(); return; }
  if (ev.r === "deg" && !guardsOn("a4-gd")) { state = "budget (no partial)"; render(); return; }
  i++;
  tok += (ev.tok || 0) + Math.round(tok * 0.02);
  if (ev.r === "ans") state = "answered";
  if (ev.r === "deg") state = "budget (partial)";
  var actCount = S.slice(0, i).filter(function (e) { return e.r === "act"; }).length;
  if (actCount >= +maxEl.value && state === "running") state = "budget";
  render();
}
function render() {
  maxEl.nextElementSibling.textContent = maxEl.value;
  var S = steps();
  tr.innerHTML = S.slice(0, i).map(function (e, n) {
    var cls = { think: "r-think", act: "r-act", obs: "r-obs", ans: "r-ans", err: "r-err",
                guard: "r-err", budget: "r-err", deg: "r-ans" }[e.r];
    var tag = { think: "think ", act: "act   ", obs: "obs   ", ans: "ANSWER", err: "error ",
                guard: "GUARD ", budget: "BUDGET", deg: "PARTIAL" }[e.r];
    return '<span class="ln ' + cls + (n === i - 1 ? " cur" : "") + '">' + tag + ' │ ' + e.t + '</span>';
  }).join("") || '<span class="ln r-sys">press step ▸ or run</span>';
  tr.scrollTop = tr.scrollHeight;

  var strip = ['<span class="tok sys">system</span>', '<span class="tok usr">goal</span>'];
  S.slice(0, i).forEach(function (e) {
    if (e.r === "act") strip.push('<span class="tok usr">tool_use</span>');
    else if (e.r === "obs") strip.push('<span class="tok tool">result</span>');
    else if (e.r === "err" || e.r === "guard" || e.r === "budget") strip.push('<span class="tok" style="border-color:var(--danger);color:var(--danger)">inject</span>');
    else if (e.r === "think") strip.push('<span class="tok">text</span>');
    else strip.push('<span class="tok new">answer</span>');
  });
  cx.innerHTML = strip.join("");
  document.getElementById("a4-step-n").textContent = S.slice(0, i).filter(function (e) { return e.r === "act"; }).length;
  document.getElementById("a4-tok").textContent = tok.toLocaleString();
  document.getElementById("a4-state").textContent = state;
}
document.getElementById("a4-step").addEventListener("click", step);
document.getElementById("a4-reset").addEventListener("click", reset);
document.getElementById("a4-run").addEventListener("click", function () { reset(); var g = setInterval(function () { if (i >= steps().length || state !== "running") return clearInterval(g); step(); }, 240); });
[taskSel, maxEl].forEach(function (e) { e.addEventListener("input", reset); e.addEventListener("change", reset); });
["a4-g1","a4-g3","a4-gd"].forEach(function (id) { document.getElementById(id).addEventListener("change", reset); });
reset();`,
          caption: `Run scenario 2 with the repeat detector off: the agent loops until the step budget kills it, having learned nothing, at full price. Turn it on and it recovers in one step, because being <em>told</em> it is repeating is information it does not otherwise have. Then run scenario 4 with "degrade on stop" off and compare what the user receives.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "The budget object",
      html:
        p(`The loop is short because the bookkeeping lives somewhere else. <code>Budget</code> is the piece worth getting right: it owns all three limits, the abort signal, and the usage ledger, so the loop asks one question instead of four.`) +
        p(`One caveat on the limits themselves, because this course builds an unattended loop and not every agent is one. An interactive CLI can ship without a step budget: pi's agent loop is 898 lines and has no <code>maxSteps</code>, relying on an abort signal, a host-supplied stop hook, and a person watching the output scroll past. That is still external termination — the human is the budget. It stops being sufficient the moment the same loop runs on a schedule, in CI, or on behalf of a user who has closed the tab, which is why the version here carries all three limits. Build the guards; decide separately which ones your product can relax.`) +
        code({
          title: "code/c04_agent_loop.ts — Budget",
          src: `export class Budget {
  readonly usage: Usage = { input: 0, output: 0 };
  steps = 0;
  private readonly ctrl = new AbortController();
  private readonly deadline: number;

  constructor(private limits: Limits) {
    this.deadline = Date.now() + limits.wallClockMs;
    // One timer for the whole run, cleared in stop().
    this.timer = setTimeout(() => this.ctrl.abort(), limits.wallClockMs);
  }

  get signal(): AbortSignal { return this.ctrl.signal; }

  record(u: Usage): void {
    this.steps++;
    this.usage.input += u.input;
    this.usage.output += u.output;
  }

  /** Returns the cause if any limit is spent, else null. Called before every model call. */
  exceeded(): StopCause | null {
    if (this.steps >= this.limits.maxSteps) return "steps";
    if (this.usage.input + this.usage.output >= this.limits.maxTokens) return "tokens";
    if (Date.now() >= this.deadline) return "time";
    return null;
  }

  /** Reserve headroom so degrade() can still make its final call. */
  releaseForFinalReport(): void {
    this.limits.maxTokens += 4_000;
    this.limits.maxSteps += 1;
  }

  stop(): void { clearTimeout(this.timer); }
}`,
        }) +
        note("warn", "The bug in every first implementation", p(`<code>degrade()</code> needs a model call, but the budget is by definition exhausted when it runs. Without <code>releaseForFinalReport()</code> the final call is refused by your own guard and the user gets nothing. Reserve the headroom explicitly. And clear the timer, or your Node process will not exit.`)) +
        `<h3>Repeat detection in twenty lines</h3>` +
        code({
          title: "hash the intent, not the JSON",
          src: `export class RepeatDetector {
  private counts = new Map<string, number>();
  private recent: string[] = [];

  check(calls: ToolUse[]): { name: string; count: number } | null {
    for (const c of calls) {
      // Canonicalise: key order and whitespace must not hide a repeat.
      const key = \`\${c.name}:\${stableStringify(c.input)}\`;
      const n = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, n);
      this.recent.push(key);
      if (this.recent.length > 8) this.recent.shift();

      if (n >= 3) return { name: c.name, count: n };
      if (this.cycle(2) || this.cycle(3)) return { name: c.name, count: n };
    }
    return null;
  }

  /** A,B,A,B (period 2) or A,B,C,A,B,C (period 3). */
  private cycle(period: number): boolean {
    const r = this.recent;
    if (r.length < period * 2) return false;
    for (let i = 0; i < period; i++) {
      if (r[r.length - 1 - i] !== r[r.length - 1 - i - period]) return false;
    }
    return true;
  }
  reset(): void { this.counts.clear(); this.recent = []; }
}`,
        }) +
        p(`<code>stableStringify</code> matters more than it looks: <code>{a:1,b:2}</code> and <code>{b:2,a:1}</code> are the same call, and models reorder keys freely. Sort keys before hashing or your detector silently never fires.`) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c04_agent_loop.ts

#   C04 · The Agent Loop
#
#   scenario     steps  tools  terminal            answer
#   ────────────────────────────────────────────────────────────────────────────────────────────────────
#   happy            4      3  answered           Eligible: a fault was reported on 2024-02-05, three days aft
#   typo             3      2  answered           Order 4471 was delivered on 2024-01-28 for €340.
#   stuck            5      3  answered           Returns are accepted within 30 days; electronics within 14 u   [1 guard fired]
#   cycle            5      3  answered           The order system and the ticket system disagree; escalating    [1 guard fired]
#   runaway          5      5  budget (partial)   1. ESTABLISHED — order 4471 was delivered on 2024-01-28 (sea
#
#   the guards, quantified
#
#     repeat detector ON   5 steps · 9,300 input tok · answered
#     repeat detector OFF  10 steps · 18,000 input tok · budget   ← same money, no progress
#
#   what the user receives when the budget runs out:
#
#     terminal: budget (partial report generated)
#     1. ESTABLISHED — order 4471 was delivered on 2024-01-28 (search_orders); the electronics return window is 14 days unless a fault is reported (search_policies).
#     2. IN PROGRESS — reading support tickets to check whether a fault was reported.
#     3. UNKNOWN — whether ticket #883 contains a fault report. NEXT STEP: call get_support_tickets for 4471 and read #883 and #884.`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "The same loop, in other people's code",
      html:
        ul([
          `<strong>LangGraph</strong> makes the loop a graph: <code>create_react_agent</code> wires an <code>agent</code> node to a <code>tools</code> node with a conditional edge on whether the last message had tool calls. Same loop, drawn as a state machine, with checkpointing attached to the edges (${ch("c08", "C08")}).`,
          `<strong>AutoGen</strong>'s <code>AssistantAgent</code> runs this inside <code>on_messages</code>, bounded by <code>max_tool_iterations</code>. Its interesting choice is that the loop is one actor's behaviour, so multi-agent work is message-passing between loops rather than a bigger loop (${ch("c18", "C18")}).`,
          `<strong>The OpenAI Agents SDK</strong> calls it <code>Runner.run</code>, with <code>max_turns</code>, guardrails on input and output, and handoffs modelled as tools that swap which agent owns the loop.`,
          `<strong>pi's <code>agent-loop.ts</code></strong> is this chapter at production scale and in the same language, which makes it the most useful single file to read after finishing C04. Look at what it does differently: the branches this course writes inline are hooks the host supplies, and an outer loop drains user messages that arrived mid-run so a person can steer without restarting.`,
          `<strong>Claude Code and Codex</strong> run this loop with a large tool surface and a permission layer between the decision and the execution — the <code>authorize</code> box in ${ch("c03", "C03")}'s diagram, which is ${ch("c16", "C16")}.`,
          `<strong>What none of them decide for you:</strong> what the user gets when the budget runs out. Every framework has a max-iterations setting; almost none has an opinion about the partial work. That is the <code>degrade()</code> function, and it is yours.`,
        ]) +
        note("", "On temperature 0 in the loop", p(`Use 0 for the decision turns and let the final answer be written at a higher temperature if it is user-facing prose. Reruns during debugging then differ only where you want them to, which makes the difference between "I can reproduce this" and three days of ghost-hunting.`)),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `The loop checks <code>budget.exceeded()</code> before the model call. Move it to after the model call. Name two things that break.`,
      answer:
        ul([
          `<strong>You pay for the call you were trying to avoid.</strong> On a run that dies at the step limit, the last call is pure waste, and at a 40k-token context that is the most expensive call of the run.`,
          `<strong>The wall-clock deadline becomes unenforceable.</strong> A model call can take 60 seconds; checking afterwards means a 30-second deadline is honoured 90 seconds late. The check must happen before you commit to an operation of unbounded duration.`,
        ]) +
        p(`There is a third, subtler one: with the check after, the loop's exit condition depends on state mutated by the call you just made, which makes the termination argument harder to state and much harder to test. Guards at the top read as a precondition, which is what they are.`),
    },
    {
      difficulty: "core",
      prompt: `Implement the "semantic drift" detector: different arguments, no new information. Define "no new information" precisely enough to implement without an embedding model.`,
      answer:
        code({
          title: "novelty by observation overlap",
          src: `export class DriftDetector {
  private shingles: Array<Set<string>> = [];

  /** Returns true when the last 3 observations added nothing new. */
  observe(text: string): boolean {
    const s = shingle(normalise(text), 4);      // 4-word shingles
    const novelty = this.shingles.length === 0 ? 1 : 1 - maxJaccard(s, this.shingles);
    this.shingles.push(s);
    if (this.shingles.length > 10) this.shingles.shift();

    this.recentNovelty.push(novelty);
    if (this.recentNovelty.length > 3) this.recentNovelty.shift();
    return this.recentNovelty.length === 3 && this.recentNovelty.every((n) => n < 0.15);
  }
}

const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\\s+/g, " ").trim();
const shingle = (t: string, k: number) => {
  const w = t.split(" "); const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};`,
        }) +
        p(`<strong>Definition:</strong> an observation is <em>novel</em> if its maximum Jaccard similarity against the last ten observations (over 4-word shingles) is below 0.85. Three consecutive non-novel observations means the agent is rephrasing rather than progressing.`) +
        p(`Thresholds need tuning per domain. Code search returns near-identical headers legitimately, so 0.85 is too aggressive there. The intervention is the same as for repeats: describe the behaviour back to the model, and add "if the information does not exist, say so", because the most common cause of drift is an agent unwilling to report absence.`),
    },
    {
      difficulty: "core",
      prompt: `Your agent must support cancellation from a UI mid-run, and cancellation must produce a partial report rather than nothing. Sketch the control flow, including what happens to a tool call already in flight.`,
      answer:
        code({
          title: "two signals: cancel the work, keep the report",
          src: `export class Budget {
  private readonly work = new AbortController();   // cancels model + tools
  private cancelled = false;

  cancel(): void { this.cancelled = true; this.work.abort(); }
  get signal(): AbortSignal { return this.work.signal; }
  exceeded(): StopCause | null { return this.cancelled ? "cancelled" : /* … */ null; }
}

// In the loop:
try {
  const res = await cfg.model(messages, { signal: budget.signal, /* … */ });
} catch (e) {
  if (budget.signal.aborted) {
    // Report on a FRESH signal — the work signal is spent.
    return degrade("cancelled", messages, { ...cfg, model: cfg.freshModel });
  }
  throw e;
}`,
        }) +
        ul([
          `<strong>The report must not use the aborted signal.</strong> Obvious in hindsight, and it is the bug everyone ships: <code>degrade()</code> inherits the cancelled controller and aborts instantly, so the user gets nothing after waiting.`,
          `<strong>An in-flight tool call is the hard case.</strong> Read-only tools: abort and discard. Write tools: you cannot un-send an email. Await the write to completion even while cancelling, record its result, and include it in the report. "I cancelled, but the email to Alice had already gone" is the only honest output.`,
          `<strong>Cancellation is a terminal state, not an error.</strong> Log it separately in ${ch("c20", "C20")}; a spike in cancellations means your agent is too slow or visibly going wrong, which is a different problem from a spike in errors.`,
        ]),
    },
    {
      difficulty: "stretch",
      prompt: `Add streaming to this loop such that a user sees progress within 500ms of each step, without changing the loop's structure or its types. Say what you stream at each phase and what you deliberately do not.`,
      answer:
        code({
          title: "an event channel beside the loop, not inside it",
          src: `export type AgentEvent =
  | { type: "thinking"; textDelta: string }
  | { type: "tool_start"; name: string; summary: string }   // "Searching orders for 4471"
  | { type: "tool_end"; name: string; ms: number; ok: boolean }
  | { type: "answer"; textDelta: string }
  | { type: "done"; result: AgentResult };

export async function* runAgentStream(goal: string, cfg: AgentConfig): AsyncGenerator<AgentEvent> {
  const q = new EventQueue<AgentEvent>();
  const done = runAgent(goal, { ...cfg, emit: q.push })     // loop unchanged, one new callback
    .then((r) => q.push({ type: "done", result: r }))
    .finally(() => q.close());
  yield* q;
  await done;
}`,
        }) +
        p(`<strong>Stream:</strong> the final answer's text deltas (this is where perceived latency lives), and a one-line <em>human summary</em> of each tool call as it starts — "Reading src/agent.ts", "Searching policies for refund window". Users track an agent's progress through its actions.`) +
        p(`<strong>Do not stream:</strong> raw tool arguments (noisy, and a leak risk: file paths, query strings, internal IDs), raw tool results (a 4,000-token blob is not progress), or intermediate reasoning by default. Intermediate reasoning is worth exposing behind a "show details" toggle: it is the single best debugging affordance you can give a user, and the single worst default, because it makes a confident agent look like it is flailing.`) +
        p(`The structural point is the <code>emit</code> callback: the loop gains one optional parameter and no branches. Streaming stays a delivery concern, exactly as in ${ch("c01", "C01")}.`),
    },
  ],

  qa: [
    { q: "Do I still need 'Thought:' prompting now that tool calling is native?", a: p(`Not as a parsing format. But asking the model to state its reasoning before acting still helps on hard multi-step tasks, and with native tool use you get it by permitting a text block alongside the tool_use block, or by adding a <code>reasoning</code> field to tool inputs. Extended-thinking modes make this explicit and are usually the better lever now.`) },
    { q: "What is a sensible default for max steps?", a: p(`Start at 10 and instrument. The useful number comes out of your own data: the 95th percentile of steps taken by runs that <em>succeeded</em>, plus a margin. If successful runs take 4 steps at p95, a limit of 20 only means failures cost 5× more before you notice them. Setting the limit from success data is one of the highest-return things in ${ch("c20", "C20")}.`) },
    { q: "Should the agent see its own step count?", a: p(`Yes, late. Injecting "you have 2 of 10 steps left" from the start makes models rush and skip verification. Injecting it only when fewer than about 30% remain produces genuinely better behaviour, because the model starts consolidating and prioritising. Treat it as a deadline warning, not a budget display.`) },
    { q: "Why temperature 0 if it is not actually deterministic?", a: p(`For agreement, not reproducibility. At temperature 0 the same context usually produces the same tool choice, so when you rerun a failing case you are debugging your code rather than a different sample. You will still see occasional divergence from batching and routing effects (${ch("c01", "C01")}) — which is precisely why ${ch("c19", "C19")}'s evals score behaviour over many runs rather than diffing one.`) },
    { q: "My agent stops too early and says it is done when it is not. Is that a loop bug?", a: p(`No — it is a verification problem, and it is the mirror image of not stopping. The loop terminates correctly on the model's signal; the signal is wrong. Fixes belong in ${ch("c10", "C10")}: an explicit completion checklist in the system prompt, a verification tool the model must call before answering, or a critic pass over the answer. Do not try to fix it by raising the step budget.`) },
  ],

  project: {
    title: "Project · Your agent",
    brief:
      p(`Assemble C01–C04 into a working agent over a small domain you can verify by hand — a fake order system, your own filesystem in read-only mode, or a wiki dump. This is the artefact the rest of the course modifies, so give it a clean seam where <code>messages</code> is constructed: C05 will replace it.`),
    spec: [
      "<code>runAgent(goal, config)</code> returning a typed result with the terminal state, the full message array, usage and step count.",
      "All four guards: budget (steps, tokens, wall clock), truncation handling, repeat/oscillation detection, and unknown-tool recovery.",
      "<code>degrade()</code> produces a partial report naming what was established, what was in flight, and the exact next step.",
      "A trace log: one line per step with role, tool, arguments, latency and cumulative tokens. Human-readable, greppable.",
      "Five test scenarios — happy path, tool typo, identical repeat, oscillation, budget exhaustion — each asserting the expected terminal state.",
      "Runs entirely offline against the mock model from C01.",
    ],
    stretch: [
      "Add the <code>AgentEvent</code> stream and a small terminal UI that renders tool activity as it happens.",
      "Add cancellation with a partial report, including correct handling of an in-flight write tool.",
      "Make the step limit adaptive: start at 6, extend by 4 (up to a hard cap) whenever the last two steps produced novel observations. Compare cost and success against a fixed limit of 14 across your five scenarios.",
    ],
  },

  quiz: [
    {
      q: "In the loop as written, what is the complete state of the agent?",
      options: [
        "The `messages` array — there is no hidden scratchpad, plan object or variable store",
        "The messages array plus the model's internal memory of the session",
        "The tool registry and the current step count",
        "A state machine maintained by the framework",
      ],
      answer: 0,
      why: "The model is stateless (C01), so anything it knows is in the request you just sent. That is why every later chapter — retrieval, memory, compaction, subagents — is an operation on this one array, and why 'the trace is the program' is literally true.",
    },
    {
      q: "Why must budget checks run at the top of the loop rather than after the model call?",
      options: [
        "So the run stops before paying for the call, and so a wall-clock deadline can actually be honoured",
        "Because the model call mutates the message array",
        "Because AbortSignal can only be checked before an await",
        "So the step counter starts at zero",
      ],
      answer: 0,
      why: "Checking afterwards pays for the call you were trying to avoid — the most expensive one, since context is largest at the end. And since a model call can run for a minute, a deadline checked after it is honoured late by exactly that minute.",
    },
    {
      q: "An agent has hit its step budget after doing seven useful things. What should it return?",
      options: [
        "A partial report: what was established with evidence, what was in flight, and the exact next step",
        "An error saying the request could not be completed",
        "The raw message array for the user to read",
        "Nothing — it should silently retry with a larger budget",
      ],
      answer: 0,
      why: "One extra model call with tools disabled converts a failure into most of an answer, and the report doubles as a resumable handoff note for C08. Discarding seven steps of real work is the most common and most avoidable product failure in agent systems.",
    },
    {
      q: "The repeat detector hashes `(toolName, arguments)`. What must happen to the arguments first?",
      options: [
        "Canonicalisation — sort object keys and normalise whitespace, or reordered keys hide the repeat",
        "Truncation to 100 characters to keep the hash small",
        "Removal of all string values, since only the shape matters",
        "Conversion to lowercase",
      ],
      answer: 0,
      why: "Models reorder JSON keys freely between turns. `{a:1,b:2}` and `{b:2,a:1}` are the same call, and without a stable stringify your detector silently never fires — which looks exactly like not having one.",
    },
    {
      q: "When the repeat detector fires, what is the most effective intervention?",
      options: [
        "Inject a message describing the repetition and asking for a different approach or an explanation of what is missing",
        "Terminate the run immediately as stuck",
        "Silently drop the duplicate call and continue",
        "Raise the temperature and retry the same call",
      ],
      answer: 0,
      why: "From inside the context each repeat looks like a fresh reasonable idea, so the model cannot see the loop — but it is good at breaking one once described. Terminating throws away a recoverable run; dropping the call silently leaves the model waiting for a result that never comes.",
    },
    {
      q: "What is a principled way to set `maxSteps`?",
      options: [
        "The p95 step count of runs that succeeded, plus a margin",
        "A round number like 25, to be safe",
        "The context window divided by average tokens per step",
        "The number of registered tools",
      ],
      answer: 0,
      why: "Derived from success data, the limit bounds failure cost without truncating legitimate work. If successful runs finish in 4 steps at p95, a limit of 25 just means every failure costs six times more before anyone notices — the limit is a cost control, not a capability setting.",
    },
  ],

  continues:
    p(`Run your agent on a task that takes fifteen steps and it will fail — not because it stopped reasoning, but because <code>messages</code> grew past what the model can be sent, or because the goal scrolled so far up the context that it stopped mattering. The array is the state, the array has a hard limit, and managing it is a discipline with its own techniques. ${ch("c05", "C05")} is that discipline.`),
};

export default chapter;
