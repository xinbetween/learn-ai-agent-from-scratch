/**
 * C16 · Human in the Loop — two independent axes, scoped grants, durable
 * suspension, and the arithmetic of alert fatigue.
 *   node --experimental-strip-types code/c16_approvals.ts
 */

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ApprovalPolicy = "never" | "on-failure" | "on-request" | "irreversible-external" | "every-write" | "every-action";

export type Reversibility = "trivial" | "cheap" | "hard" | "impossible";
export type Blast = "self" | "workspace" | "org" | "public";
const BLAST_ORDER: Blast[] = ["self", "workspace", "org", "public"];
const atLeast = (a: Blast, b: Blast) => BLAST_ORDER.indexOf(a) >= BLAST_ORDER.indexOf(b);

export interface ToolMeta {
  name: string; readOnly: boolean;
  reversibility: Reversibility; blast: Blast;
  external: boolean; withinSandbox: (mode: SandboxMode) => boolean;
}

export type Decision =
  | { kind: "allow"; note?: string }
  | { kind: "ask"; why: string }
  | { kind: "refuse"; why: string };

export interface Grant {
  tool: string;
  argMatch?: RegExp;
  scope: "once" | "this-run" | "this-session";
  grantedAt: number; grantedBy: string;
}

/** Enforced in code: a tired user WILL click "always allow" on the email tool. */
export const IRREVERSIBLE_EXTERNAL = new Set(["send_email", "charge_card", "post_message", "deploy", "delete_account"]);

export class GrantStore {
  private grants: Grant[] = [];
  grant(g: Omit<Grant, "grantedAt">): void {
    if (IRREVERSIBLE_EXTERNAL.has(g.tool) && g.scope !== "once") {
      throw new Error(`${g.tool} may only be approved once per call — a standing grant is refused by policy`);
    }
    this.grants.push({ ...g, grantedAt: Date.now() });
  }
  covers(tool: string, argsText: string): Grant | null {
    return this.grants.find((g) => g.tool === tool && (!g.argMatch || g.argMatch.test(argsText))) ?? null;
  }
  get count(): number { return this.grants.length; }
}

export function decide(
  tool: ToolMeta, argsText: string,
  policy: { sandbox: SandboxMode; approval: ApprovalPolicy }, grants: GrantStore,
): Decision {
  // 0. The sandbox is a boundary, not a permission question.
  if (!tool.withinSandbox(policy.sandbox)) return { kind: "refuse", why: `${tool.name} is outside the ${policy.sandbox} sandbox` };
  if (grants.covers(tool.name, argsText)) return { kind: "allow", note: "covered by a scoped grant" };

  if (policy.approval === "never") return { kind: "allow" };
  if (policy.approval === "every-action") return { kind: "ask", why: `${tool.name}` };
  // 1. Contained by the sandbox? Do not ask. This is most calls.
  if (tool.readOnly && policy.sandbox !== "danger-full-access") return { kind: "allow" };
  if (policy.approval === "every-write") return { kind: "ask", why: `${tool.name} writes` };
  // 2. Reversibility outranks apparent severity.
  if (tool.reversibility === "trivial") return { kind: "allow", note: "undoable in one keystroke" };
  // 3. Blast radius × reversibility. Ask only in the top-right corner.
  if (tool.reversibility === "hard" && atLeast(tool.blast, "org")) return { kind: "ask", why: describe(tool) };
  if (tool.reversibility === "impossible" && atLeast(tool.blast, "workspace")) return { kind: "ask", why: describe(tool) };
  return { kind: "allow", note: "notable — recorded prominently in the audit log" };
}

const describe = (t: ToolMeta): string =>
  `${t.name} — ${t.reversibility === "impossible" ? "cannot be undone" : "hard to undo"}, affects ${t.blast}` +
  (t.external ? ", and is visible outside this system" : "");

/* ---------------- fatigue ---------------- */

