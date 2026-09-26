import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ch } from "../../src/ui.ts";

export const STEER_SVG = `
<svg viewBox="0 0 700 330" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="A message queue beside the agent loop, delivering a user message between steps">
  <defs>
    <marker id="s26" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
    <marker id="s26a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
  </defs>

  <text x="14" y="20" class="d-label">TWO THINGS RUNNING AT ONCE</text>

  <rect x="14" y="36" width="140" height="58" rx="6" class="d-box-m"/>
  <text x="84" y="58" class="d-text" text-anchor="middle">keyboard</text>
  <text x="84" y="76" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">never blocks</text>

  <path d="M158 65 L206 65" class="d-arrow-a" marker-end="url(#s26a)"/>
  <text x="182" y="57" class="d-mono" text-anchor="middle" fill="var(--accent)">enqueue</text>

  <rect x="210" y="36" width="160" height="58" rx="6" class="d-box-a"/>
  <text x="290" y="58" class="d-text" text-anchor="middle">MessageQueue</text>
  <text x="290" y="76" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">async iterator</text>

  <path d="M290 98 L290 128" class="d-arrow-a" marker-end="url(#s26a)"/>
  <text x="300" y="118" class="d-mono" fill="var(--accent)">direct handoff if a reader waits</text>

  <line x1="14" y1="146" x2="686" y2="146" stroke="var(--border)"/>
  <text x="14" y="170" class="d-label" fill="var(--fg-faint)">THE LOOP · ONE TURN</text>

  <rect x="14" y="184" width="104" height="52" rx="6" class="d-box"/>
  <text x="66" y="206" class="d-mono" text-anchor="middle">drain()</text>
  <text x="66" y="222" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">steer in</text>

  <path d="M122 210 L146 210" class="d-arrow" marker-end="url(#s26)"/>
  <rect x="150" y="184" width="104" height="52" rx="6" class="d-box-m"/>
  <text x="202" y="206" class="d-mono" text-anchor="middle">compact?</text>
  <text x="202" y="222" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">inline</text>

  <path d="M258 210 L282 210" class="d-arrow" marker-end="url(#s26)"/>
  <rect x="286" y="184" width="104" height="52" rx="6" class="d-box-a"/>
  <text x="338" y="206" class="d-mono" text-anchor="middle">model</text>
  <text x="338" y="222" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">fallback ok</text>

  <path d="M394 210 L418 210" class="d-arrow" marker-end="url(#s26)"/>
  <rect x="422" y="184" width="130" height="52" rx="6" class="d-box-t"/>
  <text x="487" y="206" class="d-mono" text-anchor="middle">tool</text>
  <text x="487" y="222" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">raced vs inbox</text>

  <path d="M556 210 L580 210" class="d-arrow" marker-end="url(#s26)"/>
  <rect x="584" y="184" width="102" height="52" rx="6" class="d-box"/>
  <text x="635" y="206" class="d-mono" text-anchor="middle">yield</text>
  <text x="635" y="222" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">event out</text>

  <path d="M635 240 L635 266 L66 266 L66 242" class="d-arrow" marker-end="url(#s26)" stroke-dasharray="4 3"/>
  <text x="350" y="282" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">next turn — anything typed since is already waiting in the queue</text>

  <text x="14" y="314" class="d-mono" fill="var(--accent)">the loop never blocks on input, and input never waits for the loop</text>
</svg>`;

