/**
 * C18 · Skills — what a capability costs before it is used, and what
 * progressive disclosure does to that number.
 *   node --experimental-strip-types code/c18_skills.ts
 *
 * Three ways to give an agent forty capabilities: put every tool schema in the
 * context, name them and let it ask, or name them and let it read a file. The
 * accounting is deterministic. The selection model is a scripted stand-in with
 * a documented shape, so read it as an argument about cost, not a benchmark.
 */

/* ---------------------------------------------------------------- skills */

export interface Skill {
  name: string;
  /** The one line that goes in the system prompt. */
  description: string;
  /** The body the agent reads only after committing to the skill. */
  body: string;
  /** Tool schemas the skill brings with it, as JSON Schema text. */
  schemas: string[];
}

const schema = (name: string, fields: number): string =>
  JSON.stringify({
    name,
    description: `Perform the ${name.replace(/_/g, " ")} operation with the supplied arguments.`,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Array.from({ length: fields }, (_, i) => [
          `arg_${i}`,
          { type: "string", description: `The ${i === 0 ? "primary" : `auxiliary ${i}`} input for this operation.` },
        ])
      ),
      required: ["arg_0"],
    },
  });

const body = (name: string, lines: number): string =>
  [
    `# ${name}`,
    "",
    "## When to use",
    `Use this when the task involves ${name.replace(/_/g, " ")} and the workspace`,
    "already contains the inputs it needs.",
    "",
    "## Steps",
    ...Array.from({ length: lines }, (_, i) => `${i + 1}. Step ${i + 1} of the documented procedure.`),
    "",
    "## Notes",
    "Failure modes, argument quirks and the two flags nobody remembers.",
  ].join("\n");

const SKILL_NAMES = [
  "merge_pdfs", "split_pdf", "fill_pdf_form", "extract_tables",
  "resize_images", "convert_media", "transcribe_audio", "ocr_scan",
  "clean_csv", "join_datasets", "pivot_table", "detect_outliers",
  "plot_timeseries", "render_report", "build_slides", "export_xlsx",
  "query_warehouse", "profile_schema", "diff_snapshots", "validate_rows",
  "scrape_page", "crawl_site", "fetch_feed", "archive_url",
  "run_migration", "seed_fixtures", "rollback_release", "tail_logs",
  "lint_repo", "format_repo", "bump_versions", "tag_release",
  "sign_artifact", "scan_secrets", "audit_deps", "rotate_keys",
  "send_digest", "schedule_job", "page_oncall", "open_incident",
];

export const SKILLS: Skill[] = SKILL_NAMES.map((name, i) => ({
  name,
  description: `${name.replace(/_/g, " ")} — ${["for documents", "for media", "for tabular data", "for the warehouse", "for the web", "for releases", "for security", "for operations"][Math.floor(i / 5)]}.`,
  body: body(name, 6 + (i % 5)),
  schemas: Array.from({ length: 1 + (i % 3) }, (_, k) => schema(`${name}_${k}`, 2 + ((i + k) % 4))),
}));

/* ------------------------------------------------------------ accounting */

export const tokens = (s: string): number => Math.ceil(s.length / 3.5);

export interface Strategy {
  name: string;
  /** Tokens present in the context before the agent has done anything. */
  resident(skills: Skill[]): number;
  /** Tokens added when the agent commits to one skill. */
  onUse(skill: Skill): number;
  /** Extra round trips before the skill can be used. */
  extraTurns: number;
}

export const STRATEGIES: Strategy[] = [
  {
    name: "all schemas resident",
    // Every tool of every skill, in the system prompt, on every single call.
    resident: (ss) => ss.reduce((n, s) => n + s.schemas.reduce((m, x) => m + tokens(x), 0), 0),
    onUse: () => 0,
    extraTurns: 0,
  },
  {
    name: "names + descriptions",
    // One line per skill. The body and its schemas arrive when chosen.
    resident: (ss) => ss.reduce((n, s) => n + tokens(`- ${s.name}: ${s.description}`), 0),
    onUse: (s) => tokens(s.body) + s.schemas.reduce((m, x) => m + tokens(x), 0),
    extraTurns: 1,
  },
  {
    name: "names + read the file",
    // Same index, but the body is read with an existing file tool, so the
    // schemas never need to exist as schemas at all.
    resident: (ss) => ss.reduce((n, s) => n + tokens(`- ${s.name}: ${s.description}`), 0),
    onUse: (s) => tokens(s.body),
    extraTurns: 1,
  },
];

