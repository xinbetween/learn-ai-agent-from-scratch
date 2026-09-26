import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const REQ_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Anatomy of one model call: messages in, one response out, nothing retained">
  <defs><marker id="m1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
    <marker id="m1a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="20" class="d-label">EVERY CALL IS A FRESH START — YOU RESEND THE WORLD</text>

  <rect x="14" y="36" width="240" height="180" rx="8" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="56" class="d-label" fill="var(--fg-faint)">REQUEST (yours, every time)</text>

  <rect x="26" y="66" width="216" height="26" rx="4" class="d-box-m"/>
  <text x="36" y="84" class="d-mono">system · who it is, what it may do</text>

  <rect x="26" y="98" width="216" height="26" rx="4" class="d-box"/>
  <text x="36" y="116" class="d-mono">user · the goal</text>

  <rect x="26" y="130" width="216" height="26" rx="4" class="d-box-a"/>
  <text x="36" y="148" class="d-mono">assistant · what it said before</text>

  <rect x="26" y="162" width="216" height="26" rx="4" class="d-box-t"/>
  <text x="36" y="180" class="d-mono">tool · what the world answered</text>

  <text x="26" y="206" class="d-mono" fill="var(--fg-faint)">+ tools[] + temperature + max_tokens</text>

  <path d="M258 126 L318 126" class="d-arrow" marker-end="url(#m1)"/>
  <text x="288" y="118" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">POST</text>

  <rect x="322" y="70" width="150" height="112" rx="8" class="d-box-a"/>
  <text x="397" y="102" class="d-text" text-anchor="middle">the model</text>
  <text x="397" y="122" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">request-scoped</text>
  <text x="397" y="140" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">function of</text>
  <text x="397" y="158" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">the request</text>

  <path d="M476 126 L536 126" class="d-arrow-a" marker-end="url(#m1a)"/>

  <rect x="540" y="60" width="148" height="132" rx="8" class="d-box" stroke-dasharray="3 3"/>
  <text x="552" y="80" class="d-label" fill="var(--fg-faint)">RESPONSE</text>
  <rect x="550" y="88" width="128" height="24" rx="4" class="d-box-a"/>
  <text x="560" y="105" class="d-mono">content blocks</text>
  <rect x="550" y="118" width="128" height="24" rx="4" class="d-box"/>
  <text x="560" y="135" class="d-mono">stop_reason</text>
  <rect x="550" y="148" width="128" height="24" rx="4" class="d-box"/>
  <text x="560" y="165" class="d-mono">usage {in,out}</text>

  <path d="M614 196 L614 250 L120 250 L120 222" class="d-arrow" marker-end="url(#m1)" stroke-dasharray="4 3"/>
  <text x="380" y="244" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">you append it and resend — the model retains nothing</text>

  <text x="14" y="288" class="d-mono" fill="var(--accent)">cost(turn N) ∝ Σ tokens(turns 1..N) — the reason C05 exists</text>