const chapter: Chapter = {
  id: "c26",
  num: 26,
  layer: "systems",
  title: "The Interactive Loop",
  subtitle: "Steering, interrupting and compacting an agent that is already running",
  blurb:
    "C04's loop takes a goal and returns a result. A loop a person can work with is an async generator over a concurrent message queue: it emits events as it goes, accepts corrections between steps, and when interrupted mid-write knows what it finished.",
  lines: 332,
  file: "code/c26_interactive_loop.ts",
  tags: ["steering", "async generator", "message queue", "interrupt", "cancellation", "compaction", "model fallback"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "The loop you built cannot be talked to",
      html:
        p(`${ch("c04", "C04")}'s loop has a signature like <code>run(goal) → Outcome</code>. You hand it a goal, it disappears for forty seconds, and it comes back with an answer. That is the correct shape for a job in a queue and the wrong shape for a person sitting in front of it.`) +
        p(`Watch what a user actually does. Three steps in they see the agent reading the wrong file and want to say so — not cancel, not restart, just redirect. Or they realise they forgot a constraint and want to add it before the patch lands. ${ch("c16", "C16")} claimed steering mid-run is usually worth more than approving, because it happens while the work is still cheap to change. That chapter did not say how, because the loop it inherited had nowhere to put an incoming message.`) +
        p(`This chapter changes the loop's shape. It becomes an async generator that emits events while it runs, reading from a queue that anyone can push into at any time. The mechanism is small — about sixty lines — and it is the difference between a batch job and a tool.`) +
        note(
          "key",
          "What the shape buys",
          p(`A generator that yields events lets the caller render progress without the loop knowing what a UI is (${ch("c22", "C22")}). A queue the loop polls between steps lets a person correct it without restarting. And because both are explicit, the interrupt case stops being an exception you handle and becomes a state you can reason about.`)
        ),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "A queue whose reader never misses",
      html:
        p(`The whole chapter rests on one object: a queue you can push into, that the loop consumes as an async iterator. Its defining property is what happens when a message arrives while the loop is parked waiting for one.`) +
        code({
          title: "code/c26_interactive_loop.ts — the handoff",
          src: `next(): Promise<IteratorResult<T>> {
  if (this.buffer.length > 0) return Promise.resolve({ done: false, value: this.buffer.shift() as T });
  if (this.failure !== undefined) return Promise.reject(this.failure);
  if (this.finished) return Promise.resolve({ done: true, value: undefined });
  // Nothing to give yet. Park, and remember how to wake up.
  return new Promise((resolve, reject) => { this.waiting = { resolve, reject }; });
}

enqueue(value: T): void {
  const w = this.waiting;
  if (w) {
    // Hand off directly. No buffer hop, no scheduler round trip.
    this.waiting = undefined;
    w.resolve({ done: false, value });
    return;
  }
  this.buffer.push(value);
}`,
        }) +
        p(`The branch in <code>enqueue</code> is the point. A naive queue pushes onto an array and lets the consumer find it on some later tick. This one checks whether a reader is already waiting and, if so, resolves that reader's promise with the value directly. The message skips the buffer entirely. In the runnable file the measured handoff is in the tens of microseconds, which is not impressive as a number and is entirely the point as a property: there is no polling interval to tune and no worst case to reason about.`) +
        p(`This is reconstructed from the <code>h2A</code> class in Claude Code v1.0.33, and the small details in it are worth keeping. It refuses a second iteration — two consumers would each silently receive a subset of the messages, which is a bug you find three weeks later. It carries terminal <code>done</code> and <code>fail</code> states, so a closed queue wakes its reader rather than hanging it.`) +
        `<h3>The loop becomes a generator</h3>` +
        code({
          title: "the shape change",
          src: `// C04
export async function run(goal: string, cfg: Config): Promise<Outcome>

// C26
export async function* runInteractive(cfg: LoopConfig): AsyncGenerator<AgentEvent>`,
        }) +
        p(`Everything the caller needs now arrives as it happens, and the loop stays ignorant of who is listening. A terminal renders the events as lines; ${ch("c22", "C22")}'s server turns them into SSE frames; a test collects them into an array and asserts on the sequence. ${ch("c04", "C04")}'s streaming exercise proposed this as an optional extra. It is not an extra — it is what makes the other two features in this chapter expressible.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "Three things that now happen inside the loop",
      html:
        fig({
          label: "Diagram",
          title: "the queue beside the loop",
          body: STEER_SVG,
          caption: `The loop drains the queue at the top of every turn, so a correction typed during step two is applied before step three is decided rather than after the run ends.`,
        }) +
        `<h3>1 · Steering between steps</h3>` +
        p(`At the top of each turn the loop takes whatever is buffered and appends it to <code>messages</code>. A correction typed while a tool was running is therefore in context before the next decision is made. The user did not cancel and restart; they said "also add a regression test" and the agent carried on with one more constraint.`) +
        p(`The reason to drain <em>between</em> steps rather than mid-step is coherence. Injecting a message into the middle of a tool result would leave the transcript in a state no API accepts and no model was trained on. The turn boundary is the natural seam, and it is close enough — a step is seconds, not minutes.`) +
        `<h3>2 · Compaction as a loop concern</h3>` +
        p(`${ch("c05", "C05")} treated compaction as something you do to a context. In an interactive loop it has to be something the loop does <em>to itself</em>, on whatever turn the transcript crosses the threshold, because the next model call is the one that would fail. Claude Code does this inline and emits a telemetry event when it fires; the runnable file does the same and yields a <code>compacted</code> event so the UI can say so.`) +
        note(
          "",
          "Tell the user it happened",
          p(`A silent lossy transformation of the agent's memory is exactly the kind of thing a person should be told about, particularly one who is steering. If the agent forgets a constraint you gave it twenty turns ago, you want to know that a compaction is why — otherwise the agent just looks like it stopped listening.`)
        ) +
        `<h3>3 · Model fallback without the caller noticing</h3>` +
        p(`A 529 from the primary model is a routine Tuesday. The loop switches to a fallback and continues, emitting an event so the change is visible rather than mysterious. ${ch("c12", "C12")}'s degradation ladder is the general form; this is the one rung that belongs in the loop itself, because the alternative is failing a run the user is watching.`) +
        `<h3>The interrupt case, which is the hard one</h3>` +
        table(
          ["Tool in flight", "On interrupt", "Why"],
          [
            ["Read-only", "Abandon it", "Nothing happened outside the sandbox; the result is worthless now"],
            ["Write, not yet started", "Never start it", "Cheapest possible outcome"],
            ["<b>Write, in flight</b>", "<b>Await it, then report it</b>", "You cannot un-send it — and waiting is what lets you say it landed instead of that it might have"],
          ]
        ) +
        p(`That third row is the one people get wrong, and the wrong version is seductive because it is faster. Abandon an in-flight write and the interrupt returns instantly; you have simply moved the cost onto the user, who now has a workspace in a state nobody recorded. Waiting costs a few hundred milliseconds and converts a permanent unknown into a line in the report.`),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Find out what a delayed queue costs",
      html:
        p(`Steering only helps if the message lands before the decision it was meant to change. Move the poll interval and the step duration and watch how often a correction arrives too late to matter.`) +
        lab({
          label: "Simulator",
          title: "steering latency",
          body: `
<div class="controls">
  <div class="ctl"><label>queue poll interval</label>
    <input type="range" id="s26-poll" min="0" max="3000" step="50" value="0">
    <span class="val" id="s26-poll-v">0ms · direct handoff</span></div>
  <div class="ctl"><label>step duration</label>
    <input type="range" id="s26-step" min="200" max="8000" step="100" value="2000">
    <span class="val" id="s26-step-v">2.0s</span></div>
  <div class="ctl"><label>steps in the run</label>
    <input type="range" id="s26-steps" min="2" max="20" step="1" value="8">
    <span class="val" id="s26-steps-v">8</span></div>
  <div class="ctl"><label>drain point</label>
    <input type="range" id="s26-drain" min="0" max="1" step="1" value="0">
    <span class="val" id="s26-drain-v">between steps</span></div>
</div>
<div id="s26-verdict" class="note" style="margin-top:0"></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:1rem">
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">steer applied in time</div>
    <div class="meter"><i id="s26-hit" style="width:0%"></i></div>
    <div class="mono small muted" id="s26-hit-v">—</div>
  </div>
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">wasted work after the steer</div>
    <div class="meter"><i id="s26-waste" style="width:0%;background:var(--danger)"></i></div>
    <div class="mono small muted" id="s26-waste-v">—</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><b id="s26-lat">—</b><span>median latency</span></div>
  <div class="stat"><b id="s26-p95">—</b><span>p95 latency</span></div>
  <div class="stat"><b id="s26-lost">—</b><span>steers too late</span></div>
  <div class="stat"><b id="s26-run">—</b><span>run length</span></div>
</div>`,
          script: `
var poll = document.getElementById("s26-poll"), step = document.getElementById("s26-step");
var nsteps = document.getElementById("s26-steps"), drain = document.getElementById("s26-drain");

function run() {
  var P = +poll.value, S = +step.value, N = +nsteps.value, D = +drain.value;
  document.getElementById("s26-poll-v").textContent = P === 0 ? "0ms · direct handoff" : P + "ms";
  document.getElementById("s26-step-v").textContent = (S / 1000).toFixed(1) + "s";
  document.getElementById("s26-steps-v").textContent = N;
  document.getElementById("s26-drain-v").textContent = D === 0 ? "between steps" : "end of run only";

  var rnd = mulberry32(11);
  var TRIALS = 400, lats = [], late = 0, wasted = 0;
  var runMs = N * S;

  for (var i = 0; i < TRIALS; i++) {
    var at = rnd() * runMs;                      // when the user types
    var stepIdx = Math.floor(at / S);
    var lat;
    if (D === 1) {
      lat = runMs - at;                          // only read when the run ends
    } else {
      var nextBoundary = (stepIdx + 1) * S;      // drained at the next turn top
      lat = (nextBoundary - at) + (P > 0 ? rnd() * P : 0);
    }
    lats.push(lat);
    // A steer is "in time" if it lands before the run finishes with steps left
    // to influence; wasted work is whatever ran between typing and landing.
    if (at + lat >= runMs) late++;
    else wasted += lat;
  }

  lats.sort(function (a, b) { return a - b; });
  var med = lats[Math.floor(lats.length / 2)];
  var p95 = lats[Math.floor(lats.length * 0.95)];
  var hit = Math.round((1 - late / TRIALS) * 100);
  var wastePct = Math.min(100, Math.round((wasted / TRIALS) / runMs * 100));

  document.getElementById("s26-lat").textContent = (med / 1000).toFixed(1) + "s";
  document.getElementById("s26-p95").textContent = (p95 / 1000).toFixed(1) + "s";
  document.getElementById("s26-lost").textContent = late + " / " + TRIALS;
  document.getElementById("s26-run").textContent = (runMs / 1000).toFixed(0) + "s";
  document.getElementById("s26-hit").style.width = hit + "%";
  document.getElementById("s26-hit-v").textContent = hit + "% landed with work left to change";
  document.getElementById("s26-waste").style.width = wastePct + "%";
  document.getElementById("s26-waste-v").textContent = wastePct + "% of the run ran after the user had already corrected it";

  var v = document.getElementById("s26-verdict");
  if (D === 1) v.innerHTML = "<b>This is C04's loop.</b> Input is read only when the run ends, so a correction is never a correction — it is the first message of the next run, after the agent has finished doing the wrong thing. Everything else on this panel is the cost of that one design choice.";
  else if (P === 0 && S <= 1500) v.innerHTML = "<b>The good configuration.</b> Direct handoff and short steps: a correction lands at the next turn boundary, which is about half a step away. The remaining latency is the step itself, not the queue.";
  else if (P === 0) v.innerHTML = "<b>Latency is the step, not the queue.</b> The handoff is instant; you are waiting for the current tool to finish. If this is too slow, shorten the steps or race the tool against the inbox — do not speed up the queue, it is not the bottleneck.";
  else if (P >= 1500) v.innerHTML = "<b>The poll interval is now the problem.</b> Look at p95 — a user who types just after a poll waits most of an interval on top of the step. This is the failure a direct handoff exists to remove, and it costs nothing to remove it.";
  else v.innerHTML = "<b>Polling adds latency for no benefit.</b> Compare p95 against poll interval 0. There is no configuration where a timer beats waking the pending reader directly.";
}
[poll, step, nsteps, drain].forEach(function (el) { el.addEventListener("input", run); });
run();`,
          caption: `Set <em>drain point</em> to "end of run only" first. That is ${ch("c04", "C04")}'s loop, and the panel shows what it costs: every correction arrives after the agent has finished doing the thing you were trying to stop. Then set it back and raise the poll interval — the p95 is where a timer-based queue hurts, and it buys nothing.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "Four scenarios over one loop",
      html:
        p(`The runnable file puts the same scripted plan under four conditions. The plan never changes; only what arrives while it runs does.`) +
        code({
          title: "the top of a turn",
          src: `// 1. Take anything typed while the last step ran. Steering lands before the
//    next decision, not after the run finishes.
yield* applySteer(cfg.inbox.drain());
if (cancelled) break;

// 2. Compaction lives inside the loop, not beside it — the transcript can
//    cross the threshold on any turn, and the next model call is the one
//    that would fail.
if (estimate(messages) > cfg.compactAbove) { /* … */ yield { type: "compacted", … }; }

// 3. A degraded primary is a routine Tuesday; switch and say so.
if (failing && model === "primary") { model = "fallback"; yield { type: "model_fallback", … }; }`,
        }) +
        p(`Then the tool runs, raced against the inbox, and the interrupt path is the part worth reading twice.`) +
        code({
          title: "the interrupt path",
          src: `const finished = await raceToolAgainstInbox(step.tool.ms, cfg.inbox);

if (finished.interruptedBy) {
  // A write already in flight is not abandoned. You cannot un-send it, so it
  // is awaited, and because it was awaited the outcome is known rather than
  // guessed — which is the whole reason to wait.
  if (step.tool.write) {
    established.push(\`\${step.tool.summary} — completed before the interrupt\`);
    inFlightWrite = undefined;
  }
  yield* applySteer(finished.interruptedBy);
  if (cancelled) break;
  continue;
}`,
        }) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c26_interactive_loop.ts

#   C26 · The interactive loop
#
#   handoff to a waiting reader: 11µs — no buffer hop
#
#
#   1 · uninterrupted
#   -----------------
#     think   I need the failing test first.
#     tool    running the suite
#     think   Now the file it points at.
#     tool    reading src/session.ts
#     think   The expiry check is inverted. Patching.
#     tool    patching src/session.ts
#     think   Re-running to confirm.
#     tool    running the suite
#     think   Green. Writing it up.
#     answer  The expiry comparison in src/session.ts was inverted; fixed and the suite is green.
#     stop    answered
#
#   2 · steered mid-run
#   -------------------
#     think   I need the failing test first.
#     tool    running the suite
#     think   Now the file it points at.
#     tool    reading src/session.ts
#     ◀ user  "also add a regression test"
#     think   The expiry check is inverted. Patching.
#     tool    patching src/session.ts
#     think   Re-running to confirm.
#     tool    running the suite
#     think   Green. Writing it up.
#     answer  The expiry comparison in src/session.ts was inverted; fixed and the suite is green.
# …
#   exchange for never knowing what is on disk.`,
        }) +
        note(
          "good",
          "The report is the deliverable",
          p(`Scenario 4 cancels while the patch is being written. Because the loop waited, the report says <em>patching src/session.ts — completed before the interrupt</em> rather than leaving the user to guess. ${ch("c12", "C12")} argued that a partial report is what an interrupted agent owes you; this is where the loop earns the right to produce an accurate one.`)
        ),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Field notes",
      html:
        ul([
          `<strong>Read the reconstruction this chapter is built from.</strong> The <code>h2A</code> queue, the <code>nO</code> async-generator main loop and the abort propagation in Claude Code v1.0.33 are documented in <a href="https://github.com/blessdyb/analysis_claude_code" target="_blank" rel="noopener noreferrer">analysis_claude_code</a>. It is a reverse-engineering study of an obfuscated build, so treat specific identifiers as evidence of a design rather than as an API — the shapes are what transfer.`,
          `<strong>pi solves the same problem with the same move.</strong> Its agent loop has an outer <code>while (true)</code> that continues when queued follow-up messages arrive after the agent would have stopped, and it polls for messages the user typed while it was working. Two independent harnesses converging on a queue beside the loop is a reasonable signal that the shape is right.`,
          `<strong>Backpressure is a real question once the producer is not a keyboard.</strong> A human types a few messages a minute and the queue never grows. Wire the same queue to a webhook or another agent (${ch("c18", "C18")}) and you need a bound and a policy for what to drop. The version in this chapter is deliberately unbounded because its producer is a person; do not copy that into a machine-to-machine path.`,
          `<strong>Emit events even when nothing is listening.</strong> The generator costs nothing when the consumer ignores events, and the moment you want a UI, a trace (${ch("c20", "C20")}) or a test that asserts on a sequence, they are already there. Retrofitting events into a loop that returns a value is the refactor this chapter exists to save you.`,
          `<strong>Steering is a security surface.</strong> A steer is untrusted input appended to the context mid-run, which is ${ch("c21", "C21")}'s first circle. That is fine when the producer is the user at the keyboard, and it is not fine when it is anything else. If a steering message can originate anywhere but a human you have authenticated, it deserves the same treatment as a fetched web page.`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `The queue throws if you iterate it twice. Write the bug that guard prevents, and say why it would be hard to find.`,
      answer:
        p(`Two consumers each call <code>next()</code>. Each call either takes the buffered head or parks as <code>this.waiting</code> — and there is only one <code>waiting</code> slot, so the second reader overwrites the first. Every message is then delivered to exactly one consumer, chosen by timing.`) +
        p(`It is hard to find because nothing fails. No exception, no dropped message from the queue's point of view: each one was delivered. The symptom is that a UI renderer and a trace writer, both iterating the same stream, each see a plausible-looking subset — so you get a UI missing a step, a trace missing a different step, and no reason to suspect the queue. The guard converts a silent split-brain into a loud error at the second <code>[Symbol.asyncIterator]()</code> call.`),
    },
    {
      difficulty: "core",
      prompt: `Steering appends the user's message to <code>messages</code> at the top of the turn. Name three ways that can go wrong, and how you would handle each.`,
      answer:
        p(`The turn boundary is the right seam, but appending raw text into a live transcript has sharp edges.`) +
        ul([
          `<strong>It contradicts the original goal.</strong> "Actually, don't touch the tests" arrives after the agent already patched one. The model now holds two instructions and no guidance about precedence. Mark steering messages explicitly — <em>the user has revised the task; later instructions take precedence</em> — and put the revision <em>after</em> the transcript so recency works for you (${ch("c05", "C05")}).`,
          `<strong>It arrives mid-tool-call-pair.</strong> If a <code>tool_use</code> block has been emitted and its <code>tool_result</code> has not yet been appended, inserting a user message produces a transcript most APIs reject outright (${ch("c01", "C01")}). Always drain at the top of a turn, never between a call and its result — which is what the runnable file does and why.`,
          `<strong>It floods.</strong> A user who gets impatient sends five corrections in ten seconds. Appending all five bloats the context and leaves the model to reconcile them. Coalesce consecutive steers from the same source into one message before appending, keeping the last as authoritative and the earlier ones as context.`,
        ]),
    },
    {
      difficulty: "core",
      prompt: `Compaction fires mid-run while the user is steering. The user then refers to something that was compacted away. Design the handling.`,
      answer:
        p(`This is the collision the chapter's note points at, and it is worth designing for because it is guaranteed rather than unlikely: a long run is exactly the one where a user both steers and triggers compaction.`) +
        ul([
          `<strong>Announce it.</strong> The <code>compacted</code> event exists so the UI can show a marker in the transcript. A user who sees "context compacted" understands why the agent no longer remembers the file it read twenty turns ago; one who does not see it concludes the agent stopped listening.`,
          `<strong>Pin the steering messages.</strong> Corrections are cheap and high-value — they are the user telling you what actually matters. Put them in ${ch("c05", "C05")}'s pinned region rather than the rolling one, so compaction never eats them. A run's accumulated steers are usually a few hundred tokens and are the best summary of intent you have.`,
          `<strong>Make the summary name what was dropped.</strong> "Read and summarised 14 files; details compacted" lets the agent answer a follow-up with "I no longer have that in context, re-reading" rather than confabulating. ${ch("c10", "C10")}'s point, applied to the agent's own memory.`,
        ]) +
        p(`The general rule: compaction is lossy and the user cannot see your context, so any loss that could change what the agent does must be visible in the transcript the user <em>can</em> see.`),
    },
    {
      difficulty: "stretch",
      prompt: `Extend the loop so a steering message can arrive during a <em>model call</em> rather than a tool call, and the in-flight call is abandoned rather than awaited. Say what that changes about cost, correctness and the transcript.`,
      answer:
        p(`A model call is the one long operation with no side effect, which makes it the one place abandoning is clearly correct — the opposite of the write case.`) +
        code({
          title: "composing the run signal with a per-turn one",
          src: `const turnAbort = new AbortController();
const signal = AbortSignal.any([cfg.runSignal, turnAbort.signal]);

const steerArrived = inbox.waitForNext();          // resolves on enqueue
const response = cfg.model(messages, { signal });

const winner = await Promise.race([response, steerArrived]);
if (winner === steerArrived) {
  turnAbort.abort();                                // stop the tokens
  // Nothing is appended: a half-streamed assistant turn is not a turn.
  yield* applySteer(inbox.drain());
  continue;                                         // re-decide with the steer in context
}`,
        }) +
        ul([
          `<strong>Cost.</strong> You pay for the tokens generated before the abort and throw them away. That is the right trade — the alternative is paying for the remainder <em>and</em> acting on a decision the user has already corrected.`,
          `<strong>Correctness.</strong> The discarded response must not be appended. A partially streamed assistant turn is ${ch("c01", "C01")}'s truncation case wearing a different hat: it parses, it looks like a decision, and acting on it means acting on half a thought. Drop it entirely and re-decide.`,
          `<strong>The transcript.</strong> The user saw text stream and then vanish, which reads as a bug unless you name it. Emit an event and render it — <em>interrupted; re-planning with your correction</em> — so the disappearance is explained rather than mysterious.`,
        ]) +
        p(`The asymmetry is the lesson. Abandon anything whose only cost is tokens; wait for anything whose effect outlives the process.`),
    },
  ],

  qa: [
    {
      q: "Why drain at the top of the turn instead of the moment a message arrives?",
      a: p(`Because the transcript has to stay in a shape the API accepts. Between a <code>tool_use</code> block and its matching <code>tool_result</code> there is no legal place to insert a user message, and a model has never seen one there in training. The turn boundary is the nearest seam where the transcript is coherent, and a step is seconds rather than minutes, so the latency you pay for that coherence is small. The simulator makes that trade visible.`),
    },
    {
      q: "Is an async generator worth it if I only have a CLI?",
      a: p(`Yes, and the CLI is the easy case rather than the reason. The generator is what lets the same loop serve a terminal, an SSE endpoint (${ch("c22", "C22")}), a trace writer (${ch("c20", "C20")}) and a test that asserts on the event sequence, without any of them knowing about the others. The cost is one keyword and a type; retrofitting it into a loop that returns a value means touching every branch.`),
    },
    {
      q: "What stops a steering message from being used as an injection vector?",
      a: p(`Nothing intrinsic, which is why the producer matters more than the mechanism. A steer is untrusted text appended mid-run — ${ch("c21", "C21")}'s first circle exactly. When it comes from the authenticated human at the keyboard that is the same trust level as the original goal and no new risk. The moment a steer can originate from a webhook, another agent (${ch("c18", "C18")}) or anything automated, treat it like a fetched web page: it does not get to issue instructions, only to supply data.`),
    },
    {
      q: "Should the loop stop to ask about an interrupt, or just stop?",
      a: p(`Just stop, and report. An interrupt is the user exercising control; asking them to confirm it is asking twice and adds latency to the one operation that should feel immediate. The exception is an in-flight write, and even there you do not ask — you wait for it, record it, and say so in the report. The question you are tempted to ask ("cancel anyway?") is answered better by the report the user reads two seconds later.`),
    },
    {
      q: "How does this interact with C08's durable log?",
      a: p(`Steering messages and interrupts are events like any other and belong in the log — <code>steer_received</code>, <code>run_cancelled</code> — because a resumed run that has lost a correction will cheerfully redo the thing the user stopped. The interesting case is resuming <em>into</em> an interrupt: the log says a write was in flight and was awaited, so replay must not repeat it. That is ${ch("c08", "C08")}'s started/finished pairing doing exactly the job it was designed for.`),
    },
  ],

  project: {
    title: "Project · Make your agent steerable",
    brief:
      p(`Convert the agent from ${ch("c04", "C04")} into an async generator over a message queue, then prove the three behaviours with tests rather than by trying it once by hand.`),
    spec: [
      "A <code>MessageQueue</code> with direct handoff to a waiting reader, a single-iteration guard, and terminal done/fail states.",
      "<code>runInteractive()</code> as an <code>AsyncGenerator&lt;AgentEvent&gt;</code>, with the C04 guards intact.",
      "Steering drained at the top of each turn, never between a tool call and its result, with steers marked as revisions that take precedence.",
      "Compaction inside the loop, emitting an event, with steering messages pinned so compaction cannot eat them.",
      "Interrupt handling that abandons reads, never starts unstarted writes, and awaits in-flight writes before reporting them.",
      "Tests for: a message enqueued while the reader waits arriving without a tick delay; a steer applied before the next decision; a cancel during a write producing a report that names the write as completed.",
    ],
    stretch: [
      "Abandon an in-flight model call on steer, discarding the partial response, and confirm nothing malformed reaches the transcript.",
      "Bound the queue and add a drop policy, then wire a second producer that is not a human and watch what the bound saves you.",
      "Render the event stream two ways from one run — a terminal view and an SSE endpoint — with no change to the loop.",
    ],
  },

  quiz: [
    {
      q: "What does `enqueue` do differently from pushing onto an array?",
      options: [
        "If a reader is already parked in `next()`, it resolves that reader's promise directly instead of buffering",
        "It compresses the message before storing it",
        "It guarantees messages are delivered in priority order",
        "It blocks the producer until the consumer is ready",
      ],
      answer: 0,
      why:
        "The branch on `this.waiting` is the whole mechanism. A buffered push means the consumer finds the value on some later tick; a direct handoff wakes the pending promise with it. There is no polling interval to tune and no worst case, which is why the simulator's poll-interval slider only ever makes things worse.",
    },
    {
      q: "Why does the queue refuse to be iterated twice?",
      options: [
        "Two consumers would each silently receive a subset of messages, since there is one waiting slot",
        "Async iterators cannot be shared in JavaScript",
        "It would double memory usage",
        "The second consumer would receive duplicates",
      ],
      answer: 0,
      why:
        "Each `next()` either takes the buffered head or parks in the single `waiting` slot, so a second reader overwrites the first. Every message is still delivered — to exactly one consumer, chosen by timing. Nothing throws, which is what makes it expensive to find. The guard turns a split-brain into a loud error.",
    },
    {
      q: "An interrupt arrives while a write tool is in flight. What should the loop do?",
      options: [
        "Await the write, record that it completed, and say so in the report",
        "Abandon it immediately so the interrupt feels responsive",
        "Roll the write back automatically",
        "Ask the user whether to continue",
      ],
      answer: 0,
      why:
        "You cannot un-send it, and waiting is what converts a permanent unknown into a fact. Abandoning is faster and moves the cost onto the user, who is left with a workspace in a state nobody recorded. Reads are the opposite case: abandon them, since their only cost is tokens.",
    },
    {
      q: "Why must compaction happen inside the loop rather than between runs?",
      options: [
        "The transcript can cross the threshold on any turn, and the next model call is the one that would fail",
        "Compaction requires the abort signal",
        "It is cheaper to compact while tools are running",
        "The user cannot see the transcript otherwise",
      ],
      answer: 0,
      why:
        "An interactive run has no natural break at which to compact from outside. C05 treated compaction as something done to a context; an interactive loop has to do it to itself, on whichever turn the threshold is crossed — and emit an event, because a silent lossy edit to the agent's memory looks to the user like it stopped listening.",
    },
    {
      q: "Steering messages are drained at the top of a turn. Why not the instant they arrive?",
      options: [
        "Inserting a user message between a tool_use block and its tool_result produces a transcript most APIs reject",
        "Draining more often would overload the queue",
        "The model needs a fixed number of messages per turn",
        "Arrival order cannot be determined mid-step",
      ],
      answer: 0,
      why:
        "The turn boundary is the nearest seam at which the transcript is coherent. Mid-pair insertion is malformed by C01's rules and unlike anything the model saw in training. Since a step is seconds, the latency bought for that coherence is small — which the simulator shows directly.",
    },
    {
      q: "What is the strongest argument for the loop emitting events even when nothing consumes them?",
      options: [
        "The same loop then serves a terminal, an SSE endpoint, a trace and a test with no change and no knowledge of any of them",
        "Events make the loop run faster",
        "The model performs better when its output is streamed",
        "It is required for cancellation to work",
      ],
      answer: 0,
      why:
        "A loop that returns a value has to be rewritten to gain any of those; a generator has them already, at the cost of one keyword. It is also what makes steering and interrupts expressible, since both need the caller to see progress while the loop is still running.",
    },
  ],

  continues:
    p(`The loop can now be watched, corrected and stopped by someone sitting in front of it. ${ch("c22", "C22")} is what happens when they are not sitting in front of it: the run has to outlive the HTTP connection that started it, survive a deploy, and let a client reattach to a stream it dropped halfway through.`),
};

export default chapter;