/* ----------------------------------------------------- selection quality */

/**
 * A stand-in for how reliably a model picks the right capability.
 *
 * Shape, not measurement: accuracy decays with how many options are in front
 * of it and improves with how much it can read about each. C03's simulator
 * makes the same argument for tools; this reuses it so the two chapters agree.
 */
export function selectionAccuracy(options: number, tokensPerOption: number): number {
  const crowding = 1 / (1 + Math.pow(options / 22, 2.1));
  const legibility = Math.min(1, 0.55 + 0.45 * Math.min(1, tokensPerOption / 26));
  return Math.max(0.05, Math.min(0.985, 0.35 + 0.65 * crowding * legibility));
}

/* ------------------------------------------------------------------ main */

const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w: number) => String(n).padStart(w);

function main(): void {
  const TURNS = 12;
  console.log(`\n  C18 · ${SKILLS.length} skills, three ways to offer them\n`);

  console.log(`  ${pad("strategy", 24)} ${pad("resident", 10)} ${pad("on use", 8)} ${pad("×12 turns", 11)} select`);
  console.log(`  ${"-".repeat(24)} ${"-".repeat(10)} ${"-".repeat(8)} ${"-".repeat(11)} ${"-".repeat(6)}`);

  const used = SKILLS[12];
  const rows = STRATEGIES.map((st) => {
    const resident = st.resident(SKILLS);
    const onUse = st.onUse(used);
    // Resident tokens are re-sent every turn (C01); the skill body is read once.
    const total = resident * TURNS + onUse;
    const perOption =
      st.name === "all schemas resident"
        ? Math.round(resident / SKILLS.length)
        : Math.round(tokens(`- ${used.name}: ${used.description}`));
    const acc = selectionAccuracy(
      st.name === "all schemas resident" ? SKILLS.reduce((n, s) => n + s.schemas.length, 0) : SKILLS.length,
      perOption
    );
    return { st, resident, onUse, total, acc };
  });

  for (const r of rows) {
    console.log(
      `  ${pad(r.st.name, 24)} ${num(r.resident, 10)} ${num(r.onUse, 8)} ${num(r.total, 11)} ${(r.acc * 100).toFixed(0).padStart(5)}%`
    );
  }

  const worst = rows[0];
  const best = rows[2];
  console.log(`\n  ${(worst.total / best.total).toFixed(0)}× the tokens over a ${TURNS}-turn run, for the same forty capabilities.`);
  console.log(`  The resident column is the one that matters: it is paid on every turn`);
  console.log(`  whether or not a skill is used, and ${SKILLS.length} skills of schemas is more`);
  console.log(`  context than most agents spend on the actual task.\n`);

  console.log(`  What the agent sees before it has chosen anything:\n`);
  for (const s of SKILLS.slice(0, 3)) console.log(`    - ${s.name}: ${s.description}`);
  console.log(`    … ${SKILLS.length - 3} more, one line each\n`);

  console.log(`  And after it commits to ${used.name}:\n`);
  console.log(used.body.split("\n").slice(0, 7).map((l) => `    ${l}`).join("\n"));
  console.log(`    …\n`);

  // Where the crossover sits: resident cost is linear in count, and a skill is
  // read at most once, so the break-even is about how many you actually use.
  console.log(`  Break-even, ${SKILLS.length} skills over ${TURNS} turns:\n`);
  console.log(`    ${pad("skills used in the run", 26)} ${pad("resident", 10)} progressive`);
  for (const usedCount of [1, 3, 8, 20, 40]) {
    const flat = worst.resident * TURNS;
    const prog = best.resident * TURNS + SKILLS.slice(0, usedCount).reduce((n, s) => n + best.st.onUse(s), 0);
    const mark = prog > flat ? "  ← resident finally wins" : "";
    console.log(`    ${pad(String(usedCount), 26)} ${num(flat, 10)} ${num(prog, 11)}${mark}`);
  }
  console.log(`\n  It does not win. Reading every skill in the catalogue still costs less`);
  console.log(`  than holding them resident, because a body is read once and a schema is`);
  console.log(`  re-sent ${TURNS} times. Progressive disclosure is not a compromise you make`);
  console.log(`  when the catalogue is large — it is cheaper at every size above one.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