</svg>`;

const chapter: Chapter = {
  id: "c01",
  num: 1,
  layer: "model",
  title: "The Model Call",
  subtitle: "Messages, stop reasons, tokens, and the one function everything else is built on",
  blurb:
    "This course treats a model call as a request-scoped function from a message array to a response. Its signature has to carry streaming, retries, usage accounting and cancellation, and getting that right decides how pleasant the next twenty-three chapters are.",
  lines: 395,
  file: "code/c01_model_call.ts",
  tags: ["messages", "roles", "stop_reason", "tokens", "temperature", "streaming", "retries", "cost"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "The primitive you will call ten thousand times",
      html:
        p(`${ch("c00", "C00")} wrote <code>await model(messages, tools)</code> and moved on. That was a convenient lie. Every token, every millisecond and every transient failure enters your agent through that one call, which makes its signature load-bearing. Return a string and you can't see usage. Skip cancellation and you can't set a deadline. Throw on rate limits and the agent dies at the moment it's most useful.`) +
        p(`So build it once, deliberately. Eight lines of type definitions here will save you four refactors later, because every abstraction in this course is a wrapper around this function: tools, memory, planning, subagents, evals.`) +
        note(
          "key",
          "The property that shapes everything",
          p(`<strong>Make the request contract stateless.</strong> This course sends the model the context it needs on each call, so the application—not an opaque server-side session—owns the conversation state. Some providers offer stored conversations or server-side state, but you still need to account for the context the model processes and retain enough state to resume, audit and edit a run.`)
        ),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "One typed function, and what each field buys you",
      html:
        p(`Here is the interface the rest of the course imports. Read it as a list of decisions, because that is what it is.`) +
        code({
          title: "code/c01_model_call.ts — the contract",
          src: `export type Role = "system" | "user" | "assistant" | "tool";

export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; content: string; isError?: boolean };

export interface Message { role: Role; content: string | Block[]; }

export interface Usage { input: number; output: number; cacheRead?: number; cacheWrite?: number; }

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal";

export interface ModelResponse {
  content: Block[];          // may hold text AND tool_use in the same turn
  stopReason: StopReason;    // why it stopped — not a detail, a control signal
  usage: Usage;              // what it cost, per call, always
  model: string;             // which model actually served it
  latencyMs: number;
}

export interface CallOptions {
  system?: string;
  tools?: ToolSchema[];
  temperature?: number;      // 0 for decisions, higher for prose
  maxTokens?: number;
  signal?: AbortSignal;      // cancellation is not optional
  onDelta?: (text: string) => void;  // streaming, if you want it
}

export type Model = (messages: Message[], opts?: CallOptions) => Promise<ModelResponse>;`,
        }) +
        `<h3>Content is blocks, not a string</h3>` +
        p(`The most common early mistake is typing content as <code>string</code>. A modern assistant turn can contain reasoning text <em>and</em> two tool calls at once, and a user turn can carry several tool results. Flatten that to a string and you lose the ability to run tools in parallel (${ch("c03", "C03")}), to pair a result with the call that requested it, and to strip reasoning when compacting (${ch("c05", "C05")}). Blocks cost one type definition now and save a rewrite later.`) +
        `<h3><code>stopReason</code> is control flow, not telemetry</h3>` +
        p(`Your loop branches on it:`) +
        table(
          ["stopReason", "Means", "Your loop does"],
          [
            ["<code>end_turn</code>", "The model is finished speaking", "Return the answer"],
            ["<code>tool_use</code>", "It wants observations before continuing", "Run the tools, append results, iterate"],
            ["<code>max_tokens</code>", "It was cut off mid-thought", "Continue, or fail loudly — <b>never</b> treat as an answer"],
            ["<code>stop_sequence</code>", "It hit a delimiter you supplied", "Parse whatever framing you designed"],
            ["<code>refusal</code>", "It declined", "Surface it; do not retry identically"],
          ]
        ) +
        p(`The dangerous one is <code>max_tokens</code>. A truncated response is syntactically a normal response. It has text, it parses, it looks like an answer. Agents that never check this field act on half a plan and say nothing about it. Assert on it.`) +
        `<h3><code>usage</code> on every call, or you are flying blind</h3>` +
        p(`Not a counter you check at the end, but a field on every response that your loop accumulates. Agent cost is dominated by <em>re-sent input tokens</em>, and you cannot see that unless input and output are counted separately. Once you have this field, ${ch("c20", "C20")}'s observability is fifteen lines instead of an archaeology project.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "What a call actually contains",
      html:
        fig({
          label: "Diagram",
          title: "one request, one response, no memory",
          body: REQ_SVG,
          caption:
            `In this course, the dashed return path is the memory: your application appends the response to its array. Retaining full history makes the request grow each turn and input work grow roughly quadratically; compaction and caching change that trade-off, not the need to manage it.`,
        }) +
        `<h3>The four roles, and what each is for</h3>` +
        ul([
          `<strong>system</strong> — identity, constraints, tool policy, output format. Sent on every call, so every token here is paid for on every iteration. Treat it as expensive. Almost nobody does.`,
          `<strong>user</strong> — the goal, and later, human interjections. In an agent most "user" turns after the first are actually tool results wearing the user role, depending on the API.`,
          `<strong>assistant</strong> — everything the model said, including its tool requests. You must echo these back verbatim: dropping a <code>tool_use</code> block while keeping its result produces an orphaned result, which most APIs reject outright.`,
          `<strong>tool</strong> — observations. This is the channel through which reality enters the model's world, which makes it the channel an attacker comes in through too (${ch("c21", "C21")}).`,
        ]) +
        `<h3>Temperature: two settings, not a dial to fiddle with</h3>` +
        p(`Temperature scales the logits before sampling. In practice an agent has two useful settings for it:`) +
        ul([
          `<strong>0 (or near) for decisions</strong> — which tool, which branch, which classification, any structured output. You want the argmax, and you want reruns to be comparable when you are debugging.`,
          `<strong>0.7–1.0 for prose</strong> — the final written answer, brainstorming, anything where sameness reads as robotic.`,
        ]) +
        note(
          "warn",
          "Temperature 0 is not determinism",
          p(`Identical input at temperature 0 still varies run to run. Floating-point non-associativity in batched GPU kernels, MoE routing that depends on which other requests share your batch, silent model updates behind a version alias, load balancing across replicas that were not configured identically. Expect <em>high agreement</em> rather than reproducibility, and treat any eval that assumes byte-identical output (${ch("c19", "C19")}) as built on sand.`)
        ),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Watch the request grow and the bill compound",
      html:
        p(`The simulator runs an agent turn by turn. Nothing is generated; the point is purely accounting. Step it forward and watch the input-token column, which is the number almost everyone forgets when estimating what an agent costs.`) +
        lab({
          label: "Simulator",
          title: "token accounting across a run",
          body: `
<div class="controls">
  <div class="ctl"><label>system prompt</label>
    <input type="range" id="m1-sys" min="200" max="6000" step="100" value="1200">
    <span class="val" id="m1-sys-v">1,200 tok</span></div>
  <div class="ctl"><label>tool defs</label>
    <input type="range" id="m1-tools" min="0" max="12" step="1" value="5">
    <span class="val" id="m1-tools-v">5 tools · 900 tok</span></div>
  <div class="ctl"><label>avg tool result</label>
    <input type="range" id="m1-obs" min="50" max="4000" step="50" value="600">
    <span class="val" id="m1-obs-v">600 tok</span></div>
  <div class="ctl"><label>prompt caching</label>
    <select id="m1-cache"><option value="0">off</option><option value="1" selected>on (system + tools)</option></select></div>
  <div class="ctl"><label>&nbsp;</label><div class="btn-row">
    <button class="btn" id="m1-step" type="button">step ▸</button>
    <button class="btn primary" id="m1-run" type="button">▶ run 12 turns</button>
    <button class="btn" id="m1-reset" type="button">↺ reset</button></div></div>
</div>
<div style="margin:.5rem 0 .75rem"><div class="ctxstrip" id="m1-strip"></div></div>
<div>
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">input tokens billed per turn (orange) vs output (teal)</div>
  <div class="bars" id="m1-bars"></div>
</div>
<div class="stats">
  <div class="stat"><b id="m1-turn">0</b><span>turns</span></div>
  <div class="stat"><b id="m1-in">0</b><span>input tokens billed</span></div>
  <div class="stat"><b id="m1-out">0</b><span>output tokens</span></div>
  <div class="stat"><b id="m1-ratio">—</b><span>input : output</span></div>
  <div class="stat"><b id="m1-cost">$0.00</b><span>at $3/$15 per Mtok</span></div>
</div>`,
          script: `
var sys = document.getElementById("m1-sys"), tools = document.getElementById("m1-tools"),
    obs = document.getElementById("m1-obs"), cache = document.getElementById("m1-cache");
var turns = [], ctx = 0;

function fixed() { return +sys.value + (+tools.value) * 180; }
function labels() {
  sys.nextElementSibling.textContent = (+sys.value).toLocaleString() + " tok";
  tools.nextElementSibling.textContent = tools.value + " tools · " + ((+tools.value) * 180).toLocaleString() + " tok";
  obs.nextElementSibling.textContent = (+obs.value).toLocaleString() + " tok";
}
function reset() { turns = []; ctx = 0; draw(); }
function step() {
  var out = 90 + Math.round((+obs.value) * 0.05);      // model's turn: a short tool request
  var grow = out + (+obs.value);                        // + the observation that comes back
  var billedIn = fixed() + ctx;
  var cached = cache.value === "1" ? fixed() : 0;
  turns.push({ inTok: billedIn, cached: cached, out: out });
  ctx += grow;
  draw();
}
function draw() {
  labels();
  var totIn = 0, totOut = 0, totCost = 0;
  turns.forEach(function (t) {
    totIn += t.inTok; totOut += t.out;
    // cached input billed at 10%
    totCost += ((t.inTok - t.cached) * 3 + t.cached * 0.3) / 1e6 + (t.out * 15) / 1e6;
  });
  document.getElementById("m1-turn").textContent = turns.length;
  document.getElementById("m1-in").textContent = totIn.toLocaleString();
  document.getElementById("m1-out").textContent = totOut.toLocaleString();
  document.getElementById("m1-ratio").textContent = totOut ? (totIn / totOut).toFixed(0) + " : 1" : "—";
  document.getElementById("m1-cost").textContent = "$" + totCost.toFixed(3);

  var mx = Math.max.apply(null, turns.map(function (t) { return t.inTok; }).concat([1]));
  document.getElementById("m1-bars").innerHTML = turns.map(function (t, i) {
    return '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px">' +
      '<div class="bar alt" style="height:' + Math.max(2, (t.out / mx) * 100) + '%" title="turn ' + (i + 1) + ' output ' + t.out + '"></div>' +
      '<div class="bar" style="height:' + Math.max(2, (t.inTok / mx) * 100) + '%" title="turn ' + (i + 1) + ' input ' + t.inTok.toLocaleString() + '"></div></div>';
  }).join("") || '<span class="small muted">press step</span>';

  var strip = ['<span class="tok sys">system ' + fixed().toLocaleString() + '</span>', '<span class="tok usr">goal</span>'];
  for (var i = 0; i < turns.length; i++) {
    strip.push('<span class="tok">assistant</span>');
    strip.push('<span class="tok tool">tool_result +' + (+obs.value) + '</span>');
  }
  document.getElementById("m1-strip").innerHTML = strip.join("");
}
[sys, tools, obs, cache].forEach(function (e) { e.addEventListener("input", function () { reset(); }); });
document.getElementById("m1-step").addEventListener("click", step);
document.getElementById("m1-reset").addEventListener("click", reset);
document.getElementById("m1-run").addEventListener("click", function () { reset(); for (var i = 0; i < 12; i++) step(); });
reset();`,
          caption:
            `Three things worth discovering here. (1) The input:output ratio settles somewhere between 20:1 and 60:1 — agents are an <em>input-token</em> workload, which is the opposite of chat. (2) Turning prompt caching off roughly triples the bill on a 12-turn run with a big system prompt. (3) Push "avg tool result" to 4,000 and watch the bars: a chatty tool is the single most expensive mistake in ${ch("c03", "C03")}.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "The client: retries, timeouts, streaming, accounting",
      html:
        p(`A production model client is mostly error handling. The three things below are not optional extras. An agent without them fails on its first bad afternoon.`) +
        code({
          title: "code/c01_model_call.ts — retry with jitter and a hard deadline",
          src: `const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

export async function callModel(
  messages: Message[],
  opts: CallOptions = {},
  cfg = { maxAttempts: 5, baseMs: 500, capMs: 20_000 },
): Promise<ModelResponse> {
  let attempt = 0;
  for (;;) {
    attempt++;
    const started = Date.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": KEY },
        body: JSON.stringify(toWire(messages, opts)),
        signal: opts.signal,          // caller's deadline wins
      });

      if (!res.ok) {
        if (!RETRYABLE.has(res.status) || attempt >= cfg.maxAttempts) {
          throw new ModelError(res.status, await res.text());
        }
        // Honour the server's own advice before falling back to our backoff.
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await sleep(retryAfter || backoff(attempt, cfg), opts.signal);
        continue;
      }

      return fromWire(await res.json(), Date.now() - started);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;   // never retry a cancel
      if (attempt >= cfg.maxAttempts) throw err;
      await sleep(backoff(attempt, cfg), opts.signal);
    }
  }
}

