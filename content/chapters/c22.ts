import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const SERVE_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Serving architecture: API, queue, workers, event log, and the SSE stream back">
  <defs><marker id="s22" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="s22a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="18" class="d-label">THE REQUEST DOES NOT HOLD THE RUN — THAT IS THE WHOLE DESIGN</text>

  <rect x="14" y="34" width="84" height="40" rx="6" class="d-box"/>
  <text x="56" y="58" class="d-mono" text-anchor="middle">client</text>
  <path d="M102 48 L136 48" class="d-arrow" marker-end="url(#s22)"/>
  <text x="119" y="40" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">POST</text>

  <rect x="140" y="34" width="96" height="40" rx="6" class="d-box-a"/>
  <text x="188" y="52" class="d-mono" text-anchor="middle">API</text>
  <text x="188" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">returns runId</text>

  <path d="M240 54 L274 54" class="d-arrow" marker-end="url(#s22)"/>
  <rect x="278" y="34" width="96" height="40" rx="6" class="d-box-p"/>
  <text x="326" y="58" class="d-mono" text-anchor="middle">queue</text>

  <path d="M378 54 L412 54" class="d-arrow" marker-end="url(#s22)"/>
  <rect x="416" y="24" width="120" height="26" rx="4" class="d-box-t"/><text x="476" y="41" class="d-mono" text-anchor="middle">worker 1</text>
  <rect x="416" y="54" width="120" height="26" rx="4" class="d-box-t"/><text x="476" y="71" class="d-mono" text-anchor="middle">worker 2</text>
  <rect x="416" y="84" width="120" height="26" rx="4" class="d-box" stroke-dasharray="2 2"/><text x="476" y="101" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">…scale on depth</text>

  <path d="M540 54 L572 54" class="d-arrow-a" marker-end="url(#s22a)"/>
  <rect x="576" y="34" width="110" height="40" rx="6" class="d-box-m"/>
  <text x="631" y="52" class="d-mono" text-anchor="middle">event log</text>
  <text x="631" y="66" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">C08 · durable</text>

  <path d="M631 78 L631 120 L188 120 L188 82" class="d-arrow-a" marker-end="url(#s22a)"/>
  <text x="410" y="114" class="d-mono" text-anchor="middle" fill="var(--accent)">GET /runs/:id/events — SSE, resumable with Last-Event-ID</text>

  <path d="M140 60 L106 60" class="d-arrow-a" marker-end="url(#s22a)"/>

  <line x1="14" y1="146" x2="686" y2="146" stroke="var(--border)"/>
  <text x="14" y="168" class="d-label">WHY NOT JUST RUN IT IN THE REQUEST HANDLER</text>
  <text x="14" y="190" class="d-mono" fill="var(--danger)">✗ a 4-minute run holds an HTTP connection · a deploy kills it · a dropped client loses the work</text>
  <text x="14" y="208" class="d-mono" fill="var(--danger)">✗ an approval (C16) blocks a thread for 40 minutes · concurrency = connections, not capacity</text>
  <text x="14" y="232" class="d-mono" fill="var(--ok)">✓ the run is a durable object with an id. the connection is a view of it, and may come and go.</text>

  <text x="14" y="264" class="d-label">THE FOUR ENDPOINTS</text>
  <text x="14" y="284" class="d-mono">POST /runs · GET /runs/:id · GET /runs/:id/events (SSE) · POST /runs/:id/interrupt</text>
