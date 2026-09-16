import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

export const LADDER_SVG = `
<svg viewBox="0 0 700 290" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The repair ladder: five levels from prevention to failure">
  <defs><marker id="p2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>
  <text x="14" y="18" class="d-label">CHEAPEST FIX FIRST — EACH RUNG COSTS A ROUND TRIP THE ONE ABOVE DOES NOT</text>

  <rect x="14" y="30" width="672" height="40" rx="6" class="d-box-t"/>
  <text x="28" y="48" class="d-text">0 · constrain</text>
  <text x="28" y="63" class="d-mono" fill="var(--fg-faint)">tool schema / json_schema mode — the decoder cannot emit invalid JSON. free, ~100% effective on shape</text>

  <rect x="14" y="76" width="672" height="40" rx="6" class="d-box"/>
  <text x="28" y="94" class="d-text">1 · extract</text>
  <text x="28" y="109" class="d-mono" fill="var(--fg-faint)">strip \`\`\`json fences, leading prose, trailing "Let me know!" — pure string work, zero tokens</text>

  <rect x="14" y="122" width="672" height="40" rx="6" class="d-box"/>
  <text x="28" y="140" class="d-text">2 · coerce</text>
  <text x="28" y="155" class="d-mono" fill="var(--fg-faint)">"3" → 3, "true" → true, {x} → [{x}], trailing commas, single quotes. local, zero tokens</text>

  <rect x="14" y="168" width="672" height="40" rx="6" class="d-box-a"/>
  <text x="28" y="186" class="d-text">3 · reprompt with the validator error</text>
  <text x="28" y="201" class="d-mono" fill="var(--fg-faint)">"field .items[2].qty: expected integer, got \\"two\\"" — one round trip, ~90% recovery</text>

  <rect x="14" y="214" width="672" height="40" rx="6" class="d-box-m"/>
  <text x="28" y="232" class="d-text">4 · retry cold at temperature 0</text>
  <text x="28" y="247" class="d-mono" fill="var(--fg-faint)">fresh context, no poisoned history. last resort — a stuck model repeats its mistake</text>

  <path d="M694 40 L694 250" stroke="var(--accent)" fill="none" marker-end="url(#p2)" stroke-width="1.5" transform="translate(-4,0)"/>
  <text x="678" y="272" class="d-mono" text-anchor="end" fill="var(--accent)">only descend when the rung above fails</text>
</svg>`;

