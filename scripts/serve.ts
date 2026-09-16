/** Zero-dependency static server for dist/. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.env.PORT ?? 4321);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".ts": "text/plain; charset=utf-8",
  ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const candidates = [join(ROOT, url), join(ROOT, url, "index.html")];
  for (const p of candidates) {
    try {
      const s = await stat(p);
      if (!s.isFile()) continue;
      res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
      res.end(await readFile(p));
      return;
    } catch { /* next */ }
  }
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(await readFile(join(ROOT, "404.html")).catch(() => "404"));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
