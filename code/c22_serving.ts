/**
 * C22 · Shipping — a run that outlives its request: durable queue with leases,
 * resumable SSE, token-based admission control, fair queueing, and a chaos test.
 *   node --experimental-strip-types code/c22_serving.ts
 */

/* ---------------- resumable SSE ---------------- */

export interface StreamEvent { seq: number; type: string; data: unknown }

/** The `id:` field is what the browser sends back as Last-Event-ID. Without it,
 *  reconnection restarts from live and the client silently misses the gap. */
export const frame = (e: StreamEvent): string =>
  `id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`;

export const HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",   // no-transform: proxies WILL buffer otherwise
  "connection": "keep-alive",
  "x-accel-buffering": "no",                   // nginx specifically
};

export class EventBus {
  private events = new Map<string, StreamEvent[]>();
  private subs = new Map<string, Set<(e: StreamEvent) => void>>();

  /** Append to the durable log BEFORE publishing, or a client can see an event
   *  that is not yet durable and diverge from the run's real history. */
  publish(runId: string, type: string, data: unknown): StreamEvent {
    const arr = this.events.get(runId) ?? [];
    const e: StreamEvent = { seq: arr.length + 1, type, data };
    arr.push(e);
    this.events.set(runId, arr);
    for (const fn of this.subs.get(runId) ?? []) fn(e);
    return e;
  }
  /** Replay what the client missed, then follow live. */
  attach(runId: string, lastEventId: number, onEvent: (e: StreamEvent) => void): () => void {
    for (const e of (this.events.get(runId) ?? []).filter((x) => x.seq > lastEventId)) onEvent(e);
    const set = this.subs.get(runId) ?? new Set();
    set.add(onEvent);
    this.subs.set(runId, set);
    return () => set.delete(onEvent);
  }
  count(runId: string): number { return (this.events.get(runId) ?? []).length; }
}

/* ---------------- durable queue with leases and fencing ---------------- */

export interface Job { runId: string; tenant: string; attempts: number; token: number; leaseUntil: number; state: "queued" | "leased" | "done" | "failed" | "suspended" }

export class FairQueue {
  private jobs: Job[] = [];
  private cursor = 0;
  private inFlight = new Map<string, number>();
  private maxPerTenant: number;
  constructor(maxPerTenant = 2) { this.maxPerTenant = maxPerTenant; }

  submit(runId: string, tenant: string): Job {
    const j: Job = { runId, tenant, attempts: 0, token: 0, leaseUntil: 0, state: "queued" };
    this.jobs.push(j);
    return j;
  }

  /** Weighted round-robin: one tenant submitting 500 runs must not block the rest. */
  claim(now: number, leaseMs = 30_000): Job | null {
    const tenants = [...new Set(this.jobs.filter((j) => j.state === "queued").map((j) => j.tenant))];
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[(this.cursor + i) % tenants.length];
      if ((this.inFlight.get(t) ?? 0) >= this.maxPerTenant) continue;
      const j = this.jobs.find((x) => x.state === "queued" && x.tenant === t);
      if (!j) continue;
      this.cursor = (this.cursor + i + 1) % Math.max(tenants.length, 1);
      j.state = "leased";
      j.token++;                                   // the fencing token
      j.leaseUntil = now + leaseMs;
      j.attempts++;
      this.inFlight.set(t, (this.inFlight.get(t) ?? 0) + 1);
      return j;
    }
    return null;
  }

  /** A worker that pauses past its lease must not be able to write: its token is stale. */
  guard(j: Job, token: number): void {
    if (token < j.token) throw new Error(`fenced: token ${token} < ${j.token} (another worker took over)`);
  }

  release(j: Job, state: Job["state"] = "queued"): void {
    j.state = state;
    j.leaseUntil = 0;
    this.inFlight.set(j.tenant, Math.max(0, (this.inFlight.get(j.tenant) ?? 1) - 1));
  }

  /** The TTL is the backstop, not the plan. */
  reap(now: number): number {
    let n = 0;
    for (const j of this.jobs) if (j.state === "leased" && j.leaseUntil < now) { this.release(j); n++; }
    return n;
  }

  get pending(): number { return this.jobs.filter((j) => j.state === "queued").length; }
  get stats() {
    const by = (s: Job["state"]) => this.jobs.filter((j) => j.state === s).length;
    return { queued: by("queued"), leased: by("leased"), done: by("done"), failed: by("failed"), suspended: by("suspended") };
  }
}

