/**
 * C09 · Planning — a plan you can enforce: patch-only revision, evidence-backed
 * completion, dependency waves, and a gate that skips planning on short tasks.
 *   node --experimental-strip-types code/c09_planning.ts
 */

export type StepStatus = "pending" | "active" | "done" | "blocked" | "dropped";

export interface Step {
  id: string; what: string; why: string;
  dependsOn: string[]; status: StepStatus;
  evidence?: string; note?: string;
}
export interface Plan { goal: string; revision: number; steps: Step[] }

export interface PlanPatch {
  reason: string;
  add?: Array<{ what: string; why: string; after?: string }>;
  block?: Array<{ id: string; note: string }>;
  drop?: Array<{ id: string; note: string }>;
}

export class PlanError extends Error {}

const find = (p: Plan, id: string): Step => {
  const s = p.steps.find((x) => x.id === id);
  if (!s) throw new PlanError(`no step ${id}`);
  return s;
};

/** Patch, never replace — so scope reduction is explicit and auditable. */
export function applyPatch(plan: Plan, patch: PlanPatch): Plan {
  if (!patch.reason?.trim()) throw new PlanError("a revision must state what was learned");
  const next: Plan = { ...plan, revision: plan.revision + 1, steps: plan.steps.map((s) => ({ ...s })) };

  for (const d of patch.drop ?? []) {
    const s = find(next, d.id);
    if (s.status === "done") throw new PlanError(`cannot drop completed step ${d.id} — its evidence is the run's record`);
    const dependents = next.steps.filter((x) => x.dependsOn.includes(d.id) && x.status !== "dropped" && x.id !== d.id);
    if (dependents.length) throw new PlanError(`step ${d.id} is required by ${dependents.map((x) => x.id).join(", ")}`);
    s.status = "dropped"; s.note = d.note;
  }
  for (const b of patch.block ?? []) {
    const s = find(next, b.id);
    if (s.status === "done") throw new PlanError(`cannot block completed step ${b.id}`);
    s.status = "blocked"; s.note = b.note;
  }
  for (const a of patch.add ?? []) {
    next.steps.push({ id: String(next.steps.length + 1), what: a.what, why: a.why,
                      dependsOn: a.after ? [a.after] : [], status: "pending" });
  }
  assertAcyclic(next);
  return next;
}

function assertAcyclic(p: Plan): void {
  const seen = new Set<string>(), stack = new Set<string>();
  const visit = (id: string) => {
    if (stack.has(id)) throw new PlanError(`dependency cycle through step ${id}`);
    if (seen.has(id)) return;
    seen.add(id); stack.add(id);
    for (const d of p.steps.find((s) => s.id === id)?.dependsOn ?? []) visit(d);
    stack.delete(id);
  };
  for (const s of p.steps) visit(s.id);
}

/** "Done" must be a claim supported by a named observation. */
export function completeStep(plan: Plan, id: string, evidence: string): { plan: Plan; error?: string } {
  const s = plan.steps.find((x) => x.id === id);
  if (!s) return { plan, error: `No step ${id}. Current plan:\n${renderPlan(plan)}` };
  if (evidence.trim().length < 20) return { plan, error: `Step ${id} needs specific evidence — cite the tool result or file that proves it. "I did it" is not evidence.` };
  const blocked = s.dependsOn.filter((d) => plan.steps.find((x) => x.id === d)?.status !== "done");
  if (blocked.length) return { plan, error: `Step ${id} depends on ${blocked.join(", ")}, which are not done.` };
  const next = { ...plan, steps: plan.steps.map((x) => x.id === id ? { ...x, status: "done" as const, evidence } : x) };
  return { plan: next };
}

export const ready = (p: Plan): Step[] => {
  const done = new Set(p.steps.filter((s) => s.status === "done").map((s) => s.id));
  return p.steps.filter((s) => s.status === "pending" && s.dependsOn.every((d) => done.has(d)));
};

export const waves = (p: Plan): Step[][] => {
  const out: Step[][] = [];
  const done = new Set<string>();
  let remaining = p.steps.filter((s) => s.status !== "dropped");
  while (remaining.length) {
    const w = remaining.filter((s) => s.dependsOn.every((d) => done.has(d)));
    if (!w.length) break;                                  // blocked or cyclic
    out.push(w);
    for (const s of w) done.add(s.id);
    remaining = remaining.filter((s) => !done.has(s.id));
  }
  return out;
};

/** ~120 tokens, pinned into every request in the high-attention tail. */
export function renderPlan(plan: Plan): string {
  const mark: Record<StepStatus, string> = { done: "[x]", active: "[>]", pending: "[ ]", blocked: "[!]", dropped: "[-]" };
  const next = ready(plan)[0];
  return `PLAN (rev ${plan.revision}) — ${plan.goal}\n` +
    plan.steps.map((s) =>
      `${mark[s.status]} ${s.id}. ${s.what}` +
      (s.status === "done" && s.evidence ? `  ← ${s.evidence.slice(0, 44)}` : "") +
      (s.note ? `  ⚠ ${s.note}` : "")).join("\n") +
    `\n\nNext: ${next ? next.what : "nothing actionable — revise the plan or finish"}`;
}

