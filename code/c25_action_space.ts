/**
 * C25 · The Action Space — the same six tasks answered two ways, once as a
 * sequence of JSON tool calls and once as a single code action, counting the
 * turns and the tokens each one costs.
 *   node --experimental-strip-types code/c25_action_space.ts
 *
 * Everything here is deterministic. The "model" is scripted: it does not
 * choose, it replays a plan a model would plausibly have produced. What is
 * real is the accounting — turn counts, the bytes that cross into the message
 * array, and what happens to each strategy when a step fails.
 */

/* ---------------------------------------------------------------- domain */

export interface Employee {
  id: number;
  name: string;
  dept: string;
  salary: number;
  managerId: number | null;
  startedAt: string;
}

/** A small fake HR table. Deterministic, and big enough that returning all of
 *  it into the context is a visible mistake rather than a theoretical one. */
export const EMPLOYEES: Employee[] = Array.from({ length: 240 }, (_, i) => {
  const depts = ["engineering", "sales", "support", "finance"];
  const dept = depts[i % depts.length];
  return {
    id: 1000 + i,
    name: `person_${String(i).padStart(3, "0")}`,
    dept,
    salary: 60_000 + ((i * 2_137) % 90_000),
    managerId: i < 4 ? null : 1000 + (i % 4),
    startedAt: `20${15 + (i % 10)}-0${1 + (i % 9)}-1${i % 9}`,
  };
});

/* ------------------------------------------------------------ tool space */

/** The JSON action space: a fixed set of tools, each doing one thing. This is
 *  the surface C03 teaches, and it is what CodeAct is compared against. */
export const TOOLS = {
  list_departments: (): string[] => [...new Set(EMPLOYEES.map((e) => e.dept))].sort(),

  list_employees: (args: { dept: string }): Employee[] =>
    EMPLOYEES.filter((e) => e.dept === args.dept),

  get_employee: (args: { id: number }): Employee | undefined =>
    EMPLOYEES.find((e) => e.id === args.id),

  /** Deliberately absent: no aggregate, no sort, no join. That absence is the
   *  chapter's subject — the action space bounds what a single action can say. */
};

export type ToolName = keyof typeof TOOLS;

/* ------------------------------------------------------------ accounting */

/** Tokens, estimated the way C01 says to estimate for UI rather than billing:
 *  cheap, consistent, and good enough to compare two strategies. */
export const estimateTokens = (s: string): number => Math.ceil(s.length / 3.5);

export interface Accounting {
  turns: number;
  /** Tokens that entered the message array and are re-sent every later turn. */
  observationTokens: number;
  /** Tokens the model had to emit. */
  actionTokens: number;
}

const zero = (): Accounting => ({ turns: 0, observationTokens: 0, actionTokens: 0 });

/* ------------------------------------------------- strategy 1: JSON calls */

export interface Task {
  name: string;
  /** The tool-call plan a model would produce, in order. */
  json: Array<{ tool: ToolName; args: Record<string, unknown> }>;
  /** The single code action that answers the same question. */
  code: string;
  /** How the answer is computed, so both strategies are checked against it. */
  answer: () => unknown;
}

function runJson(task: Task): Accounting {
  const acc = zero();
  for (const call of task.json) {
    acc.turns++;
    acc.actionTokens += estimateTokens(JSON.stringify(call));
    const fn = TOOLS[call.tool] as (a: unknown) => unknown;
    const observation = JSON.stringify(fn(call.args));
    acc.observationTokens += estimateTokens(observation);
  }
  // One more turn to state the answer from what it gathered.
  acc.turns++;
  return acc;
}

/* ------------------------------------------------- strategy 2: code action */

/** A stand-in interpreter. The code action runs against the same data through
 *  the same functions; only the boundary moves. In a real system this is the
 *  sandbox from C13, and `print` is the only thing that crosses back. */
