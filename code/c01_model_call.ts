/**
 * C01 · The Model Call
 *
 * The one function everything else imports. Two implementations behind one type:
 * a live client with retries, and a deterministic mock so every chapter runs offline.
 *
 *   node --experimental-strip-types code/c01_model_call.ts
 *   node --experimental-strip-types code/c01_model_call.ts --live
 */

/* ------------------------------------------------------------------ types */

export type Role = "system" | "user" | "assistant" | "tool";

export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; content: string; isError?: boolean };

export interface Message {
  role: Role;
  content: string | Block[];
}

export interface Usage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal";

export interface ModelResponse {
  content: Block[];
  stopReason: StopReason;
  usage: Usage;
  model: string;
  latencyMs: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface CallOptions {
  system?: string;
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}

export type Model = (messages: Message[], opts?: CallOptions) => Promise<ModelResponse>;

/* ------------------------------------------------------------------ errors */

export class ModelError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`model call failed: ${status} ${body.slice(0, 200)}`);
    this.name = "ModelError";
    this.status = status;
    this.body = body;
  }
}

export class TruncatedError extends Error {
  readonly usage: Usage;
  constructor(usage: Usage) {
    super(`response hit max_tokens after ${usage.output} output tokens`);
    this.name = "TruncatedError";
    this.usage = usage;
  }
}

/* ------------------------------------------------------------------ helpers */

