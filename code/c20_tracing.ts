/**
 * C20 · Observability & Cost — spans with AsyncLocalStorage propagation, tail
 * sampling, redaction, and the caused-token blame report.
 *   node --experimental-strip-types code/c20_tracing.ts
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type SpanKind = "run" | "model" | "tool" | "subagent" | "retrieval" | "approval";
export type Terminal = "answered" | "budget" | "stuck" | "blocked" | "error" | "cancelled";

export interface Span {
  traceId: string; spanId: string; parentId?: string;
  name: string; kind: SpanKind;
  startedAt: number; endedAt?: number;
  status: "ok" | "error" | "cancelled";
  attributes: Record<string, unknown>;
}

const als = new AsyncLocalStorage<Span>();
let counter = 0;
const newId = () => (++counter).toString(36).padStart(4, "0");

export const exporter: { spans: Span[]; push(s: Span): void } = {
  spans: [],
  push(s) { exporter.spans.push(redact(s)); },
};

/** One line per call site, and nesting is automatic — no context threading. */
export async function span<T>(
  name: string, kind: SpanKind, attrs: Record<string, unknown>, fn: (s: Span) => Promise<T>,
): Promise<T> {
  const parent = als.getStore();
  const s: Span = {
    traceId: parent?.traceId ?? `r_${newId()}`,
    spanId: newId(), parentId: parent?.spanId,
    name, kind, startedAt: Date.now(), status: "ok",
    attributes: { "run.id": parent?.attributes["run.id"] ?? `r_${newId()}`, ...attrs },
  };
  return als.run(s, async () => {
    try { return await fn(s); }
    catch (e) {
      s.status = (e as Error).name === "AbortError" ? "cancelled" : "error";
      s.attributes["error.message"] = String((e as Error).message);
      throw e;
    } finally { s.endedAt = Date.now(); exporter.push(s); }
  });
}

/* ---------------- redaction: once, at the boundary ---------------- */

const REDACT: Array<[RegExp, string]> = [
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "<email>"],
  [/\bsk-[A-Za-z0-9]{12,}\b/g, "<api-key>"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "<card>"],
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer <token>"],
];

export function redact(s: Span): Span {
  const scrub = (v: unknown): unknown =>
    typeof v === "string" ? REDACT.reduce((t, [re, to]) => t.replace(re, to), v) : v;
  return { ...s, attributes: Object.fromEntries(Object.entries(s.attributes).map(([k, v]) => [k, scrub(v)])) };
}

/* ---------------- cost attribution ---------------- */

export interface Blame { tool: string; producedTokens: number; laterModelCalls: number; causedInputTokens: number; causedUsd: number }

/**
 * The naive view sums cost per call and tells you which CALL was expensive. It
 * cannot tell you what CAUSED the expense: a tool result is re-sent on every
 * subsequent model call, so its true cost is size × turns remaining.
 */
export function blame(spans: Span[], inputPricePerMtok = 3): Blame[] {
  const models = spans.filter((s) => s.kind === "model").sort((a, b) => a.startedAt - b.startedAt);
  const byTool = new Map<string, Blame>();
  for (const t of spans.filter((s) => s.kind === "tool")) {
    const name = String(t.attributes["tool.name"]);
    const produced = Number(t.attributes["tool.result.tokens"] ?? 0);
    const later = models.filter((m) => m.startedAt >= (t.endedAt ?? t.startedAt)).length;
    const cur = byTool.get(name) ?? { tool: name, producedTokens: 0, laterModelCalls: 0, causedInputTokens: 0, causedUsd: 0 };
    cur.producedTokens += produced;
    cur.laterModelCalls += later;
    cur.causedInputTokens += produced * later;
    cur.causedUsd = (cur.causedInputTokens * inputPricePerMtok) / 1e6;
    byTool.set(name, cur);
  }
  return [...byTool.values()].sort((a, b) => b.causedInputTokens - a.causedInputTokens);
}

/* ---------------- tail sampling ---------------- */

export type SampleDecision = "full" | "attributes" | "drop";

/** Decided at the END of a run, when the terminal state is known. Head sampling
 *  drops the anomaly you needed before anything has gone wrong. */
