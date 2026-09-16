import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const MATRIX_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Sandbox mode and approval policy as two independent axes">
  <text x="14" y="18" class="d-label">TWO INDEPENDENT AXES — COLLAPSING THEM GIVES YOU A USELESS OR UNSAFE AGENT</text>

  <text x="14" y="46" class="d-mono" fill="var(--fg-faint)">approval ↓ / sandbox →</text>
  <text x="200" y="46" class="d-mono" text-anchor="middle">read-only</text>
  <text x="350" y="46" class="d-mono" text-anchor="middle">workspace-write</text>
  <text x="520" y="46" class="d-mono" text-anchor="middle">full access</text>

  <text x="14" y="76" class="d-mono">never</text>
  <rect x="140" y="58" width="120" height="30" rx="4" class="d-box-t"/><text x="200" y="78" class="d-mono" text-anchor="middle" fill="var(--ok)">safe autonomous</text>
  <rect x="290" y="58" width="120" height="30" rx="4" class="d-box"/><text x="350" y="78" class="d-mono" text-anchor="middle" fill="var(--warn)">CI agent</text>
  <rect x="460" y="58" width="120" height="30" rx="4" class="d-box" stroke="var(--danger)"/><text x="520" y="78" class="d-mono" text-anchor="middle" fill="var(--danger)">reckless</text>

  <text x="14" y="116" class="d-mono">on-failure</text>
  <rect x="140" y="98" width="120" height="30" rx="4" class="d-box-t"/><text x="200" y="118" class="d-mono" text-anchor="middle" fill="var(--ok)">research</text>
  <rect x="290" y="98" width="120" height="30" rx="4" class="d-box-a"/><text x="350" y="118" class="d-mono" text-anchor="middle" fill="var(--accent)">coding, default</text>
  <rect x="460" y="98" width="120" height="30" rx="4" class="d-box"/><text x="520" y="118" class="d-mono" text-anchor="middle" fill="var(--warn)">ops, supervised</text>

  <text x="14" y="156" class="d-mono">on-request</text>
  <rect x="140" y="138" width="120" height="30" rx="4" class="d-box"/><text x="200" y="158" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">over-cautious</text>
  <rect x="290" y="138" width="120" height="30" rx="4" class="d-box-a"/><text x="350" y="158" class="d-mono" text-anchor="middle" fill="var(--accent)">pair programming</text>
  <rect x="460" y="138" width="120" height="30" rx="4" class="d-box"/><text x="520" y="158" class="d-mono" text-anchor="middle" fill="var(--warn)">prod access</text>

  <text x="14" y="196" class="d-mono">every action</text>
  <rect x="140" y="178" width="120" height="30" rx="4" class="d-box" stroke="var(--danger)"/><text x="200" y="198" class="d-mono" text-anchor="middle" fill="var(--danger)">pointless</text>
  <rect x="290" y="178" width="120" height="30" rx="4" class="d-box" stroke="var(--danger)"/><text x="350" y="198" class="d-mono" text-anchor="middle" fill="var(--danger)">fatigue → rubber-stamp</text>
  <rect x="460" y="178" width="120" height="30" rx="4" class="d-box" stroke="var(--danger)"/><text x="520" y="198" class="d-mono" text-anchor="middle" fill="var(--danger)">fatigue → rubber-stamp</text>

  <line x1="14" y1="228" x2="686" y2="228" stroke="var(--border)"/>
  <text x="14" y="250" class="d-mono" fill="var(--danger)">the bottom row is the trap: approving everything trains the human to approve without reading,</text>
  <text x="14" y="268" class="d-mono" fill="var(--danger)">which is strictly worse than approving nothing, because now there is a signature on it.</text>
  <text x="14" y="290" class="d-mono" fill="var(--ok)">the sandbox is what makes "never ask" safe. approvals are for what the sandbox cannot contain.</text>
