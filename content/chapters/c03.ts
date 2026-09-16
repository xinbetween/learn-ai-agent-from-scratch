import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const DISPATCH_SVG = `
<svg viewBox="0 0 700 320" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The tool dispatch cycle with validation, timeout, and error-as-observation">
  <defs><marker id="t3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="t3d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--danger)"/></marker></defs>

  <text x="14" y="18" class="d-label">EVERY FAILURE PATH RE-ENTERS THE LOOP AS AN OBSERVATION</text>

  <rect x="14" y="32" width="120" height="44" rx="6" class="d-box-a"/>
  <text x="74" y="52" class="d-text" text-anchor="middle">tool_use</text>
  <text x="74" y="68" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">name + input</text>

  <path d="M138 54 L176 54" class="d-arrow" marker-end="url(#t3)"/>

  <rect x="180" y="32" width="112" height="44" rx="6" class="d-box"/>
  <text x="236" y="52" class="d-text" text-anchor="middle">lookup</text>
  <text x="236" y="68" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">registry</text>

  <path d="M296 54 L334 54" class="d-arrow" marker-end="url(#t3)"/>

  <rect x="338" y="32" width="112" height="44" rx="6" class="d-box"/>
  <text x="394" y="52" class="d-text" text-anchor="middle">validate</text>
  <text x="394" y="68" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">args vs schema</text>

  <path d="M454 54 L492 54" class="d-arrow" marker-end="url(#t3)"/>

  <rect x="496" y="32" width="112" height="44" rx="6" class="d-box-p"/>
  <text x="552" y="52" class="d-text" text-anchor="middle">authorize</text>
  <text x="552" y="68" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">C16 approval</text>

  <path d="M552 80 L552 112" class="d-arrow" marker-end="url(#t3)"/>

  <rect x="470" y="116" width="164" height="48" rx="6" class="d-box-t"/>
  <text x="552" y="136" class="d-text" text-anchor="middle">execute</text>
  <text x="552" y="153" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">with AbortSignal timeout</text>

  <path d="M470 140 L344 140" class="d-arrow" marker-end="url(#t3)"/>

  <rect x="212" y="116" width="128" height="48" rx="6" class="d-box"/>
  <text x="276" y="136" class="d-text" text-anchor="middle">truncate</text>
  <text x="276" y="153" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">cap the tokens</text>

  <path d="M212 140 L92 140 L92 96" class="d-arrow" marker-end="url(#t3)"/>
  <text x="88" y="118" class="d-mono" text-anchor="end">tool_result</text>

  <line x1="14" y1="184" x2="686" y2="184" stroke="var(--border)"/>
  <text x="14" y="206" class="d-label">THE FOUR FAILURES — NONE OF THEM THROWS</text>

  <rect x="14" y="216" width="160" height="42" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="94" y="234" class="d-mono" text-anchor="middle" fill="var(--danger)">unknown name</text>
  <text x="94" y="250" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">→ list what exists</text>

  <rect x="184" y="216" width="160" height="42" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="264" y="234" class="d-mono" text-anchor="middle" fill="var(--danger)">bad arguments</text>
  <text x="264" y="250" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">→ validator paths</text>

  <rect x="354" y="216" width="160" height="42" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="434" y="234" class="d-mono" text-anchor="middle" fill="var(--danger)">tool threw</text>
  <text x="434" y="250" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">→ message + retryable?</text>

  <rect x="524" y="216" width="162" height="42" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="605" y="234" class="d-mono" text-anchor="middle" fill="var(--danger)">timed out</text>
  <text x="605" y="250" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">→ say how long</text>

  <path d="M350 264 L350 292 L92 292 L92 168" class="d-arrow" marker-end="url(#t3d)" stroke="var(--danger)" stroke-dasharray="4 3"/>
  <text x="360" y="288" class="d-mono" fill="var(--danger)">all four become tool_result with isError — the model gets a chance to fix it</text>
</svg>`;

