import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const DIAL_SVG = `
<svg viewBox="0 0 700 240" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The agency dial from fixed pipeline to autonomous agent">
  <defs>
    <marker id="d0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  </defs>
  <text x="14" y="20" class="d-label">WHO DECIDES WHAT HAPPENS NEXT</text>

  <line x1="24" y1="48" x2="676" y2="48" stroke="var(--border-strong)" stroke-width="2" marker-end="url(#d0)"/>
  <text x="24" y="40" class="d-mono" fill="var(--fg-faint)">you</text>
  <text x="676" y="40" class="d-mono" text-anchor="end" fill="var(--accent)">the model</text>

  <g>
    <circle cx="70"  cy="48" r="5" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="220" cy="48" r="5" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="370" cy="48" r="5" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="520" cy="48" r="5" fill="var(--accent)" stroke="var(--accent)" stroke-width="2"/>
    <circle cx="650" cy="48" r="5" fill="var(--accent)" stroke="var(--accent)" stroke-width="2"/>
  </g>

  <rect x="24"  y="70" width="110" height="94" rx="6" class="d-box"/>
  <text x="79" y="90"  class="d-text" text-anchor="middle">0 · pipeline</text>
  <text x="79" y="110" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">fixed steps</text>
  <text x="79" y="126" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">1 LLM call</text>
  <text x="79" y="146" class="d-mono" text-anchor="middle" fill="var(--ok)">deterministic</text>

  <rect x="166" y="70" width="110" height="94" rx="6" class="d-box"/>
  <text x="221" y="90"  class="d-text" text-anchor="middle">1 · router</text>
  <text x="221" y="110" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model picks</text>
  <text x="221" y="126" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">1 of N paths</text>
  <text x="221" y="146" class="d-mono" text-anchor="middle" fill="var(--ok)">bounded</text>

  <rect x="316" y="70" width="110" height="94" rx="6" class="d-box-p"/>
  <text x="371" y="90"  class="d-text" text-anchor="middle">2 · chain</text>
  <text x="371" y="110" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model fills</text>
  <text x="371" y="126" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">your DAG</text>
  <text x="371" y="146" class="d-mono" text-anchor="middle" fill="var(--warn)">bounded</text>

  <rect x="466" y="70" width="110" height="94" rx="6" class="d-box-a"/>
  <text x="521" y="90"  class="d-text" text-anchor="middle">3 · agent</text>
  <text x="521" y="110" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model picks</text>
  <text x="521" y="126" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">tools + order</text>
  <text x="521" y="146" class="d-mono" text-anchor="middle" fill="var(--danger)">unbounded*</text>

  <rect x="596" y="70" width="80" height="94" rx="6" class="d-box-a"/>
  <text x="636" y="90"  class="d-text" text-anchor="middle">4 · open</text>
  <text x="636" y="110" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">writes its</text>
  <text x="636" y="126" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">own tools</text>
  <text x="636" y="146" class="d-mono" text-anchor="middle" fill="var(--danger)">research</text>

  <line x1="24" y1="184" x2="676" y2="184" stroke="var(--border)"/>
  <text x="14" y="206" class="d-label">WHAT YOU GAIN GOING RIGHT — AND WHAT YOU PAY</text>
  <text x="24" y="226" class="d-mono" fill="var(--ok)">+ handles inputs you never enumerated</text>
  <text x="400" y="226" class="d-mono" fill="var(--danger)">− you can no longer predict the run</text>
</svg>`;

