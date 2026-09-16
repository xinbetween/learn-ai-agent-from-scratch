/**
 * C14 · apply_patch
 *
 * A line-oriented patch format with context-addressed hunks: no line numbers to
 * miscount, no JSON string to escape. Parser, matching ladder, atomic applier.
 *
 *   node --experimental-strip-types code/c14_apply_patch.ts
 */

/* ------------------------------------------------------------------ grammar */

export const BEGIN = "*** Begin Patch";
export const END = "*** End Patch";
export const EOF_MARKER = "*** End of File";

export type Op =
  | { kind: "add"; path: string; lines: string[] }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; moveTo?: string; hunks: Hunk[] };

export interface HunkLine { kind: "context" | "add" | "remove"; text: string }
export interface Hunk { locator?: string; lines: HunkLine[]; atEof: boolean }
export interface Patch { ops: Op[] }

export class InvalidPatchError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(line === undefined ? message : `${message} (patch line ${line})`);
    this.name = "InvalidPatchError";
    this.line = line;
  }
}

/* ------------------------------------------------------------------ parse */

export function parsePatch(text: string): Patch {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i]?.trimEnd() !== BEGIN) throw new InvalidPatchError(`patch must start with "${BEGIN}"`, i + 1);
  i++;

  const ops: Op[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimEnd() === END) return { ops };

    if (line.startsWith("*** Add File: ")) {
      const path = line.slice("*** Add File: ".length).trim();
      i++;
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith("+")) body.push(lines[i++].slice(1));
      ops.push({ kind: "add", path, lines: body });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      ops.push({ kind: "delete", path: line.slice("*** Delete File: ".length).trim() });
      i++;
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const path = line.slice("*** Update File: ".length).trim();
      i++;
      let moveTo: string | undefined;
      if (lines[i]?.startsWith("*** Move to: ")) {
        moveTo = lines[i].slice("*** Move to: ".length).trim();
        i++;
      }
      const hunks: Hunk[] = [];
      while (i < lines.length && !lines[i].startsWith("*** ")) {
        if (lines[i].startsWith("@@")) {
          const locator = lines[i].slice(2).trim() || undefined;
          i++;
          const { hunk, next } = readHunk(lines, i, locator);
          hunks.push(hunk);
          i = next;
        } else if (lines[i].trim() === "") {
          i++;
        } else {
          // A hunk without an @@ header is legal; treat it as one with no locator.
          const { hunk, next } = readHunk(lines, i, undefined);
          if (!hunk.lines.length) throw new InvalidPatchError(`unexpected line: ${JSON.stringify(lines[i])}`, i + 1);
          hunks.push(hunk);
          i = next;
        }
      }
      if (!hunks.length) throw new InvalidPatchError(`Update File: ${path} has no hunks`, i);
      ops.push({ kind: "update", path, moveTo, hunks });
      continue;
    }

    throw new InvalidPatchError(`unexpected line: ${JSON.stringify(line)}`, i + 1);
  }
  throw new InvalidPatchError(`patch is missing "${END}"`);
}

function readHunk(lines: string[], start: number, locator?: string): { hunk: Hunk; next: number } {
  const body: HunkLine[] = [];
  let i = start;
  let atEof = false;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("@@") || l.startsWith("*** ")) {
      if (l.trimEnd() === EOF_MARKER) { atEof = true; i++; }
      break;
    }
    if (l.startsWith("+")) body.push({ kind: "add", text: l.slice(1) });
    else if (l.startsWith("-")) body.push({ kind: "remove", text: l.slice(1) });
    else if (l.startsWith(" ")) body.push({ kind: "context", text: l.slice(1) });
    else if (l === "") body.push({ kind: "context", text: "" });
    else break;
  }
  return { hunk: { locator, lines: body, atEof }, next: i };
}

/* ------------------------------------------------------------------ matching */

export type Rung = "exact" | "trimEnd" | "trim" | "punct";

const PUNCT: Array<[RegExp, string]> = [
  [/[‐‑‒–—―]/g, "-"],   // hyphens and dashes
  [/[‘’‛]/g, "'"],                      // curly single quotes
  [/[“”‟]/g, '"'],                      // curly double quotes
  [/ /g, " "],                                    // non-breaking space
  [/…/g, "..."],                                  // ellipsis
];
const normPunct = (s: string): string => PUNCT.reduce((t, [re, to]) => t.replace(re, to), s);

export type Located =
  | { found: true; at: number; rung: Rung }
  | { found: false; reason: "ambiguous"; at: number[] }
  | { found: false; reason: "not_found"; nearest: number | null };

