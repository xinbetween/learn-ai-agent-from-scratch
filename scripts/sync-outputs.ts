/**
 * Runs each chapter's code file and rewrites the chapter's "run it" block with
 * the real output, so the site can never claim output the program does not print.
 *
 *   npm run sync              # rewrite chapter files
 *   npm run sync -- --check   # fail if any block is stale (CI)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const OPEN = "src: `node --experimental-strip-types ";

/**
 * Find the template literal's closing backtick, honouring backslash escapes.
 * A regex cannot do this reliably: program output is full of backticks, and
 * `\`,` inside the block looks exactly like the terminator to a regex.
 */
function endOfTemplate(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }          // skip the escaped character
    if (text[i] === "`") return i;
  }
  return -1;
}

/** The output is inserted into a template literal, so these must be escaped. */
const forTemplateLiteral = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const comment = (text: string): string =>
  text.split("\n").map((l) => (l.trim() ? "# " + l.replace(/\s+$/, "") : "#")).join("\n");

/** Wall-clock timings differ run to run; --check compares content, not the machine. */
const stable = (text: string): string =>
  text.replace(/\b\d+(?:\.\d+)?\s*(ms|µs|us)\b/g, "<t>").replace(/\b\d+(?:\.\d+)?s\b/g, "<t>");

function run(codePath: string): string {
  try {
    return execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", codePath],
      { cwd: ROOT, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e: any) {
    console.error(`  ! ${codePath} exited non-zero`);
    return `(failed: ${String(e.stderr ?? e.message).split("\n")[0]})`;
  }
}

let changed = 0, stale = 0, missing = 0;

for (const file of readdirSync(join(ROOT, "content/chapters")).filter((f) => /^c\d\d\.ts$/.test(f))) {
  const path = join(ROOT, "content/chapters", file);
  const before = readFileSync(path, "utf8");
  let out = "";
  let cursor = 0;

  for (;;) {
    const start = before.indexOf(OPEN, cursor);
    if (start === -1) { out += before.slice(cursor); break; }

    const cmdStart = start + "src: `".length;
    const close = endOfTemplate(before, cmdStart);
    if (close === -1) { out += before.slice(cursor); break; }

    const body = before.slice(cmdStart, close);
    const codePath = body.split(/\s+/)[2];             // node --experimental-strip-types <path>
    if (!codePath || !existsSync(join(ROOT, codePath))) {
      missing++;
      out += before.slice(cursor, close + 1);
      cursor = close + 1;
      continue;
    }

    const cmd = `node --experimental-strip-types ${codePath}`;
    const lines = run(codePath).replace(/^\n+|\n+$/g, "").split("\n");
    // Cap the block so a chapter stays readable.
    const shown = lines.length > 34 ? [...lines.slice(0, 32), "…", lines.at(-1)!] : lines;

    out += before.slice(cursor, start);
    out += "src: `" + cmd + "\n\n" + forTemplateLiteral(comment(shown.join("\n"))) + "`";
    cursor = close + 1;
  }

  if (out !== before) {
    if (CHECK) {
      if (stable(out) === stable(before)) continue;    // timing jitter only
      stale++;
      console.error(`  ✗ ${file} run block is stale`);
    } else {
      writeFileSync(path, out, "utf8");
      changed++;
      console.log(`  ✓ ${file}`);
    }
  }
}

if (missing) console.log(`  ${missing} run block(s) reference a code file that does not exist — left alone.`);
if (CHECK && stale) { console.error(`\n${stale} stale block(s). Run: npm run sync`); process.exit(1); }
if (!CHECK) console.log(`\nsynced ${changed} chapter file(s).`);