/** Fail toward NOT planning: an unplanned long task degrades gracefully. */
export function shouldPlan(goal: string, history: Array<{ goal: string; steps: number }> = []): { plan: boolean; why: string } {
  const conj = (goal.match(/\b(and|then|after|also|plus)\b/gi) ?? []).length;
  const imp = (goal.match(/\b(create|update|delete|migrate|refactor|check|verify|deploy|add|remove|fix)\b/gi) ?? []).length;
  if (conj === 0 && imp <= 1 && goal.length < 120) return { plan: false, why: "single action, short goal" };
  const similar = history.filter((h) => overlap(h.goal, goal) > 0.3);
  if (similar.length >= 3) {
    const med = similar.map((h) => h.steps).sort((a, b) => a - b)[Math.floor(similar.length / 2)];
    return { plan: med > 6, why: `${similar.length} similar tasks took a median of ${med} steps` };
  }
  return { plan: conj + imp >= 3, why: `${conj} conjunctions, ${imp} imperatives` };
}

const overlap = (a: string, b: string): number => {
  const A = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const B = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const i = [...A].filter((w) => B.has(w)).length;
  return i / Math.max(1, new Set([...A, ...B]).size);
};

/* ---------------- demo ---------------- */

function main(): void {
  console.log("\n  C09 · Planning\n");

  let plan: Plan = {
    goal: "Migrate auth to the new session API, update tests, check for stale imports",
    revision: 1,
    steps: [
      { id: "1", what: "Find every caller of getSession", why: "cannot migrate what we cannot see", dependsOn: [], status: "pending" },
      { id: "2", what: "Update callers in packages we own", why: "the migration itself", dependsOn: ["1"], status: "pending" },
      { id: "3", what: "Update the auth tests", why: "prove the migration works", dependsOn: ["2"], status: "pending" },
      { id: "4", what: "Grep for stale imports of the old module", why: "the goal names this explicitly", dependsOn: ["2"], status: "pending" },
    ],
  };

  console.log(renderPlan(plan).split("\n").map((l) => "  " + l).join("\n"));

  const r1 = completeStep(plan, "1", "grep found 11 call sites across 6 files");
  plan = r1.plan;

  console.log("\n  a step blocked mid-run, revised by patch:\n");
  plan = applyPatch(plan, {
    reason: "2 of the 11 call sites are in an external package we do not control",
    block: [{ id: "2", note: "2 call sites are in @vendor/sdk" }],
    add: [{ what: "Open an issue against @vendor/sdk", why: "unblocks the remaining call sites" }],
  });
  console.log(renderPlan(plan).split("\n").map((l) => "  " + l).join("\n"));

  console.log("\n  the guards, exercised:\n");
  const tries: Array<[string, () => unknown]> = [
    ["complete a step without evidence", () => { const r = completeStep(plan, "4", "done"); if (r.error) throw new PlanError(r.error); }],
    ["complete a step whose dependency is blocked", () => { const r = completeStep(plan, "3", "the tests all pass now, verified locally"); if (r.error) throw new PlanError(r.error); }],
    ["drop a completed step", () => applyPatch(plan, { reason: "tidying", drop: [{ id: "1", note: "not needed" }] })],
    ["drop a step others depend on", () => applyPatch(plan, { reason: "skip it", drop: [{ id: "2", note: "too hard" }] })],
    ["revise with no reason", () => applyPatch(plan, { reason: "", add: [{ what: "x", why: "y" }] })],
    ["drop EVERY remaining step (legitimate)", () => applyPatch(plan, { reason: "the goal turned out to be already satisfied upstream", drop: [{ id: "5", note: "upstream fixed it" }, { id: "4", note: "no stale imports exist" }] })],
  ];
  for (const [label, fn] of tries) {
    try { fn(); console.log(`  ✓ ${label.padEnd(44)} allowed`); }
    catch (e) { console.log(`  ✗ ${label.padEnd(44)} refused: ${(e as Error).message.split("\n")[0].slice(0, 62)}`); }
  }

  console.log("\n  dependency waves — what can run in parallel:\n");
  for (const [i, w] of waves(plan).entries()) {
    console.log(`    wave ${i + 1}: ${w.map((s) => `${s.id}. ${s.what}`).join("   |   ")}`);
  }

  console.log("\n  shouldPlan() — planning is overhead below about six steps:\n");
  const history = [
    { goal: "migrate the billing module to the new API and update tests", steps: 11 },
    { goal: "migrate notifications to the new API, update tests", steps: 9 },
    { goal: "migrate the search module to the new API and its tests", steps: 8 },
  ];
  for (const g of [
    "what's the weather in Lisbon",
    "summarise this PDF",
    "fix the failing test in auth",
    "Migrate auth to the new session API, update tests, and check for stale imports",
  ]) {
    const d = shouldPlan(g, history);
    console.log(`    ${(d.plan ? "PLAN" : "skip").padEnd(5)} ${g.slice(0, 58).padEnd(60)} (${d.why})`);
  }
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