/** Cheapest comparison first; each rung is tried only if the one above fails. */
export function locate(fileLines: string[], context: string[], locator?: string): Located {
  if (!context.length) return { found: true, at: 0, rung: "exact" };

  // Rung 0: narrow the window using the @@ locator, if one was given.
  let from = 0;
  if (locator) {
    const hit = fileLines.findIndex((l) => l.includes(locator));
    if (hit >= 0) from = hit;
  }

  const rungs: Array<[Rung, (a: string, b: string) => boolean]> = [
    ["exact", (a, b) => a === b],
    ["trimEnd", (a, b) => a.trimEnd() === b.trimEnd()],
    ["trim", (a, b) => a.trim() === b.trim()],
    ["punct", (a, b) => normPunct(a.trim()) === normPunct(b.trim())],
  ];

  for (const [rung, eq] of rungs) {
    const hits = findAll(fileLines, context, from, eq);
    // Also search before the locator, in case it pointed past the hunk.
    const all = from > 0 ? [...new Set([...hits, ...findAll(fileLines, context, 0, eq)])].sort((a, b) => a - b) : hits;
    if (all.length === 1) return { found: true, at: all[0], rung };
    if (all.length > 1) return { found: false, reason: "ambiguous", at: all };
  }
  return { found: false, reason: "not_found", nearest: nearestWindow(fileLines, context) };
}

function findAll(file: string[], ctx: string[], from: number, eq: (a: string, b: string) => boolean): number[] {
  const out: number[] = [];
  for (let i = from; i + ctx.length <= file.length; i++) {
    let ok = true;
    for (let j = 0; j < ctx.length; j++) if (!eq(file[i + j], ctx[j])) { ok = false; break; }
    if (ok) out.push(i);
  }
  return out;
}

