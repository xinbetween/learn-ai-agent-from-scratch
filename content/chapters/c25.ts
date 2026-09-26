import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const ACTION_SVG = `
<svg viewBox="0 0 700 320" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Two action spaces: a sequence of JSON tool calls versus one code action">
  <defs>
    <marker id="a25" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
    <marker id="a25a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
  </defs>

  <text x="14" y="20" class="d-label">ONE QUESTION — MEAN SALARY PER DEPARTMENT</text>

  <text x="14" y="46" class="d-label" fill="var(--fg-faint)">JSON ACTION SPACE · 6 TURNS</text>
  <rect x="14" y="56" width="120" height="30" rx="5" class="d-box"/>
  <text x="74" y="76" class="d-mono" text-anchor="middle">list_departments</text>
  <path d="M138 71 L162 71" class="d-arrow" marker-end="url(#a25)"/>
  <rect x="166" y="56" width="128" height="30" rx="5" class="d-box-t"/>
  <text x="230" y="76" class="d-mono" text-anchor="middle">list(engineering)</text>
  <path d="M298 71 L322 71" class="d-arrow" marker-end="url(#a25)"/>
  <rect x="326" y="56" width="104" height="30" rx="5" class="d-box-t"/>
  <text x="378" y="76" class="d-mono" text-anchor="middle">list(sales)</text>
  <path d="M434 71 L458 71" class="d-arrow" marker-end="url(#a25)"/>
  <rect x="462" y="56" width="104" height="30" rx="5" class="d-box-t"/>
  <text x="514" y="76" class="d-mono" text-anchor="middle">list(support)</text>
  <path d="M570 71 L594 71" class="d-arrow" marker-end="url(#a25)"/>
  <rect x="598" y="56" width="88" height="30" rx="5" class="d-box-t"/>
  <text x="642" y="76" class="d-mono" text-anchor="middle">list(finance)</text>

  <rect x="14" y="100" width="672" height="34" rx="5" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="121" class="d-mono" fill="var(--danger)">240 rows cross into messages[] — and are re-sent on every turn that follows</text>

  <line x1="14" y1="152" x2="686" y2="152" stroke="var(--border)"/>

  <text x="14" y="180" class="d-label" fill="var(--fg-faint)">CODE ACTION SPACE · 2 TURNS</text>
  <rect x="14" y="192" width="430" height="88" rx="5" class="d-box-a"/>
  <text x="26" y="212" class="d-mono">const by = {};</text>
  <text x="26" y="230" class="d-mono">for (const e of employees)</text>
  <text x="26" y="248" class="d-mono">  (by[e.dept] ??= []).push(e.salary);</text>
  <text x="26" y="266" class="d-mono">print(mean(by));</text>

  <path d="M448 236 L482 236" class="d-arrow-a" marker-end="url(#a25a)"/>
  <rect x="486" y="212" width="200" height="48" rx="5" class="d-box"/>
  <text x="586" y="232" class="d-mono" text-anchor="middle">[["engineering",104871],</text>
  <text x="586" y="250" class="d-mono" text-anchor="middle"> ["finance",105892], …]</text>

  <text x="14" y="302" class="d-mono" fill="var(--accent)">the 240 rows never leave the interpreter · 33,230 → 91 observation tokens</text>
</svg>`;

