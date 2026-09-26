/**
 * Detect Chinese translations that have gone stale.
 *
 * A translated chapter spreads the English one and overrides the parts it
 * translates. That makes two kinds of section:
 *
 *   inherited — `{ ...explore }`, byte-identical to the English. Edits to the
 *               English flow through on their own, and nothing can drift.
 *   translated — its own prose. An edit to the English side changes nothing
 *               here, and the build still passes, because the shape checks
 *               only count sections, exercises and quiz answers.
 *
 * So the second kind drifts silently: the English gains a paragraph, the
 * Chinese quietly stops saying the same thing, and the only way to find out
 * is to read both. This records a hash of the English source for every
 * translated field and fails when one of them moves.
 *
 *   npm run lock           refresh the lockfile after re-translating
 *   npm run lock -- --check  fail if any translated field is out of date (CI)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Chapter } from "../src/types.ts";
import { chapters } from "../content/chapters/index.ts";
import { zhChapters } from "../content/zh/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = join(ROOT, "content/zh/translation-lock.json");

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

/** Every translatable field, flattened to `id → text`, for one chapter. */
function fields(c: Chapter): Record<string, string> {
  const out: Record<string, string> = {
    title: c.title,
    subtitle: c.subtitle,
    blurb: c.blurb,
    continues: c.continues ?? "",
    "project.brief": c.project.brief,
    "project.title": c.project.title,
  };
  for (const s of c.sections) out[`section.${s.id}`] = s.html;
  c.exercises.forEach((e, i) => {
    out[`exercise.${i}.prompt`] = e.prompt;
    out[`exercise.${i}.answer`] = e.answer;
  });
  c.qa.forEach((x, i) => {
    out[`qa.${i}.q`] = x.q;
    out[`qa.${i}.a`] = x.a;
  });
  c.quiz.forEach((q, i) => {
    out[`quiz.${i}.q`] = q.q;
    out[`quiz.${i}.why`] = q.why;
  });
  return out;
}

/** English hashes for the fields a translation actually rewrote. */
function lockFor(en: Chapter, zh: Chapter): Record<string, string> {
  const e = fields(en);
  const z = fields(zh);
  const locked: Record<string, string> = {};
  for (const [key, english] of Object.entries(e)) {
    // Identical means the translation inherits it; it cannot drift.
    if (z[key] === english) continue;
    locked[key] = hash(english);
  }
  return locked;
}

const current: Record<string, Record<string, string>> = {};
for (const [id, zh] of Object.entries(zhChapters)) {
  const en = chapters.find((c) => c.id === id);
  if (!en) continue;
  current[id] = lockFor(en, zh);
}

const check = process.argv.includes("--check");

if (!check) {
  writeFileSync(LOCK, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  const n = Object.values(current).reduce((a, m) => a + Object.keys(m).length, 0);
  console.log(`translation-lock.json: ${n} translated fields across ${Object.keys(current).length} chapters`);
  process.exit(0);
}

if (!existsSync(LOCK)) {
  console.error("No content/zh/translation-lock.json. Run `npm run lock` to create it.");
  process.exit(1);
}

const previous: Record<string, Record<string, string>> = JSON.parse(readFileSync(LOCK, "utf8"));
const stale: string[] = [];
const added: string[] = [];

for (const [id, nowFields] of Object.entries(current)) {
  const before = previous[id] ?? {};
  for (const [key, h] of Object.entries(nowFields)) {
    if (!(key in before)) added.push(`${id} · ${key}`);
    else if (before[key] !== h) stale.push(`${id} · ${key}`);
  }
}

if (stale.length || added.length) {
  console.error("\nChinese translations are out of date with the English source.\n");
  if (stale.length) {
    console.error("  The English changed; the translation did not:");
    for (const s of stale) console.error(`    - ${s}`);
  }
  if (added.length) {
    console.error("  Newly diverged (translated field with no recorded source):");
    for (const s of added) console.error(`    - ${s}`);
  }
  console.error(
    "\n  Update the Chinese text in content/zh/chapters/, then run `npm run lock`" +
      "\n  to record the English you translated from.\n"
  );
  process.exit(1);
}

console.log(`translations current (${Object.values(current).reduce((a, m) => a + Object.keys(m).length, 0)} fields checked)`);