function nearestWindow(file: string[], ctx: string[]): number | null {
  let best: number | null = null, bestScore = -1;
  for (let i = 0; i + ctx.length <= file.length; i++) {
    let score = 0;
    for (let j = 0; j < ctx.length; j++) if (file[i + j].trim() === ctx[j].trim()) score++;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore > 0 ? best : null;
}

/* ------------------------------------------------------------------ apply */

export interface ApplyResult {
  ok: boolean;
  files?: Map<string, string | null>;    // null = delete
  message?: string;
  rungs?: Rung[];
}

/**
 * Validate every hunk against every file FIRST, then write. A half-applied patch
 * leaves the repository in a state neither you nor the agent has a model of.
 */
export function applyPatch(patch: Patch, read: (path: string) => string | null): ApplyResult {
  const out = new Map<string, string | null>();
  const rungs: Rung[] = [];

  for (const op of patch.ops) {
    if (op.kind === "add") {
      if (read(op.path) !== null) return { ok: false, message: `Add File: ${op.path} already exists. Use Update File to modify it.` };
      out.set(op.path, op.lines.join("\n") + (op.lines.length ? "\n" : ""));
      continue;
    }
    if (op.kind === "delete") {
      if (read(op.path) === null) return { ok: false, message: `Delete File: ${op.path} does not exist.` };
      out.set(op.path, null);
      continue;
    }

    const original = read(op.path);
    if (original === null) return { ok: false, message: `Update File: ${op.path} does not exist. Use Add File to create it.` };

    let lines = original.split("\n");
    const trailingNewline = original.endsWith("\n");
    if (trailingNewline) lines.pop();

    for (const [n, hunk] of op.hunks.entries()) {
      const context = hunk.lines.filter((l) => l.kind !== "add").map((l) => l.text);
      const found = hunk.atEof
        ? { found: true as const, at: Math.max(0, lines.length - context.length), rung: "exact" as Rung }
        : locate(lines, context, hunk.locator);

      if (!found.found) return { ok: false, message: explain(op.path, n, hunk, context, found, lines) };
      rungs.push(found.rung);

      // Indentation is re-derived from the file, not copied from the patch —
      // otherwise a trimmed match silently breaks Python and mangles the rest.
      const firstCtx = hunk.lines.find((l) => l.kind !== "add");
      const delta = firstCtx
        ? indentOf(lines[found.at] ?? "").length - indentOf(firstCtx.text).length
        : 0;
      const reindent = (t: string): string =>
        delta > 0 ? indentOf(lines[found.at] ?? "").slice(0, delta) + t
        : delta < 0 ? t.slice(Math.min(-delta, indentOf(t).length))
        : t;

      const replacement = hunk.lines.filter((l) => l.kind !== "remove").map((l) => reindent(l.text));
      lines = [...lines.slice(0, found.at), ...replacement, ...lines.slice(found.at + context.length)];
    }

    const text = lines.join("\n") + (trailingNewline ? "\n" : "");
    if (op.moveTo) { out.set(op.moveTo, text); out.set(op.path, null); }
    else out.set(op.path, text);
  }

  return { ok: true, files: out, rungs };
}

const indentOf = (s: string): string => s.match(/^[ \t]*/)?.[0] ?? "";

function explain(path: string, n: number, hunk: Hunk, context: string[], found: Extract<Located, { found: false }>, lines: string[]): string {
  const head = `apply_patch failed: hunk ${n + 1} of ${path} did not apply.\n`;
  if (found.reason === "ambiguous") {
    return head +
      `\nIts context matches ${found.at.length} places:\n` +
      found.at.map((at) =>
        `  line ${at + 1}  (inside ${enclosing(lines, at) ?? "top level"})\n` +
        lines.slice(at, at + Math.min(3, context.length)).map((l) => `    ${l}`).join("\n")).join("\n\n") +
      `\n\nNothing was applied. Add more surrounding context lines so the match is unique, ` +
      `or set the @@ header to the enclosing function or class, e.g.\n  @@ ${enclosing(lines, found.at[0]) ?? "class Foo"}`;
  }
  const near = found.nearest;
  return head +
    `\nYour context:\n${context.map((l) => `    ${l}`).join("\n")}\n` +
    (near !== null
      ? `\nClosest text in the file (line ${near + 1}):\n${lines.slice(near, near + context.length).map((l) => `    ${l}`).join("\n")}\n`
      : `\nNo similar text found in the file.\n`) +
    `\nNothing was applied — the patch is atomic. Re-read the file and send a corrected patch.`;
}

const enclosing = (lines: string[], at: number): string | null => {
  for (let i = at; i >= 0; i--) {
    const m = lines[i].match(/^\s*(?:export\s+)?(?:async\s+)?(?:function|class|const|def)\s+(\w+)/);
    if (m) return lines[i].trim();
  }
  return null;
};

/* ------------------------------------------------------------------ demo */

const FILE = `// Session storage - backed by Redis, keyed by session id.
export class SessionStore {
  constructor(private readonly redis: Redis) {}

  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.get(\`sess:\${id}\`);
    return raw ? JSON.parse(raw) : null;
  }

  async set(id: string, s: Session): Promise<void> {
    await this.redis.set(\`sess:\${id}\`, JSON.stringify(s));
  }
}
`;

function main(): void {
  console.log("\n  C14 · apply_patch\n");

  const files = new Map<string, string>([["src/session.ts", FILE]]);
  const read = (p: string) => files.get(p) ?? null;

  const cases: Array<[string, string]> = [
    ["exact context match", `${BEGIN}
*** Update File: src/session.ts
@@ async get(id: string)
     const raw = await this.redis.get(\`sess:\${id}\`);
-    return raw ? JSON.parse(raw) : null;
+    if (!raw) return null;
+    const parsed = JSON.parse(raw) as Session;
+    if (parsed.expiresAt < Date.now()) { await this.redis.del(\`sess:\${id}\`); return null; }
+    return parsed;
${END}`],

    ["trailing whitespace differs", `${BEGIN}
*** Update File: src/session.ts
@@
-    return raw ? JSON.parse(raw) : null;${"   "}
+    return raw ? (JSON.parse(raw) as Session) : null;
${END}`],

    // The model emitted an EN DASH (U+2013) where the file has an ASCII hyphen.
    // Visually identical, and impossible to debug without punctuation normalisation.
    ["typographic dash (rung 4)", `${BEGIN}
*** Update File: src/session.ts
@@
-// Session storage \u2013 backed by Redis, keyed by session id.
+// Session storage - backed by Redis, keyed by session id and expiring on read.
${END}`],

    ["add + delete + move, one patch", `${BEGIN}
*** Add File: src/session.test.ts
+import { test } from "node:test";
+test("expired sessions return null", async () => {});
*** Delete File: src/session.ts
${END}`],

    ["ambiguous context", `${BEGIN}
*** Update File: src/dup.ts
@@
-  return null;
+  return undefined;
${END}`],

    ["context not found", `${BEGIN}
*** Update File: src/session.ts
@@
-    const raw = await this.redis.get(\`session:\${id}\`);
+    const raw = await this.redis.get(\`sess:\${id}\`);
${END}`],
  ];

  files.set("src/dup.ts", `function a() {\n  return null;\n}\nfunction b() {\n  return null;\n}\n`);

  for (const [label, text] of cases) {
    let result: ApplyResult;
    try { result = applyPatch(parsePatch(text), read); }
    catch (e) { result = { ok: false, message: (e as Error).message }; }
    const status = result.ok ? `applied  [${[...new Set(result.rungs)].join(", ")}]` : "refused";
    console.log(`  ${result.ok ? "✓" : "✗"} ${label.padEnd(30)} ${status}`);
    if (!result.ok) console.log(result.message!.split("\n").slice(0, 3).map((l) => "      " + l).join("\n"));
  }

  console.log("\n  the message an agent gets back on an ambiguous hunk:\n");
  const amb = applyPatch(parsePatch(cases[4][1]), read);
  console.log(amb.message!.split("\n").map((l) => "    " + l).join("\n"));

  console.log("\n  atomicity: a patch whose SECOND hunk fails writes nothing\n");
  const twoHunks = `${BEGIN}
*** Update File: src/session.ts
@@
-  async set(id: string, s: Session): Promise<void> {
+  async set(id: string, s: Session, ttl?: number): Promise<void> {
@@
-    this line does not exist anywhere
+    neither does this
${END}`;
  const r = applyPatch(parsePatch(twoHunks), read);
  console.log(`    result: ${r.ok ? "applied" : "refused"} · files written: ${r.files?.size ?? 0}`);
  console.log(`    src/session.ts unchanged: ${read("src/session.ts") === FILE}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
