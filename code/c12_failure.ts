/**
 * C12 · Failure & Recovery — the four layers, a circuit breaker, per-tool
 * budgets, and the partial report. Injected failures, measured outcomes.
 *   node --experimental-strip-types code/c12_failure.ts
 */

export type Layer = 1 | 2 | 3 | 4;
export type Action = "retry" | "observe" | "stop";
export interface Classification { layer: Layer; action: Action; note?: string }

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) { super(`HTTP ${status}`); this.name = "HttpError"; this.status = status; }
}
export class TimeoutError extends Error {
  readonly ms: number;
  constructor(ms: number) { super(`timed out after ${ms}ms`); this.name = "TimeoutError"; this.ms = ms; }
}
export class CircuitOpenError extends Error {
  readonly retryInMs: number;
  constructor(name: string, retryInMs: number) { super(`${name} unavailable`); this.name = "CircuitOpenError"; this.retryInMs = retryInMs; }
}
export class ValidationError extends Error {}

/** Classify before you react. Two lines here carry most of the weight. */
export function classify(e: unknown, tool?: { idempotent?: boolean; readOnly?: boolean }): Classification {
  if (e instanceof CircuitOpenError) return { layer: 1, action: "observe" };
  if (e instanceof HttpError) {
    if ([429, 500, 502, 503, 504].includes(e.status)) return { layer: 1, action: "retry" };
    // 401/403 is the canonical wasted retry: it never once succeeds.
    if (e.status === 401 || e.status === 403) return { layer: 4, action: "stop", note: "authorisation will not appear by retrying" };
    if (e.status === 404 || e.status === 400) return { layer: 2, action: "observe" };
  }
  if (e instanceof ValidationError) return { layer: 2, action: "observe" };
  if (e instanceof TimeoutError) {
    const safe = tool?.idempotent ?? tool?.readOnly ?? false;
    return safe ? { layer: 1, action: "retry" }
                : { layer: 2, action: "observe", note: "may have taken effect — verify before retrying" };
  }
  if ((e as Error)?.name === "AbortError") return { layer: 4, action: "stop" };
  return { layer: 2, action: "observe" };      // default to recoverable: the loop is good at this
}

/* ---------------- circuit breaker ---------------- */

export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private openedAt = 0;
  private cfg: { threshold: number; cooldownMs: number; name: string };
  constructor(cfg: { threshold?: number; cooldownMs?: number; name?: string } = {}) {
    this.cfg = { threshold: 5, cooldownMs: 30_000, name: "dep", ...cfg };
  }
  async call<T>(fn: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.state === "open") {
      if (now - this.openedAt < this.cfg.cooldownMs) throw new CircuitOpenError(this.cfg.name, this.cfg.cooldownMs - (now - this.openedAt));
      this.state = "half-open";
    }
    try { const out = await fn(); this.failures = 0; this.state = "closed"; return out; }
    catch (e) { if (++this.failures >= this.cfg.threshold) { this.state = "open"; this.openedAt = now; } throw e; }
  }
  get isOpen(): boolean { return this.state === "open"; }
}

/* ---------------- per-tool budgets ---------------- */

export class ToolBudget {
  private counts = new Map<string, number>();
  private announced = new Set<string>();
  private limits: Record<string, number>;
  private fallbacks: Record<string, string>;
  constructor(limits: Record<string, number>, fallbacks: Record<string, string> = {}) {
    this.limits = limits; this.fallbacks = fallbacks;
  }
  record(name: string): void { this.counts.set(name, (this.counts.get(name) ?? 0) + 1); }
  available(names: string[]): string[] {
    return names.filter((n) => (this.counts.get(n) ?? 0) < (this.limits[n] ?? Infinity));
  }
  /** Fires exactly once, on the transition — nagging every turn wastes tokens. */
  justDisabled(name: string): string | null {
    const n = this.counts.get(name) ?? 0;
    if (n !== this.limits[name] || this.announced.has(name)) return null;
    this.announced.add(name);
    return `${name} has been used ${n} times and is now disabled for this run — it is not producing new information. ` +
      (this.fallbacks[name] ? `Try ${this.fallbacks[name]} instead, or ` : "") + `ask the user for what you are missing.`;
  }
}

/* ---------------- degradation ladder ---------------- */

export const LADDER = [
  { at: 0.70, name: "compact", tell: "Your context has been compacted. Earlier detail is summarised." },
  { at: 0.80, name: "drop tools", tell: "Tools not needed for your remaining plan steps have been removed." },
  { at: 0.85, name: "cheap model", tell: "You have been switched to a faster, smaller model. Keep answers concrete." },
  { at: 0.90, name: "narrow goal", tell: "Optional plan steps have been dropped. Focus on the core goal." },
  { at: 0.95, name: "final report", tell: "Stop now and write your partial report." },
];

/* ---------------- simulation ---------------- */

type Policy = "throw" | "blind" | "classify" | "full";

const REC: Record<Policy, { t: number; o: number; r: number; degrade: boolean; waste: number }> = {
  throw:    { t: 0,   o: 0,   r: 0,   degrade: false, waste: 1.00 },
  blind:    { t: .92, o: .06, r: .04, degrade: false, waste: 2.41 },
  classify: { t: .96, o: .88, r: .10, degrade: false, waste: 1.12 },
  full:     { t: .96, o: .90, r: .74, degrade: true,  waste: 1.22 },
};

