/**
 * C03 · Tools
 *
 * A registry where nothing throws: unknown names, bad arguments, thrown errors
 * and timeouts all come back as observations the model can act on.
 *
 *   node --experimental-strip-types code/c03_tools.ts
 */

import type { Block, ToolSchema } from "./c01_model_call.ts";
import { obj, str, opt, int, type Schema } from "./c02_structured_output.ts";

/* ------------------------------------------------------------------ types */

export interface ToolContext {
  signal: AbortSignal;
  callId: string;
  workingDir: string;
  log: (event: string, data?: unknown) => void;
}

export interface Tool<I = any, O = any> {
  name: string;
  description: string;
  input: Schema<I>;
  run: (input: I, ctx: ToolContext) => Promise<O>;
  /** Metadata the loop needs and the model never sees. */
  readOnly?: boolean;
  idempotent?: boolean;
  timeoutMs?: number;
  maxResultTokens?: number;
  verify?: (input: I) => Promise<boolean>;
}

export interface ToolUse { id: string; name: string; input: unknown }
export interface ToolResult { id: string; content: string; isError?: boolean; ms: number }

export const defineTool = <I, O>(t: Tool<I, O>): Tool<I, O> => t;

export const toSchema = (t: Tool): ToolSchema => ({
  name: t.name, description: t.description, input_schema: t.input.json,
});

/* ------------------------------------------------------------------ helpers */

/**
 * A timeout only works if the operation is cancellable. Every tool that waits
 * must honour ctx.signal — otherwise the AbortController fires and the work
 * carries on regardless, which is the most common reason a timeout "does nothing".
 */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

/** Levenshtein, for "did you mean". Twenty lines, and it saves a step per typo. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export const closest = (name: string, options: string[]): string | null => {
  const scored = options.map((o) => [o, editDistance(name, o)] as const).sort((x, y) => x[1] - y[1]);
  return scored.length && scored[0][1] <= Math.max(2, Math.floor(name.length / 3)) ? scored[0][0] : null;
};

/** Head AND tail, with a remedy. Truncating only the head hides the summary line. */
export function cap(text: string, maxTokens: number, tool: string): string {
  const max = maxTokens * 4;
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.7));
  const tail = text.slice(-Math.floor(max * 0.2));
  return `${head}\n\n[... ${(text.length - max).toLocaleString()} characters omitted. ` +
    `Narrow the query, or call ${tool} with a page/offset argument to see more ...]\n\n${tail}`;
}

/* ------------------------------------------------------------------ execute */