const chapter: Chapter = {
  id: "c25",
  num: 25,
  layer: "environment",
  title: "The Action Space",
  subtitle: "What changes when the action is a program instead of a tool name",
  blurb:
    "A JSON action can name one tool and pass it arguments. A code action can filter, join, loop and branch before it returns anything. That difference decides how many turns a task takes, how much of your data crosses into the context, and whether a failure is recoverable.",
  lines: 314,
  file: "code/c25_action_space.ts",
  tags: ["CodeAct", "action space", "code actions", "tool calls", "composition", "self-debugging", "interpreter"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "The question C03 never asked",
      html:
        p(`${ch("c03", "C03")} built a tool registry and ${ch("c13", "C13")} added an interpreter as one more tool in it. Both took something for granted: that an action is a <em>name plus arguments</em>, and that the model's job is to pick the right name. That is the shape every function-calling API gives you, and it is easy to mistake a wire format for a design decision.`) +
        p(`It is a design decision. The alternative is to let the action be a program. Instead of <code>{"tool": "list_employees", "args": {"dept": "sales"}}</code>, the model emits three lines that filter, aggregate and print — and the only thing that comes back is what it chose to print. The name for this is <strong>CodeAct</strong>, from Wang et al., and the result they report is that it beats JSON and text action formats on success rate across seventeen models.`) +
        p(`This chapter is about why, and about the cases where it is the wrong choice. The interesting part is not that code is more expressive, which is obvious. It is that the expressiveness shows up in three places you have already been paying for: turn count, context growth, and what happens after a mistake.`) +
        note(
          "key",
          "The reframe",
          p(`A JSON action can only <em>request</em>. A code action can <em>compute</em>. Everything that follows is a consequence of where the computation happens — in the model's context, one observation at a time, or next to the data, once.`)
        ),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Three things a program does that a tool name cannot",
      html:
        `<h3>1 · Composition in a single action</h3>` +
        p(`Ask for the mean salary per department against a registry with <code>list_departments</code> and <code>list_employees</code> and no aggregate. The model has to enumerate the departments, pull each one in full, hold all of it in context, and do the arithmetic itself. Five calls, six turns, and every row it touched is now permanently in <code>messages</code>.`) +
        p(`The code action is one turn, and it returns four numbers. The 240 rows stay inside the interpreter. This is ${ch("c05", "C05")}'s argument arriving from an unexpected direction: the cheapest context is the context you never created.`) +
        `<h3>2 · Control flow the registry did not anticipate</h3>` +
        p(`A tool surface encodes the operations someone thought of. A loop, a conditional and a local variable let the model express an operation nobody thought of — a join across two lists, a bucketed histogram, a retry over a list of candidates — without you shipping a tool for it. ${ch("c03", "C03")} warned that a registry past twenty tools starts to mis-select; a code action is the other way out of that problem, and it scales in the opposite direction.`) +
        `<h3>3 · Failure that carries its own diagnosis</h3>` +
        p(`${ch("c03", "C03")} argued that a tool error must come back as an observation rather than an exception, and that the quality of the message decides whether the agent recovers. An interpreter gives you that for free and better: a traceback names the line, the operation and the value. The model reads <code>Reduce of empty array with no initial value</code> and learns both that the filter matched nothing and where it happened, with no error taxonomy for you to design.`) +
        code({
          title: "the same recovery, no tool written for it",
          lang: "text",
          plain: true,
          src: `attempt 1   const hr = employees.filter(e => e.dept === "human-resources");
            print(hr.reduce((a, b) => (a.salary > b.salary ? a : b)).name);
            → ERROR  Reduce of empty array with no initial value

attempt 2   if (hr.length === 0) print("no such department; known:",
              [...new Set(employees.map(e => e.dept))].sort());
            → no such department; known: ["engineering","finance","sales","support"]`,
        }) +
        note(
          "",
          "This is not an argument for replacing tools",
          p(`The code action needs something to call. In the runnable file the interpreter is handed <code>employees</code>; in a real system it is handed a client, a filesystem handle, or the very tools from ${ch("c03", "C03")}. The action space changes; the capability surface does not. What you are choosing is whether the model composes your capabilities itself or asks you to compose them one turn at a time.`)
        ),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "What it costs, measured",
      html:
        fig({
          label: "Diagram",
          title: "one question, two action spaces",
          body: ACTION_SVG,
          caption: `The turn count is the visible difference and the smaller one. The observation tokens are the difference that compounds, because ${ch("c01", "C01")} bills every row again on every subsequent turn.`,
        }) +
        `<h3>The six tasks from the runnable file</h3>` +
        table(
          ["Task", "JSON turns", "Code turns", "JSON obs tokens", "Code obs tokens"],
          [
            ["count engineering", "2", "2", "1,896", "1"],
            ["highest paid in sales", "2", "2", "1,792", "3"],
            ["mean salary per department", "6", "2", "7,355", "23"],
            ["who reports to whom (a join)", "10", "2", "7,477", "21"],
            ["salary bands, bucketed", "6", "2", "7,355", "13"],
            ["longest-serving per department", "6", "2", "7,355", "30"],
            ["<b>total</b>", "<b>32</b>", "<b>12</b>", "<b>33,230</b>", "<b>91</b>"],
          ]
        ) +
        p(`Read the first row before the last one. When the task <em>is</em> a single tool call, the two action spaces tie on turns — and the JSON version still drags 1,896 tokens into the context to answer a question whose answer is one integer. The gap is not really about composition. It is about the fact that a JSON action has no way to say "and then count them".`) +
        `<h3>Where the advantage reverses</h3>` +
        ul([
          `<strong>The action is irreversible.</strong> A code action that can loop is a code action that can send four hundred emails. ${ch("c16", "C16")}'s approval model works on a named tool with inspectable arguments; approving a program means reading the program, which is a harder thing to ask of a reviewer and a much harder thing to automate.`,
          `<strong>You need the action in a log.</strong> <code>send_email(to, subject)</code> is a row in an audit table. A program is a blob you have to re-read to know what it did. ${ch("c20", "C20")}'s tracing works better on a small, closed set of verbs.`,
          `<strong>The model is small.</strong> The measured advantage is an average over capable models. A weaker model writing a program has more ways to be wrong than one choosing from eight names, and the failures are harder to constrain — ${ch("c02", "C02")}'s constrained decoding can make an invalid tool name unrepresentable, but it cannot make a logic error unrepresentable.`,
          `<strong>There is no sandbox.</strong> This entire chapter assumes ${ch("c13", "C13")}. A code action without an interpreter you control is remote code execution with extra steps.`,
        ]) +
        note(
          "warn",
          "What the 20% does and does not mean",
          p(`The paper reports up to 20% higher success across 17 models on API-Bank and a curated benchmark. "Up to" is doing work in that sentence: it is the best case, not the average, and the benchmarks are tool-use tasks where composition is exactly what is being tested. On a workload of single-call lookups you should expect no gain at all — the first row of the table above is that case. Measure it on your own tasks (${ch("c19", "C19")}) before you rewrite an action space.`)
        ),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Find where the crossover is",
      html:
        p(`The advantage depends on how much composition a task needs and how large the intermediate results are. Move the sliders until JSON wins, then work out why.`) +
        lab({
          label: "Simulator",
          title: "JSON calls versus code actions",
          body: `
<div class="controls">
  <div class="ctl"><label>steps the task needs</label>
    <input type="range" id="a25-steps" min="1" max="10" step="1" value="4">
    <span class="val" id="a25-steps-v">4</span></div>
  <div class="ctl"><label>rows per intermediate result</label>
    <input type="range" id="a25-rows" min="1" max="400" step="1" value="60">
    <span class="val" id="a25-rows-v">60</span></div>
  <div class="ctl"><label>turns remaining after</label>
    <input type="range" id="a25-after" min="0" max="20" step="1" value="6">
    <span class="val" id="a25-after-v">6</span></div>
  <div class="ctl"><label>code error rate</label>
    <input type="range" id="a25-err" min="0" max="60" step="5" value="10">
    <span class="val" id="a25-err-v">10%</span></div>
</div>
<div id="a25-verdict" class="note" style="margin-top:0"></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:1rem">
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">json total tokens</div>
    <div class="meter"><i id="a25-jbar" style="width:0%"></i></div>
    <div class="mono small muted" id="a25-jv">—</div>
  </div>
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">code total tokens</div>
    <div class="meter"><i id="a25-cbar" style="width:0%;background:var(--tool)"></i></div>
    <div class="mono small muted" id="a25-cv">—</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><b id="a25-jturns">—</b><span>json turns</span></div>
  <div class="stat"><b id="a25-cturns">—</b><span>code turns</span></div>
  <div class="stat"><b id="a25-ratio">—</b><span>token ratio</span></div>
  <div class="stat"><b id="a25-win">—</b><span>cheaper</span></div>
</div>`,
          script: `
var steps = document.getElementById("a25-steps"), rows = document.getElementById("a25-rows");
var after = document.getElementById("a25-after"), err = document.getElementById("a25-err");

function run() {
  var S = +steps.value, R = +rows.value, A = +after.value, E = +err.value / 100;
  document.getElementById("a25-steps-v").textContent = S;
  document.getElementById("a25-rows-v").textContent = R;
  document.getElementById("a25-after-v").textContent = A;
  document.getElementById("a25-err-v").textContent = (E * 100).toFixed(0) + "%";

  var TOK_PER_ROW = 30;
  // JSON: one call per step, each returning R rows, all of it re-sent later.
  var jsonObs = S * R * TOK_PER_ROW;
  var jsonTurns = S + 1;
  var jsonTotal = jsonObs * (1 + A);

  // Code: one action (plus retries on error), returning a small result.
  var retries = E * 1.6;
  var codeTurns = 1 + retries + 1;
  var codeObs = 40 + retries * 60;
  var codeAction = 220 * (1 + retries);
  var codeTotal = (codeObs + codeAction) * (1 + A);

  document.getElementById("a25-jturns").textContent = jsonTurns.toFixed(0);
  document.getElementById("a25-cturns").textContent = codeTurns.toFixed(1);
  var ratio = jsonTotal / Math.max(1, codeTotal);
  document.getElementById("a25-ratio").textContent = ratio >= 1
    ? ratio.toFixed(1) + "×" : "0." + Math.round(ratio * 10) + "×";
  document.getElementById("a25-win").textContent = jsonTotal < codeTotal ? "json" : "code";

  var mx = Math.max(jsonTotal, codeTotal);
  document.getElementById("a25-jbar").style.width = (jsonTotal / mx * 100) + "%";
  document.getElementById("a25-cbar").style.width = (codeTotal / mx * 100) + "%";
  document.getElementById("a25-jv").textContent = Math.round(jsonTotal).toLocaleString() + " tok";
  document.getElementById("a25-cv").textContent = Math.round(codeTotal).toLocaleString() + " tok";

  var v = document.getElementById("a25-verdict");
  if (S === 1 && R <= 5) v.innerHTML = "<b>JSON wins, and it should.</b> One step, a handful of rows: the code action pays 220 tokens to write a program that saves nothing. A registry of well-named tools is the right answer for lookups.";
  else if (jsonTotal < codeTotal) v.innerHTML = "<b>JSON is cheaper here.</b> The task is small enough that the program's own tokens dominate. Note how narrow this region is — it needs few steps <em>and</em> small results.";
  else if (E >= 0.4) v.innerHTML = "<b>Code still wins, but look at the turn count.</b> At this error rate the agent is spending its budget on retries. The traceback makes them recoverable (that is the point), but a model that cannot write correct code is not saved by being allowed to.";
  else if (A === 0) v.innerHTML = "<b>Code wins on the turn count alone.</b> With nothing following, the re-send tax never lands. Drag <em>turns remaining</em> up and watch the gap widen — that is the compounding C01 described.";
  else v.innerHTML = "<b>Code wins, and the margin is mostly the re-send tax.</b> Every row JSON pulled into the context is billed again on each of the " + A + " turns that follow. The program returned an answer instead of the data.";
}
[steps, rows, after, err].forEach(function (el) { el.addEventListener("input", run); });
run();`,
          caption: `Set steps to 1 and rows to 3: JSON wins, because writing a program costs more than the lookup saves. Now raise <em>rows</em> alone. The crossover happens well before the task gets complicated, and it is driven by the re-send tax rather than by the turn count.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "Both action spaces, over the same data",
      html:
        p(`The runnable file answers six questions twice against one 240-row table. The model is scripted, so what is being measured is the ceiling of each action space rather than whether a model reaches it.`) +
        code({
          title: "code/c25_action_space.ts — the two runners",
          src: `function runJson(task: Task): Accounting {
  const acc = zero();
  for (const call of task.json) {
    acc.turns++;
    acc.actionTokens += estimateTokens(JSON.stringify(call));
    const observation = JSON.stringify(TOOLS[call.tool](call.args));
    acc.observationTokens += estimateTokens(observation);   // ← enters messages[]
  }
  acc.turns++;                                              // state the answer
  return acc;
}

function runCodeAction(task: Task): Accounting {
  const acc = zero();
  acc.turns++;
  acc.actionTokens += estimateTokens(task.code);
  const { output, error } = runCode(task.code);
  acc.observationTokens += estimateTokens(error ? output + "\\n" + error : output);
  acc.turns++;
  return acc;
}`,
        }) +
        p(`Two details are load-bearing. The tool registry deliberately has no aggregate and no sort, which is not a rigged comparison but the normal state of a tool surface — you ship the operations you anticipated. And every code action is checked against an independently computed answer, so a comparison that looked good because the program was wrong would fail loudly.`) +
        code({
          title: "the interpreter boundary, reduced to its essentials",
          src: `export function runCode(source: string): { output: string; error?: string } {
  const printed: string[] = [];
  const print = (...xs: unknown[]) => printed.push(xs.map(fmt).join(" "));
  try {
    // In production this is C13's sandbox. What matters here is the shape:
    // the data is passed in, and only what is printed crosses back out.
    const fn = new Function("employees", "print", source);
    fn(EMPLOYEES, print);
    return { output: printed.join("\\n") };
  } catch (e) {
    return { output: printed.join("\\n"), error: String((e as Error).message) };
  }
}`,
        }) +
        note(
          "bad",
          "new Function is not a sandbox",
          p(`It is used here because the file has no dependencies and the subject is the action space rather than isolation. It shares globals with the host, so a code action could read your environment and make a network call. ${ch("c13", "C13")} builds the version you would actually run, and the rule from that chapter applies unchanged: if any path into the model's context is untrusted, the program it writes is attacker-controlled.`)
        ) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c25_action_space.ts

#   C25 · The action space — 6 tasks, two ways
#
#   task                           json turns  code turns  json obs tok  code obs tok
#   ------------------------------ ----------- ----------- ------------- ------------
#   count engineering                        2           2          1896            1
#   highest paid in sales                    2           2          1792            3
#   mean salary per department               6           2          7355           23
#   who reports to whom (a join)            10           2          7477           21
#   salary bands, bucketed                   6           2          7355           13
#   longest-serving per department           6           2          7355           30
#   ------------------------------ ----------- ----------- ------------- ------------
#   total                                   32          12         33230           91
#
#   2.7× the turns, 365× the observation tokens.
#   The token gap is the interesting one: a JSON action can only name a tool,
#   so every row it needs must cross into the message array — and C01 bills
#   those rows again on every turn that follows. A code action can filter and
#   aggregate where the data already is, and return the four numbers you asked
#   for. The intermediate 240 rows never enter the conversation at all.
#
#   Self-debugging — the traceback is the observation:
#
#     attempt 1  ERROR  Reduce of empty array with no initial value
#     attempt 2  no such department; known: ["engineering","finance","sales","support"]
#
#     Nothing had to be designed for that recovery. In a JSON action space you
#     would have needed a tool that reports valid departments; here the runtime
#     error names the problem and the next action handles it (C03's rule, but
#     for free).
#
#   What this does not show: the model choosing. Every plan above was scripted,
#   so this measures the ceiling of each action space, not whether a model hits
#   it. The paper measures that part — up to 20% higher success across 17 models
#   on API-Bank — and C19 is how you would measure it on your own tasks.`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Where this shows up",
      html:
        ul([
          `<strong>The paper is worth reading for its negative space.</strong> Wang et al. release CodeActInstruct — 7k multi-turn interactions — and fine-tune Llama2 and Mistral into CodeActAgent, because the base models were not reliably good at emitting code actions. The result is not "code actions are better"; it is "code actions are better <em>and</em> the models needed training to use them well". If you are prompting rather than fine-tuning, you are in the first half of that sentence only.`,
          `<strong>Anthropic's code-execution tool and OpenAI's code interpreter</strong> are this pattern productised, with the sandbox and the state management handled. The interesting design question they answer is persistence: variables survive between actions within a session, which turns a sequence of actions into a program with memory and makes the interpreter itself part of your context strategy (${ch("c05", "C05")}).`,
          `<strong>pi exposes a bash tool rather than a general interpreter</strong>, which is the middle position: a shell command composes with pipes and loops, but it is a line of text you can read, log and pattern-match on. If a full interpreter feels like too much action space for your risk appetite, a constrained shell is the step before it.`,
          `<strong>The hybrid is usually right.</strong> Keep named tools for the irreversible things — sending, paying, deploying — where ${ch("c16", "C16")} needs an inspectable action and ${ch("c20", "C20")} needs a loggable one. Give the model an interpreter for reading, filtering and computing, where the blast radius is a wasted sandbox and the upside is the table above.`,
          `<strong>Watch the failure mode this creates.</strong> An agent with an interpreter will use it for things you have a tool for, because writing three lines is easier than finding the right name. That is usually fine and occasionally terrible — it will reimplement your retry policy, your pagination and your rate limiting, badly. Name that in the system prompt: <em>use the tools where they exist; write code for what they do not cover.</em>`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `In the table, "count engineering" takes the same number of turns in both action spaces but 1,896 observation tokens versus 1. Explain where those tokens went, and what tool you would add to the JSON registry to close the gap.`,
      answer:
        p(`The JSON action can only say <code>list_employees(dept: "engineering")</code>, so the tool returns all sixty matching rows and every one of them lands in <code>messages</code>. The model then counts them itself. The answer is the integer 60; the cost is the sixty rows it had to read to produce it.`) +
        p(`The obvious fix is <code>count_employees(dept)</code>. The instructive part is what happens next: someone asks for the mean, so you add <code>mean_salary(dept)</code>; then the median; then the count above a threshold. You are hand-compiling a query language one tool at a time, and ${ch("c03", "C03")}'s registry-size problem arrives on schedule. A code action is the general form of that fix, which is the argument of this chapter in one exercise.`),
    },
    {
      difficulty: "core",
      prompt: `Your agent has both a code interpreter and a <code>send_email</code> tool. Write the system-prompt rule that decides which to use, and explain why a code action must not be allowed to call <code>send_email</code>.`,
      answer:
        code({
          title: "the rule",
          lang: "text",
          plain: true,
          src: `Use the interpreter to read, filter, join and compute. Anything whose
effect is confined to the sandbox belongs there.

Use a named tool for anything that changes the world outside it: sending,
paying, deploying, writing outside the workspace. These are not available
inside the interpreter and must be called directly, one at a time.`,
        }) +
        p(`The reason is the approval model. ${ch("c16", "C16")} asks a human to approve an action they can read: <code>send_email(to: "ana@…", subject: "Refund")</code> is inspectable in one second. A program that <em>may</em> send email is inspectable only by reading the program and reasoning about its control flow, which is a code review, not an approval — and the reviewer has to do it while the agent waits.`) +
        p(`There is a second reason that bites sooner. A loop that sends is a loop that sends four hundred times. The blast radius of a code action is whatever the interpreter can reach, so the design rule is to make sure that reach contains nothing irreversible. Keep the irreversible verbs outside the sandbox and the worst a bad program can do is waste the sandbox.`),
    },
    {
      difficulty: "core",
      prompt: `The paper reports "up to 20% higher success". Design the experiment that would tell you whether your workload sees any of that, and name the result that would make you keep JSON tool calls.`,
      answer:
        p(`Use ${ch("c19", "C19")}'s machinery and change exactly one thing. Take 80–120 cases from your production traffic, not from imagination, and stratify them by how much composition they need: single lookups, two-step chains, and anything requiring an aggregate or a join. Run both action spaces over the same cases, several runs each, with the same model and the same underlying capabilities.`) +
        p(`Report success rate <em>per stratum</em>, not pooled. Pooling is how you get a misleading average: if 70% of your traffic is single lookups where the two tie, a large win on the remaining 30% shows up as a small overall number and gets dismissed. Report cost and turn count alongside, since those are where the code advantage is largest and most reliable.`) +
        p(`<strong>Keep JSON if:</strong> the composition-heavy stratum is a small share of real traffic; or the code version's success is equal but its variance is higher, which means occasional expensive nonsense rather than consistent behaviour; or the tasks that improve are ones where you need an audit row per action anyway. The last one is a policy constraint that no benchmark number overrides.`),
    },
    {
      difficulty: "stretch",
      prompt: `Design the state model for an interpreter whose variables persist across actions in a session. Say what breaks when you compact the conversation (${ch("c05", "C05")}), and what breaks when you resume a run from a durable log (${ch("c08", "C08")}).`,
      answer:
        p(`Persistence turns a sequence of actions into a program with memory, which is genuinely useful — the model loads a dataframe once and asks five questions of it — and creates a second piece of state that your context strategy does not know about.`) +
        ul([
          `<strong>Compaction breaks the correspondence.</strong> The transcript says "I loaded the CSV into <code>df</code>"; compaction summarises that turn away; the interpreter still holds <code>df</code>. Now the model does not know what it has. The fix is to treat the interpreter's namespace as a context region (${ch("c05", "C05")}'s pinned region) and re-state it after every compaction: <em>live variables: df (24k rows), threshold, results</em>. Cheap, and it keeps the two in sync.`,
          `<strong>Resume breaks the state entirely.</strong> ${ch("c08", "C08")}'s log records the actions and their outputs; it does not record the interpreter's heap. Replaying the log rebuilds the conversation and leaves the namespace empty, so the next action fails on an undefined variable. Two options: mark the session non-resumable past the first stateful action, or make replay <em>re-execute</em> the code actions rather than replaying their recorded outputs — which is only safe because you kept the irreversible verbs out of the interpreter in the first place.`,
          `<strong>Forking multiplies it.</strong> A fork (${ch("c08", "C08")}) needs the namespace copied, not shared, or two branches mutate one heap.`,
        ]) +
        p(`The general principle: any state that lives outside the message array has to be either reconstructible from it or explicitly checkpointed alongside it. An interpreter namespace is the most useful example of that rule, and the easiest one to forget you created.`),
    },
  ],

  qa: [
    {
      q: "Does this mean I should throw away my tool registry?",
      a: p(`No, and the framing is the trap. The interpreter needs capabilities to call, and those capabilities are your tools. What changes is who composes them: the model, inside one action, or your loop, one turn at a time. Most production systems end up hybrid — an interpreter for the read-and-compute half, named tools for the half that changes the world.`),
    },
    {
      q: "Python or JavaScript for the action space?",
      a: p(`The paper uses Python, and for data work that is the right answer: the model has seen far more pandas and numpy than any JavaScript equivalent, and the libraries it will reach for exist. For an agent embedded in a TypeScript system, JavaScript keeps one runtime and one set of types, which matters more than you would think when the interpreter needs a client with your auth in it. Decide on what the actions will mostly do, not on what the host is written in.`),
    },
    {
      q: "How do I stop the model writing code when a tool would do?",
      a: p(`Say so in the system prompt, and then check whether it listened. An agent with an interpreter will reimplement your paginated, rate-limited, retrying client as a bare fetch in a loop, because three lines is less work than finding the right tool name. The instruction that works names the direction — <em>use the tools where they exist; write code only for what they do not cover</em> — and the metric that tells you it is working is the share of actions that are code (${ch("c20", "C20")}). A sudden rise usually means a tool description got worse, not that the tasks got harder.`),
    },
    {
      q: "Is constrained decoding useless here?",
      a: p(`Not useless, but much weaker. ${ch("c02", "C02")}'s grammar can make an invalid tool name unsamplable; it can make a program syntactically valid too, which is a real if smaller benefit. What it cannot do is make a program <em>correct</em>. You trade a class of errors the decoder can eliminate for a class only execution can catch — which is a fair trade precisely because the interpreter catches them and hands back a traceback.`),
    },
    {
      q: "What about the tokens the model spends writing the program?",
      a: p(`Real, and the simulator counts them: roughly 220 output tokens for a non-trivial action against maybe 25 for a JSON call. That is why the single-lookup row in the table is a tie rather than a win. The reason it stops mattering quickly is asymmetry — output tokens are paid once, while the observation tokens a JSON call drags in are paid again on every subsequent turn (${ch("c01", "C01")}).`),
    },
  ],

  project: {
    title: "Project · Give your agent an action space it can compose in",
    brief:
      p(`Take the agent from ${ch("c04", "C04")} and add a code action alongside its tools, using ${ch("c13", "C13")}'s sandbox. Then measure whether it helped on your own tasks rather than on the paper's.`),
    spec: [
      "A <code>run_code</code> action whose sandbox receives your existing tools as callable functions, so the capability surface is unchanged and only the action space differs.",
      "Only what the action prints crosses back into the context, capped and truncated with <code>C03</code>'s rules.",
      "Irreversible tools are reachable only as named actions, never from inside the interpreter — and a test proves it by asserting the sandbox cannot see them.",
      "Runtime errors return as observations carrying the traceback, and a test asserts the agent recovers from a deliberate <code>undefined</code> in one extra step.",
      "A system prompt that states when to use code and when to use a named tool.",
      "An eval set of at least 20 of your real tasks, stratified by how much composition they need, run against both action spaces and reported per stratum.",
    ],
    stretch: [
      "Make the interpreter namespace persist across actions within a run, then handle both consequences: re-state the live variables after compaction, and decide explicitly what resume does.",
      "Instrument the share of actions that are code versus named tools, and alert when it moves — it is a leading indicator that a tool description has rotted.",
      "Add a cheap static check before execution that rejects a program referencing an identifier outside the allowed set, and measure how often it fires against how often it is wrong.",
    ],
  },

  quiz: [
    {
      q: "Both action spaces take two turns to count the employees in one department, but JSON costs 1,896 observation tokens and the code action costs 1. Why?",
      options: [
        "A JSON action can only request data, so all sixty rows enter the context for the model to count itself; the program counts them where they are and returns the integer",
        "The JSON tool implementation is less efficient",
        "Code actions are compressed before being sent",
        "The JSON call was made against a larger dataset",
      ],
      answer: 0,
      why:
        "The action space bounds what one action can express. `list_employees(dept)` has no way to say 'and then count them', so the counting happens in the model's context and the raw rows have to get there first. This is why the gap appears even on tasks that need no composition at all.",
    },
    {
      q: "Which task property most predicts that code actions will win?",
      options: [
        "The size of the intermediate results the task must handle, because those are what enter the context and get re-sent",
        "The total number of tools in the registry",
        "The length of the user's question",
        "Whether the model supports constrained decoding",
      ],
      answer: 0,
      why:
        "Turn count is the visible difference; intermediate result size is the compounding one. A task needing many steps over tiny results is a modest win. A task needing one step over a large result is already a large win, because every row is billed again on every later turn.",
    },
    {
      q: "Why must a code action be prevented from calling `send_email`?",
      options: [
        "Approval needs an inspectable action, and a loop that sends is a loop that sends four hundred times",
        "Email libraries do not work inside sandboxes",
        "It would make the code action slower",
        "The model cannot format email addresses correctly",
      ],
      answer: 0,
      why:
        "C16's approval model works on a named action with readable arguments. Approving a program means reading it and reasoning about its control flow, which is code review rather than approval. Keep irreversible verbs outside the interpreter and the worst a bad program does is waste the sandbox.",
    },
    {
      q: "The paper reports up to 20% higher success. What is the right way to read that number?",
      options: [
        "As a best case on composition-heavy benchmarks, which says nothing about a workload of single-call lookups until you measure it",
        "As the average gain you should expect on any agent task",
        "As a guarantee that applies once you use a code action space",
        "As a result specific to fine-tuned models only",
      ],
      answer: 0,
      why:
        "'Up to' is the best case, and the benchmarks test exactly the thing code actions are good at. The first row of this chapter's table is the counter-case: a single lookup, where the two tie on turns. Stratify your own eval set by composition depth and report per stratum, or a real win on a minority of traffic will average away to nothing.",
    },
    {
      q: "What does an interpreter give you that C03 asked you to build by hand?",
      options: [
        "Error observations that locate and describe the failure, via the traceback, with no error taxonomy to design",
        "Automatic retry with exponential backoff",
        "Guaranteed termination of the agent loop",
        "Parallel execution of read-only actions",
      ],
      answer: 0,
      why:
        "C03's rule is that a failure must come back as an observation good enough to act on, and that writing those messages is real design work. A traceback names the line, the operation and the value for free — which is why an agent can recover from a wrong assumption without anyone having anticipated that specific mistake.",
    },
    {
      q: "You give an agent both an interpreter and a well-built paginated API client. What should you expect, and watch for?",
      options: [
        "It will sometimes reimplement the client badly in three lines, so instruct it to prefer tools and track the share of actions that are code",
        "It will always prefer the client because it is more reliable",
        "It will refuse to use the interpreter for network access",
        "The two will never overlap in capability",
      ],
      answer: 0,
      why:
        "Writing three lines is less effort than finding the right tool name, so an agent with an interpreter will reach for it — and reimplement your pagination, retries and rate limiting without any of them. Name the preference in the system prompt, then measure the code-versus-tool ratio; a rise usually means a tool description rotted rather than that tasks got harder.",
    },
  ],

  continues:
    p(`An action space is what the agent can say. The next three chapters are about what it can reach — the filesystem and shell in ${ch("c14", "C14")}, other people's tools in ${ch("c15", "C15")}, and in ${ch("c16", "C16")} the human who has to approve the parts of that reach which cannot be undone.`),
};

export default chapter;
