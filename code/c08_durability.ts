/**
 * C08 · State & Durability — event-sourced runs, replay, forking, and the
 * side-effect problem. Crash the run at every step and prove nothing is lost
 * and nothing is done twice.
 *
 *   node --experimental-strip-types code/c08_durability.ts
 */

export type RunEvent =
  | { t: "run_started"; goal: string }
  | { t: "model_called"; messagesHash: string }
  | { t: "model_returned"; decision: string; usage: number }
  | { t: "tool_started"; callId: string; name: string; input: unknown }
  | { t: "tool_finished"; callId: string; content: string; isError: boolean }
  | { t: "compacted"; summary: string; droppedTurns: number }
  | { t: "run_finished"; outcome: string };

export interface StoredEvent { seq: number; runId: string; at: number; event: RunEvent }

const isIntent = (e: RunEvent) => e.t === "model_called" || e.t === "tool_started";

/* ---------------- log ---------------- */

export class MemoryEventLog {
  private logs = new Map<string, StoredEvent[]>();
  append(runId: string, events: RunEvent[]): void {
    const arr = this.logs.get(runId) ?? [];
    for (const e of events) arr.push({ seq: arr.length, runId, at: Date.now(), event: e });
    this.logs.set(runId, arr);
  }
  read(runId: string): StoredEvent[] { return [...(this.logs.get(runId) ?? [])]; }
  /** Simulates a crash: everything after `seq` is lost, including a torn last write. */
  truncate(runId: string, seq: number): void {
    this.logs.set(runId, this.read(runId).filter((e) => e.seq <= seq));
  }
}

/* ---------------- replay ---------------- */

/** Returns a recorded outcome if the next one matches, else null (meaning: execute). */
export class ReplayCursor {
  private i = 0;
  private events: StoredEvent[];
  constructor(events: StoredEvent[]) { this.events = events; }

  next<T extends RunEvent["t"]>(type: T, callId?: string): Extract<RunEvent, { t: T }> | null {
    while (this.i < this.events.length) {
      const e = this.events[this.i].event;
      if (e.t === type && (!callId || (e as any).callId === callId)) { this.i++; return e as any; }
      if (isIntent(e) || e.t === "run_started" || e.t === "compacted") { this.i++; continue; }
      return null;
    }
    return null;
  }
  /** An intent with no matching outcome: "this may have happened". */
  unfinished(): StoredEvent | null {
    const starts = this.events.filter((e) => e.event.t === "tool_started");
    for (const s of starts) {
      const id = (s.event as any).callId;
      if (!this.events.some((e) => e.event.t === "tool_finished" && (e.event as any).callId === id)) return s;
    }
    return null;
  }
}

/* ---------------- the world ---------------- */

interface Step { n: number; kind: "model" | "read" | "write"; label: string; idempotent: boolean }

const STEPS: Step[] = [
  { n: 1, kind: "model", label: "decide: look up the order", idempotent: true },
  { n: 2, kind: "read", label: "search_orders({id:4471})", idempotent: true },
  { n: 3, kind: "model", label: "decide: check the policy", idempotent: true },
  { n: 4, kind: "read", label: "search_policies({q:'electronics'})", idempotent: true },
  { n: 5, kind: "model", label: "decide: tell the customer", idempotent: true },
  { n: 6, kind: "write", label: "send_email({to:'ana@…'})", idempotent: false },
  { n: 7, kind: "model", label: "decide: close the ticket", idempotent: true },
  { n: 8, kind: "write", label: "close_ticket({id:882})", idempotent: true },
  { n: 9, kind: "model", label: "decide: done", idempotent: true },
];

interface World { emailsSent: number; ticketsClosed: number; modelCalls: number }

export type Recovery = { action: "rerun" } | { action: "synthesise"; result: string } | { action: "escalate"; question: string };

