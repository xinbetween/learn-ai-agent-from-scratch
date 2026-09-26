/**
 * Load every built page in a headless browser and fail on console errors.
 *
 * This exists because of a bug that shipped and survived every other check.
 * Each chapter emits an inline `registerLab(...)` call mid-document while
 * app.js, which defines it, loads at the end of body — so the call threw
 * `ReferenceError: registerLab is not defined`, the registration was lost,
 * and all 25 simulators rendered their controls and computed nothing.
 *
 * The build passed. `verify` passed. The type-check passed. The HTML was
 * valid and the page looked structurally fine. Nothing that inspects source
 * can see a script that throws at run time; only running it can.
 *
 *   npm run check:console                  skip if no browser is available
 *   npm run check:console -- --required    fail if no browser is available
 *   CONSOLE_CHECK_REQUIRED=1 npm run verify   same, via the env (CI)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.CONSOLE_CHECK_PORT ?? 4399);
const CONCURRENCY = 4;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter((p): p is string => Boolean(p));

function findChrome(): string | undefined {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

/** Every directory in dist/ holding an index.html, as a URL path. */
async function pages(dir = DIST, prefix = "/"): Promise<string[]> {
  const out: string[] = [];
  if (existsSync(join(dir, "index.html"))) out.push(prefix);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "code") continue; // published source, not pages
    out.push(...(await pages(join(dir, entry.name), `${prefix}${entry.name}/`)));
  }
  return out;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

function serve(): Promise<{ close: () => void }> {
  const server = createServer(async (req, res) => {
    // The query string is the cache-busting ?v= on assets; ignore it.
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    for (const p of [join(DIST, url), join(DIST, url, "index.html")]) {
      try {
        if (!(await stat(p)).isFile()) continue;
        res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
        res.end(await readFile(p));
        return;
      } catch {
        /* try the next candidate */
      }
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve({ close: () => server.close() }));
  });
}

/** Console errors and page exceptions reported by Chrome for one URL. */
function consoleErrors(chrome: string, url: string): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--enable-logging=stderr",
        "--v=0",
        "--virtual-time-budget=4000",
        "--dump-dom",
        url,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let err = "";
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("close", () => {
      const found = err
        .split("\n")
        .filter((l) => l.includes("INFO:CONSOLE") || l.includes("Uncaught"))
        .map((l) => l.replace(/^.*CONSOLE:\d*\]\s*/, "").trim())
        .filter(Boolean);
      resolve([...new Set(found)]);
    });
  });
}

async function main() {
  // CI sets the env var so `verify` runs this for real in one pass; a
  // contributor without a browser gets a skip instead of a failure.
  const required = process.argv.includes("--required") || process.env.CONSOLE_CHECK_REQUIRED === "1";
  const chrome = findChrome();

  if (!chrome) {
    const msg = "No Chrome or Chromium found. Set CHROME_PATH to run the console check.";
    if (required) {
      console.error(msg);
      process.exit(1);
    }
    console.log(`${msg} Skipping.`);
    return;
  }

  if (!existsSync(DIST)) {
    console.error("No dist/. Run `npm run build` first.");
    process.exit(1);
  }

  const urls = await pages();
  const server = await serve();
  const failures: Array<{ url: string; errors: string[] }> = [];

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const i = next++;
        if (i >= urls.length) return;
        const path = urls[i];
        const errors = await consoleErrors(chrome, `http://localhost:${PORT}${path}`);
        if (errors.length) failures.push({ url: path, errors });
      }
    })
  );

  server.close();

  if (failures.length) {
    console.error(`\nConsole errors on ${failures.length} of ${urls.length} pages:\n`);
    for (const f of failures.sort((a, b) => a.url.localeCompare(b.url))) {
      console.error(`  ${f.url}`);
      for (const e of f.errors) console.error(`    ${e}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log(`${urls.length} pages loaded with no console errors.`);
}

main();
