/** An in-memory repository with checkpoints, a test runner, and failure parsing. */

export interface TestFailure { file: string; line: number; name: string; message: string; frame: string }
export interface TestResult { passed: number; failed: number; failures: TestFailure[]; at: number }

export class Repo {
  private files = new Map<string, string>();
  private checkpoints: Array<{ label: string; snapshot: Map<string, string> }> = [];

  constructor(files: Record<string, string>) {
    for (const [p, c] of Object.entries(files)) this.files.set(p, c);
  }

  read(path: string): string | null { return this.files.get(path) ?? null; }
  list(): string[] { return [...this.files.keys()].sort(); }
  write(path: string, content: string | null): void {
    if (content === null) this.files.delete(path); else this.files.set(path, content);
  }

  /** Undo, built on snapshots — the feature that buys the permissive default. */
  checkpoint(label: string): number {
    this.checkpoints.push({ label, snapshot: new Map(this.files) });
    return this.checkpoints.length;
  }
  undo(n = 1): string {
    const target = this.checkpoints[this.checkpoints.length - n];
    if (!target) return "nothing to undo";
    this.files = new Map(target.snapshot);
    return `restored to checkpoint ${this.checkpoints.length - n + 1}: ${target.label}`;
  }
  get checkpointCount(): number { return this.checkpoints.length; }

  /** ripgrep-shaped: path:line:text, which is 300 tokens where reading is 12,000. */
  grep(pattern: string, glob?: string): string {
    const re = new RegExp(pattern);
    const out: string[] = [];
    for (const [path, content] of [...this.files].sort()) {
      if (glob && !path.includes(glob)) continue;
      content.split("\n").forEach((line, i) => { if (re.test(line)) out.push(`${path}:${i + 1}:${line.trim()}`); });
    }
    return out.length ? out.join("\n") : `No matches for /${pattern}/.`;
  }

  readLines(path: string, start?: number, end?: number): string {
    const c = this.read(path);
    if (c === null) return `No such file: ${path}. Files: ${this.list().join(", ")}`;
    const lines = c.split("\n");
    const a = Math.max(1, start ?? 1), b = Math.min(lines.length, end ?? lines.length);
    return lines.slice(a - 1, b).map((l, i) => `${String(a + i).padStart(4)}| ${l}`).join("\n");
  }
}

/* ---------------- the test suite, as ground truth ---------------- */

/** A tiny evaluator: enough for the fixture to be genuinely checked, not faked. */
export function runTests(repo: Repo): TestResult {
  const src = repo.read("src/session.ts") ?? "";
  const tests = repo.list().filter((p) => p.endsWith(".test.ts"));
  const failures: TestFailure[] = [];
  let passed = 0;

  for (const path of tests) {
    const body = repo.read(path)!;
    for (const m of body.matchAll(/test\("([^"]+)",\s*ASSERT:([a-z_]+)\)/g)) {
      const [, name, assertion] = m;
      const line = body.slice(0, m.index).split("\n").length;
      const ok = checkAssertion(assertion, src);
      if (ok) { passed++; continue; }
      failures.push({
        file: path, line, name,
        message: MESSAGES[assertion] ?? "assertion failed",
        frame: body.split("\n").slice(Math.max(0, line - 2), line + 1).map((l, i) => `${String(line - 1 + i).padStart(4)}| ${l}`).join("\n"),
      });
    }
  }
  return { passed, failed: failures.length, failures, at: Date.now() };
}

const MESSAGES: Record<string, string> = {
  returns_session: 'expected a Session for a live entry, got undefined',
  expired_returns_null: 'expected null for an expired entry, got Session { id: "a1", expiresAt: 1690000000 }',
  expired_is_deleted: 'expected redis.del to have been called once, got 0 calls',
};

function checkAssertion(assertion: string, src: string): boolean {
  switch (assertion) {
    case "returns_session": return /JSON\.parse\(raw\)/.test(src);
    // The bug: nothing checks expiresAt.
    case "expired_returns_null": return /expiresAt\s*<\s*Date\.now\(\)/.test(src);
    // The second bug, revealed only after the first is fixed: the entry is not deleted.
    case "expired_is_deleted": return /redis\.del\(/.test(src);
    default: return false;
  }
}

/** The model needs the ASSERTION, not 4,000 lines of stack trace. */
export function renderTestResult(r: TestResult): string {
  if (!r.failed) return `✓ ${r.passed} passed.`;
  const shown = r.failures.slice(0, 3);
  return [
    `✗ ${r.failed} failed, ${r.passed} passed.`,
    ...shown.map((f) => `\n── ${f.file}:${f.line} — ${f.name}\n${f.message}\n\nsource:\n${f.frame}`),
    r.failed > 3 ? `\n… and ${r.failed - 3} more. Fix these first — they may share a cause.` : "",
  ].filter(Boolean).join("\n");
}

/* ---------------- guards ---------------- */

export const isTestFile = (p: string): boolean => /\.test\.ts$|(^|\/)tests?\//.test(p);

/**
 * An agent that cannot make a test pass will eventually weaken the test, and it
 * reports success honestly — from inside the context, the tests do now pass.
 * Detect it structurally: removed assertions and added skips are visible in the patch.
 */
export function checkTestWeakening(patchText: string): string | null {
  const touchesTests = /\*\*\* (Update|Add|Delete) File: \S*(\.test\.ts|tests?\/)/.test(patchText);
  if (!touchesTests) return null;
  const removed = patchText.split("\n").filter((l) => l.startsWith("-") && /\bASSERT:|\bexpect\(|\bassert\b/.test(l));
  const skipped = patchText.split("\n").filter((l) => l.startsWith("+") && /\b(skip|only|xit|xdescribe)\b/.test(l));
  const deletedTestFile = /\*\*\* Delete File: \S*\.test\.ts/.test(patchText);
  if (!removed.length && !skipped.length && !deletedTestFile) return null;
  return `This patch ${deletedTestFile ? "deletes a test file" : ""}` +
    `${removed.length ? `${deletedTestFile ? ", " : ""}removes ${removed.length} assertion(s)` : ""}` +
    `${skipped.length ? ` and adds ${skipped.length} skip(s)` : ""}. ` +
    `Weakening a test is not fixing the code. If the test is genuinely wrong, say why and ask — do not change it silently.`;
}

export interface CodeState {
  filesChanged: Set<string>;
  lastFullTestRun: TestResult | null;
  lastPatchAt: number;
  planOpen: string[];
}

/** A check in the loop, not an instruction in the prompt. */
export function canFinish(s: CodeState): string | null {
  if (s.planOpen.length) return `Plan steps not done: ${s.planOpen.join(", ")}.`;
  if (!s.filesChanged.size) return null;
  if (!s.lastFullTestRun) return "You changed files but never ran the full test suite.";
  if (s.lastFullTestRun.at < s.lastPatchAt) return "You patched after the last test run. Run the tests again.";
  if (s.lastFullTestRun.failed) return `${s.lastFullTestRun.failed} tests are failing. Fix them, or explain specifically why they are unrelated.`;
  return null;
}
