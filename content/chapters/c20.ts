import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const TRACE_SVG = `
<svg viewBox="0 0 700 280" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="A trace waterfall for one agent run">
  <text x="14" y="18" class="d-label">ONE RUN AS A WATERFALL — WHERE THE TIME AND THE MONEY WENT</text>

  <text x="14" y="42" class="d-mono">run r_7c21</text>
  <rect x="150" y="30" width="520" height="16" rx="3" class="d-box-a"/>
  <text x="676" y="42" class="d-mono" text-anchor="end" fill="var(--fg-faint)">38.2s · $1.84</text>

  <text x="26" y="66" class="d-mono" fill="var(--fg-faint)">├ model call 1</text>
  <rect x="150" y="54" width="34" height="14" rx="3" class="d-box"/>
  <text x="676" y="66" class="d-mono" text-anchor="end" fill="var(--fg-faint)">1.2s · 4,210 tok</text>

  <text x="26" y="88" class="d-mono" fill="var(--fg-faint)">├ tool search_docs</text>
  <rect x="186" y="76" width="22" height="14" rx="3" class="d-box-t"/>
  <text x="676" y="88" class="d-mono" text-anchor="end" fill="var(--fg-faint)">0.4s · 1,900 tok out</text>

  <text x="26" y="110" class="d-mono" fill="var(--fg-faint)">├ model call 2</text>
  <rect x="210" y="98" width="40" height="14" rx="3" class="d-box"/>
  <text x="676" y="110" class="d-mono" text-anchor="end" fill="var(--fg-faint)">1.5s · 7,880 tok</text>

  <text x="26" y="132" class="d-mono" fill="var(--danger)">├ tool run_tests</text>
  <rect x="252" y="120" width="300" height="14" rx="3" class="d-box" fill="var(--danger-soft)" stroke="var(--danger)"/>
  <text x="676" y="132" class="d-mono" text-anchor="end" fill="var(--danger)">11.4s ← 30% of wall clock</text>

  <text x="26" y="154" class="d-mono" fill="var(--fg-faint)">├ subagent researcher</text>
  <rect x="554" y="142" width="96" height="14" rx="3" class="d-box-p"/>
  <text x="676" y="154" class="d-mono" text-anchor="end" fill="var(--fg-faint)">3.7s · $0.44</text>

  <text x="38" y="176" class="d-mono" fill="var(--fg-faint)">│ ├ model call ×6</text>
  <rect x="554" y="164" width="72" height="12" rx="3" class="d-box"/>
  <text x="38" y="196" class="d-mono" fill="var(--fg-faint)">│ └ tool grep ×4</text>
  <rect x="566" y="184" width="46" height="12" rx="3" class="d-box-t"/>

  <text x="26" y="218" class="d-mono" fill="var(--fg-faint)">└ model call 3 (answer)</text>
  <rect x="650" y="206" width="20" height="14" rx="3" class="d-box"/>
  <text x="676" y="232" class="d-mono" text-anchor="end" fill="var(--accent)">14,300 tok ← 62% of spend, one call</text>

  <line x1="14" y1="244" x2="686" y2="244" stroke="var(--border)"/>
  <text x="14" y="266" class="d-mono" fill="var(--accent)">the bar chart answers "why was this slow" in two seconds. a log file does not.</text>
</svg>`;

