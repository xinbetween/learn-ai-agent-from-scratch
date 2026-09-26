/**
 * C26 · The Interactive Loop — the C04 loop rebuilt as an async generator over
 * a concurrent message queue, so a person can steer it mid-run and interrupt
 * it mid-tool without losing what it already did.
 *   node --experimental-strip-types code/c26_interactive_loop.ts
 *
 * The queue is the piece worth reading. Everything else in this file exists to
 * put it under the three conditions that matter: a message arriving while the
 * loop waits, a message arriving while it works, and a cancel arriving while a
 * write is in flight.
 */

/* ----------------------------------------------------------- the queue */

export type Inbound =
  | { kind: "user"; text: string }
  | { kind: "steer"; text: string }
  | { kind: "cancel" };

/**
 * An async iterator you can push into.
 *
 * The property that matters is in `enqueue`: if the loop is already parked in
 * `next()` awaiting a message, the value is handed to that pending promise
 * directly rather than buffered and picked up on some later tick. A message
 * typed while the agent is thinking is delivered the instant it arrives.
 *
 * Reconstructed from the h2A class in Claude Code v1.0.33.
 */
export class MessageQueue<T> implements AsyncIterator<T> {
  private buffer: T[] = [];
  private waiting?: { resolve: (r: IteratorResult<T>) => void; reject: (e: unknown) => void };
  private finished = false;
  private failure?: unknown;
  private iterating = false;

  [Symbol.asyncIterator](): AsyncIterator<T> {
    // One consumer. Two would each silently receive a subset of the messages,
    // which is the kind of bug you find three weeks later.
    if (this.iterating) throw new Error("MessageQueue can only be iterated once");
    this.iterating = true;
    return this;
  }

  next(): Promise<IteratorResult<T>> {
    if (this.buffer.length > 0) return Promise.resolve({ done: false, value: this.buffer.shift() as T });
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (this.finished) return Promise.resolve({ done: true, value: undefined });
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
    });
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
  }

  /** Messages already buffered, taken without awaiting. */
  drain(): T[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }

  get pending(): number {
    return this.buffer.length;
  }

  done(): void {
    this.finished = true;
    const w = this.waiting;
    if (w) {
      this.waiting = undefined;
      w.resolve({ done: true, value: undefined });
    }
  }

  fail(error: unknown): void {
    this.failure = error;
    const w = this.waiting;
    if (w) {
      this.waiting = undefined;
      w.reject(error);
    }
  }
}

/* ----------------------------------------------------------- the events */

export type AgentEvent =
  | { type: "turn_start"; turn: number }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; name: string; summary: string }
  | { type: "tool_end"; name: string; ms: number; ok: boolean }
  | { type: "steered"; text: string }
  | { type: "compacted"; before: number; after: number }
  | { type: "model_fallback"; from: string; to: string; why: string }
  | { type: "answer"; text: string }
  | { type: "stopped"; reason: "answered" | "cancelled" | "budget"; report: string };

/* ------------------------------------------------------------- the loop */

export interface Msg { role: "user" | "assistant" | "tool" | "system"; content: string }

export interface LoopConfig {
  goal: string;
  inbox: MessageQueue<Inbound>;
  maxTurns: number;
  /** Compact once the transcript passes this many estimated tokens. */
  compactAbove: number;
  /** Turn on which the primary model starts failing, to show the fallback. */
  failModelOnTurn?: number;
}

const estimate = (ms: Msg[]) => Math.ceil(ms.reduce((n, m) => n + m.content.length, 0) / 3.5);

/** A scripted step. Real agents decide; this replays a plan so the control
 *  flow around the decision is what you are reading. */
const PLAN: Array<{ think: string; tool?: { name: string; summary: string; ms: number; write?: boolean } }> = [
  { think: "I need the failing test first.", tool: { name: "run_tests", summary: "running the suite", ms: 40 } },
  { think: "Now the file it points at.", tool: { name: "read_file", summary: "reading src/session.ts", ms: 20 } },
  { think: "The expiry check is inverted. Patching.", tool: { name: "apply_patch", summary: "patching src/session.ts", ms: 30, write: true } },
  { think: "Re-running to confirm.", tool: { name: "run_tests", summary: "running the suite", ms: 40 } },
  { think: "Green. Writing it up.", tool: undefined },
];