export const textOf = (r: ModelResponse | Block[]): string =>
  (Array.isArray(r) ? r : r.content)
    .filter((b): b is Extract<Block, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

export const toolUses = (r: ModelResponse): Array<Extract<Block, { type: "tool_use" }>> =>
  r.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");

export const userText = (text: string): Message => ({ role: "user", content: [{ type: "text", text }] });

/** Rough, and honest about it. Use a real counter for decisions that matter. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 3.7);

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

/** Full jitter. Without the random factor a fleet retries in lockstep. */
const backoff = (attempt: number, baseMs = 500, capMs = 20_000): number =>
  Math.random() * Math.min(capMs, baseMs * 2 ** (attempt - 1));

/* ------------------------------------------------------------------ ledger */

export interface LedgerEntry { label: string; usage: Usage; ms: number; model: string }

export class Ledger {
  readonly entries: LedgerEntry[] = [];
  private readonly children = new Map<string, Ledger>();

  readonly label: string;
  constructor(label = "run") { this.label = label; }

  record(e: LedgerEntry): void { this.entries.push(e); }

  child(label: string): Ledger {
    const c = this.children.get(label) ?? new Ledger(label);
    this.children.set(label, c);
    return c;
  }

  total(): Usage & { calls: number; ms: number } {
    const own = this.entries.reduce(
      (t, e) => ({
        input: t.input + e.usage.input,
        output: t.output + e.usage.output,
        cacheRead: (t.cacheRead ?? 0) + (e.usage.cacheRead ?? 0),
        cacheWrite: (t.cacheWrite ?? 0) + (e.usage.cacheWrite ?? 0),
        calls: t.calls + 1,
        ms: t.ms + e.ms,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, ms: 0 },
    );
    for (const c of this.children.values()) {
      const t = c.total();
      own.input += t.input; own.output += t.output;
      own.cacheRead! += t.cacheRead ?? 0; own.cacheWrite! += t.cacheWrite ?? 0;
      own.calls += t.calls; own.ms += t.ms;
    }
    return own;
  }

  /** $3 / $15 per Mtok, cached reads at 10%. Adjust for your provider. */
  costUsd(inPrice = 3, outPrice = 15): number {
    const t = this.total();
    const uncached = t.input - (t.cacheRead ?? 0);
    return (uncached * inPrice + (t.cacheRead ?? 0) * inPrice * 0.1 + t.output * outPrice) / 1e6;
  }

  report(indent = ""): string {
    const t = this.total();
    const width = Math.max(8, 26 - indent.length);
    const lines = [
      `${indent}${this.label.padEnd(width)} ${String(t.calls).padStart(3)} calls  ` +
      `${t.input.toLocaleString().padStart(9)} in  ${t.output.toLocaleString().padStart(7)} out  ` +
      `$${this.costUsd().toFixed(4)}`,
    ];
    for (const c of this.children.values()) lines.push(c.report(indent + "  ├ "));
    return lines.join("\n");
  }
}

/* ------------------------------------------------------------------ live */

export interface LiveConfig {
  provider?: "anthropic" | "openai";
  model?: string;
  apiKey?: string;
  endpoint?: string;
  maxAttempts?: number;
  ledger?: Ledger;
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

export function liveModel(cfg: LiveConfig = {}): Model {
  const provider = cfg.provider ?? "anthropic";
  const model = cfg.model ?? (provider === "anthropic" ? "claude-sonnet-5" : "gpt-4.1");
  const apiKey = cfg.apiKey ??
    process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"];
  const endpoint = cfg.endpoint ??
    (provider === "anthropic"
      ? "https://api.anthropic.com/v1/messages"
      : "https://api.openai.com/v1/chat/completions");
  const maxAttempts = cfg.maxAttempts ?? 5;

  if (!apiKey) throw new Error(`no API key: set ${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}`);

  return async function call(messages, opts = {}) {
    let attempt = 0;
    for (;;) {
      attempt++;
      const started = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: provider === "anthropic"
            ? { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
            : { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(toWire(provider, model, messages, opts)),
          signal: opts.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          if (!RETRYABLE.has(res.status) || attempt >= maxAttempts) throw new ModelError(res.status, body);
          const retryAfter = Number(res.headers.get("retry-after")) * 1000;
          await sleep(retryAfter || backoff(attempt), opts.signal);
          continue;
        }

        const out = fromWire(provider, await res.json(), Date.now() - started);
        cfg.ledger?.record({ label: model, usage: out.usage, ms: out.latencyMs, model });
        return out;
      } catch (err) {
        // Never retry a cancellation — the caller is arguing with its own deadline.
        if ((err as Error).name === "AbortError") throw err;
        if (err instanceof ModelError) throw err;
        if (attempt >= maxAttempts) throw err;
        await sleep(backoff(attempt), opts.signal);
      }
    }
  };
}

function toWire(provider: string, model: string, messages: Message[], opts: CallOptions): unknown {
  if (provider === "anthropic") {
    return {
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      tools: opts.tools,
      messages: messages.filter((m) => m.role !== "system"),
    };
  }
  return {
    model,
    max_completion_tokens: opts.maxTokens ?? 4096,   // max_tokens is deprecated on chat completions
    temperature: opts.temperature ?? 0,
    messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), ...messages],
    tools: opts.tools?.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
  };
}

function fromWire(provider: string, raw: any, latencyMs: number): ModelResponse {
  if (provider === "anthropic") {
    return {
      content: raw.content.map((b: any) =>
        b.type === "tool_use" ? { type: "tool_use", id: b.id, name: b.name, input: b.input } : { type: "text", text: b.text }),
      stopReason: ({ end_turn: "end_turn", tool_use: "tool_use", max_tokens: "max_tokens", stop_sequence: "stop_sequence" } as const)[raw.stop_reason as string] ?? "end_turn",
      usage: {
        input: raw.usage.input_tokens,
        output: raw.usage.output_tokens,
        cacheRead: raw.usage.cache_read_input_tokens,
        cacheWrite: raw.usage.cache_creation_input_tokens,
      },
      model: raw.model,
      latencyMs,
    };
  }
  const choice = raw.choices[0];
  const content: Block[] = [];
  if (choice.message.content) content.push({ type: "text", text: choice.message.content });
  for (const tc of choice.message.tool_calls ?? []) {
    content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) });
  }
  return {
    content,
    stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "end_turn",
    usage: { input: raw.usage.prompt_tokens, output: raw.usage.completion_tokens },
    model: raw.model,
    latencyMs,
  };
}

/* ------------------------------------------------------------------ mock */

export type MockScript =
  | ModelResponse[]
  | ((messages: Message[], opts: CallOptions) => Partial<ModelResponse> | string);

/**
 * Deterministic, offline, free — and the same type as the live client, so no
 * call site knows the difference. This is what makes chapter tests possible.
 */
