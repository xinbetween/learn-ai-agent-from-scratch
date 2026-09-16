import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const DUR_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Checkpointing an agent run, with replay and fork">
  <defs><marker id="d8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="d8a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="18" class="d-label">THE RUN IS AN APPEND-ONLY LOG OF EVENTS, NOT A VARIABLE IN MEMORY</text>

  <line x1="30" y1="70" x2="670" y2="70" stroke="var(--border-strong)" stroke-width="2"/>
  <g class="d-mono">
    <circle cx="60"  cy="70" r="6" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="160" cy="70" r="6" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="260" cy="70" r="6" fill="var(--accent)" stroke="var(--accent)"/>
    <circle cx="360" cy="70" r="6" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="460" cy="70" r="6" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
    <circle cx="560" cy="70" r="6" fill="var(--danger)" stroke="var(--danger)"/>
  </g>
  <text x="60"  y="56" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">e1</text>
  <text x="160" y="56" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">e2</text>
  <text x="260" y="56" class="d-mono" text-anchor="middle" fill="var(--accent)">e3 ✓ckpt</text>
  <text x="360" y="56" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">e4</text>
  <text x="460" y="56" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">e5</text>
  <text x="560" y="56" class="d-mono" text-anchor="middle" fill="var(--danger)">✗ crash</text>

  <text x="60"  y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model</text>
  <text x="160" y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">tool</text>
  <text x="260" y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">tool</text>
  <text x="360" y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">model</text>
  <text x="460" y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">write!</text>

  <path d="M560 84 C 560 130, 300 130, 268 86" class="d-arrow-a" marker-end="url(#d8a)" fill="none"/>
  <text x="414" y="132" class="d-mono" text-anchor="middle" fill="var(--accent)">resume from last checkpoint — replay e4, e5 from the log, do not re-execute</text>

  <line x1="14" y1="156" x2="686" y2="156" stroke="var(--border)"/>
  <text x="14" y="178" class="d-label">REPLAY RULE — THE ONLY RULE THAT MATTERS</text>

  <rect x="14" y="190" width="326" height="56" rx="6" class="d-box-t"/>
  <text x="26" y="210" class="d-mono">recorded result exists → REPLAY it</text>
  <text x="26" y="228" class="d-mono" fill="var(--fg-faint)">no model call, no tool call, no money, no side effect</text>

  <rect x="360" y="190" width="326" height="56" rx="6" class="d-box-a"/>
  <text x="372" y="210" class="d-mono">no recorded result → EXECUTE it</text>
  <text x="372" y="228" class="d-mono" fill="var(--fg-faint)">record the result before acting on it</text>

  <text x="14" y="274" class="d-mono" fill="var(--danger)">the dangerous case: a write tool that ran but whose result was never recorded.</text>
  <text x="14" y="292" class="d-mono" fill="var(--fg-faint)">record intent BEFORE execution, then outcome after — two events, not one.</text>
