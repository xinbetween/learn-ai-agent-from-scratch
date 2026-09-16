/**
 * C17 · Multi-Agent Systems — a subagent is a tool with a fresh context, and the
 * justification is context isolation rather than specialisation.
 *   node --experimental-strip-types code/c17_multi_agent.ts
 */

import { Ledger } from "./c01_model_call.ts";

export interface SubTask { id: string; worker: string; brief: string; whySeparate: string; dependsOn: string[] }
export interface WorkerResult { worker: string; id: string; ok: boolean; answer?: string; error?: string; intermediateTokens: number; returnedTokens: number }

/** Dependency waves: parallel within each, sequential between. */
export function topologicalWaves(tasks: SubTask[]): SubTask[][] {
  const out: SubTask[][] = [];
  const done = new Set<string>();
  let rest = [...tasks];
  while (rest.length) {
    const w = rest.filter((t) => t.dependsOn.every((d) => done.has(d)));
    if (!w.length) throw new Error("dependency cycle in the plan");
    out.push(w);
    for (const t of w) done.add(t.id);
    rest = rest.filter((t) => !done.has(t.id));
  }
  return out;
}

/** The four elements. A brief missing any of them is the dominant cause of bad output. */
export interface Brief { objective: string; scope: string; format: string; nonGoals: string[] }
export const renderBrief = (b: Brief): string =>
  `OBJECTIVE: ${b.objective}\n\nSCOPE: ${b.scope}\n\nRETURN: ${b.format}\n\n` +
  `DO NOT: ${b.nonGoals.join("; ")} — other agents are covering those.`;

export const briefQuality = (text: string): number =>
  [/objective/i, /scope/i, /return|format/i, /do not|non-goal/i].filter((re) => re.test(text)).length / 4;

/* ---------------- simulation ---------------- */

export interface Topology { name: string; parallel: boolean; discardsContext: boolean; boundaries: number }

const TOPOLOGIES: Topology[] = [
  { name: "single agent", parallel: false, discardsContext: false, boundaries: 0 },
  { name: "orchestrator–worker", parallel: true, discardsContext: true, boundaries: 1 },
  { name: "handoff chain", parallel: false, discardsContext: false, boundaries: 3 },
  { name: "group chat (N agents)", parallel: false, discardsContext: false, boundaries: 0 },
];

interface Shape { subtasks: number; intermediatePerTask: number; interdependence: number; briefQuality: number }

function evaluate(t: Topology, s: Shape) {
  const pages = s.subtasks * s.intermediatePerTask;
  let orchestratorTokens: number, wallSeconds: number, quality: number;

  if (t.name === "single agent") {
    // Everything read stays in one context and is re-sent every turn (C01).
    orchestratorTokens = 6000 + pages * 0.55 * s.subtasks;
    wallSeconds = s.subtasks * 9;
    quality = Math.max(0.3, 0.93 - pages / 260_000 - s.interdependence * 0.04);
  } else if (t.name === "orchestrator–worker") {
    orchestratorTokens = 6000 + s.subtasks * 2200;
    wallSeconds = 9 + 11 + 6;
    // Splitting interdependent work means each agent lacks what the others found.
    quality = Math.min(0.96, (0.9 - s.interdependence * 0.45) * s.briefQuality + 0.05);
  } else if (t.name === "handoff chain") {
    orchestratorTokens = 6000 + pages * 0.3;
    wallSeconds = s.subtasks * 8;
    // Detail is lost at every transfer.
    quality = Math.max(0.25, (0.88 - s.subtasks * 0.04) * s.briefQuality);
  } else {
    // Every agent reads the whole transcript: tokens scale with agents × turns.
    orchestratorTokens = s.subtasks * s.subtasks * 6000 + pages * 0.5;
    wallSeconds = s.subtasks * 14;
    quality = Math.min(0.94, (0.86 - s.interdependence * 0.15) * s.briefQuality + (s.interdependence > 0.5 ? 0.06 : 0));
  }
  const totalTokens = pages + orchestratorTokens * (t.name === "single agent" ? 1 : 1);
  return { quality, orchestratorTokens, totalTokens, wallSeconds, usd: (totalTokens * 3) / 1e6 };
}

/* ---------------- a working orchestrator ---------------- */

async function runWorker(task: SubTask, ledger: Ledger): Promise<WorkerResult> {
  const child = ledger.child(`${task.worker}[${task.id}]`);
  // A worker reads a lot and returns a little. The reading happens in a context
  // that is DISCARDED — which is the entire argument for the boundary.
  const intermediate = 12_000 + task.id.length * 400;
  child.record({ label: "worker", usage: { input: intermediate, output: 400 }, ms: 3400, model: "mock" });
  if (task.worker === "pricing" && task.id === "t3") {
    return { worker: task.worker, id: task.id, ok: false, error: "no public pricing above 100M vectors", intermediateTokens: intermediate, returnedTokens: 0 };
  }
  const answer = `${task.worker}: finding for ${task.id}`;
  return { worker: task.worker, id: task.id, ok: true, answer, intermediateTokens: intermediate, returnedTokens: 60 };
}

