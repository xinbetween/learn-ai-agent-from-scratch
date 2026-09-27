import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ch } from "../../src/ui.ts";

export const SKILL_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Forty tool schemas resident in the context versus forty one-line descriptions with bodies read on demand">
  <defs>
    <marker id="k27" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
    <marker id="k27a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
  </defs>

  <text x="14" y="20" class="d-label">FORTY CAPABILITIES, TWO WAYS TO OFFER THEM</text>

  <text x="14" y="48" class="d-label" fill="var(--fg-faint)">EVERY SCHEMA RESIDENT</text>
  <rect x="14" y="58" width="300" height="86" rx="6" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="78" class="d-mono">{"name":"merge_pdfs","parameters":{…}}</text>
  <text x="26" y="94" class="d-mono">{"name":"split_pdf","parameters":{…}}</text>
  <text x="26" y="110" class="d-mono" fill="var(--fg-faint)">… 38 more, in full</text>
  <text x="26" y="132" class="d-mono" fill="var(--danger)">10,518 tokens · every turn</text>

  <text x="386" y="48" class="d-label" fill="var(--fg-faint)">NAMES ONLY</text>
  <rect x="386" y="58" width="300" height="86" rx="6" class="d-box-a"/>
  <text x="398" y="78" class="d-mono">- merge_pdfs: merge pdfs — documents</text>
  <text x="398" y="94" class="d-mono">- split_pdf: split pdf — documents</text>
  <text x="398" y="110" class="d-mono" fill="var(--fg-faint)">… 38 more, one line each</text>
  <text x="398" y="132" class="d-mono" fill="var(--ok)">534 tokens · every turn</text>

  <path d="M536 148 L536 186" class="d-arrow-a" marker-end="url(#k27a)"/>
  <text x="548" y="172" class="d-mono" fill="var(--accent)">only after it commits</text>

  <rect x="386" y="192" width="300" height="76" rx="6" class="d-box-t"/>
  <text x="398" y="212" class="d-mono">cat skills/plot_timeseries/SKILL.md</text>
  <text x="398" y="232" class="d-mono" fill="var(--fg-faint)">## When to use · ## Steps · ## Notes</text>
  <text x="398" y="254" class="d-mono" fill="var(--tool)">154 tokens · once</text>

  <rect x="14" y="192" width="300" height="76" rx="6" class="d-box" stroke-dasharray="3 3"/>
  <text x="164" y="228" class="d-text" text-anchor="middle" fill="var(--fg-faint)">nothing to read —</text>
  <text x="164" y="248" class="d-text" text-anchor="middle" fill="var(--fg-faint)">it was already all there</text>

  <text x="14" y="290" class="d-mono" fill="var(--accent)">a body is read once · a schema is re-sent on every turn (C01)</text>
</svg>`;

const chapter: Chapter = {
  id: "c27",
  num: 27,
  layer: "environment",
  title: "Skills",
  subtitle: "Giving an agent forty capabilities without putting forty schemas in its context",
  blurb:
    "A tool costs tokens before it is used and every turn after. A skill costs one line until the agent commits to it, and then it reads the rest itself. The pattern is progressive disclosure, and it is what lets a capability surface grow without the context growing with it.",
  lines: 214,
  file: "code/c27_skills.ts",
  tags: ["skills", "progressive disclosure", "tool registry", "context budget", "SKILL.md", "capability surface"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "The registry problem, from the other end",
      html:
        p(`${ch("c03", "C03")} showed selection accuracy collapsing past roughly twenty tools and offered three ways out: coarser facades, two-stage selection, or subagents. All three reduce how many options the model sees. None of them addresses the other half of the cost, which is that a tool you never call is still in the system prompt, and ${ch("c01", "C01")} bills it on every turn of the run.`) +
        p(`Forty capabilities with a few arguments each is about ten thousand tokens resident. Over a twelve-turn task that is a hundred and twenty thousand tokens spent on <em>describing</em> what the agent could do, against maybe eight thousand spent on the thing it actually did. The ratio is absurd and it is the normal state of a mature agent, because tools accumulate and nobody removes them.`) +
        p(`Skills invert the default. The context holds a name and one line per capability. When the agent decides it needs one, it reads the rest — from a file, with a tool it already has. Nothing about the capability is resident until it is chosen, and nothing about it is re-sent afterwards except what it actually used.`) +
        note(
          "key",
          "The asymmetry that makes it work",
          p(`A schema in the system prompt is paid on every turn. A skill body read from disk is paid once, and it enters the transcript as a tool result like any other. Progressive disclosure is not a compromise you accept when the catalogue is large; it is cheaper at every size above one.`)
        ),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "A directory, a front-matter header, and one line in the prompt",
      html:
        p(`A skill is a folder with a <code>SKILL.md</code> in it. The front matter carries exactly the two fields the agent needs in order to decide; the body carries everything it needs in order to act.`) +
        code({
          title: "skills/merge_pdfs/SKILL.md",
          lang: "text",
          plain: true,
          src: `---