// Full jitter: without the random factor, every client in your fleet retries
// in lockstep and re-creates the overload that caused the 429.
const backoff = (n: number, cfg: { baseMs: number; capMs: number }) =>
  Math.random() * Math.min(cfg.capMs, cfg.baseMs * 2 ** (n - 1));`,
        }) +
        p(`Three details that are easy to get wrong:`) +
        ul([
          `<strong>Never retry an <code>AbortError</code>.</strong> The caller cancelled; retrying is the client arguing with its own deadline. This bug is invisible until you build ${ch("c16", "C16")}'s interrupt handling and discover cancelled runs cost money for another minute.`,
          `<strong>Respect <code>retry-after</code> before your own backoff.</strong> The server knows when it will be ready and you do not.`,
          `<strong>Full jitter, not "exponential backoff".</strong> Deterministic backoff synchronises your fleet into retry waves that reproduce the outage. Multiply by <code>Math.random()</code> and the thundering herd disappears.`,
        ]) +
        `<h3>Streaming, without letting it infect your types</h3>` +
        p(`Streaming is a delivery detail. Keep it that way: stream internally, resolve to the same <code>ModelResponse</code>, and expose partial text through a callback. Your agent loop then never has two code paths.`) +
        code({
          title: "streaming that still returns one typed value",
          src: `export async function callModelStream(
  messages: Message[], opts: CallOptions = {},
): Promise<ModelResponse> {
  const res = await fetch(ENDPOINT, { /* …, stream: true */ });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();

  const acc = new BlockAccumulator();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    // SSE frames are separated by a blank line; a frame can arrive split.
    const frames = buf.split("\\n\\n");
    buf = frames.pop() ?? "";
    for (const f of frames) {
      const ev = parseSSE(f);
      if (ev?.type === "text_delta") opts.onDelta?.(ev.text);
      acc.apply(ev);
    }
  }
  return acc.finish();   // same ModelResponse shape as the non-streaming path
}`,
        }) +
        note(
          "bad",
          "The bug everyone ships once",
          p(`<code>buf.split("\\n\\n")</code> without keeping the trailing fragment. TCP does not respect your frame boundaries, and a 4 KB chunk will eventually split an SSE event in half. Popping the last element back into <code>buf</code> is the whole fix. Leave it out and you get a JSON parse error roughly one run in two hundred: frequent enough to matter, rare enough to be blamed on the provider for a week.`)
        ) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c01_model_call.ts

