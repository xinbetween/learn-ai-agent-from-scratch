import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const RUNTIME_SVG = `
<svg viewBox="0 0 700 320" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="An agent runtime: direct send by AgentId, and broadcast by TopicId through subscriptions">
  <defs><marker id="r18" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="r18a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker></defs>

  <text x="14" y="18" class="d-label">IDENTITY = (TYPE, KEY) — THE RUNTIME CREATES INSTANCES ON DEMAND</text>

  <rect x="14" y="30" width="672" height="106" rx="8" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="50" class="d-label" fill="var(--fg-faint)">AGENT RUNTIME — owns lifecycle, routing, delivery</text>

  <rect x="30" y="60" width="128" height="30" rx="4" class="d-box-a"/>
  <text x="94" y="80" class="d-mono" text-anchor="middle">triage / issue-41</text>
  <rect x="170" y="60" width="128" height="30" rx="4" class="d-box-a"/>
  <text x="234" y="80" class="d-mono" text-anchor="middle">triage / issue-77</text>
  <rect x="310" y="60" width="128" height="30" rx="4" class="d-box-t"/>
  <text x="374" y="80" class="d-mono" text-anchor="middle">coder / issue-41</text>
  <rect x="450" y="60" width="128" height="30" rx="4" class="d-box-p"/>
  <text x="514" y="80" class="d-mono" text-anchor="middle">reviewer / default</text>
  <rect x="590" y="60" width="80" height="30" rx="4" class="d-box" stroke-dasharray="2 2"/>
  <text x="630" y="80" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">…on demand</text>

  <text x="30" y="110" class="d-mono" fill="var(--fg-faint)">same TYPE (behaviour, tools, prompt) · different KEY (isolated state, own mailbox)</text>
  <text x="30" y="128" class="d-mono" fill="var(--accent)">two issues → two triage instances → no shared context, no cross-talk</text>

  <line x1="14" y1="152" x2="686" y2="152" stroke="var(--border)"/>
  <text x="14" y="174" class="d-label">TWO WAYS TO SEND</text>

  <rect x="14" y="186" width="322" height="118" rx="8" class="d-box"/>
  <text x="26" y="206" class="d-mono">DIRECT · send(msg, to: AgentId)</text>
  <rect x="30" y="218" width="88" height="26" rx="4" class="d-box-a"/><text x="74" y="236" class="d-mono" text-anchor="middle">lead</text>
  <path d="M122 231 L186 231" class="d-arrow-a" marker-end="url(#r18a)"/>
  <rect x="190" y="218" width="130" height="26" rx="4" class="d-box-t"/><text x="255" y="236" class="d-mono" text-anchor="middle">coder / issue-41</text>
  <text x="26" y="262" class="d-mono" fill="var(--fg-faint)">one recipient, named. returns a reply.</text>
  <text x="26" y="280" class="d-mono" fill="var(--fg-faint)">this is C17's asTool() with an address.</text>
  <text x="26" y="298" class="d-mono" fill="var(--ok)">use for: "you, do this, tell me the answer"</text>

  <rect x="350" y="186" width="336" height="118" rx="8" class="d-box"/>
  <text x="362" y="206" class="d-mono">BROADCAST · publish(msg, to: TopicId)</text>
  <rect x="364" y="218" width="88" height="26" rx="4" class="d-box-a"/><text x="408" y="236" class="d-mono" text-anchor="middle">coder</text>
  <path d="M456 231 L486 219" class="d-arrow" marker-end="url(#r18)"/>
  <path d="M456 231 L486 243" class="d-arrow" marker-end="url(#r18)"/>
  <rect x="490" y="208" width="188" height="22" rx="3" class="d-box-p"/><text x="584" y="224" class="d-mono" text-anchor="middle">reviewer (subscribed)</text>
  <rect x="490" y="234" width="188" height="22" rx="3" class="d-box-p"/><text x="584" y="250" class="d-mono" text-anchor="middle">auditor (subscribed)</text>
  <text x="362" y="274" class="d-mono" fill="var(--fg-faint)">topic ("patch_ready", "issue-41") →</text>
  <text x="362" y="292" class="d-mono" fill="var(--fg-faint)">TypeSubscription maps type→type, source→key</text>
  <text x="362" y="310" class="d-mono" fill="var(--ok)">use for: "this happened, whoever cares</text>
</svg>`;

