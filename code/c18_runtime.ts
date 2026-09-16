/**
 * C18 · The Agent Runtime — AgentId, TopicId, TypeSubscription, RoutedAgent and
 * a single-threaded runtime with ordered per-instance mailboxes.
 *   node --experimental-strip-types code/c18_runtime.ts
 */

export interface AgentId { type: string; key: string }
export const agentId = (type: string, key = "default"): AgentId => ({ type, key });
export const idStr = (id: AgentId): string => `${id.type}/${id.key}`;

export interface TopicId { type: string; source: string }
export const topicId = (type: string, source = "default"): TopicId => ({ type, source });

export interface Message { type: string; [k: string]: unknown }
export interface MessageContext { sender?: AgentId; hops: number; path: string[]; runId: string }

export const MAX_HOPS = 8;
export class HopLimit extends Error {
  readonly path: string[];
  constructor(path: string[]) { super(`hop limit reached: ${path.join(" → ")}`); this.name = "HopLimit"; this.path = path; }
}
export class UnknownAgentType extends Error {}

/** A TypeSubscription maps topic TYPE → agent TYPE, carrying source → key. */
export interface Subscription { matches(t: TopicId): boolean; mapTo(t: TopicId): AgentId }
export const TypeSubscription = (topicType: string, agentType: string): Subscription => ({
  matches: (t) => t.type === topicType,
  mapTo: (t) => agentId(agentType, t.source),
});

export abstract class RoutedAgent {
  readonly id: AgentId;
  protected readonly rt: Runtime;
  constructor(id: AgentId, rt: Runtime) { this.id = id; this.rt = rt; }
  async onMessage(msg: Message, ctx: MessageContext): Promise<unknown> {
    const handler = (this as any)[`on${msg.type}`];
    if (typeof handler !== "function") return undefined;     // unhandled is not an error
    return handler.call(this, msg, ctx);
  }
  restore(_state: unknown): void {}
  snapshot(): unknown { return {}; }
}

export interface Trace { kind: "create" | "send" | "publish" | "deliver" | "dead"; detail: string }

export class Runtime {
  private factories = new Map<string, (id: AgentId, rt: Runtime) => RoutedAgent>();
  private instances = new Map<string, RoutedAgent>();
  private subs: Subscription[] = [];
  private mailboxes = new Map<string, Promise<unknown>>();
  private snapshots = new Map<string, unknown>();
  private queue: Array<{ msg: Message; to: AgentId; ctx: MessageContext }> = [];
  readonly trace: Trace[] = [];
  deadLetters: Array<{ msg: Message; reason: string; path: string[] }> = [];

  register(type: string, factory: (id: AgentId, rt: Runtime) => RoutedAgent): void { this.factories.set(type, factory); }
  subscribe(s: Subscription): void { this.subs.push(s); }
  get liveInstances(): string[] { return [...this.instances.keys()].sort(); }

  private instance(id: AgentId): RoutedAgent {
    const k = idStr(id);
    let a = this.instances.get(k);
    if (!a) {
      const f = this.factories.get(id.type);
      if (!f) throw new UnknownAgentType(id.type);
      a = f(id, this);
      // Rehydrate an evicted instance from its snapshot.
      if (this.snapshots.has(k)) a.restore(this.snapshots.get(k));
      this.instances.set(k, a);
      this.trace.push({ kind: "create", detail: k });
    }
    return a;
  }

  /**
   * DIRECT SEND — request/response. Chains onto the recipient's mailbox so
   * messages to one instance never interleave, which is what makes `this.attempts++`
   * safe without a mutex.
   *
   * DEADLOCK HAZARD, and it is easy to hit: awaiting a send that cycles back to an
   * agent currently executing a handler waits on that agent's own mailbox — which is
   * waiting on you. Request/response must not form a cycle. Broadcasts avoid this by
   * being enqueued rather than awaited (see publish below), which is why real actor
   * runtimes make publish fire-and-forget.
   */
  async send<T = unknown>(msg: Message, to: AgentId, ctx?: Partial<MessageContext>): Promise<T> {
    const c: MessageContext = { hops: 0, path: [], runId: "r", ...ctx };
    if (c.hops >= MAX_HOPS) { this.deadLetters.push({ msg, reason: "hop limit", path: c.path }); throw new HopLimit(c.path); }
    const k = idStr(to);
    this.trace.push({ kind: "send", detail: `${c.sender ? idStr(c.sender) : "(external)"} → ${k}  ${msg.type}` });

    const prev = this.mailboxes.get(k) ?? Promise.resolve();
    const next = prev.then(() =>
      this.instance(to).onMessage(msg, { ...c, sender: c.sender, hops: c.hops + 1, path: [...c.path, k] }));
    // Without this catch, one thrown handler wedges that agent's mailbox forever.
    this.mailboxes.set(k, next.catch(() => {}));
    return next as Promise<T>;
  }

