import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const TAX_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Four failure layers and the recovery that belongs to each">
  <text x="14" y="18" class="d-label">FOUR LAYERS — EACH NEEDS A DIFFERENT RECOVERY, AND ONLY ONE WANTS A RETRY</text>

  <rect x="14" y="30" width="672" height="52" rx="6" class="d-box-t"/>
  <text x="28" y="50" class="d-text">1 · transport — 429, 503, socket reset, timeout</text>
  <text x="28" y="68" class="d-mono" fill="var(--fg-faint)">RECOVER: retry with jitter. invisible to the model. the ONLY layer where retrying is the answer.</text>

  <rect x="14" y="88" width="672" height="52" rx="6" class="d-box-p"/>
  <text x="28" y="108" class="d-text">2 · tool — bad args, not found, permission denied, empty result</text>
  <text x="28" y="126" class="d-mono" fill="var(--fg-faint)">RECOVER: feed back as an observation. the model fixes it next turn. never throw. (C03)</text>

  <rect x="14" y="146" width="672" height="52" rx="6" class="d-box-a"/>
  <text x="28" y="166" class="d-text">3 · reasoning — loops, drift, wrong tool, premature completion</text>
  <text x="28" y="184" class="d-mono" fill="var(--fg-faint)">RECOVER: detect from OUTSIDE and inject an observation the model cannot generate itself. (C04, C10)</text>

  <rect x="14" y="204" width="672" height="52" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="28" y="224" class="d-text" fill="var(--danger)">4 · task — the goal is impossible, ambiguous, or wrong</text>
  <text x="28" y="242" class="d-mono" fill="var(--fg-faint)">RECOVER: stop and ask. no amount of retrying makes a missing permission appear.</text>

  <text x="14" y="284" class="d-mono" fill="var(--danger)">the universal bug: treating a layer-2, 3 or 4 failure as layer 1, and retrying it.</text>