/** A timeout is the absence of information, not a failure. */
export function recoverUnfinished(step: Step, verifier: (() => boolean) | null): Recovery {
  if (step.kind !== "write" || step.idempotent) return { action: "rerun" };
  if (verifier) {
    return verifier()
      ? { action: "synthesise", result: "Completed before the interruption." }
      : { action: "rerun" };
  }
  return { action: "escalate", question: `${step.label} was started but its outcome was never recorded. Did it complete?` };
}

interface RunOpts {
  policy: "rerun" | "skip" | "verify";
  /** Whether a verifier EXISTS — distinct from what it would answer. */
  hasVerifier?: boolean;
  /** What the verifier would answer: did the effect actually land? */
  effectLanded?: boolean;
}

function runFrom(log: MemoryEventLog, runId: string, world: World, opts: RunOpts): { replayed: number; executed: number; escalated: boolean } {
  const events = log.read(runId);
  const cursor = new ReplayCursor(events);
  let replayed = 0, executed = 0, escalated = false;

  // A started-but-unfinished write is the only genuinely hard case.
  const dangling = cursor.unfinished();
  const danglingId = dangling ? (dangling.event as any).callId as string : null;

  for (const step of STEPS) {
    const id = `s${step.n}`;
    const recorded = step.kind === "model"
      ? events.some((e) => e.event.t === "model_returned" && (e.event as any).decision === id)
      : events.some((e) => e.event.t === "tool_finished" && (e.event as any).callId === id);

    if (recorded) { replayed++; continue; }

    if (danglingId === id) {
      const rec = opts.policy === "rerun" ? { action: "rerun" as const }
        : opts.policy === "skip" ? { action: "synthesise" as const, result: "assumed done" }
        : recoverUnfinished(step, opts.hasVerifier ? () => opts.effectLanded === true : null);
      if (rec.action === "synthesise") { log.append(runId, [{ t: "tool_finished", callId: id, content: rec.result, isError: false }]); continue; }
      if (rec.action === "escalate") { escalated = true; continue; }
      // fall through to re-execute
    }

    executed++;
    if (step.kind === "model") { world.modelCalls++; log.append(runId, [{ t: "model_called", messagesHash: id }, { t: "model_returned", decision: id, usage: 1800 }]); }
    else {
      log.append(runId, [{ t: "tool_started", callId: id, name: step.label, input: {} }]);
      if (step.label.startsWith("send_email")) world.emailsSent++;
      if (step.label.startsWith("close_ticket")) world.ticketsClosed++;
      log.append(runId, [{ t: "tool_finished", callId: id, content: "ok", isError: false }]);
    }
  }
  return { replayed, executed, escalated };
}

/** A fork is a prefix copy — which makes counterfactual debugging free. */
export function fork(log: MemoryEventLog, runId: string, atSeq: number, patch?: Partial<RunEvent>): string {
  const prefix = log.read(runId).filter((e) => e.seq <= atSeq);
  if (!prefix.length) throw new Error("nothing to fork");
  const forkId = `${runId}~${atSeq}`;
  const events = prefix.map((e) => e.event);
  if (patch) events[events.length - 1] = { ...events[events.length - 1], ...patch } as RunEvent;
  log.append(forkId, events);
  return forkId;
}

/* ---------------- demo ---------------- */