  /**
   * BROADCAST — enqueued, not awaited. The publisher does not know who receives it
   * and gets no reply, so there is nothing to wait for; and enqueueing is what makes
   * choreographed cycles (coder → reviewer → coder) possible without deadlock.
   * Returns the number of subscribers the message was queued for.
   */
  publish(msg: Message, topic: TopicId, ctx?: Partial<MessageContext>): number {
    const c: MessageContext = { hops: 0, path: [], runId: "r", ...ctx };
    const targets = this.subs.filter((s) => s.matches(topic)).map((s) => s.mapTo(topic));
    const unique = [...new Map(targets.map((t) => [idStr(t), t])).values()]
      // An agent that publishes to a topic it subscribes to would loop immediately.
      .filter((t) => !c.sender || idStr(t) !== idStr(c.sender));
    this.trace.push({ kind: "publish", detail: `${c.sender ? idStr(c.sender) : "(external)"} → ${topic.type}/${topic.source}  ${msg.type}  (${unique.length} subscriber${unique.length === 1 ? "" : "s"})` });
    for (const t of unique) this.queue.push({ msg, to: t, ctx: c });
    return unique.length;                // 0 is silent, and correct — nobody cared
  }

  /** Process every queued delivery, including those produced while draining. */
  async drain(): Promise<void> {
    let processed = 0;
    while (this.queue.length) {
      if (++processed > 500) {
        this.deadLetters.push({ msg: this.queue[0].msg, reason: "delivery cap", path: this.queue[0].ctx.path });
        this.queue.length = 0;
        break;
      }
      const { msg, to, ctx } = this.queue.shift()!;
      if (ctx.hops >= MAX_HOPS) {
        this.deadLetters.push({ msg, reason: "hop limit", path: ctx.path });
        continue;
      }
      try { await this.send(msg, to, ctx); } catch { /* dead-lettered above */ }
    }
  }

  /** Eviction is safe only if all state is derivable from the snapshot. */
  evict(id: AgentId): boolean {
    const k = idStr(id);
    const a = this.instances.get(k);
    if (!a) return false;
    this.snapshots.set(k, a.snapshot());
    this.instances.delete(k);
    return true;
  }
}

/* ---------------- agents ---------------- */

class Triage extends RoutedAgent {
  async onIssueOpened(_m: Message, ctx: MessageContext) {
    return this.rt.send({ type: "CodeRequest", brief: `fix ${this.id.key}` }, agentId("coder", this.id.key), { ...ctx, sender: this.id });
  }
}

class Coder extends RoutedAgent {
  private attempts = 0;                              // per-instance: one coder per issue
  snapshot() { return { attempts: this.attempts }; }
  restore(s: any) { this.attempts = s?.attempts ?? 0; }

  async onCodeRequest(_m: Message, ctx: MessageContext) {
    this.attempts++;
    this.rt.publish({ type: "PatchReady", attempt: this.attempts }, topicId("patch_ready", this.id.key), { ...ctx, sender: this.id });
    return { attempts: this.attempts };
  }
  async onReviewFailed(m: Message, ctx: MessageContext) {
    if (this.attempts >= 3) {
      return this.rt.publish({ type: "Escalate", why: m.reason }, topicId("needs_human", this.id.key), { ...ctx, sender: this.id });
    }
    return this.onCodeRequest({ type: "CodeRequest" }, ctx);
  }
}

class Reviewer extends RoutedAgent {
  private seen = 0;
  private alwaysReject: boolean;
  constructor(id: AgentId, rt: Runtime, alwaysReject = false) { super(id, rt); this.alwaysReject = alwaysReject; }
  async onPatchReady(m: Message, ctx: MessageContext) {
    this.seen++;
    if (this.alwaysReject || (m.attempt as number) < 2) {
      return this.rt.publish({ type: "ReviewFailed", reason: "tests still failing" }, topicId("review_failed", this.id.key), { ...ctx, sender: this.id });
    }
    return "APPROVED";
  }
}