export async function executeTool(
  registry: Record<string, Tool>,
  call: ToolUse,
  base: Omit<ToolContext, "signal" | "callId">,
  outerSignal?: AbortSignal,
): Promise<ToolResult> {
  const t0 = Date.now();
  const err = (content: string): ToolResult => ({ id: call.id, isError: true, content, ms: Date.now() - t0 });

  // 1. Unknown name → an observation naming the alternatives.
  const tool = registry[call.name];
  if (!tool) {
    const names = Object.keys(registry);
    const near = closest(call.name, names);
    return err(`No tool named "${call.name}". Available: ${names.join(", ")}.` +
      (near ? ` Did you mean "${near}"?` : ""));
  }

  // 2. Arguments validated against the same schema the model was shown.
  const parsed = tool.input.validate(call.input);
  if (!parsed.ok) {
    return err(`Invalid arguments for ${call.name}:\n` +
      parsed.issues.map((i) => `  ${i.path}: expected ${i.expected}, got ${i.got}`).join("\n"));
  }

  // 3. A timeout that actually cancels, composed with the run deadline.
  const ctrl = new AbortController();
  const timeoutMs = tool.timeoutMs ?? 30_000;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const signal = outerSignal ? AbortSignal.any([outerSignal, ctrl.signal]) : ctrl.signal;

  try {
    const out = await tool.run(parsed.value, { ...base, signal, callId: call.id });
    const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
    return { id: call.id, content: cap(text, tool.maxResultTokens ?? 4000, tool.name), ms: Date.now() - t0 };
  } catch (e) {
    if (ctrl.signal.aborted) {
      // Whether the effect may still land decides the model's next move.
      // A read-only tool is idempotent by definition; anything else must say so.
      const safe = tool.idempotent ?? tool.readOnly ?? false;
      return err(`${call.name} timed out after ${timeoutMs}ms. ` +
        (safe ? "It is read-only, so retrying is safe."
                         : "This operation is NOT idempotent — it may still have taken effect. " +
                           "Verify before retrying."));
    }
    if (outerSignal?.aborted) throw outerSignal.reason;
    return err(`${call.name} failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ parallel */

export async function runAll(
  calls: ToolUse[],
  registry: Record<string, Tool>,
  base: Omit<ToolContext, "signal" | "callId">,
  signal?: AbortSignal,
): Promise<ToolResult[]> {
  const byId = new Map<string, ToolResult>();
  const isRead = (c: ToolUse) => registry[c.name]?.readOnly === true;

  // Reads fan out. allSettled, not all: one failure must not bin four successes.
  const reads = calls.filter(isRead);
  const settled = await Promise.allSettled(reads.map((c) => executeTool(registry, c, base, signal)));
  settled.forEach((s, i) => byId.set(reads[i].id,
    s.status === "fulfilled" ? s.value
      : { id: reads[i].id, isError: true, content: String(s.reason), ms: 0 }));

  // Writes run in the order the model asked for, because order is semantics.
  for (const c of calls.filter((x) => !isRead(x))) byId.set(c.id, await executeTool(registry, c, base, signal));

  // Results MUST be returned in the original call order, or the API 400s.
  return calls.map((c) => byId.get(c.id)!);
}

export const toResultBlock = (r: ToolResult): Block =>
  ({ type: "tool_result", id: r.id, content: r.content, isError: r.isError });

/* ------------------------------------------------------------------ a demo registry */

interface Order { id: string; status: string; total: number; placedAt: string; category: string; tracking: string | null }

const ORDERS: Order[] = [
  { id: "4471", status: "delivered", total: 340, placedAt: "2024-01-28", category: "electronics", tracking: "1Z99A" },
  { id: "4472", status: "in transit", total: 89, placedAt: "2024-03-01", category: "books", tracking: "1Z99B" },
];

export const searchOrders = defineTool({
  name: "search_orders",
  description: `Find a customer's orders by order ID or email.
USE WHEN: the user asks about a specific purchase, delivery or refund status.
NOT FOR: policy questions (use search_policies) or orders over 18 months old (use search_archive).
RETURNS: up to 20 orders, newest first. An empty result means nothing matched — that is not an error.`,
  input: obj({ id: opt(str()), email: opt(str()) }),
  readOnly: true,
  timeoutMs: 5_000,
  async run({ id, email }, ctx) {
    await sleep(300, ctx.signal);
    const hits = ORDERS.filter((o) => (id ? o.id === id : true));
    if (!hits.length) return `No orders matched. The index covers the last 18 months; older orders are in search_archive.`;
    return hits.map((o) => `Order ${o.id}: ${o.status}, €${o.total}, placed ${o.placedAt}, category ${o.category}, tracking ${o.tracking ?? "none yet"}`).join("\n");
  },
});

export const searchPolicies = defineTool({
  name: "search_policies",
  description: `Full-text search over shipping, returns and warranty policy documents.
USE WHEN: the user asks what the rules are, rather than what happened to their order.
NOT FOR: anything about a specific order (use search_orders).
RETURNS: up to 5 passages with document title and section.`,
  input: obj({ q: str() }),
  readOnly: true,
  async run({ q }, ctx) {
    await sleep(280, ctx.signal);
    if (/electronic|refund|return/i.test(q)) return "Returns Policy § 3 (Electronics): standard window is 30 days; electronics 14 days unless a fault is reported.";
    return `No passages matched "${q}". The index covers returns, shipping and warranty. Try broader terms, or call list_sections().`;
  },
});

export const getTickets = defineTool({
  name: "get_support_tickets",
  description: `List support tickets for an order. RETURNS: id, date, summary, status. Empty list is normal.`,
  input: obj({ order: str() }),
  readOnly: true,
  async run({ order }, ctx) {
    await sleep(310, ctx.signal);
    return order === "4471" ? `#882 · 2024-02-05 · "screen flickers" · open` : "No tickets.";
  },
});

