import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const LOOP_SVG = `
<svg viewBox="0 0 700 320" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The coding agent loop: orient, plan, patch, verify, repair">
  <defs><marker id="c24" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="c24a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="18" class="d-label">THE TEST SUITE IS THE REASON THIS WORKS — GROUND TRUTH IN THE LOOP</text>

  <rect x="14" y="32" width="112" height="48" rx="6" class="d-box-p"/>
  <text x="70" y="52" class="d-text" text-anchor="middle">orient</text>
  <text x="70" y="69" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">grep · read</text>
  <path d="M130 56 L158 56" class="d-arrow" marker-end="url(#c24)"/>

  <rect x="162" y="32" width="112" height="48" rx="6" class="d-box-p"/>
  <text x="218" y="52" class="d-text" text-anchor="middle">plan</text>
  <text x="218" y="69" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">todo list · C09</text>
  <path d="M278 56 L306 56" class="d-arrow" marker-end="url(#c24)"/>

  <rect x="310" y="32" width="112" height="48" rx="6" class="d-box-a"/>
  <text x="366" y="52" class="d-text" text-anchor="middle">patch</text>
  <text x="366" y="69" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">apply_patch · C14</text>
  <path d="M426 56 L454 56" class="d-arrow" marker-end="url(#c24)"/>

  <rect x="458" y="32" width="112" height="48" rx="6" class="d-box-t"/>
  <text x="514" y="52" class="d-text" text-anchor="middle">verify</text>
  <text x="514" y="69" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">tests · typecheck</text>

  <path d="M574 56 L604 56" class="d-arrow" marker-end="url(#c24)"/>
  <rect x="608" y="32" width="78" height="48" rx="6" class="d-box"/>
  <text x="647" y="52" class="d-text" text-anchor="middle">done</text>
  <text x="647" y="69" class="d-mono" text-anchor="middle" fill="var(--ok)">green</text>

  <path d="M514 84 L514 116 L366 116 L366 84" class="d-arrow-a" marker-end="url(#c24a)"/>
  <text x="440" y="110" class="d-mono" text-anchor="middle" fill="var(--accent)">red → read the failure, patch again</text>

  <path d="M366 120 L218 120 L218 84" class="d-arrow-a" marker-end="url(#c24a)" stroke-dasharray="4 3"/>
  <text x="270" y="136" class="d-mono" text-anchor="middle" fill="var(--danger)">3 failed attempts → replan, do not keep patching</text>

  <line x1="14" y1="156" x2="686" y2="156" stroke="var(--border)"/>
  <text x="14" y="178" class="d-label">THE PERMISSION MODEL — TWO INDEPENDENT AXES (C16)</text>

  <rect x="14" y="190" width="216" height="62" rx="6" class="d-box-t"/>
  <text x="26" y="210" class="d-mono">SANDBOX · workspace-write</text>
  <text x="26" y="228" class="d-mono" fill="var(--fg-faint)">writes under repo root only</text>
  <text x="26" y="244" class="d-mono" fill="var(--fg-faint)">.git protected · no network</text>

  <rect x="242" y="190" width="216" height="62" rx="6" class="d-box-a"/>
  <text x="254" y="210" class="d-mono">APPROVAL · on-failure</text>
  <text x="254" y="228" class="d-mono" fill="var(--fg-faint)">edits and tests: no prompt</text>
  <text x="254" y="244" class="d-mono" fill="var(--fg-faint)">outside root, push, install: ask</text>

  <rect x="470" y="190" width="216" height="62" rx="6" class="d-box"/>
  <text x="482" y="210" class="d-mono">UNDO · always one keystroke</text>
  <text x="482" y="228" class="d-mono" fill="var(--fg-faint)">every patch is a git stash entry</text>
  <text x="482" y="244" class="d-mono" fill="var(--ok)">cheap reversal → permissive default</text>

  <text x="14" y="288" class="d-mono" fill="var(--accent)">cheap, certain undo is what buys you the permissive default. build it first.</text>
  <text x="14" y="310" class="d-mono" fill="var(--fg-faint)">without it every edit needs a human, and the agent is slower than doing it yourself.</text>
</svg>`;