class Auditor extends RoutedAgent {
  seen = 0;
  async onPatchReady() { this.seen++; return "logged"; }
  snapshot() { return { seen: this.seen }; }
  restore(s: any) { this.seen = s?.seen ?? 0; }
}

class Human extends RoutedAgent { escalations = 0; async onEscalate() { this.escalations++; return "queued"; } }

function build(alwaysReject = false): Runtime {
  const rt = new Runtime();
  rt.register("triage", (id, r) => new Triage(id, r));
  rt.register("coder", (id, r) => new Coder(id, r));
  rt.register("reviewer", (id, r) => new Reviewer(id, r, alwaysReject));
  rt.register("auditor", (id, r) => new Auditor(id, r));
  rt.register("human", (id, r) => new Human(id, r));
  rt.subscribe(TypeSubscription("issue_opened", "triage"));
  rt.subscribe(TypeSubscription("patch_ready", "reviewer"));
  rt.subscribe(TypeSubscription("patch_ready", "auditor"));
  rt.subscribe(TypeSubscription("review_failed", "coder"));
  rt.subscribe(TypeSubscription("needs_human", "human"));
  return rt;
}

/* ---------------- demo ---------------- */

async function main(): Promise<void> {
  console.log("\n  C18 · The Agent Runtime\n");

  const rt = build();
  rt.publish({ type: "IssueOpened" }, topicId("issue_opened", "issue-41"));
  await rt.drain();
  console.log("  routing trace for one issue:\n");
  for (const t of rt.trace) console.log(`    ${t.kind.padEnd(8)} ${t.detail}`);
  console.log(`\n    The topic SOURCE became the agent KEY, so reviewer/issue-41 and`);
  console.log(`    auditor/issue-41 were created on demand. Nobody wrote a registry.`);

  // Two concurrent issues, isolated state.
  const rt2 = build();
  rt2.publish({ type: "IssueOpened" }, topicId("issue_opened", "issue-41"));
  rt2.publish({ type: "IssueOpened" }, topicId("issue_opened", "issue-77"));
  await rt2.drain();
  console.log(`\n  two issues concurrently → ${rt2.liveInstances.length} instances, zero shared state:\n`);
  console.log(`    ${rt2.liveInstances.join("   ")}`);

  // No subscribers: silent and correct, and a real operational hazard.
  const orphan = rt2.publish({ type: "Whatever" }, topicId("nobody_listens", "x"));
  console.log(`\n  publish to a topic with no subscriptions → delivered to ${orphan} agents, no error.`);
  console.log(`  A publisher cannot distinguish "nobody cared" from "the subscription was never`);
  console.log(`  registered" — which is why you instrument subscriber counts per topic.`);

  // An accidental cycle.
  const cyc = build(true);
  let hopError = "";
  try { cyc.publish({ type: "IssueOpened" }, topicId("issue_opened", "issue-99")); await cyc.drain(); }
  catch (e) { hopError = (e as Error).message; }
  const escalated = (cyc as any).instances?.size ?? 0;
  console.log(`\n  accidental cycle (reviewer always rejects):`);
  console.log(`    coder publishes → reviewer rejects → coder republishes …`);
  console.log(`    ${cyc.deadLetters.length ? `dead-lettered at the hop limit: ${cyc.deadLetters[0].path.slice(-4).join(" → ")}` : "escalated to a human after 3 attempts"}`);
  console.log(`    No agent behaved incorrectly. Only the runtime can see the loop.`);

  // Eviction and rehydration.
  const rt3 = build();
  rt3.publish({ type: "IssueOpened" }, topicId("issue_opened", "issue-41"));
  await rt3.drain();
  const before = (rt3 as any).instances.get("auditor/issue-41") as Auditor;
  console.log(`\n  eviction and rehydration:`);
  console.log(`    auditor/issue-41 has seen ${before.seen} patch(es)`);
  rt3.evict(agentId("auditor", "issue-41"));
  console.log(`    evicted — live instances: ${rt3.liveInstances.length}`);
  rt3.publish({ type: "PatchReady", attempt: 3 }, topicId("patch_ready", "issue-41"));
  await rt3.drain();
  const after = (rt3 as any).instances.get("auditor/issue-41") as Auditor;
  console.log(`    next message addressed to it rehydrated from the snapshot: seen = ${after.seen}`);
  console.log(`\n  That works only because all of the agent's state is in snapshot()/restore().`);
  console.log(`  State held outside it is lost silently on eviction — the requirement this layer imposes.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