const chapter: Chapter = {
  id: "c00",
  num: 0,
  layer: "machine",
  title: "What an Agent Actually Is",
  subtitle: "The loop, the dial, and the three things that are not agents",
  blurb:
    "An agent is a program that lets a model decide what happens next, in a loop, with tools that change the world. Everything expensive about agents follows from that one sentence.",
  lines: 170,
  file: "code/c00_agency_dial.ts",
  tags: ["agent loop", "agency", "workflow vs agent", "tool use", "blast radius", "nondeterminism"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "Three programs that look identical from outside",
      html:
        p(`A user types <em>"what's the status of order 4471?"</em> and gets back <em>"It shipped Tuesday and is out for delivery today."</em> Three completely different programs can produce that exchange, and nothing in the transcript tells you which one you are talking to. The bill tells you. So does the p99 latency, and so does the day the database goes down.`) +
        ol([
          `<strong>A pipeline.</strong> Regex out the order number, query the database, format a sentence with a template. No model involved, or one model call at the end to make the sentence read nicely. Runs in 40&nbsp;ms, and when it breaks it breaks visibly and in the same way every time.`,
          `<strong>A chain.</strong> One model call classifies the intent, your code branches on the classification, a second model call writes the reply from the row you fetched. Two calls, a fixed shape, roughly 900&nbsp;ms. You can draw the whole thing as a flowchart before it runs.`,
          `<strong>An agent.</strong> You hand the model a goal and four tools — <code>lookup_order</code>, <code>get_tracking</code>, <code>search_policy</code>, <code>email_customer</code> — and let it decide which to call, in what order, how many times, and when it is finished. Usually two calls. Sometimes nine. Once, memorably, forty-one.`,
        ]) +
        p(`All three answer the question. Only the third one will also handle <em>"my order says delivered but the box is empty and I need this before Friday"</em> — a request nobody enumerated, requiring three lookups and a policy judgement, that the pipeline cannot represent and the chain has no branch for.`) +
        note(
          "key",
          "The trade you are making",
          p(`Agency buys you coverage of inputs you never anticipated, and it costs you the ability to predict any individual run. Everything left in this course is a technique for buying some of that predictability back without giving up the coverage.`)
        ),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "An agent is a loop with a decision in it",
      html:
        p(`Strip everything else away and here is the definition this course builds on. Four lines, and the fourth is the one that matters.`) +
        code({
          title: "the whole idea",
          src: `async function run(goal: string, tools: Tool[]): Promise<string> {
  const messages: Message[] = [{ role: "user", content: goal }];

  while (true) {
    const reply = await model(messages, tools);   // the model decides
    messages.push(reply);

    if (reply.stop) return reply.text;            // it decided to stop

    for (const call of reply.toolCalls) {         // it decided to act
      const result = await runTool(tools, call);  // the world answers back
      messages.push({ role: "tool", id: call.id, content: result });
    }
  }
}`,
        }) +
        p(`Read the loop as a sentence: <em>the model looks at everything that has happened, chooses one of two moves — answer, or use a tool — and if it uses a tool, the result of that tool becomes part of what it looks at next time.</em> That is the whole mechanism. An agent is a <strong>while-loop whose branch condition is a model output</strong>.`) +
        p(`Three properties fall out of those four lines. Between them they cause nearly every difficulty in the rest of the course.`) +
        `<h3>The control flow is data</h3>` +
        p(`In ordinary software you write the control flow, and it is fixed by the time the program compiles. Here a stochastic function produces it at runtime. You cannot read the program and know its execution path, because the path is an output rather than a source file. Testing, debugging, cost estimation and security all have to be redesigned around that one fact.`) +
        `<h3>The loop has no natural end</h3>` +
        p(`Nothing in the code above guarantees <code>reply.stop</code> ever becomes true. A model that keeps deciding "I should check one more thing" produces an infinite loop that costs real money per iteration. Every production agent enforces termination from the outside, with a turn budget or a token budget or a wall-clock deadline, because the inside cannot be trusted to supply one. ${ch("c12", "C12")} is that problem in full.`) +
        `<h3>Everything re-enters the context</h3>` +
        p(`If you retain and resend the full history, each tool result is appended to <code>messages</code> and sent again on the next iteration. A ten-step task can send the first step's output ten times. That makes transmitted input grow roughly quadratically with turns; compaction and prompt caching can change the bill, but neither removes the finite context window. ${ch("c05", "C05")} is about managing both constraints.`) +
        note(
          "",
          "A useful negative definition",
          p(`If you can draw the execution as a flowchart <em>before</em> the run, it is a workflow. If the flowchart can only be drawn <em>afterwards</em>, from the trace, it is an agent. This is the test used in Anthropic's "Building Effective Agents" and it is the one worth keeping.`)
        ),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "The agency dial",
      html:
        p(`"Agent" is not a binary, it is a dial. The question for any system you build is never <em>is this an agent</em>. It is <em>how far right should this dial be turned</em>, and every click to the right adds capability and subtracts predictability.`) +
        fig({
          label: "Diagram",
          title: "five positions on one dial",
          body: DIAL_SVG,
          caption:
            `Position 3 is what most people mean by "agent" and what this course builds. Note the asterisk: unbounded is a property of the loop, not of your system — you bound it from outside, and ${ch("c12", "C12")} shows how.`,
        }) +
        `<h3>What each click actually changes</h3>` +
        table(
          ["", "Who picks the step", "Steps known ahead", "Model calls", "Failure mode"],
          [
            ["<b>0 · Pipeline</b>", "You", "All", "0–1", "Crashes at a line you can point to"],
            ["<b>1 · Router</b>", "Model picks 1 of N", "All N", "1–2", "Wrong branch, right execution"],
            ["<b>2 · Chain</b>", "You, model fills slots", "The DAG", "2–6", "Compounding error down a fixed path"],
            ["<b>3 · Agent</b>", "Model, every step", "None", "2–40", "Loops, wanders, or confidently does the wrong job"],
            ["<b>4 · Open-ended</b>", "Model, incl. new tools", "None", "unbounded", "Everything above, plus novel"],
          ]
        ) +
        p(`The economically important row is the middle one. A surprising number of systems shipped as "agents" are position 1 or 2 wearing a costume, and they are <em>better</em> for it. Cheaper, faster, testable, and explainable to whoever has to sign off on them. The skill this course is really teaching is knowing which position a problem needs, then implementing that position well.`) +
        note(
          "warn",
          "The default is not position 3",
          p(`Reach for agency when the space of valid step-sequences is too large to enumerate, when the next step genuinely depends on what the last step returned, and when you can tolerate variance in the path. If any one of those is false, a workflow will beat your agent on every metric a user can feel. ${ch("c11", "C11")} makes this a design procedure rather than a taste.`)
        ),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Turn the dial and watch the bill",
      html:
        p(`The simulator below runs the same customer-support request through all five positions. The task difficulty slider controls how far the request sits outside what the pipeline's authors anticipated. Watch two things: the success bar as you move difficulty right, and the cost column as you move the dial right.`) +
        lab({
          label: "Simulator",
          title: "the agency dial",
          body: `
<div class="controls">
  <div class="ctl"><label>position</label>
    <input type="range" id="d0-pos" min="0" max="4" step="1" value="3">
    <span class="val" id="d0-pos-v">3 · agent</span></div>
  <div class="ctl"><label>request difficulty</label>
    <input type="range" id="d0-diff" min="0" max="100" step="1" value="35">
    <span class="val" id="d0-diff-v">35 · routine</span></div>
  <div class="ctl"><label>runs</label>
    <input type="range" id="d0-n" min="20" max="500" step="20" value="200">
    <span class="val" id="d0-n-v">200</span></div>
  <div class="ctl"><label>&nbsp;</label>
    <div class="btn-row"><button class="btn primary" id="d0-run" type="button">▶ run batch</button></div></div>
</div>
<div id="d0-desc" class="note" style="margin-top:0"></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:1rem">
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">task solved</div>
    <div class="meter"><i id="d0-succ" style="width:0%"></i></div>
    <div class="mono small muted" id="d0-succ-v">—</div>
  </div>
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">run-to-run identical</div>
    <div class="meter"><i id="d0-det" style="width:0%;background:var(--tool)"></i></div>
    <div class="mono small muted" id="d0-det-v">—</div>
  </div>
</div>
<div style="margin-top:1rem">
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">model calls per run · distribution over the batch</div>
  <div class="bars" id="d0-bars"></div>
  <div class="mono small muted" style="margin-top:.3rem">each bar is one bucket of 1–20+ calls; tall bar on the left = predictable, long tail on the right = the 41-call afternoon</div>
</div>
<div class="stats">
  <div class="stat"><b id="d0-calls">—</b><span>median calls</span></div>
  <div class="stat"><b id="d0-p99">—</b><span>p99 calls</span></div>
  <div class="stat"><b id="d0-tok">—</b><span>median tokens</span></div>
  <div class="stat"><b id="d0-lat">—</b><span>median latency</span></div>
  <div class="stat"><b id="d0-blast">—</b><span>blast radius</span></div>
</div>`,
          script: `
var POS = [
  { n: "0 · pipeline", ceiling: 30,  base: 0,  spread: 0,   tok: 0,    lat: 40,   blast: "none",
    d: "<b>Fixed pipeline.</b> Regex, SQL, template. It answers the requests its author enumerated and returns a canned apology for the rest. Identical every run, free, instant." },
  { n: "1 · router",   ceiling: 48,  base: 1,  spread: 0,   tok: 700,  lat: 520,  blast: "read-only",
    d: "<b>Router.</b> One model call chooses a branch; your code does the rest. Variance lives in one classification, so a wrong answer is a wrong <em>branch</em> — easy to log, easy to eval." },
  { n: "2 · chain",    ceiling: 66,  base: 3,  spread: 1,   tok: 2600, lat: 1800, blast: "read-only",
    d: "<b>Prompt chain.</b> You own the DAG; the model fills each node. Handles more shapes, but every node's error feeds the next, and the DAG still cannot represent a request that needs a step you did not draw." },
  { n: "3 · agent",    ceiling: 91,  base: 4,  spread: 6,   tok: 9000, lat: 7200, blast: "whatever the tools can do",
    d: "<b>Tool-using agent.</b> The model owns the order and the stopping. It covers requests nobody enumerated — and the same request can cost 2 calls or 40. This is the loop the course builds, and the variance is the thing you spend C05–C12 taming." },
  { n: "4 · open",     ceiling: 95,  base: 6,  spread: 14,  tok: 24000, lat: 21000, blast: "writes its own tools",
    d: "<b>Open-ended.</b> The agent writes and runs new tools mid-task. Highest ceiling, and the only position where you genuinely cannot enumerate what a run is permitted to do. Treat as research unless the sandbox is airtight (C13, C21)." }
];
var pos = document.getElementById("d0-pos"), diff = document.getElementById("d0-diff"), nEl = document.getElementById("d0-n");
var posV = document.getElementById("d0-pos-v"), diffV = document.getElementById("d0-diff-v"), nV = document.getElementById("d0-n-v");
var desc = document.getElementById("d0-desc"), bars = document.getElementById("d0-bars");
function diffLabel(d) { return d < 25 ? "trivial" : d < 50 ? "routine" : d < 75 ? "novel" : "nobody planned for this"; }

function run() {
  var P = POS[+pos.value], d = +diff.value, N = +nEl.value;
  posV.textContent = P.n; diffV.textContent = d + " · " + diffLabel(d); nV.textContent = N;
  desc.innerHTML = P.d;

  var rnd = mulberry32(7);
  var calls = [], solved = 0, toks = [], lats = [];
  for (var i = 0; i < N; i++) {
    // harder requests need more steps; only agency can add steps at runtime
    var need = 1 + Math.round(d / 14);
    var budget = P.base + Math.round(P.spread * (d / 100) * 2);
    var jitter = P.spread ? Math.round((rnd() * rnd()) * P.spread * 3) : 0;
    var c = Math.max(P.base, budget + jitter);
    calls.push(c);
    var pSolve = Math.max(0, Math.min(1, (P.ceiling - d * (P.spread ? 0.45 : 0.9)) / 100));
    if (rnd() < pSolve) solved++;
    toks.push(P.tok * (1 + (c - P.base) * 0.55));
    lats.push(P.lat * (1 + (c - P.base) * 0.75));
  }
  var med = function (a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.floor(b.length / 2)]; };
  var pct = function (a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(b.length * q))]; };

  var sr = Math.round((solved / N) * 100);
  document.getElementById("d0-succ").style.width = sr + "%";
  document.getElementById("d0-succ-v").textContent = sr + "% of " + N + " runs produced a correct answer";
  var uniq = {}; calls.forEach(function (c) { uniq[c] = 1; });
  var detr = Math.round((1 / Object.keys(uniq).length) * 100);
  document.getElementById("d0-det").style.width = detr + "%";
  document.getElementById("d0-det-v").textContent = Object.keys(uniq).length + " distinct step-counts observed";

  var buckets = new Array(20).fill(0);
  calls.forEach(function (c) { buckets[Math.min(19, c - 1)]++; });
  var mx = Math.max.apply(null, buckets) || 1;
  bars.innerHTML = buckets.map(function (b, i) {
    return '<div class="bar' + (i > 9 ? " alt" : "") + '" style="height:' + Math.max(2, (b / mx) * 100) + '%" title="' + (i + 1) + (i === 19 ? "+" : "") + ' calls: ' + b + ' runs"></div>';
  }).join("");

  document.getElementById("d0-calls").textContent = med(calls);
  document.getElementById("d0-p99").textContent = pct(calls, 0.99);
  document.getElementById("d0-tok").textContent = Math.round(med(toks)).toLocaleString();
  document.getElementById("d0-lat").textContent = (med(lats) / 1000).toFixed(1) + "s";
  document.getElementById("d0-blast").textContent = P.blast;
}
[pos, diff, nEl].forEach(function (el) { el.addEventListener("input", run); });
document.getElementById("d0-run").addEventListener("click", run);
run();`,
          caption:
            `Two things to notice. Drag <em>difficulty</em> past 60 at position 0 or 1 and the success bar collapses — a pipeline cannot invent a step it was not given. Then sit at position 3 and watch the p99 call count: the median is fine, the tail is what wakes you up. Most of this course is about that tail.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "The smallest honest agent",
      html:
        p(`The runnable file for this chapter implements all five positions against one deterministic mock "model", so you can run the comparison locally with no API key and no spend. The agent position is the four-line loop from above with the two guards that every real system needs bolted on.`) +
        code({
          title: "code/c00_agency_dial.ts (excerpt)",
          src: `type Decision =
  | { kind: "answer"; text: string }
  | { kind: "call"; tool: string; args: Record<string, unknown> };

export async function agent(goal: string, env: Env, limits: Limits): Promise<Result> {
  const messages: Msg[] = [{ role: "user", content: goal }];
  let calls = 0;
  const deadline = Date.now() + limits.wallClockMs;

  while (true) {
    // Guard 1: the loop cannot supply its own termination, so we do.
    if (calls >= limits.maxSteps) return { ok: false, why: "step budget exhausted", messages };
    if (Date.now() > deadline) return { ok: false, why: "deadline exceeded", messages };

    const d: Decision = await env.model(messages);
    calls++;

    if (d.kind === "answer") return { ok: true, text: d.text, messages, calls };

    // Guard 2: the model names a tool; it does not get to invent one.
    const tool = env.tools[d.tool];
    const observation = tool
      ? await tool(d.args).catch((e) => \`ERROR: \${(e as Error).message}\`)
      : \`ERROR: no tool named \${d.tool}. Available: \${Object.keys(env.tools).join(", ")}\`;

    messages.push({ role: "assistant", content: JSON.stringify(d) });
    messages.push({ role: "tool", content: String(observation) });
  }
}`,
        }) +
        p(`Two lines there are worth more than the rest of the file.`) +
        ul([
          `<strong>The budget checks come first, inside the loop.</strong> Not after the model call, not in a wrapper. First, every iteration. An agent that has exhausted its budget should stop before it spends the money, and the top of the loop is the only place where that is true.`,
          `<strong>An unknown tool name is an observation, not an exception.</strong> The model hallucinated <code>lookup_ordre</code>. Throwing kills the run. Feeding the typo back as a tool result lets the model correct itself on the next iteration. This one decision changes end-to-end success rates by more than most prompt engineering does. ${ch("c03", "C03")} generalises it.`,
        ]) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c00_agency_dial.ts

#   C00 · The agency dial — same task, five positions
#
#   live loop:  answered in 4 calls
#               recovered from an unknown-tool typo in one step — the observation carried the fix
#               "Delivered 2024-01-28; the 14-day electronics window has passed."
#
#   difficulty 25 · routine request
#   position        solved  med calls   p99  med tokens  med latency  blast radius
#   0 · pipeline       14%          0     0           0         0.0s  none
#   1 · router         31%          1     1         700         0.5s  read-only
#   2 · chain          53%          3     5       2,600         1.8s  read-only
#   3 · agent          82%          4    21       9,000         7.2s  whatever the tools can do
#   4 · open-ended     85%          8    47      36,000        31.5s  writes its own tools
#
#   difficulty 65 · request nobody planned for
#   position        solved  med calls   p99  med tokens  med latency  blast radius
#   0 · pipeline        0%          0     0           0         0.0s  none
#   1 · router         11%          1     1         700         0.5s  read-only
#   2 · chain          41%          3     5       2,600         1.8s  read-only
#   3 · agent          67%          5    22      11,250         9.0s  whatever the tools can do
#   4 · open-ended     73%          9    48      42,000        36.8s  writes its own tools
#
#   Two things to read off these tables:
#     · positions 0–1 collapse as difficulty rises — a pipeline cannot invent a step
#     · at position 3 the median is fine and the p99 is 4× it. capacity, timeouts and
#       cost are all sized by that tail, and most of this course is about taming it.`,
        }) +
        note(
          "good",
          "No key needed, ever",
          p(`Every runnable file in this course ships with a deterministic mock model and works offline. C01 also includes an opt-in <code>--live</code> client that reads <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code>; the rest of the course deliberately stays deterministic. See <a href="/setup/">local setup</a>.`)
        ),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Where this line gets drawn in real systems",
      html:
        p(`Every serious framework encodes a position on the dial, and reading them as positions rather than as competing brands makes the landscape much smaller than it looks.`) +
        ul([
          `<strong>LangGraph</strong> is position 2 by construction: you declare a <code>StateGraph</code> of nodes and edges, and the model fills nodes. Agency arrives through conditional edges that route on model output, so you can build position 3 — but the graph is still yours, and that is the point of it.`,
          `<strong>AutoGen</strong> (<code>autogen-core</code>) is lower-level still: agents are actors that exchange messages through a runtime. Agency is whatever the agents' handlers do. ${ch("c18", "C18")} rebuilds that runtime.`,
          `<strong>The OpenAI Agents SDK and the Claude Agent SDK</strong> are position 3 as a product: a loop, a tool registry, and a stopping rule, with handoffs and guardrails layered on.`,
          `<strong>Claude Code, Codex and Cursor's agent mode</strong> are position 3 with an unusually large tool surface (your filesystem and your shell) and a correspondingly serious permission layer — which is exactly ${ch("c16", "C16")}.`,
        ]) +
        note(
          "",
          "The sentence to remember from the industry write-ups",
          p(`Anthropic's "Building Effective Agents" is blunt about it: the most successful deployments use the simplest pattern that works, and agents are for the cases where the extra latency and cost buy a real increase in task performance. Nothing in the following twenty-four chapters contradicts that. They are about making position 3 work <em>when you have established that you need it</em>.`)
        ),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `Classify each of these as position 0–4, and say what the tell is: (a) a spam filter, (b) "summarise this PDF", (c) a support bot that looks up an order then answers, (d) Claude Code fixing a failing test, (e) a system that reads an incident, writes a Python script to query metrics, runs it, and iterates.`,
      answer:
        ul([
          `<b>(a) Position 0.</b> A classifier, even a neural one, has no loop and no tools. One input, one output, fixed shape.`,
          `<b>(b) Position 0 or 1.</b> One model call. If you branch on document type before calling, it is 1.`,
          `<b>(c) Position 2 if your code does the lookup then calls the model; position 3 if the model decides <em>whether</em> to look up.</b> The tell is who owns the <code>if</code>. This is the most commonly mis-classified case.`,
          `<b>(d) Position 3.</b> Model chooses read/edit/run/re-read, in an order that depends on what the test printed. The trace is only drawable afterwards.`,
          `<b>(e) Position 4.</b> It authors a new capability at runtime. Note that "writes a script and runs it" is exactly the move that makes sandboxing non-optional (${ch("c13", "C13")}).`,
        ]),
    },
    {
      difficulty: "core",
      prompt: `Take the four-line loop in this chapter and list every way it can fail to terminate. For each, name the guard that stops it and say where the guard belongs — inside the loop, around the loop, or in the prompt.`,
      answer:
        table(
          ["Failure", "Guard", "Where"],
          [
            ["Model never emits <code>stop</code>", "max step count", "Inside, at the top"],
            ["Model alternates between two tools forever", "loop / repeat detection on (tool, args) hashes", "Inside, after the decision"],
            ["A tool hangs", "per-tool timeout via <code>AbortSignal</code>", "Around the tool call"],
            ["Each step succeeds but the task is unbounded (\"monitor forever\")", "wall-clock deadline", "Inside, at the top"],
            ["Context grows until the request is rejected", "token budget + compaction", "Inside, before the model call (C05)"],
            ["Model decides it is done but has not done the job", "verification step; not a termination bug but looks like one", "After the loop (C10)"],
          ]
        ) +
        p(`The general principle: <em>termination is an external property</em>. Prompts that say "stop when finished" help at the margin, but they are never a guard, because the failure you are guarding against is a model that sincerely believes it is not finished.`),
    },
    {
      difficulty: "core",
      prompt: `In the simulator, set position 3 and difficulty 20. The p99 call count is roughly four times the median. Explain why that ratio — not the median — is what determines your infrastructure bill and your timeout settings, and what you would measure in production to see it.`,
      answer:
        p(`Capacity is sized for the tail, not the middle. If the median run is 4 calls and p99 is 17, then at any moment a meaningful fraction of in-flight runs are long ones; they hold connections, occupy concurrency slots, and consume context-window budget simultaneously. A timeout set from the median kills a tenth of your legitimate traffic. One set from the tail lets a stuck run burn seventeen calls' worth of money before anything notices.`) +
        p(`What to measure: per-run histograms (not averages) of model calls, total tokens, wall-clock, and tool invocations, tagged with the terminal state — answered, budget-exhausted, error, user-cancelled. The single most useful chart in agent ops is <em>steps-to-completion, bucketed, split by outcome</em>: a rising right tail in the "budget exhausted" series is the earliest signal that a prompt or tool change has made the agent start wandering. ${ch("c20", "C20")} builds this.`),
    },
    {
      difficulty: "stretch",
      prompt: `Write the decision procedure you would actually use in a design review to pick a dial position. It should be answerable by a product manager, take under five minutes, and fail safe toward lower positions.`,
      answer:
        ol([
          `<b>Can you enumerate the valid step-sequences?</b> If yes and there are fewer than a dozen, build position 0–2. Stop here; most systems stop here.`,
          `<b>Does step N+1 genuinely depend on the <em>content</em> returned by step N</b>, not just on its success? "Search, then summarise" does not qualify; "search, and if the result contradicts the policy, search the policy index instead" does. If no, position 2.`,
          `<b>Is variance in the path acceptable to the person who owns this surface?</b> Ask about the regulated case, the audit case, and the "why did it do that" case. If no, position ≤2 and add model calls only inside fixed nodes.`,
          `<b>What is the blast radius of the worst single tool call?</b> Write it down as a sentence with a verb and an object ("sends an email to a customer", "deletes a row"). If that sentence frightens anyone in the room, you need position 3 <em>plus</em> ${ch("c16", "C16")} approvals, and the approval design is now part of the estimate, not a follow-up.`,
          `<b>Can you afford the p99, not the median?</b> Multiply the expected median cost by four and the median latency by four. If that number is not fine, you are building position 2 whether you like it or not.`,
        ]) +
        p(`Failing safe toward lower positions matters because the upgrade path is cheap and the downgrade path is not. Turning a working chain into an agent is a day's work. Retrofitting determinism onto a shipped agent means renegotiating with everyone who came to depend on its flexibility.`),
    },
  ],

  qa: [
    {
      q: "Is a single model call with tool use an agent?",
      a:
        p(`One call with one tool result and a final answer is the degenerate case: a two-iteration loop. The distinguishing property is not tool use — it is whether the <em>number</em> of iterations is decided at runtime. A system hard-capped at exactly one tool call is a router with extra steps, and should be evaluated as one.`),
    },
    {
      q: "Why build from scratch when LangGraph, AutoGen and the vendor SDKs exist?",
      a:
        p(`Because the parts that break in production are not the parts frameworks abstract. Frameworks give you the loop, which is four lines. They leave you the context budget, the retry semantics, the tool error surface, the eval set and the permission model, which are the hard parts. After this course you should use a framework; you will just be able to tell what it is doing and what it is not doing for you.`) +
        p(`A concrete example: every framework has a "max iterations" setting. Almost none has an opinion about what your agent should do with the partial work it has already done when that limit hits. That is your design problem, and ${ch("c12", "C12")} is about it.`),
    },
    {
      q: "Does a better model make the dial irrelevant?",
      a:
        p(`It moves the ceilings up and shifts which position is right for a given problem, but the structure is invariant. A stronger model raises position 3's success ceiling and shortens its tail. It still does not make any single run predictable, does not shrink the blast radius of <code>email_customer</code>, and does not give the loop a termination condition. Capability and control are separate axes, and this course is about the second one.`),
    },
    {
      q: "Where do 'multi-agent systems' sit on this dial?",
      a:
        p(`Off to the side, not further right. Multiple agents is a <em>topology</em> decision, mostly about isolating context and parallelising independent work; a five-agent system where a supervisor calls fixed specialists in a fixed order is position 2 with more moving parts. ${ch("c17", "C17")} treats topology as its own axis, and is fairly rude about how often it is the wrong first reach.`),
    },
    {
      q: "The course says 'no framework'. Does it use any libraries at all?",
      a:
        p(`Only Node's standard library and <code>fetch</code>. No LangChain, no SDK, no vector database, no <code>zod</code> — you will write a 60-line schema validator in ${ch("c02", "C02")} and a vector index in ${ch("c06", "C06")}, because writing them is how you learn what the real ones are choosing for you. The code is meant to be read, not depended on.`),
    },
  ],

  project: {
    title: "Project · Position audit",
    brief:
      p(`Pick an LLM feature that already exists — one you built, one at work, or one you can describe precisely from using it (a support bot, an IDE assistant, a summarising tool). Audit it against the dial and write it up in one page.`) +
      p(`This project has no code, and it is the best-spent twenty minutes in the course. Every later chapter will make more sense if you have one concrete system in your head that you have already classified.`),
    spec: [
      "The dial position, with the specific evidence that fixes it there — name the line of code or the observable behaviour, not the marketing.",
      "The full tool surface, written as sentences with verbs and objects. Mark each one <em>read</em> or <em>write</em>.",
      "The blast radius of the worst single tool call, in one sentence.",
      "What terminates the loop today, and what happens to partial work when it terminates that way.",
      "One sentence on whether the position is right, and what you would move it to.",
    ],
    stretch: [
      "Estimate median and p99 model calls per request from logs, or from ten deliberate hard requests if you have no logs.",
      "Write the three inputs most likely to make it fail, and predict the failure mode for each. Keep the file — you will re-run these as an eval set in C19.",
    ],
  },

  quiz: [
    {
      q: "What single property most sharply distinguishes an agent from a prompt chain?",
      options: [
        "The agent's control flow is produced at runtime by model output, so the execution path cannot be drawn before the run",
        "The agent uses tools and the chain does not",
        "The agent uses a larger model",
        "The agent maintains conversation history across turns",
      ],
      answer: 0,
      why:
        "Chains use tools and keep history too. The distinguishing property is who decides the next step: in a chain you drew the graph, in an agent the graph is an output. A useful test is whether you can produce the flowchart before the run or only afterwards from the trace.",
    },
    {
      q: "Why does an agent's cost grow faster than linearly in the number of steps?",
      options: [
        "Because every step re-sends the entire accumulated message history, so step N pays for steps 1..N-1 again",
        "Because models charge more for later calls in a session",
        "Because tool calls are billed separately at a premium",
        "Because each step requires a larger model than the last",
      ],
      answer: 0,
      why:
        "When a loop retains and re-sends its full history, the first tool result in a ten-step run is transmitted ten times. This roughly quadratic growth is why context engineering (C05) is a cost discipline, not just a quality concern; compaction and caching change the trade-off rather than making the context limit disappear.",
    },
    {
      q: "The model asks to call `lookup_ordre` — a tool that does not exist. What is the best behaviour?",
      options: [
        "Return an error string naming the available tools as the tool result, and continue the loop",
        "Throw, ending the run with a clear stack trace",
        "Fuzzy-match to `lookup_order` and call it",
        "Retry the same model call with a higher temperature",
      ],
      answer: 0,
      why:
        "Feeding the failure back as an observation lets the model self-correct on the next iteration, which is what the loop is for. Throwing discards a recoverable run. Silent fuzzy-matching is worse than both: it hides a real signal that your tool names are confusable, and it will eventually match the wrong tool.",
    },
    {
      q: "Where does the step-budget check belong in the loop?",
      options: [
        "At the top of the loop body, before the model call",
        "After the model call, so the last decision is still recorded",
        "In a wrapper around the whole run, checked once at the end",
        "In the system prompt, as an instruction to the model",
      ],
      answer: 0,
      why:
        "Checking before the model call is what prevents the spend. Checking afterwards pays for the call you were trying to avoid, and checking at the end is not a guard at all. The prompt instruction is worth adding but is never the guard, because the case you are defending against is a model that sincerely believes it is not finished.",
    },
    {
      q: "For sizing timeouts and concurrency on a position-3 agent, which number matters most?",
      options: [
        "The p99 of steps-to-completion",
        "The mean number of steps",
        "The median latency of a single model call",
        "The total number of tools registered",
      ],
      answer: 0,
      why:
        "Long runs hold concurrency slots, connections and context budget simultaneously, so capacity is set by the tail. A timeout derived from the median kills legitimate long runs; one derived from the tail lets stuck runs burn budget. Histograms split by terminal state, not averages, are the right instrument.",
    },
    {
      q: "A team proposes replacing a working two-call prompt chain with an agent to 'handle edge cases'. What is the strongest reason to push back?",
      options: [
        "If the valid step-sequences can be enumerated and the next step does not depend on the previous step's content, agency adds cost, latency and variance while buying nothing",
        "Agents are less accurate than chains on every task",
        "Agents cannot use the same tools a chain can",
        "Agents require a fine-tuned model",
      ],
      answer: 0,
      why:
        "Agency is only worth its price when the space of valid paths is too large to enumerate and the next step genuinely depends on what the last one returned. The right response is the design procedure: list the step-sequences, look for a real content dependency, and only then price the p99.",
    },
  ],

  continues:
    p(`The loop above calls <code>model(messages, tools)</code> as if that were a primitive. It is not. Before anything can decide anything you need a typed, streaming, retrying, cost-accounted way to turn an array of messages into a decision, and the shape of that one function constrains every design choice that follows. ${ch("c01", "C01")} builds it.`),
};

export default chapter;