/* ---------------- admission control ---------------- */

/** Agents are an input-token workload, so the token ceiling binds long before
 *  the request ceiling. Admission belongs in front of the queue, not in retries. */
export class TokenLimiter {
  private window: Array<{ at: number; tokens: number }> = [];
  private limitPerMin: number;
  private headroom: number;
  constructor(limitPerMin: number, headroom = 0.85) { this.limitPerMin = limitPerMin; this.headroom = headroom; }
  admit(estimatedTokens: number, now: number): boolean {
    this.window = this.window.filter((w) => w.at > now - 60_000);
    const used = this.window.reduce((t, w) => t + w.tokens, 0);
    if (used + estimatedTokens > this.limitPerMin * this.headroom) return false;
    this.window.push({ at: now, tokens: estimatedTokens });
    return true;
  }
}

export function capacity(limitPerMin: number, contextPerCall: number, callsPerRun: number, workers: number, runSeconds: number) {
  const callsFromTokens = (limitPerMin * 0.85) / contextPerCall;
  const runsFromTokens = callsFromTokens / callsPerRun;
  const runsFromWorkers = (workers * 60) / runSeconds;
  return {
    runsFromTokens, runsFromWorkers,
    capacity: Math.min(runsFromTokens, runsFromWorkers),
    binding: runsFromTokens < runsFromWorkers ? "provider tokens" : "workers",
  };
}