export function runCode(source: string): { output: string; error?: string } {
  const printed: string[] = [];
  const print = (...xs: unknown[]) =>
    printed.push(xs.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  try {
    const fn = new Function("employees", "print", source);
    fn(EMPLOYEES, print);
    return { output: printed.join("\n") };
  } catch (e) {
    return { output: printed.join("\n"), error: String((e as Error).message) };
  }
}

function runCodeAction(task: Task): Accounting {
  const acc = zero();
  acc.turns++;
  acc.actionTokens += estimateTokens(task.code);
  const { output, error } = runCode(task.code);
  acc.observationTokens += estimateTokens(error ? `${output}\n${error}` : output);
  acc.turns++; // state the answer
  return acc;
}

/* ----------------------------------------------------------------- tasks */

export const TASKS: Task[] = [
  {
    name: "count engineering",
    json: [{ tool: "list_employees", args: { dept: "engineering" } }],
    code: `print(employees.filter(e => e.dept === "engineering").length);`,
    answer: () => EMPLOYEES.filter((e) => e.dept === "engineering").length,
  },
  {
    name: "highest paid in sales",
    json: [{ tool: "list_employees", args: { dept: "sales" } }],
    code: `const s = employees.filter(e => e.dept === "sales");
print(s.reduce((a, b) => (a.salary > b.salary ? a : b)).name);`,
    answer: () =>
      EMPLOYEES.filter((e) => e.dept === "sales").reduce((a, b) => (a.salary > b.salary ? a : b)).name,
  },
  {
    name: "mean salary per department",
    // No aggregate tool exists, so every department must be pulled in full.
    json: [
      { tool: "list_departments", args: {} },
      { tool: "list_employees", args: { dept: "engineering" } },
      { tool: "list_employees", args: { dept: "sales" } },
      { tool: "list_employees", args: { dept: "support" } },
      { tool: "list_employees", args: { dept: "finance" } },
    ],
    code: `const by = {};
for (const e of employees) (by[e.dept] ??= []).push(e.salary);
const out = Object.entries(by).map(([d, xs]) =>
  [d, Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)]);
print(out.sort());`,
    answer: () => {
      const by: Record<string, number[]> = {};
      for (const e of EMPLOYEES) (by[e.dept] ??= []).push(e.salary);
      return Object.entries(by)
        .map(([d, xs]) => [d, Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)])
        .sort();
    },
  },
  {
    name: "who reports to whom (a join)",
    json: [
      { tool: "list_departments", args: {} },
      { tool: "list_employees", args: { dept: "engineering" } },
      { tool: "list_employees", args: { dept: "sales" } },
      { tool: "list_employees", args: { dept: "support" } },
      { tool: "list_employees", args: { dept: "finance" } },
      { tool: "get_employee", args: { id: 1000 } },
      { tool: "get_employee", args: { id: 1001 } },
      { tool: "get_employee", args: { id: 1002 } },
      { tool: "get_employee", args: { id: 1003 } },
    ],
    code: `const byId = new Map(employees.map(e => [e.id, e]));
const counts = new Map();
for (const e of employees) if (e.managerId !== null)
  counts.set(e.managerId, (counts.get(e.managerId) ?? 0) + 1);
print([...counts].map(([id, n]) => [byId.get(id).name, n]).sort());`,
    answer: () => {
      const byId = new Map(EMPLOYEES.map((e) => [e.id, e]));
      const counts = new Map<number, number>();
      for (const e of EMPLOYEES) if (e.managerId !== null) counts.set(e.managerId, (counts.get(e.managerId) ?? 0) + 1);
      return [...counts].map(([id, n]) => [byId.get(id)!.name, n]).sort();
    },
  },
  {
    name: "salary bands, bucketed",
    json: [
      { tool: "list_departments", args: {} },
      { tool: "list_employees", args: { dept: "engineering" } },
      { tool: "list_employees", args: { dept: "sales" } },
      { tool: "list_employees", args: { dept: "support" } },
      { tool: "list_employees", args: { dept: "finance" } },
    ],
    code: `const band = s => Math.floor(s / 25000) * 25;
const hist = {};
for (const e of employees) hist[band(e.salary)] = (hist[band(e.salary)] ?? 0) + 1;
print(Object.entries(hist).sort((a, b) => a[0] - b[0]));`,
    answer: () => {
      const band = (s: number) => Math.floor(s / 25000) * 25;
      const hist: Record<number, number> = {};
      for (const e of EMPLOYEES) hist[band(e.salary)] = (hist[band(e.salary)] ?? 0) + 1;
      return Object.entries(hist).sort((a, b) => Number(a[0]) - Number(b[0]));
    },
  },
  {
    name: "longest-serving per department",
    json: [
      { tool: "list_departments", args: {} },
      { tool: "list_employees", args: { dept: "engineering" } },
      { tool: "list_employees", args: { dept: "sales" } },
      { tool: "list_employees", args: { dept: "support" } },
      { tool: "list_employees", args: { dept: "finance" } },
    ],
    code: `const best = {};
for (const e of employees)
  if (!best[e.dept] || e.startedAt < best[e.dept].startedAt) best[e.dept] = e;
print(Object.entries(best).map(([d, e]) => [d, e.name]).sort());`,
    answer: () => {
      const best: Record<string, Employee> = {};
      for (const e of EMPLOYEES) if (!best[e.dept] || e.startedAt < best[e.dept].startedAt) best[e.dept] = e;
      return Object.entries(best)
        .map(([d, e]) => [d, e.name])
        .sort();
    },
  },
];

