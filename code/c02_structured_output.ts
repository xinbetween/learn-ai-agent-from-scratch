/**
 * C02 · Structured Output
 *
 * A schema library whose error messages are designed to be read by a model,
 * plus the five-rung repair ladder.
 *
 *   node --experimental-strip-types code/c02_structured_output.ts
 */

import type { Message, Model, ToolSchema } from "./c01_model_call.ts";
import { textOf } from "./c01_model_call.ts";

/* ------------------------------------------------------------------ core */

export interface Issue { path: string; expected: string; got: string }
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export interface Schema<T> {
  validate(v: unknown, path?: string): Result<T>;
  readonly json: unknown;
  readonly optional?: boolean;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

const describe = (v: unknown): string =>
  v === null ? "null"
  : v === undefined ? "missing"
  : Array.isArray(v) ? `array(${v.length})`
  : typeof v === "string" ? `string ${JSON.stringify(v.length > 30 ? v.slice(0, 30) + "…" : v)}`
  : typeof v === "object" ? "object"
  : `${typeof v} ${JSON.stringify(v)}`;

const fail = (path: string, expected: string, v: unknown): Result<never> =>
  ({ ok: false, issues: [{ path: path || ".", expected, got: describe(v) }] });

/* ------------------------------------------------------------------ scalars */

export const str = (o: { minLength?: number; maxLength?: number; pattern?: string; description?: string } = {}): Schema<string> => ({
  json: { type: "string", ...o },
  validate(v, path = "") {
    if (typeof v !== "string") return fail(path, "string", v);
    if (o.minLength !== undefined && v.length < o.minLength) return fail(path, `string of at least ${o.minLength} chars`, v);
    if (o.maxLength !== undefined && v.length > o.maxLength) return fail(path, `string of at most ${o.maxLength} chars`, v);
    if (o.pattern && !new RegExp(o.pattern).test(v)) return fail(path, `string matching /${o.pattern}/`, v);
    return { ok: true, value: v };
  },
});

export const int = (o: { min?: number; max?: number; description?: string } = {}): Schema<number> => ({
  json: { type: "integer", ...o },
  validate(v, path = "") {
    // Coerce representation ("3" → 3), never meaning (null stays an error).
    if (typeof v === "string" && /^-?\d+$/.test(v.trim())) v = Number(v.trim());
    if (typeof v !== "number" || !Number.isInteger(v)) return fail(path, "integer", v);
    if (o.min !== undefined && v < o.min) return fail(path, `integer >= ${o.min}`, v);
    if (o.max !== undefined && v > o.max) return fail(path, `integer <= ${o.max}`, v);
    return { ok: true, value: v };
  },
});

export const num = (o: { min?: number; max?: number; description?: string } = {}): Schema<number> => ({
  json: { type: "number", ...o },
  validate(v, path = "") {
    if (typeof v === "string" && /^-?\d*\.?\d+$/.test(v.trim())) v = Number(v.trim());
    if (typeof v !== "number" || Number.isNaN(v)) return fail(path, "number", v);
    if (o.min !== undefined && v < o.min) return fail(path, `number >= ${o.min}`, v);
    if (o.max !== undefined && v > o.max) return fail(path, `number <= ${o.max}`, v);
    return { ok: true, value: v };
  },
});

export const bool = (o: { description?: string } = {}): Schema<boolean> => ({
  json: { type: "boolean", ...o },
  validate(v, path = "") {
    if (typeof v === "string") {
      const l = v.trim().toLowerCase();
      if (l === "true") v = true; else if (l === "false") v = false;
    }
    if (typeof v !== "boolean") return fail(path, "boolean", v);
    return { ok: true, value: v };
  },
});

export const enumOf = <const T extends readonly string[]>(values: T, o: { description?: string } = {}): Schema<T[number]> => ({
  json: { type: "string", enum: values, ...o },
  validate(v, path = "") {
    if (typeof v !== "string") return fail(path, `one of ${values.join(" | ")}`, v);
    // Case-folded matching: representation, not meaning.
    const hit = values.find((x) => x.toLowerCase() === v.trim().toLowerCase());
    if (!hit) return fail(path, `one of ${values.join(" | ")}`, v);
    return { ok: true, value: hit };
  },
});

/* ------------------------------------------------------------------ composites */

export const arr = <T>(item: Schema<T>, o: { minItems?: number; description?: string } = {}): Schema<T[]> => ({
  json: { type: "array", items: item.json, ...o },
  validate(v, path = "") {
    // A single object where an array was expected is a representation slip.
    if (!Array.isArray(v) && v !== null && typeof v === "object") v = [v];
    if (!Array.isArray(v)) return fail(path, "array", v);
    const out: T[] = [];
    const issues: Issue[] = [];
    v.forEach((x, i) => {
      const r = item.validate(x, `${path}[${i}]`);
      if (r.ok) out.push(r.value); else issues.push(...r.issues);
    });
    if (issues.length) return { ok: false, issues };
    if (o.minItems !== undefined && out.length < o.minItems) return fail(path, `array of at least ${o.minItems}`, v);
    return { ok: true, value: out };
  },
});

export const opt = <T>(inner: Schema<T>): Schema<T | undefined> => ({
  json: inner.json,
  optional: true,
  validate(v, path = "") {
    if (v === undefined) return { ok: true, value: undefined };
    return inner.validate(v, path) as Result<T | undefined>;
  },
});

type Shape = Record<string, Schema<any>>;
type InferShape<S extends Shape> = { [K in keyof S]: Infer<S[K]> };

export const obj = <S extends Shape>(shape: S, o: { description?: string } = {}): Schema<InferShape<S>> => ({
  json: {
    type: "object",
    properties: Object.fromEntries(Object.entries(shape).map(([k, s]) => [k, s.json])),
    required: Object.entries(shape).filter(([, s]) => !s.optional).map(([k]) => k),
    additionalProperties: false,
    ...o,
  },
  validate(v, path = "") {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return fail(path, "object", v);
    const out: any = {};
    const issues: Issue[] = [];
    for (const [k, s] of Object.entries(shape)) {
      // Collect ALL issues: one reprompt should fix every problem, not the first.
      const r = s.validate((v as any)[k], path ? `${path}.${k}` : `.${k}`);
      if (r.ok) { if (r.value !== undefined) out[k] = r.value; }
      else issues.push(...r.issues);
    }
    return issues.length ? { ok: false, issues } : { ok: true, value: out };
  },
});

/* ------------------------------------------------------------------ rung 1: extract */

export class ExtractError extends Error {
  readonly raw: string;
  constructor(raw: string) { super("no JSON found in output"); this.name = "ExtractError"; this.raw = raw; }
}

/** Brace-matching and string-aware. A greedy regex breaks on braces inside strings. */
export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const body = fence ? fence[1] : text;

  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = body.indexOf(open);
    if (start === -1) continue;
    let depth = 0, inStr = false, escaped = false;
    for (let i = start; i < body.length; i++) {
      const c = body[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      else if (c === close && --depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  // Last resort: repair trailing commas and single quotes, then retry.
  const repaired = body
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  try { return JSON.parse(repaired.slice(repaired.indexOf("{"), repaired.lastIndexOf("}") + 1)); } catch { /* fall through */ }
  throw new ExtractError(text);
}

/* ------------------------------------------------------------------ rung 3: reprompt */

export const renderIssues = (issues: Issue[]): string =>
  `Your previous output failed validation:\n` +
  issues.map((i) => `  ${i.path}: expected ${i.expected}, got ${i.got}`).join("\n") +
  `\n\nReturn the corrected object only. Keep every other field exactly as you had it.`;

export class StructuredError extends Error {
  readonly issues: Issue[];
  constructor(message: string, issues: Issue[]) { super(message); this.name = "StructuredError"; this.issues = issues; }
}

/** The full ladder: constrain, extract, coerce, reprompt, cold retry. */
export async function structured<T>(
  model: Model, messages: Message[], schema: Schema<T>,
  opts: { attempts?: number; system?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  let msgs = messages;
  let lastIssues: Issue[] = [];

  for (let i = 0; i < attempts; i++) {
    const tool: ToolSchema = { name: "emit", description: "Return the result.", input_schema: schema.json };
    const res = await model(msgs, {
      system: opts.system,
      tools: [tool],                                    // rung 0
      temperature: i === attempts - 1 ? 0 : 0.2,         // rung 4
    });

    const use = res.content.find((b) => b.type === "tool_use");
    let raw: unknown;
    try { raw = use ? (use as any).input : extractJson(textOf(res)); }   // rung 1
    catch { raw = undefined; }

    const r = schema.validate(raw);                      // rung 2 lives in the schemas
    if (r.ok) return r.value;
    lastIssues = r.issues;

    if (i === attempts - 2) msgs = messages;             // rung 4: drop poisoned history
    else msgs = [...msgs,
      { role: "assistant", content: [{ type: "text", text: JSON.stringify(raw ?? null) }] },
      { role: "user", content: [{ type: "text", text: renderIssues(r.issues) }] }];
  }
  throw new StructuredError(`no valid output after ${attempts} attempts`, lastIssues);
}

/* ------------------------------------------------------------------ demo */

const TriageSchema = obj({
  reasoning: str({ maxLength: 400, description: "think here before deciding" }),
  severity: enumOf(["low", "medium", "high", "critical"] as const),
  summary: str({ maxLength: 200 }),
  affected: arr(str()),
  needsHuman: bool(),
  eta: opt(int({ min: 0, description: "whole minutes until resolution; omit if unknown" })),
});
export type Triage = Infer<typeof TriageSchema>;

/** The seven failure modes, with realistic weights. */
const FAILURES: Array<[string, (good: string) => string]> = [
  ["markdown fence", (g) => "```json\n" + g + "\n```"],
  ["prose around JSON", (g) => `Sure! Here's the triage:\n\n${g}\n\nLet me know if you need anything else.`],
  ["trailing comma", (g) => g.replace(/}$/, ',\n}')],
  ["wrong scalar type", (g) => g.replace(/"eta": (\d+)/, '"eta": "$1"')],
  ["missing required field", (g) => g.replace(/\s*"needsHuman": (true|false),?\n/, "\n")],
  ["invented enum case", (g) => g.replace(/"severity": "(\w+)"/, '"severity": "HIGH"')],
  ["truncated mid-object", (g) => g.slice(0, Math.floor(g.length * 0.7))],
];

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main(): void {
  console.log("\n  C02 · Structured Output — 1,000 simulated model outputs\n");

  const good = JSON.stringify({
    reasoning: "Two hosts unreachable, customer-facing.",
    severity: "high", summary: "API gateway degraded", affected: ["api-1", "api-2"],
    needsHuman: true, eta: 45,
  }, null, 2);

  const rnd = mulberry32(7);
  const N = 1000;
  const outputs: Array<{ text: string; mode: string }> = [];
  for (let i = 0; i < N; i++) {
    if (rnd() > 0.06) { outputs.push({ text: good, mode: "clean" }); continue; }
    const [mode, f] = FAILURES[Math.floor(rnd() * FAILURES.length)];
    outputs.push({ text: f(good), mode });
  }

  const tiers: Array<[string, (t: string) => unknown]> = [
    ["parses (JSON.parse)", (t) => JSON.parse(t)],
    ["parses after extract", (t) => extractJson(t)],
    ["VALID Triage", (t) => { const r = TriageSchema.validate(extractJson(t)); if (!r.ok) throw new Error(); return r.value; }],
  ];

  for (const [name, parse] of tiers) {
    let ok = 0;
    for (const o of outputs) { try { parse(o.text); ok++; } catch { /* counted as failure */ } }
    console.log(`  ${name.padEnd(22)} ${String(ok).padStart(4)} / ${N}   ${((ok / N) * 100).toFixed(1)}%`);
  }
  console.log(`  ${"constrained decoding".padEnd(22)} ${N} / ${N}   100.0%   (+0 model calls)`);
  console.log(`\n  Note that "parses" is a weaker bar than "valid": extraction rescues the fence\n` +
              `  and the trailing comma, and the result still fails validation because a required\n` +
              `  field is missing. Parsing success is not the number that matters.\n`);

  // What survives each defence, by failure mode.
  console.log("  residual failures by mode (after extract + coerce)");
  const byMode = new Map<string, { n: number; failed: number }>();
  for (const o of outputs) {
    const e = byMode.get(o.mode) ?? { n: 0, failed: 0 };
    e.n++;
    try { const r = TriageSchema.validate(extractJson(o.text)); if (!r.ok) e.failed++; } catch { e.failed++; }
    byMode.set(o.mode, e);
  }
  for (const [mode, e] of [...byMode].sort((a, b) => b[1].failed - a[1].failed)) {
    if (mode === "clean") continue;
    const verdict = e.failed === 0 ? "recovered locally" : "needs a reprompt (rung 3)";
    console.log(`    ${mode.padEnd(24)} ${String(e.n).padStart(3)} seen  ${String(e.failed).padStart(3)} still failing   ${verdict}`);
  }
  console.log();

  // Compounding.
  console.log("  compounding over a multi-step task");
  for (const rate of [0.94, 0.977, 0.989, 0.999, 1.0]) {
    const label = (rate * 100).toFixed(1) + "% per step";
    console.log(`    ${label.padEnd(16)} 10 steps ${(Math.pow(rate, 10) * 100).toFixed(1).padStart(6)}%   ` +
                `20 steps ${(Math.pow(rate, 20) * 100).toFixed(1).padStart(6)}%`);
  }

  // Error messages designed for a model.
  console.log("\n  what a validation failure hands back to the model:\n");
  const bad = { severity: "PRETTY BAD", summary: 42, affected: "api-1", eta: "two" };
  const r = TriageSchema.validate(bad);
  if (!r.ok) console.log(renderIssues(r.issues).split("\n").map((l) => "    " + l).join("\n"));
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