export function mockModel(script: MockScript, ledger?: Ledger): Model {
  let i = 0;
  return async function call(messages, opts = {}) {
    if (opts.signal?.aborted) throw opts.signal.reason;

    const inputTokens = estimateTokens(JSON.stringify(messages) + (opts.system ?? "") + JSON.stringify(opts.tools ?? []));

    let partial: Partial<ModelResponse>;
    if (Array.isArray(script)) {
      if (i >= script.length) throw new Error(`mock script exhausted after ${script.length} calls`);
      partial = script[i++];
    } else {
      const out = script(messages, opts);
      partial = typeof out === "string" ? { content: [{ type: "text", text: out }] } : out;
    }

    const content = partial.content ?? [{ type: "text", text: "" }];
    const res: ModelResponse = {
      content,
      stopReason: partial.stopReason ?? (content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn"),
      usage: partial.usage ?? { input: inputTokens, output: estimateTokens(JSON.stringify(content)) },
      model: partial.model ?? "mock",
      latencyMs: partial.latencyMs ?? 1,
    };
    if (opts.onDelta) for (const b of content) if (b.type === "text") opts.onDelta(b.text);
    ledger?.record({ label: "mock", usage: res.usage, ms: res.latencyMs, model: "mock" });
    return res;
  };
}

/** Assert on truncation rather than silently acting on half a plan. */
export function strict(model: Model): Model {
  return async (messages, opts) => {
    const r = await model(messages, opts);
    if (r.stopReason === "max_tokens") throw new TruncatedError(r.usage);
    return r;
  };
}

/** One deadline for a whole multi-call run, not per call. */
export function withDeadline(model: Model, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("deadline", "AbortError")), ms);
  const wrapped: Model = (messages, opts = {}) =>
    model(messages, {
      ...opts,
      signal: opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal,
    });
  return { model: wrapped, cancel: () => ctrl.abort(), done: () => clearTimeout(timer) };
}

/* ------------------------------------------------------------------ demo */

async function main(): Promise<void> {
  const live = process.argv.includes("--live");
  const ledger = new Ledger("12-turn agent");

  console.log(`\n  C01 · The Model Call — ${live ? "LIVE" : "mock"}\n`);

  const SYSTEM = "You are a support agent.".padEnd(4800, " ");     // ~1,300 tokens
  const TOOLS: ToolSchema[] = Array.from({ length: 5 }, (_, n) => ({
    name: `tool_${n}`,
    description: "A tool with a description of a realistic length. ".repeat(12),
    input_schema: { type: "object", properties: { q: { type: "string" } } },
  }));

  const model = live
    ? liveModel({ ledger })
    : mockModel((messages) =>
        messages.length >= 23
          ? { content: [{ type: "text", text: "Done." }], stopReason: "end_turn" }
          : { content: [{ type: "tool_use", id: `t${messages.length}`, name: "tool_0", input: { q: "x" } }], stopReason: "tool_use" },
      ledger);

  const messages: Message[] = [userText("Why is order 4471 delayed?")];
  const OBSERVATION = "Result line. ".repeat(160);                  // ~600 tokens

  const perTurn: Array<{ inTok: number; outTok: number }> = [];
  for (let turn = 0; turn < 12; turn++) {
    const res = await model(messages, { system: SYSTEM, tools: TOOLS, temperature: 0 });
    perTurn.push({ inTok: res.usage.input, outTok: res.usage.output });
    messages.push({ role: "assistant", content: res.content });
    if (res.stopReason === "end_turn") break;
    const use = toolUses(res)[0];
    messages.push({ role: "user", content: [{ type: "tool_result", id: use.id, content: OBSERVATION }] });
  }

  const t = ledger.total();
  const stops = perTurn.length;
  console.log(`  turns                  ${stops}`);
  console.log(`  input  billed          ${t.input.toLocaleString()} tok`);
  console.log(`  output                 ${t.output.toLocaleString()} tok`);
  console.log(`  ratio                  ${Math.round(t.input / Math.max(t.output, 1))} : 1`);
  console.log(`  est. cost              $${ledger.costUsd().toFixed(4)}`);
  console.log(`\n  input tokens per turn  ${perTurn.map((p) => Math.round(p.inTok / 1000) + "K").join(" ")}`);
  console.log(`\n  Note the growth: turn 1's observation is billed again on every later turn.`);
  console.log(`  That is why C05 exists.\n`);
  console.log(ledger.report("  "));
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