name: merge_pdfs
description: Combine several PDFs into one, optionally selecting page ranges.
---

# merge_pdfs

## When to use
The task names two or more PDFs and asks for a single output, or asks to
extract pages from one document into another.

## When not to use
Splitting one PDF into many — use split_pdf, which handles bookmarks.

## Steps
1. Confirm every input path exists with \`ls\`.
2. Run \`python scripts/merge.py <out> <in...>\` from this directory.
3. The script prints the page count; check it against the sum of the inputs.

## Notes
Encrypted PDFs fail with a PdfReadError. Decrypt first with qpdf, and if
there is no password, say so rather than guessing.`,
        }) +
        p(`Only the first four lines of that file are ever resident. The agent's system prompt gets one entry — <code>- merge_pdfs: Combine several PDFs into one, optionally selecting page ranges.</code> — and an instruction telling it how to read the rest.`) +
        code({
          title: "what the model sees before it has chosen anything",
          lang: "text",
          plain: true,
          src: `## Available skills
Skills live in ./skills. Read a skill's SKILL.md before using it.

- merge_pdfs: Combine several PDFs into one, optionally selecting page ranges.
- clean_csv: Normalise headers, types and missing values in a CSV.
- query_warehouse: Run read-only SQL against the analytics warehouse.
… 37 more, one line each

To use a skill:  cat skills/<name>/SKILL.md`,
        }) +
        `<h3>Why this is not just a smaller tool description</h3>` +
        p(`Two things change, and the second is the one people miss.`) +
        ul([
          `<strong>The body is unbounded.</strong> A tool description is a field in a schema that you are reluctant to grow, because it is resident. A skill body is read on demand, so it can carry the three paragraphs of hard-won detail that actually make the capability work — the failure modes, the flag nobody remembers, the check to run afterwards. ${ch("c03", "C03")} argued that description quality is the highest-value work in a tool surface; skills are what happens when that work stops being taxed.`,
          `<strong>A skill can carry files.</strong> The folder holds scripts, templates, reference data, fixtures. The agent does not need a tool per artefact because it has a shell and a filesystem (${ch("c14", "C14")}) and can simply use them. A skill is a capability packaged the way a human colleague would package one: here is the folder, the README explains it.`,
        ]) +
        note(
          "",
          "This requires a sandbox and a file tool",
          p(`Skills are not an alternative to ${ch("c13", "C13")} and ${ch("c14", "C14")}; they are built on them. The mechanism is "read a file, then run something", which means the agent needs both capabilities and the security posture that comes with them. An agent with no shell cannot use skills, and an agent with an unsandboxed shell should not be reading skill folders it did not author.`)
        ),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "What it costs, measured",
      html:
        fig({
          label: "Diagram",
          title: "resident cost versus read-on-demand",
          body: SKILL_SVG,
          caption: `The left column is paid twelve times in a twelve-turn run. The right column is paid twelve times for the index and once for the body the agent actually used.`,
        }) +
        `<h3>Forty skills, three strategies</h3>` +
        table(
          ["Strategy", "Resident", "On use", "×12 turns", "Selection"],
          [
            ["all schemas resident", "10,518", "0", "126,216", "39%"],
            ["names + descriptions", "534", "253", "6,661", "47%"],
            ["names + read the file", "534", "154", "6,562", "47%"],
          ]
        ) +
        p(`Nineteen times the tokens for the same forty capabilities. The selection column moves too, and for the reason ${ch("c03", "C03")} gave: the model is choosing among forty named things instead of the eighty-odd individual tool schemas those skills contain, and fewer, better-separated options select better.`) +
        `<h3>The break-even that is not there</h3>` +
        p(`The obvious objection is that progressive disclosure must lose once the agent uses enough skills, because each one costs an extra read. It does not, and the table is worth staring at:`) +
        table(
          ["Skills used in the run", "All resident", "Progressive"],
          [
            ["1", "126,216", "6,536"],
            ["3", "126,216", "6,827"],
            ["8", "126,216", "7,589"],
            ["20", "126,216", "9,452"],
            ["<b>40 — every skill in the catalogue</b>", "<b>126,216</b>", "<b>12,484</b>"],
          ]
        ) +
        p(`Reading every skill you have still costs a tenth of holding them resident, because a body is read once and a schema is re-sent on every turn. There is no crossover. The only configuration where residency wins is a catalogue of one.`) +
        `<h3>The cost that is real</h3>` +
        ul([
          `<strong>A round trip.</strong> The agent reads the skill, then acts, so every first use of a skill costs one extra turn. On a twelve-turn task that is eight percent more latency for the turn it happens on, and it happens once per skill per run.`,
          `<strong>A chance to choose wrong.</strong> The model commits based on one line. If the line is bad it reads the wrong file, discovers the mistake, and reads another — recoverable, but it has now spent two round trips. The description is doing the work the whole tool schema used to do, so it has to be better, not shorter.`,
          `<strong>A dependency on the agent following instructions.</strong> "Read SKILL.md before using a skill" is a prompt instruction, not a guard. Models mostly comply and occasionally guess at a skill's interface from its name. If that guess is expensive, make the skill's entry point refuse to run without a flag that only the SKILL.md mentions.`,
        ]),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Find the size where residency stops being defensible",
      html:
        p(`Everything here is a trade between what is resident and what is read. Move the catalogue size and the run length and watch which side of the line you are on.`) +
        lab({
          label: "Simulator",
          title: "resident schemas versus progressive disclosure",
          body: `
<div class="controls">
  <div class="ctl"><label>capabilities</label>
    <input type="range" id="k27-n" min="1" max="120" step="1" value="40">
    <span class="val" id="k27-n-v">40</span></div>
  <div class="ctl"><label>turns in the run</label>
    <input type="range" id="k27-turns" min="1" max="40" step="1" value="12">
    <span class="val" id="k27-turns-v">12</span></div>
  <div class="ctl"><label>used in the run</label>
    <input type="range" id="k27-used" min="0" max="20" step="1" value="2">
    <span class="val" id="k27-used-v">2</span></div>
  <div class="ctl"><label>tokens per schema</label>
    <input type="range" id="k27-size" min="60" max="600" step="10" value="260">
    <span class="val" id="k27-size-v">260</span></div>
</div>
<div id="k27-verdict" class="note" style="margin-top:0"></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:1rem">
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">all resident</div>
    <div class="meter"><i id="k27-rbar" style="width:0%;background:var(--danger)"></i></div>
    <div class="mono small muted" id="k27-rv">—</div>
  </div>
  <div>
    <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">progressive</div>
    <div class="meter"><i id="k27-pbar" style="width:0%"></i></div>
    <div class="mono small muted" id="k27-pv">—</div>
  </div>
</div>
<div class="stats">
  <div class="stat"><b id="k27-ratio">—</b><span>token ratio</span></div>
  <div class="stat"><b id="k27-sel-r">—</b><span>select · resident</span></div>
  <div class="stat"><b id="k27-sel-p">—</b><span>select · skills</span></div>
  <div class="stat"><b id="k27-extra">—</b><span>extra turns</span></div>
</div>`,
          script: `
var n = document.getElementById("k27-n"), turns = document.getElementById("k27-turns");
var used = document.getElementById("k27-used"), size = document.getElementById("k27-size");

function accuracy(options, perOption) {
  var crowding = 1 / (1 + Math.pow(options / 22, 2.1));
  var legibility = Math.min(1, 0.55 + 0.45 * Math.min(1, perOption / 26));
  return Math.max(0.05, Math.min(0.985, 0.35 + 0.65 * crowding * legibility));
}

function run() {
  var N = +n.value, T = +turns.value, U = Math.min(+used.value, N), S = +size.value;
  document.getElementById("k27-n-v").textContent = N;
  document.getElementById("k27-turns-v").textContent = T;
  document.getElementById("k27-used-v").textContent = U;
  document.getElementById("k27-size-v").textContent = S;

  var LINE = 13, BODY = 150;
  var resident = N * S * T;
  var progressive = N * LINE * T + U * BODY;

  document.getElementById("k27-rv").textContent = Math.round(resident).toLocaleString() + " tok";
  document.getElementById("k27-pv").textContent = Math.round(progressive).toLocaleString() + " tok";
  var mx = Math.max(resident, progressive);
  document.getElementById("k27-rbar").style.width = (resident / mx * 100) + "%";
  document.getElementById("k27-pbar").style.width = (progressive / mx * 100) + "%";

  var ratio = resident / Math.max(1, progressive);
  document.getElementById("k27-ratio").textContent = ratio >= 1 ? ratio.toFixed(1) + "×" : ratio.toFixed(2) + "×";
  document.getElementById("k27-sel-r").textContent = (accuracy(N * 2, S / 8) * 100).toFixed(0) + "%";
  document.getElementById("k27-sel-p").textContent = (accuracy(N, LINE) * 100).toFixed(0) + "%";
  document.getElementById("k27-extra").textContent = "+" + U;

  var v = document.getElementById("k27-verdict");
  if (N === 1) v.innerHTML = "<b>One capability: just use a tool.</b> Skills exist to keep a catalogue off the context budget. With a catalogue of one there is nothing to keep off, and you have added a round trip for nothing.";
  else if (T === 1) v.innerHTML = "<b>A single-turn run is the one honest case for residency.</b> Nothing is re-sent, so the schemas are paid once — and the skill still has to be read. Almost no agent task is one turn, which is why this configuration is hard to find in practice.";
  else if (ratio > 8) v.innerHTML = "<b>Not close.</b> At " + N + " capabilities over " + T + " turns the resident schemas cost " + ratio.toFixed(0) + "× what the skills do. The catalogue is being re-sent " + T + " times to support " + U + " actual uses.";
  else if (ratio > 1.5) v.innerHTML = "<b>Skills win, comfortably.</b> Worth noting <em>why</em>: it is the turn count doing the work, not the catalogue size. Drag turns down and watch the advantage shrink far faster than it does when you drag capabilities down.";
  else v.innerHTML = "<b>Close enough that it is a judgement call.</b> Small catalogue, short run. Pick on latency instead: residency costs no extra round trips, and at this scale that is the difference that will be felt.";
}
[n, turns, used, size].forEach(function (el) { el.addEventListener("input", run); });
run();`,
          caption: `Set capabilities to 1 — skills lose, and should. Then set turns to 1, which is the only other configuration where residency competes. Everything between those two corners belongs to progressive disclosure, and the variable driving it is the turn count rather than the catalogue size.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "Discovery, the index, and the read",
      html:
        p(`The implementation is three small functions and a convention. Nothing about it is clever, which is the point — a skill is a folder, and the agent already knows how to read folders.`) +
        code({
          title: "code/c27_skills.ts — the index that goes in the prompt",
          src: `export interface Skill {
  name: string;
  /** The one line that goes in the system prompt. */
  description: string;
  /** The body the agent reads only after committing to the skill. */
  body: string;
  /** Tool schemas the skill brings with it, as JSON Schema text. */
  schemas: string[];
}

// Discovery: every directory under skills/ with a parseable SKILL.md.
// Front matter supplies name and description; a folder missing either is
// skipped rather than half-registered, because a skill with no description
// is a skill the model cannot choose deliberately.`,
        }) +
        p(`The accounting in the file separates the two costs that behave differently, which is the whole analysis:`) +
        code({
          title: "the two costs",
          src: `export const STRATEGIES: Strategy[] = [
  {
    name: "all schemas resident",
    // Every tool of every skill, in the system prompt, on every single call.
    resident: (ss) => ss.reduce((n, s) => n + s.schemas.reduce((m, x) => m + tokens(x), 0), 0),
    onUse: () => 0,
    extraTurns: 0,
  },
  {
    name: "names + read the file",
    // Same index, but the body is read with an existing file tool, so the
    // schemas never need to exist as schemas at all.
    resident: (ss) => ss.reduce((n, s) => n + tokens(\`- \${s.name}: \${s.description}\`), 0),
    onUse: (s) => tokens(s.body),
    extraTurns: 1,
  },
];

// Resident tokens are re-sent every turn (C01); the skill body is read once.
const total = resident * TURNS + onUse;`,
        }) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c27_skills.ts