export async function orchestrate(tasks: SubTask[]): Promise<{ results: WorkerResult[]; ledger: Ledger; orchestratorContext: number }> {
  const ledger = new Ledger("run");
  const results: WorkerResult[] = [];
  for (const wave of topologicalWaves(tasks)) {
    // A failed worker is a FINDING, not an abort — the lead decides what to do.
    const settled = await Promise.allSettled(wave.map((t) => runWorker(t, ledger)));
    results.push(...settled.map((s, i) => s.status === "fulfilled" ? s.value
      : { worker: wave[i].worker, id: wave[i].id, ok: false, error: String(s.reason), intermediateTokens: 0, returnedTokens: 0 }));
  }
  const orchestratorContext = 6000 + results.reduce((t, r) => t + r.returnedTokens, 0);
  return { results, ledger, orchestratorContext };
}

/* ---------------- demo ---------------- */

async function main(): Promise<void> {
  console.log("\n  C17 · Multi-Agent Systems\n");

  const tasks: SubTask[] = [
    { id: "t1", worker: "scale", brief: "…", whySeparate: "reads ~15 doc pages", dependsOn: [] },
    { id: "t2", worker: "ops", brief: "…", whySeparate: "reads ~12 runbooks", dependsOn: [] },
    { id: "t3", worker: "pricing", brief: "…", whySeparate: "reads ~9 pricing pages", dependsOn: [] },
    { id: "t4", worker: "synthesis", brief: "…", whySeparate: "needs all three", dependsOn: ["t1", "t2", "t3"] },
  ];

  const { results, ledger, orchestratorContext } = await orchestrate(tasks);
  const discarded = results.reduce((t, r) => t + r.intermediateTokens, 0);
  const returned = results.reduce((t, r) => t + r.returnedTokens, 0);

  console.log(`  waves: ${topologicalWaves(tasks).map((w) => w.map((t) => t.id).join("+")).join(" → ")}\n`);
  for (const r of results) {
    console.log(`    ${r.ok ? "✓" : "✗"} ${r.worker.padEnd(11)} read ${r.intermediateTokens.toLocaleString().padStart(7)} tok, ` +
      `returned ${String(r.returnedTokens).padStart(3)} tok   ${r.ok ? r.answer : "FINDING: " + r.error}`);
  }
  console.log(`\n  context isolation, measured:`);
  console.log(`    intermediate tokens read by workers   ${discarded.toLocaleString()}`);
  console.log(`    tokens that entered the orchestrator  ${returned.toLocaleString()}`);
  console.log(`    compression ratio                     ${Math.round(discarded / Math.max(returned, 1))}:1`);
  console.log(`    orchestrator context at synthesis     ${orchestratorContext.toLocaleString()} tok`);
  console.log(`\n  Compaction gets you roughly 4:1 because it summarises. A subagent DISCARDS,`);
  console.log(`  so the parent never pays for those tokens on any subsequent turn.`);
  console.log(`\n  cost attribution (nested ledgers — otherwise this is one number):\n`);
  console.log(ledger.report("    "));

  console.log(`\n  and the failed worker did not abort the run — it became a finding the`);
  console.log(`  synthesiser must report under "not established".`);

  // Topology comparison.
  console.log(`\n  topology vs task shape · 5 subtasks, 14K intermediate tokens each\n`);
  for (const [label, shape] of [
    ["independent, full briefs", { subtasks: 5, intermediatePerTask: 14_000, interdependence: 0.2, briefQuality: 1 }],
    ["independent, vague briefs", { subtasks: 5, intermediatePerTask: 14_000, interdependence: 0.2, briefQuality: 0.5 }],
    ["highly interdependent", { subtasks: 5, intermediatePerTask: 14_000, interdependence: 0.8, briefQuality: 1 }],
  ] as Array<[string, Shape]>) {
    console.log(`  ${label}`);
    const rows = TOPOLOGIES.map((t) => [t.name, evaluate(t, shape)] as const);
    const best = rows.reduce((a, b) => b[1].quality > a[1].quality ? b : a);
    for (const [name, r] of rows) {
      console.log(`    ${(name === best[0] ? "→ " : "  ") + name.padEnd(22)} quality ${(Math.round(r.quality * 100) + "%").padStart(4)}   ` +
        `${Math.round(r.totalTokens / 1000).toString().padStart(4)}K tok   ${String(r.wallSeconds).padStart(3)}s   $${r.usd.toFixed(2)}`);
    }
    console.log();
  }
  console.log(`  Vague briefs move every multi-agent row and leave the single agent unchanged —`);
  console.log(`  because the single agent never had to serialise its intent through a string.`);
  console.log(`  High interdependence hands the win back to the single agent entirely.`);

  console.log(`\n  brief quality, scored:\n`);
  const good = renderBrief({
    objective: "Find current list pricing for Acme, Globex and Initech cloud storage.",
    scope: "Public pricing pages and published press releases only — citable primary sources.",
    format: "A markdown table: vendor, plan, price/TB/month, minimum commitment, URL, page date.",
    nonGoals: ["research vendors not listed", "compare against our own pricing"],
  });
  for (const [label, text] of [["\"Research competitor pricing\"", "Research competitor pricing"], ["the full brief", good]] as const) {
    console.log(`    ${(Math.round(briefQuality(text) * 100) + "%").padStart(5)}  ${label}`);
  }
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