export function samplePolicy(run: Span, p95Steps: number): SampleDecision {
  if (run.status === "error") return "full";
  if (run.attributes["agent.terminal_state"] !== "answered") return "full";
  if (run.attributes["agent.repeat_detected"]) return "full";
  if (Number(run.attributes["run.step"] ?? 0) > p95Steps) return "full";
  return hash(run.traceId) % 100 < 2 ? "full" : "attributes";      // 2% for evals
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* ---------------- waterfall ---------------- */

export function waterfall(spans: Span[], traceId: string): string {
  const inTrace = spans.filter((s) => s.traceId === traceId);
  const root = inTrace.find((s) => !s.parentId);
  if (!root) return "(no root span)";
  const total = Math.max(1, (root.endedAt ?? 0) - root.startedAt);
  const lines: string[] = [];
  const walk = (s: Span, depth: number) => {
    const dur = (s.endedAt ?? 0) - s.startedAt;
    const offset = Math.round(((s.startedAt - root.startedAt) / total) * 40);
    const width = Math.max(1, Math.round((dur / total) * 40));
    const bar = " ".repeat(offset) + "█".repeat(width);
    const cost = s.attributes["llm.cost_usd"] ? `$${Number(s.attributes["llm.cost_usd"]).toFixed(3)}` : "";
    const tok = s.attributes["llm.tokens.input"] ?? s.attributes["tool.result.tokens"] ?? "";
    lines.push(`  ${"  ".repeat(depth)}${s.name.padEnd(24 - depth * 2)} ${bar.padEnd(42)} ${String(dur).padStart(5)}ms ${String(tok).padStart(7)} ${cost.padStart(7)}` +
      (s.status !== "ok" ? `  ${s.status.toUpperCase()}` : ""));
    for (const c of inTrace.filter((x) => x.parentId === s.spanId)) walk(c, depth + 1);
  };
  walk(root, 0);
  return lines.join("\n");
}

/* ---------------- demo ---------------- */

/**
 * The demo uses a virtual clock so the waterfall is byte-reproducible. Real
 * instrumentation reads Date.now(); nothing else about the span code changes.
 */
let virtualNow = 1_700_000_000_000;
const advance = (ms: number) => { virtualNow += ms; };
const realNow = Date.now;
(Date as any).now = () => virtualNow;

async function main(): Promise<void> {
  console.log("\n  C20 · Observability & Cost\n");

  // One instrumented run.
  await span("agent.run", "run", { "run.id": "r_7c21", "user.id": "ana@customer.com", "agent.terminal_state": "answered", "run.step": 5 }, async () => {
    await span("model.call", "model", { "llm.model": "mock", "llm.tokens.input": 4210, "llm.cost_usd": 0.013 }, async () => { advance(12); });
    await span("tool.search_docs", "tool", { "tool.name": "search_docs", "tool.result.tokens": 1900 }, async () => { advance(4); });
    await span("model.call", "model", { "llm.model": "mock", "llm.tokens.input": 7880, "llm.cost_usd": 0.024 }, async () => { advance(15); });
    await span("tool.list_files", "tool", { "tool.name": "list_files", "tool.result.tokens": 6800 }, async () => { advance(3); });
    await span("tool.run_tests", "tool", { "tool.name": "run_tests", "tool.result.tokens": 900 }, async () => { advance(38); });
    await span("agent.researcher", "subagent", { "agent.name": "researcher" }, async () => {
      await span("model.call", "model", { "llm.model": "small", "llm.tokens.input": 3100, "llm.cost_usd": 0.004 }, async () => { advance(9); });
      await span("tool.grep", "tool", { "tool.name": "grep", "tool.result.tokens": 600 }, async () => { advance(2); });
    });
    await span("model.call", "model", { "llm.model": "mock", "llm.tokens.input": 14300, "llm.cost_usd": 0.046 }, async () => { advance(11); });
  });

  const traceId = exporter.spans[0].traceId;
  console.log(`  one run as a waterfall (trace ${traceId})\n`);
  console.log(`  ${"span".padEnd(24)} ${"".padEnd(42)} ${"dur".padStart(7)} ${"tokens".padStart(7)} ${"cost".padStart(7)}`);
  console.log(waterfall(exporter.spans, traceId));
  console.log(`\n    Nesting came from AsyncLocalStorage — no context object was threaded`);
  console.log(`    through any function, and the subagent's spans attached to the right parent.`);

  // Blame.
  console.log(`\n  cost attribution: which CALL was expensive vs what CAUSED the expense\n`);
  const tools = exporter.spans.filter((s) => s.kind === "tool");
  console.log(`  ${"tool".padEnd(15)} ${"produced".padStart(9)} ${"later calls".padStart(12)} ${"caused input".padStart(13)} ${"caused $".padStart(9)}  share`);
  const rows = blame(exporter.spans);
  const totalCaused = rows.reduce((t, r) => t + r.causedInputTokens, 0);
  for (const r of rows) {
    console.log(`  ${r.tool.padEnd(15)} ${r.producedTokens.toLocaleString().padStart(9)} ${String(r.laterModelCalls).padStart(12)} ` +
      `${r.causedInputTokens.toLocaleString().padStart(13)} ${("$" + r.causedUsd.toFixed(4)).padStart(9)}  ${((r.causedInputTokens / totalCaused) * 100).toFixed(0)}%`);
  }
  // The naive question — "which call cost the most?" — always answers "a model call",
  // because tools are free. It cannot point at the thing that made them expensive.
  const dearest = exporter.spans.filter((s) => s.kind === "model")
    .sort((a, b) => Number(b.attributes["llm.cost_usd"] ?? 0) - Number(a.attributes["llm.cost_usd"] ?? 0))[0];
  console.log(`\n    per-call view  → the most expensive call was a ${dearest.name} at ` +
    `$${Number(dearest.attributes["llm.cost_usd"]).toFixed(3)} (${Number(dearest.attributes["llm.tokens.input"]).toLocaleString()} input tokens).`);
  console.log(`                     True, and not actionable: you cannot delete the answer.`);
  console.log(`    blame view     → ${rows[0].tool} produced ${rows[0].producedTokens.toLocaleString()} tokens early and is responsible for`);
  console.log(`                     ${Math.round((rows[0].causedInputTokens / totalCaused) * 100)}% of the input tokens those calls billed.`);
  console.log(`                     Actionable: cap it, and the expensive call gets cheaper.`);

  // Redaction.
  console.log(`\n  redaction happens once, in the exporter:\n`);
  const raw = "contact ana@customer.com with key sk-ant-abcdefghij12345 and card 4111 1111 1111 1111";
  const scrubbed = REDACT.reduce((t, [re, to]) => t.replace(re, to), raw);
  console.log(`    before: ${raw}`);
  console.log(`    after:  ${scrubbed}`);

  // Tail sampling.
  console.log(`\n  tail sampling — decided AFTER the run, so anomalies are never dropped\n`);
  const runs: Array<[string, Partial<Span>]> = [
    ["answered, 4 steps", { status: "ok", attributes: { "agent.terminal_state": "answered", "run.step": 4 } }],
    ["answered, 19 steps (slow tail)", { status: "ok", attributes: { "agent.terminal_state": "answered", "run.step": 19 } }],
    ["budget exhausted", { status: "ok", attributes: { "agent.terminal_state": "budget", "run.step": 10 } }],
    ["repeat detector fired", { status: "ok", attributes: { "agent.terminal_state": "answered", "run.step": 6, "agent.repeat_detected": true } }],
    ["errored", { status: "error", attributes: { "agent.terminal_state": "error", "run.step": 2 } }],
  ];
  for (const [label, partial] of runs) {
    const s = { traceId: `t_${label.length}`, spanId: "x", name: "run", kind: "run" as const, startedAt: 0, status: "ok" as const, attributes: {}, ...partial } as Span;
    console.log(`    ${samplePolicy(s, 12).padEnd(11)} ${label}`);
  }
  console.log(`\n  Head sampling would have decided before any of that was known.\n`);
  (Date as any).now = realNow;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