</svg>`;

const chapter: Chapter = {
  id: "c12",
  num: 12,
  layer: "reasoning",
  title: "Failure & Recovery",
  subtitle: "Four layers of failure, and why only one of them wants a retry",
  blurb:
    "A taxonomy of how agents fail and the specific recovery each layer needs. Retry policy, circuit breakers, budget enforcement, graceful degradation, and the rule that an agent must never fail without returning what it already learned.",
  lines: 193,
  file: "code/c12_failure.ts",
  tags: ["retries", "backoff", "circuit breaker", "degradation", "error taxonomy", "budgets", "partial results"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "try/catch is not a strategy",
      html:
        p(`The instinct when an agent fails is to wrap the loop in <code>try/catch</code> and retry. That is correct for about one failure in five and actively harmful for the rest: retrying a malformed tool call produces the same malformed call, retrying a reasoning loop produces the same loop more expensively, and retrying an impossible task wastes a minute before telling the user what it could have said immediately.`) +
        p(`Agent failures come in four layers, and each has exactly one right response. Getting them confused is the most common source of "it works in the demo" behaviour.`) +
        note("key", "The rule that matters most", p(`<strong>An agent must never fail empty.</strong> Whatever went wrong, it did some work first, and that work has value. Returning "I was unable to complete this request" after nine successful steps destroys real value and teaches the user not to trust it. Every terminal state in this chapter returns partial results.`)) },

    { id: "core-idea", kicker: "Core idea", title: "The four layers",
      html:
        fig({ label: "Diagram", title: "failure layers and their recoveries", body: TAX_SVG,
          caption: `Reading a failure to the right layer is most of the work. Once classified, each recovery is a handful of lines.` }) +
        `<h3>1 · Transport — retry, invisibly</h3>` +
        p(`Rate limits, 5xx, socket resets, timeouts. The model never needs to know. ${ch("c01", "C01")} built this: full jitter, honour <code>retry-after</code>, never retry an <code>AbortError</code>. The one addition here is a <strong>circuit breaker</strong>, because retrying into a dead dependency turns a degraded system into a stalled one.`) +
        code({ title: "code/c12_failure.ts — a breaker per dependency",
          src: `export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0; private openedAt = 0;

  constructor(private cfg = { threshold: 5, cooldownMs: 30_000, name: "dep" }) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt < this.cfg.cooldownMs) {
        // Fail immediately and informatively — the agent can route around a known-down tool.
        throw new CircuitOpenError(this.cfg.name, this.cfg.cooldownMs - (Date.now() - this.openedAt));
      }
      this.state = "half-open";          // let exactly one probe through
    }
    try {
      const out = await fn();
      this.failures = 0; this.state = "closed";
      return out;
    } catch (e) {
      if (++this.failures >= this.cfg.threshold) { this.state = "open"; this.openedAt = Date.now(); }
      throw e;
    }
  }
}`,
        }) +
        p(`The breaker's real value in an agent is not protecting the dependency; it is that <code>"search_docs is unavailable for another 24 seconds"</code> is an <em>observation the agent can act on</em>. It will try a different tool. A hanging retry storm gives it nothing to work with.`) +
        `<h3>2 · Tool — feed it back</h3>` +
        p(`Covered in ${ch("c03", "C03")} and worth restating because it is the highest-return line of code in the course: every tool failure becomes a <code>tool_result</code> with <code>isError</code> and an actionable message. The model recovers in one step. Nothing throws.`) +
        `<h3>3 · Reasoning — detect from outside</h3>` +
        p(`The agent cannot see its own loops, drift, or premature completion, because from inside the context each step looks locally reasonable. These must be detected by code watching the trace and injected as observations (${ch("c04", "C04")}, ${ch("c10", "C10")}).`) +
        `<h3>4 · Task — stop and ask</h3>` +
        p(`The goal is impossible ("delete the production database" — no permission), ambiguous ("update the config" — which one), or wrong ("fix the failing test" — the test is correct and the code is right, the requirement changed). No recovery loop helps. The correct behaviour is to stop early and say precisely what is blocking, which is both cheaper and more useful than failing late.`) },

    { id: "mechanics", kicker: "Mechanics", title: "Classification, and the budget that catches everything else",
      html:
        code({ title: "classify before you react",
          src: `export function classify(e: unknown, ctx: { tool?: Tool; state: RunState }): Layer {
  if (e instanceof CircuitOpenError) return { layer: 1, action: "observe", retryable: false };
  if (e instanceof HttpError) {
    if ([429, 500, 502, 503, 504].includes(e.status)) return { layer: 1, action: "retry" };
    if (e.status === 401 || e.status === 403) return { layer: 4, action: "stop" };  // never retryable
    if (e.status === 404) return { layer: 2, action: "observe" };
    if (e.status === 400) return { layer: 2, action: "observe" };   // WE sent something wrong
  }
  if (e instanceof ValidationError) return { layer: 2, action: "observe" };
  if (e instanceof TimeoutError) {
    // The critical branch: can we safely try again?
    return ctx.tool?.idempotent
      ? { layer: 1, action: "retry" }
      : { layer: 2, action: "observe", note: "may have taken effect — verify before retrying" };
  }
  if (e instanceof AbortError) return { layer: 4, action: "stop" };  // the caller cancelled
  return { layer: 2, action: "observe" };   // default to recoverable: the loop is good at this
}`,
        }) +
        p(`Two lines carry disproportionate weight. <strong>401/403 is layer 4, never layer 1</strong> — retrying an auth failure is the single most common wasted retry, and it never once succeeds. <strong>400 is layer 2</strong>: a 400 means <em>we</em> sent something wrong, which is exactly the thing the model can fix if told.`) +
        `<h3>Budgets are the backstop for everything unclassified</h3>` +
        p(`Classification handles known failures. Budgets bound the unknown ones, and there should be several, each with its own degradation.`) +
        table(["Budget", "Typical", "On exhaustion"], [
          ["Steps", "10–20", "Partial report with next steps"],
          ["Tokens", "Context window × 4", "Compact hard, then partial report"],
          ["Wall clock", "The user's patience", "Partial report, offer to resume (${C08})"],
          ["Money", "Per-run and per-tenant", "Hard stop; page someone if it is per-tenant"],
          ["Tool calls per tool", "5–10 each", "Disable that tool and tell the model why"],
        ].map((r) => r.map((c) => c.replace("${C08}", `<a href="/c08/" class="mono">C08</a>`))) as string[][]) +
        p(`The last one is underused and cheap. An agent that has called <code>search_docs</code> nine times is not searching, it is thrashing. Removing the tool from its schema and saying so — <em>"search_docs is disabled for this run after 9 calls; use list_sections or ask the user"</em> — forces a genuinely different approach.`) +
        `<h3>Degrade in a defined order</h3>` +
        code({ title: "a ladder, not a cliff",
          src: `const LADDER: Degradation[] = [
  { at: 0.70, name: "compact",      apply: (s) => s.context.compactNow() },
  { at: 0.80, name: "drop tools",   apply: (s) => s.tools.keepOnly(s.plan.toolsStillNeeded()) },
  { at: 0.85, name: "cheap model",  apply: (s) => s.model = s.models.small },
  { at: 0.90, name: "narrow goal",  apply: (s) => s.plan.dropOptionalSteps() },
  { at: 0.95, name: "final report", apply: (s) => s.finishWithPartial() },
];
// Each rung is announced to the model as an observation, because an agent that
// knows it is running out of budget prioritises. One that is silently degraded
// keeps planning as if it had room.`,
        }) +
        note("good", "Tell the agent it is degrading", p(`Injecting <em>"you have used 85% of your budget; finish what you can and report"</em> produces measurably better behaviour than silently shrinking its resources. Models consolidate and prioritise when told there is a deadline, and do neither when the deadline is invisible.`)) },

    { id: "explore", kicker: "Explore", title: "Inject failures and watch the policy",
      html:
        p(`Set a failure mix and a recovery policy, and see what fraction of runs complete, what the wasted spend is, and how often the user gets something useful rather than an apology.`) +
        lab({ label: "Simulator", title: "recovery policy under a failure mix",
          body: `
<div class="controls">
  <div class="ctl"><label>transport failure rate</label><input type="range" id="e12-t" min="0" max="30" step="1" value="6"><span class="val" id="e12-t-v">6%</span></div>
  <div class="ctl"><label>tool failure rate</label><input type="range" id="e12-o" min="0" max="30" step="1" value="10"><span class="val" id="e12-o-v">10%</span></div>
  <div class="ctl"><label>reasoning failure rate</label><input type="range" id="e12-r" min="0" max="30" step="1" value="8"><span class="val" id="e12-r-v">8%</span></div>
  <div class="ctl"><label>policy</label>
    <select id="e12-p">
      <option value="throw">throw on any error</option>
      <option value="blind">retry everything 3×</option>
      <option value="class" selected>classify by layer</option>
      <option value="full">classify + detectors + degrade</option>
    </select></div>
</div>
<div id="e12-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="e12-done">—</b><span>completed fully</span></div>
  <div class="stat"><b id="e12-part">—</b><span>useful partial</span></div>
  <div class="stat"><b id="e12-empty">—</b><span>failed empty</span></div>
  <div class="stat"><b id="e12-waste">—</b><span>wasted spend</span></div>
</div>
<div class="note" id="e12-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var t = +document.getElementById("e12-t").value / 100, o = +document.getElementById("e12-o").value / 100,
      r = +document.getElementById("e12-r").value / 100, pol = document.getElementById("e12-p").value;
  ["t","o","r"].forEach(function (k, i) {
    var el = document.getElementById("e12-" + k); el.nextElementSibling.textContent = el.value + "%"; });

  // recovery effectiveness per layer, per policy
  var REC = {
    throw: { t: 0,   o: 0,   r: 0,   deg: 0 },
    blind: { t: .92, o: .06, r: .04, deg: 0 },
    class: { t: .96, o: .88, r: .10, deg: 0 },
    full:  { t: .96, o: .90, r: .74, deg: 1 }
  }[pol];
  var waste = { throw: 1.0, blind: 2.4, class: 1.12, full: 1.22 }[pol];

  var rows = [["transport (429, 5xx, resets)", t, REC.t], ["tool (bad args, 404, empty)", o, REC.o],
              ["reasoning (loops, drift, early stop)", r, REC.r]];
  document.getElementById("e12-rows").innerHTML = rows.map(function (x) {
    var col = x[2] > .8 ? "var(--ok)" : x[2] > .4 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:16rem;color:var(--fg-muted)">' + x[0] + ' · ' + Math.round(x[1] * 100) + '% of runs</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (x[2] * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:6rem;text-align:right">' + Math.round(x[2] * 100) + '% recovered</span></div>';
  }).join("");

  var fail = rows.reduce(function (a, x) { return a * (1 - x[1] * (1 - x[2])); }, 1);
  var done = fail;
  var remaining = 1 - done;
  var partial = REC.deg ? remaining * 0.82 : remaining * (pol === "throw" ? 0 : 0.12);
  var empty = remaining - partial;

  document.getElementById("e12-done").textContent = Math.round(done * 100) + "%";
  document.getElementById("e12-part").textContent = Math.round(partial * 100) + "%";
  document.getElementById("e12-empty").textContent = Math.round(empty * 100) + "%";
  document.getElementById("e12-waste").textContent = waste.toFixed(2) + "×";

  var n = document.getElementById("e12-note");
  if (pol === "throw") n.innerHTML = "<b>Any error ends the run.</b> Every transport blip and every mistyped tool name costs a complete run, and the user gets nothing back — not even the four things the agent had already established.";
  else if (pol === "blind") n.innerHTML = "<b>Retry everything.</b> Transport is fixed; nothing else is. Retrying a malformed tool call reproduces it, and note the 2.4× wasted spend — you are paying to repeat failures that were never going to succeed.";
  else if (pol === "class") n.innerHTML = "<b>Classification works.</b> Transport retried, tool errors fed back, and waste near baseline. Reasoning failures are still untouched because they are invisible from inside the error handler — they need detectors watching the trace.";
  else n.innerHTML = "<b>The full policy.</b> Detectors catch most reasoning failures, and the degradation ladder converts almost every remaining failure into a useful partial result. Look at the 'failed empty' figure: that is the number the user experiences as the product being broken.";
}
["e12-t","e12-o","e12-r","e12-p"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Compare "retry everything" with "classify by layer" at the same failure rates. Completion is similar; wasted spend differs by 2×. Then switch to the full policy and watch "failed empty" collapse. That single number is what users mean when they say an agent is unreliable.`,
        }) },

    { id: "build", kicker: "Build it", title: "Recovery as one function",
      html:
        code({ title: "code/c12_failure.ts — the handler the loop calls",
          src: `export async function recover(
  e: unknown, ctx: { tool?: Tool; state: RunState; attempt: number },
): Promise<Recovery> {
  const c = classify(e, ctx);

  switch (c.action) {
    case "retry":
      if (ctx.attempt >= 5) return { kind: "observe", content: \`\${label(e)} after 5 attempts. This dependency is unavailable — try a different approach.\` };
      await sleep(fullJitter(ctx.attempt));
      return { kind: "retry" };

    case "observe":
      // The model's next turn sees this and adapts. No exception escapes.
      return { kind: "observe", content: message(e, c) };

    case "stop":
      // Layer 4: stop, but never empty.
      return { kind: "stop", reason: c.layer === 4 ? "blocked" : "cancelled",
               report: await partialReport(ctx.state, blockingReason(e)) };
  }
}`,
        }) +
        code({ title: "the partial report — the most important 20 lines in the chapter",
          src: `export async function partialReport(state: RunState, why: string): Promise<string> {
  const res = await state.model([...state.messages, userText(
\`You must stop now: \${why}

Write a final report. Do not call tools.
1. ESTABLISHED — what you determined, each with the evidence that supports it.
2. IN PROGRESS — what you were doing when you stopped.
3. UNKNOWN — what you did not find out, and the exact next step for each.
4. BLOCKED BY — if something specific stopped you, name it precisely enough that
   a human could unblock it (a permission, a missing credential, a contradictory
   requirement).

Be concrete. "I made some progress" is worthless; "I confirmed the order shipped
on 2 March and found the tracking number, but the carrier API returns 403 — the
API key appears to lack the tracking scope" is actionable.\`)],
    { temperature: 0, maxTokens: 1200 });

  return textOf(res.content);
}`,
        }) +
        p(`That example in the prompt is doing real work: showing the model what "concrete" means produces concrete reports, and asking for it abstractly does not. The report is also the resume point for ${ch("c08", "C08")} and the handoff note for a human — one call, three uses.`) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c12_failure.ts

#   C12 · Failure & Recovery
#
#   classification — the same try/catch, four different right answers
#
#     layer 1  retry    429 rate limited
#     layer 1  retry    503 from the provider
#     layer 4  stop     403 on a tool              authorisation will not appear by retrying
#     layer 2  observe  400 bad request
#     layer 2  observe  invalid tool arguments
#     layer 1  retry    timeout, read-only tool
#     layer 2  observe  timeout, send_email        may have taken effect — verify before retrying
#     layer 4  stop     user cancelled
#
#     403 is layer 4, never layer 1 — it is the most common wasted retry in agent code.
#     400 is layer 2 — WE sent something wrong, which is exactly what the model can fix.
#
#   circuit breaker — the value is legibility, not protection
#
#     attempt 1 failed (HTTP 503) → layer 1, retry
#     attempt 2 failed (HTTP 503) → layer 1, retry
#     attempt 3 failed (HTTP 503) → layer 1, retry
#     circuit OPEN — "search_docs is unavailable for another 30s. Use list_sections instead."
#     circuit OPEN — "search_docs is unavailable for another 30s. Use list_sections instead."
#
#     Once open, the agent gets an observation it can route around rather than a hang.
#
#   per-tool budgets — a thrashing tool is removed, once, with an alternative
#
#     call 5: search_docs has been used 5 times and is now disabled for this run — it is not producing new information. Try list_sections instead, or ask the user for what you are missing.
#     available tools now: list_sections, search_orders
#
#   500 runs · injected 6% transport, 10% tool, 8% reasoning failures
# …
#      95%  final report   "Stop now and write your partial report."`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Alert on terminal-state distribution, not on error count.</strong> The useful chart is the share of runs ending answered / partial / blocked / budget / error, over time. A shift from "answered" to "budget" means something got harder; a shift to "blocked" usually means a credential expired.`,
          `<strong>Per-tenant money budgets are a safety feature.</strong> One customer with a pathological input can generate thousands of steps. A hard per-tenant cap with an alert is the difference between a surprising invoice and an incident.`,
          `<strong>Make errors boring and specific.</strong> <code>"Request failed"</code> costs a debugging session. <code>"carrier.track returned 403; key kd_live_...8f2 lacks scope 'tracking'"</code> costs thirty seconds. Both are one line to write.`,
          `<strong>Idempotency keys remove the worst class entirely.</strong> ${ch("c08", "C08")} makes the case; this chapter is where it pays off. With a key, a timeout is just a retry, and the "may have taken effect" branch never runs.`,
          `<strong>Frameworks give you max-iterations and stop there.</strong> LangGraph, AutoGen and the vendor SDKs all cap the loop. None of them decides what the user gets when the cap hits. That is <code>partialReport()</code>, and it is yours to write.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Classify each to a layer and give the recovery: (a) 429; (b) 403 on a tool; (c) the model calls <code>serach_docs</code>; (d) the agent has called the same search five times; (e) the user asked to "fix the bug" with no further detail.`,
      answer: ul([
        `<b>(a) Layer 1.</b> Retry with full jitter, honour <code>retry-after</code>. Invisible to the model.`,
        `<b>(b) Layer 4.</b> Stop. A permission does not appear by retrying. Report which credential lacks which scope — that is the sentence that gets it fixed.`,
        `<b>(c) Layer 2.</b> Observation naming the real tools and the nearest match. Recovered next turn.`,
        `<b>(d) Layer 3.</b> Not visible as an error at all — it must be detected by the repeat detector and injected as an observation.`,
        `<b>(e) Layer 4.</b> Stop and ask, immediately. Guessing which bug costs ten steps and produces a change nobody wanted.`,
      ]) + p(`Note that (b) and (e) are both "stop", and both should happen within the first two steps. Failing fast is a feature when the failure is definitional.`) },

    { difficulty: "core",
      prompt: `An agent calls a flaky API that fails 20% of the time transiently. Design the full policy: retries, circuit breaker, and what the agent is told.`,
      answer: code({ title: "layered, and legible to the model",
        src: `const flaky = defineTool({
  name: "get_inventory", idempotent: true, timeoutMs: 8_000,
  description: \`Live inventory for a SKU. This service is intermittently unavailable;
if it fails twice, proceed with the last known figures from get_catalog and say so
in your answer rather than retrying further.\`,          // ← policy the MODEL can follow
  async run({ sku }, ctx) {
    return breaker.call(() => retry(() => api.inventory(sku), {
      attempts: 3, baseMs: 200, capMs: 2_000,            // fast retries: transient blips
      retryOn: (e) => e.status >= 500 || e.status === 429,
    }));
  },
});

// Breaker: 5 failures in a row → open for 30s. While open the tool returns an
// observation, not an exception:
//   "get_inventory is unavailable (circuit open, retry in 24s). Use get_catalog
//    for last-known stock levels, and note the staleness in your answer."` }) +
      ul([
        `<strong>Three layers, each doing its own job.</strong> Retries absorb single blips (sub-second, invisible). The breaker absorbs a sustained outage (stops the storm, fails fast). The description tells the model what to do when both give up — which is the layer everyone forgets.`,
        `<strong>Fast retries, not exponential-to-30s.</strong> Inside an agent step, a retry ladder that takes 30 seconds has already blown the user's patience. Cap the total retry window at roughly one second for interactive tools and let the breaker handle anything longer.`,
        `<strong>Idempotent matters here.</strong> A read is trivially safe to retry. The same policy on a non-idempotent write would need the timeout branch from ${ch("c08", "C08")}.`,
        `<strong>Name the fallback in the description.</strong> "Use get_catalog and say so" turns a dependency outage into a degraded-but-correct answer instead of a failed run.`,
      ]) },

    { difficulty: "core",
      prompt: `Implement the per-tool call budget: after N calls to one tool, remove it and tell the model. What are the failure modes of doing this naively?`,
      answer: code({ title: "disable with an explanation and an alternative",
        src: `export class ToolBudget {
  private counts = new Map<string, number>();
  constructor(private limits: Record<string, number>, private fallbacks: Record<string, string>) {}

  record(name: string): void { this.counts.set(name, (this.counts.get(name) ?? 0) + 1); }

  available(all: Tool[]): Tool[] {
    return all.filter((t) => (this.counts.get(t.name) ?? 0) < (this.limits[t.name] ?? Infinity));
  }

  justDisabled(name: string): string | null {
    const n = this.counts.get(name) ?? 0;
    if (n !== (this.limits[name] ?? Infinity)) return null;     // fire exactly once
    return \`\${name} has been used \${n} times and is now disabled for this run. \` +
           \`It is not producing new information. \` +
           (this.fallbacks[name] ? \`Try \${this.fallbacks[name]} instead, or \` : "") +
           \`ask the user for what you are missing.\`;
  }
}` }) +
      p(`<strong>Failure modes of the naive version:</strong>`) +
      ul([
        `<strong>Silent removal.</strong> The tool vanishes from the schema and the model keeps requesting it, getting "unknown tool" errors and no idea why. Always announce it, once, with the reason.`,
        `<strong>No alternative offered.</strong> Disabling the only search tool without naming a fallback leaves the agent with nothing to do but give up. Every budgeted tool needs a named next-best option or an explicit "ask the user".`,
        `<strong>Counting legitimate use.</strong> A file-reading agent may legitimately call <code>read_file</code> forty times. Budget the tools that <em>thrash</em> — search, list, retry-prone lookups — not the ones that do bulk work. Better still, budget on <em>distinct arguments</em>: twenty reads of twenty files is fine, twenty reads of the same file is not.`,
        `<strong>Firing repeatedly.</strong> Announcing the disablement every turn wastes tokens and reads as nagging. Fire exactly on the transition.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Design the alerting for a production agent: what to alert on, what to dashboard, and what to ignore. Include at least one leading indicator.`,
      answer: p(`<strong>Page someone (wake a human):</strong>`) +
        ul([
          `Per-tenant spend over its cap — this is a runaway loop and it compounds.`,
          `Terminal state "blocked" above baseline — a credential expired or a permission changed, and every affected run is failing identically.`,
          `Any tool's error rate above 50% for five minutes — a dependency is down and the breaker is holding, but the agent is degraded.`,
          `"Failed empty" above 2% — users are getting nothing back.`,
        ]) +
        p(`<strong>Dashboard (look at it daily):</strong> terminal-state distribution over time; steps-to-completion histogram split by outcome; cost per successful run; tool error rates and p99 latencies; router fallback rate (${ch("c11", "C11")}).`) +
        p(`<strong>Leading indicators — the point of the exercise:</strong>`) +
        ul([
          `<strong>The p95 of steps-to-completion, for runs that succeeded.</strong> This rises <em>before</em> the success rate falls. An agent taking 9 steps for what used to take 5 is already going wrong; it is still succeeding, so nothing alerts, and next week it will not be.`,
          `<strong>Repeat-detector fire rate.</strong> An increase means the agent is thrashing more often, usually because a tool started returning less useful results or a prompt change removed a hint.`,
          `<strong>Degradation-ladder rung reached.</strong> Runs hitting "drop tools" that never used to is a context or budget regression.`,
        ]) +
        p(`<strong>Ignore:</strong> individual 429s and 5xx (that is what retries are for; alert on the <em>rate of retry exhaustion</em> instead), individual tool errors (layer 2 is a normal, recoverable part of operation), and raw model latency (you care about end-to-end, and a slow model call inside a 9-step run is noise).`) },
  ],

  qa: [
    { q: "How many retries?", a: p(`Three to five for transport, with full jitter and a total window matched to the caller's patience — about one second inside an interactive tool, longer for background work. Zero for everything else: layer 2 goes back to the model, layer 4 stops. If you find yourself wanting six, you want a circuit breaker.`) },
    { q: "Should the agent retry its own reasoning?", a: p(`Re-running the same model call on the same context mostly reproduces the same output, so a bare retry is close to useless. What works is changing something: inject the observation that describes what went wrong (the repeat detector's message), or fork before the bad turn (${ch("c08", "C08")}) and re-run at a higher temperature. Both change the input; a retry does not.`) },
    { q: "What if a partial report is embarrassing?", a: p(`It is more embarrassing to have done nine steps of work and returned nothing. A report that says "I confirmed A and B, I could not do C because the API key lacks the tracking scope" is a good product experience and an actionable bug report. The version to avoid is a partial report that <em>sounds</em> complete, hence the explicit UNKNOWN and BLOCKED BY sections.`) },
    { q: "Do I need circuit breakers if I have retries?", a: p(`Yes, for a different job. Retries handle a blip; a breaker handles an outage. It stops fifty concurrent agents from retrying into a dead service, and it converts the failure into a fast, informative observation the agent can route around. Without it, a downed dependency turns every run into a slow failure.`) },
    { q: "How do I test failure handling without breaking production?", a: p(`A failure-injecting mock model and tool registry: configurable rates per layer, deterministic under a seed, in your test suite. That is what generated this chapter's numbers. Add the specific failures you have actually seen in production as named scenarios — an expired token, a 200 with an empty body, a tool that returns HTML instead of JSON — and they become regression tests.`) },
  ],

  project: {
    title: "Project · Make your agent hard to kill",
    brief: p(`Add the four-layer recovery policy to your agent, then prove it with injected failures. The headline number is "failed empty" — get it under 1%.`),
    spec: [
      "<code>classify(error, ctx)</code> mapping every error to a layer and an action, with 401/403 as layer 4 and 400 as layer 2.",
      "Retries with full jitter for layer 1 only, and a circuit breaker per dependency whose open state returns an observation naming the retry time.",
      "Layer 2 failures returned as tool results; nothing escapes the tool boundary as an exception.",
      "Per-tool call budgets that disable a thrashing tool once, with a reason and a named alternative.",
      "A degradation ladder with at least three rungs, each announced to the model.",
      "<code>partialReport()</code> with ESTABLISHED / IN PROGRESS / UNKNOWN / BLOCKED BY, called on every non-success terminal state.",
      "A failure-injection harness reporting completed / partial / empty / spend across at least four policies.",
    ],
    stretch: [
      "Add per-tenant money budgets with an alert, and prove a pathological input stops rather than compounding.",
      "Make the partial report resumable: feed it back as the starting context for a new run and measure how many steps are saved versus starting over.",
      "Add your real production failures as named scenarios in the harness.",
    ],
  },

  quiz: [
    { q: "Which failure layer is the only one where retrying is the right response?",
      options: ["Transport — 429s, 5xx, resets, timeouts on idempotent operations", "Tool errors like bad arguments", "Reasoning failures like loops", "Task failures like missing permissions"],
      answer: 0,
      why: "Retrying a malformed tool call reproduces it, retrying a loop reproduces the loop more expensively, and retrying a 403 never succeeds. Only transient transport faults are fixed by trying again." },
    { q: "A tool returns 403. What layer is it and what should happen?",
      options: ["Layer 4 — stop and report which credential lacks which permission", "Layer 1 — retry with backoff", "Layer 2 — feed back and let the model try different arguments", "Layer 3 — inject an observation about looping"],
      answer: 0,
      why: "A permission does not appear by retrying, and no rephrasing of arguments creates authorisation. Stopping in step two with a precise, fixable message beats failing in step nine after a retry storm." },
    { q: "Why must an agent never fail empty?",
      options: ["It typically completed real work before failing, and discarding it destroys value and trust", "Empty failures are harder to log", "The API charges for failed runs", "Users cannot distinguish empty failures from timeouts"],
      answer: 0,
      why: "Nine successful steps followed by 'I was unable to complete this request' is both a bad product and a waste of money already spent. One extra model call turns it into a report that is useful and resumable." },
    { q: "What does a circuit breaker give an agent that retries alone do not?",
      options: ["A fast, informative observation — 'this tool is down for 24 more seconds' — that the agent can route around", "Lower token usage", "Automatic failover to another provider", "Protection against malformed arguments"],
      answer: 0,
      why: "The breaker's value inside an agent is legibility. A hanging retry storm gives the model nothing; 'unavailable, try get_catalog instead' makes it choose a different approach immediately." },
    { q: "Why announce budget degradation to the model rather than silently shrinking resources?",
      options: ["Models consolidate and prioritise when told there is a deadline, and do neither when it is invisible", "It satisfies logging requirements", "It prevents the model from calling disabled tools", "It reduces token usage"],
      answer: 0,
      why: "An agent that knows it is at 85% of budget starts wrapping up. One that is silently degraded keeps planning as if it had room, and then gets cut off mid-thought." },
    { q: "What is the best leading indicator that an agent is degrading in production?",
      options: ["Rising p95 steps-to-completion among runs that still succeed", "Total error count", "Average model latency", "Number of tools registered"],
      answer: 0,
      why: "It moves before the success rate does. An agent taking nine steps for what used to take five is already going wrong while every dashboard still looks green, which is exactly when you want to know." },
  ],

  continues: p(`The agent is now reliable within the world you gave it: a few tools, some documents, a model. That world is small. The next four chapters widen it — code execution, the filesystem and shell, a protocol for other people's tools, and the human who has to approve the parts that can do damage. ${ch("c13", "C13")} starts with the tool that subsumes all the others.`),
};

export default chapter;