export async function* runInteractive(cfg: LoopConfig): AsyncGenerator<AgentEvent> {
  const messages: Msg[] = [{ role: "user", content: cfg.goal }];
  let model = "primary";
  let turn = 0;
  let cancelled = false;
  let inFlightWrite: string | undefined;
  const established: string[] = [];

  const applySteer = function* (items: Inbound[]): Generator<AgentEvent> {
    for (const m of items) {
      if (m.kind === "cancel") { cancelled = true; continue; }
      messages.push({ role: "user", content: m.text });
      yield { type: "steered", text: m.text };
    }
  };

  for (const step of PLAN) {
    if (cancelled) break;
    if (turn >= cfg.maxTurns) {
      yield { type: "stopped", reason: "budget", report: report(established, inFlightWrite) };
      return;
    }
    turn++;
    yield { type: "turn_start", turn };

    // 1. Take anything the user typed while the last step ran. This is the
    //    whole point of the queue: steering lands before the next decision,
    //    not after the run finishes.
    yield* applySteer(cfg.inbox.drain());
    if (cancelled) break;

    // 2. Compaction lives inside the loop, not beside it — the transcript can
    //    cross the threshold on any turn, and the next model call is the one
    //    that would fail.
    const before = estimate(messages);
    if (before > cfg.compactAbove) {
      const kept = messages.slice(-2);
      const summary: Msg = {
        role: "system",
        content: `[compacted] established: ${established.join("; ") || "nothing yet"}`,
      };
      messages.length = 0;
      messages.push(summary, ...kept);
      yield { type: "compacted", before, after: estimate(messages) };
    }

    // 3. Model fallback. A degraded primary is a routine Tuesday, and the loop
    //    should survive it without the caller noticing.
    if (cfg.failModelOnTurn === turn && model === "primary") {
      model = "fallback";
      yield { type: "model_fallback", from: "primary", to: "fallback", why: "529 overloaded" };
    }

    yield { type: "thinking", text: step.think };
    messages.push({ role: "assistant", content: step.think });

    if (!step.tool) {
      const answer = "The expiry comparison in src/session.ts was inverted; fixed and the suite is green.";
      yield { type: "answer", text: answer };
      yield { type: "stopped", reason: "answered", report: answer };
      return;
    }

    // 4. Run the tool, racing it against anything arriving mid-flight.
    yield { type: "tool_start", name: step.tool.name, summary: step.tool.summary };
    if (step.tool.write) inFlightWrite = step.tool.summary;

    const started = Date.now();
    const finished = await raceToolAgainstInbox(step.tool.ms, cfg.inbox);
    const ms = Date.now() - started;

    if (finished.interruptedBy) {
      // A write already in flight is not abandoned. You cannot un-send it, so
      // it is awaited, and because it was awaited the outcome is known rather
      // than guessed — which is the whole reason to wait (C04's exercise).
      if (step.tool.write) {
        established.push(`${step.tool.summary} — completed before the interrupt`);
        inFlightWrite = undefined;
      }
      yield { type: "tool_end", name: step.tool.name, ms, ok: true };
      yield* applySteer(finished.interruptedBy);
      if (cancelled) break;
      continue;
    }

    inFlightWrite = undefined;
    established.push(step.tool.summary);
    messages.push({ role: "tool", content: `${step.tool.name}: ok (${"x".repeat(400)})` });
    yield { type: "tool_end", name: step.tool.name, ms, ok: true };
  }

  yield { type: "stopped", reason: "cancelled", report: report(established, inFlightWrite) };
}

function report(established: string[], inFlight?: string): string {
  const lines = ["Cancelled. What was established:"];
  for (const e of established) lines.push(`  · ${e}`);
  if (inFlight) lines.push(`  · ${inFlight} — was in flight; treat as may-have-happened`);
  if (established.length === 0 && !inFlight) lines.push("  · nothing yet");
  return lines.join("\n");
}