</svg>`;

const chapter: Chapter = {
  id: "c22",
  num: 22,
  layer: "systems",
  title: "Shipping",
  subtitle: "Sessions, streaming, concurrency, and the first week in production",
  blurb:
    "Putting the agent behind an API: why the run must outlive the request, resumable SSE, queue-based concurrency, rate-limit arithmetic, and the operational questions that appear the moment real users arrive.",
  lines: 260,
  file: "code/c22_serving.ts",
  tags: ["SSE", "streaming", "sessions", "queues", "concurrency", "rate limits", "deploys", "multi-tenancy"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The request handler that ran an agent",
      html:
        p(`The obvious first server runs the agent inside the HTTP handler and streams tokens back. It works in development and breaks on contact with production, in four specific ways:`) +
        ul([
          `<strong>A four-minute run holds a connection.</strong> Load balancers time out, mobile clients drop, and your concurrency limit becomes "how many open sockets" rather than "how much work can we do".`,
          `<strong>A deploy kills every run in flight.</strong> Rolling restarts are routine; losing every in-progress task on each one is not.`,
          `<strong>A dropped client loses the work.</strong> The user closed the tab at step nine; the eight steps of progress and the money already spent evaporate.`,
          `<strong>An approval blocks a thread.</strong> ${ch("c16", "C16")} asks a human, who is at lunch. You are now holding a request open for forty minutes.`,
        ]) +
        note("key", "The one architectural decision", p(`<strong>The run is a durable object with an id; the HTTP connection is a view of it.</strong> Clients attach, detach and reattach. ${ch("c08", "C08")} already built the durable part; this chapter is the plumbing around it.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Four endpoints",
      html:
        fig({ label: "Diagram", title: "API, queue, workers, event log", body: SERVE_SVG,
          caption: `Every interesting property — resumability, surviving deploys, approvals that do not hold threads, scaling on queue depth — falls out of separating the run from the connection.` }) +
        code({ title: "code/c22_serving.ts — the surface",
          src: `// 1. Start. Returns immediately. Idempotent on a client-supplied key.
POST /runs
  { goal, sessionId?, idempotencyKey? }
  → 202 { runId, status: "queued" }

// 2. Poll. Cheap, cacheable, works everywhere SSE does not.
GET /runs/:runId
  → { status, terminalState?, answer?, usage, steps, createdAt }

// 3. Stream. Resumable — the crucial property.
GET /runs/:runId/events           Last-Event-ID: 42
  → text/event-stream, replaying from event 43

// 4. Interrupt. Stop, pause, steer, or decide an approval (C16).
POST /runs/:runId/interrupt
  { kind: "stop" | "pause" | "steer" | "approve", message?, callId?, approved? }
  → 202`,
        }) +
        `<h3>Resumable streaming is the whole trick</h3>` +
        code({ title: "SSE with an id on every event",
          src: `app.get("/runs/:id/events", async (req, res) => {
  const from = Number(req.headers["last-event-id"] ?? 0);

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",   // no-transform: proxies WILL buffer otherwise
    "connection": "keep-alive",
    "x-accel-buffering": "no",                   // nginx specifically
  });

  // 1. Replay what the client missed. This is why reconnection is seamless.
  for (const e of await log.readFrom(req.params.id, from)) send(res, e);

  // 2. Then follow live.
  const unsub = bus.subscribe(req.params.id, (e) => send(res, e));

  // 3. Heartbeat, or intermediaries close an idle connection at 30–60s —
  //    and an agent thinking for 45 seconds produces no events.
  const hb = setInterval(() => res.write(": ping\\n\\n"), 15_000);

  req.on("close", () => { clearInterval(hb); unsub(); });
});

const send = (res: Response, e: StoredEvent) =>
  res.write(\`id: \${e.seq}\\nevent: \${e.event.t}\\ndata: \${JSON.stringify(e.event)}\\n\\n\`);`,
        }) +
        p(`Three details that are each an afternoon of debugging if missed. <strong><code>id:</code> on every event</strong>, because that is what the browser sends back as <code>Last-Event-ID</code> and without it reconnection restarts from scratch. <strong>Heartbeats</strong>, because an agent thinking for 45 seconds looks identical to a dead connection to every proxy between you and the user. <strong><code>no-transform</code> and <code>x-accel-buffering</code></strong>, because a buffering proxy will hold your stream and deliver it all at the end, which looks exactly like "streaming is broken" and is not your code.`) +
        `<h3>What to stream</h3>` +
        table(["Event", "Content"], [
          ["<code>step_started</code>", "Step number and a one-line human summary — \"Searching orders for 4471\""],
          ["<code>tool_started</code> / <code>tool_finished</code>", "Tool name, the <em>summary</em>, duration, ok/error. Never raw arguments or raw results"],
          ["<code>plan_updated</code>", "The rendered todo list (${C09}) — the best progress indicator there is"],
          ["<code>text_delta</code>", "Token deltas, but only for the final answer"],
          ["<code>approval_requested</code>", "The full request (${C16}) — the client renders the dialog"],
          ["<code>done</code>", "Terminal state, answer, usage"],
        ].map((r) => r.map((c) => c.replace("${C09}", `<a href="/c09/" class="mono">C09</a>`).replace("${C16}", `<a href="/c16/" class="mono">C16</a>`))) as string[][]) +
        p(`Users track an agent through its <em>actions</em>, not its prose. A plan updating and tool activity scrolling by communicates progress far better than a token stream of reasoning, and streaming raw tool arguments leaks internal identifiers and file paths into a UI you do not control.`) },

    { id: "mechanics", kicker: "Mechanics", title: "Concurrency, limits, and sessions",
      html:
        `<h3>Rate limits are token-based, and that changes the arithmetic</h3>` +
        code({ title: "the capacity calculation people get wrong",
          src: `// Providers limit input tokens per minute far more tightly than requests per minute.
// An agent is an input-token workload (C01), so you hit the token ceiling first.
//
//   limit                 800,000 input tokens/min
//   avg context per call   18,000 tokens
//   → 44 model calls per minute, total, across every concurrent run
//
//   avg run = 6 calls, avg call = 1.4s of model time
//   → ~7 runs started per minute, ~15 concurrent runs in flight
//
// Naively provisioning "100 concurrent agents" produces 429s at about 15.
// Admission control belongs in front of the queue, not in the retry handler.

export class TokenBudgetLimiter {
  private window: Array<{ at: number; tokens: number }> = [];

  async admit(estimatedTokens: number): Promise<boolean> {
    const cutoff = Date.now() - 60_000;
    this.window = this.window.filter((w) => w.at > cutoff);
    const used = this.window.reduce((t, w) => t + w.tokens, 0);
    if (used + estimatedTokens > this.limit * 0.85) return false;   // headroom for retries
    this.window.push({ at: Date.now(), tokens: estimatedTokens });
    return true;
  }
}`,
        }) +
        `<h3>Fairness: one tenant must not starve the rest</h3>` +
        code({ title: "per-tenant queues, weighted round-robin",
          src: `// A single FIFO queue means one customer submitting 500 runs blocks everyone.
class FairQueue {
  private queues = new Map<string, Run[]>();
  private cursor = 0;

  next(): Run | null {
    const tenants = [...this.queues.keys()];
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[(this.cursor + i) % tenants.length];
      const q = this.queues.get(t)!;
      if (q.length && this.inFlight(t) < this.maxPerTenant(t)) {
        this.cursor = (this.cursor + i + 1) % tenants.length;
        return q.shift()!;
      }
    }
    return null;
  }
}
// Plus a per-tenant concurrency cap and a per-tenant spend cap (C12). The spend cap
// is the one that turns a pathological input into an alert instead of an invoice.`,
        }) +
        `<h3>Sessions: a thread of runs, not a long-lived object</h3>` +
        code({ title: "what carries forward, and what does not",
          src: `interface Session {
  id: string; userId: string; tenantId: string;
  runIds: string[];
  // Carried forward: the durable, small things.
  memory: Memory[];                  // C07
  summary: string;                   // a compacted account of prior runs (C05)
  artifacts: Array<{ path: string; description: string }>;   // offloaded outputs
  // NOT carried: the raw message arrays of previous runs. That is what compaction is for.
}

// A new run in a session starts from: system prompt + memory + session summary + goal.
// Not from a concatenation of every prior transcript — that is how a session becomes
// unusable by the fifth exchange.`,
        }) +
        note("warn", "The deploy question", p(`Workers must drain, not die. On <code>SIGTERM</code>: stop accepting from the queue, let in-flight runs reach the next checkpoint, release leases, and exit. Runs then resume on a new worker via ${ch("c08", "C08")}'s replay. Without this, every deploy is an incident for whoever was mid-task, and you deploy more often than you think.`)) +
        `<h3>Idempotency at the edge</h3>` +
        code({ title: "double-submit is the normal case, not the edge case",
          src: `// Mobile retries, users double-click, load balancers replay. An agent run is expensive
// and may have side effects, so the POST must be idempotent.
const existing = await runs.byIdempotencyKey(tenantId, body.idempotencyKey);
if (existing) return res.status(202).json({ runId: existing.id, status: existing.status });
// Key scoped per tenant, TTL 24h. Same key + different body = 409, not a silent overwrite.`,
        }) },

    { id: "explore", kicker: "Explore", title: "Size the system",
      html:
        p(`Set your traffic and limits, and find where the system actually saturates. It is rarely where people expect.`) +
        lab({ label: "Simulator", title: "capacity and queueing",
          body: `
<div class="controls">
  <div class="ctl"><label>runs started / min</label><input type="range" id="p22-r" min="1" max="120" step="1" value="20"><span class="val" id="p22-r-v">20</span></div>
  <div class="ctl"><label>avg model calls / run</label><input type="range" id="p22-c" min="2" max="20" step="1" value="6"><span class="val" id="p22-c-v">6</span></div>
  <div class="ctl"><label>avg context / call</label><input type="range" id="p22-t" min="2000" max="60000" step="1000" value="18000"><span class="val" id="p22-t-v">18,000 tok</span></div>
  <div class="ctl"><label>provider limit</label><select id="p22-l"><option value="400000">400K tok/min</option><option value="800000" selected>800K tok/min</option><option value="2000000">2M tok/min</option></select></div>
  <div class="ctl"><label>workers</label><input type="range" id="p22-w" min="1" max="60" step="1" value="16"><span class="val" id="p22-w-v">16</span></div>
</div>
<div id="p22-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="p22-bind">—</b><span>binding constraint</span></div>
  <div class="stat"><b id="p22-wait">—</b><span>queue wait p50</span></div>
  <div class="stat"><b id="p22-429">—</b><span>429 rate</span></div>
  <div class="stat"><b id="p22-cost">—</b><span>$ / hour</span></div>
</div>
<div class="note" id="p22-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var R = +document.getElementById("p22-r").value, C = +document.getElementById("p22-c").value,
      T = +document.getElementById("p22-t").value, L = +document.getElementById("p22-l").value,
      W = +document.getElementById("p22-w").value;
  document.getElementById("p22-r-v").textContent = R;
  document.getElementById("p22-c-v").textContent = C;
  document.getElementById("p22-t-v").textContent = T.toLocaleString() + " tok";
  document.getElementById("p22-w-v").textContent = W;

  var tokensNeeded = R * C * T;                       // per minute
  var tokenCap = L * 0.85;                            // usable, keeping headroom
  var callsPerMin = tokenCap / T;
  var runsFromTokens = callsPerMin / C;

  var runSeconds = C * 1.5 + C * 0.9;                 // model + tool time
  var runsFromWorkers = (W * 60) / runSeconds;

  var capacity = Math.min(runsFromTokens, runsFromWorkers);
  var util = R / capacity;
  // M/M/c-ish queueing blow-up near saturation
  var wait = util < 1 ? (util * util) / (1 - util) * runSeconds : 999;
  var r429 = tokensNeeded > L ? Math.min(0.9, (tokensNeeded - L) / tokensNeeded) : 0;

  var rows = [
    ["provider token limit", runsFromTokens],
    ["worker capacity", runsFromWorkers],
    ["offered load", R]
  ];
  var mx = Math.max.apply(null, rows.map(function (x) { return x[1]; }));
  document.getElementById("p22-rows").innerHTML = rows.map(function (x) {
    var isBind = x[1] === capacity && x[0] !== "offered load";
    var col = x[0] === "offered load" ? (util > 1 ? "var(--danger)" : "var(--accent)") : isBind ? "var(--danger)" : "var(--ok)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:12rem;color:var(--fg-muted)">' + x[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + Math.min(100, x[1] / mx * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:7rem;text-align:right">' + x[1].toFixed(1) + ' runs/min</span></div>';
  }).join("");

  document.getElementById("p22-bind").textContent = runsFromTokens < runsFromWorkers ? "provider tokens" : "workers";
  document.getElementById("p22-wait").textContent = util >= 1 ? "unbounded" : wait.toFixed(1) + "s";
  document.getElementById("p22-429").textContent = Math.round(r429 * 100) + "%";
  document.getElementById("p22-cost").textContent = "$" + (Math.min(R, capacity) * 60 * C * T * 3 / 1e6).toFixed(0);

  var n = document.getElementById("p22-note");
  if (util >= 1) n.innerHTML = "<b>Saturated.</b> Offered load exceeds capacity, so the queue grows without bound and wait time goes to infinity. Admission control — rejecting or shedding at the edge — is the only correct response; retries make it worse.";
  else if (runsFromTokens < runsFromWorkers) n.innerHTML = "<b>Token-limited, not worker-limited.</b> Adding workers does nothing: you would generate more calls against the same provider ceiling and convert queue wait into 429s. The levers are context size (C05), prompt caching, and a higher limit.";
  else if (util > .8) n.innerHTML = "<b>Above 80% utilisation.</b> Note the queue wait — it is quadratic near saturation, so the last 20% of capacity costs disproportionate latency. Target 60–70% and scale on queue depth.";
  else n.innerHTML = "<b>Comfortable.</b> Worker-limited with headroom. Scale workers on queue depth, and watch the token figure as context grows — a context-size regression silently converts this into the token-limited case.";
}
["p22-r","p22-c","p22-t","p22-l","p22-w"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Push "avg context per call" from 18K to 40K without changing anything else. Capacity halves. Context size is a capacity decision as much as a cost one, which is the operational argument for ${ch("c05", "C05")}.`,
        }) },

    { id: "build", kicker: "Build it", title: "The worker loop",
      html:
        code({ title: "code/c22_serving.ts — lease, run, checkpoint, drain",
          src: `export async function worker(queue: Queue, log: EventLog, cfg: AgentConfig) {
  let draining = false;
  process.on("SIGTERM", () => { draining = true; });     // stop taking work, finish what we have

  while (!draining) {
    const job = await queue.claim({ leaseMs: 30_000 });   // lease + fencing token (C08)
    if (!job) { await sleep(250); continue; }

    const heartbeat = setInterval(() => queue.renew(job).catch(() => ctrl.abort()), 10_000);
    const ctrl = new AbortController();

    try {
      const result = await runAgent(job.runId, log, {
        ...cfg,
        signal: ctrl.signal,
        emit: (e) => { void log.append(job.runId, [e]); bus.publish(job.runId, e); },
        onSuspend: async (reason) => {                    // approval, or a drain
          await queue.release(job, { resumeOn: reason });
          return "suspended";
        },
      });
      await queue.complete(job, result);
    } catch (e) {
      // Retryable → back on the queue with backoff. Terminal → record and stop.
      await (isRetryable(e) ? queue.retry(job, backoff(job.attempts)) : queue.fail(job, e));
    } finally {
      clearInterval(heartbeat);
    }
  }

  await queue.releaseAll();                               // let another worker resume them
  process.exit(0);
}`,
        }) +
        p(`The <code>onSuspend</code> callback is what makes approvals free: the run releases its lease and leaves the queue entirely. When a human decides, the decision is appended to the log and the run is re-queued, and a completely different worker picks it up and replays. No thread was held, and a deploy in between changes nothing.`) +
        `<h3>The client, which is simpler than people expect</h3>` +
        code({ title: "start, stream, reconnect",
          src: `export async function* runAgentRemote(goal: string, opts: { sessionId?: string } = {}) {
  const { runId } = await post("/runs", { goal, ...opts, idempotencyKey: crypto.randomUUID() });

  let lastId = 0;
  for (;;) {
    const es = new EventSource(\`/runs/\${runId}/events\`);   // browser resends Last-Event-ID
    try {
      for await (const e of events(es)) {
        lastId = Number(e.lastEventId) || lastId;
        yield JSON.parse(e.data);
        if (e.type === "done") return;
      }
    } catch { /* network blip */ }
    es.close();
    await sleep(500);                                       // reconnect; the server replays
  }
}`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c22_serving.ts

#   C22 · Shipping
#
#   resumable SSE — a 20-second dropout
#
#     before the drop:  received events 1, 2
#     during the drop:  2 events published to the durable log
#     on reconnect:     Last-Event-ID: 2 → replayed 3, 4
#
#     Seamless, because every event carried an id: and was persisted before publish.
#     content-type: text/event-stream
#     cache-control: no-cache, no-transform
#     connection: keep-alive
#     x-accel-buffering: no
#
#   leases and fencing tokens — two workers, one run
#
#     worker A claims r_1 with token 1, lease until t=30000
#     worker A pauses (GC / network partition). t=40000, lease expired.
#     reaper released 1 expired lease(s)
#     worker B claims r_1 with token 2
#     worker A wakes and tries to write → fenced: token 1 < 2 (another worker took over)
#
#     A TTL alone is not enough: a paused worker believes it still holds the lease.
#
#   fair queueing — one tenant submitting 500 runs must not block the rest
#
#     claim order: noisy-tenant → quiet-tenant → noisy-tenant → other-tenant
#     The quiet tenants were served within the first few claims despite being
#     submitted last, and the noisy tenant is capped at 2 concurrent runs.
#
#   capacity — the arithmetic people get wrong
#
# …
#     object with an id and the connection was only ever a view of it.`,
        }) },

    { id: "production", kicker: "Production notes", title: "The first week",
      html:
        ul([
          `<strong>The first incident is almost always rate limits.</strong> Token-per-minute, hit at a concurrency number far below what anyone estimated. Admission control in front of the queue, plus context-size discipline, is the fix; more workers is not.`,
          `<strong>The second is a runaway loop on one tenant.</strong> Per-tenant spend caps with alerts (${ch("c12", "C12")}) turn it into a page instead of an invoice.`,
          `<strong>Buffering proxies will eat your stream.</strong> nginx, some CDNs, and a few corporate proxies buffer <code>text/event-stream</code> by default. Set <code>no-transform</code> and <code>x-accel-buffering: no</code>, and test through the real edge rather than against localhost.`,
          `<strong>Long runs need a progress contract.</strong> If nothing is emitted for 30 seconds, users assume it has hung. Emit something — even "still working: reading 40 files" — on a timer.`,
          `<strong>Version your agent like an API.</strong> Record the prompt version, tool versions and model id on every run. When behaviour changes, the first question is what deployed, and it should be answerable from the run record rather than from git archaeology.`,
          `<strong>Warm the cache deliberately.</strong> A cold prompt cache after a deploy makes the first minutes expensive and slow. If your system prompt is large, send a warming request per worker on startup.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `A user's browser reconnects to an SSE stream after a 20-second dropout. What must the server do for the experience to be seamless, and what breaks if you skip it?`,
      answer: p(`The server must read <code>Last-Event-ID</code>, replay every event after that sequence number from the durable log, and then follow live. That is possible only because every event carried an <code>id:</code> field and every event was persisted before being published.`) +
        p(`Skip the <code>id:</code> and the browser sends nothing on reconnect, so the server starts from live. The user misses everything that happened during the dropout, and the UI shows a plan that jumps or an answer with a hole in it. Skip the persistence and there is nothing to replay from.`) +
        p(`The third thing to get right: publish to the bus <em>after</em> appending to the log, never before. Otherwise a client can receive an event that is not yet durable, and a crash makes the client's view diverge from the run's actual history.`) },

    { difficulty: "core",
      prompt: `Design the session model for an agent used by the same person across days. What carries forward, what does not, and where does it go wrong?`,
      answer: table(["Carry forward", "Why", "Where it lives"], [
        ["Semantic memories about the user", "Preferences and facts stay true", "Memory store (${C07})"],
        ["A rolling session summary", "Continuity without the transcript", "Compacted after each run (${C05})"],
        ["Artifact pointers", "Files and reports produced earlier", "Paths plus one-line descriptions"],
        ["Open threads", "\"You asked me to follow up on X\"", "Explicit, small, list"],
      ].map((r) => r.map((c) => c.replace("${C07}", `<a href="/c07/" class="mono">C07</a>`).replace("${C05}", `<a href="/c05/" class="mono">C05</a>`))) as string[][]) +
      p(`<strong>Does not carry forward:</strong> raw message arrays from previous runs. Concatenating them makes the fifth exchange unaffordable and the tenth impossible, and it buries the current goal under a week of scrollback.`) +
      p(`<strong>Where it goes wrong, in order of likelihood:</strong>`) +
      ul([
        `<strong>The summary becomes lossy in a compounding way.</strong> Summarising a summary of a summary loses specifics fast. Summarise from the <em>original</em> run records each time rather than re-summarising the previous summary.`,
        `<strong>Stale context asserted confidently.</strong> "You are working on the auth migration" three weeks after it shipped. Timestamp everything carried forward and decay it (${ch("c07", "C07")}).`,
        `<strong>Privacy across a shared session.</strong> If a session can be handed to a colleague, memories written during it must be scoped so the second person does not inherit the first's private context.`,
        `<strong>Unbounded growth of "open threads".</strong> Cap it, and expire items nobody has touched.`,
      ]) },

    { difficulty: "core",
      prompt: `Your provider limit is 800K input tokens/min. Average context per call is 22K and runs average 7 calls. How many concurrent runs can you support, and what are the three levers if you need double?`,
      answer: p(`Usable capacity at 85% headroom is 680,000 tokens/min ÷ 22,000 = <strong>~31 model calls/min</strong>. At 7 calls per run that is <strong>~4.4 runs started per minute</strong>. With a run taking roughly 17 seconds of model-plus-tool time, in-flight concurrency is about <strong>1.3 runs</strong>, dramatically lower than intuition suggests, and the reason "we'll run 50 agents in parallel" fails immediately.`) +
        p(`<strong>Three levers, in order of value:</strong>`) +
        ol([
          `<strong>Cut context per call.</strong> 22K → 11K exactly doubles capacity. Offloading large tool results (${ch("c05", "C05")}) and capping chatty tools (${ch("c03", "C03")}) is usually worth this on its own, and it halves cost at the same time.`,
          `<strong>Prompt caching.</strong> Cached input tokens often count differently against limits as well as costing less — check your provider's accounting, because if cached reads are discounted against the quota this is close to free capacity.`,
          `<strong>Cut calls per run.</strong> 7 → 4 by promoting a fixed tool sequence into a chain (${ch("c11", "C11")}) is a 75% capacity increase, and it reduces latency too.`,
        ]) +
        p(`A raised provider limit is the fourth lever and the one to ask for last, because the first three also reduce cost and latency while a higher limit only removes a ceiling.`) },

    { difficulty: "stretch",
      prompt: `Write the operational runbook for the first week: launch checklist, the three most likely incidents with their diagnosis and fix, and the rollback plan.`,
      answer: p(`<strong>Launch checklist</strong>`) +
        ul([
          `Per-tenant concurrency and spend caps configured, with alerts wired to a human.`,
          `Admission control in front of the queue, sized from the token arithmetic, not from worker count.`,
          `Graceful drain verified — kill a worker under load and confirm zero lost runs and zero duplicate side effects.`,
          `SSE verified through the real edge (CDN, load balancer, corporate proxy), not localhost.`,
          `Four dashboard numbers live (${ch("c20", "C20")}): terminal-state distribution, p95 steps among successes, cost per successful run, caused-token ranking.`,
          `Eval suite green, with the per-tag gate (${ch("c19", "C19")}).`,
          `Run id surfaced in the UI and included in every support path.`,
          `Kill switch: a flag that stops new runs while letting in-flight ones finish.`,
        ]) +
        p(`<strong>Incident 1 — 429 storm.</strong> <em>Diagnosis:</em> provider 429 rate rising, queue depth rising, worker CPU low. <em>Fix now:</em> reduce admission rate; do not add workers. <em>Fix properly:</em> measure context per call, find the tool inflating it, cap it.`) +
        p(`<strong>Incident 2 — one tenant consuming everything.</strong> <em>Diagnosis:</em> spend by tenant is skewed, fair-queue cursor stuck, other tenants' wait times climbing. <em>Fix now:</em> drop that tenant's concurrency cap. <em>Fix properly:</em> find the pathological input, add it as an eval case, cap the loop that ran away.`) +
        p(`<strong>Incident 3 — "the agent got worse after the deploy".</strong> <em>Diagnosis:</em> compare the four numbers before and after; check the prompt/model/tool versions recorded on runs; run the eval suite against both versions paired. <em>Fix now:</em> roll back. <em>Fix properly:</em> the change that regressed should have been caught by a per-tag gate — add the case that would have caught it.`) +
        p(`<strong>Rollback plan.</strong> Agent behaviour is defined by prompt version + model id + tool versions, all recorded per run, all deployable independently of the binary. Rolling back is a config change, not a redeploy. In-flight runs finish on the old version. Do not migrate a run's configuration mid-flight, or you get behaviour neither version was tested with (${ch("c08", "C08")}'s log-version rule).`) },
  ],

  qa: [
    { q: "SSE or WebSockets?", a: p(`SSE, almost always. It is one-directional, which matches the shape (the server streams, the client occasionally POSTs an interrupt), it reconnects and replays natively via <code>Last-Event-ID</code>, and it survives proxies better. WebSockets are worth it only for genuinely bidirectional, low-latency interaction such as voice.`) },
    { q: "Do I need a queue for low volume?", a: p(`Not for volume — for <em>durability</em>. The queue is what lets a run outlive a request, survive a deploy, and suspend for an approval. Even at one run a minute, an in-handler agent loses work on every restart. A database table with a lease works fine as a queue.`) },
    { q: "How do I handle a client that never reconnects?", a: p(`Let the run finish and store the result. Agent work is usually valuable independently of whether anyone is watching, and the durable log means the user can retrieve it later from another device. Cancel only if the run is expensive and clearly abandoned, and make that a policy decision with a timeout rather than an implicit consequence of a socket closing.`) },
    { q: "Should the same server handle chat and agent runs?", a: p(`Separate them. Chat is sub-second and latency-sensitive; agent runs are minutes and throughput-sensitive. Sharing a worker pool means a burst of agent runs adds seconds to every chat response. Different pools, different scaling signals, possibly different provider quotas.`) },
    { q: "How do I test all this locally?", a: p(`An in-memory queue and event bus behind the same interfaces, a mock model (${ch("c01", "C01")}), and a chaos switch that kills workers at random. The load and chaos results in this chapter came from exactly that setup. It runs offline, it is deterministic under a seed, and it catches the drain and resume bugs that only appear under restart.`) },
  ],

  project: {
    title: "Project · Put your agent behind an API",
    brief: p(`Ship the agent as a service. The bar is a chaos test: kill a worker mid-run under load and have zero lost runs, zero duplicate side effects, and no visible user impact.`),
    spec: [
      "The four endpoints, with <code>POST /runs</code> idempotent on a client key scoped per tenant.",
      "Resumable SSE: <code>id:</code> on every event, replay from <code>Last-Event-ID</code>, heartbeats, and anti-buffering headers.",
      "A queue with leases and fencing tokens (C08), workers that drain on SIGTERM, and runs that resume on another worker.",
      "Suspension for approvals that releases the lease entirely — no thread held while a human decides.",
      "Token-based admission control sized from the real arithmetic, plus per-tenant concurrency and spend caps.",
      "A fair queue that prevents one tenant starving the rest.",
      "A session model carrying memory, a summary and artifact pointers — never raw transcripts.",
      "A chaos test: kill workers randomly under load and assert the three properties above.",
    ],
    stretch: [
      "Add the capacity calculator to your dashboard, computing the binding constraint from live token usage.",
      "Record prompt version, model id and tool versions on every run, and make rollback a config change.",
      "Run a load test at 60%, 80% and 95% of capacity and chart queue wait — then explain the curve to someone.",
    ],
  },

  quiz: [
    { q: "Why must an agent run outlive the HTTP request that started it?",
      options: ["Runs take minutes, deploys restart processes, clients drop, and approvals wait on humans — a held connection loses all of it", "HTTP has a hard 60-second limit", "Streaming requires a separate connection", "It reduces token usage"],
      answer: 0,
      why: "The run becomes a durable object with an id and the connection becomes a view of it. Resumability, surviving deploys, and non-blocking approvals all fall out of that one separation." },
    { q: "What makes an SSE stream resumable?",
      options: ["An `id:` on every event plus a durable log to replay from, so `Last-Event-ID` can be honoured", "Keeping the TCP connection alive", "Buffering events in server memory", "Using WebSockets instead"],
      answer: 0,
      why: "The browser resends the last id it saw. Without ids it sends nothing and the client silently misses everything that happened during the dropout; without persistence there is nothing to replay." },
    { q: "Why do heartbeats matter on an agent's event stream?",
      options: ["An agent can think for 45 seconds with no events, which is indistinguishable from a dead connection to every proxy in between", "They keep the model warm", "They measure latency", "They are required by the SSE specification"],
      answer: 0,
      why: "Intermediaries close idle connections at 30–60 seconds. A comment line every 15 seconds keeps it open. The related trap is buffering proxies, which need `no-transform` and `x-accel-buffering: no`." },
    { q: "Your provider limit is token-based. What happens if you add workers?",
      options: ["More calls against the same ceiling — queue wait becomes 429s, and capacity does not improve", "Capacity scales linearly with workers", "Latency improves but cost rises", "Nothing, since workers are cheap"],
      answer: 0,
      why: "Agents are input-token workloads, so the token ceiling binds first. The real levers are smaller context per call, prompt caching, and fewer calls per run, each of which also reduces cost." },
    { q: "How should an approval be handled at the serving layer?",
      options: ["The run releases its lease and leaves the queue; the decision is appended to the log and re-queues it for any worker", "A worker blocks on a promise until the human responds", "The request handler holds the connection open", "The run is cancelled and restarted after approval"],
      answer: 0,
      why: "Humans take minutes to hours. Suspending to durable state means no thread is held, a deploy in between is harmless, and a different worker resumes by replaying, which is C08's design paying off." },
    { q: "What must a worker do on SIGTERM?",
      options: ["Stop claiming work, let in-flight runs reach a checkpoint, release leases, then exit — so runs resume elsewhere", "Exit immediately to speed the deploy", "Finish every in-flight run to completion regardless of duration", "Cancel in-flight runs and notify the users"],
      answer: 0,
      why: "Exiting immediately makes every deploy an incident for whoever was mid-task. Draining to the queue with released leases means another worker replays and continues, with no visible impact." },
  ],

  continues: p(`Every mechanism in the course now exists. The last two chapters assemble them into complete systems: a deep-research agent that plans, searches, verifies and cites, and a coding agent that reads, patches and tests your files. ${ch("c23", "C23")} builds the first, and it is the chapter where the earlier chapters stop being separate ideas.`),
};

export default chapter;