export const slowTool = defineTool({
  name: "generate_report",
  description: "Build a full account report. Slow (up to 60s).",
  input: obj({ account: str() }),
  readOnly: true,
  timeoutMs: 400,
  async run(_input, ctx) { await sleep(5_000, ctx.signal); return "never reached"; },
});

export const sendEmail = defineTool({
  name: "send_email",
  description: `Send an email to a customer. Irreversible — it cannot be unsent.`,
  input: obj({ to: str(), subject: str(), body: str() }),
  readOnly: false,
  idempotent: false,
  timeoutMs: 300,
  async run(_input, ctx) { await sleep(5_000, ctx.signal); return "sent"; },
});

export const bigTool = defineTool({
  name: "list_files",
  description: "List every file under a path. Can return a lot.",
  input: obj({ dir: str(), depth: opt(int({ max: 3 })) }),
  readOnly: true,
  maxResultTokens: 200,
  async run() { return Array.from({ length: 4000 }, (_, i) => `src/module_${i}/index.ts`).join("\n"); },
});

export const REGISTRY: Record<string, Tool> = Object.fromEntries(
  [searchOrders, searchPolicies, getTickets, slowTool, sendEmail, bigTool].map((t) => [t.name, t]),
);

/* ------------------------------------------------------------------ demo */

async function main(): Promise<void> {
  console.log("\n  C03 · Tools — every failure path is an observation\n");
  const ctx = { workingDir: process.cwd(), log: () => {} };
  const show = (label: string, r: ToolResult) =>
    console.log(`  ${r.isError ? "✗" : "✓"} ${label.padEnd(26)} ${String(r.ms).padStart(5)}ms  ${r.content.split("\n")[0].slice(0, 96)}`);

  // Parallel reads.
  const reads: ToolUse[] = [
    { id: "a", name: "search_orders", input: { id: "4471" } },
    { id: "b", name: "search_policies", input: { q: "electronics refund" } },
    { id: "c", name: "get_support_tickets", input: { order: "4471" } },
  ];
  const t0 = Date.now();
  const parallel = await runAll(reads, REGISTRY, ctx);
  const par = Date.now() - t0;
  parallel.forEach((r, i) => show(`parallel ${reads[i].name}`, r));
  console.log(`    → 3 reads in ${par}ms (sequential would be ~${parallel.reduce((t, r) => t + r.ms, 0)}ms)\n`);

  // The four failure paths.
  show("unknown tool name", await executeTool(REGISTRY, { id: "d", name: "search_ordrs", input: { id: "4471" } }, ctx));
  show("invalid arguments", await executeTool(REGISTRY, { id: "e", name: "search_orders", input: { id: 4471 } }, ctx));
  show("timeout (idempotent)", await executeTool(REGISTRY, { id: "f", name: "generate_report", input: { account: "a1" } }, ctx));
  show("timeout (NOT idempotent)", await executeTool(REGISTRY, { id: "g", name: "send_email", input: { to: "a@b.c", subject: "s", body: "b" } }, ctx));

  const big = await executeTool(REGISTRY, { id: "h", name: "list_files", input: { dir: "src" } }, ctx);
  console.log(`  ✓ ${"180KB result".padEnd(26)} ${String(big.ms).padStart(5)}ms  truncated to ${big.content.length} chars with a pagination hint`);

  console.log("\n  the two messages that matter most:\n");
  const unknown = await executeTool(REGISTRY, { id: "i", name: "search_ordrs", input: {} }, ctx);
  console.log("    " + unknown.content);
  const badArgs = await executeTool(REGISTRY, { id: "j", name: "send_email", input: { to: "a@b.c" } }, ctx);
  console.log("    " + badArgs.content.split("\n").join("\n    "));
  console.log("\n  Nothing above threw. The loop in C04 stays four lines because of that.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