const chapter: Chapter = {
  id: "c20",
  num: 20,
  layer: "systems",
  title: "Observability & Cost",
  subtitle: "Seeing inside a run, and the four numbers on the wall",
  blurb:
    "Traces, spans and the agent-specific attributes that make them useful. Cost attribution that finds the tool eating your budget, the leading indicators that move before quality does, and the dashboard worth building.",
  lines: 217,
  file: "code/c20_tracing.ts",
  tags: ["tracing", "spans", "OpenTelemetry", "cost attribution", "leading indicators", "dashboards", "replay"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "\"It did something weird yesterday\"",
      html:
        p(`A user reports that the agent gave a strange answer on Tuesday afternoon. You have logs. They contain forty thousand lines of <code>INFO calling model</code> and <code>INFO tool result</code>, interleaved with every other concurrent run, with no way to reconstruct which lines belonged to that request.`) +
        p(`Agents are unusually hostile to conventional logging. The interesting unit is a <em>run</em>, which is a tree of nested operations spanning seconds to minutes, each carrying a large payload, several of which are nondeterministic. A flat text log is the wrong shape for that, and a metric counter is the wrong granularity.`) +
        p(`The right shape is a <strong>trace</strong>: a tree of timed spans with structured attributes, queryable, with payloads attached. The good news is that ${ch("c08", "C08")}'s event log is already most of one.`) +
        note("key", "One rule", p(`Every model call, every tool call, every subagent run, and every retrieval is a span, and every span carries the run id. If a piece of work is not in a span, it does not exist when you are debugging at 2am, and it definitely does not appear in the cost breakdown.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Spans, and the attributes that matter",
      html:
        fig({ label: "Diagram", title: "one run as a waterfall", body: TRACE_SVG,
          caption: `Two findings visible in two seconds: a test run is 30% of wall clock, and the final answer call is 62% of the spend. Neither is findable in a log file.` }) +
        code({ title: "code/c20_tracing.ts — the span model",
          src: `export interface Span {
  traceId: string;          // = run id. everything in one run shares it.
  spanId: string;
  parentId?: string;        // the tree
  name: string;             // "model.call" · "tool.search_docs" · "agent.researcher"
  kind: "run" | "model" | "tool" | "subagent" | "retrieval" | "approval";
  startedAt: number; endedAt?: number;
  status: "ok" | "error" | "cancelled";
  attributes: Attributes;
  events: Array<{ at: number; name: string; data?: unknown }>;
}

export interface Attributes {
  // Generic
  "run.id": string; "run.step": number; "user.id"?: string; "tenant.id"?: string;

  // Model — the ones you will actually query on
  "llm.model"?: string;
  "llm.tokens.input"?: number; "llm.tokens.output"?: number;
  "llm.tokens.cache_read"?: number; "llm.tokens.cache_write"?: number;
  "llm.stop_reason"?: StopReason;
  "llm.cost_usd"?: number;
  "llm.temperature"?: number;

  // Tool
  "tool.name"?: string; "tool.read_only"?: boolean;
  "tool.result.tokens"?: number;        // ← the attribute that finds your budget leak
  "tool.error"?: string;

  // Agent-specific, and the reason generic APM is not enough
  "agent.terminal_state"?: "answered" | "budget" | "stuck" | "blocked" | "error" | "cancelled";
  "agent.repeat_detected"?: boolean;
  "agent.compactions"?: number;
  "agent.goal_relevance"?: number;      // 0–1, per step
  "agent.plan_revisions"?: number;
}`,
        }) +
        p(`The last block is what distinguishes an agent trace from an HTTP trace. <code>terminal_state</code> turns "error rate" into something meaningful; <code>tool.result.tokens</code> is how you find the chatty tool; <code>goal_relevance</code> is the drift signal from ${ch("c05", "C05")}.`) +
        `<h3>Payloads: sample, redact, and keep enough</h3>` +
        p(`Traces without payloads answer "what happened" and not "why". Traces with every payload cost more to store than to produce. The workable policy:`) +
        table(["Run", "Keep"], [
          ["All runs", "Attributes, timings, tool names and arguments (redacted), token counts"],
          ["Failures and anomalies", "<b>Full payloads</b> — every message, every tool result"],
          ["~2% sample of successes", "Full payloads, for the eval pipeline (${C19})"],
          ["Never", "Credentials, PII beyond an id, raw document bodies from retrieval"],
        ].map((r) => r.map((c) => c.replace("${C19}", `<a href="/c19/" class="mono">C19</a>`))) as string[][]) +
        code({ title: "redaction that happens once, at the boundary",
          src: `const REDACT = [
  { re: /\\b[\\w.+-]+@[\\w-]+\\.[\\w.]+\\b/g, with: "<email>" },
  { re: /\\bsk-[A-Za-z0-9]{20,}\\b/g,        with: "<api-key>" },
  { re: /\\b(?:\\d[ -]*?){13,19}\\b/g,        with: "<card>" },
  { re: /Bearer\\s+[A-Za-z0-9._~+/-]+=*/g,   with: "Bearer <token>" },
];
// Applied in the span exporter, not at every call site. One place to audit,
// one place to fix, and it cannot be forgotten by whoever adds the next tool.`,
        }) },

    { id: "mechanics", kicker: "Mechanics", title: "Cost attribution and leading indicators",
      html:
        `<h3>The naive cost breakdown is wrong</h3>` +
        p(`Summing <code>llm.cost_usd</code> per span tells you which <em>call</em> was expensive. It does not tell you what <em>caused</em> the expense, and in an agent those are very different. A tool that returns 4,000 tokens at step 3 of a 12-turn run is re-sent nine more times, so its true cost is roughly ten times its apparent one (${ch("c01", "C01")}).`) +
        code({ title: "blame, not spend",
          src: `export function blame(spans: Span[]): Blame[] {
  const model = spans.filter((s) => s.kind === "model").sort(byStart);
  const tools = spans.filter((s) => s.kind === "tool");

  return tools.map((t) => {
    const after = model.filter((m) => m.startedAt > t.endedAt!).length;
    const produced = t.attributes["tool.result.tokens"] ?? 0;
    return {
      tool: t.attributes["tool.name"]!,
      producedTokens: produced,
      // Every subsequent model call re-sends this observation.
      causedInputTokens: produced * after,
      causedUsd: (produced * after * INPUT_PRICE) / 1e6,
    };
  });
}

// A real result:
//   search_docs   produced 1,900 tok × 9 later calls = 17,100 caused   $0.051
//   read_file     produced 4,200 tok × 7 later calls = 29,400 caused   $0.088
//   list_files    produced 6,800 tok × 8 later calls = 54,400 caused   $0.163  ← 41% of spend
//
// list_files looked cheap. It was the most expensive thing in the run.`,
        }) +
        note("good", "The first query worth running", p(`Rank tools by <em>caused</em> input tokens across a week of runs. In nearly every agent one or two tools dominate, and the fix is usually a truncation limit or a pagination parameter — a one-line change for a double-digit percentage of spend.`)) +
        `<h3>Four numbers on the wall</h3>` +
        table(["Metric", "Why it beats the obvious alternative"], [
          ["<b>Terminal-state distribution</b><br><span class='small muted'>answered / partial / blocked / budget / error</span>", "\"Error rate\" hides the difference between a credential expiring and a task getting harder"],
          ["<b>p95 steps among successful runs</b>", "The leading indicator — rises before success falls (${C12})"],
          ["<b>Cost per successful run</b>", "Total spend conflates volume with efficiency. Per-success is the number that should not drift"],
          ["<b>Caused-token ranking by tool</b>", "Finds the budget leak that per-call cost cannot see"],
        ].map((r) => r.map((c) => c.replace("${C12}", `<a href="/c12/" class="mono">C12</a>`))) as string[][]) +
        `<h3>Leading indicators, ranked by how early they move</h3>` +
        ol([
          `<strong>Goal relevance per step.</strong> A cheap per-step judgement of whether the current action serves the goal. Trends down days before anything fails.`,
          `<strong>Repeat-detector fire rate.</strong> Rising means the agent is thrashing, usually because a tool started returning worse results.`,
          `<strong>p95 steps among successes.</strong> More work for the same outcome.`,
          `<strong>Degradation-ladder rung reached.</strong> Runs hitting "drop tools" that never used to.`,
          `<strong>Success rate.</strong> By the time this moves, users have already noticed.`,
        ]) +
        `<h3>From trace to reproduction, in one command</h3>` +
        code({ title: "the tool that pays for the whole chapter",
          src: `// Because the trace IS the event log (C08), a trace id is a reproducible run.
$ agentctl replay r_7c21 --until 5        # print the exact context the model saw at step 5
$ agentctl fork r_7c21 --at 5 --patch 'search_docs => "No results."'
$ agentctl case r_7c21 --expect-fail      # promote this run into the C19 eval suite

// Debugging an agent without replay is reading tea leaves. With it, "why did it do
// that" becomes "here is precisely what it was looking at when it decided".`,
        }) },

    { id: "explore", kicker: "Explore", title: "Find the budget leak",
      html:
        p(`A week of runs, one of which has a problem. Use the two views — per-call cost and caused-token blame — and see which one finds it.`) +
        lab({ label: "Simulator", title: "cost attribution",
          body: `
<div class="controls">
  <div class="ctl"><label>view</label><select id="o20-v"><option value="call">per-call cost (naive)</option><option value="blame" selected>caused tokens (blame)</option></select></div>
  <div class="ctl"><label>avg steps per run</label><input type="range" id="o20-s" min="3" max="25" step="1" value="12"><span class="val" id="o20-s-v">12</span></div>
  <div class="ctl"><label>list_files result size</label><input type="range" id="o20-l" min="200" max="12000" step="200" value="6800"><span class="val" id="o20-l-v">6,800 tok</span></div>
  <div class="ctl"><label>prompt caching</label><select id="o20-c"><option value="1" selected>on</option><option value="0">off</option></select></div>
</div>
<div id="o20-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="o20-tot">—</b><span>$ / 1,000 runs</span></div>
  <div class="stat"><b id="o20-top">—</b><span>top contributor</span></div>
  <div class="stat"><b id="o20-fix">—</b><span>saving if capped at 800 tok</span></div>
</div>
<div class="note" id="o20-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var view = document.getElementById("o20-v").value, S = +document.getElementById("o20-s").value,
      L = +document.getElementById("o20-l").value, cache = document.getElementById("o20-c").value === "1";
  document.getElementById("o20-s-v").textContent = S;
  document.getElementById("o20-l-v").textContent = L.toLocaleString() + " tok";

  var TOOLS = [
    { k: "list_files",  size: L,    calls: 1.2, at: 0.2 },
    { k: "read_file",   size: 4200, calls: 2.4, at: 0.35 },
    { k: "search_docs", size: 1900, calls: 3.1, at: 0.3 },
    { k: "grep",        size: 600,  calls: 4.0, at: 0.4 },
    { k: "run_tests",   size: 900,  calls: 1.1, at: 0.7 }
  ];
  var SYS = 6000;
  var rows = TOOLS.map(function (t) {
    var after = Math.max(0, Math.round(S * (1 - t.at)));
    var caused = t.size * t.calls * after;
    // naive per-call cost: just the model call that immediately followed
    var perCall = t.size * t.calls;
    return { k: t.k, caused: caused, perCall: perCall,
             usd: caused * 3 / 1e6, usdCall: perCall * 3 / 1e6 };
  });
  var sysCaused = SYS * S * (cache ? 0.1 : 1);
  rows.push({ k: "system+schemas", caused: sysCaused, perCall: SYS, usd: sysCaused * 3 / 1e6, usdCall: SYS * 3 / 1e6 });

  var key = view === "blame" ? "caused" : "perCall";
  var usdKey = view === "blame" ? "usd" : "usdCall";
  rows.sort(function (a, b) { return b[key] - a[key]; });
  var max = rows[0][key] || 1, total = rows.reduce(function (a, r) { return a + r[usdKey]; }, 0);

  document.getElementById("o20-rows").innerHTML = rows.map(function (r) {
    var isTop = r === rows[0];
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:9rem;color:' + (isTop ? "var(--danger)" : "var(--fg-muted)") + ';font-weight:' + (isTop ? 600 : 400) + '">' + r.k + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (r[key] / max * 100) + '%;background:' + (isTop ? "var(--danger)" : "var(--accent)") + '"></i></span>' +
      '<span class="mono small" style="width:9rem;text-align:right">' + Math.round(r[key]).toLocaleString() + ' tok · $' + (r[usdKey] * 1000).toFixed(0) + '/1k</span></div>';
  }).join("");

  var capped = rows.map(function (r) { return r.k === "list_files" ? r[usdKey] * (800 / L) : r[usdKey]; })
                   .reduce(function (a, b) { return a + b; }, 0);
  document.getElementById("o20-tot").textContent = "$" + (total * 1000).toFixed(0);
  document.getElementById("o20-top").textContent = rows[0].k;
  document.getElementById("o20-fix").textContent = "$" + ((total - capped) * 1000).toFixed(0) + "/1k";

  var n = document.getElementById("o20-note");
  if (view === "call") n.innerHTML = "<b>Per-call view.</b> list_files looks modest — it runs about once per run. This view answers 'which call was expensive' and cannot answer 'what caused the expense'. Switch to caused tokens.";
  else if (L > 4000 && S > 8) n.innerHTML = "<b>Found it.</b> list_files returns " + L.toLocaleString() + " tokens early in the run, so it is re-sent on almost every subsequent call. Capping it at 800 tokens with a pagination hint (C03) saves the amount shown — a one-line change.";
  else if (!cache) n.innerHTML = "<b>Caching off.</b> The system prompt and tool schemas now dominate everything else, billed in full on all " + S + " turns. Turning caching on is usually the single largest cost lever in an agent (C01).";
  else n.innerHTML = "<b>Healthy distribution.</b> No single tool dominates. Note that the system prompt still shows up materially even with caching — it is paid on every turn, which is why C05 treats its length as a cost decision.";
}
["o20-v","o20-s","o20-l","o20-c"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Switch between the two views at the default settings. The naive view ranks <code>list_files</code> fourth; the blame view ranks it first. Same data, and only one of them leads to the fix.`,
        }) },

    { id: "build", kicker: "Build it", title: "Tracing that costs one line per call site",
      html:
        code({ title: "code/c20_tracing.ts — context-propagated spans",
          src: `import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<Span>();

export async function span<T>(
  name: string, kind: Span["kind"], attrs: Partial<Attributes>, fn: (s: Span) => Promise<T>,
): Promise<T> {
  const parent = als.getStore();
  const s: Span = {
    traceId: parent?.traceId ?? newId(),
    spanId: newId(), parentId: parent?.spanId,
    name, kind, startedAt: Date.now(), status: "ok",
    attributes: { ...inherited(parent), ...attrs } as Attributes,
    events: [],
  };
  return als.run(s, async () => {
    try { return await fn(s); }
    catch (e) {
      s.status = (e as Error).name === "AbortError" ? "cancelled" : "error";
      s.attributes["error.message"] = String(e);
      throw e;
    } finally { s.endedAt = Date.now(); exporter.push(s); }
  });
}

// Call sites stay one line, and nesting is automatic — no context threading.
const res = await span("model.call", "model", { "llm.model": cfg.model }, async (s) => {
  const r = await callModel(messages, opts);
  s.attributes["llm.tokens.input"] = r.usage.input;
  s.attributes["llm.tokens.output"] = r.usage.output;
  s.attributes["llm.stop_reason"] = r.stopReason;
  s.attributes["llm.cost_usd"] = price(r.usage, cfg.model);
  return r;
});`,
        }) +
        p(`<code>AsyncLocalStorage</code> is what makes this usable: the parent span is found automatically across awaits, so nesting requires no plumbing and a subagent's spans attach to the right parent without anyone passing a context object through eleven functions.`) +
        code({ title: "the exporter, and the sampling policy",
          src: `class Exporter {
  push(s: Span): void {
    this.buffer.push(redact(s));                       // redaction happens once, here
    if (this.buffer.length >= 128) void this.flush();
  }

  /** Decided at the END of a run, when you know whether it is interesting. */
  policy(run: Span): "full" | "attributes" | "drop" {
    if (run.status === "error") return "full";
    if (run.attributes["agent.terminal_state"] !== "answered") return "full";
    if (run.attributes["agent.repeat_detected"]) return "full";
    if ((run.attributes["run.step"] ?? 0) > P95_STEPS) return "full";   // the slow tail
    if (hash(run.traceId) % 100 < 2) return "full";                     // 2% for evals
    return "attributes";
  }
}
// Tail sampling — deciding after the fact — is the only policy that keeps every
// interesting run. Head sampling drops the anomaly you needed before it happens.`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c20_tracing.ts

#   C20 · Observability & Cost
#
#   one run as a waterfall (trace r_0001)
#
#   span                                                                    dur  tokens    cost
#   agent.run                ████████████████████████████████████████      94ms
#     model.call             █████                                         12ms    4210  $0.013
#     tool.search_docs            ██                                        4ms    1900
#     model.call                    ██████                                 15ms    7880  $0.024
#     tool.list_files                     █                                 3ms    6800
#     tool.run_tests                       ████████████████                38ms     900
#     agent.researcher                                      █████          11ms
#       model.call                                          ████            9ms    3100  $0.004
#       tool.grep                                              █            2ms     600
#     model.call                                                █████      11ms   14300  $0.046
#
#     Nesting came from AsyncLocalStorage — no context object was threaded
#     through any function, and the subagent's spans attached to the right parent.
#
#   cost attribution: which CALL was expensive vs what CAUSED the expense
#
#   tool             produced  later calls  caused input  caused $  share
#   list_files          6,800            2        13,600   $0.0408  63%
#   search_docs         1,900            3         5,700   $0.0171  26%
#   run_tests             900            2         1,800   $0.0054  8%
#   grep                  600            1           600   $0.0018  3%
#
#     per-call view  → the most expensive call was a model.call at $0.046 (14,300 input tokens).
#                      True, and not actionable: you cannot delete the answer.
#     blame view     → list_files produced 6,800 tokens early and is responsible for
#                      63% of the input tokens those calls billed.
#                      Actionable: cap it, and the expensive call gets cheaper.
# …
#   Head sampling would have decided before any of that was known.`,
        }) +
        note("", "Read that last block in order", p(`Goal relevance has moved 11%, the repeat detector fires nearly twice as often, p95 steps is up, and the success rate has barely moved. That is what a degradation looks like three days before anyone files a ticket.`)) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Use OpenTelemetry for the transport.</strong> Its GenAI semantic conventions define attribute names for model calls — <code>gen_ai.request.model</code>, <code>gen_ai.usage.input_tokens</code>, <code>gen_ai.usage.output_tokens</code> — and adopting them means any OTel-compatible backend renders your agent traces without custom work. The <code>llm.*</code> names in this chapter's code are the course's own shorthand; in production, emit the <code>gen_ai.*</code> names and add the agent-specific attributes alongside rather than inventing a parallel scheme.`,
          `<strong>The agent-specific tools are worth evaluating.</strong> LangSmith, Langfuse, Braintrust, Arize Phoenix and Weave all understand runs-as-trees, message payloads and token accounting out of the box, which generic APM does not. The instrumentation you write here exports to any of them.`,
          `<strong>Tail sampling, not head sampling.</strong> Deciding at the start which runs to keep guarantees you drop the anomaly. Decide at the end, when you know the terminal state and the step count.`,
          `<strong>Redact at the exporter.</strong> One place to audit, one place to fix, and impossible for the next person adding a tool to forget.`,
          `<strong>Make the trace id visible to the user.</strong> A support request that arrives with a run id is a five-minute investigation; one that arrives as "it was weird on Tuesday" is an afternoon.`,
          `<strong>Cost alerts belong per tenant, not globally.</strong> A global spend alert fires after the damage; a per-tenant one fires while a single pathological input is still compounding (${ch("c12", "C12")}).`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Your agent's spend doubled last month with flat traffic. Name the four things you would check, in order, and the query for each.`,
      answer: ol([
        `<strong>Prompt-cache hit rate.</strong> Compare <code>llm.tokens.cache_read</code> against <code>cache_write</code> over time. A prefix change — a timestamp added to the system prompt, a reordered tool list — silently turns every call into a full-price call. This is the most common cause and the cheapest fix (${ch("c01", "C01")}).`,
        `<strong>Steps per run.</strong> p50 and p95, split by terminal state. If p95 rose, the agent is working harder for the same outcome; if the "budget" terminal state rose, it is failing more expensively.`,
        `<strong>Caused-token ranking by tool.</strong> A tool whose output grew — a growing directory, a table that gained columns — multiplies across every subsequent turn.`,
        `<strong>Model and context size.</strong> Did a model alias move to a newer, pricier version? Did the system prompt or the retrieved-chunk count grow?`,
      ]) + p(`In that order because it is ordered by likelihood × ease of fixing. Caching regressions are common and are a one-line fix; a model change is rare but obvious once you look.`) },

    { difficulty: "core",
      prompt: `Implement the goal-relevance metric. It must be cheap enough to run on every step of every run, and meaningful enough to alert on.`,
      answer: code({ title: "two tiers: free always, cheap sometimes",
        src: `export async function goalRelevance(goal: string, step: Step, ctx: RunCtx): Promise<number> {
  // TIER 1 — free, every step. Lexical overlap between the goal and what the agent
  // is doing. Crude, but it moves in the right direction and costs nothing.
  const lexical = jaccard(shingle(normalise(goal), 3),
                          shingle(normalise(step.toolName + " " + JSON.stringify(step.args)), 3));

  // TIER 2 — one small-model call, sampled. Only when tier 1 is ambiguous, and only
  // on ~5% of steps, so the cost is negligible and the signal is real.
  if (lexical > 0.25 || lexical < 0.02 || !sampled(ctx, 0.05)) return lexical;

  const { relevant } = await structured(ctx.smallModel, [{ role: "user", content:
    \`Goal: \${goal}\\nAction: \${step.toolName}(\${truncate(JSON.stringify(step.args), 200)})\\n\\n\` +
    \`Does this action plausibly serve the goal? Answer with a number 0–1 only.\` }],
    obj({ relevant: num({ min: 0, max: 1 }) }));
  return relevant;
}

// Emit as a span attribute per step. Alert on the TREND at a fixed step index —
// "relevance at step 8, weekly median" — not on individual values, which are noisy.` }) +
      ul([
        `<strong>Alert on a trend at a fixed step index.</strong> Relevance naturally declines through a run as the agent works on sub-problems; comparing step 8 this week to step 8 last week controls for that. Comparing raw averages does not, and will alert every time run lengths shift.`,
        `<strong>Sample tier 2.</strong> A model call per step per run is unaffordable and unnecessary. You want a population trend, not a per-run verdict.`,
        `<strong>Do not gate on it.</strong> It is an indicator, not a judgement. An agent doing something creatively indirect will score low and be right.`,
      ]) },

    { difficulty: "core",
      prompt: `Design the trace view you would want at 2am for a failed run. What is on screen, and what is one click away?`,
      answer: p(`<strong>On screen, in this order:</strong>`) +
        ol([
          `<strong>The verdict line.</strong> Run id, terminal state, duration, cost, step count, and the goal in one line. Half the time this alone identifies the problem: "blocked, 2 steps, $0.01" is a credential, not a reasoning failure.`,
          `<strong>The waterfall.</strong> Every span, nested, with duration bars, coloured by status. Red spans and wide bars are the two things the eye should find without reading.`,
          `<strong>Per-span cost and tokens</strong> on the right, so the expensive call is visible without a hover.`,
          `<strong>An anomaly strip.</strong> Automatically flagged: repeat detected, compaction fired, a tool returning over N tokens, a step where goal relevance dropped sharply, an approval that timed out.`,
          `<strong>The last tool result before the failure</strong>, inline and untruncated. This is disproportionately often the answer.`,
        ]) +
        p(`<strong>One click away:</strong> the full message array as the model saw it at any step (<code>replay --until N</code>); the raw request and response JSON for any model call; the diff between this run and the last successful run of the same case; a fork button that re-runs from a chosen step; and "add to eval suite".`) +
        p(`<strong>Deliberately not on screen:</strong> a chronological log stream. It is the format that made this hard in the first place — mixing levels of abstraction and interleaving concurrent work. Offer it as a raw view for the rare case, and never as the default.`) },

    { difficulty: "stretch",
      prompt: `Design the alerting for an agent with 10,000 daily runs: what pages a human, what goes on a dashboard, and what is deliberately ignored — with thresholds.`,
      answer: p(`<strong>Page (wake someone):</strong>`) +
        ul([
          `<code>terminal_state = blocked</code> above 2% over 15 minutes — a credential or permission changed, and every affected run fails identically.`,
          `Per-tenant spend over cap — a runaway loop compounds, and a global alert fires too late.`,
          `Any tool error rate above 50% for 5 minutes — a dependency is down and the circuit breaker is holding, but the agent is degraded.`,
          `<code>failed empty</code> (non-success with no partial report) above 1% — users are getting nothing back (${ch("c12", "C12")}).`,
          `p99 latency above 3× the 7-day baseline for 10 minutes.`,
        ]) +
        p(`<strong>Dashboard, reviewed daily:</strong> terminal-state distribution stacked over time; steps-to-completion histogram split by outcome; cost per successful run; caused-token ranking by tool; the four leading indicators as sparklines against a 7-day baseline; router fallback rate; approval decision latency (${ch("c16", "C16")}).`) +
        p(`<strong>Weekly review, not alerted:</strong> the leading indicators' trends, the newly-appearing failure modes from sampled traces, and twenty runs read by a human.`) +
        p(`<strong>Deliberately ignored:</strong> individual 429s and 5xx (alert on retry <em>exhaustion</em> rate instead), individual tool errors (layer 2 is normal operation), individual slow model calls (a 6-second call inside a 40-second run is noise), and absolute token counts (they track volume, not health — cost per <em>successful</em> run is the metric).`) +
        p(`One meta-rule worth stating: <strong>every page must have a runbook and a recent example</strong>. An alert that has fired three times with no action taken should be demoted to the dashboard, because it is training the on-call to ignore alerts, which is the same attention-budget argument as ${ch("c16", "C16")}.`) },
  ],

  qa: [
    { q: "Do I need a dedicated LLM observability tool?", a: p(`Not at first: spans exported to whatever you already run will do. The specialised tools earn their place when you want message payloads rendered readably, token and cost accounting built in, and a path from a trace into an eval case. That last one is the feature that changes how a team works.`) },
    { q: "How long should I keep traces?", a: p(`Full payloads: 7–30 days for failures and the sample, shorter if they contain user data. Attributes only: months, because they are small and they are what your trends are built from. Decide the policy before you have a terabyte, and make it a lifecycle rule rather than a cleanup script.`) },
    { q: "Should users see the trace?", a: p(`A shaped version, yes: the plan, the tools used with human-readable summaries, and the sources. It builds trust and it makes support dramatically cheaper. Not the raw spans, and never the raw tool results. They contain internal identifiers, other people's data, and a lot of noise.`) },
    { q: "How do I trace across a multi-agent boundary?", a: p(`The trace id propagates and the subagent's root span carries <code>parentId</code> from the dispatching span. In a distributed runtime (${ch("c18", "C18")}) that means putting trace context in the message envelope, or your trace ends at the process edge and you are back to correlating logs.`) },
    { q: "Is tracing expensive?", a: p(`Instrumentation is negligible — microseconds and a few kilobytes per span. Storage is what costs, and it is entirely a sampling-policy question. Tail sampling with full payloads on failures plus 2% of successes is typically a small fraction of the inference bill.`) },
  ],

  project: {
    title: "Project · Instrument everything",
    brief: p(`Add tracing to your agent, then use it to find something you did not know. The deliverable is not the instrumentation; it is the finding.`),
    spec: [
      "<code>span()</code> with <code>AsyncLocalStorage</code> propagation, so nesting is automatic and call sites are one line.",
      "Spans for every model call, tool call, retrieval, subagent run and approval, carrying the agent-specific attributes including <code>terminal_state</code> and <code>tool.result.tokens</code>.",
      "Redaction applied once, in the exporter.",
      "Tail sampling: full payloads for failures, anomalies and the slow tail, plus a 2% sample of successes; attributes only for the rest.",
      "A caused-token blame report ranking tools by <code>size × subsequent model calls</code>.",
      "A dashboard or printed report with the four numbers: terminal-state distribution, p95 steps among successes, cost per successful run, and the blame ranking.",
      "<code>replay &lt;runId&gt; --until N</code> printing the exact context the model saw.",
    ],
    stretch: [
      "Export via OpenTelemetry using the GenAI semantic conventions and render the waterfall in an existing backend.",
      "Implement the two-tier goal-relevance metric and chart it against step index for a run that went wrong.",
      "Wire the trace to your eval suite: one command turning a run id into a C19 case.",
    ],
  },

  quiz: [
    { q: "Why is a flat log the wrong shape for agent debugging?",
      options: ["The unit of interest is a run — a tree of nested, long-running, large-payload operations — which a chronological stream cannot represent", "Logs are too slow to write", "Logs cannot store JSON", "Log levels are not expressive enough"],
      answer: 0,
      why: "A run spans seconds to minutes across nested model, tool and subagent calls, interleaved with other concurrent runs. Reconstructing one from a chronological stream is the problem tracing exists to remove." },
    { q: "A tool returns 4,000 tokens at step 3 of a 12-step run. What is its true cost?",
      options: ["Roughly ten times its apparent cost, because the observation is re-sent on every subsequent model call", "4,000 input tokens, once", "4,000 output tokens plus the model's response", "Nothing, if prompt caching is enabled"],
      answer: 0,
      why: "The message array is resent whole each iteration, so a big early observation is billed again on every later turn. Caching does not help, because it only covers the stable prefix, and a tool result lands after it." },
    { q: "Which attribute turns 'error rate' into something actionable?",
      options: ["`agent.terminal_state` — distinguishing answered, budget, stuck, blocked, error and cancelled", "`llm.model`", "`tool.name`", "`run.step`"],
      answer: 0,
      why: "A spike in 'blocked' means a credential expired; a spike in 'budget' means tasks got harder. Collapsing both into 'errors' loses the distinction that determines what you do next." },
    { q: "Why is tail sampling preferred over head sampling for agent traces?",
      options: ["The decision to keep a run can be made after you know its terminal state and step count, so anomalies are never dropped", "It uses less memory", "It is required by OpenTelemetry", "It produces smaller spans"],
      answer: 0,
      why: "Head sampling decides at the start, which means the one run you needed was dropped before anything went wrong. Tail sampling keeps every failure, every anomaly and the slow tail by construction." },
    { q: "Which signal moves earliest when an agent starts degrading?",
      options: ["Goal relevance per step, followed by repeat-detector fire rate", "Success rate", "Total token spend", "p99 latency"],
      answer: 0,
      why: "The example report shows relevance down 11% and repeats nearly doubled while success moved under a point. By the time success rate shifts significantly, users have already noticed." },
    { q: "What makes `AsyncLocalStorage` the right mechanism for span nesting?",
      options: ["The parent span is found automatically across awaits, so no context object has to be threaded through every function", "It is faster than passing parameters", "It guarantees spans are exported in order", "It provides automatic redaction"],
      answer: 0,
      why: "Without it, every function in the call path needs a context parameter, which is the kind of plumbing that gets skipped, and a skipped context means an orphaned span and a missing branch of the tree." },
  ],

  continues: p(`You can now see what your agent does and what it costs. The remaining question is what happens when someone <em>wants</em> it to do something else. An agent that reads untrusted content, holds credentials, and can act is a genuinely new kind of security problem. ${ch("c21", "C21")} is the one chapter where the honest answer is sometimes "do not build that".`),
};

export default chapter;