#   C27 · 40 skills, three ways to offer them
#
#   strategy                 resident   on use   ×12 turns   select
#   ------------------------ ---------- -------- ----------- ------
#   all schemas resident          10518        0      126216    39%
#   names + descriptions            534      253        6661    47%
#   names + read the file           534      154        6562    47%
#
#   19× the tokens over a 12-turn run, for the same forty capabilities.
#   The resident column is the one that matters: it is paid on every turn
#   whether or not a skill is used, and 40 skills of schemas is more
#   context than most agents spend on the actual task.
#
#   What the agent sees before it has chosen anything:
#
#     - merge_pdfs: merge pdfs — for documents.
#     - split_pdf: split pdf — for documents.
#     - fill_pdf_form: fill pdf form — for documents.
#     … 37 more, one line each
#
#   And after it commits to plot_timeseries:
#
#     # plot_timeseries
#
#     ## When to use
#     Use this when the task involves plot timeseries and the workspace
#     already contains the inputs it needs.
#
#     ## Steps
#     …
#
#   Break-even, 40 skills over 12 turns:
# …
#   when the catalogue is large — it is cheaper at every size above one.`,
        }) +
        note(
          "good",
          "Writing a skill is writing documentation",
          p(`The best thing about this pattern is what it does to the authoring experience. A tool description is a cramped field you are reluctant to grow. A <code>SKILL.md</code> is a document — you write the "when not to use" section, the failure modes and the gotcha about encrypted files, because there is no budget pressure telling you not to. The capability gets better because the format stopped punishing detail.`)
        ),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Field notes",
      html:
        ul([
          `<strong>Claude Code and pi both ship this.</strong> Both discover skills from directories, both put a name and description in the prompt, both expect the agent to read the file before acting. Convergent design across independent implementations is the strongest signal available that a shape is right, and it matches the Manning course's <code>SKILL.md</code> treatment almost line for line.`,
          `<strong>Scope skills the way you scope config.</strong> Personal, project and organisation-level directories, resolved in that order with the nearest winning. This is ${ch("c07", "C07")}'s memory scoping applied to capabilities, and it has the same failure mode: a skill that should have been personal leaking into a shared context, or a project skill silently overriding an org one nobody knew existed.`,
          `<strong>A skill folder is executable content, so it is a supply chain.</strong> ${ch("c21", "C21")} covers this for project config, and skills are the sharpest instance: a <code>SKILL.md</code> is instructions the model will follow, and the scripts beside it are code it will run. Cloning a repository with a skills directory and pointing an agent at it is an install, not a read. Review third-party skills the way you would review a dependency.`,
          `<strong>Measure first-use rate, not just usage.</strong> ${ch("c20", "C20")} should tell you how often a skill is read and then <em>not</em> used, which is the signal that its description promises the wrong thing. A skill read in 40% of runs and used in 5% is a description bug, and it is invisible if you only count invocations.`,
          `<strong>Do not convert every tool into a skill.</strong> The pattern pays for capabilities that are occasional, documented and self-contained. The four tools the agent uses on every single task should stay resident — they are paid on every turn either way, and making the agent read a file first just adds a round trip to the hot path.`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `The break-even table shows progressive disclosure winning even when the agent uses all forty skills. Explain why, in one sentence, using ${ch("c01", "C01")}'s billing rule.`,
      answer:
        p(`A resident schema is re-sent on every turn of the run, so forty schemas over twelve turns are billed four hundred and eighty times; a skill body is read once and then sits in the transcript like any other tool result, so forty bodies are billed forty times plus their own re-sends from the point they were read.`) +
        p(`The general form is worth keeping: <strong>residency multiplies by turns, reading multiplies by uses.</strong> Since turns exceed uses in almost every real task, the asymmetry is structural rather than a matter of tuning.`),
    },
    {
      difficulty: "core",
      prompt: `Write the <code>SKILL.md</code> for a capability you have shipped as a tool, and name three things you put in it that would never have fitted in a tool description.`,
      answer:
        p(`The exercise is the point rather than the artefact, so here is the shape and the three categories that reliably appear.`) +
        code({
          title: "the shape",
          lang: "text",
          plain: true,
          src: `---
name: query_warehouse
description: Run read-only SQL against the analytics warehouse.
---

## When not to use
Anything needing today's data — the warehouse lags by up to 6 hours.
Use the operational read-replica skill for anything time-sensitive.

## Steps
1. Check the schema first: \`python scripts/describe.py <table>\`.
2. Queries are killed at 30s. Add a LIMIT while exploring.
3. Results over 1000 rows are written to results.csv, not returned.

## Notes
- event_time is UTC; every other timestamp column is local. This has
  caused three incidents.
- The orders table has soft deletes. Filter deleted_at IS NULL or your
  numbers will be quietly wrong rather than obviously wrong.`,
        }) +
        ul([
          `<strong>Negative guidance with a reason.</strong> "Not for today's data, because it lags six hours" needs a clause and a justification. In a tool description it competes for space with the arguments and usually loses.`,
          `<strong>Operational limits.</strong> The 30-second kill and the 1000-row spill are things the agent discovers by failing. Documented, they cost nothing; undocumented, they cost a wasted turn each.`,
          `<strong>Domain traps.</strong> Soft deletes and mixed timezones are exactly the knowledge that makes the difference between a right answer and a plausible one, and they are the first thing cut when a description has to be short.`,
        ]),
    },
    {
      difficulty: "core",
      prompt: `An agent reads <code>merge_pdfs/SKILL.md</code> in 40% of runs but actually merges a PDF in 5%. Diagnose it, and say what you would change.`,
      answer:
        p(`The description is promising something it does not deliver. The model is committing a round trip on the strength of one line, discovering the skill is not what it wanted, and moving on — so the cost is real and the benefit is not.`) +
        p(`Three candidate causes, in the order worth checking:`) +
        ul([
          `<strong>The name is broader than the capability.</strong> "merge_pdfs" reads as the general document-combining skill, so it gets opened for "combine these reports" when the reports are Word files. Fix by narrowing the description rather than the name: <em>merge PDF files specifically; does not convert other formats</em>.`,
          `<strong>A neighbouring skill is missing.</strong> If there is no <code>convert_to_pdf</code>, the model reaches for the nearest thing. The read is rational; your catalogue has a hole, and the 35% gap is telling you where.`,
          `<strong>The description is the whole interface and it is too short.</strong> ${ch("c03", "C03")}'s "when not to use" clause matters more here than in a tool schema, because there is no schema underneath to disambiguate. One line naming what it refuses usually closes most of the gap.`,
        ]) +
        p(`The measurement itself is the lesson: ${ch("c20", "C20")} should record skill reads separately from skill uses. Counting only invocations makes this failure invisible, and it is the most common way a skill catalogue degrades.`),
    },
    {
      difficulty: "stretch",
      prompt: `Design skill scoping across personal, project and organisation directories. Handle precedence, name collisions, and the security question of a project skill shadowing an org one.`,
      answer:
        p(`Resolution is the easy half and the security question is the real one.`) +
        code({
          title: "resolution",
          lang: "text",
          plain: true,
          src: `~/.agent/skills/          personal    — highest precedence
./.agent/skills/          project     — middle
/etc/agent/skills/        org         — lowest, but see below

Same name at two levels: the nearer one wins and the shadowing is
recorded, not silent. The index shown to the model lists each name once.`,
        }) +
        ul([
          `<strong>Precedence must be visible.</strong> A project skill silently overriding an org one is how a team ends up running a different <code>deploy</code> than they think. Log the shadowing at load, and surface it in the index the model sees: <em>deploy (project; overrides org)</em>.`,
          `<strong>Some skills must not be shadowable.</strong> Anything the organisation ships for compliance — an approval wrapper, an audit logger, a redaction step — should be markable as final. A project directory that tries to shadow one gets a load error rather than a quiet win. This is a policy decision encoded in code, which is ${ch("c16", "C16")}'s argument about not trusting a setting a tired user can flip.`,
          `<strong>Project skills are untrusted by default.</strong> They arrive with the repository, so they are ${ch("c21", "C21")}'s first circle: instructions the model will follow, and scripts it will run, authored by whoever wrote the repo. Load them only inside a trusted workspace, and treat enabling them as the same decision as enabling a project's build hooks — because mechanically it is.`,
        ]) +
        p(`The subtle one: an attacker who can add a file to a repository can add a skill whose description is attractive for a common task and whose body instructs the agent to do something else. The defence is not scanning the body, which is a losing game; it is that project skills only load in a workspace someone has trusted, and that a skill cannot shadow a protected name.`),
    },
  ],

  qa: [
    {
      q: "Is a skill just a prompt fragment with extra steps?",
      a: p(`Partly, and the extra steps are what make it useful. A prompt fragment you inject is resident and unconditional; a skill is read when chosen, so it can be ten times longer for a tenth of the cost. And a skill is a folder, so it can carry scripts, templates and fixtures that a prompt fragment cannot. The mechanism is unremarkable — that is a feature, since it means an agent with a shell already supports it.`),
    },
    {
      q: "What stops the agent using a skill without reading it?",
      a: p(`Nothing structural, and you should assume it will occasionally guess from the name. Mostly that is harmless; where it is not, make the entry point refuse. A script that requires a flag documented only in the SKILL.md turns a guess into a clear error rather than a wrong result, and the error is an observation the agent recovers from (${ch("c03", "C03")}).`),
    },
    {
      q: "Skills or MCP?",
      a: p(`Different problems. ${ch("c15", "C15")} standardises how a tool gets to your agent across a process boundary; skills change what it costs to have a capability available before it is used. They compose — an MCP server's tools can be wrapped as a skill so their schemas stop being resident, which is a reasonable answer to the "one server, forty tools" problem that chapter raises.`),
    },
    {
      q: "How many skills is too many?",
      a: p(`The token answer is that there is no practical limit; the selection answer is that you are back to ${ch("c03", "C03")}'s curve, just with cheaper options. At a few hundred one-line entries the index itself becomes a crowded registry and the model starts picking badly. At that scale, group them: a short index of categories, and a skill per category that lists its own members. That is the same progressive disclosure one level up, and it is what hierarchical tool structures are.`),
    },
    {
      q: "Does this work without a sandbox?",
      a: p(`Not safely. The mechanism is read-a-file-then-run-something, which needs ${ch("c13", "C13")} and ${ch("c14", "C14")} underneath it. You could implement a read-only variant where skills contain instructions but no executables, and it would still pay for itself on the token accounting — but the version worth having ships scripts, and shipping scripts means running them.`),
    },
  ],

  project: {
    title: "Project · Convert a tool surface into a skill catalogue",
    brief:
      p(`Take an agent with a dozen or more tools and move the occasional ones behind skills. Then measure the two things that decide whether it was worth it: resident tokens per turn, and how often a skill is read without being used.`),
    spec: [
      "A <code>skills/</code> directory where each skill is a folder with a <code>SKILL.md</code> carrying <code>name</code> and <code>description</code> front matter.",
      "Discovery that skips folders missing either field, loudly rather than silently, and a generated index of one line per skill in the system prompt.",
      "The four tools used on nearly every task stay resident; everything occasional moves behind a skill.",
      "At least one skill that ships a script beside its <code>SKILL.md</code>, invoked from the documented steps.",
      "Instrumentation recording skill reads and skill uses as separate events, with the ratio reported per skill.",
      "A before/after measurement of resident tokens per turn and total tokens for a representative task.",
    ],
    stretch: [
      "Add personal/project/org scoping with nearest-wins precedence, shadowing recorded at load and surfaced in the index.",
      "Mark one org skill as non-shadowable and prove a project directory cannot override it.",
      "Group skills into categories once the index passes fifty entries, and measure whether selection accuracy recovers.",
    ],
  },

  quiz: [
    {
      q: "Why does progressive disclosure still win when the agent uses every skill in the catalogue?",
      options: [
        "Residency multiplies by turns while reading multiplies by uses, and turns exceed uses in almost every task",
        "Skill bodies are compressed before being read",
        "The model caches skill bodies between runs",
        "Reading a file is free because it uses an existing tool",
      ],
      answer: 0,
      why:
        "Forty schemas over twelve turns are billed four hundred and eighty times. Forty bodies read once are billed forty times plus their re-sends from the point of reading. The asymmetry is structural, which is why the break-even table has no crossover.",
    },
    {
      q: "What is the real cost of the skills pattern?",
      options: [
        "One extra round trip on first use of each skill, and a decision made from one line of description",
        "Higher token cost once the catalogue passes about twenty skills",
        "Loss of structured arguments, since skills have no schema",
        "The inability to use skills alongside ordinary tools",
      ],
      answer: 0,
      why:
        "The token accounting favours skills at every catalogue size above one. What you actually pay is latency — a read before the first use — and the risk that a one-line description is not enough to choose correctly, which is why that line has to be better than a tool description, not shorter.",
    },
    {
      q: "A skill is read in 40% of runs and used in 5%. What does that indicate?",
      options: [
        "Its description promises something it does not deliver, or a neighbouring capability is missing from the catalogue",
        "The skill body is too long",
        "The agent is ignoring the system prompt",
        "Selection accuracy is fine; reads are free",
      ],
      answer: 0,
      why:
        "Each of those reads is a wasted round trip taken on the strength of one line. Either the description is broader than the capability, or the model is reaching for the nearest thing because what it wanted does not exist. Tracking reads separately from uses is what makes the failure visible at all.",
    },
    {
      q: "Why is a third-party skill folder a supply-chain concern?",
      options: [
        "SKILL.md is instructions the model will follow and the scripts beside it are code it will run, so adding one is an install rather than a read",
        "Skills can exhaust the context window",
        "Skill names can collide with tool names",
        "Skills bypass the approval layer by design",
      ],
      answer: 0,
      why:
        "This is C21's project-config argument at its sharpest. Cloning a repository with a skills directory and pointing an agent at it executes whatever that directory declares. Review third-party skills like dependencies, and load project skills only inside a workspace someone has trusted.",
    },
    {
      q: "Which capabilities should stay as resident tools rather than becoming skills?",
      options: [
        "The few used on nearly every task, since they are paid every turn either way and a read just adds latency to the hot path",
        "The ones with the longest documentation",
        "The ones that require approval",
        "The ones provided over MCP",
      ],
      answer: 0,
      why:
        "Skills pay for capabilities that are occasional. Something invoked on every task is resident in effect whichever way you model it, so making the agent read a file first buys nothing and costs a round trip at the start of every run.",
    },
    {
      q: "What happens to a skill catalogue at a few hundred entries?",
      options: [
        "The index becomes a crowded registry and selection degrades, so the fix is to group skills and disclose the groups progressively",
        "Token cost overtakes resident schemas",
        "Front-matter parsing becomes the bottleneck",
        "Nothing; skills scale indefinitely",
      ],
      answer: 0,
      why:
        "The token problem is solved but C03's selection curve is not. Several hundred one-line entries is still several hundred options. The answer is the same pattern applied one level up: an index of categories, each of which lists its own members — which is what a hierarchical tool structure is.",
    },
  ],

  continues:
    p(`A skill is a capability the agent reads about before using. ${ch("c16", "C16")} is the other half of that arrangement: the capabilities it should not be allowed to use without asking a person first, and how to decide which those are without asking about everything.`),
};

export default chapter;