/* --------------------------------------------- the self-debugging example */

/** A first attempt with a real bug in it: `reduce` on an empty array throws.
 *  The traceback is the observation, and it is enough to fix from. */
export const BUGGY = `const hr = employees.filter(e => e.dept === "human-resources");
print(hr.reduce((a, b) => (a.salary > b.salary ? a : b)).name);`;

export const FIXED = `const hr = employees.filter(e => e.dept === "human-resources");
if (hr.length === 0) print("no such department; known:",
  [...new Set(employees.map(e => e.dept))].sort());
else print(hr.reduce((a, b) => (a.salary > b.salary ? a : b)).name);`;

/* ------------------------------------------------------------------ main */

const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w: number) => String(n).padStart(w);

function main(): void {
  console.log(`\n  C25 · The action space — ${TASKS.length} tasks, two ways\n`);
  console.log(`  ${pad("task", 30)} ${pad("json turns", 11)} ${pad("code turns", 11)} ${pad("json obs tok", 13)} code obs tok`);
  console.log(`  ${"-".repeat(30)} ${"-".repeat(11)} ${"-".repeat(11)} ${"-".repeat(13)} ${"-".repeat(12)}`);

  const totals = { json: zero(), code: zero() };

  for (const task of TASKS) {
    const j = runJson(task);
    const c = runCodeAction(task);

    // Both strategies must reach the same answer, or the comparison is theatre.
    const expected = JSON.stringify(task.answer());
    const got = runCode(task.code).output;
    const agrees = got.replace(/\s+/g, "") === expected.replace(/[[\]"]/g, "").replace(/\s+/g, "")
      || got.replace(/\s+/g, "") === expected.replace(/\s+/g, "");

    totals.json.turns += j.turns;
    totals.json.observationTokens += j.observationTokens;
    totals.json.actionTokens += j.actionTokens;
    totals.code.turns += c.turns;
    totals.code.observationTokens += c.observationTokens;
    totals.code.actionTokens += c.actionTokens;

    console.log(
      `  ${pad(task.name, 30)} ${num(j.turns, 11)} ${num(c.turns, 11)} ${num(j.observationTokens, 13)} ${num(c.observationTokens, 12)}${agrees ? "" : "   [MISMATCH]"}`
    );
  }

  console.log(`  ${"-".repeat(30)} ${"-".repeat(11)} ${"-".repeat(11)} ${"-".repeat(13)} ${"-".repeat(12)}`);
  console.log(
    `  ${pad("total", 30)} ${num(totals.json.turns, 11)} ${num(totals.code.turns, 11)} ${num(totals.json.observationTokens, 13)} ${num(totals.code.observationTokens, 12)}`
  );

  const turnRatio = (totals.json.turns / totals.code.turns).toFixed(1);
  const tokRatio = (totals.json.observationTokens / Math.max(1, totals.code.observationTokens)).toFixed(0);
  console.log(`\n  ${turnRatio}× the turns, ${tokRatio}× the observation tokens.`);
  console.log(`  The token gap is the interesting one: a JSON action can only name a tool,`);
  console.log(`  so every row it needs must cross into the message array — and C01 bills`);
  console.log(`  those rows again on every turn that follows. A code action can filter and`);
  console.log(`  aggregate where the data already is, and return the four numbers you asked`);
  console.log(`  for. The intermediate 240 rows never enter the conversation at all.\n`);

  console.log(`  Self-debugging — the traceback is the observation:\n`);
  const bad = runCode(BUGGY);
  console.log(`    attempt 1  ${bad.error ? `ERROR  ${bad.error}` : bad.output}`);
  const good = runCode(FIXED);
  console.log(`    attempt 2  ${good.output}`);
  console.log(`\n    Nothing had to be designed for that recovery. In a JSON action space you`);
  console.log(`    would have needed a tool that reports valid departments; here the runtime`);
  console.log(`    error names the problem and the next action handles it (C03's rule, but`);
  console.log(`    for free).\n`);

  console.log(`  What this does not show: the model choosing. Every plan above was scripted,`);
  console.log(`  so this measures the ceiling of each action space, not whether a model hits`);
  console.log(`  it. The paper measures that part — up to 20% higher success across 17 models`);
  console.log(`  on API-Bank — and C19 is how you would measure it on your own tasks.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