</svg>`;

const chapter: Chapter = {
  id: "c08",
  num: 8,
  layer: "context",
  title: "State & Durability",
  subtitle: "Surviving a crash, a deploy, and a four-hour wait for approval",
  blurb:
    "An agent nine steps into a twelve-step task must not lose everything to a process restart. Event-sourced runs, checkpoints, deterministic replay, forking, and the exactly-once problem that side effects create.",
  lines: 241,
  file: "code/c08_durability.ts",
  tags: ["checkpointing", "event sourcing", "replay", "resumption", "forking", "idempotency", "time travel"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "Three things that end a run and should not",
      html:
        ul([
          `<strong>A deploy.</strong> Your agent is eight minutes into a research task. A rolling restart takes the process down. Everything is gone, including the €0.40 already spent and the four findings it had established.`,
          `<strong>An approval.</strong> The agent wants to send an email and needs a human to say yes (${ch("c16", "C16")}). The human is at lunch. Holding a process open for forty minutes to preserve an in-memory array is not a design, it is a hostage situation.`,
          `<strong>A question.</strong> "What would it have done if the search had returned nothing?" You cannot answer that unless you can re-enter the run at step 5 and branch.`,
        ]) +
        p(`All three are the same problem: the run's state lives in a local variable inside a <code>while</code> loop. Move it to a durable log and all three become easy, with replay debugging, forking and audit thrown in for free.`) +
        note("key", "The one-sentence design", p(`Make the run an <strong>append-only log of events</strong>, and make resumption mean <em>replaying recorded results rather than re-executing them</em>. Everything in this chapter follows from those two decisions.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Event-sourced runs",
      html:
        p(`Rather than storing a snapshot of <code>messages</code>, store every event that produced it. The snapshot is then a <em>fold</em> over the log, and you can fold up to any point you like.`) +
        code({ title: "code/c08_durability.ts — the event",
          src: `export type RunEvent =
  | { t: "run_started";    goal: string; system: string; limits: Limits }
  | { t: "model_called";   messagesHash: string }                      // intent
  | { t: "model_returned"; content: Block[]; usage: Usage; stopReason: StopReason }
  | { t: "tool_started";   callId: string; name: string; input: unknown }   // intent
  | { t: "tool_finished";  callId: string; content: string; isError: boolean; ms: number }
  | { t: "compacted";      summary: string; droppedTurns: number }
  | { t: "approval_requested"; callId: string }
  | { t: "approval_decided";   callId: string; approved: boolean; by: string }
  | { t: "run_finished";   outcome: Outcome; answer?: string };

export interface StoredEvent { seq: number; runId: string; at: number; event: RunEvent }

/** The entire state of a run is a fold over its events. */
export function project(events: StoredEvent[]): RunState {
  const s = emptyState();
  for (const { event } of events) apply(s, event);
  return s;
}`,
        }) +
        p(`Notice the pairing: <code>model_called</code> / <code>model_returned</code>, <code>tool_started</code> / <code>tool_finished</code>. The intent is recorded <em>before</em> the operation and the outcome after. That pairing is the entire basis of safe recovery. A <code>tool_started</code> with no matching <code>tool_finished</code> is precisely the "we do not know if it happened" case, and it is visible in the log rather than inferred.`) +
        `<h3>Replay, not re-execution</h3>` +
        code({ title: "the resumable loop — three lines different from C04",
          src: `export async function runAgent(runId: string, log: EventLog, cfg: AgentConfig) {
  const events = await log.read(runId);
  const state = project(events);                 // resume: rebuild from the log
  const replay = new ReplayCursor(events);       // knows which results are already recorded

  while (true) {
    if (budget.exceeded()) return degrade(...);

    // If this call was already made and recorded, reuse it. No API call, no charge.
    const res = replay.next("model_returned")
      ?? await recordCall(log, runId, () => cfg.model(state.messages, opts));

    // … identical to C04 from here …
    for (const call of calls) {
      const done = replay.next("tool_finished", call.id);
      const result = done ?? await recordTool(log, runId, call, () => executeTool(...));
    }
  }
}`,
        }) +
        p(`Resuming a nine-step run replays nine steps in about 20 milliseconds and costs nothing, because no model or tool is actually invoked. The agent then continues from step ten as if nothing happened. This is the same idea as durable execution engines (Temporal, Restate, Cloudflare Workflows), and it is worth knowing that it comes to roughly forty lines when you only need it for one loop.`) },

    { id: "mechanics", kicker: "Mechanics", title: "The side-effect problem",
      html:
        fig({ label: "Diagram", title: "checkpoint, crash, resume", body: DUR_SVG,
          caption: `The red case is the only genuinely hard one, and the two-event pairing is what makes it detectable rather than silent.` }) +
        `<h3>Three tool classes, three recovery rules</h3>` +
        table(["Class", "Example", "On resume with no recorded result"], [
          ["<b>Pure read</b>", "<code>search_docs</code>", "Just re-run it. Worst case is a slightly different result"],
          ["<b>Idempotent write</b>", "<code>set_status(id, 'done')</code>", "Re-run it. Same outcome by definition"],
          ["<b>Non-idempotent write</b>", "<code>send_email</code>, <code>charge_card</code>", "<b>Do not re-run.</b> Verify, or ask a human"],
        ]) +
        code({ title: "recovery that does not double-charge anyone",
          src: `async function recoverUnfinished(ev: StoredEvent & { event: { t: "tool_started" } }, reg: Registry) {
  const tool = reg[ev.event.name];

  if (tool.readOnly || tool.idempotent) return { action: "rerun" as const };

  // A verifier is a read tool that answers "did this effect land?".
  if (tool.verify) {
    const landed = await tool.verify(ev.event.input);
    return landed
      ? { action: "synthesise" as const, result: \`Completed before the interruption at \${iso(ev.at)}.\` }
      : { action: "rerun" as const };
  }

  // No verifier and not idempotent: the honest answer is that a human must decide.
  return { action: "escalate" as const,
           question: \`\${ev.event.name} was started but its outcome was never recorded. \` +
                     \`Input: \${JSON.stringify(ev.event.input)}. Did it complete?\` };
}`,
        }) +
        note("good", "The design that removes the problem", p(`Give every write tool an <strong>idempotency key</strong> derived from the call id, and the entire class disappears: re-running is always safe because the downstream system deduplicates. This is worth pushing into your internal APIs. It is the single biggest move you can make toward agents that are safe to resume, and it costs one column.`)) +
        `<h3>Forking: the debugging superpower</h3>` +
        p(`Because a run is a log, a fork is a prefix copy. Cheap, and it enables the question that is otherwise unanswerable: <em>what if this step had gone differently?</em>`) +
        code({ title: "counterfactuals for free",
          src: `export async function fork(log: EventLog, runId: string, atSeq: number, patch?: Partial<RunEvent>) {
  const events = (await log.read(runId)).filter((e) => e.seq <= atSeq);
  const forkId = newId();
  await log.append(forkId, events.map((e) => ({ ...e, runId: forkId })));
  if (patch) await log.append(forkId, [{ ...events.at(-1)!, event: { ...events.at(-1)!.event, ...patch } }]);
  return forkId;
}

// "What if search_docs had returned nothing at step 5?"
//   const f = await fork(log, runId, 5, { content: "No passages matched." });
//   await runAgent(f, log, cfg);     // the agent continues from there, for real`,
        }) +
        p(`This is also how you build ${ch("c19", "C19")}'s regression suite: a fork with a patched tool result is a test case, recorded from a real run rather than imagined.`) +
        `<h3>What to checkpoint, and how often</h3>` +
        p(`Append every event; the log <em>is</em> the checkpoint. What varies is durability: batching writes is faster and loses more on a crash. A reasonable default is to flush synchronously before any write-tool execution and after every model return, and batch everything else. The expensive things to lose are the model calls (money) and the write intents (safety).`) },

    { id: "explore", kicker: "Explore", title: "Crash it and bring it back",
      html:
        p(`Run an agent, crash it at an arbitrary point, and resume under different policies. Watch what gets re-executed, what gets replayed, and what gets double-sent.`) +
        lab({ label: "Simulator", title: "crash and resume",
          body: `
<div class="controls">
  <div class="ctl"><label>crash at step</label>
    <input type="range" id="d8-at" min="1" max="10" step="1" value="7"><span class="val" id="d8-at-v">7</span></div>
  <div class="ctl"><label>persistence</label>
    <select id="d8-p"><option value="none">in-memory only</option><option value="snap">snapshot every 3 steps</option><option value="log" selected>event log (append every event)</option></select></div>
  <div class="ctl"><label>write-tool recovery</label>
    <select id="d8-r"><option value="rerun">always re-run</option><option value="skip">always skip</option><option value="verify" selected>verify, else escalate</option></select></div>
  <div class="ctl"><label>idempotency keys</label>
    <select id="d8-i"><option value="0">no</option><option value="1">yes</option></select></div>
</div>
<div class="trace" id="d8-trace" style="max-height:15rem"></div>
<div class="stats">
  <div class="stat"><b id="d8-lost">—</b><span>steps lost</span></div>
  <div class="stat"><b id="d8-re">—</b><span>model calls repaid</span></div>
  <div class="stat"><b id="d8-dup">—</b><span>duplicate side effects</span></div>
  <div class="stat"><b id="d8-t">—</b><span>resume time</span></div>
</div>
<div class="note" id="d8-note" style="margin-top:1rem"></div>`,
          script: `
var STEPS = [
  { n: 1, k: "model", d: "decide: look up the order" },
  { n: 2, k: "read",  d: "search_orders({id:4471})" },
  { n: 3, k: "model", d: "decide: check the policy" },
  { n: 4, k: "read",  d: "search_policies({q:'electronics'})" },
  { n: 5, k: "model", d: "decide: the customer must be told" },
  { n: 6, k: "write", d: "send_email({to:'ana@…', subject:'Your refund'})" },
  { n: 7, k: "model", d: "decide: update the ticket" },
  { n: 8, k: "write", d: "close_ticket({id:882})  [idempotent]" },
  { n: 9, k: "model", d: "decide: done" },
  { n: 10, k: "done", d: "answer the user" }
];
function upd() {
  var at = +document.getElementById("d8-at").value, pers = document.getElementById("d8-p").value,
      rec = document.getElementById("d8-r").value, idem = document.getElementById("d8-i").value === "1";
  document.getElementById("d8-at-v").textContent = at;

  var lines = [], lost = 0, repaid = 0, dup = 0, ms = 0;
  var resumeFrom = pers === "none" ? 0 : pers === "snap" ? Math.floor((at - 1) / 3) * 3 : at - 1;

  lines.push(["sys", "run crashed after step " + at + " (mid-flight: step " + at + " intent recorded, outcome not)"]);
  lines.push(["sys", "resuming — state rebuilt to step " + resumeFrom]);

  for (var i = 0; i < STEPS.length; i++) {
    var s = STEPS[i];
    if (s.n <= resumeFrom) { lines.push(["obs", "replay  │ step " + s.n + " " + s.d + "   (0ms, $0)"]); ms += 2; continue; }
    if (s.n <= at) {
      lost++;
      if (s.k === "model") { repaid++; lines.push(["act", "re-run  │ step " + s.n + " " + s.d + "   (900ms, billed again)"]); ms += 900; }
      else if (s.k === "read") { lines.push(["act", "re-run  │ step " + s.n + " " + s.d + "   (safe: read-only)"]); ms += 300; }
      else if (s.k === "write") {
        var isIdem = s.d.indexOf("idempotent") >= 0 || idem;
        if (isIdem) lines.push(["obs", "re-run  │ step " + s.n + " " + s.d + "   (safe: idempotent key)"]);
        else if (rec === "rerun") { dup++; lines.push(["err", "RE-RUN  │ step " + s.n + " " + s.d + "   ⚠ SECOND EMAIL SENT"]); }
        else if (rec === "skip") { lines.push(["err", "skipped │ step " + s.n + " — may never have run. silent data loss."]); }
        else lines.push(["ans", "verify  │ step " + s.n + " → verifier says it landed. synthesised result, no resend."]);
        ms += 400;
      }
      continue;
    }
    lines.push(["act", "run     │ step " + s.n + " " + s.d]);
  }

  document.getElementById("d8-trace").innerHTML = lines.map(function (l) {
    return '<span class="ln r-' + (l[0] === "sys" ? "sys" : l[0] === "err" ? "err" : l[0] === "obs" ? "obs" : l[0] === "ans" ? "ans" : "act") + '">' + l[1] + '</span>';
  }).join("");
  document.getElementById("d8-lost").textContent = lost;
  document.getElementById("d8-re").textContent = repaid;
  document.getElementById("d8-dup").textContent = dup;
  document.getElementById("d8-t").textContent = ms < 1000 ? ms + " ms" : (ms / 1000).toFixed(1) + " s";

  var n = document.getElementById("d8-note");
  if (pers === "none") n.innerHTML = "<b>Nothing survives.</b> The whole run repeats — every model call billed twice, and every non-idempotent write executed twice. This is the default if you keep state in a local variable.";
  else if (pers === "snap") n.innerHTML = "<b>Snapshots lose the tail.</b> Everything since the last snapshot is re-executed, including writes. Snapshot frequency trades money against write hazard, and neither end of that trade is good.";
  else if (dup > 0) n.innerHTML = "<b>Duplicate side effect.</b> The log knew the email was <i>started</i> and never <i>finished</i> — and 'always re-run' took the unsafe branch. This is the bug that turns a crash into a customer complaint.";
  else n.innerHTML = "<b>Correct.</b> Everything before the crash replays for free, reads re-run safely, and the one unverified write is either checked or escalated instead of blindly repeated. Turn idempotency keys on and even that case becomes trivial.";
}
["d8-at","d8-p","d8-r","d8-i"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set persistence to in-memory and crash at step 9: the whole run repeats, including the email. Then switch to the event log with verify-else-escalate. The difference is about forty lines of code and one customer complaint.`,
        }) },

    { id: "build", kicker: "Build it", title: "An event log in one file",
      html:
        code({ title: "code/c08_durability.ts — append-only JSONL",
          src: `export class FileEventLog implements EventLog {
  constructor(private dir: string) {}

  async append(runId: string, events: RunEvent[]): Promise<void> {
    const path = join(this.dir, \`\${runId}.jsonl\`);
    const seq = await this.count(runId);
    const lines = events.map((e, i) =>
      JSON.stringify({ seq: seq + i, runId, at: Date.now(), event: e }) + "\\n").join("");
    // One append, O_APPEND: concurrent writers cannot interleave a partial line.
    await appendFile(path, lines, { flag: "a" });
  }

  async read(runId: string): Promise<StoredEvent[]> {
    const text = await readFile(join(this.dir, \`\${runId}.jsonl\`), "utf8").catch(() => "");
    return text.split("\\n").filter(Boolean).map((l) => JSON.parse(l));
    // A truncated final line means a crash mid-write. Drop it: the paired-event
    // design means a missing outcome event is handled, and a missing intent is a no-op.
  }
}`,
        }) +
        p(`JSONL on disk gets you crash recovery, <code>tail -f</code> for live debugging, <code>grep</code> for incident response, and a format anyone can read in an editor. Swap in Postgres or S3 later behind the same interface; the interesting part was never the storage.`) +
        code({ title: "the replay cursor",
          src: `export class ReplayCursor {
  private i = 0;
  constructor(private events: StoredEvent[]) {}

  /** Returns a recorded result if the next event matches, else null (meaning: execute). */
  next<T extends RunEvent["t"]>(type: T, callId?: string): Extract<RunEvent, { t: T }> | null {
    while (this.i < this.events.length) {
      const e = this.events[this.i].event;
      if (e.t === type && (!callId || (e as any).callId === callId)) { this.i++; return e as any; }
      // Intents and bookkeeping are skipped; only outcomes are replayable.
      if (isIntent(e) || isBookkeeping(e)) { this.i++; continue; }
      return null;
    }
    return null;
  }
}`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c08_durability.ts

#   C08 · State & Durability
#
#   crash between send_email and its outcome event (step 6)
#
#   policy               effect landed  emails sent  escalated  verdict
#   rerun                yes                      2      false  ⚠ DUPLICATE — customer emailed twice
#   rerun                no                       1      false  exactly once (correct)
#   skip                 yes                      1      false  exactly once (correct)
#   skip                 no                       0      false  ⚠ SILENT LOSS — nobody was emailed
#   verify               yes                      1      false  exactly once (correct)
#   verify               no                       1      false  exactly once (correct)
#   verify-no-verifier   yes                      1       true  a human decides (correct)
#   verify-no-verifier   no                       0       true  a human decides (correct)
#
#   "rerun" duplicates when the effect had landed. "skip" loses it silently when
#   it had not. Only verification distinguishes the two — and when no verifier
#   exists, stopping to ask a human is the only honest option for money.
#
#   An idempotency key derived from (runId, callId) removes this table entirely:
#   re-running becomes safe, and the escalation branch is never reached.
#
#   replay cost, crashing after each of the 9 steps (verify policy)
#
#   crash after  replayed  re-executed  model calls
#             3         3            6            5
#             6         5            3            5
#             9         9            0            5
#
#   A recorded outcome replays in microseconds and costs nothing. Without the log,
#   every one of those runs would have repaid all 5 model calls from the start.
#
#   fork(r, seq 4, patch the search result → "no results") → r~4
#   5 events copied; the original is untouched (19 events).
#   That is a counterfactual test case recorded from a real run rather than imagined.`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>LangGraph checkpointers</strong> persist graph state after every node, which is what makes its human-in-the-loop interrupts work: the process can exit while a human decides. Same idea, applied at the graph edge rather than the loop iteration.`,
          `<strong>Temporal, Restate, Cloudflare Workflows and DBOS</strong> generalise this as durable execution: your code looks like a normal function, the framework records every side effect and replays on resume. If your agent is long-running and stateful, these are the right shape, and they impose the same discipline this chapter does, which is that <em>everything non-deterministic must go through a recorded boundary</em>.`,
          `<strong>The determinism requirement is real.</strong> A resumed run must reach the same state from the same log, so <code>Date.now()</code>, <code>Math.random()</code> and unrecorded I/O in your agent code will silently diverge on replay. Route them through the log too, or keep them out of state-affecting paths.`,
          `<strong>Event logs are your audit trail.</strong> "What did the agent do on 14 March and why" is answerable from the log with no extra work, which matters for anything regulated, and it is the same artefact ${ch("c20", "C20")} turns into traces.`,
          `<strong>Retention costs money.</strong> A busy agent writes megabytes per run. Keep full logs hot for days, then compact to the summary plus the decision points, and archive. Decide this before you have a terabyte of JSONL.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Why record <code>tool_started</code> before executing a tool, when <code>tool_finished</code> already contains everything you need?`,
      answer: p(`Because the gap between them is the only evidence you will have of an interrupted side effect. If you record only on completion, a crash mid-write leaves no trace: the log says the tool was never called, so resumption calls it again, and the second email goes out.`) +
        p(`With the pairing, a <code>tool_started</code> with no matching <code>tool_finished</code> is an explicit, detectable state — "this may have happened" — which is exactly the state your recovery logic needs to branch on. The cost is one extra append. The benefit is that the ambiguous case becomes visible rather than silent.`) },

    { difficulty: "core",
      prompt: `Your agent calls <code>charge_card</code>. Design the full path so a crash at any instant cannot double-charge, without requiring the payment provider to support idempotency keys.`,
      answer: ol([
        `<strong>Record intent with a deterministic id.</strong> <code>chargeId = hash(runId, callId)</code> — the same value on every replay, derived from the log, never random.`,
        `<strong>Write a local intent row</strong> keyed by <code>chargeId</code> with status <code>pending</code>, committed before the network call.`,
        `<strong>Call the provider</strong>, passing <code>chargeId</code> in a reference/metadata field — almost every provider has one even without idempotency support.`,
        `<strong>Record the outcome</strong> against <code>chargeId</code>.`,
        `<strong>On resume with a pending row:</strong> query the provider by that reference. If a charge exists, synthesise the result. If not, re-attempt. If the provider cannot be queried by reference, escalate to a human. Never guess.`,
      ]) +
      code({ title: "the reconciliation, which is the actual answer",
        src: `async function recoverCharge(chargeId: string, provider: Provider): Promise<ToolResult> {
  const found = await provider.search({ reference: chargeId, since: hoursAgo(24) });
  if (found.length === 1) return ok(\`Charge already completed: \${found[0].id}\`);
  if (found.length === 0) return { action: "rerun" };
  // More than one means an earlier bug already double-charged. Stop, loudly.
  throw new ReconciliationError(\`\${found.length} charges found for \${chargeId}\`);
}` }) +
      p(`Two notes. The <code>found.length > 1</code> branch is not defensive padding — it is how you discover that a previous version of this code was broken, and it should page someone. And "escalate to a human" is a legitimate terminal state for money: an agent that stops and asks is strictly better than one that guesses confidently.`) },

    { difficulty: "core",
      prompt: `Implement <code>fork(runId, atSeq, patch)</code> and describe three uses beyond debugging.`,
      answer: code({ title: "prefix copy plus an optional patched last event",
        src: `export async function fork(log: EventLog, runId: string, atSeq: number,
                           patch?: Partial<RunEvent>): Promise<string> {
  const prefix = (await log.read(runId)).filter((e) => e.seq <= atSeq);
  if (!prefix.length) throw new Error("nothing to fork");
  const forkId = \`\${runId}~\${atSeq}~\${shortId()}\`;     // parentage readable in the id

  const rewritten = prefix.map((e) => ({ ...e, runId: forkId }));
  if (patch) {
    const last = rewritten.at(-1)!;
    rewritten[rewritten.length - 1] = { ...last, event: { ...last.event, ...patch } as RunEvent };
  }
  await log.append(forkId, rewritten.map((e) => e.event));
  await log.appendMeta(forkId, { forkedFrom: runId, atSeq, patched: !!patch });
  return forkId;
}` }) +
      ul([
        `<strong>Regression tests from production.</strong> Fork a real run at the step before a failure, patch the tool result, and assert the agent recovers. The test case is recorded rather than invented, which is why it will still be realistic next quarter (${ch("c19", "C19")}).`,
        `<strong>Parallel exploration.</strong> Fork three ways at a decision point and run all three, then pick the best outcome. This is a cheap approximation of search over agent trajectories, and it needs no new machinery.`,
        `<strong>Cheap retry after a bad turn.</strong> Rather than restarting, fork just before the model call that went wrong and re-run it at a higher temperature. You keep every observation already paid for.`,
        `<strong>"Undo" as a product feature.</strong> A user who says "no, go back to before you edited that file" is asking for a fork, plus compensating actions for any side effects after that point, which is the part that makes it hard.`,
      ]) },

    { difficulty: "stretch",
      prompt: `You are moving from one process to a fleet of workers pulling runs from a queue. Name what breaks and design the leasing protocol that fixes it.`,
      answer: ul([
        `<strong>Two workers on one run.</strong> Both fold the same log, both call the model, both execute writes. Every side effect doubles.`,
        `<strong>A worker dies holding the run.</strong> Nobody else picks it up because the run looks in-progress, and it stalls forever.`,
        `<strong>Interleaved appends.</strong> Two writers append to the same log and sequence numbers collide, corrupting the fold.`,
      ]) +
      code({ title: "leases with fencing tokens",
        src: `interface Lease { runId: string; workerId: string; token: number; expiresAt: number }

// 1. Acquire: atomic compare-and-set. Only succeeds if the lease is free or expired.
//    The token increments on every acquisition — this is the fencing token.
const lease = await store.acquire(runId, workerId, { ttlMs: 30_000 });

// 2. Every append carries the token. The store rejects an append whose token is
//    lower than the current one, so a resurrected zombie worker cannot write.
await log.append(runId, events, { token: lease.token });   // throws FencedError if stale

// 3. Heartbeat: extend the lease while working. Stop working the instant renewal fails —
//    a lost lease means another worker has already taken over.
const hb = setInterval(() => store.renew(runId, lease).catch(() => abort.abort()), 10_000);

// 4. Release on any exit path, including failure. TTL is the backstop, not the plan.` }) +
      p(`The fencing token is the part people leave out. A TTL alone is not sufficient: a worker paused by a long GC or a network partition can wake up after its lease expired, believing it still holds it, and write. Rejecting appends with a stale token makes that impossible at the storage layer rather than relying on every worker behaving.`) +
      p(`Choose the TTL against your longest single operation, not your average. If a tool can legitimately take 120 seconds, a 30-second TTL guarantees spurious takeovers — and two agents running the same step is the exact failure you were preventing.`) },
  ],

  qa: [
    { q: "Isn't this over-engineering for a chatbot?", a: p(`For a single-turn chatbot, yes. The threshold is roughly: runs longer than about thirty seconds, or any write tool, or any human approval step. Below that, keep it in memory. Above it, the log costs a day to build and saves the first incident it prevents.`) },
    { q: "Should I use Temporal instead of writing this?", a: p(`If you already run it, yes — the agent loop maps onto a durable workflow cleanly. If you do not, adopting a distributed execution engine to make one loop resumable is a large operational commitment for forty lines of value. Write the log, keep the interface narrow, and migrate when you have a second reason.`) },
    { q: "How do I keep replay deterministic when the agent code changes?", a: p(`Version the log. Store the code version in <code>run_started</code> and refuse to resume a run recorded by an incompatible version — resume it as a <em>fork</em> with a fresh prefix instead. Silently replaying an old log through new logic produces states that never existed, which is the worst kind of bug because the log looks fine.`) },
    { q: "What about the context manager's state — is that in the log?", a: p(`Compaction is an event (<code>compacted</code>), so the fold reproduces exactly the messages the model saw. That matters: without it, a replay rebuilds the <em>un</em>compacted array, the model sees different input, and your "deterministic" replay diverges at the first compaction boundary.`) },
    { q: "Do I log the full tool results, including the 180KB ones?", a: p(`Log a content hash plus the offloaded path (${ch("c05", "C05")}), not the bytes. The log stays small and greppable, the data stays retrievable, and replay reads it from disk. If you must inline for portability, compress and set a retention policy on the same day you build it.`) },
  ],

  project: {
    title: "Project · Make your agent resumable",
    brief: p(`Convert the loop from ${ch("c04", "C04")} to event sourcing. The behaviour on a clean run must be identical; the difference should only be visible when you kill the process.`),
    spec: [
      "A <code>RunEvent</code> union with paired intent/outcome events for both model calls and tool calls.",
      "<code>project(events)</code> rebuilding full run state, including compaction, so the model sees byte-identical input on replay.",
      "An append-only JSONL log that tolerates a truncated final line.",
      "A <code>ReplayCursor</code> so resumption replays recorded results without calling the model or the tools.",
      "Recovery policy by tool class: reads re-run, idempotent writes re-run, non-idempotent writes verify or escalate.",
      "<code>fork(runId, seq, patch)</code> with parentage recorded.",
      "A test that kills the process at each of ten steps and asserts: correct completion, zero duplicate side effects, and no repeated model charges for replayed steps.",
    ],
    stretch: [
      "Add idempotency keys derived from <code>(runId, callId)</code> to every write tool and show the escalation path is no longer reached.",
      "Add leases with fencing tokens and run two workers against one queue, asserting no double execution.",
      "Build <code>agentctl replay &lt;runId&gt; --until 5</code> that prints the exact context the model saw at step 5. This one tool will pay for the whole chapter the first time something goes wrong.",
    ],
  },

  quiz: [
    { q: "Why is a run stored as an event log rather than a snapshot of `messages`?",
      options: ["State becomes a fold over events, so you can rebuild any point in the run, replay without re-executing, and fork", "Event logs compress better", "Snapshots cannot be written to disk", "It reduces token usage"],
      answer: 0,
      why: "A snapshot gives you one point in time. A log gives you every point, which is what makes replay-without-re-execution, forking, counterfactual debugging and audit fall out of the same structure." },
    { q: "On resume, what is the rule for an operation that has a recorded result?",
      options: ["Replay the recorded result — do not call the model or the tool again", "Re-execute it to make sure the result is fresh", "Skip it entirely and continue from the next step", "Ask the model whether to re-run it"],
      answer: 0,
      why: "Replaying is free, instant and side-effect-free, and it is what makes resuming a nine-step run cost 20ms instead of the whole run again. Re-executing repays every model call and repeats every write." },
    { q: "Why record tool *intent* before executing the tool?",
      options: ["A started-but-unfinished event is the only evidence that a side effect may have occurred", "It makes the log easier to read", "It lets you cancel the tool call", "It is required for idempotency keys"],
      answer: 0,
      why: "Recording only on completion means a crash mid-write leaves no trace, so resumption re-runs the call and the second email goes out. The pairing turns the ambiguous case into an explicit, detectable state." },
    { q: "A non-idempotent write was started but never finished. What should recovery do?",
      options: ["Call a verifier to check whether the effect landed, and escalate to a human if there is no verifier", "Re-run it — a missing result means it failed", "Skip it — assume it succeeded", "Re-run it with a higher timeout"],
      answer: 0,
      why: "Re-running risks a duplicate charge or email; skipping risks silent data loss. Verification resolves the ambiguity, and when it cannot, a human deciding is a legitimate terminal state — much better than a confident guess about money." },
    { q: "What single design change makes resumption of write tools trivially safe?",
      options: ["Idempotency keys derived deterministically from (runId, callId)", "Longer tool timeouts", "Snapshotting more frequently", "Running write tools last in every turn"],
      answer: 0,
      why: "With a deterministic key the downstream system deduplicates, so re-running is always safe and the verify-or-escalate branch is never reached. It costs one column and removes an entire class of incident." },
    { q: "Why must compaction be recorded as an event?",
      options: ["Otherwise replay rebuilds the uncompacted array, the model sees different input, and the replay diverges", "To measure how often compaction runs", "Because the summary is expensive to regenerate", "To let the user undo a compaction"],
      answer: 0,
      why: "Determinism requires that the fold reproduce exactly what the model saw. Compaction is a lossy transformation of the context, so it is part of the run's history — not a detail of the context manager." },
  ],

  continues: p(`The agent can now survive anything that happens to the process. It still cannot survive a task with twelve steps and a dependency order, because it has no representation of the task beyond "the goal, and whatever I have done so far". ${ch("c09", "C09")} gives it a plan — and is careful about when a plan helps and when it is expensive theatre.`),
};

export default chapter;