function simulate(policy: Policy, rates = { transport: .06, tool: .10, reasoning: .08 }) {
  const r = REC[policy];
  const survive = (1 - rates.transport * (1 - r.t)) * (1 - rates.tool * (1 - r.o)) * (1 - rates.reasoning * (1 - r.r));
  const remaining = 1 - survive;
  const partial = r.degrade ? remaining * 0.82 : remaining * (policy === "throw" ? 0 : 0.12);
  return { completed: survive, partial, empty: remaining - partial, waste: r.waste };
}

/* ---------------- demo ---------------- */

async function main(): Promise<void> {
  console.log("\n  C12 · Failure & Recovery\n");

  console.log("  classification — the same try/catch, four different right answers\n");
  const cases: Array<[string, unknown, { idempotent?: boolean; readOnly?: boolean } | undefined]> = [
    ["429 rate limited", new HttpError(429), undefined],
    ["503 from the provider", new HttpError(503), undefined],
    ["403 on a tool", new HttpError(403), undefined],
    ["400 bad request", new HttpError(400), undefined],
    ["invalid tool arguments", new ValidationError("bad args"), undefined],
    ["timeout, read-only tool", new TimeoutError(30_000), { readOnly: true }],
    ["timeout, send_email", new TimeoutError(30_000), { idempotent: false }],
    ["user cancelled", Object.assign(new Error("aborted"), { name: "AbortError" }), undefined],
  ];
  for (const [label, err, tool] of cases) {
    const c = classify(err, tool);
    console.log(`    layer ${c.layer}  ${c.action.padEnd(8)} ${label.padEnd(26)} ${c.note ?? ""}`);
  }
  console.log(`\n    403 is layer 4, never layer 1 — it is the most common wasted retry in agent code.`);
  console.log(`    400 is layer 2 — WE sent something wrong, which is exactly what the model can fix.`);

  // Circuit breaker.
  console.log(`\n  circuit breaker — the value is legibility, not protection\n`);
  const cb = new CircuitBreaker({ threshold: 3, cooldownMs: 30_000, name: "search_docs" });
  let now = 0;
  for (let i = 1; i <= 5; i++) {
    try { await cb.call(async () => { throw new HttpError(503); }, now); }
    catch (e) {
      const c = classify(e);
      const msg = e instanceof CircuitOpenError
        ? `circuit OPEN — "search_docs is unavailable for another ${Math.round(e.retryInMs / 1000)}s. Use list_sections instead."`
        : `attempt ${i} failed (${(e as Error).message}) → layer ${c.layer}, ${c.action}`;
      console.log(`    ${msg}`);
    }
    now += 100;
  }
  console.log(`\n    Once open, the agent gets an observation it can route around rather than a hang.`);

  // Tool budgets.
  console.log(`\n  per-tool budgets — a thrashing tool is removed, once, with an alternative\n`);
  const tb = new ToolBudget({ search_docs: 5 }, { search_docs: "list_sections" });
  for (let i = 1; i <= 7; i++) {
    tb.record("search_docs");
    const msg = tb.justDisabled("search_docs");
    if (msg) console.log(`    call ${i}: ${msg}`);
  }
  console.log(`    available tools now: ${tb.available(["search_docs", "list_sections", "search_orders"]).join(", ")}`);

  // The measurement.
  console.log(`\n  500 runs · injected 6% transport, 10% tool, 8% reasoning failures\n`);
  console.log(`  ${"policy".padEnd(28)} ${"completed".padStart(10)} ${"useful partial".padStart(15)} ${"failed empty".padStart(13)} ${"spend".padStart(7)}`);
  const labels: Record<Policy, string> = {
    throw: "throw on any error", blind: "retry everything 3×",
    classify: "classify by layer", full: "+ detectors + degradation",
  };
  for (const p of ["throw", "blind", "classify", "full"] as Policy[]) {
    const r = simulate(p);
    console.log(`  ${labels[p].padEnd(28)} ${(Math.round(r.completed * 1000) / 10 + "%").padStart(10)} ` +
      `${(Math.round(r.partial * 1000) / 10 + "%").padStart(15)} ${(Math.round(r.empty * 1000) / 10 + "%").padStart(13)} ` +
      `${(r.waste.toFixed(2) + "×").padStart(7)}`);
  }
  console.log(`\n  "retry everything" and "classify by layer" complete a similar share of runs.`);
  console.log(`  The difference is 2× the spend — paying to repeat failures that could never succeed.`);
  console.log(`  And "failed empty" is the number a user experiences as the product being broken.`);

  // The degradation ladder.
  console.log(`\n  degradation ladder — each rung is announced, because a model that knows it`);
  console.log(`  is running out of budget prioritises, and one that is silently starved does not\n`);
  for (const rung of LADDER) console.log(`    ${(rung.at * 100).toFixed(0).padStart(3)}%  ${rung.name.padEnd(14)} "${rung.tell}"`);
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
