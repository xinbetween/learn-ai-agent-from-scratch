/**
 * C24 · Capstone II — a coding agent.
 *
 * Orient with grep, plan, patch with apply_patch, run the tests, read the real
 * failure, repair. The test suite is ground truth and it lives inside the loop.
 *
 *   node --experimental-strip-types code/c24_coder/main.ts
 */

import { parsePatch, applyPatch } from "../c14_apply_patch.ts";
import { Repo, runTests, renderTestResult, checkTestWeakening, canFinish, type CodeState } from "./repo.ts";

const SESSION_TS = `import type { Redis } from "./redis.ts";
import type { Session } from "./types.ts";

export class SessionStore {
  private readonly redis: Redis;
  constructor(redis: Redis) { this.redis = redis; }

  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.get(\`sess:\${id}\`);
    return raw ? JSON.parse(raw) : null;
  }

  async set(id: string, s: Session): Promise<void> {
    await this.redis.set(\`sess:\${id}\`, JSON.stringify(s));
  }
}
`;

const SESSION_TEST = `import { test } from "node:test";

test("returns a session for a live entry", ASSERT:returns_session)

test("expired sessions return null", ASSERT:expired_returns_null)

test("expired entries are deleted on read", ASSERT:expired_is_deleted)
`;

const OTHER = `export function login() { return "ok"; }\n`;

/* ---------------- the agent's steps, scripted so the loop is real ---------------- */

interface Step { kind: "grep" | "read" | "patch" | "test" | "finish"; arg?: string; patch?: string; why: string }

const PATCH_1 = `*** Begin Patch
*** Update File: src/session.ts
@@ async get(id: string)
     const raw = await this.redis.get(\`sess:\${id}\`);
-    return raw ? JSON.parse(raw) : null;
+    if (!raw) return null;
+    const parsed = JSON.parse(raw) as Session;
+    if (parsed.expiresAt < Date.now()) return null;
+    return parsed;
*** End Patch`;

const PATCH_2 = `*** Begin Patch
*** Update File: src/session.ts
@@ async get(id: string)
-    if (parsed.expiresAt < Date.now()) return null;
+    if (parsed.expiresAt < Date.now()) {
+      await this.redis.del(\`sess:\${id}\`);
+      return null;
+    }
*** End Patch`;

const CHEATING_PATCH = `*** Begin Patch
*** Update File: src/session.test.ts
@@
-test("expired entries are deleted on read", ASSERT:expired_is_deleted)
+// TODO: revisit
*** End Patch`;

const SCRIPT: Step[] = [
  { kind: "grep", arg: "sess:", why: "find where session keys are used before reading anything" },
  { kind: "read", arg: "src/session.test.ts", why: "read the tests first — they say what it is supposed to do" },
  { kind: "read", arg: "src/session.ts", why: "read only the range the grep pointed at" },
  { kind: "test", why: "establish the failing baseline before changing anything" },
  { kind: "patch", patch: PATCH_1, why: "return null for expired entries" },
  { kind: "test", why: "ground truth" },
  { kind: "patch", patch: CHEATING_PATCH, why: "(the agent tries to delete the test it cannot satisfy)" },
  { kind: "patch", patch: PATCH_2, why: "delete the expired entry on read, as the test requires" },
  { kind: "test", why: "full suite after the last patch" },
  { kind: "finish", why: "report" },
];

/* ---------------- run ---------------- */