const chapter: Chapter = {
  id: "c02",
  num: 2,
  layer: "model",
  title: "Structured Output",
  subtitle: "Turning prose into a value your code can branch on",
  blurb:
    "An agent branches on model output, so that output has to be a typed value, not a paragraph. Schemas, a validator you write yourself, and the five-rung repair ladder that takes parse success from 94% to 99.9%.",
  lines: 332,
  file: "code/c02_structured_output.ts",
  tags: ["JSON schema", "constrained decoding", "validation", "repair", "type guards", "enums"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "94% is a catastrophe",
      html:
        p(`Ask a model for JSON and it returns JSON roughly 94% of the time. The other 6% it returns JSON wrapped in a markdown fence, or JSON preceded by "Sure! Here's the data:", or JSON with a trailing comma, or the right shape with <code>"quantity": "two"</code>, or — the special one — a perfect object followed by a cheerful paragraph explaining it.`) +
        p(`In a chat app, 94% is fine; a human reads around the mess. In an agent, that number compounds. A ten-step task where each step parses at 94% completes at <strong>0.94<sup>10</sup> = 54%</strong>. Half your runs die of a punctuation error, and they die <em>late</em>, after eight successful expensive steps.`) +
        p(`A better prompt is not the fix. "Respond with ONLY valid JSON and no other text" moves the number to maybe 97%, which is 74% over ten steps. What works is structural: make invalid output impossible where you can, and build a deterministic ladder of repairs where you cannot.`) +
        note("key", "The number that matters", p(`Per-step parse reliability is raised to the power of your step count. Anything below 99.9% is a step-count ceiling in disguise. Design for 99.9%, measure it, and treat a regression as a sev.`)),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Constrain first, validate always, repair last",
      html:
        p(`Three layers, in this order of preference.`) +
        `<h3>1 · Constrain the decoder, not the model</h3>` +
        p(`Providers can force the output to match a grammar derived from your schema, masking every token that would make the text invalid. If the schema says the next token must be <code>"</code> or <code>}</code>, no other token can be sampled. This is not persuasion, it is arithmetic — malformed JSON becomes <em>unrepresentable</em>.`) +
        p(`Two ways to get it, and they are the same mechanism:`) +
        ul([
          `<strong>A tool schema.</strong> Define a tool whose input schema is the shape you want and force the model to call it. You get constrained decoding and you reuse the machinery of ${ch("c03", "C03")}. This is the most portable option and what this course uses.`,
          `<strong>Native structured-output mode</strong> (<code>response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }</code> on OpenAI, or the equivalent elsewhere). Cleaner when you want data rather than an action.`,
        ]) +
        note("warn", "Constrained decoding guarantees shape, never sense", p(`The grammar forces <code>{"severity": "high"}</code> to be well-formed and its enum to be legal. It does not stop the model choosing <code>high</code> for a trivial incident. Schema validity and semantic validity are different problems; ${ch("c10", "C10")} is about the second.`)) +
        `<h3>2 · Validate anyway, at the boundary</h3>` +
        p(`Constrained decoding is a provider feature, and provider features have bad days. You fall back to a model that lacks it, or a proxy drops the parameter, or a schema turns out too deep for the grammar compiler. Parse and validate at the boundary regardless, and make the validator the thing that produces your TypeScript type.`) +
        code({
          title: "the schema is the type, not a copy of it",
          src: `// One declaration. The TS type is derived, so they cannot drift apart.
const TriageSchema = obj({
  severity: enumOf(["low", "medium", "high", "critical"] as const),
  summary: str({ maxLength: 200 }),
  affected: arr(str()),
  needsHuman: bool(),
  eta: opt(int({ min: 0 })),
});

type Triage = Infer<typeof TriageSchema>;
// { severity: "low"|"medium"|"high"|"critical"; summary: string;
//   affected: string[]; needsHuman: boolean; eta?: number }

const r = TriageSchema.validate(parsed);
if (!r.ok) return repair(r.errors);   // errors carry paths, not just "invalid"
const triage: Triage = r.value;        // typed from here down`,
        }) +
        p(`Writing the validator is ${ch("c02", "this chapter's")} project. Sixty lines gets you paths, coercion hooks, and error messages good enough to hand back to the model. That last part is the entire point, and it is the thing generic validators do worst.`) +
        `<h3>3 · Repair in a fixed order</h3>` +
        p(`When validation fails, do not immediately spend a round trip. Most failures are free to fix locally.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "The repair ladder",
      html:
        fig({
          label: "Diagram",
          title: "five rungs, cheapest first",
          body: LADDER_SVG,
          caption: `Rungs 0–2 cost no tokens and no latency. Rung 3 is where the design work is: the quality of your error message determines whether the retry succeeds. Rung 4 exists because a model that has already produced a bad object in-context tends to reproduce it.`,
        }) +
        `<h3>Rung 3 is the one that repays effort</h3>` +
        p(`Compare two reprompts after the same failure.`) +
        code({
          title: "useless vs useful",
          src: `// ✗ The model does not know what was wrong, so it shuffles and hopes.
"That was not valid. Please return valid JSON."

// ✓ A specific, located, actionable diff. Recovery rate goes from ~40% to ~90%.
\`Your previous output failed validation:
  .items[2].quantity: expected integer, got string "two"
  .dueDate: expected ISO 8601 date, got "next tuesday"
  .owner: required field missing

Return the corrected object only. Keep every other field exactly as you had it.\``,
        }) +
        p(`Three properties make the second one work. It <strong>locates</strong> the error by path, it <strong>states both</strong> expected and actual, and it <strong>forbids collateral change</strong>. Drop that last clause and the model rewrites fields that were already correct, handing you a different failure.`) +
        `<h3>Coercions worth having, and one to refuse</h3>` +
        table(
          ["Model emits", "Schema wants", "Coerce?"],
          [
            [`<code>"3"</code>`, "integer", "Yes — unambiguous"],
            [`<code>"true"</code>`, "boolean", "Yes"],
            [`<code>{…}</code>`, "array", "Yes — wrap in a single-element array"],
            [`<code>"HIGH"</code>`, `enum <code>"high"</code>`, "Yes — case-fold enum matching"],
            [`<code>"2024-13-45"</code>`, "date", "<b>No</b> — surface it; a silent Invalid Date is worse than a retry"],
            [`<code>null</code>`, "required string", "<b>No</b> — the model is telling you it does not know"],
          ]
        ) +
        p(`The rule: coerce representation, never coerce meaning. <code>"3"</code> and <code>3</code> are the same fact in two notations. <code>null</code> and <code>""</code> are different facts, and turning the first into the second hides the exact signal you most need, which is that the model lacked the information. That signal should reach ${ch("c10", "C10")}, not the floor.`) +
        `<h3>Schema design changes the failure rate before any repair runs</h3>` +
        ul([
          `<strong>Flat beats nested.</strong> Each level of nesting measurably raises malformation rates. Three levels is a smell.`,
          `<strong>Enums beat free strings.</strong> <code>"severity": string</code> gets you <code>"pretty bad"</code>. An enum makes that token unsamplable under constrained decoding and a one-line error otherwise.`,
          `<strong>Describe every field.</strong> Descriptions are part of the prompt, and they are the cheapest accuracy you will ever buy. <code>"eta: whole minutes until resolution, omit if unknown"</code> prevents <code>"about an hour"</code>.`,
          `<strong>Optional over nullable.</strong> Absence has one representation; nullability has two (<code>null</code>, missing) and models pick either.`,
          `<strong>Put reasoning in a field, not before the JSON.</strong> A leading <code>"reasoning": string</code> field gives the model its thinking room <em>inside</em> the object, which both improves the decision and removes the "prose before JSON" failure entirely.`,
        ]),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Compound the failure rate yourself",
      html:
        p(`Pick the failure modes your model exhibits, choose which rungs of the ladder you have implemented, and watch the end-to-end completion rate for a multi-step task.`) +
        lab({
          label: "Simulator",
          title: "parse reliability under compounding",
          body: `
<div class="controls">
  <div class="ctl"><label>steps in the task</label>
    <input type="range" id="s2-steps" min="1" max="25" step="1" value="10"><span class="val" id="s2-steps-v">10</span></div>
  <div class="ctl"><label>base malformation rate</label>
    <input type="range" id="s2-rate" min="0" max="20" step="1" value="6"><span class="val" id="s2-rate-v">6%</span></div>
  <div class="ctl"><label>defences</label>
    <div style="display:flex;flex-direction:column;gap:.15rem;font-size:.8125rem">
      <label><input type="checkbox" id="s2-c0"> 0 · constrained decoding</label>
      <label><input type="checkbox" id="s2-c1" checked> 1 · extract from fences/prose</label>
      <label><input type="checkbox" id="s2-c2" checked> 2 · local coercion</label>
      <label><input type="checkbox" id="s2-c3"> 3 · reprompt with validator error</label>
      <label><input type="checkbox" id="s2-c4"> 4 · cold retry at temp 0</label>
    </div></div>
</div>
<div style="margin-top:.5rem">
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">per-step parse success</div>
  <div class="meter"><i id="s2-step-m" style="width:0%"></i></div>
  <div class="mono small muted" id="s2-step-v">—</div>
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin:.8rem 0 .3rem">whole task completes</div>
  <div class="meter"><i id="s2-task-m" style="width:0%;background:var(--tool)"></i></div>
  <div class="mono small muted" id="s2-task-v">—</div>
</div>
<div style="margin-top:1rem">
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">where the surviving failures come from</div>
  <div id="s2-break" class="small"></div>
</div>
<div class="stats">
  <div class="stat"><b id="s2-extra">0</b><span>extra model calls / 100 steps</span></div>
  <div class="stat"><b id="s2-lat">0 ms</b><span>added p50 latency</span></div>
</div>`,
          script: `
var MODES = [
  { k: "markdown fence", w: 30, fix: { c1: 1 } },
  { k: "prose before/after JSON", w: 24, fix: { c1: .95 } },
  { k: "trailing comma / single quotes", w: 12, fix: { c2: 1 } },
  { k: "wrong scalar type (\\"3\\")", w: 14, fix: { c2: .9, c3: .95 } },
  { k: "missing required field", w: 11, fix: { c3: .9, c4: .5 } },
  { k: "invented enum value", w: 6, fix: { c2: .6, c3: .9 } },
  { k: "truncated mid-object", w: 3, fix: { c4: .7 } }
];
var ids = ["s2-c0","s2-c1","s2-c2","s2-c3","s2-c4"];
function upd() {
  var steps = +document.getElementById("s2-steps").value;
  var rate = +document.getElementById("s2-rate").value / 100;
  var on = {}; ids.forEach(function (id, i) { on["c" + i] = document.getElementById(id).checked; });
  document.getElementById("s2-steps-v").textContent = steps;
  document.getElementById("s2-rate-v").textContent = (rate * 100).toFixed(0) + "%";

  // constrained decoding removes shape errors outright
  var eff = on.c0 ? rate * 0.06 : rate;
  var totW = MODES.reduce(function (a, m) { return a + m.w; }, 0);
  var surviving = 0, extraCalls = 0, rows = [];
  MODES.forEach(function (m) {
    var share = (m.w / totW) * eff;
    var left = share;
    if (on.c1 && m.fix.c1) left *= (1 - m.fix.c1);
    if (on.c2 && m.fix.c2) left *= (1 - m.fix.c2);
    if (on.c3 && m.fix.c3) { extraCalls += left; left *= (1 - m.fix.c3); }
    if (on.c4 && m.fix.c4) { extraCalls += left; left *= (1 - m.fix.c4); }
    surviving += left;
    rows.push([m.k, left]);
  });
  var stepOk = 1 - surviving;
  var taskOk = Math.pow(stepOk, steps);
  document.getElementById("s2-step-m").style.width = (stepOk * 100) + "%";
  document.getElementById("s2-step-v").textContent = (stepOk * 100).toFixed(3) + "%  (1 failure per " + Math.round(1 / Math.max(surviving, 1e-9)).toLocaleString() + " steps)";
  document.getElementById("s2-task-m").style.width = (taskOk * 100) + "%";
  document.getElementById("s2-task-v").textContent = (taskOk * 100).toFixed(1) + "% of " + steps + "-step runs reach the end without a parse failure";

  rows.sort(function (a, b) { return b[1] - a[1]; });
  document.getElementById("s2-break").innerHTML = rows.filter(function (r) { return r[1] > 1e-6; }).map(function (r) {
    return '<div style="display:flex;gap:.5rem;align-items:center;margin:.15rem 0"><span class="mono" style="width:14rem;color:var(--fg-muted)">' + r[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + Math.min(100, (r[1] / Math.max(surviving, 1e-9)) * 100) + '%;background:var(--danger)"></i></span>' +
      '<span class="mono small muted">' + (r[1] * 100).toFixed(3) + '%</span></div>';
  }).join("") || '<span class="small" style="color:var(--ok)">no measurable residual failures at this configuration</span>';

  document.getElementById("s2-extra").textContent = (extraCalls * 100).toFixed(1);
  document.getElementById("s2-lat").textContent = Math.round(extraCalls * 900) + " ms";
}
["s2-steps","s2-rate"].concat(ids).forEach(function (id) {
  document.getElementById(id).addEventListener("input", upd);
  document.getElementById(id).addEventListener("change", upd);
});
upd();`,
          caption: `Start at the default — 10 steps, 6% base, only extraction and coercion on — and read the task-completion bar. Then tick constrained decoding alone and watch it jump. Then untick it and tick reprompt instead: similar end result, but look at the "extra model calls" stat. That is the whole argument for constraining rather than repairing.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "A validator worth 60 lines",
      html:
        p(`The runnable file implements a small schema library whose error messages are designed to be read by a model. The design constraint is unusual and worth stating: <em>the error is a prompt</em>.`) +
        code({
          title: "code/c02_structured_output.ts — errors carry paths",
          src: `export interface Issue { path: string; expected: string; got: string; }
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export interface Schema<T> {
  validate(v: unknown, path?: string): Result<T>;
  readonly json: unknown;                 // what we send to the provider
}

export const int = (o: { min?: number; max?: number } = {}): Schema<number> => ({
  json: { type: "integer", ...o },
  validate(v, path = "") {
    // Coerce representation ("3" → 3) but never meaning (null stays an error).
    if (typeof v === "string" && /^-?\\d+$/.test(v.trim())) v = Number(v.trim());
    if (typeof v !== "number" || !Number.isInteger(v))
      return { ok: false, issues: [{ path, expected: "integer", got: describe(v) }] };
    if (o.min !== undefined && v < o.min)
      return { ok: false, issues: [{ path, expected: \`integer >= \${o.min}\`, got: String(v) }] };
    return { ok: true, value: v };
  },
});

export const obj = <S extends Record<string, Schema<any>>>(shape: S): Schema<InferObj<S>> => ({
  json: {
    type: "object",
    properties: Object.fromEntries(Object.entries(shape).map(([k, s]) => [k, s.json])),
    required: Object.entries(shape).filter(([, s]) => !(s as any).optional).map(([k]) => k),
    additionalProperties: false,
  },
  validate(v, path = "") {
    if (v === null || typeof v !== "object" || Array.isArray(v))
      return { ok: false, issues: [{ path, expected: "object", got: describe(v) }] };
    const out: any = {};
    const issues: Issue[] = [];
    for (const [k, s] of Object.entries(shape)) {
      const r = s.validate((v as any)[k], path ? \`\${path}.\${k}\` : \`.\${k}\`);
      // Collect ALL issues — one round trip should fix every problem, not the first.
      if (r.ok) out[k] = r.value; else issues.push(...r.issues);
    }
    return issues.length ? { ok: false, issues } : { ok: true, value: out };
  },
});`,
        }) +
        p(`Note the comment on <code>obj</code>: collecting every issue rather than short-circuiting is what makes rung 3 converge in one retry instead of four. It is a two-line difference in the validator and a 3× difference in repair cost.`) +
        code({
          title: "the ladder, as a function",
          src: `export async function structured<T>(
  model: Model, messages: Message[], schema: Schema<T>, opts: { attempts?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  let msgs = messages;

  for (let i = 0; i < attempts; i++) {
    const res = await model(msgs, {
      tools: [{ name: "emit", description: "Return the result.", input_schema: schema.json }],
      toolChoice: { type: "tool", name: "emit" },        // rung 0
      temperature: i === attempts - 1 ? 0 : 0.2,          // rung 4 on the last go
    });

    const raw = firstToolInput(res) ?? extractJson(textOf(res));  // rung 1
    const r = schema.validate(raw);                               // rung 2 lives in the schemas
    if (r.ok) return r.value;

    if (i === attempts - 2) msgs = messages;   // rung 4: drop the poisoned history
    else msgs = [...msgs,                      // rung 3: reprompt with located errors
      { role: "assistant", content: JSON.stringify(raw) },
      { role: "user", content: renderIssues(r.issues) }];
  }
  throw new StructuredError(\`no valid output after \${attempts} attempts\`);
}

const renderIssues = (issues: Issue[]) =>
  \`Your output failed validation:\\n\` +
  issues.map((i) => \`  \${i.path}: expected \${i.expected}, got \${i.got}\`).join("\\n") +
  \`\\n\\nReturn the corrected object only. Keep every other field exactly as it was.\`;`,
        }) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c02_structured_output.ts

#   C02 · Structured Output — 1,000 simulated model outputs
#
#   parses (JSON.parse)     972 / 1000   97.2%
#   parses after extract    993 / 1000   99.3%
#   VALID Triage            986 / 1000   98.6%
#   constrained decoding   1000 / 1000   100.0%   (+0 model calls)
#
#   Note that "parses" is a weaker bar than "valid": extraction rescues the fence
#   and the trailing comma, and the result still fails validation because a required
#   field is missing. Parsing success is not the number that matters.
#
#   residual failures by mode (after extract + coerce)
#     missing required field     7 seen    7 still failing   needs a reprompt (rung 3)
#     truncated mid-object       7 seen    7 still failing   needs a reprompt (rung 3)
#     markdown fence            10 seen    0 still failing   recovered locally
#     prose around JSON         11 seen    0 still failing   recovered locally
#     wrong scalar type          7 seen    0 still failing   recovered locally
#     invented enum case         5 seen    0 still failing   recovered locally
#
#   compounding over a multi-step task
#     94.0% per step   10 steps   53.9%   20 steps   29.0%
#     97.7% per step   10 steps   79.2%   20 steps   62.8%
#     98.9% per step   10 steps   89.5%   20 steps   80.2%
#     99.9% per step   10 steps   99.0%   20 steps   98.0%
#     100.0% per step  10 steps  100.0%   20 steps  100.0%
#
#   what a validation failure hands back to the model:
#
#     Your previous output failed validation:
#       .reasoning: expected string, got missing
#       .severity: expected one of low | medium | high | critical, got string "PRETTY BAD"
#       .summary: expected string, got number 42
# …
#     Return the corrected object only. Keep every other field exactly as you had it.`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "What this looks like in real systems",
      html:
        ul([
          `<strong>Zod / Pydantic + a JSON-schema exporter</strong> is what most teams ship, and it is the right call. Just check what your library emits. Deeply nested <code>anyOf</code>, recursive <code>$ref</code>, and regex <code>pattern</code> constraints are commonly unsupported by strict structured-output modes, and the provider will either reject the schema or silently drop the constraint.`,
          `<strong>The Codex and Claude Code file-edit tools</strong> are the extreme case of this chapter's argument: rather than asking for structured JSON containing code, they define a custom line-oriented envelope (${ch("c14", "C14")} walks through <code>apply_patch</code>) precisely because JSON string-escaping a multi-line file is a reliability disaster. When your payload is code, a line format beats a JSON string.`,
          `<strong>Instructor, Outlines, llama.cpp grammars, XGrammar</strong> all implement rung 0 in different places: library, server, or kernel. Reading one of them is the fastest way to see that "constrained decoding" is a finite-state machine masking logits, which is much less magical and much more reassuring than it sounds.`,
          `<strong>Log the raw text on every validation failure.</strong> The single most useful artefact when a schema starts failing in production is the exact string the model produced. Teams that log only "validation failed" spend days on what a sample of twenty raw outputs answers in minutes.`,
        ]) +
        note("good", "A pattern that pays for itself", p(`Add a leading <code>reasoning: string</code> field to any schema backing a judgement call. It gives the model somewhere to think inside the object, it improves the decision measurably, it eliminates the prose-before-JSON failure mode, and it hands you a human-readable explanation in your logs for free. Strip it before using the value.`)),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `Your agent parses at 97% per step. What is its ceiling on a 20-step task? What per-step rate do you need for 95% of 20-step tasks to complete?`,
      answer:
        p(`0.97<sup>20</sup> = <strong>54%</strong>. Nearly half of all long runs die of formatting.`) +
        p(`For 95% at 20 steps you need <code>0.95<sup>1/20</sup></code> = <strong>99.74%</strong> per step — about one failure in 390. That is out of reach for prompting and comfortably inside reach for constrained decoding plus one repair rung. The general form is worth memorising: <code>required_step_rate = target<sup>1/steps</sup></code>.`),
    },
    {
      difficulty: "core",
      prompt: `Write the three worst schemas for an agent that files bug reports, and fix each. Assume the model must produce <code>{title, severity, component, stepsToReproduce, assignee}</code>.`,
      answer:
        table(
          ["Bad", "Why it fails", "Fixed"],
          [
            [`<code>severity: string</code>`, `You will get "pretty bad", "P1", "high-ish", "critical!!"`, `<code>enumOf(["low","medium","high","critical"])</code> — unsamplable when wrong`],
            [`<code>component: string</code>`, `Invented components that match nothing in your tracker`, `Enum generated from the live component list, injected into the schema at call time`],
            [`<code>stepsToReproduce: string</code>`, `Sometimes a paragraph, sometimes numbered, sometimes a JSON-escaped blob with literal \\n`, `<code>arr(str())</code> — one step per element, no escaping ambiguity`],
            [`<code>assignee: string</code>`, `Hallucinated people`, `<code>opt(enumOf(teamMembers))</code> — optional, because "I don't know" must be representable`],
            [`nested <code>{meta:{source:{system:…}}}</code>`, `Each nesting level raises malformation`, `Flatten to <code>metaSourceSystem</code>`],
          ]
        ) +
        p(`The meta-lesson: <em>generate the schema from live data</em>. An enum built at call time from the actual component list makes hallucinated components unrepresentable, which is strictly better than validating them afterwards.`),
    },
    {
      difficulty: "core",
      prompt: `Implement <code>extractJson(text: string)</code> for rung 1. It must handle: a markdown fence, prose before and after, and an object containing a string that itself contains <code>}</code>. State what it must not do.`,
      answer:
        code({
          title: "brace-matching, string-aware",
          src: `export function extractJson(text: string): unknown {
  // 1. Fenced block wins if present — the model was explicit about the boundary.
  const fence = text.match(/\`\`\`(?:json)?\\s*\\n([\\s\\S]*?)\\n\`\`\`/);
  const body = fence ? fence[1] : text;

  // 2. Otherwise scan for the first balanced { } or [ ], respecting string literals.
  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = body.indexOf(open);
    if (start === -1) continue;
    let depth = 0, inStr = false, escaped = false;
    for (let i = start; i < body.length; i++) {
      const c = body[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\\\") { escaped = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;                       // braces inside strings do not count
      if (c === open) depth++;
      else if (c === close && --depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  throw new ExtractError(text);
}`,
        }) +
        p(`<strong>What it must not do:</strong> a regex like <code>/\\{[\\s\\S]*\\}/</code>. It is greedy across multiple objects, it breaks on braces inside strings, and it appears in a great deal of production code. The string-awareness is the entire difficulty; everything else is bookkeeping.`) +
        p(`It must also not silently return the <em>last</em> JSON-looking thing. When a model emits an example object followed by the real one, first-balanced-match is wrong roughly as often as last-match — which is why rung 0 exists and this function is a fallback, not a strategy.`),
    },
    {
      difficulty: "stretch",
      prompt: `Constrained decoding guarantees a valid enum value. Design the check that catches a <em>valid but wrong</em> value — say <code>severity: "critical"</code> on a typo report — without simply adding another model call to every request.`,
      answer:
        p(`Schema validity and semantic validity are orthogonal, so the second needs its own mechanism. Four, in increasing cost:`) +
        ol([
          `<strong>Cheap invariants in code.</strong> Rules you can state without a model: <code>critical ⇒ affected.length > 0</code>, <code>critical ⇒ needsHuman === true</code>, <code>eta ≤ 1440</code>. These catch a surprising share of nonsense for zero tokens, and each one is a unit test.`,
          `<strong>Cross-field consistency against the reasoning field.</strong> If the schema has <code>reasoning</code>, check that a critical severity's reasoning mentions any of a small term list (outage, data loss, security). Crude, free, and catches the case where the model picked the label before thinking.`,
          `<strong>Conditional escalation.</strong> Only spend a verification call when the decision is both high-stakes and low-confidence: sample twice at temperature 0.3 and verify only when the two disagree. That concentrates spend on the ~5% of ambiguous cases instead of taxing all 100%. This is ${ch("c10", "C10")}'s core trick.`,
          `<strong>Human review on a threshold.</strong> Route <code>critical</code> to a person regardless. The right answer for anything irreversible, and the design that makes ${ch("c16", "C16")} tolerable is choosing the threshold so the queue stays short.`,
        ]) +
        p(`The thing to avoid is a blanket "verify everything with a second model call". It doubles cost and latency, and the verifier shares the first model's blind spots, so it agrees with the mistake more often than it catches it.`),
    },
  ],

  qa: [
    { q: "Should I use JSON mode or a tool call for structured output?", a: p(`Use a tool call when the output is an <em>action</em> the agent will take — it unifies with C03's dispatch and the same code path handles both. Use native structured-output mode when the output is <em>data</em> for your code to consume. Mechanically they are the same constrained decoding. The difference is which abstraction makes your call sites read better.`) },
    { q: "Does asking for JSON make the model dumber?", a: p(`It can, and the mechanism is specific. Constrained decoding removes the model's room to think in prose before committing to an answer. The answer is to put the thinking inside the structure rather than abandon it: a leading <code>reasoning</code> string field, or an unconstrained turn followed by a constrained extraction turn. The two-turn version costs a round trip and consistently outperforms both alternatives on hard judgements.`) },
    { q: "What about YAML or XML instead of JSON?", a: p(`XML tags are genuinely easier for models to produce when the content is long, multi-line, or full of quotes and backslashes — which is why several coding agents use tag-delimited or line-oriented formats rather than JSON strings (see <code>apply_patch</code> in ${ch("c14", "C14")}). YAML is a trap: significant whitespace plus a model's indentation habits is a worse failure surface than JSON, and its type coercion rules will turn your <code>NO</code> enum into <code>false</code>.`) },
    { q: "How many repair attempts before giving up?", a: p(`Two, then stop. Measured recovery is roughly 90% on the first reprompt, 40% on the second, and near zero after that. A model that has failed twice is stuck in a basin, and more attempts mostly buy latency. If you need a third, the right third is a <em>cold</em> retry with the poisoned history dropped, and if that fails, the schema is wrong, not the model.`) },
    { q: "My schema has a union type and the provider rejects it. Now what?", a: p(`Flatten it into a discriminated object: a required <code>kind</code> enum plus optional fields for each variant, validated in code after parsing. You lose compile-time exhaustiveness at the schema boundary and regain it immediately in your own validator. This is the single most common strict-mode rejection, and it is worth knowing before you design a deep union.`) },
  ],

  project: {
    title: "Project · A validator whose errors are prompts",
    brief:
      p(`Write the schema library the rest of the course uses: <code>str</code>, <code>int</code>, <code>num</code>, <code>bool</code>, <code>enumOf</code>, <code>arr</code>, <code>obj</code>, <code>opt</code>. Two outputs from one declaration — a JSON Schema for the provider, and a validator whose errors are good enough to hand straight back to the model.`),
    spec: [
      "One declaration produces both <code>.json</code> (JSON Schema for the API) and <code>.validate()</code>, so they cannot drift.",
      "<code>Infer&lt;typeof S&gt;</code> gives the TypeScript type — no hand-written duplicate interface anywhere.",
      "Validation collects <em>all</em> issues with dotted paths, never short-circuits on the first.",
      "Representation coercions only: <code>\"3\"→3</code>, <code>\"true\"→true</code>, object→single-element array, case-folded enums. <code>null</code> for a required field stays an error.",
      "<code>renderIssues()</code> produces the reprompt text, including the 'keep every other field exactly as it was' clause.",
      "<code>structured(model, messages, schema)</code> implements the full ladder and returns a typed value or throws.",
    ],
    stretch: [
      "Add <code>refine(fn, message)</code> for semantic invariants, so <code>critical ⇒ needsHuman</code> lives in the schema and produces the same issue shape.",
      "Build the schema's enum from live data at call time (a component list, a set of usernames) and show that hallucinated values become unrepresentable rather than merely invalid.",
      "Write the harness from the chapter's run output: 1,000 mock outputs seeded with the seven real failure modes, reporting the success rate at each rung. You now have a regression test for your parsing layer.",
    ],
  },

  quiz: [
    {
      q: "An agent parses model output correctly 97% of the time per step. What fraction of 20-step tasks complete without a parse failure?",
      options: ["About 54%", "About 97%", "About 85%", "About 40%"],
      answer: 0,
      why: "0.97^20 ≈ 0.54. Per-step reliability is raised to the power of the step count, which is why anything under ~99.9% is a hard ceiling on how long a task your agent can finish. For 95% of 20-step runs you would need 99.74% per step.",
    },
    {
      q: "What does constrained decoding actually guarantee?",
      options: [
        "The output conforms to the schema's shape and enums — it says nothing about whether the values are correct",
        "The output is both well-formed and semantically appropriate",
        "The model reasons more carefully about the answer",
        "Retries are no longer necessary for any failure mode",
      ],
      answer: 0,
      why: "The decoder masks tokens that would violate the grammar, so invalid shape becomes unrepresentable. Choosing `severity: \"critical\"` for a typo is perfectly valid under the grammar. Schema validity and semantic validity need separate mechanisms.",
    },
    {
      q: "Which coercion should a validator refuse to perform?",
      options: [
        "`null` → `\"\"` for a required string",
        "`\"3\"` → `3` for an integer field",
        "`\"TRUE\"` → `true` for a boolean",
        "`{…}` → `[{…}]` for an array field",
      ],
      answer: 0,
      why: "Coerce representation, never meaning. `\"3\"` and `3` are the same fact written two ways. `null` is the model telling you it does not know — converting it to an empty string destroys exactly the signal that should trigger escalation or a follow-up question.",
    },
    {
      q: "Why should the validator collect every issue instead of returning the first?",
      options: [
        "One reprompt can then fix every problem at once, instead of converging over several round trips",
        "It produces shorter error messages",
        "JSON Schema requires it",
        "It avoids exceptions",
      ],
      answer: 0,
      why: "Short-circuiting means the model fixes issue 1, you discover issue 2, and so on — four round trips where one would do. It is a two-line change in `obj` and roughly a 3× difference in repair cost.",
    },
    {
      q: "Which reprompt recovers best after a validation failure?",
      options: [
        "The exact field paths with expected and actual values, plus an instruction not to change anything else",
        "'That was not valid JSON, please try again'",
        "The full JSON Schema, repeated",
        "The same request at a higher temperature",
      ],
      answer: 0,
      why: "Located, specific, actionable — roughly 90% recovery versus roughly 40% for a generic retry. The 'keep every other field exactly as it was' clause matters as much as the paths: without it the model rewrites correct fields and produces a different failure.",
    },
    {
      q: "When is a leading `reasoning: string` field in the schema a good idea?",
      options: [
        "For judgement calls — it gives the model thinking room inside the object, improves the decision, and eliminates prose-before-JSON",
        "Never; it wastes output tokens",
        "Only when the model does not support constrained decoding",
        "Only for outputs a human will read",
      ],
      answer: 0,
      why: "Constrained decoding removes the model's room to think aloud before committing, which measurably hurts hard judgements. Putting the reasoning inside the object restores it, kills the most common malformation mode, and leaves an explanation in your logs. Strip the field before using the value.",
    },
  ],

  continues:
    p(`You can now get a typed value out of a model reliably. A typed value that names an <em>action</em> — <code>{tool: "search", args: {...}}</code> — is one dispatch table away from an agent that changes the world. ${ch("c03", "C03")} is about the interface between the model's intentions and your functions, and about why the description string is more important than the code.`),
};

export default chapter;