const chapter: Chapter = {
  id: "c18",
  num: 18,
  layer: "systems",
  title: "The Agent Runtime",
  subtitle: "Actors, identities, topics and subscriptions",
  blurb:
    "Underneath every serious multi-agent framework is a message-passing runtime. Building one — AgentId, TopicId, subscriptions, direct send versus broadcast — following the design AutoGen settled on, and why it scales to separate processes.",
  lines: 267,
  file: "code/c18_runtime.ts",
  tags: ["actor model", "AgentId", "TopicId", "subscriptions", "pub/sub", "message routing", "AutoGen", "distributed"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "Where the call tree runs out",
      html:
        p(`${ch("c17", "C17")} wrapped agents as tools, which is a call tree: the parent calls the child, waits, and gets a string. That is the right default and it has four hard limits.`) +
        ol([
          `<strong>No identity.</strong> Two concurrent issues each need their own triage state. A function call has no notion of "the triage agent <em>for issue 41</em>", so you end up threading an id through every call by hand.`,
          `<strong>No events.</strong> A worker that finishes cannot tell an auditor. It can only return to whoever called it, and the caller must know to forward.`,
          `<strong>No fan-out without a coordinator.</strong> "Whoever cares about a new patch should look at it" requires the publisher to know every subscriber.`,
          `<strong>No process boundary.</strong> A call tree lives in one process. Scaling out, or running a tool-heavy agent in a different language, means rewriting the coordination.`,
        ]) +
        p(`The answer is forty years old: <strong>the actor model</strong>. Agents are actors with addresses and mailboxes; the runtime owns identity, routing and lifecycle. AutoGen's <code>autogen-core</code> is built on exactly this, and its design is worth following closely because it is the one that made the same agent code run standalone and distributed unchanged.`) +
        note("key", "The payoff to keep in view", p(`Once agents are addressed rather than called, moving one to another process is a routing change, not a rewrite. That property is why this layer exists, and it is invisible until you need it.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Identity, and two ways to send",
      html:
        fig({ label: "Diagram", title: "the runtime, instances, and both send modes", body: RUNTIME_SVG,
          caption: `The (type, key) split is the piece that does the most work: one registered behaviour, many isolated instances, created on demand.` }) +
        `<h3>AgentId = (type, key)</h3>` +
        code({ title: "code/c18_runtime.ts — identity",
          src: `export interface AgentId { type: string; key: string }
export const agentId = (type: string, key = "default"): AgentId => ({ type, key });

// TYPE is the behaviour you registered: prompt, tools, message handlers.
// KEY is the instance: its own state, its own mailbox, isolated from siblings.
//
//   agentId("triage", "issue-41")   ← state for issue 41
//   agentId("triage", "issue-77")   ← a different agent, same behaviour
//   agentId("reviewer")             ← a singleton, key "default"
//
// The runtime creates an instance the first time one is addressed. You never
// construct agents; you address them.`,
        }) +
        p(`This is why the runtime, not your code, owns lifecycle. Sending to <code>("triage", "issue-41")</code> creates that instance if it does not exist. Concurrency becomes a naming question rather than a locking question.`) +
        `<h3>Direct send: one named recipient, a reply</h3>` +
        code({ title: "request/response, with an address",
          src: `const review = await runtime.send<ReviewResult>(
  { type: "ReviewRequest", patch, issue: "41" },
  agentId("reviewer"),
  { sender: self, signal },
);
// Blocks until the recipient's handler returns. This is C17's asTool() —
// the difference is that the recipient is addressed rather than called, so it
// may live in another process without any change here.`,
        }) +
        `<h3>Broadcast: a topic, and whoever subscribed</h3>` +
        code({ title: "publish/subscribe, and the mapping rule",
          src: `export interface TopicId { type: string; source: string }   // rendered "type/source"

// A TypeSubscription maps a topic TYPE to an agent TYPE, and carries the topic
// SOURCE across as the agent KEY. That one rule is the whole routing model:
//
//   subscription: TypeSubscription({ topicType: "patch_ready", agentType: "reviewer" })
//   publish to:   TopicId("patch_ready", "issue-41")
//   delivers to:  AgentId("reviewer", "issue-41")     ← source becomes key
//
// So per-issue reviewers appear automatically, with isolated state, because the
// topic source names the thing the work is about.

await runtime.publish({ type: "PatchReady", patch }, topicId("patch_ready", "issue-41"));
// The publisher does not know who receives this. Zero subscribers is not an error.`,
        }) +
        p(`That mapping rule is the cleverest part of the design and the easiest to miss. The topic's <em>source</em> is usually a business identifier — an issue number, a customer id, a run id — and carrying it into the agent key means the runtime automatically gives you one isolated agent per business entity, without any registry of instances.`) +
        table(["", "Direct send", "Broadcast"], [
          ["Recipient", "One, named", "Whoever subscribed — the publisher does not know"],
          ["Reply", "Yes, awaited", "No"],
          ["Coupling", "Sender knows the recipient", "Both know only the topic"],
          ["Use for", "\"You, do this, tell me\"", "\"This happened\""],
          ["Failure of none", "Error — the agent type is unknown", "Silent, and correct: nobody cared"],
        ]) },

    { id: "mechanics", kicker: "Mechanics", title: "Handlers, and what the runtime owes you",
      html:
        code({ title: "a routed agent",
          src: `export abstract class RoutedAgent {
  constructor(public readonly id: AgentId, protected readonly rt: Runtime) {}

  /** Dispatch on message type. State lives on \`this\` and is per-instance. */
  async onMessage(msg: Message, ctx: MessageContext): Promise<unknown> {
    const handler = (this as any)[\`on\${msg.type}\`];
    if (!handler) return undefined;          // unhandled is not an error
    return handler.call(this, msg, ctx);
  }
}

class Coder extends RoutedAgent {
  private attempts = 0;                       // per-instance: one coder per issue

  async onCodeRequest(msg: CodeRequest, ctx: MessageContext) {
    this.attempts++;
    const patch = await runAgent(msg.brief, { ...CODER_CFG, signal: ctx.signal });

    // Tell whoever cares. No coordinator, no list of recipients.
    await this.rt.publish({ type: "PatchReady", patch, attempt: this.attempts },
                          topicId("patch_ready", this.id.key));

    return { ok: true };                      // the direct reply to the sender
  }

  async onReviewFailed(msg: ReviewFailed, ctx: MessageContext) {
    if (this.attempts >= 3) {
      return this.rt.publish({ type: "Escalate", issue: this.id.key, why: msg.reason },
                             topicId("needs_human", this.id.key));   // C16
    }
    return this.onCodeRequest({ type: "CodeRequest", brief: msg.reason }, ctx);
  }
}`,
        }) +
        p(`Note what disappeared. There is no orchestrator deciding that a failed review should go back to the coder. The coder subscribed to <code>review_failed</code> and handles it. Choreography rather than orchestration, which is more flexible and, as the next section admits, harder to reason about.`) +
        `<h3>What the runtime must provide</h3>` +
        ul([
          `<strong>Lifecycle.</strong> Create on first address, idle-evict, and rehydrate state on the next message (from ${ch("c08", "C08")}'s log).`,
          `<strong>Ordered per-instance delivery.</strong> One mailbox per agent, processed in order. This is what makes <code>this.attempts++</code> safe without a mutex.`,
          `<strong>Cancellation.</strong> A token that propagates to every message sent downstream of a cancelled one.`,
          `<strong>Cycle protection.</strong> A hop-count on every message, and a refusal past a limit. Choreographed systems produce cycles by accident.`,
          `<strong>Dead letters.</strong> A message to an unknown type, or a handler that throws, must land somewhere visible rather than vanishing.`,
        ]) +
        code({ title: "single-threaded runtime: the mailbox is the concurrency model",
          src: `export class SingleThreadedRuntime implements Runtime {
  private factories = new Map<string, (id: AgentId, rt: Runtime) => RoutedAgent>();
  private instances = new Map<string, RoutedAgent>();          // "type/key"
  private subs: Subscription[] = [];
  private mailboxes = new Map<string, Promise<unknown>>();     // per-instance serialisation

  register(type: string, factory: (id: AgentId, rt: Runtime) => RoutedAgent): void {
    this.factories.set(type, factory);
  }

  private instance(id: AgentId): RoutedAgent {
    const k = \`\${id.type}/\${id.key}\`;
    let a = this.instances.get(k);
    if (!a) {
      const f = this.factories.get(id.type);
      if (!f) throw new UnknownAgentType(id.type);
      this.instances.set(k, (a = f(id, this)));                // created on demand
    }
    return a;
  }

  async send<T>(msg: Message, to: AgentId, ctx: SendCtx): Promise<T> {
    if (ctx.hops >= MAX_HOPS) throw new HopLimit(msg, ctx.trace);
    const k = \`\${to.type}/\${to.key}\`;
    // Chain onto this instance's mailbox: messages to one agent never interleave.
    const prev = this.mailboxes.get(k) ?? Promise.resolve();
    const next = prev.then(() => this.instance(to).onMessage(msg, { ...ctx, hops: ctx.hops + 1 }));
    this.mailboxes.set(k, next.catch(() => {}));               // a failure must not block the mailbox
    return next as Promise<T>;
  }

  async publish(msg: Message, topic: TopicId, ctx: SendCtx): Promise<void> {
    const targets = this.subs
      .filter((s) => s.matches(topic))
      .map((s) => s.mapTo(topic));                             // source → key
    // Deduplicate: a subscriber matched twice must still receive exactly once.
    const unique = dedupeById(targets).filter((t) => !sameAgent(t, ctx.sender));
    await Promise.allSettled(unique.map((t) => this.send(msg, t, ctx)));
  }
}`,
        }) +
        note("warn", "Two lines that are not optional", p(`<code>.catch(() => {})</code> on the stored mailbox promise. Without it, one thrown handler wedges that agent forever. And excluding the sender from its own broadcasts. Without it, an agent that publishes to a topic it subscribes to loops immediately.`)) +
        `<h3>Distribution is a routing change</h3>` +
        p(`Because agents are addressed, the same agent code runs unchanged when the runtime routes over the network: a host process holds the subscription registry, workers connect and declare which types they serve, and <code>send</code> becomes an RPC. AutoGen's distributed runtime is precisely this, and the fact that agent implementations do not change is the headline property.`) },

    { id: "explore", kicker: "Explore", title: "Route messages through a live runtime",
      html:
        p(`Configure subscriptions and send a message. Watch the routing, the instance creation, and the cycles you create by accident.`) +
        lab({ label: "Simulator", title: "message routing and instance lifecycle",
          body: `
<div class="controls">
  <div class="ctl"><label>scenario</label>
    <select id="r18-s">
      <option value="direct">direct send: lead → coder</option>
      <option value="pub" selected>publish: patch_ready / issue-41</option>
      <option value="multi">two issues in flight</option>
      <option value="cycle">accidental cycle</option>
      <option value="none">publish with no subscribers</option>
    </select></div>
  <div class="ctl"><label>reviewer subscribes to patch_ready</label><select id="r18-rv"><option value="1" selected>yes</option><option value="0">no</option></select></div>
  <div class="ctl"><label>auditor subscribes to patch_ready</label><select id="r18-au"><option value="1" selected>yes</option><option value="0">no</option></select></div>
  <div class="ctl"><label>hop limit</label><input type="range" id="r18-h" min="2" max="20" step="1" value="8"><span class="val" id="r18-h-v">8</span></div>
</div>
<div class="trace" id="r18-trace" style="max-height:15rem"></div>
<div class="stats">
  <div class="stat"><b id="r18-inst">—</b><span>instances alive</span></div>
  <div class="stat"><b id="r18-msg">—</b><span>messages delivered</span></div>
  <div class="stat"><b id="r18-dead">—</b><span>dead letters</span></div>
</div>
<div class="note" id="r18-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var s = document.getElementById("r18-s").value, rv = document.getElementById("r18-rv").value === "1",
      au = document.getElementById("r18-au").value === "1", H = +document.getElementById("r18-h").value;
  document.getElementById("r18-h-v").textContent = H;

  var L = [], inst = {}, msgs = 0, dead = 0;
  function touch(t, k) { var id = t + "/" + k; if (!inst[id]) { inst[id] = 1; L.push(["sys", "CREATE  " + id + "   (first message addressed to it)"]); } return id; }
  function deliver(from, to, m) { msgs++; L.push(["act", "send    " + from + " → " + to + "   " + m]); }
  function pub(from, topic, m) {
    L.push(["think", "publish " + from + " → topic " + topic + "   " + m]);
    var src = topic.split("/")[1], subs = [];
    if (rv) subs.push(["reviewer", src]); if (au) subs.push(["auditor", src]);
    if (!subs.length) { L.push(["r-sys", "        no subscriptions match — delivered to 0 agents (not an error)"]); return; }
    subs.forEach(function (x) { var id = touch(x[0], x[1]); deliver("(topic)", id, m); });
  }

  if (s === "direct") {
    touch("lead", "default"); var c = touch("coder", "issue-41");
    deliver("lead/default", c, "CodeRequest{issue:41}");
    L.push(["obs", "reply   " + c + " → lead/default   {ok:true}"]);
  } else if (s === "pub") {
    var c2 = touch("coder", "issue-41");
    L.push(["obs", "        coder/issue-41 finished a patch"]);
    pub(c2, "patch_ready/issue-41", "PatchReady{attempt:1}");
    L.push(["r-sys", "        TypeSubscription(patch_ready → reviewer) mapped source 'issue-41' to key 'issue-41'"]);
  } else if (s === "multi") {
    ["issue-41", "issue-77"].forEach(function (k) {
      var c3 = touch("coder", k);
      pub(c3, "patch_ready/" + k, "PatchReady{}");
    });
    L.push(["r-sys", "        note: two coder instances, two reviewer instances, zero shared state"]);
  } else if (s === "cycle") {
    var a = touch("coder", "issue-41");
    var hop = 0;
    while (hop < H) {
      hop++;
      pub("coder/issue-41", "patch_ready/issue-41", "PatchReady (hop " + hop + ")");
      if (!rv) break;
      L.push(["err", "        reviewer/issue-41 publishes review_failed → coder resubmits"]);
      if (hop >= H) { L.push(["err", "HOP LIMIT " + H + " reached — message refused, dead-lettered"]); dead++; }
    }
  } else {
    var c4 = touch("coder", "issue-41");
    pub(c4, "patch_ready/issue-41", "PatchReady{}");
  }

  document.getElementById("r18-trace").innerHTML = L.map(function (l) {
    return '<span class="ln r-' + (l[0] === "sys" ? "sys" : l[0] === "err" ? "err" : l[0] === "obs" ? "obs" : l[0] === "think" ? "think" : l[0] === "r-sys" ? "sys" : "act") + '">' + l[1] + '</span>';
  }).join("");
  document.getElementById("r18-inst").textContent = Object.keys(inst).length;
  document.getElementById("r18-msg").textContent = msgs;
  document.getElementById("r18-dead").textContent = dead;

  var n = document.getElementById("r18-note");
  if (s === "none" || (!rv && !au)) n.innerHTML = "<b>No subscribers.</b> The message is delivered to nobody and nothing errors — which is correct for pub/sub, and a real operational hazard. A publisher cannot tell the difference between 'nobody cared' and 'the subscription was never registered'. Log subscriber counts per topic.";
  else if (s === "multi") n.innerHTML = "<b>Two issues, four instances.</b> The topic source became the agent key, so each issue got its own coder and reviewer with isolated state and its own ordered mailbox. Nobody wrote a registry — this fell out of the TypeSubscription mapping rule.";
  else if (s === "cycle") n.innerHTML = "<b>An accidental cycle.</b> Coder publishes, reviewer rejects, coder republishes. No single agent is wrong, and the system never stops. The hop limit is the backstop — choreographed systems need one, because nobody owns termination.";
  else if (s === "direct") n.innerHTML = "<b>Direct send.</b> One named recipient, one reply — C17's asTool() with an address. The difference is invisible here and decisive later: coder/issue-41 could be in another process.";
  else n.innerHTML = "<b>Broadcast.</b> The coder does not know who is listening. Adding an auditor requires no change to the coder — that is the decoupling you are buying, and the debuggability you are paying with.";
}
["r18-s","r18-rv","r18-au","r18-h"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Run the "accidental cycle" scenario. Nothing in it is wrong: each agent responds sensibly to the message it received. Cycles are the characteristic failure of choreography, and only the runtime can catch them.`,
        }) },

    { id: "build", kicker: "Build it", title: "Teams on top of the runtime",
      html:
        p(`AutoGen's layering is worth copying: a low-level runtime, and an opinionated team API above it. ${ch("c17", "C17")}'s topologies are thin once the runtime exists.`) +
        code({ title: "code/c18_runtime.ts — round-robin and selector, on one primitive",
          src: `export class RoundRobinTeam {
  constructor(private members: AgentId[], private rt: Runtime, private stop: Termination) {}

  async run(task: string): Promise<TaskResult> {
    const transcript: Message[] = [userText(task)];
    for (let turn = 0; ; turn++) {
      const reason = this.stop(transcript, { turn });
      if (reason) return { transcript, stopReason: reason };

      const speaker = this.members[turn % this.members.length];
      const reply = await this.rt.send({ type: "Turn", transcript }, speaker, ctx());
      transcript.push(reply as Message);
    }
  }
}

export class SelectorTeam extends RoundRobinTeam {
  /** A model picks the next speaker from the transcript. One extra call per turn. */
  protected async next(transcript: Message[]): Promise<AgentId> {
    const { speaker } = await structured(this.model, [{ role: "user", content:
      \`Roles:\\n\${this.roles()}\\n\\nConversation:\\n\${render(transcript)}\\n\\n\` +
      \`Who should speak next? Do not pick the previous speaker unless no one else can help.\` }],
      obj({ speaker: enumOf(this.names()), why: str() }));
    return agentId(speaker);
  }
}`,
        }) +
        p(`The "do not pick the previous speaker" clause is not decoration. Selector chats collapse into one agent monologuing without it, because the model that just produced a good turn looks like the best candidate for the next one.`) +
        `<h3>Durability, from the runtime rather than in each agent</h3>` +
        code({ title: "the runtime writes the log",
          src: `// Every send and publish is an event (C08). State is a fold, so an evicted or
// crashed instance rehydrates by replaying its own mailbox.
async send(msg, to, ctx) {
  await this.log.append(ctx.runId, [{ t: "message_sent", from: ctx.sender, to, msg, hops: ctx.hops }]);
  const out = await this.deliver(msg, to, ctx);
  await this.log.append(ctx.runId, [{ t: "message_handled", to, result: summarise(out) }]);
  return out;
}

// Idle eviction becomes safe: drop the instance, keep the log.
// The next message addressed to ("triage","issue-41") replays its history and continues.`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c18_runtime.ts

#   C18 · The Agent Runtime
#
#   routing trace for one issue:
#
#     publish  (external) → issue_opened/issue-41  IssueOpened  (1 subscriber)
#     send     (external) → triage/issue-41  IssueOpened
#     create   triage/issue-41
#     send     triage/issue-41 → coder/issue-41  CodeRequest
#     create   coder/issue-41
#     publish  coder/issue-41 → patch_ready/issue-41  PatchReady  (2 subscribers)
#     send     coder/issue-41 → reviewer/issue-41  PatchReady
#     create   reviewer/issue-41
#     publish  reviewer/issue-41 → review_failed/issue-41  ReviewFailed  (1 subscriber)
#     send     coder/issue-41 → auditor/issue-41  PatchReady
#     create   auditor/issue-41
#     send     reviewer/issue-41 → coder/issue-41  ReviewFailed
#     publish  coder/issue-41 → patch_ready/issue-41  PatchReady  (2 subscribers)
#     send     coder/issue-41 → reviewer/issue-41  PatchReady
#     send     coder/issue-41 → auditor/issue-41  PatchReady
#
#     The topic SOURCE became the agent KEY, so reviewer/issue-41 and
#     auditor/issue-41 were created on demand. Nobody wrote a registry.
#
#   two issues concurrently → 8 instances, zero shared state:
#
#     auditor/issue-41   auditor/issue-77   coder/issue-41   coder/issue-77   reviewer/issue-41   reviewer/issue-77   triage/issue-41   triage/issue-77
#
#   publish to a topic with no subscriptions → delivered to 0 agents, no error.
#   A publisher cannot distinguish "nobody cared" from "the subscription was never
#   registered" — which is why you instrument subscriber counts per topic.
#
#   accidental cycle (reviewer always rejects):
# …
#   State held outside it is lost silently on eviction — the requirement this layer imposes.`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Read <code>autogen-core</code>.</strong> It is the clearest available implementation of this design: <code>AgentId</code>, <code>TopicId</code>, <code>TypeSubscription</code>, <code>RoutedAgent</code>, <code>SingleThreadedAgentRuntime</code>, and a distributed runtime with a host and workers where — the documentation is explicit about this — agents work the same way in both, so you can switch with no change to agent implementations.`,
          `<strong>The layering is the lesson.</strong> <code>autogen-core</code> for the runtime, <code>autogen-agentchat</code> for opinionated teams, <code>autogen-ext</code> for model clients and tools. Keep your own runtime free of anything opinionated about conversation; teams belong above it.`,
          `<strong>Do not build this on day one.</strong> ${ch("c17", "C17")}'s <code>asTool()</code> covers most needs. Adopt a runtime when you need per-entity agent identity, event-driven fan-out, or separate processes, and not before, because choreography is genuinely harder to debug than a call tree.`,
          `<strong>Orchestration versus choreography is a real trade.</strong> Direct sends give you a readable call tree and an obvious owner of termination. Pub/sub gives you decoupling and costs you both. A good default is orchestration for the main flow and broadcast for side-effects — auditing, notification, metrics.`,
          `<strong>Instrument subscriber counts per topic.</strong> Publishing to a topic with zero subscribers is silent and correct, which makes a missing subscription registration an invisible outage. It is the characteristic pub/sub incident.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `You publish to <code>TopicId("issue_opened", "issue-41")</code> with a subscription <code>TypeSubscription(topicType: "issue_opened", agentType: "triage")</code>. Which agent receives it, and what if you publish to <code>"issue-77"</code>?`,
      answer: p(`<code>AgentId("triage", "issue-41")</code>, created on demand if it does not exist. Publishing to <code>"issue-77"</code> reaches <code>AgentId("triage", "issue-77")</code> — a different instance with its own state and its own ordered mailbox.`) +
        p(`The rule is: <em>topic type selects the agent type; topic source becomes the agent key</em>. The consequence worth appreciating is that you get one isolated agent per business entity with no registry, no factory calls, and no id threaded through your code, as long as you choose topic sources that name the thing the work is about.`) },

    { difficulty: "core",
      prompt: `Implement idle eviction: drop an agent instance after N seconds of inactivity and rehydrate it on the next message. What must be true for this to be safe?`,
      answer: code({ title: "evict the object, keep the log",
        src: `class Runtime {
  private lastSeen = new Map<string, number>();

  private async instance(id: AgentId): Promise<RoutedAgent> {
    const k = key(id);
    let a = this.instances.get(k);
    if (!a) {
      a = this.factories.get(id.type)!(id, this);
      // Rehydrate from this instance's own event history (C08).
      const events = await this.log.readFor(id);
      if (events.length) await a.restore(project(events));
      this.instances.set(k, a);
    }
    this.lastSeen.set(k, Date.now());
    return a;
  }

  private sweep(): void {
    for (const [k, at] of this.lastSeen) {
      if (Date.now() - at < this.idleMs) continue;
      // NEVER evict an instance with a non-empty mailbox or an in-flight handler.
      if (this.mailboxDepth(k) > 0 || this.inFlight.has(k)) continue;
      this.instances.delete(k);
      this.lastSeen.delete(k);
    }
  }
}` }) +
      ul([
        `<strong>All agent state must be derivable from the log.</strong> An instance holding something not recorded — an open connection, a cached computation, a counter incremented outside a handler — loses it silently on eviction. This is the requirement that eviction imposes on your agent code, and it is worth enforcing by making state a single serialisable field.`,
        `<strong>Never evict with a pending mailbox or an in-flight handler.</strong> Otherwise a message is processed by an instance that is about to be discarded, and its effects are lost.`,
        `<strong>Rehydration must be ordered.</strong> Two concurrent messages to an evicted agent must not both trigger a restore. Cache the promise, not the instance.`,
        `<strong>Watch the cost.</strong> Replaying a long history on every wake is slow. Snapshot periodically and replay only from the snapshot — the standard event-sourcing answer.`,
      ]) },

    { difficulty: "core",
      prompt: `Design cycle detection that catches the accidental loop from the simulator without blocking legitimate multi-turn conversations.`,
      answer: p(`A hop limit alone is blunt: a legitimate ten-turn review conversation and a two-agent infinite loop both have many hops. Three signals together:`) +
        code({ title: "cheap first, then structural",
          src: `interface MsgCtx { hops: number; path: string[]; runId: string }   // path = ["coder/41","reviewer/41",…]

function checkCycle(ctx: MsgCtx, msg: Message): Violation | null {
  // 1. Hard backstop. Generous, so it only catches true runaways.
  if (ctx.hops >= MAX_HOPS) return { kind: "hop_limit", hops: ctx.hops };

  // 2. Structural repetition: the same agent appearing 3+ times in one causal path.
  //    Legitimate conversations revisit agents, so require a repeated PAIR.
  const pairs = ctx.path.slice(1).map((a, i) => \`\${ctx.path[i]}→\${a}\`);
  const repeats = countMax(pairs);
  if (repeats >= 4) return { kind: "oscillation", pair: mostCommon(pairs) };

  // 3. No new information: the same message CONTENT circulating (C04's repeat detector).
  const h = hash(canonical(msg));
  if (ctx.seen.get(h) >= 2) return { kind: "identical_message", hash: h };
  return null;
}`,
        }) +
        ul([
          `<strong>Carry the causal path, not just a counter.</strong> The path is what distinguishes a long legitimate conversation (many distinct agents) from a loop (the same pair repeatedly), and it is also what makes the trace readable afterwards.`,
          `<strong>Check content, not only structure.</strong> A coder resubmitting a byte-identical patch is looping even if the path looks varied.`,
          `<strong>Intervene rather than kill.</strong> On detection, deliver a message to the participants describing the cycle — the same move as ${ch("c04", "C04")}'s repeat detector, and for the same reason: from inside, each agent's behaviour is locally correct.`,
          `<strong>Dead-letter with the full path.</strong> A cycle report that names the sequence is diagnosable; "hop limit exceeded" is not.`,
        ]) },

    { difficulty: "stretch",
      prompt: `Move one agent type to a separate process. What has to exist that did not, and what breaks first?`,
      answer: ol([
        `<strong>A subscription registry outside both processes.</strong> Locally, subscriptions are an array. Distributed, a host must hold them and route, and workers must register their served types on connect.`,
        `<strong>Serialisation with versioning.</strong> Messages are now wire format. Agree on a schema, and version it: a rolling deploy means two versions of an agent are live simultaneously, and one will receive a message shape it does not know.`,
        `<strong>Real failure modes.</strong> Local <code>send</code> either returns or throws. Remote <code>send</code> can time out with the work still in progress — exactly ${ch("c08", "C08")}'s problem, now on every message. Handlers need to be idempotent or the protocol needs deduplication by message id.`,
        `<strong>Backpressure.</strong> An in-memory mailbox has unbounded depth and no cost. A network queue fills, and a slow agent type now stalls its publishers. Bound the queues and decide what to shed.`,
        `<strong>Distributed tracing.</strong> The causal path must cross the boundary as trace context, or ${ch("c20", "C20")} ends at the process edge.`,
      ]) +
      p(`<strong>What breaks first, in practice:</strong> ordering assumptions. The single-threaded runtime gives per-instance ordered delivery for free, and agent code quietly depends on it: <code>this.attempts++</code> is safe only because nothing interleaves. Once two workers can serve the same agent type, you need a partition key (the agent key) routing every message for one instance to one worker, plus the lease-and-fencing protocol from ${ch("c08", "C08")}. Skipping that produces state corruption that appears only under load, which is the worst possible time to discover it.`) },
  ],

  qa: [
    { q: "Is this not over-engineering for three agents?", a: p(`Yes. Three agents in one process should be ${ch("c17", "C17")}'s <code>asTool()</code>. The runtime earns its complexity when you need per-entity identity (one agent per issue, per customer, per run), event-driven fan-out, or process separation. Adopting it early buys you choreography's debugging difficulty with none of its benefits.`) },
    { q: "Direct send or publish — how do I choose?", a: p(`"You, do this, and tell me" is a direct send. "This happened" is a publish. If you find yourself publishing and then waiting for a specific reply, you wanted a send. If you find yourself sending the same message to a list you maintain, you wanted a publish.`) },
    { q: "How do agents share state?", a: p(`They do not; that is the model. Shared mutable state between actors reintroduces every concurrency problem the mailbox removed. Pass state in messages, or put it in an explicit store that agents read and write through tools, where the access is visible in the trace.`) },
    { q: "What happens if a handler throws?", a: p(`The direct sender sees a rejected promise. A broadcast must not fail the publisher, so it lands in the dead-letter log. The essential detail is that the failure must not wedge the agent's mailbox. Catch on the chained promise, or one exception stops that instance forever, silently.`) },
    { q: "Does this replace the agent loop from C04?", a: p(`No. It hosts it. An agent's message handler typically runs a full ${ch("c04", "C04")} loop internally. The runtime is about how agents find and address each other; the loop is still what turns a goal into actions.`) },
  ],

  project: {
    title: "Project · A runtime in 400 lines",
    brief: p(`Build the message-passing runtime and port your ${ch("c17", "C17")} orchestrator onto it. Then prove the property that justifies the whole layer: run two tasks concurrently with fully isolated state, and evict and rehydrate an agent mid-run.`),
    spec: [
      "<code>AgentId(type, key)</code>, <code>TopicId(type, source)</code>, and <code>TypeSubscription</code> implementing the source→key mapping.",
      "A runtime with <code>register</code>, <code>send</code>, <code>publish</code>, on-demand instance creation, and per-instance ordered mailboxes.",
      "<code>RoutedAgent</code> dispatching on message type, with unhandled messages ignored rather than erroring.",
      "Cancellation propagating through the causal chain, and a hop limit with dead-lettering that records the full path.",
      "A publisher excluded from its own broadcasts, and a mailbox that survives a throwing handler.",
      "Two concurrent tasks producing separate instance sets with zero shared state — asserted in a test.",
      "Idle eviction plus rehydration from the C08 event log, with a test that evicts mid-run and completes correctly.",
    ],
    stretch: [
      "Add <code>RoundRobinTeam</code> and <code>SelectorTeam</code> with composable termination conditions, including the 'do not pick the previous speaker' rule.",
      "Implement the three-signal cycle detector and show it catches the coder/reviewer loop while allowing a legitimate ten-turn conversation.",
      "Split one agent type into a worker process over a WebSocket, keeping the agent implementation byte-identical. Then break it deliberately: kill the worker mid-message and show recovery.",
    ],
  },

  quiz: [
    { q: "What does the (type, key) split in AgentId give you?",
      options: ["One registered behaviour with many isolated instances, created on demand — so concurrency becomes a naming question", "Type safety for message payloads", "A way to version agent implementations", "Load balancing across workers"],
      answer: 0,
      why: "Type is the behaviour you registered; key is the instance with its own state and mailbox. Addressing ('triage','issue-41') creates it if needed, so per-entity isolation requires no registry and no locking." },
    { q: "A TypeSubscription maps topic type 'patch_ready' to agent type 'reviewer'. You publish to TopicId('patch_ready', 'issue-41'). Who receives it?",
      options: ["AgentId('reviewer', 'issue-41') — the topic source becomes the agent key", "All reviewer instances", "AgentId('reviewer', 'default')", "Only an already-existing reviewer instance"],
      answer: 0,
      why: "The source carries across as the key, so choosing business identifiers as topic sources automatically yields one isolated agent per entity. It is the most useful rule in the design and the easiest to overlook." },
    { q: "When should you use publish rather than direct send?",
      options: ["When announcing that something happened and the publisher should not know who cares", "Whenever more than one agent is involved", "When you need a reply", "When the recipient is in another process"],
      answer: 0,
      why: "Direct send is 'you, do this, tell me' — one named recipient, one reply. Publish is 'this happened'. If you publish and then wait for a particular reply, you wanted a send." },
    { q: "Why must per-instance message delivery be ordered?",
      options: ["Agent state is mutated inside handlers, so interleaving would require locking that the mailbox model exists to avoid", "Messages would otherwise be lost", "The runtime cannot deduplicate out-of-order messages", "Ordering is required by the actor model specification"],
      answer: 0,
      why: "`this.attempts++` is safe only because nothing interleaves on that instance. This is also the assumption that breaks first when you distribute: without partitioning by agent key, two workers can serve one instance." },
    { q: "Publishing to a topic with no subscribers does what?",
      options: ["Delivers to nobody, silently and correctly — which makes a missing subscription an invisible outage", "Throws an unknown-topic error", "Queues until a subscriber registers", "Dead-letters the message"],
      answer: 0,
      why: "Silence is correct for pub/sub and is the characteristic operational hazard: the publisher cannot distinguish 'nobody cared' from 'the subscription was never registered'. Instrument subscriber counts per topic." },
    { q: "What property makes distribution a routing change rather than a rewrite?",
      options: ["Agents are addressed rather than called, so where an AgentId resolves is the runtime's concern", "Messages are JSON-serialisable", "Agents are stateless", "The runtime is single-threaded"],
      answer: 0,
      why: "This is the headline property of the design and the reason the layer exists. Agent implementations do not change; the host holds the subscription registry and send becomes an RPC." },
  ],

  continues: p(`You can now build one agent, many agents, and the runtime beneath them. None of it is worth anything until you can answer a simple question: <em>is it any good, and did that change make it better or worse?</em> ${ch("c19", "C19")} is about measurement, and it is the chapter that separates teams that improve their agents from teams that change them.`),
};

export default chapter;