const chapter: Chapter = {
  id: "c03",
  num: 3,
  layer: "model",
  title: "Tools",
  subtitle: "The interface between a model's intentions and your functions",
  blurb:
    "A tool is a name, a schema, a description and a function — and the description is the part that decides whether the agent works. Dispatch, validation, parallelism, truncation, and why every failure must come back as an observation.",
  lines: 289,
  file: "code/c03_tools.ts",
  tags: ["function calling", "tool schema", "dispatch", "parallel tools", "tool errors", "truncation", "affordance"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "Tools are the only way out of the box",
      html:
        p(`A model has exactly one output channel, and that is tokens. Reading a file, querying a database, sending an email, running a test: every one of those happens because your code recognised some of those tokens as a request and called a function. Tools are that recognition layer, and they are the entire surface through which an agent touches reality.`) +
        p(`That makes tool design the most valuable work in the whole course, and the most consistently underestimated. Teams spend a week tuning a system prompt and ten minutes writing tool descriptions, when the descriptions are read by the model on every single call and the system prompt is read once per turn alongside them. A precise tool description is worth more than a page of prompt engineering, because it arrives exactly where the decision is made.`) +
        note("key", "The reframe worth carrying", p(`You are not writing an API for a program. You are writing an <strong>affordance for a reader</strong> who is competent, fast, has never seen your codebase, cannot ask a follow-up question, and will confidently guess if you are vague. Every ambiguity you leave gets resolved by a guess, and you pay for the guess in a failed run.`)),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Four fields, and one of them is the program",
      html:
        code({
          title: "code/c03_tools.ts — the contract",
          src: `export interface Tool<I = unknown, O = unknown> {
  name: string;                       // stable, snake_case, verb_noun
  description: string;                // ← the model reads this. it is the prompt.
  input: Schema<I>;                   // from C02 — doubles as the JSON Schema
  run: (input: I, ctx: ToolContext) => Promise<O>;

  // Metadata your loop needs, that the model never sees:
  readOnly?: boolean;                 // safe to run in parallel, no approval (C16)
  idempotent?: boolean;               // safe to retry after a timeout (C12)
  timeoutMs?: number;
  maxResultTokens?: number;           // truncation budget
}

export interface ToolContext {
  signal: AbortSignal;                // cancellation propagates in
  log: (event: string, data?: unknown) => void;
  workingDir: string;
  callId: string;
}`,
        }) +
        p(`The split matters. <code>name / description / input</code> go to the model; the rest never does. <code>readOnly</code> is not a hint to the model, it is how your loop decides whether it can run five tools concurrently and whether ${ch("c16", "C16")} needs to interrupt a human.`) +
        `<h3>The description is a specification, and it has five jobs</h3>` +
        p(`Compare. Both are honest; one works.`) +
        code({
          title: "the difference between a 60% and a 95% selection rate",
          src: `// ✗ Describes the implementation.
description: "Searches the database."

// ✓ Describes the decision.
description: \`Search customer orders by order ID, email, or date range.

WHEN TO USE: the user mentions a specific order, asks about delivery status,
or asks "where is my …". Prefer this over search_knowledge_base for anything
about a concrete purchase.

WHEN NOT TO USE: for refund policy or shipping rules — use search_policy.
For orders older than 18 months — use search_archive; this tool returns
nothing for those rather than an error.

RETURNS: up to 20 orders, newest first, each with id, status, total,
placed_at, tracking_number (null until dispatched).

COST: about 300ms. Safe to call repeatedly.\``,
        }) +
        p(`Five jobs, in order of how often they are skipped:`) +
        ol([
          `<strong>What it does</strong> — everyone writes this one.`,
          `<strong>When to use it</strong> — the trigger conditions, in the user's vocabulary, not yours.`,
          `<strong>When <em>not</em> to use it, and what to use instead</strong> — this is what disambiguates similar tools, and it is the field that most improves selection accuracy in a crowded registry.`,
          `<strong>What comes back</strong> — shape, limits, and what "empty" means. Prevents the model treating zero results as an error and retrying forever.`,
          `<strong>What it costs</strong> — latency and side effects, so the model can budget.`,
        ]) +
        `<h3>Naming is selection</h3>` +
        p(`<code>search</code>, <code>query</code>, <code>find</code>, and <code>lookup</code> in the same registry guarantees confusion, because they are synonyms in English and the model is reading English. Use <code>verb_noun</code> and make the noun disjoint. Once you have <code>search_orders</code>, <code>search_policies</code> and <code>search_archive</code>, the tool name alone carries most of the routing signal.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "Dispatch, and the four failures",
      html:
        fig({
          label: "Diagram",
          title: "one tool call, end to end",
          body: DISPATCH_SVG,
          caption: `The bottom row is the part people leave out. An agent whose tool layer throws on bad input has converted a recoverable situation into a dead run.`,
        }) +
        `<h3>Errors are observations</h3>` +
        p(`This is the single most important implementation rule in the chapter, and it is three lines of code.`) +
        code({
          title: "the whole rule",
          src: `// ✗ Kills a run the model could have recovered from in one step.
const tool = registry[call.name];
if (!tool) throw new Error(\`unknown tool: \${call.name}\`);

// ✓ Hands the model what it needs to fix its own mistake.
const tool = registry[call.name];
if (!tool) {
  return toolResult(call.id, {
    isError: true,
    content: \`No tool named "\${call.name}". Available: \${Object.keys(registry).join(", ")}. \`
           + \`Did you mean "\${closest(call.name, Object.keys(registry))}"?\`,
  });
}`,
        }) +
        p(`The same shape applies to all four failure classes. The measured effect is large. Recoverable-error handling is routinely worth 10–20 points of end-to-end task success, and it costs one <code>try/catch</code> and a helpful string.`) +
        table(
          ["Failure", "What the observation must contain"],
          [
            ["Unknown tool name", "The real names, and the nearest match"],
            ["Invalid arguments", "The validator's paths — <code>.query: expected string, got null</code> (this is ${C02} paying off)"],
            ["Tool threw", "The message, and whether retrying could help"],
            ["Timed out", "How long it waited, and whether the effect may still land"],
            ["Empty result", "<b>Not an error.</b> <code>\"No orders matched. Broaden the date range or check the email.\"</code>"],
          ].map((r) => r.map((c) => c.replace("${C02}", `<a href="/c02/" class="mono">C02</a>`))) as string[][]
        ) +
        `<h3>Parallel where it is safe, sequential where it is not</h3>` +
        p(`Models routinely emit several <code>tool_use</code> blocks in one turn. Running them concurrently is usually a 3–5× latency win on read-heavy steps — and a corruption bug if two of them write.`) +
        code({
          title: "the readOnly flag earning its keep",
          src: `const calls = res.content.filter(isToolUse);
const [reads, writes] = partition(calls, (c) => registry[c.name]?.readOnly === true);

// Reads fan out. allSettled, not all: one failure must not discard four successes.
const readResults = await Promise.allSettled(reads.map(execute));

// Writes run in the order the model asked for, because order is semantics.
const writeResults: ToolResult[] = [];
for (const c of writes) writeResults.push(await execute(c));

// Results must be re-ordered to match the original call order before appending.
messages.push(userTurn(reorder(calls, [...readResults, ...writeResults])));`,
        }) +
        p(`Two traps in those eight lines. Use <code>Promise.allSettled</code> rather than <code>Promise.all</code>, because one rejected read should not throw away four good results, and each rejection becomes an error observation anyway. Then the re-ordering: many APIs require <code>tool_result</code> blocks in the same order as the <code>tool_use</code> blocks that requested them, and a mismatch is a 400 you will spend an hour on.`) +
        `<h3>Truncation, or the tool that ate the context</h3>` +
        p(`A tool that returns a 200 KB JSON blob does not cost you once; it costs you on <em>every subsequent turn</em> of the run (${ch("c01", "C01")}'s simulator makes this vivid). Cap every tool result, and make the truncation legible.`) +
        code({
          title: "truncate at the boundary, and say so",
          src: `function cap(text: string, maxTokens: number, tool: string): string {
  const max = maxTokens * 4;                    // rough chars-per-token
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.7));
  const tail = text.slice(-Math.floor(max * 0.2));
  return \`\${head}\\n\\n[... \${(text.length - max).toLocaleString()} chars omitted. \`
       + \`Narrow the query, or call \${tool} with a page/offset argument ...]\\n\\n\${tail}\`;
}`,
        }) +
        note("", "Head and tail, not head", p(`Truncating only the head hides the summary line, the total count and the closing bracket, which are exactly the parts that tell the model whether to paginate. Keeping both ends costs nothing and turns a dead end into a next step. And always tell the model <em>how</em> to get the rest; a truncation notice without a remedy just teaches it to give up.`)),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Watch a registry get too big",
      html:
        p(`Selection accuracy is not a constant. It degrades with the number of tools, with overlap between them, and with vague descriptions. Push the sliders until the agent starts picking the wrong tool, then fix it with description quality rather than by removing tools.`) +
        lab({
          label: "Simulator",
          title: "tool selection under load",
          body: `
<div class="controls">
  <div class="ctl"><label>tools in registry</label>
    <input type="range" id="t3-n" min="2" max="60" step="1" value="8"><span class="val" id="t3-n-v">8</span></div>
  <div class="ctl"><label>semantic overlap</label>
    <input type="range" id="t3-ov" min="0" max="100" step="5" value="30"><span class="val" id="t3-ov-v">30%</span></div>
  <div class="ctl"><label>description quality</label>
    <select id="t3-q">
      <option value="0">1 · "Searches the database."</option>
      <option value="1" selected>2 · what it does</option>
      <option value="2">3 · + when to use</option>
      <option value="3">4 · + when NOT to use, + returns</option>
    </select></div>
  <div class="ctl"><label>errors as observations</label>
    <select id="t3-err"><option value="0">throw (run dies)</option><option value="1" selected>feed back to model</option></select></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:.5rem">
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">correct tool chosen</div>
    <div class="meter"><i id="t3-sel" style="width:0%"></i></div><div class="mono small muted" id="t3-sel-v">—</div></div>
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">8-step task completes</div>
    <div class="meter"><i id="t3-task" style="width:0%;background:var(--tool)"></i></div><div class="mono small muted" id="t3-task-v">—</div></div>
</div>
<div class="stats">
  <div class="stat"><b id="t3-sch">—</b><span>schema tokens / call</span></div>
  <div class="stat"><b id="t3-cost">—</b><span>extra $ per 1k runs</span></div>
  <div class="stat"><b id="t3-rec">—</b><span>recovered mistakes</span></div>
</div>
<div class="note" id="t3-note" style="margin-top:1rem"></div>`,
          script: `
var n = document.getElementById("t3-n"), ov = document.getElementById("t3-ov"),
    q = document.getElementById("t3-q"), errm = document.getElementById("t3-err");
function upd() {
  var N = +n.value, OV = +ov.value / 100, Q = +q.value, E = errm.value === "1";
  n.nextElementSibling.textContent = N;
  ov.nextElementSibling.textContent = (OV * 100).toFixed(0) + "%";

  // base selection accuracy: falls with registry size, falls hard with overlap,
  // recovers with description quality (the "when NOT to use" tier matters most)
  var qualityGain = [0, 0.06, 0.11, 0.18][Q];
  var sizePenalty = Math.log2(Math.max(2, N)) * 0.035;
  var overlapPenalty = OV * (0.34 - qualityGain * 1.3);
  var acc = Math.max(0.25, Math.min(0.995, 0.99 - sizePenalty - overlapPenalty));

  // a wrong pick becomes an error observation the model can recover from
  var effective = E ? acc + (1 - acc) * 0.62 : acc;
  var task = Math.pow(effective, 8);

  document.getElementById("t3-sel").style.width = (acc * 100) + "%";
  document.getElementById("t3-sel-v").textContent = (acc * 100).toFixed(1) + "% first-pick accuracy"
    + (E ? " → " + (effective * 100).toFixed(1) + "% after recovery" : " (no recovery)");
  document.getElementById("t3-task").style.width = (task * 100) + "%";
  document.getElementById("t3-task-v").textContent = (task * 100).toFixed(1) + "% of 8-step runs pick correctly every time";

  var tok = N * [40, 95, 160, 240][Q];
  document.getElementById("t3-sch").textContent = tok.toLocaleString();
  document.getElementById("t3-cost").textContent = "$" + ((tok * 8 * 1000 * 3) / 1e6).toFixed(2);
  document.getElementById("t3-rec").textContent = E ? ((effective - acc) * 100).toFixed(1) + "%" : "0%";

  var note = document.getElementById("t3-note");
  if (N > 30 && acc < 0.8) note.innerHTML = "<b>Too many tools.</b> Past roughly 20–30 the registry itself is the problem. The fix is not better descriptions — it is <b>namespacing</b>: expose a small set of high-level tools and let a subagent (C17) or a two-stage selector own the long tail.";
  else if (OV > 0.5 && Q < 3) note.innerHTML = "<b>Overlap without disambiguation.</b> Your tools mean similar things and nothing tells the model which to prefer. Add the 'WHEN NOT TO USE — use X instead' clause; it is the single highest-yield line in a tool description.";
  else if (!E) note.innerHTML = "<b>Errors are throwing.</b> Every wrong pick kills the run instead of costing one step. Turn error-as-observation on and watch the 8-step completion bar move.";
  else note.innerHTML = "<b>Healthy.</b> Small registry, disjoint meanings, descriptions that say when not to use them, failures that come back as observations. Note the schema-token cost: quality tier 4 is worth it, and it is not free.";
}
[n, ov, q, errm].forEach(function (e) { e.addEventListener("input", upd); e.addEventListener("change", upd); });
upd();`,
          caption: `Set overlap to 70% and quality to tier 2, then move quality to tier 4 without touching anything else. That jump is the "when NOT to use" clause. Then set tools to 50 and observe that no description quality rescues it — that is the threshold where ${ch("c17", "C17")}'s subagents stop being architecture astronautics and start being necessary.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "The registry",
      html:
        code({
          title: "code/c03_tools.ts — execute, with every guard in place",
          src: `export async function executeTool(
  registry: Record<string, Tool>, call: ToolUse, ctx: Omit<ToolContext, "signal" | "callId">,
): Promise<ToolResult> {
  const t0 = Date.now();
  const fail = (content: string) => ({ id: call.id, isError: true, content, ms: Date.now() - t0 });

  // 1. Unknown name → observation naming the alternatives.
  const tool = registry[call.name];
  if (!tool) {
    const names = Object.keys(registry);
    return fail(\`No tool named "\${call.name}". Available: \${names.join(", ")}.\` +
                (closest(call.name, names) ? \` Did you mean "\${closest(call.name, names)}"?\` : ""));
  }

  // 2. Arguments validated against the same schema the model was shown.
  const parsed = tool.input.validate(call.input);
  if (!parsed.ok) {
    return fail(\`Invalid arguments for \${call.name}:\\n\` +
      parsed.issues.map((i) => \`  \${i.path}: expected \${i.expected}, got \${i.got}\`).join("\\n"));
  }

  // 3. Timeout that actually cancels, composed with the run deadline.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), tool.timeoutMs ?? 30_000);

  try {
    const out = await tool.run(parsed.value, { ...ctx, signal: ctrl.signal, callId: call.id });
    const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
    return {
      id: call.id,
      content: cap(text, tool.maxResultTokens ?? 4_000, tool.name),
      ms: Date.now() - t0,
    };
  } catch (e) {
    if (ctrl.signal.aborted) {
      // Say whether the side effect may still be in flight — the model's next
      // move depends entirely on that.
      return fail(\`\${call.name} timed out after \${tool.timeoutMs ?? 30_000}ms. \` +
        (tool.idempotent ? "Safe to retry." : "The operation may still have taken effect; verify before retrying."));
    }
    return fail(\`\${call.name} failed: \${(e as Error).message}\`);
  } finally {
    clearTimeout(timer);
  }
}`,
        }) +
        p(`Every branch returns a <code>ToolResult</code>. Nothing throws past this function, which is what lets the loop in ${ch("c04", "C04")} stay four lines long.`) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c03_tools.ts

#   C03 · Tools — every failure path is an observation
#
#   ✓ parallel search_orders       303ms  Order 4471: delivered, €340, placed 2024-01-28, category electronics, tracking 1Z99A
#   ✓ parallel search_policies     281ms  Returns Policy § 3 (Electronics): standard window is 30 days; electronics 14 days unless a fault
#   ✓ parallel get_support_tickets   312ms  #882 · 2024-02-05 · "screen flickers" · open
#     → 3 reads in 313ms (sequential would be ~896ms)
#
#   ✗ unknown tool name              1ms  No tool named "search_ordrs". Available: search_orders, search_policies, get_support_tickets, ge
#   ✗ invalid arguments              0ms  Invalid arguments for search_orders:
#   ✗ timeout (idempotent)         402ms  generate_report timed out after 400ms. It is read-only, so retrying is safe.
#   ✗ timeout (NOT idempotent)     302ms  send_email timed out after 300ms. This operation is NOT idempotent — it may still have taken eff
#   ✓ 180KB result                  19ms  truncated to 837 chars with a pagination hint
#
#   the two messages that matter most:
#
#     No tool named "search_ordrs". Available: search_orders, search_policies, get_support_tickets, generate_report, send_email, list_files. Did you mean "search_orders"?
#     Invalid arguments for send_email:
#       .subject: expected string, got missing
#       .body: expected string, got missing
#
#   Nothing above threw. The loop in C04 stays four lines because of that.`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Field notes",
      html:
        ul([
          `<strong>Tool schemas are billed every turn.</strong> Forty tools at 240 tokens each is 9,600 tokens on every single call. With prompt caching that is cheap; without it, it can be most of your bill. Measure it. It is the most commonly missed line item in agent cost models.`,
          `<strong>Do not expose your REST API as tools.</strong> An API is designed for a programmer with documentation and a debugger. A tool surface is designed for a reader with one shot. Collapse <code>GET /orders</code> + <code>GET /orders/:id</code> + <code>GET /orders/:id/tracking</code> into one <code>get_order_status</code> that returns what a human actually wanted to know. Fewer, richer, task-shaped tools beat a faithful mapping every time.`,
          `<strong>Return natural language, not just JSON.</strong> A tool result of <code>{"status":"D","eta_d":2}</code> makes the model guess. <code>"Dispatched 2 days ago, expected delivery Thursday 14 March (tracking 1Z…)."</code> does not. The token cost is similar and the accuracy difference is not.`,
          `<strong>Anthropic's tool-use guidance, OpenAI's function-calling guide, and the MCP spec</strong> all converge on the same advice this chapter gives, which is reassuring: descriptive names, explicit "when not to use", rich returns, errors as content rather than exceptions. ${ch("c15", "C15")} is what happens when you standardise the wire format for all of this.`,
          `<strong>Where to read real code:</strong> AutoGen's <code>FunctionTool</code> derives the schema from a Python signature and docstring; the OpenAI Agents SDK does the same from a decorated function; the Claude Agent SDK ships a filesystem and shell tool set worth studying as a design, especially the parts where they chose <em>not</em> to expose a primitive.`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `Rewrite these three descriptions so a model can route between them reliably: <code>search</code> — "Searches.", <code>query</code> — "Queries the DB.", <code>lookup</code> — "Looks things up."`,
      answer:
        p(`Start by renaming, because the names are doing the damage. Three synonyms cannot be disambiguated by any description.`) +
        code({
          title: "disjoint names, then disjoint descriptions",
          src: `search_orders:
  "Find a customer's orders by order ID, email, or date range.
   USE WHEN: the user asks about a specific purchase, delivery or refund status.
   NOT FOR: policy questions (search_policies) or orders over 18 months old (search_archive).
   RETURNS: up to 20 orders newest-first; empty list if none match — that is not an error."

search_policies:
  "Full-text search over shipping, returns and warranty policy documents.
   USE WHEN: the user asks what the rules are, rather than what happened to their order.
   NOT FOR: anything about a specific order (search_orders).
   RETURNS: up to 5 passages with document title and section anchor."

search_archive:
  "Search orders older than 18 months. Slower (about 4s) and returns less detail.
   USE WHEN: search_orders returned nothing and the user says the order is old.
   RETURNS: id, date, total, status only — no line items, no tracking."`,
        }) +
        p(`Note that <code>search_archive</code>'s "use when" references another tool's <em>outcome</em>. Encoding the fallback ordering in the descriptions is how you get a sensible retry sequence without writing any orchestration code.`),
    },
    {
      difficulty: "core",
      prompt: `Your agent calls <code>send_email</code>, the call times out after 30 seconds, and the tool is not idempotent. Write the observation the model should receive, and explain why a retry is the wrong default.`,
      answer:
        code({
          title: "the observation",
          src: `send_email timed out after 30000ms. The message may or may not have been sent —
this operation is not idempotent, so retrying risks sending it twice.

Before retrying, call list_sent_messages with to="alice@example.com" and
since="2024-03-14T10:31:00Z" to check whether it went out.`,
        }) +
        p(`A timeout is <em>not</em> a failure. It is the absence of information about whether a side effect occurred. Treating it as failure and retrying converts an unknown into a duplicate, and for emails, payments or ticket creation a duplicate is a worse outcome than no action at all.`) +
        p(`Three design consequences: (1) mark every tool <code>idempotent</code> or not, because the timeout message depends on it; (2) for any non-idempotent tool, ship a companion read tool that lets the agent check; (3) better still, make the tool idempotent with a client-supplied key — <code>send_email(idempotency_key: callId)</code> — and the whole class of problem disappears. ${ch("c12", "C12")} generalises this.`),
    },
    {
      difficulty: "core",
      prompt: `Implement parallel tool execution that is safe: reads concurrent, writes serialised in order, one failure not discarding the others, and results in the order the API expects. Name the two bugs most people ship.`,
      answer:
        code({
          title: "the safe version",
          src: `async function runAll(calls: ToolUse[], reg: Record<string, Tool>, ctx: Ctx): Promise<ToolResult[]> {
  const byId = new Map<string, ToolResult>();

  const isRead = (c: ToolUse) => reg[c.name]?.readOnly === true;
  const reads = calls.filter(isRead);
  const writes = calls.filter((c) => !isRead(c));

  // BUG 1 avoided: allSettled, not all. One rejection must not bin four successes.
  const settled = await Promise.allSettled(reads.map((c) => executeTool(reg, c, ctx)));
  settled.forEach((s, i) => byId.set(reads[i].id,
    s.status === "fulfilled" ? s.value
      : { id: reads[i].id, isError: true, content: String(s.reason) }));

  // Writes are sequential: the model asked for this order and order is meaning.
  for (const c of writes) byId.set(c.id, await executeTool(reg, c, ctx));

  // BUG 2 avoided: results must come back in the ORIGINAL call order.
  return calls.map((c) => byId.get(c.id)!);
}`,
        }) +
        ul([
          `<strong>Bug 1 — <code>Promise.all</code>.</strong> A single rejected read throws away every sibling result, so the model loses four good observations and repeats four calls. <code>allSettled</code> plus error-as-observation keeps all of it.`,
          `<strong>Bug 2 — returning results in completion order.</strong> Most APIs require <code>tool_result</code> blocks to match the order of the <code>tool_use</code> blocks. Fast tools finish first, so a map-by-id and a final re-order is mandatory. The symptom is an intermittent 400 that only appears under real latency variance, which is to say, only in production.`,
        ]) +
        p(`A third, subtler issue: <code>readOnly</code> must be true only if the tool is read-only <em>with respect to everything the other parallel calls touch</em>. A "read" that writes an audit log row is fine; a "read" that populates a cache other tools mutate is not.`),
    },
    {
      difficulty: "stretch",
      prompt: `You have 60 tools across six services. Selection accuracy has collapsed. Design a fix that keeps all 60 capabilities available. Compare at least three approaches and pick one.`,
      answer:
        table(
          ["Approach", "How", "Cost", "Verdict"],
          [
            ["<b>Namespaced facades</b>", "Expose 6 coarse tools (<code>orders.*</code>, <code>billing.*</code>); each takes an <code>operation</code> enum plus args, and returns its own sub-schema on an invalid operation", "One extra round trip when the model guesses the operation wrong", "Good — keeps everything in one context, cuts schema tokens ~80%"],
            ["<b>Two-stage selection</b>", "A cheap model picks the 5 relevant tools from a catalogue, then the real call is made with only those in the schema", "+1 small call per turn, and a new failure mode when stage 1 mis-selects", "Good when the catalogue is dynamic or user-specific"],
            ["<b>Subagents</b>", "One specialist per service, each with 10 tools; the orchestrator sees 6 <em>agent</em> tools (C17)", "Context isolation is a feature and a bug — the orchestrator loses detail", "Best when the services are genuinely independent workstreams"],
            ["<b>Retrieval over tools</b>", "Embed descriptions, inject top-k per turn", "Non-determinism in the tool surface itself; very hard to eval", "Avoid unless the catalogue is thousands"],
          ]
        ) +
        p(`<strong>Pick: namespaced facades first.</strong> It is the least architecture for the most benefit, it is trivially testable, and it preserves a single linear trace. That matters more than it sounds, because ${ch("c20", "C20")} debugging across a subagent boundary is genuinely harder.`) +
        p(`Escalate to subagents only when a service's work is long enough that its intermediate observations are polluting the main context. That is the real trigger for multi-agent, and it is a <em>context</em> argument, not an organisational one.`),
    },
  ],

  qa: [
    { q: "How many tools is too many?", a: p(`Accuracy degrades gently to about 15–20 tools and then sharply, and the degradation is driven far more by semantic overlap than by raw count. Twenty disjoint tools outperform eight confusable ones. If you are past 20, the question is not "how do I describe these better" but "which four coarse tools would cover 90% of the work".`) },
    { q: "Should the model see my internal IDs?", a: p(`Yes. Models handle opaque identifiers fine and round-trip them accurately. What they cannot do is <em>invent</em> a valid one, so any tool taking an ID must be reachable from a tool that returns IDs. A registry where <code>get_order(id)</code> exists but nothing produces an order ID is a dead end that looks like a capable agent.`) },
    { q: "Should tools return JSON or prose?", a: p(`Prose with structure. JSON for anything the model needs to quote back exactly (IDs, paths, amounts), prose for anything it needs to reason about. The worst option is minified JSON with abbreviated keys — you save 40 tokens and buy a misinterpretation. See the Codex and Claude Code file tools: their output is deliberately human-shaped.`) },
    { q: "Do I need a description if the tool name is obvious?", a: p(`Yes, because "obvious" is doing a lot of work there. <code>get_user</code> — by ID or email? Which fields? What about deleted users? Does it throw or return null? Every one of those is a guess the model will make, and it will make a different one on Tuesday.`) },
    { q: "Can tools call other tools?", a: p(`They can, and it is usually the right move for a fixed sub-sequence: if the model always calls <code>find_file</code> then <code>read_file</code>, make one tool that does both. You are converting agency into a workflow exactly where agency was buying nothing, which is ${ch("c11", "C11")}'s whole argument. Keep the composite's description honest about what it does internally.`) },
  ],

  project: {
    title: "Project · A tool registry with teeth",
    brief:
      p(`Build the registry the rest of the course uses, with at least five tools over a small fake domain (orders, policies, an archive, a write action, and one deliberately slow tool). The interesting part is not the tools. It is proving the failure paths behave.`),
    spec: [
      "<code>defineTool()</code> with name, description, C02 schema, run function, and the <code>readOnly</code> / <code>idempotent</code> / <code>timeoutMs</code> / <code>maxResultTokens</code> metadata.",
      "<code>executeTool()</code> never throws: unknown name, invalid args, thrown error and timeout all return <code>ToolResult</code> with <code>isError</code> and an actionable message.",
      "Unknown-name errors include a nearest-match suggestion (Levenshtein is twenty lines).",
      "Parallel execution: reads via <code>allSettled</code>, writes serialised, results re-ordered to match call order.",
      "Every result truncated head-and-tail with an explicit pagination hint.",
      "A test for each of the four failure paths asserting the agent recovers in exactly one extra step.",
    ],
    stretch: [
      "Add an idempotency key to the write tool and prove a duplicate call is a no-op.",
      "Instrument each tool with call count, p50/p99 latency, error rate and <em>result tokens</em>, then rank tools by tokens-caused (result size × turns remaining). The winner is usually a surprise.",
      "Add a <code>dryRun</code> mode where write tools describe what they would do instead of doing it — the foundation of C16's approval UI.",
    ],
  },

  quiz: [
    {
      q: "Which part of a tool definition most improves selection accuracy in a registry with overlapping tools?",
      options: [
        "An explicit 'when NOT to use this — use X instead' clause",
        "A longer description of the implementation",
        "A more precise JSON Schema for the arguments",
        "A lower temperature on the model call",
      ],
      answer: 0,
      why: "Overlap is a disambiguation problem, and negative guidance disambiguates far more efficiently than more positive description. The schema constrains arguments once a tool is chosen; it does nothing for the choice itself.",
    },
    {
      q: "The model requests a tool that does not exist. The best behaviour is to:",
      options: [
        "Return a tool_result with isError, naming the available tools and the nearest match",
        "Throw, so the bug surfaces immediately",
        "Silently fuzzy-match to the closest tool and run it",
        "Re-call the model with the same messages",
      ],
      answer: 0,
      why: "The loop exists so the model can correct itself from observations. Throwing discards a run that was one step from recovery. Silent fuzzy-matching is worse than both: it hides the signal that your names are confusable, and it will eventually run the wrong tool.",
    },
    {
      q: "Why must parallel tool results be re-ordered before being appended to the message array?",
      options: [
        "Most APIs require tool_result blocks in the same order as the tool_use blocks that requested them",
        "The model reads only the first result",
        "Out-of-order results cost more tokens",
        "It keeps the trace readable for humans",
      ],
      answer: 0,
      why: "Fast tools settle first, so completion order and call order differ under real latency. The mismatch produces an intermittent 400 that appears only in production. Map results by call id and emit them in the original order.",
    },
    {
      q: "A non-idempotent tool times out. What should the observation say?",
      options: [
        "That it timed out, that the effect may still have occurred, and which read tool to call to check before retrying",
        "That the operation failed and should be retried",
        "Nothing — suppress it and retry automatically",
        "That the tool is broken and should not be used again",
      ],
      answer: 0,
      why: "A timeout is the absence of information, not a failure. Retrying a non-idempotent operation converts an unknown into a duplicate charge, a duplicate email, a duplicate ticket. Give the agent a way to check, or make the tool idempotent with a client-supplied key.",
    },
    {
      q: "A tool returns 180 KB of JSON. What is the real cost to the run?",
      options: [
        "It is re-sent as input on every subsequent turn, so its cost multiplies by the number of turns remaining",
        "One-off: roughly 45,000 input tokens, once",
        "Nothing, if the context window is large enough",
        "Only the output tokens the model spends summarising it",
      ],
      answer: 0,
      why: "The message array is resent whole each iteration. A big observation at turn 3 of a 12-turn run is billed nine more times. When attributing cost to tools, multiply result size by turns remaining — that is what turns 'a bit verbose' into 'most of the bill'.",
    },
    {
      q: "You have 60 tools and selection accuracy has collapsed. What is the first thing to try?",
      options: [
        "Collapse them into a handful of namespaced facade tools that take an operation enum",
        "Add more detail to all 60 descriptions",
        "Switch to a larger model",
        "Embed the descriptions and retrieve the top-k per turn",
      ],
      answer: 0,
      why: "Past roughly 20–30 tools the registry itself is the problem and no amount of description quality rescues it. Facades cut schema tokens dramatically, keep everything in one linear trace, and are trivially testable. Retrieval over tools makes the tool surface itself nondeterministic, which is very hard to evaluate.",
    },
  ],

  continues:
    p(`You now have a typed model call, a typed output, and a registry of functions that never throws. Those are all the parts. ${ch("c04", "C04")} puts them in a loop, and that loop — about 120 lines — is a working agent that you will carry through every remaining chapter of the course.`),
};

export default chapter;