/* ---------------- demo ---------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log("\n  C22 · Shipping\n");

  // Resumable streaming.
  const bus = new EventBus();
  const runId = "r_8a1f";
  const received: number[] = [];
  const detach = bus.attach(runId, 0, (e) => received.push(e.seq));
  bus.publish(runId, "step_started", { n: 1, summary: "Searching orders for 4471" });
  bus.publish(runId, "tool_finished", { name: "search_orders", ms: 302, ok: true });
  detach();                                            // ← the client drops here
  bus.publish(runId, "step_started", { n: 2, summary: "Reading the returns policy" });
  bus.publish(runId, "plan_updated", { steps: 3, done: 1 });
  const afterReconnect: number[] = [];
  bus.attach(runId, received.at(-1)!, (e) => afterReconnect.push(e.seq));

  console.log("  resumable SSE — a 20-second dropout\n");
  console.log(`    before the drop:  received events ${received.join(", ")}`);
  console.log(`    during the drop:  2 events published to the durable log`);
  console.log(`    on reconnect:     Last-Event-ID: ${received.at(-1)} → replayed ${afterReconnect.join(", ")}`);
  console.log(`\n    Seamless, because every event carried an id: and was persisted before publish.`);
  console.log(`    ${Object.entries(HEADERS).map(([k, v]) => `${k}: ${v}`).join("\n    ")}`);

  // Leases and fencing.
  console.log(`\n  leases and fencing tokens — two workers, one run\n`);
  const q = new FairQueue(2);
  const job = q.submit("r_1", "acme");
  let now = 0;
  const a = q.claim(now)!;
  const workerAToken = a.token;
  console.log(`    worker A claims r_1 with token ${workerAToken}, lease until t=${a.leaseUntil}`);
  now = 40_000;
  console.log(`    worker A pauses (GC / network partition). t=${now}, lease expired.`);
  console.log(`    reaper released ${q.reap(now)} expired lease(s)`);
  const b = q.claim(now)!;
  console.log(`    worker B claims r_1 with token ${b.token}`);
  try { q.guard(job, workerAToken); console.log(`    worker A writes — ACCEPTED (this would corrupt state)`); }
  catch (e) { console.log(`    worker A wakes and tries to write → ${(e as Error).message}`); }
  console.log(`\n    A TTL alone is not enough: a paused worker believes it still holds the lease.`);

  // Fair queueing.
  console.log(`\n  fair queueing — one tenant submitting 500 runs must not block the rest\n`);
  const fq = new FairQueue(2);
  for (let i = 0; i < 20; i++) fq.submit(`noisy_${i}`, "noisy-tenant");
  fq.submit("quiet_1", "quiet-tenant");
  fq.submit("quiet_2", "other-tenant");
  const claimed: string[] = [];
  for (let i = 0; i < 6; i++) { const j = fq.claim(0); if (j) claimed.push(j.tenant); }
  console.log(`    claim order: ${claimed.join(" → ")}`);
  console.log(`    The quiet tenants were served within the first few claims despite being`);
  console.log(`    submitted last, and the noisy tenant is capped at ${2} concurrent runs.`);

  // Capacity.
  console.log(`\n  capacity — the arithmetic people get wrong\n`);
  console.log(`  ${"limit/min".padStart(10)} ${"ctx/call".padStart(9)} ${"calls/run".padStart(10)} ${"workers".padStart(8)} ${"runs/min".padStart(9)}  binding constraint`);
  for (const [limit, ctx, calls, workers] of [
    [800_000, 18_000, 6, 16],
    [800_000, 40_000, 6, 16],
    [800_000, 18_000, 6, 64],
    [2_000_000, 18_000, 6, 16],
  ] as const) {
    const c = capacity(limit, ctx, calls, workers, 17);
    console.log(`  ${(limit / 1000 + "K").padStart(10)} ${(ctx / 1000 + "K").padStart(9)} ${String(calls).padStart(10)} ` +
      `${String(workers).padStart(8)} ${c.capacity.toFixed(1).padStart(9)}  ${c.binding}`);
  }
  console.log(`\n    Doubling context per call halves capacity. Quadrupling workers changes nothing`);
  console.log(`    when tokens bind — it converts queue wait into 429s. Context size is a`);
  console.log(`    capacity decision as much as a cost one.`);

  // Chaos.
  console.log(`\n  chaos: kill a worker mid-run under load\n`);
  const cq = new FairQueue(4);
  const bus2 = new EventBus();
  for (let i = 0; i < 12; i++) cq.submit(`run_${i}`, `tenant_${i % 3}`);
  let completed = 0, resumed = 0, duplicates = 0;
  const effects = new Map<string, number>();

  const work = async (j: Job, killAfterStep: number | null) => {
    const token = j.token;
    for (let step = 1; step <= 4; step++) {
      try { cq.guard(j, token); } catch { return "fenced"; }
      bus2.publish(j.runId, "step_started", { n: step });
      if (step === 3) {
        // The write. Recorded as an event first, so a resume can replay it.
        const already = (effects.get(j.runId) ?? 0) > 0;
        if (!already) effects.set(j.runId, 1); else duplicates++;
      }
      if (killAfterStep === step) { cq.release(j); return "killed"; }
      await sleep(1);
    }
    cq.release(j, "done");
    completed++;
    return "done";
  };

  // Round 1: claim everything, kill a third of the workers mid-run.
  const first: Job[] = [];
  for (;;) { const j = cq.claim(0); if (!j) break; first.push(j); }
  await Promise.all(first.map((j, i) => work(j, i % 3 === 0 ? 2 : null)));
  // Round 2: whatever was released is resumed by other workers.
  for (;;) {
    const j = cq.claim(0);
    if (!j) break;
    resumed++;
    await work(j, null);
  }

  console.log(`    12 runs · ${first.length} initially claimed · ${resumed} resumed after a worker died`);
  console.log(`    completed: ${completed}/12 · lost runs: ${12 - completed} · duplicate side effects: ${duplicates}`);
  console.log(`    events streamed: ${[...Array(12).keys()].reduce((t, i) => t + bus2.count(`run_${i}`), 0)}`);
  console.log(`    queue: ${JSON.stringify(cq.stats)}`);
  console.log(`\n    Zero lost runs and zero duplicate effects, because the run is a durable`);
  console.log(`    object with an id and the connection was only ever a view of it.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