/** Attention is a fixed budget of about four careful reviews per session. */
export const attentionAfter = (asks: number): number => Math.max(0.05, Math.exp(-Math.max(0, asks - 4) / 9));
export const readingState = (a: number): string => a > 0.7 ? "reading carefully" : a > 0.35 ? "skimming" : "clicking yes";

/* ---------------- durable suspension ---------------- */

export type Interrupt = { kind: "stop" } | { kind: "pause" } | { kind: "steer"; message: string } | { kind: "approve"; callId: string; approved: boolean; by: string };

export interface ApprovalEvent { t: "approval_requested" | "approval_decided"; callId: string; summary?: string; approved?: boolean; by?: string }

/** The process may exit while a human decides; the decision resumes the run. */
export class ApprovalQueue {
  private pending = new Map<string, string>();
  private log: ApprovalEvent[] = [];
  request(callId: string, summary: string): "suspended" {
    this.pending.set(callId, summary);
    this.log.push({ t: "approval_requested", callId, summary });
    return "suspended";                                   // no thread is held
  }
  decide(callId: string, approved: boolean, by: string): void {
    this.pending.delete(callId);
    this.log.push({ t: "approval_decided", callId, approved, by });
  }
  get events(): ApprovalEvent[] { return this.log; }
  get outstanding(): number { return this.pending.size; }
}

/* ---------------- simulation ---------------- */

const TOOLS: ToolMeta[] = [
  { name: "read_file", readOnly: true, reversibility: "trivial", blast: "self", external: false, withinSandbox: () => true },
  { name: "grep", readOnly: true, reversibility: "trivial", blast: "self", external: false, withinSandbox: () => true },
  { name: "run_tests", readOnly: false, reversibility: "trivial", blast: "workspace", external: false, withinSandbox: (m) => m !== "read-only" },
  { name: "apply_patch", readOnly: false, reversibility: "trivial", blast: "workspace", external: false, withinSandbox: (m) => m !== "read-only" },
  { name: "git_commit", readOnly: false, reversibility: "cheap", blast: "workspace", external: false, withinSandbox: (m) => m !== "read-only" },
  { name: "git_push", readOnly: false, reversibility: "hard", blast: "org", external: true, withinSandbox: (m) => m !== "read-only" },
  { name: "send_email", readOnly: false, reversibility: "impossible", blast: "public", external: true, withinSandbox: (m) => m === "danger-full-access" || m === "workspace-write" },
  { name: "delete_prod_row", readOnly: false, reversibility: "impossible", blast: "org", external: false, withinSandbox: (m) => m === "danger-full-access" },
];