function main(): void {
  console.log("\n  C08 · State & Durability\n");

  /** One crash scenario, run under one policy. Returns what the world looks like after. */
  function trial(crashAt: number, policy: "rerun" | "skip" | "verify" | "verify-no-verifier", effectLanded: boolean) {
    const log = new MemoryEventLog();
    const runId = `r`;
    const world: World = { emailsSent: 0, ticketsClosed: 0, modelCalls: 0 };
    log.append(runId, [{ t: "run_started", goal: "refund 4471" }]);

    for (const step of STEPS.slice(0, crashAt)) {
      const id = `s${step.n}`;
      if (step.kind === "model") {
        world.modelCalls++;
        log.append(runId, [{ t: "model_called", messagesHash: id }, { t: "model_returned", decision: id, usage: 1800 }]);
      } else {
        log.append(runId, [{ t: "tool_started", callId: id, name: step.label, input: {} }]);
        if (step.n === crashAt) {
          // THE CRASH. The intent is recorded; the outcome never was. Whether the
          // effect actually landed is exactly what nobody can know afterwards.
          if (effectLanded) {
            if (step.label.startsWith("send_email")) world.emailsSent++;
            if (step.label.startsWith("close_ticket")) world.ticketsClosed++;
          }
          break;
        }
        if (step.label.startsWith("send_email")) world.emailsSent++;
        if (step.label.startsWith("close_ticket")) world.ticketsClosed++;
        log.append(runId, [{ t: "tool_finished", callId: id, content: "ok", isError: false }]);
      }
    }

    const r = runFrom(log, runId, world, {
      policy: policy === "verify-no-verifier" ? "verify" : policy,
      hasVerifier: policy === "verify",
      effectLanded,
    });
    return { ...r, world };
  }

  // Step 6 is the non-idempotent write; crashing there is the hard case.
  console.log("  crash between send_email and its outcome event (step 6)\n");
  console.log(`  ${"policy".padEnd(20)} ${"effect landed".padEnd(14)} ${"emails sent".padStart(11)} ${"escalated".padStart(10)}  verdict`);
  for (const policy of ["rerun", "skip", "verify", "verify-no-verifier"] as const) {
    for (const landed of [true, false]) {
      const t = trial(6, policy, landed);
      const dup = t.world.emailsSent > 1;
      const lost = t.world.emailsSent === 0 && !t.escalated;
      const verdict = dup ? "⚠ DUPLICATE — customer emailed twice"
        : lost ? "⚠ SILENT LOSS — nobody was emailed"
        : t.escalated ? "a human decides (correct)" : "exactly once (correct)";
      console.log(`  ${policy.padEnd(20)} ${(landed ? "yes" : "no").padEnd(14)} ${String(t.world.emailsSent).padStart(11)} ` +
                  `${String(t.escalated).padStart(10)}  ${verdict}`);
    }
  }

  console.log(`\n  "rerun" duplicates when the effect had landed. "skip" loses it silently when`);
  console.log(`  it had not. Only verification distinguishes the two — and when no verifier`);
  console.log(`  exists, stopping to ask a human is the only honest option for money.`);
  console.log(`\n  An idempotency key derived from (runId, callId) removes this table entirely:`);
  console.log(`  re-running becomes safe, and the escalation branch is never reached.`);

  // Replay cost across every crash point.
  console.log(`\n  replay cost, crashing after each of the 9 steps (verify policy)\n`);
  console.log(`  ${"crash after".padStart(11)} ${"replayed".padStart(9)} ${"re-executed".padStart(12)} ${"model calls".padStart(12)}`);
  let totalRepaid = 0;
  for (let c = 1; c <= STEPS.length; c++) {
    const t = trial(c, "verify", true);
    totalRepaid += t.world.modelCalls;
    if (c % 3 === 0) console.log(`  ${String(c).padStart(11)} ${String(t.replayed).padStart(9)} ${String(t.executed).padStart(12)} ${String(t.world.modelCalls).padStart(12)}`);
  }
  console.log(`\n  A recorded outcome replays in microseconds and costs nothing. Without the log,`);
  console.log(`  every one of those runs would have repaid all ${STEPS.filter((s) => s.kind === "model").length} model calls from the start.`);

  // Forking.
  const log = new MemoryEventLog();
  log.append("r", [{ t: "run_started", goal: "g" }]);
  runFrom(log, "r", { emailsSent: 0, ticketsClosed: 0, modelCalls: 0 }, { policy: "verify", hasVerifier: true, effectLanded: true });
  const f = fork(log, "r", 4, { content: "No passages matched.", isError: false } as Partial<RunEvent>);
  console.log(`\n  fork(r, seq 4, patch the search result → "no results") → ${f}`);
  console.log(`  ${log.read(f).length} events copied; the original is untouched (${log.read("r").length} events).`);
  console.log(`  That is a counterfactual test case recorded from a real run rather than imagined.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