/** Run a tool, but return early if a message arrives while it runs. */
async function raceToolAgainstInbox(
  ms: number,
  inbox: MessageQueue<Inbound>
): Promise<{ interruptedBy?: Inbound[] }> {
  const work = new Promise<void>((r) => setTimeout(r, ms));
  const poll = new Promise<void>((r) => {
    const t = setInterval(() => {
      if (inbox.pending > 0) { clearInterval(t); r(); }
    }, 2);
    work.then(() => clearInterval(t));
  });
  await Promise.race([work, poll]);
  const arrived = inbox.drain();
  if (arrived.length > 0) {
    await work; // never abandon work already started; let it settle
    return { interruptedBy: arrived };
  }
  return {};
}

/* ------------------------------------------------------------------ main */

async function scenario(
  title: string,
  script: Array<{ afterMs: number; msg: Inbound }>,
  cfg: Omit<LoopConfig, "inbox">
): Promise<void> {
  console.log(`\n  ${title}`);
  console.log(`  ${"-".repeat(title.length)}`);
  const inbox = new MessageQueue<Inbound>();
  for (const s of script) setTimeout(() => inbox.enqueue(s.msg), s.afterMs);

  for await (const ev of runInteractive({ ...cfg, inbox })) {
    switch (ev.type) {
      case "turn_start": break;
      case "thinking": console.log(`    think   ${ev.text}`); break;
      case "tool_start": console.log(`    tool    ${ev.summary}`); break;
      case "tool_end": break;
      case "steered": console.log(`    ◀ user  "${ev.text}"`); break;
      case "compacted": console.log(`    compact ${ev.before} → ${ev.after} tokens`); break;
      case "model_fallback": console.log(`    model   ${ev.from} → ${ev.to} (${ev.why})`); break;
      case "answer": console.log(`    answer  ${ev.text}`); break;
      case "stopped":
        console.log(`    stop    ${ev.reason}`);
        if (ev.reason !== "answered") console.log(ev.report.split("\n").map((l) => `            ${l}`).join("\n"));
        break;
    }
  }
}

async function main(): Promise<void> {
  console.log(`\n  C26 · The interactive loop\n`);

  // The queue's defining property, measured rather than asserted.
  const q = new MessageQueue<Inbound>();
  const waiting = q.next();
  const t0 = process.hrtime.bigint();
  q.enqueue({ kind: "user", text: "hello" });
  await waiting;
  const handoffUs = Number(process.hrtime.bigint() - t0) / 1000;
  console.log(`  handoff to a waiting reader: ${handoffUs.toFixed(0)}µs — no buffer hop\n`);

  await scenario(
    "1 · uninterrupted",
    [],
    { goal: "the session cache never expires entries; fix it", maxTurns: 10, compactAbove: 100_000 }
  );

  await scenario(
    "2 · steered mid-run",
    [{ afterMs: 55, msg: { kind: "steer", text: "also add a regression test" } }],
    { goal: "the session cache never expires entries; fix it", maxTurns: 10, compactAbove: 100_000 }
  );

  await scenario(
    "3 · compaction and model fallback inside the loop",
    [],
    { goal: "the session cache never expires entries; fix it", maxTurns: 10, compactAbove: 200, failModelOnTurn: 3 }
  );

  await scenario(
    "4 · cancelled while a write was in flight",
    [{ afterMs: 68, msg: { kind: "cancel" } }],
    { goal: "the session cache never expires entries; fix it", maxTurns: 10, compactAbove: 100_000 }
  );

  console.log(`\n  Scenario 4 is the one to read twice. The patch had already started when the`);
  console.log(`  cancel arrived, so the loop waited for it instead of walking away — and`);
  console.log(`  because it waited, the report can say the write landed rather than that it`);
  console.log(`  might have. Abandon it instead and you have bought a faster stop in`);
  console.log(`  exchange for never knowing what is on disk.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