function session(policy: { sandbox: SandboxMode; approval: ApprovalPolicy }, actions: number, batch: boolean) {
  const grants = new GrantStore();
  if (batch) grants.grant({ tool: "apply_patch", argMatch: /^src\//, scope: "this-run", grantedBy: "user" });
  let asks = 0, refused = 0, allowed = 0;
  // A realistic mix: mostly reads and edits, a few writes, rarely something external.
  const weights: Array<[string, number]> = [["read_file", 40], ["grep", 22], ["apply_patch", 20], ["run_tests", 12], ["git_commit", 3], ["git_push", 1], ["send_email", 1], ["delete_prod_row", 1]];
  const total = weights.reduce((t, [, w]) => t + w, 0);
  for (let i = 0; i < actions; i++) {
    let r = ((i * 7919) % total);
    const name = weights.find(([, w]) => (r -= w) < 0)![0];
    const tool = TOOLS.find((t) => t.name === name)!;
    const d = decide(tool, "src/auth/session.ts", policy, grants);
    if (d.kind === "ask") asks++; else if (d.kind === "refuse") refused++; else allowed++;
  }
  const attention = attentionAfter(asks);
  return { asks, refused, allowed, attention, rubberStamped: Math.round(asks * (1 - attention)), humanSeconds: asks * 22 };
}

/* ---------------- demo ---------------- */

function main(): void {
  console.log("\n  C16 · Human in the Loop\n");

  console.log("  the decision, per tool — reversibility outranks apparent severity\n");
  const policy = { sandbox: "workspace-write" as SandboxMode, approval: "irreversible-external" as ApprovalPolicy };
  const grants = new GrantStore();
  console.log(`  ${"tool".padEnd(18)} ${"reversibility".padEnd(14)} ${"blast".padEnd(11)} ${"decision".padEnd(8)} why`);
  for (const t of TOOLS) {
    const d = decide(t, "src/x.ts", policy, grants);
    console.log(`  ${t.name.padEnd(18)} ${t.reversibility.padEnd(14)} ${t.blast.padEnd(11)} ${d.kind.padEnd(8)} ` +
      `${d.kind === "allow" ? (d.note ?? "contained by the sandbox") : d.why}`);
  }
  console.log(`\n  "delete 400 files under git" is trivially reversible and never asks.`);
  console.log(`  "send one email" is impossible to undo and always does. Intuition ranks these backwards.`);

  console.log(`\n  standing grants, and the one the policy refuses:\n`);
  const g = new GrantStore();
  for (const [tool, scope] of [["apply_patch", "this-run"], ["run_tests", "this-session"], ["send_email", "this-session"]] as const) {
    try { g.grant({ tool, scope, grantedBy: "user" }); console.log(`    ✓ allow ${tool} for ${scope}`); }
    catch (e) { console.log(`    ✗ allow ${tool} for ${scope} — ${(e as Error).message}`); }
  }

  console.log(`\n  80 actions per session, 2 of them genuinely harmful\n`);
  console.log(`  ${"sandbox".padEnd(19)} ${"approval".padEnd(23)} ${"batch".padEnd(6)} ${"asks".padStart(5)} ${"rubber".padStart(7)} ${"human".padStart(7)}  reviewer`);
  const configs: Array<[SandboxMode, ApprovalPolicy, boolean]> = [
    ["danger-full-access", "never", false],
    ["workspace-write", "every-action", false],
    ["workspace-write", "every-write", false],
    ["workspace-write", "irreversible-external", false],
    ["workspace-write", "every-write", true],
    ["read-only", "irreversible-external", false],
  ];
  for (const [sandbox, approval, batch] of configs) {
    const r = session({ sandbox, approval }, 80, batch);
    console.log(`  ${sandbox.padEnd(19)} ${approval.padEnd(23)} ${(batch ? "yes" : "no").padEnd(6)} ` +
      `${String(r.asks).padStart(5)} ${String(r.rubberStamped).padStart(7)} ${(Math.round(r.humanSeconds / 60) + "m").padStart(7)}  ${readingState(r.attention)}`);
  }
  console.log(`\n  Batching shows up on the "every-write" rows: a single scoped grant for`);
  console.log(`  apply_patch under src/** turns 29 interruptions into ${session({ sandbox: "workspace-write", approval: "every-write" }, 80, true).asks}.`);
  console.log(`\n  "every action" collects 80 signatures from someone who stopped reading at the`);
  console.log(`  fifth. That is worse than asking nothing, because the audit log now says a`);
  console.log(`  human approved the one that mattered.`);

  console.log(`\n  durable suspension — the process may exit while a human decides:\n`);
  const q = new ApprovalQueue();
  console.log(`    step 6: send_email → ${q.request("c6", "Send refund confirmation to ana@customer.com")}`);
  console.log(`    worker releases its lease and exits. outstanding approvals: ${q.outstanding}`);
  console.log(`    …40 minutes later, in a different process:`);
  q.decide("c6", true, "alice@support");
  console.log(`    decision appended to the log; the run is re-queued and ANY worker resumes it.`);
  console.log(`    outstanding: ${q.outstanding} · events: ${q.events.map((e) => e.t).join(" → ")}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