</svg>`;

const chapter: Chapter = {
  id: "c16",
  num: 16,
  layer: "environment",
  title: "Human in the Loop",
  subtitle: "Approvals, interrupts, and the arithmetic of alert fatigue",
  blurb:
    "Where to put the human, and how not to burn them out. Sandbox mode and approval policy as independent axes, approval as a durable state rather than a blocked process, and why asking too often is a safety failure.",
  lines: 191,
  file: "code/c16_approvals.ts",
  tags: ["approvals", "permission modes", "interrupts", "alert fatigue", "steering", "reversibility", "escalation"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The approval that everyone clicks",
      html:
        p(`An agent that asks permission for everything is not safe. It is a dialog box, and within a day the human answering it has stopped reading. You have built the worst of both worlds: the agent does whatever it wants, and there is now a human signature on every action.`) +
        p(`An agent that asks permission for nothing is also not safe, for reasons that do not need explaining.`) +
        p(`The design problem is a budget. A human will give you real attention perhaps three or four times in a session before their reading degrades to pattern matching. Spend those interruptions on the actions where a human genuinely changes the outcome, and make everything else safe by construction.`) +
        note("key", "The reframe", p(`Approvals are not a safety mechanism. <strong>The sandbox is the safety mechanism</strong> (${ch("c13", "C13")}). Approvals are for the small set of actions that reach outside it and cannot be undone. If you find yourself asking about something the sandbox already contains, you are spending attention you will need later.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Two axes, not one",
      html:
        p(`Codex's configuration makes this split explicit and it is the right model: <code>sandbox_mode</code> decides <em>what the process can reach</em>, and <code>approval_policy</code> decides <em>when a human is asked</em>. They are independent, and collapsing them is what produces agents that are either useless or unsafe.`) +
        fig({ label: "Diagram", title: "sandbox mode × approval policy", body: MATRIX_SVG,
          caption: `Read the bottom row carefully. "Approve everything" is not the safe corner; it is the corner where approval stops meaning anything.` }) +
        table(["sandbox_mode", "The process can"], [
          ["<code>read-only</code>", "Read within the workspace. No writes, no network. Safe to run unattended"],
          ["<code>workspace-write</code>", "Write inside the workspace (usually with <code>.git</code> protected), network off by default"],
          ["<code>danger-full-access</code>", "Everything the user can. Reserved for environments that are themselves disposable"],
        ]) +
        table(["approval_policy", "Asks when"], [
          ["<code>never</code>", "Never. Only defensible with a sandbox tight enough that nothing needs asking"],
          ["<code>on-failure</code>", "Something was refused by the sandbox — the agent asks to escalate for that one action"],
          ["<code>on-request</code>", "The agent decides an action warrants a human, and asks"],
          ["<em>every action</em>", "Always. Not a Codex value — included because it is what most first implementations do, and it produces fatigue, then rubber-stamping"],
        ]) +
        p(`The sandbox modes and the first three approval values are Codex's own names (its older <code>untrusted</code> value is deprecated); the fourth row is the course's. The point is the split, not the vocabulary.`) +
        `<h3>The decision rule</h3>` +
        code({ title: "code/c16_approvals.ts — three questions, in order",
          src: `export function needsApproval(call: ToolUse, tool: Tool, policy: Policy, ctx: RunCtx): Decision {
  // 1. Does the sandbox already contain it? Then do not ask. This is most calls.
  if (tool.readOnly && policy.sandbox !== "danger-full-access") return { kind: "allow" };
  if (withinSandbox(call, policy)) return { kind: "allow" };

  // 2. Is it reversible, and is the reversal cheap and certain?
  //    A file edit under git is reversible. An email is not.
  const rev = reversibility(tool, call);
  if (rev === "trivial") return { kind: "allow", note: "undoable" };

  // 3. Blast radius × reversibility decides. Ask only in the top-right corner.
  const blast = blastRadius(tool, call, ctx);        // self | workspace | org | public
  if (rev === "hard" && blast >= "org") return { kind: "ask", why: describe(tool, call, blast) };
  if (rev === "impossible" && blast >= "workspace") return { kind: "ask", why: describe(tool, call, blast) };

  // 4. Otherwise: allow, but record it prominently so it is visible in review.
  return { kind: "allow", audit: "notable" };
}`,
        }) +
        p(`Reversibility is doing more work here than severity. Deleting 400 files in a git repository is loud and completely recoverable. Sending one email to a customer is quiet and permanently not. Intuition ranks these the wrong way round, and so do most permission systems.`) +
        `<h3>Batch approvals by class, not by call</h3>` +
        p(`Asking "may I edit <code>src/auth.ts</code>?" eleven times is eleven interruptions for one decision. Ask once, for the class, with a scope and a lifetime:`) +
        code({ title: "a grant, not a click",
          src: `interface Grant {
  pattern: { tool: string; args?: Record<string, string | RegExp> };
  scope: "once" | "this-run" | "this-session" | "always";
  grantedAt: number; grantedBy: string;
  expiresAt?: number;
}
// "Allow apply_patch under src/** for this run"  → one question, eleven edits.
// "Allow shell: npm test"                        → one question, unlimited runs.
// "Allow send_email"                             → NEVER grant a standing scope to
//                                                   an irreversible external action.`,
        }) },

    { id: "mechanics", kicker: "Mechanics", title: "Approval is a state, not a blocked call",
      html:
        p(`The naive implementation blocks the loop on a promise and holds a process open while a human is at lunch. ${ch("c08", "C08")} already solved this: the approval request is an event, the process can exit, and the decision resumes the run.`) +
        code({ title: "suspend, do not block",
          src: `// In the loop, where a tool call needs approval:
const decision = await approvals.check(call, tool, policy, ctx);
if (decision.kind === "ask") {
  await log.append(runId, [{ t: "approval_requested", callId: call.id,
                             summary: decision.why, options: decision.options }]);
  await notify(user, decision);        // slack, email, a badge in the UI
  return { status: "suspended", resumeOn: \`approval:\${call.id}\` };
  // The process may now exit. Nothing is held open.
}

// Elsewhere, when the human answers — possibly in another process, hours later:
export async function onApproval(runId: string, callId: string, approved: boolean, by: string) {
  await log.append(runId, [{ t: "approval_decided", callId, approved, by }]);
  await queue.push({ runId });          // any worker can pick it up and replay
}`,
        }) +
        `<h3>What a good approval request contains</h3>` +
        p(`The difference between a reviewed approval and a rubber-stamped one is mostly the quality of the request.`) +
        code({ title: "the anatomy", lang: "text", plain: true,
          src: `┌ Approval needed ─────────────────────────────────────────────┐
│ Send an email to ana@customer.com                            │
│                                                              │
│ WHY:  You asked me to resolve ticket #882. I confirmed the   │
│       fault was reported inside the warranty window, so the  │
│       refund is due.                             [3 steps ↗] │
│                                                              │
│ WHAT: Subject: Your refund for order 4471                    │
│       Body:    Hi Ana, we've approved your refund of €340…   │
│                                              [show full ↗]   │
│                                                              │
│ RISK: External. Cannot be unsent. The customer will act on   │
│       this. No email has been sent to this address today.    │
│                                                              │
│ [Approve]  [Approve + allow email for this run]  [Edit…]     │
│ [Reject with a reason…]                                      │
└──────────────────────────────────────────────────────────────┘`,
        }) +
        ul([
          `<strong>WHY, linked to the trace.</strong> A human cannot judge an action without the reasoning, and cannot trust the reasoning without being able to check it.`,
          `<strong>WHAT, fully inspectable.</strong> Summary by default, full content one click away. An approval for content the reviewer cannot see is theatre.`,
          `<strong>RISK stated plainly</strong>, including reversibility and any relevant recent history ("no email sent to this address today" prevents the duplicate that ${ch("c08", "C08")} warns about).`,
          `<strong>Edit, not just approve or reject.</strong> Most rejections are "nearly right". Letting the human fix the draft converts a failed run into a completed one and teaches the agent from the diff.`,
          `<strong>Reject with a reason</strong>, fed back as an observation. A bare rejection leaves the agent to guess, and it will guess "try again slightly differently".`,
        ]) +
        `<h3>Fatigue is measurable, so measure it</h3>` +
        code({ title: "the metric that tells you the design is failing",
          src: `// Time-to-decision is the fatigue signal. A reviewer reading carefully takes
// 10–40 seconds. Under ~3 seconds, they are pattern-matching, not reading.
metrics.histogram("approval.decision_ms", ms, { tool: call.name });
metrics.counter("approval.instant", ms < 3_000 ? 1 : 0);

// If instant-approval rate climbs above ~30%, you are asking too often. The fix is
// never a better dialog — it is asking less, by tightening the sandbox instead.`,
        }) +
        note("warn", "The paradox worth internalising", p(`Every unnecessary approval makes the necessary ones less safe. Attention is a fixed budget per session, and spending it on things the sandbox already contains means the one request that mattered arrives to a reviewer who has been trained to click yes.`)) },

    { id: "explore", kicker: "Explore", title: "Tune the approval policy",
      html:
        p(`Set a policy and watch two things that pull against each other: harmful actions prevented, and whether the human is still reading by the end of the session.`) +
        lab({ label: "Simulator", title: "approvals, fatigue and prevented harm",
          body: `
<div class="controls">
  <div class="ctl"><label>sandbox</label>
    <select id="a16-sb"><option value="ro">read-only</option><option value="ws" selected>workspace-write</option><option value="full">full access</option></select></div>
  <div class="ctl"><label>approval policy</label>
    <select id="a16-ap"><option value="never">never</option><option value="fail">on-failure</option><option value="risk" selected>on irreversible + external</option><option value="write">every write</option><option value="all">every action</option></select></div>
  <div class="ctl"><label>batch by class</label><select id="a16-b"><option value="0">no — ask per call</option><option value="1" selected>yes — grant per class</option></select></div>
  <div class="ctl"><label>actions per session</label><input type="range" id="a16-n" min="10" max="200" step="10" value="80"><span class="val" id="a16-n-v">80</span></div>
  <div class="ctl"><label>bad actions attempted</label><input type="range" id="a16-bad" min="0" max="10" step="1" value="2"><span class="val" id="a16-bad-v">2</span></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:.5rem">
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">harmful actions prevented</div>
    <div class="meter"><i id="a16-prev" style="width:0%;background:var(--ok)"></i></div><div class="mono small muted" id="a16-prev-v">—</div></div>
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">reviewer still reading</div>
    <div class="meter"><i id="a16-att" style="width:0%;background:var(--tool)"></i></div><div class="mono small muted" id="a16-att-v">—</div></div>
</div>
<div class="stats">
  <div class="stat"><b id="a16-asks">—</b><span>approvals requested</span></div>
  <div class="stat"><b id="a16-inst">—</b><span>rubber-stamped</span></div>
  <div class="stat"><b id="a16-wall">—</b><span>human time</span></div>
  <div class="stat"><b id="a16-slip">—</b><span>bad actions that got through</span></div>
</div>
<div class="note" id="a16-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var sb = document.getElementById("a16-sb").value, ap = document.getElementById("a16-ap").value,
      batch = document.getElementById("a16-b").value === "1",
      N = +document.getElementById("a16-n").value, BAD = +document.getElementById("a16-bad").value;
  document.getElementById("a16-n-v").textContent = N;
  document.getElementById("a16-bad-v").textContent = BAD;

  // what fraction of actions the sandbox already contains
  var contained = { ro: .97, ws: .74, full: .18 }[sb];
  // how many actions the policy asks about
  var askRate = { never: 0, fail: 1 - contained, risk: 0.055, write: 0.34, all: 1 }[ap];
  var asks = Math.round(N * askRate);
  if (batch) asks = Math.max(ap === "never" ? 0 : Math.min(asks, 1), Math.round(asks * 0.22));

  // attention decays with the number of asks; ~4 good reviews per session
  var attention = Math.max(0.05, Math.exp(-Math.max(0, asks - 4) / 9));
  var instant = Math.round(asks * (1 - attention));

  // a bad action is prevented if it is either contained OR asked about AND read
  var pAsked = ap === "never" ? 0 : ap === "all" ? 1 : ap === "write" ? .85 : ap === "risk" ? .9 : (1 - contained);
  var pPrevented = Math.min(1, contained * 0.92 + (1 - contained * 0.92) * pAsked * attention);
  var slipped = Math.round(BAD * (1 - pPrevented) * 10) / 10;

  document.getElementById("a16-prev").style.width = (pPrevented * 100) + "%";
  document.getElementById("a16-prev-v").textContent = Math.round(pPrevented * 100) + "% (sandbox " + Math.round(contained * 92) + "%, human " + Math.round((pPrevented - contained * .92) * 100) + "%)";
  document.getElementById("a16-att").style.width = (attention * 100) + "%";
  document.getElementById("a16-att-v").textContent = attention > .7 ? "reading carefully" : attention > .35 ? "skimming" : "clicking yes";
  document.getElementById("a16-asks").textContent = asks;
  document.getElementById("a16-inst").textContent = instant + (asks ? " (" + Math.round((instant / asks) * 100) + "%)" : "");
  document.getElementById("a16-wall").textContent = Math.round(asks * 22) + "s";
  document.getElementById("a16-slip").textContent = slipped;

  var n = document.getElementById("a16-note");
  if (ap === "all") n.innerHTML = "<b>Approve everything.</b> " + asks + " interruptions, " + Math.round((instant / Math.max(asks, 1)) * 100) + "% of them decided in under three seconds. The reviewer is not reviewing — and their approval now appears in the audit log next to the one action that mattered.";
  else if (sb === "full" && ap === "never") n.innerHTML = "<b>No sandbox, no approvals.</b> Nothing stands between a prompt-injected instruction and your filesystem. This configuration exists in production more often than anyone admits.";
  else if (sb === "ro") n.innerHTML = "<b>Read-only sandbox.</b> The containment bar is doing almost all the work, and the human is barely needed — which is exactly the right allocation. Most research and analysis agents belong here.";
  else if (!batch && asks > 12) n.innerHTML = "<b>Per-call approvals.</b> Eleven questions for one decision about one directory. Batching by class collapses these into a single scoped grant and buys back most of the reviewer's attention.";
  else n.innerHTML = "<b>A defensible policy.</b> The sandbox contains the routine, the human sees only the irreversible-and-external, batching keeps the count low, and attention survives the session. Note where the prevention actually comes from: mostly the sandbox.";
}
["a16-sb","a16-ap","a16-b","a16-n","a16-bad"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set "every action" and watch the rubber-stamp counter. Then set "on irreversible + external" with batching: a quarter of the interruptions, and <em>more</em> harm prevented, because the reviewer is still reading when it matters.`,
        }) },

    { id: "build", kicker: "Build it", title: "Interrupts and steering",
      html:
        p(`Approvals are the agent asking. The other half is the human interrupting, and steering mid-run is usually more valuable than approving, because it happens while the work is still cheap to redirect.`) +
        code({ title: "code/c16_approvals.ts — three kinds of interrupt",
          src: `export type Interrupt =
  | { kind: "stop" }                            // cancel now, keep partial work (C12)
  | { kind: "pause" }                           // finish the current tool, then wait
  | { kind: "steer"; message: string };         // inject guidance, keep running

// In the loop, checked at the top of each iteration:
const intr = await inbox.poll(runId);
if (intr?.kind === "stop")  return degrade("cancelled", messages, cfg);
if (intr?.kind === "pause") return { status: "suspended", resumeOn: \`resume:\${runId}\` };
if (intr?.kind === "steer") {
  // Injected as a user turn — the highest-attention position (C05), and the model
  // treats it as a course correction rather than as an observation.
  messages.push(userText(\`[Guidance from the user] \${intr.message}\`));
}`,
        }) +
        p(`Steering is underbuilt in most agents and it is the cheapest quality lever available: a user who can say "no, check the staging config not production" at step 3 saves eight steps and a wrong answer. It requires only that the loop polls an inbox and that your UI streams enough for the user to notice.`) +
        `<h3>Learning from decisions</h3>` +
        code({ title: "the approval log is training data for the policy",
          src: `// Every decision, with its context, feeds back into the defaults.
interface ApprovalRecord {
  tool: string; argsShape: string;              // "apply_patch under src/**"
  approved: boolean; decisionMs: number;
  editedBefore: boolean;                        // the reviewer changed it — strong signal
  rejectionReason?: string;
}

// After a few hundred records:
//   approved 47/47 in a median of 1.9s  → stop asking. add it to the sandbox allowlist.
//   approved 12/30, 9 edited first      → keep asking, and show a diff-first UI.
//   rejected 8/8                        → the agent should not be attempting this at all;
//                                          fix the prompt or remove the tool.`,
        }) +
        p(`That first row is the important one. A category approved every time, instantly, is a category that should be in the sandbox policy instead of in front of a human. Promoting it is not a relaxation of safety; it is moving attention to where it still does something.`) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c16_approvals.ts

#   C16 · Human in the Loop
#
#   the decision, per tool — reversibility outranks apparent severity
#
#   tool               reversibility  blast       decision why
#   read_file          trivial        self        allow    contained by the sandbox
#   grep               trivial        self        allow    contained by the sandbox
#   run_tests          trivial        workspace   allow    undoable in one keystroke
#   apply_patch        trivial        workspace   allow    undoable in one keystroke
#   git_commit         cheap          workspace   allow    notable — recorded prominently in the audit log
#   git_push           hard           org         ask      git_push — hard to undo, affects org, and is visible outside this system
#   send_email         impossible     public      ask      send_email — cannot be undone, affects public, and is visible outside this system
#   delete_prod_row    impossible     org         refuse   delete_prod_row is outside the workspace-write sandbox
#
#   "delete 400 files under git" is trivially reversible and never asks.
#   "send one email" is impossible to undo and always does. Intuition ranks these backwards.
#
#   standing grants, and the one the policy refuses:
#
#     ✓ allow apply_patch for this-run
#     ✓ allow run_tests for this-session
#     ✗ allow send_email for this-session — send_email may only be approved once per call — a standing grant is refused by policy
#
#   80 actions per session, 2 of them genuinely harmful
#
#   sandbox             approval                batch   asks  rubber   human  reviewer
#   danger-full-access  never                   no         0       0      0m  reading carefully
#   workspace-write     every-action            no        79      75     29m  clicking yes
#   workspace-write     every-write             no        29      27     11m  clicking yes
#   workspace-write     irreversible-external   no         2       0      1m  reading carefully
#   workspace-write     every-write             yes       14       9      5m  clicking yes
#   read-only           irreversible-external   no         0       0      0m  reading carefully
# …
#     outstanding: 0 · events: approval_requested → approval_decided`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Codex and Claude Code both separate the two axes</strong> — a sandbox setting and an approval setting, configurable independently, with a documented "dangerous" combination that organisations can forbid centrally. That last detail matters: the unsafe corner should be reachable, visible, and blockable by policy.`,
          `<strong>The MCP spec requires user consent before invoking a tool</strong> (${ch("c15", "C15")}). Implementations that connect a server and expose its tools with no consent flow are not following the spec, and the tool-poisoning attack is precisely what the requirement exists for.`,
          `<strong>LangGraph's interrupt</strong> combined with a checkpointer is the durable-approval pattern from ${ch("c08", "C08")}: the graph suspends, the process exits, and a decision resumes it. If you are on a framework, use its mechanism rather than blocking on a promise.`,
          `<strong>Instrument decision latency from day one.</strong> It is the only honest measure of whether your approvals mean anything, and it is two lines of code. An instant-approval rate over ~30% means redesign the policy, not the dialog.`,
          `<strong>Make rejections cheap and informative.</strong> A rejection with a reason is worth more than an approval: it is labelled data about where the agent's judgement diverges from yours, and it feeds directly into ${ch("c19", "C19")}'s eval set.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `Rank by how much they need human approval, and explain the ordering: (a) delete 400 files in a git repository; (b) send one email to a customer; (c) run <code>npm test</code>; (d) push to a shared branch; (e) read a config file.`,
      answer: ol([
        `<b>(b) Send one email.</b> Irreversible, external, and a real person acts on it. This is the only one that clearly warrants a question every time.`,
        `<b>(d) Push to a shared branch.</b> Reversible with effort, but other people's work is affected and the revert is visible to them. Ask, or restrict to a feature branch and make the push safe by construction.`,
        `<b>(a) Delete 400 files.</b> Dramatic and completely recoverable under git. Worth an audit entry and a confirmation the first time; not worth interrupting for.`,
        `<b>(c) Run npm test.</b> Contained by the sandbox. Never ask.`,
        `<b>(e) Read a config file.</b> Never ask — unless the file is outside the workspace, in which case the <em>sandbox</em> should refuse it rather than a human being consulted.`,
      ]) + p(`The ordering is reversibility first, blast radius second, and it is deliberately counter-intuitive. Severity of appearance ranks (a) top; reversibility ranks it third.`) },

    { difficulty: "core",
      prompt: `Design the approval UI for an agent that makes 30 file edits in a session. It must not produce fatigue and must not allow an unreviewed dangerous edit.`,
      answer: ol([
        `<strong>Do not ask per edit.</strong> Ask once, at the start, for a scoped grant: "This task will edit files under <code>src/auth/**</code>. Allow for this run?" One question, thirty edits.`,
        `<strong>Show a running diff, not a queue of dialogs.</strong> The reviewer watches changes accumulate in a familiar diff view and can intervene at any point. Passive visibility costs no attention; a modal costs all of it.`,
        `<strong>Escalate on scope violations only.</strong> An edit outside the granted glob interrupts — <em>"this touches <code>infra/deploy.yaml</code>, outside the approved scope"</em>. That is a real signal, and it is rare.`,
        `<strong>Escalate on sensitive patterns regardless of scope.</strong> Files matching <code>*.env</code>, <code>*secret*</code>, CI configuration, or anything modifying auth logic. A small hand-written list that catches the edits whose blast radius is not obvious from the path.`,
        `<strong>Make the end-state review the real gate.</strong> "Here is the complete diff, the tests pass, 14 files changed. Commit?" One careful review of the whole change beats thirty shallow ones, and it matches how code review already works.`,
        `<strong>Keep undo one keystroke away</strong> throughout. Cheap reversal is what makes the permissive default defensible.`,
      ]) +
      p(`Note the structure: <em>one grant up front, passive visibility throughout, escalation on anomalies, one careful review at the end.</em> That is roughly two interruptions per session rather than thirty, and the reviewer is fully attentive for both.`) },

    { difficulty: "core",
      prompt: `Implement scoped, expiring grants with an audit trail. What must a grant <em>never</em> cover?`,
      answer: code({ title: "grants that are narrow by construction",
        src: `export class GrantStore {
  private grants: Grant[] = [];

  grant(g: Omit<Grant, "grantedAt">): void {
    // Never grant a standing scope to an irreversible external action, whatever
    // the user clicks. This is a policy invariant, not a preference.
    if (IRREVERSIBLE_EXTERNAL.has(g.pattern.tool) && g.scope !== "once") {
      throw new PolicyError(\`\${g.pattern.tool} may only be approved once per call\`);
    }
    this.grants.push({ ...g, grantedAt: Date.now() });
    audit.record("grant.created", g);
  }

  covers(call: ToolUse, runId: string): Grant | null {
    return this.grants.find((g) =>
      g.pattern.tool === call.name &&
      matchesArgs(g.pattern.args, call.input) &&      // glob/regex on the ARGUMENTS, not just the name
      inScope(g, runId) &&
      (!g.expiresAt || Date.now() < g.expiresAt)
    ) ?? null;
  }
}
const IRREVERSIBLE_EXTERNAL = new Set(["send_email", "charge_card", "post_message", "deploy", "delete_account"]);`,
        }) +
      ul([
        `<strong>Match on arguments, not just the tool name.</strong> "Allow apply_patch" is a blank cheque; "allow apply_patch where path matches <code>src/**</code>" is a decision. A grant system that only keys on tool names is barely better than no grants.`,
        `<strong>Never grant a standing scope to an irreversible external action.</strong> Enforce it in code, because a tired user <em>will</em> click "always allow" on the email tool. This is one of the few places where overriding the user's stated preference is correct.`,
        `<strong>Expire by run or session, never "forever" by default.</strong> A grant made for one task should not silently apply to a different task tomorrow.`,
        `<strong>Audit the grant and every use of it.</strong> "Approved once, used 340 times" is the finding you want to be able to discover.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Your agent runs unattended overnight. Nobody is available to approve anything. Design the policy — and be honest about what you are giving up.`,
      answer: p(`Unattended means approvals are unavailable, so every action must be either contained or pre-authorised. Four parts:`) +
        ol([
          `<strong>Tighten the sandbox until nothing needs asking.</strong> Read-only, or workspace-write with no network and a disposable workspace. The rule: if an action would have needed a human, it must be refused rather than deferred.`,
          `<strong>Pre-authorise narrowly and explicitly.</strong> A written allowlist of tools and argument patterns for this specific job — not a general relaxation. "May edit <code>reports/**</code>, may run <code>npm test</code>, may not push, may not email."`,
          `<strong>Queue anything else instead of failing.</strong> When the agent hits a blocked action, it records the request, works around it if it can, and continues. The morning report says "I completed 9 of 11 tasks; these 2 need approval, here is exactly what and why".`,
          `<strong>Hard budgets with alerting.</strong> Wall clock, money, and tool-call counts (${ch("c12", "C12")}). An unattended agent with a runaway loop has all night.`,
        ]) +
        p(`<strong>What you give up, said plainly:</strong> the agent cannot do anything consequential. That is not a limitation to engineer around; it is the correct outcome. The category of work suited to unattended agents is precisely the category where every action is either reversible or contained: analysis, drafts, test runs, report generation, opening a pull request that a human merges.`) +
        p(`The anti-pattern is granting broad permissions <em>because</em> nobody is watching, which inverts the risk calculation exactly backwards. If the task genuinely requires irreversible external actions, it requires a human, and the honest answer is to schedule it for when one is available.`) },
  ],

  qa: [
    { q: "How many approvals per session is too many?", a: p(`Watch decision latency rather than count. Attention typically holds for three or four careful reviews; beyond that, median decision time falls and you are collecting signatures rather than judgements. If your instant-approval rate exceeds roughly 30%, the policy is wrong regardless of the absolute number.`) },
    { q: "Should the agent be able to request approval for something not on the list?", a: p(`Yes. That is what <code>on-request</code> is for, and it is a valuable signal. An agent asking about something your policy did not anticipate has found a gap in your threat model. Log every such request and review them; they are how the policy improves.`) },
    { q: "What about approving a plan instead of individual actions?", a: p(`Often the best interruption point, and the cheapest: reviewing a plan takes thirty seconds and prevents a wrong direction before any work happens (${ch("c09", "C09")}). It does not replace per-action approval for irreversible things — plans change — but as a first gate it is excellent value.`) },
    { q: "How do I handle approval in a multi-agent system?", a: p(`Approvals belong to the <em>orchestrator</em>, not to subagents. A subagent that can independently request approval multiplies interruptions by the number of agents and makes the request context incomprehensible ("agent 3 wants to send an email" — about what?). Subagents return a request upward; the orchestrator, which has the whole picture, asks once.`) },
    { q: "Is 'approve and remember' safe?", a: p(`For reversible, scoped actions, yes, and it is how you keep attention available. For irreversible external actions, no. Enforce that in code rather than trusting the setting, because a tired user will choose it. The asymmetry is deliberate: remembering a decision about file edits saves attention; remembering a decision about sending email removes the only control that existed.`) },
  ],

  project: {
    title: "Project · An approval layer that respects attention",
    brief: p(`Add approvals to your agent. Success is defined by two numbers together: harmful actions prevented, and median decision latency staying above three seconds.`),
    spec: [
      "Independent <code>sandboxMode</code> and <code>approvalPolicy</code> settings, with the dangerous combination reachable but explicitly flagged.",
      "<code>needsApproval()</code> deciding on containment first, then reversibility, then blast radius — with reversibility outranking apparent severity.",
      "Scoped, expiring grants matched on tool <em>and arguments</em>, with a hard-coded refusal to grant standing scope to irreversible external actions.",
      "Approvals as durable events (C08): the process may exit while a human decides, and any worker can resume.",
      "Approval requests containing why (linked to the trace), what (fully inspectable), and risk (including reversibility), with approve / approve-and-allow / edit / reject-with-reason.",
      "Rejection reasons fed back into the loop as observations.",
      "Decision-latency and instant-approval metrics.",
    ],
    stretch: [
      "Add the three interrupt kinds, including steering injected as a user turn, and measure how often steering saves a run.",
      "Build the approval log and the promotion report: which categories are approved instantly enough to move into the sandbox policy.",
      "Implement the 30-edit UI from the exercises — one scoped grant, passive diff, escalation on scope violations and sensitive paths, one final review.",
    ],
  },

  quiz: [
    { q: "Why is 'approve every action' not the safe configuration?",
      options: ["It exhausts the reviewer's attention, so approvals become rubber-stamps — with a signature now attached", "It is too slow for production use", "It increases token costs", "It prevents the agent from completing tasks"],
      answer: 0,
      why: "Attention is a fixed budget of roughly three or four careful reviews per session. Spending it on contained actions means the one request that mattered arrives to someone trained to click yes, and the audit log now says they approved it." },
    { q: "Which factor should weigh most heavily in deciding whether to ask?",
      options: ["Reversibility — how cheap and certain the undo is", "How many files or records are affected", "How long the action takes", "Whether the tool is third-party"],
      answer: 0,
      why: "Deleting 400 files under git is dramatic and fully recoverable; sending one email is quiet and permanent. Intuition ranks these backwards, and so do most permission systems." },
    { q: "Why must sandbox mode and approval policy be independent settings?",
      options: ["What a process can reach and when a human is asked are different questions — collapsing them yields a useless or unsafe agent", "They are configured by different teams", "One is runtime and the other is compile time", "The protocol requires it"],
      answer: 0,
      why: "A tight sandbox with no approvals is safe and autonomous. A loose sandbox with heavy approvals is unsafe and annoying. Codex and Claude Code both expose them separately for exactly this reason." },
    { q: "Why should an approval request suspend the run rather than block on a promise?",
      options: ["The human may take hours; with durable events the process can exit and any worker can resume on the decision", "Promises cannot be awaited across processes", "It reduces token usage", "It allows parallel approvals"],
      answer: 0,
      why: "Holding a process open while someone is at lunch is not a design. C08's event log makes the request an event and the decision a resume, which also gives you the audit trail for free." },
    { q: "What does a rising instant-approval rate indicate?",
      options: ["You are asking too often; the fix is to tighten the sandbox rather than redesign the dialog", "The agent has become more trustworthy", "Reviewers have learned the interface", "The approval UI needs more detail"],
      answer: 0,
      why: "Decisions under about three seconds are pattern matching, not reading. More detail in the dialog does not help someone who has stopped reading it. Asking less does, by moving contained categories into the sandbox policy." },
    { q: "In a multi-agent system, where should approval requests originate?",
      options: ["The orchestrator, which has the full context — subagents escalate upward rather than asking directly", "Each subagent independently, so requests are specific", "The tool layer, below all agents", "Whichever agent is closest to the user"],
      answer: 0,
      why: "Subagents asking directly multiplies interruptions by the number of agents and strips the context that makes a request judgeable. 'Agent 3 wants to send an email' — about what? The orchestrator knows; the subagent does not." },
  ],

  continues: p(`You now have one capable, contained, supervised agent. Everything from here is about systems: several agents working together, measuring whether any of it works, seeing inside it when it does not, and defending it against people who want it to misbehave. ${ch("c17", "C17")} starts with the question of when a second agent helps, and is fairly rude about how often the answer is "it does not".`),
};

export default chapter;
