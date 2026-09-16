/**
 * Every file in code/ must actually run under Node's strip-only TypeScript.
 * Strip-only mode rejects enums, namespaces, decorators and parameter properties,
 * and the failure mode is a SyntaxError at import time — so check it, don't hope.
 *
 *   npm run check:code
 */
import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CODE = join(ROOT, "code");

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".ts")) files.push(p);
  }
};
walk(CODE);

let failed = 0;
for (const f of files.sort()) {
  const rel = f.slice(ROOT.length + 1);
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", f],
      { cwd: ROOT, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
    console.log(`  ✓ ${rel}`);
  } catch (e: any) {
    failed++;
    const first = String(e.stderr ?? e.message).split("\n").find((l: string) => l.trim()) ?? "failed";
    console.error(`  ✗ ${rel}  ${first.trim().slice(0, 100)}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} runnable files execute cleanly.`);
if (failed) process.exit(1);