async function main(): Promise<void> {
  console.log("\n  C24 · Capstone II — Coding Agent\n");
  console.log(`  task: "Session cache entries never expire. Fix it, and make sure expired`);
  console.log(`         entries are removed. Do not weaken the tests."\n`);

  const repo = new Repo({ "src/session.ts": SESSION_TS, "src/session.test.ts": SESSION_TEST, "src/login.ts": OTHER });
  const state: CodeState = { filesChanged: new Set(), lastFullTestRun: null, lastPatchAt: 0, planOpen: [] };
  let tokens = 0, refusals = 0, patchesApplied = 0;
  const t0 = Date.now();

  for (const [i, step] of SCRIPT.entries()) {
    const n = String(i + 1).padStart(2);
    if (step.kind === "grep") {
      const out = repo.grep(step.arg!);
      tokens += Math.ceil(out.length / 3.7);
      console.log(`  ${n}  grep "${step.arg}"  → ${out.split("\n").length} matches, ${Math.ceil(out.length / 3.7)} tokens`);
      console.log(out.split("\n").map((l) => `        ${l}`).join("\n"));
      continue;
    }

    if (step.kind === "read") {
      const out = repo.readLines(step.arg!, 1, 20);
      tokens += Math.ceil(out.length / 3.7);
      console.log(`  ${n}  read ${step.arg} (lines 1–20) → ${Math.ceil(out.length / 3.7)} tokens   [${step.why}]`);
      continue;
    }

    if (step.kind === "test") {
      const r = runTests(repo);
      state.lastFullTestRun = r;
      const rendered = renderTestResult(r);
      tokens += Math.ceil(rendered.length / 3.7);
      console.log(`  ${n}  npm test → ${r.failed ? `✗ ${r.failed} failed, ${r.passed} passed` : `✓ ${r.passed} passed`}  (${Math.ceil(rendered.length / 3.7)} tokens)`);
      if (r.failed) {
        const f = r.failures[0];
        console.log(`        ${f.file}:${f.line} — ${f.name}`);
        console.log(`        ${f.message}`);
      }
      continue;
    }

    if (step.kind === "patch") {
      // GUARD: structural, not a prompt instruction.
      const weakening = checkTestWeakening(step.patch!);
      if (weakening) {
        refusals++;
        console.log(`  ${n}  apply_patch → REFUSED`);
        console.log(`        ${weakening.slice(0, 96)}`);
        console.log(`        (the agent reported this as "fixing the test" — from inside its context, that is true)`);
        continue;
      }
      repo.checkpoint(step.why);
      const result = applyPatch(parsePatch(step.patch!), (p) => repo.read(p));
      if (!result.ok) { console.log(`  ${n}  apply_patch → failed: ${result.message!.split("\n")[0]}`); continue; }
      for (const [path, content] of result.files!) { repo.write(path, content); state.filesChanged.add(path); }
      state.lastPatchAt = Date.now();
      patchesApplied++;
      console.log(`  ${n}  apply_patch src/session.ts → applied [${[...new Set(result.rungs)].join(", ")}]   [${step.why}]`);
      continue;
    }

    // GUARD: a completion gate the model cannot talk past.
    const blocked = canFinish(state);
    console.log(`  ${n}  finish → ${blocked ? `BLOCKED: ${blocked}` : "allowed"}`);
  }

  const final = runTests(repo);
  console.log(`\n  ${"─".repeat(76)}`);
  console.log(`  result: ${final.failed ? `✗ ${final.failed} failing` : `✓ all ${final.passed} tests pass`} · ` +
    `${patchesApplied} patches applied · ${refusals} refused · ${repo.checkpointCount} checkpoints · ` +
    `${tokens.toLocaleString()} tokens read · ${Date.now() - t0}ms`);

  console.log(`\n  the fixed function:\n`);
  console.log(repo.readLines("src/session.ts", 8, 17).split("\n").map((l) => "    " + l).join("\n"));

  console.log(`\n  undo is one command:`);
  console.log(`    ${repo.undo(1)}`);
  console.log(`    tests now: ${runTests(repo).failed} failing — the last patch is gone`);
  repo.undo(repo.checkpointCount);
  console.log(`    ${"undo --all".padEnd(14)} → ${runTests(repo).failed} failing (back to the original bug)`);

  console.log(`\n  what the guards did:`);
  console.log(`    · the test-weakening patch was refused structurally — the agent had reported`);
  console.log(`      it as a fix, and from inside its context "the tests now pass" was true`);
  console.log(`    · finish was blocked until the full suite ran AFTER the last patch`);
  console.log(`    · grep before read kept the whole run under ${tokens.toLocaleString()} tokens of file content`);
  console.log(`\n  Ground truth in the loop is why this works. With no tests, none of the above`);
  console.log(`  has anything to check against — which is why the agent's first task in an`);
  console.log(`  untested repository is to write a test.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