#   C01 · The Model Call — mock
#
#   turns                  12
#   input  billed          67,241 tok
#   output                 207 tok
#   ratio                  325 : 1
#   est. cost              $0.2048
#
#   input tokens per turn  2K 3K 3K 4K 5K 5K 6K 7K 7K 8K 8K 9K
#
#   Note the growth: turn 1's observation is billed again on every later turn.
#   That is why C05 exists.
#
#   12-turn agent             12 calls     67,241 in      207 out  $0.2048`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "What the SDKs are doing behind this function",
      html:
        ul([
          `<strong>Prompt caching</strong> is the single largest cost lever in an agent. Providers let you mark a prefix as cacheable; subsequent calls that share that exact prefix bill it at roughly a tenth. Because agents resend a fixed system prompt plus tool definitions every turn, caching is close to free money. The catch is that the prefix has to be <em>byte-identical</em>: no timestamps, no shuffled tool order, no per-turn interpolation in your system prompt. Design for it in ${ch("c05", "C05")}.`,
          `<strong>A cache entry has a lifetime, and an idle agent outlives it.</strong> Providers hold a cached prefix for minutes, not hours. An agent waiting on a slow tool, an approval, or a user who went to lunch comes back to a cold cache and pays full price for a prefix it had already bought. You can refresh it by sending a cheap request that shares the prefix before it expires, which is worth doing only when the expected saving beats the cost of the refresh — the arithmetic is in ${ch("c05", "C05")}, because the thing being kept warm is a context you designed there.`,
          `<strong>Token counting endpoints</strong> exist because tokenizers differ per model and <code>text.length / 4</code> is off by 30% on code and by more on non-Latin scripts. Use the real counter for budgets that matter; use the estimate for UI.`,
          `<strong>Model aliases move.</strong> <code>*-latest</code> pointing somewhere new is a silent behaviour change in your agent. Pin exact versions in anything you evaluate against, and treat a version bump as a code change that re-runs ${ch("c19", "C19")}'s suite.`,
          `<strong>Rate limits are usually token-based, not request-based.</strong> An agent with a 40k-token context hits an input-token-per-minute limit long before it hits a requests-per-minute limit, which is why naive "N concurrent agents" scaling fails at unintuitive numbers.`,
          `<strong>Where this lives in real code:</strong> pi's <code>packages/ai</code> is this chapter's contract at production scale, and in TypeScript, so it reads as the same code rather than a translation of it; the Anthropic and OpenAI SDKs both wrap this function with retries and streaming; LangChain calls it <code>BaseChatModel.invoke</code>; AutoGen calls it <code>ChatCompletionClient.create</code>, and notably has the client itself accumulate usage, which is exactly the design argued for above.`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `Your agent returns a confident but truncated plan roughly one run in fifty. Which field did the code fail to check, and write the three-line fix.`,
      answer:
        p(`It ignored <code>stopReason === "max_tokens"</code>. A truncated response is a well-formed response, so nothing throws.`) +
        code({
          title: "the fix",
          src: `const res = await model(messages, opts);
if (res.stopReason === "max_tokens") {
  // Either continue the turn, or fail loudly. Never treat as an answer.
  throw new TruncatedError(\`response hit max_tokens after \${res.usage.output} tokens\`);
}`,
        }) +
        p(`In an agent the better branch is usually to continue rather than throw. Append the partial assistant turn and call again, which most APIs support directly. The unacceptable option is the silent one.`),
    },
    {
      difficulty: "core",
      prompt: `Using the simulator, find a configuration where turning prompt caching on saves more than 60% of the run cost, and one where it saves almost nothing. State the rule that explains both.`,
      answer:
        p(`Big savings: large system prompt (5,000+), many tools, small tool results (100), twelve turns. Near-zero savings: tiny system prompt (200), no tools, huge tool results (4,000).`) +
        p(`<strong>The rule:</strong> caching only pays for the <em>fixed prefix</em>. Savings ≈ fixed&nbsp;tokens × turns × 0.9, while the uncached cost grows with the accumulated <em>variable</em> tail. So caching wins when the prefix is large relative to what the run appends, and loses when tool outputs dominate. Treat that as a design instruction rather than an observation. Put stable material at the front — instructions, tool schemas, few-shot examples, long reference documents — and never interpolate anything per-turn into it.`),
    },
    {
      difficulty: "core",
      prompt: `Implement <code>withDeadline(model, ms)</code> — a wrapper that gives an entire multi-call agent run a single wall-clock budget, cancelling an in-flight request when the budget expires. Explain why it must be composed at the <em>run</em> level and not per call.`,
      answer:
        code({
          title: "one signal, shared by every call in the run",
          src: `export function withDeadline(model: Model, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("deadline", "AbortError")), ms);

  const wrapped: Model = (messages, opts = {}) => {
    // Compose: honour the caller's signal AND the run deadline.
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, ctrl.signal])
      : ctrl.signal;
    return model(messages, { ...opts, signal });
  };

  return { model: wrapped, cancel: () => ctrl.abort(), done: () => clearTimeout(timer) };
}`,
        }) +
        p(`Per-call timeouts do not bound a run. Five calls at 30 seconds each is a 150-second worst case, and an agent that keeps deciding to take one more step never trips any individual timeout while blowing every latency budget you have. The deadline belongs to the <em>task</em>, so create the signal once per run and share it. That is what <code>AbortSignal.any</code> is for.`) +
        p(`Remember <code>clearTimeout</code>: a dangling timer keeps the Node process alive after the run completes, which shows up as a server that will not shut down.`),
    },
    {
      difficulty: "stretch",
      prompt: `Design a <code>Usage</code> ledger for an agent that runs subagents (${ch("c17", "C17")}). It must answer: what did this run cost, what did each subagent cost, and which tool's output was responsible for the most input tokens. Sketch the types and say where the accumulation happens.`,
      answer:
        code({
          title: "attribution by span, not by counter",
          src: `interface Span {
  id: string; parent?: string;
  kind: "run" | "subagent" | "model_call" | "tool";
  label: string;                     // agent name or tool name
  usage: Usage;                      // own usage only
  bytesOut?: number;                 // for tools: size of the observation
  startedAt: number; endedAt?: number;
}

class Ledger {
  spans: Span[] = [];
  open(kind: Span["kind"], label: string, parent?: string): string { /* … */ }
  close(id: string, usage?: Usage, bytesOut?: number): void { /* … */ }

  totals(rootId: string): Usage { /* sum the subtree */ }

  // The interesting query: attribute input tokens to the tool that produced them.
  blame(): Array<{ tool: string; inputTokensCaused: number }> {
    // A tool result of T tokens produced at turn k is re-sent on every turn after k,
    // so its true cost is T × (turnsRemaining + 1), not T.
    // …
  }
}`,
        }) +
        p(`Three design points worth stating explicitly.`) +
        ul([
          `<strong>Accumulate at the client, not the loop.</strong> The model client is the only place that sees every call, including retries and calls made inside subagents. Passing a ledger into <code>callModel</code> is how you avoid discovering that 20% of your spend was retries nobody counted.`,
          `<strong>Spans, not counters.</strong> A flat counter answers "what did it cost" and nothing else. A span tree answers "which subagent", "which tool", "which phase", and drops straight into ${ch("c20", "C20")}'s tracing with no rework.`,
          `<strong>Blame must multiply by remaining turns.</strong> The naive view attributes 4,000 tokens to a chatty tool. The true attribution is 4,000 × the number of subsequent turns that re-sent it, which is usually the difference between "that tool is a bit verbose" and "that tool is 60% of the bill".`,
        ]),
    },
  ],

  qa: [
    {
      q: "Should I use the vendor SDK or raw fetch?",
      a:
        p(`Use the SDK in production. It tracks wire-format changes, handles streaming edge cases, and implements retries you would otherwise write yourself. Write it once with <code>fetch</code> first, though, because the SDK hides exactly the things this chapter is about: what gets resent, what the stop reason means, and where the tokens go. Then wrap whichever you use in <em>your</em> <code>Model</code> type, so swapping providers or adding a mock for tests is a one-file change.`),
    },
    {
      q: "Is streaming worth the complexity in an agent?",
      a:
        p(`For the final answer, yes. Perceived latency is most of the user experience. For intermediate reasoning and tool-call turns it is mostly noise, because the tokens arrive and then the agent runs a tool for two seconds anyway. A good default is to stream only the turn that ends with <code>end_turn</code>, and to show tool activity as discrete events ("searching…", "reading file X") rather than raw tokens. Users understand an agent's progress through its <em>actions</em>, not its prose.`),
    },
    {
      q: "How do I estimate tokens without calling the API?",
      a:
        p(`For budgets, use the provider's token-counting endpoint. For a local estimate, <code>chars / 3.7</code> is a decent rule for English prose, <code>chars / 3</code> for code and JSON, and both are badly wrong for CJK and for base64, where a "small" image can run to tens of thousands of tokens. Never let an estimate be the thing that decides whether a request fits; let it decide whether to <em>check</em>.`),
    },
    {
      q: "Why separate `cacheRead` and `cacheWrite` in Usage?",
      a:
        p(`Because cache writes are billed at a <em>premium</em> (writing the cache costs more than a normal input token) and cache reads at a steep discount. A system that thrashes the cache, say a system prompt with a timestamp in it, shows up as high <code>cacheWrite</code> and near-zero <code>cacheRead</code>. That is instantly diagnosable if you kept the fields apart and completely invisible if you summed them.`),
    },
    {
      q: "Can I keep server-side conversation state instead of resending?",
      a:
        p(`Some APIs offer it, and it saves bandwidth rather than tokens. The model still attends to the whole history, so you still pay for it. More importantly, it takes away the thing this course depends on: the ability to <em>edit</em> the context. Compaction (${ch("c05", "C05")}), memory injection (${ch("c07", "C07")}), and subagent context isolation (${ch("c17", "C17")}) are all operations on an array you own. Own the array.`),
    },
  ],

  project: {
    title: "Project · Your model client",
    brief:
      p(`Write the <code>Model</code> function you will use for the rest of the course. Everything after this chapter imports it, so it is worth an hour. Two implementations behind one type: a live client and a deterministic mock.`),
    spec: [
      "Exports a single <code>Model</code> type and two implementations: <code>liveModel(cfg)</code> and <code>mockModel(script)</code>, interchangeable at every call site.",
      "Retries 429 and 5xx with full jitter, honours <code>retry-after</code>, and never retries an <code>AbortError</code>.",
      "Returns <code>usage</code>, <code>stopReason</code> and <code>latencyMs</code> on every call, including the mock.",
      "Accepts an <code>AbortSignal</code> and composes it with an internal per-call timeout.",
      "Throws a typed <code>TruncatedError</code> on <code>max_tokens</code> rather than returning the partial text.",
      "The mock is driven by a script — an array of canned responses or a function of the message array — so chapter tests are deterministic and offline.",
    ],
    stretch: [
      "Add a <code>Ledger</code> that accumulates usage across calls and prints a per-run cost summary.",
      "Add <code>onDelta</code> streaming that resolves to the identical <code>ModelResponse</code> shape as the non-streaming path, and prove it with a test that runs both and deep-equals the results.",
      "Add a recording mock: run live once, snapshot the responses to JSON, replay them forever. This is how you get fast, free, deterministic tests of a stochastic system.",
    ],
  },

  quiz: [
    {
      q: "Why must `content` be an array of typed blocks rather than a string?",
      options: [
        "A single assistant turn can contain text and several tool calls at once, and results must stay paired with the calls that requested them",
        "Strings cannot exceed the context window",
        "Blocks compress better on the wire",
        "The API rejects string content",
      ],
      answer: 0,
      why:
        "Flattening to a string destroys the pairing between a tool_use block and its tool_result, which blocks parallel tool execution and makes selective compaction impossible. It is one type definition now versus a rewrite in C03 and C05.",
    },
    {
      q: "The response has `stopReason: \"max_tokens\"` and looks like a complete plan. What should the loop do?",
      options: [
        "Continue the turn or fail loudly — never treat it as a finished answer",
        "Accept it; the model stops when it is done",
        "Retry the same call at a higher temperature",
        "Truncate the message history and retry",
      ],
      answer: 0,
      why:
        "A truncated response is syntactically indistinguishable from a complete one — it has text and it parses. That is exactly why it must be checked explicitly. Silently acting on half a plan is one of the most expensive quiet bugs in agent code.",
    },
    {
      q: "Which retry policy is correct for a fleet of agents hitting 429s?",
      options: [
        "Honour `retry-after` if present, otherwise exponential backoff multiplied by a random factor, and never retry an AbortError",
        "Retry immediately up to five times",
        "Fixed 1-second exponential backoff with no randomisation",
        "Retry everything including cancellations, since cancellation may be spurious",
      ],
      answer: 0,
      why:
        "Deterministic backoff synchronises the fleet into retry waves that recreate the overload. Full jitter breaks the lockstep. `retry-after` beats any guess you make. And retrying an AbortError means the client is arguing with its own deadline — it keeps spending after the user cancelled.",
    },
    {
      q: "In a typical 12-turn agent run, roughly what does the input:output token ratio look like, and why?",
      options: [
        "Input dominates by one to two orders of magnitude, because the whole history is resent every turn while each turn emits a short decision",
        "Roughly 1:1, since each turn reads and writes similar amounts",
        "Output dominates, because the model writes long reasoning each turn",
        "It depends only on the model, not the loop shape",
      ],
      answer: 0,
      why:
        "Agents are an input-token workload — the opposite of chat. Each turn resends system prompt, tool schemas and every prior observation to emit maybe 100 output tokens. This is why prompt caching and context engineering are cost levers, and why a chatty tool is so expensive: its output is billed on every subsequent turn.",
    },
    {
      q: "What breaks prompt caching on a system prompt?",
      options: [
        "Interpolating anything that changes per turn, such as a timestamp, since the cached prefix must be byte-identical",
        "Making the system prompt too long",
        "Using tools alongside it",
        "Setting temperature to 0",
      ],
      answer: 0,
      why:
        "Caching matches an exact prefix. A timestamp, a shuffled tool order, or a per-turn interpolated variable invalidates it every call — you then pay the cache-write premium every turn and never get a read. Diagnosis: high cacheWrite, near-zero cacheRead, which is why those two fields should not be summed.",
    },
    {
      q: "Why does a whole-run deadline need to be composed at the run level rather than as a per-call timeout?",
      options: [
        "An agent can take an unbounded number of calls, each finishing within its own timeout while the run blows every latency budget",
        "Per-call timeouts are not supported by fetch",
        "AbortSignal can only be created once per process",
        "Per-call timeouts double-count retries",
      ],
      answer: 0,
      why:
        "Five calls under a 30s per-call timeout is a 150s worst case, and nothing stops the loop from deciding on a sixth. The deadline is a property of the task, so one AbortController per run, composed into each call with AbortSignal.any.",
    },
  ],

  continues:
    p(`The client returns blocks of text. Your loop needs a <em>decision</em> — a typed value it can branch on. Between those two sits the most underrated reliability problem in agent engineering: getting a language model to emit something a parser will accept, every time, including on the run where it decides to wrap the JSON in an apology. ${ch("c02", "C02")} solves it properly.`),
};

export default chapter;