const chapter: Chapter = {
  id: "c24",
  num: 24,
  layer: "capstone",
  title: "Capstone II · A Coding Agent",
  subtitle: "Read, patch, test, repair — on your actual files",
  blurb:
    "The second complete system: repository orientation, a todo plan, apply_patch edits, the test suite as ground truth in the loop, and a permission model that makes it safe to leave running.",
  lines: 328,
  file: "code/c24_coder/",
  tags: ["capstone", "coding agent", "apply_patch", "ground truth", "sandbox", "permissions", "undo"],

  sections: [
    { id: "motivation", kicker: "The brief", title: "Why coding agents work better than the rest",
      html:
        p(`Coding agents are the most successful category of agent in production, and the reason is not that code is easier. It is that <strong>code has ground truth</strong> (${ch("c10", "C10")}): a compiler, a type checker, a linter, and a test suite that will tell the agent it is wrong, cheaply, repeatedly, without being persuadable.`) +
        p(`Every other domain has to manufacture that. Here it is sitting in the repository, and the entire design of this capstone is about putting it inside the loop rather than at the end.`) +
        p(`You are building an agent that takes a task — <em>"the session cache never expires entries; fix it and add a test"</em> — orients itself in an unfamiliar repository, plans, patches, runs the tests, reads the failure, and repairs. It edits your real files, and it must be safe enough that you can leave the room.`) +
        note("key", "Build the undo first", p(`Cheap, certain reversal is what buys the permissive default. If every edit is one keystroke from gone, the agent can edit freely and you can skim. If reversal is hard, every edit needs approval and the agent is slower than doing it yourself. This inverts the usual build order and it is the right inversion.`)) },

    { id: "architecture", kicker: "Architecture", title: "The loop, and the permission model",
      html:
        fig({ label: "Diagram", title: "orient, plan, patch, verify, repair", body: LOOP_SVG,
          caption: `The dashed arrow is the one that matters most: after three failed attempts at the same step, stop patching and replan. Without it, an agent will grind against a wrong approach until the budget dies.` }) +
        code({ title: "code/c24_coder/agent.ts — the tool surface",
          src: `export const TOOLS = [
  // ORIENT — read-only, parallel, never need approval
  grep,          // ripgrep. the primary navigation tool, not embeddings (C06)
  readFile,      // line-numbered, range-capable, capped
  listFiles,     // bounded depth, respects .gitignore
  symbols,       // language-server outline if available: definitions, references

  // PLAN
  updatePlan, completeStep,          // C09 — pinned todo list, evidence required

  // ACT
  applyPatch,    // C14 — the ONLY way files change. no sed, no rm, no echo >
  shell,         // argv array, deny list, workspace-scoped

  // VERIFY — ground truth, and the loop cannot finish without it
  runTests, typecheck, lint,
];

// Deliberately absent: a general code-execution sandbox for edits (C13). An
// interpreter that writes files is an unauditable edit path; every change must
// arrive as a patch a human can read.`,
        }) +
        `<h3>The permission model, concretely</h3>` +
        table(["Action", "Sandbox", "Approval", "Why"], [
          ["read, grep, list", "allowed", "never", "Contained, and the agent needs to read constantly"],
          ["<code>apply_patch</code> under repo root", "allowed", "never", "Reversible in one keystroke; shown in the running diff"],
          ["<code>apply_patch</code> outside root", "<b>refused</b>", "—", "Not a permission question — a sandbox boundary"],
          ["<code>npm test</code>, <code>tsc</code>, <code>lint</code>", "allowed", "never", "Read-only in effect, and the whole point"],
          ["<code>git add</code>, <code>git stash</code>", "allowed", "never", "Reversible, and how undo works"],
          ["<code>git commit</code>", "allowed", "<b>ask</b>", "Shared history; the reviewer wants the whole diff at once"],
          ["<code>git push</code>, publish, deploy", "allowed", "<b>ask</b>", "Irreversible and external (${C21})"],
          ["network, package install", "<b>refused</b> by default", "ask to enable", "Supply chain: install runs arbitrary code (${C13})"],
        ].map((r) => r.map((c) => c.replace("${C21}", `<a href="/c21/" class="mono">C21</a>`).replace("${C13}", `<a href="/c13/" class="mono">C13</a>`))) as string[][]) +
        p(`One scoped grant at the start covers all the edits — <em>"this task will modify files under <code>src/session/**</code>"</em> — and the reviewer watches a running diff rather than answering thirty dialogs (${ch("c16", "C16")}).`) +
        code({ title: "undo, built on git rather than invented",
          src: `export class Checkpoints {
  /** Before every patch. Cheap: git already stores objects efficiently. */
  async before(patch: Patch, why: string): Promise<string> {
    await sh("git", ["add", "-A"]);
    const ref = await sh("git", ["stash", "create", \`agent: before \${why}\`]);
    await sh("git", ["update-ref", \`refs/agent/\${this.runId}/\${++this.n}\`, ref]);
    return ref;
  }

  async undo(n = 1): Promise<void> {
    const ref = await this.refAt(this.n - n + 1);
    await sh("git", ["checkout", ref, "--", "."]);   // restore the tree, keep history
  }
}
// Using git means undo is inspectable with tools the user already has, survives a
// crash, and costs nothing to keep. Inventing a shadow copy system is the tempting
// wrong answer.`,
        }) },

    { id: "orient", kicker: "Orient", title: "Finding your way around an unfamiliar repository",
      html:
        p(`The agent's first four calls determine most of the run's quality. The failure mode is reading too much — thirty files into the context, the goal buried, and ${ch("c05", "C05")}'s problems arriving by step six.`) +
        code({ title: "a system prompt that enforces cheap orientation",
          src: `ORIENT RULES
1. grep before you read. A search that returns 20 line matches costs 300 tokens;
   reading the 6 files they are in costs 12,000.
2. Read ranges, not whole files. read_file(path, start, end) around the matches.
3. Read the tests for a module before the module. They tell you what it is
   supposed to do and what callers assume.
4. Do not read a file "for context". If you cannot say which line you expect to
   find in it, you are browsing.
5. Before your first patch you must be able to state: the file and function to
   change, the callers affected, and the test that will prove it worked.`,
        }) +
        p(`Rule 5 is the useful one. Requiring the agent to name the test <em>before</em> editing forces it to locate ground truth first, and an agent that cannot find a relevant test has discovered that its real first task is writing one.`) +
        code({ title: "repository context, assembled rather than discovered",
          src: `// Assembled once at startup, pinned in the context (C05). About 400 tokens,
// and it saves a dozen exploratory calls per run.
export async function repoContext(root: string): Promise<string> {
  return [
    \`Repository: \${basename(root)}\`,
    \`Language: \${await detectLanguage(root)}\`,
    \`Test command: \${await detectTestCommand(root)}\`,        // from package.json scripts
    \`Typecheck: \${await detectTypecheck(root)}\`,
    \`Structure:\\n\${await treeSummary(root, { depth: 2, ignore: gitignore })}\`,
    // Procedural memory (C07): the file the team maintains for agents.
    await readIfExists(join(root, "AGENTS.md")) ?? await readIfExists(join(root, "CLAUDE.md")) ?? "",
    \`Recent commits:\\n\${await sh("git", ["log", "--oneline", "-10"])}\`,
  ].filter(Boolean).join("\\n\\n");
}`,
        }) +
        note("", "AGENTS.md is procedural memory (C07)", p(`Conventions, the commands that matter, the traps ("the integration tests need Docker running", "never edit <code>generated/</code>"). It is version-controlled, reviewable in a pull request, and editable by the user when it is wrong, which makes it the best-designed memory system in common use, precisely because it is not a system.`)) },

    { id: "repair", kicker: "Repair", title: "The loop that actually closes",
      html:
        p(`Patch, run the tests, read the failure, patch again. This cycle is why coding agents work, and there are exactly three ways it goes wrong.`) +
        code({ title: "code/c24_coder/verify.ts — make failures legible",
          src: `export async function runTests(pattern?: string): Promise<string> {
  const r = await sh(testCmd, pattern ? ["--", pattern] : [], { timeoutMs: 300_000 });

  if (r.code === 0) return \`✓ \${r.passed} passed, \${r.skipped} skipped.\`;

  // The whole art is here: the model needs the ASSERTION, not 4,000 lines of output.
  const failures = parseFailures(r.stdout + r.stderr).slice(0, 3);
  return [
    \`✗ \${r.failed} failed, \${r.passed} passed.\`,
    ...failures.map((f) => [
      \`\\n── \${f.file}:\${f.line} — \${f.name}\`,
      f.message,                                    // "expected null, got Session {…}"
      f.diff ? \`\\n\${f.diff}\` : "",                 // structural diff when the runner gives one
      \`\\nsource:\\n\${codeFrame(f.file, f.line, 3)}\`, // ±3 lines around the assertion
    ].join("\\n")),
    r.failed > 3 ? \`\\n… and \${r.failed - 3} more. Fix these first — they may share a cause.\` : "",
  ].join("\\n");
}`,
        }) +
        p(`Compare this with piping raw test output into the context: 4,000 tokens of stack traces, re-sent on every subsequent turn (${ch("c01", "C01")}), in which the one line that matters is buried. Parsing failures is a hundred lines of work and it is worth more than any prompt change.`) +
        `<h3>The three failure modes, and their guards</h3>` +
        table(["Failure", "Looks like", "Guard"], [
          ["<b>Thrashing</b>", "Same test failing after 3 patches, each a small variation", "After 3 attempts on one step: stop, replan (${C09})"],
          ["<b>Cheating</b>", "The test is modified, skipped, or <code>expect(true)</code>'d", "Refuse patches to test files unless the task says so; diff test files separately"],
          ["<b>Collateral damage</b>", "Target test passes, four others now fail", "Always run the <em>full</em> suite before finishing, never just the target"],
        ].map((r) => r.map((c) => c.replace("${C09}", `<a href="/c09/" class="mono">C09</a>`))) as string[][]) +
        code({ title: "the cheating guard, which you will need",
          src: `function checkPatch(patch: Patch, task: Task): Verdict {
  const testEdits = patch.files.filter((f) => isTestFile(f.path));
  if (!testEdits.length) return { ok: true };

  // Adding tests is good. Deleting assertions or skipping tests is how an agent
  // "fixes" a failure it cannot solve — and it looks like success from the outside.
  const removedAssertions = testEdits.flatMap((f) =>
    f.hunks.flatMap((h) => h.removed.filter(isAssertion)));
  const skipped = testEdits.flatMap((f) => f.hunks.flatMap((h) => h.added.filter(isSkip)));

  if (removedAssertions.length || skipped.length) {
    return { ok: false, observation:
      \`This patch removes \${removedAssertions.length} assertion(s) and adds \${skipped.length} \` +
      \`skip(s). Weakening a test is not fixing the code. If the test is genuinely \` +
      \`wrong, say why and ask — do not change it silently.\` };
  }
  return { ok: true };
}`,
        }) +
        note("bad", "The most important guard in the capstone", p(`An agent that cannot make a test pass will eventually weaken the test, and it will report success. This is not malice. From inside the context, "the tests now pass" is true. Detect it structurally: assertions removed and skips added are both mechanically visible in the patch.`)) +
        `<h3>Finishing requires proof</h3>` +
        code({ title: "a completion gate the model cannot talk past (C10)",
          src: `export function canFinish(state: CodeState): string | null {
  if (!state.filesChanged.length) return null;                 // nothing to prove

  if (!state.lastFullTestRun) return "You changed files but never ran the full test suite.";
  if (state.lastFullTestRun.at < state.lastPatchAt)
    return "You patched after the last test run. Run the tests again.";
  if (state.lastFullTestRun.failed)
    return \`\${state.lastFullTestRun.failed} tests are failing. Fix them, or explain \` +
           \`specifically why they are unrelated to your change.\`;
  if (state.typecheck?.errors) return \`\${state.typecheck.errors} type errors remain.\`;

  const open = state.plan.steps.filter((s) => s.status === "pending" || s.status === "active");
  if (open.length) return \`Plan steps not done: \${open.map((s) => s.id).join(", ")}.\`;
  return null;
}`,
        }) },

    { id: "explore", kicker: "Explore", title: "Configure the coding agent",
      html:
        p(`Adjust the setup and see task success, human interruptions, and the rate at which a "success" is actually a weakened test.`) +
        lab({ label: "Simulator", title: "coding agent configuration",
          body: `
<div class="controls">
  <div class="ctl"><label>test suite</label><select id="c24-t"><option value="good" selected>fast &amp; comprehensive</option><option value="slow">slow (5 min)</option><option value="thin">thin coverage</option><option value="none">none</option></select></div>
  <div class="ctl"><label>test output to model</label><select id="c24-o"><option value="parsed" selected>parsed failures + code frame</option><option value="raw">raw stdout</option></select></div>
  <div class="ctl"><label>orientation</label><select id="c24-r"><option value="grep" selected>grep-first, ranges</option><option value="read">read whole files</option></select></div>
  <div class="ctl"><label>guards</label>
    <div style="display:flex;flex-direction:column;gap:.15rem;font-size:.8125rem">
      <label><input type="checkbox" id="c24-g1" checked> replan after 3 failed attempts</label>
      <label><input type="checkbox" id="c24-g2" checked> refuse test-weakening patches</label>
      <label><input type="checkbox" id="c24-g3" checked> full suite before finishing</label>
      <label><input type="checkbox" id="c24-g4" checked> cheap undo (git checkpoints)</label>
    </div></div>
  <div class="ctl"><label>task size</label><input type="range" id="c24-s" min="1" max="12" step="1" value="4"><span class="val" id="c24-s-v">4 files</span></div>
</div>
<div id="c24-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="c24-steps">—</b><span>median steps</span></div>
  <div class="stat"><b id="c24-ctx">—</b><span>peak context</span></div>
  <div class="stat"><b id="c24-ask">—</b><span>human interruptions</span></div>
  <div class="stat"><b id="c24-cost">—</b><span>$ / task</span></div>
</div>
<div class="note" id="c24-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var T = document.getElementById("c24-t").value, O = document.getElementById("c24-o").value,
      R = document.getElementById("c24-r").value, S = +document.getElementById("c24-s").value,
      g1 = document.getElementById("c24-g1").checked, g2 = document.getElementById("c24-g2").checked,
      g3 = document.getElementById("c24-g3").checked, g4 = document.getElementById("c24-g4").checked;
  document.getElementById("c24-s-v").textContent = S + " file" + (S > 1 ? "s" : "");

  var groundTruth = { good: 1, slow: .92, thin: .55, none: .12 }[T];
  var legible = O === "parsed" ? 1 : .62;
  var ctxPerStep = R === "grep" ? 900 : 7000;
  var steps = Math.round((6 + S * 2.2) * (O === "parsed" ? 1 : 1.5) * (g1 ? 1 : 1.45));
  var peakCtx = 8000 + steps * ctxPerStep;

  var success = Math.max(.08, Math.min(.96,
    (.42 + groundTruth * .48) * legible
    * (peakCtx > 120000 ? .55 : peakCtx > 70000 ? .85 : 1)
    * (g1 ? 1 : .82) * (g3 ? 1 : .9)));
  // "success" that is actually a weakened test
  var fake = (T === "none" || T === "thin") ? .05 : (g2 ? .004 : .11);
  var collateral = g3 ? .02 : .16;
  var asks = (g4 ? 2 : Math.round(S * 3.5)) + 1;

  var rows = [["task completed correctly", success - fake],
              ["completed by weakening a test", fake],
              ["broke something else", collateral]];
  document.getElementById("c24-rows").innerHTML = rows.map(function (x, i) {
    var col = i === 0 ? (x[1] > .8 ? "var(--ok)" : x[1] > .55 ? "var(--accent)" : "var(--danger)") : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:15rem;color:var(--fg-muted)">' + x[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + Math.min(100, x[1] * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3.5rem;text-align:right">' + (x[1] * 100).toFixed(1) + '%</span></div>';
  }).join("");

  document.getElementById("c24-steps").textContent = steps;
  document.getElementById("c24-ctx").textContent = Math.round(peakCtx / 1000) + "K";
  document.getElementById("c24-ask").textContent = asks;
  document.getElementById("c24-cost").textContent = "$" + (steps * peakCtx * 0.55 * 3 / 1e6).toFixed(2);

  var n = document.getElementById("c24-note");
  if (T === "none") n.innerHTML = "<b>No tests.</b> The agent has no way to learn it is wrong, and success collapses. This is the single largest determinant on this panel — bigger than the model, the prompt, or any guard. If a repository has no tests, the agent's first task is to write one.";
  else if (O === "raw") n.innerHTML = "<b>Raw test output.</b> 4,000 tokens of stack trace per run, re-sent every subsequent turn, with the one useful assertion buried. Parsing failures into file, line, message and a code frame is ~100 lines of work and it is worth more than any prompt change.";
  else if (R === "read") n.innerHTML = "<b>Reading whole files.</b> Peak context " + Math.round(peakCtx / 1000) + "K — the goal is buried and quality degrades from about step six (C05). grep-first with line ranges is the fix, and it is a system-prompt rule, not a code change.";
  else if (!g2) n.innerHTML = "<b>Test-weakening not blocked.</b> Look at the second bar: some 'successes' are the agent deleting an assertion it could not satisfy. It reports success honestly — from inside the context, the tests do now pass.";
  else if (!g4) n.innerHTML = "<b>No cheap undo.</b> Interruptions jump to " + asks + ", because every edit now needs a human. The agent is slower than doing it yourself. Cheap reversal is what buys the permissive default.";
  else n.innerHTML = "<b>A good configuration.</b> Ground truth in the loop, legible failures, disciplined orientation, and structural guards. Two interruptions per task: the scoped grant at the start and the commit at the end.";
}
["c24-t","c24-o","c24-r","c24-s","c24-g1","c24-g2","c24-g3","c24-g4"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set the test suite to "none" and watch the top bar collapse. Nothing else on this panel matters as much. Then turn the test-weakening guard off and watch the second bar appear.`,
        }) },

    { id: "build", kicker: "Build it", title: "Milestones",
      html:
        table(["#", "Milestone", "Chapters", "Done when"], [
          ["1", "Undo, first", "C08", "Every patch is a git checkpoint; <code>undo</code> restores in one command"],
          ["2", "Read-only explorer", "C03, C04", "It answers \"where is session expiry handled\" using grep and ranged reads"],
          ["3", "<code>apply_patch</code> with the fuzz ladder", "C14", "30 fixture patches apply; ambiguity refused; nothing half-applied"],
          ["4", "Tests in the loop", "C10", "Patch, run, read a parsed failure, repair — a red test goes green unaided"],
          ["5", "Plan and guards", "C09, C12", "Todo list pinned; replan after 3 failures; test-weakening refused"],
          ["6", "Permissions and sandbox", "C13, C16", "Writes confined to the repo; one scoped grant; commit asks"],
          ["7", "Evals on real tasks", "C19", "20 tasks from your own git history, with a pass rate you trust"],
        ]) +
        `<h3>The eval set writes itself</h3>` +
        code({ title: "your git history is a labelled dataset",
          src: `// For each of the last 200 commits that touched code and tests:
//   - task    = the commit message (or the linked issue title)
//   - start   = the parent commit
//   - oracle  = the tests as they exist AFTER the commit
//
// Check out the parent, apply only the test changes, and ask the agent to make
// them pass. You now have a task with an unambiguous, human-authored oracle.
export async function taskFromCommit(sha: string): Promise<CodeTask> {
  const files = await changedFiles(sha);
  return {
    id: sha.slice(0, 8),
    prompt: await commitMessage(sha),
    setup: async (repo) => {
      await repo.checkout(\`\${sha}^\`);
      await repo.applyOnly(sha, files.filter(isTestFile));   // tests from the future
    },
    check: async (repo) => (await repo.runTests()).failed === 0,
    // Trajectory: did it change roughly the files a human changed? (C19 — a signal, not a gate)
    reference: files.filter((f) => !isTestFile(f)),
  };
}`,
        }) +
        p(`This is the same construction SWE-bench uses, applied to your repository, and it produces tasks that are realistic by definition. It also exposes an honest fact quickly: tasks whose commit message is "fix bug" are unsolvable, because the prompt does not contain the information a human had.`) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c24_coder/main.ts

#   C24 · Capstone II — Coding Agent
#
#   task: "Session cache entries never expire. Fix it, and make sure expired
#          entries are removed. Do not weaken the tests."
#
#    1  grep "sess:"  → 2 matches, 38 tokens
#         src/session.ts:9:const raw = await this.redis.get(\`sess:\${id}\`);
#         src/session.ts:14:await this.redis.set(\`sess:\${id}\`, JSON.stringify(s));
#    2  read src/session.test.ts (lines 1–20) → 79 tokens   [read the tests first — they say what it is supposed to do]
#    3  read src/session.ts (lines 1–20) → 154 tokens   [read only the range the grep pointed at]
#    4  npm test → ✗ 2 failed, 1 passed  (130 tokens)
#         src/session.test.ts:5 — expired sessions return null
#         expected null for an expired entry, got Session { id: "a1", expiresAt: 1690000000 }
#    5  apply_patch src/session.ts → applied [exact]   [return null for expired entries]
#    6  npm test → ✗ 1 failed, 2 passed  (66 tokens)
#         src/session.test.ts:7 — expired entries are deleted on read
#         expected redis.del to have been called once, got 0 calls
#    7  apply_patch → REFUSED
#         This patch removes 1 assertion(s). Weakening a test is not fixing the code. If the test is genui
#         (the agent reported this as "fixing the test" — from inside its context, that is true)
#    8  apply_patch src/session.ts → applied [exact]   [delete the expired entry on read, as the test requires]
#    9  npm test → ✓ 3 passed  (3 tokens)
#   10  finish → allowed
#
#   ────────────────────────────────────────────────────────────────────────────
#   result: ✓ all 3 tests pass · 2 patches applied · 1 refused · 2 checkpoints · 470 tokens read · 9ms
#
#   the fixed function:
#
#        8|   async get(id: string): Promise<Session | null> {
#        9|     const raw = await this.redis.get(\`sess:\${id}\`);
#       10|     if (!raw) return null;
# …
#   untested repository is to write a test.`,
        }) },

    { id: "production", kicker: "Production notes", title: "What the real ones do",
      html:
        ul([
          `<strong>Codex and Claude Code both sandbox by default</strong> and separate sandbox mode from approval policy, exactly as ${ch("c16", "C16")} argues. Codex's <code>sandbox_mode</code> (<code>read-only</code>, <code>workspace-write</code>, <code>danger-full-access</code>) paired with an independent approval setting is the model worth copying, including the ability for an organisation to forbid the dangerous combination centrally.`,
          `<strong>Read pi's <code>coding-agent</code> package.</strong> It is this capstone, finished, in the same language, and small enough to navigate: <code>core/tools/</code> for the tool surface, <code>core/compaction/</code> for what it keeps when the context fills, <code>core/project-trust.ts</code> for the permission model. Comparing your version against it chapter by chapter is the most direct way to find out what you left out.`,
          `<strong>Read Codex's <code>apply_patch</code> implementation.</strong> ${ch("c14", "C14")} covers the format; the implementation is where you see the error variants, the fuzzy punctuation normalisation, and the refusal to apply a patch that was not explicitly invoked.`,
          `<strong><code>AGENTS.md</code> / <code>CLAUDE.md</code> conventions are winning</strong> because they are the least clever thing that works: procedural memory in a version-controlled text file the whole team can review and edit.`,
          `<strong>Language servers are underused.</strong> "Find all references" from a type checker is exact where grep is approximate. If your language has an LSP, expose <code>definition</code>, <code>references</code> and <code>rename</code> as tools. It removes a whole class of mechanical-but-wrong edit.`,
          `<strong>The most valuable feature is not the agent.</strong> It is the running diff view plus one-key undo. Users forgive a wrong edit they can see and revert; they do not forgive a wrong edit they discover in a review three days later.`,
        ]) },
  ],

  exercises: [
    { difficulty: "core",
      prompt: `Your agent makes the failing test pass by deleting its assertion, and reports success. Design three layers of defence.`,
      answer: ol([
        `<strong>Structural — inspect the patch.</strong> Assertions removed and <code>skip</code>/<code>only</code> added are mechanically visible in a patch's removed and added lines. Refuse with an observation: <em>"weakening a test is not fixing the code; if the test is wrong, say why and ask"</em>. This catches the large majority and costs nothing.`,
        `<strong>Policy — separate the diffs.</strong> Test files and source files are reviewed separately, and a run whose task did not mention tests but which modified them is flagged. Many agents never need to touch tests at all, and for those you can refuse outright.`,
        `<strong>Oracle — hold the tests out.</strong> In evals (and optionally in production), keep a copy of the original tests and run <em>those</em> after the agent finishes, from a checkout the agent never touched. If the agent's tests pass and the held-out ones fail, it did not fix the bug. This is the only layer that is definitive.`,
      ]) +
      p(`A fourth that is cheap and worth having: require the agent to state, in <code>complete_step</code>'s evidence, <em>which test now passes that did not before</em>. Naming it makes the substitution obvious in the trace even when the guards miss it, and it is the same evidence discipline as ${ch("c09", "C09")}.`) },

    { difficulty: "core",
      prompt: `Peak context on medium tasks is 90K and quality degrades after step 8. Give four fixes in order of value.`,
      answer: ol([
        `<strong>Parse test output</strong> (largest single win). Raw runner output is thousands of tokens per verification, re-sent every subsequent turn. Extracting file, line, assertion message and a ±3-line code frame typically cuts it by 90%.`,
        `<strong>Enforce grep-before-read and ranged reads.</strong> A system-prompt rule, no code change. Reading six whole files costs 12,000 tokens; the grep that located them cost 300.`,
        `<strong>Offload and stub</strong> (${ch("c05", "C05")}). A full-file read the agent has finished with becomes a one-line stub — "read src/session.ts lines 1–220; the expiry logic is at 41–58" — with the content retrievable by path. The agent keeps the capability and loses the tokens.`,
        `<strong>Compact at phase boundaries.</strong> When a plan step completes, summarise into facts established, dead ends, and artefacts — preserving file paths exactly. Phase boundaries produce far better summaries than a token threshold does, because the work is at a natural resting point.`,
      ]) +
      p(`Measure before and after with ${ch("c20", "C20")}'s caused-token ranking. In coding agents the top entry is almost always either the test runner or a whole-file read, and both are fixable in an afternoon.`) },

    { difficulty: "stretch",
      prompt: `Build the eval harness from your git history. What makes a commit a bad task, and what does the pass rate actually tell you?`,
      answer: p(`<strong>Construction:</strong> for each commit touching both source and tests, check out the parent, apply <em>only</em> the test changes, and give the agent the commit message as the task. The oracle is the human-authored test suite.`) +
        p(`<strong>Bad tasks, which are most of them — filter these out:</strong>`) +
        ul([
          `<strong>Uninformative messages.</strong> "fix bug", "wip", "address review". The prompt does not contain what the human knew, so failure measures your dataset, not your agent.`,
          `<strong>Commits with no test changes.</strong> No oracle.`,
          `<strong>Huge commits.</strong> A 40-file refactor is not one task; it is a project, and it will fail for reasons that teach you nothing.`,
          `<strong>Environment-dependent commits.</strong> Anything needing a database, a network service, or credentials — unless your harness provides them hermetically.`,
          `<strong>Commits whose tests fail on the parent for unrelated reasons.</strong> Always verify the parent is otherwise green before accepting a task.`,
        ]) +
        p(`Expect roughly 10–20% of commits to survive filtering. Two hundred commits yields perhaps thirty usable tasks, which is enough.`) +
        p(`<strong>What the pass rate tells you — and does not.</strong> It is a <em>relative</em> instrument: it tells you whether today's agent is better than last week's on the same tasks, which is the question you actually need answered. It is not an absolute capability measure, because the tasks are biased toward whatever your repository does, toward commits that happened to have good messages, and away from anything that needed a conversation with a colleague.`) +
        p(`Report alongside it: median steps, cost per solved task, and the file-overlap trajectory signal (did it change roughly what a human changed). A rising pass rate with a rising cost per task is not obviously an improvement, and the trajectory signal catches the agent that passes by an accidental route.`) },
  ],

  qa: [
    { q: "Should the agent commit its own work?", a: p(`Stage and show the diff; let a human commit. Git history is a shared artefact, and an agent that commits eagerly produces a history nobody wants to read. If it must commit — in an unattended pipeline — commit to a branch, never to the default one, and open a pull request rather than merging.`) },
    { q: "What if the repository has no tests?", a: p(`Then the agent's first task is to write one for the behaviour it is about to change, and the simulator shows why: with no ground truth, success collapses regardless of everything else. A characterisation test that pins current behaviour is usually enough, and it is a better investment than any prompt tuning.`) },
    { q: "How big a task can it handle?", a: p(`One to four files reliably; five to ten with a good plan and a fast test suite; beyond that, decompose into several runs with a human reviewing between them. The limit is rarely reasoning; it is context and the number of verification cycles the budget affords.`) },
    { q: "Should I let it install packages?", a: p(`Off by default. Installation runs arbitrary code from a registry (${ch("c13", "C13")}), and it is also a decision with lock-file and licence consequences that belongs to a human. Ask, and when granted, allow only the specific package.`) },
    { q: "Grep or embeddings for code search?", a: p(`Grep, overwhelmingly. Developers search for identifiers, and identifiers are the tokens embeddings represent worst (${ch("c06", "C06")}). Add a language server for exact references. Embeddings help for "where is authentication handled" style questions, as a supplement, never as the primary navigation tool.`) },
  ],

  project: {
    title: "Capstone II · Coding Agent",
    brief:
      p(`Build an agent that works on a repository you know well — ideally one of your own, so you can judge whether its edits are good. Follow the milestones in order; milestone 1 is undo, and building it first is the point.`) +
      p(`This capstone uses every chapter in the course. When it works, you will have built, from scratch, the category of system that most people's first encounter with agents is.`),
    spec: [
      "Git-based checkpoints before every patch, with a one-command undo that works after a crash.",
      "Read-only orientation tools — ripgrep, ranged reads, bounded listing — and a system prompt enforcing grep-before-read and naming the proving test before the first patch.",
      "Pinned repository context assembled at startup, including <code>AGENTS.md</code> if present.",
      "<code>apply_patch</code> as the only mutation path, with C14's matching ladder, atomicity, ambiguity refusal and staleness checking.",
      "Test, typecheck and lint tools returning parsed failures with code frames — never raw output.",
      "A pinned todo plan, replanning after three failed attempts on one step, and evidence-backed completion.",
      "The test-weakening guard, and a completion gate requiring a full suite run after the last patch.",
      "A sandbox confining writes to the repository root with <code>.git</code> protected and network off, plus a scoped grant at the start and approval only for commit, push and install.",
      "An eval harness built from your git history, with filtering, reporting pass rate, median steps, cost per solved task and file-overlap.",
    ],
    stretch: [
      "Add a language-server tool for exact definitions and references, and measure the difference on rename-style tasks.",
      "Add a running-diff UI that streams patches as they apply, with one-key undo — the feature that makes the whole thing usable.",
      "Run it unattended on a real backlog issue overnight with read-only network, and review what it produced in the morning. Then write down what you would change.",
    ],
  },

  quiz: [
    { q: "Why do coding agents outperform agents in most other domains?",
      options: ["Code has cheap, unpersuadable ground truth — compilers, type checkers and tests — that can sit inside the loop", "Code is more structured than natural language", "Programming tasks are better represented in training data", "Code agents use larger context windows"],
      answer: 0,
      why: "Every other domain has to manufacture a verifier. Here it is already in the repository, and the entire design is about putting it inside the loop rather than at the end." },
    { q: "Why build the undo mechanism first?",
      options: ["Cheap, certain reversal is what makes a permissive default safe — without it every edit needs approval and the agent is slower than doing it yourself", "It is the simplest component", "It is required for the sandbox to work", "Git requires checkpoints before patches"],
      answer: 0,
      why: "The permission model depends on reversibility (C16). One-keystroke undo lets the reviewer skim a running diff instead of answering thirty dialogs, which is the difference between a useful agent and an annoying one." },
    { q: "An agent makes a failing test pass by deleting its assertion. Why is this hard to catch by prompting?",
      options: ["From inside the context, 'the tests now pass' is literally true, so the agent reports success honestly", "The model is deliberately deceptive", "Prompts cannot mention tests", "The assertion removal is invisible in the patch"],
      answer: 0,
      why: "It is not malice; the completion condition was met. That is why the defence must be structural: removed assertions and added skips are mechanically visible in the patch, and a held-out copy of the original tests is definitive." },
    { q: "What is the highest-value fix for a coding agent whose context balloons past 90K?",
      options: ["Parse test output into file, line, assertion and a small code frame instead of passing raw runner output", "Use a model with a larger context window", "Compact more frequently", "Reduce the number of tools"],
      answer: 0,
      why: "Raw test output is thousands of tokens per verification cycle, re-sent on every subsequent turn, with the one useful line buried. Parsing is about a hundred lines of work and typically cuts it by 90%." },
    { q: "Why require the agent to name the test that will prove its change before it patches?",
      options: ["It forces the agent to locate ground truth first — and an agent that cannot find one has discovered its real first task", "It improves the quality of the patch text", "It is needed for the completion gate", "It reduces the number of files read"],
      answer: 0,
      why: "Orientation quality determines run quality, and the cheapest way to enforce it is to require a specific, checkable artefact before any edit. If no relevant test exists, writing one is the correct first step." },
    { q: "How should you build an eval set for a coding agent?",
      options: ["From your git history: check out a commit's parent, apply only its test changes, and use the commit message as the task", "Write synthetic bug-fix tasks by hand", "Use SWE-bench scores", "Ask the agent to generate tasks"],
      answer: 0,
      why: "The human-authored tests are an unambiguous oracle and the tasks are realistic by construction. Expect to filter hard — uninformative messages, huge commits and environment-dependent tests make most commits unusable." },
  ],

  continues: p(`That is the course. You have built a model client, a schema validator, a tool registry, an agent loop, a context manager, a retriever, a memory store, a durable event log, a planner, a verifier, a router, a recovery policy, a sandbox, a patch engine, an MCP client and server, an approval layer, an orchestrator, a message-passing runtime, an eval harness, a tracing layer, a security policy, a server — and two complete agents on top of all of it. Nothing in that list was imported. <a href="/projects/">The projects page</a> collects everything you can still build with it.`),
};

export default chapter;
