import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const TOPO_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Four multi-agent topologies compared">
  <defs><marker id="t17" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker></defs>

  <text x="14" y="16" class="d-label">ORCHESTRATOR–WORKER — the one that usually works</text>
  <rect x="14" y="24" width="76" height="26" rx="4" class="d-box-a"/><text x="52" y="41" class="d-mono" text-anchor="middle">lead</text>
  <path d="M94 32 L114 30" class="d-arrow" marker-end="url(#t17)"/><path d="M94 37 L114 48" class="d-arrow" marker-end="url(#t17)"/><path d="M94 42 L114 66" class="d-arrow" marker-end="url(#t17)"/>
  <rect x="118" y="20" width="70" height="20" rx="3" class="d-box-t"/><text x="153" y="34" class="d-mono" text-anchor="middle">worker</text>
  <rect x="118" y="42" width="70" height="20" rx="3" class="d-box-t"/><text x="153" y="56" class="d-mono" text-anchor="middle">worker</text>
  <rect x="118" y="64" width="70" height="20" rx="3" class="d-box-t"/><text x="153" y="78" class="d-mono" text-anchor="middle">worker</text>
  <path d="M192 52 L212 52" class="d-arrow" marker-end="url(#t17)"/>
  <rect x="216" y="40" width="76" height="26" rx="4" class="d-box-a"/><text x="254" y="57" class="d-mono" text-anchor="middle">synthesise</text>
  <text x="308" y="50" class="d-mono" fill="var(--ok)">parallel, isolated contexts, one owner of the answer</text>

  <text x="14" y="110" class="d-label">HANDOFF — one agent at a time, control transfers</text>
  <rect x="14" y="118" width="76" height="26" rx="4" class="d-box-a"/><text x="52" y="135" class="d-mono" text-anchor="middle">triage</text>
  <path d="M94 131 L118 131" class="d-arrow" marker-end="url(#t17)"/>
  <rect x="122" y="118" width="76" height="26" rx="4" class="d-box-p"/><text x="160" y="135" class="d-mono" text-anchor="middle">refunds</text>
  <path d="M202 131 L226 131" class="d-arrow" marker-end="url(#t17)"/>
  <rect x="230" y="118" width="76" height="26" rx="4" class="d-box-p"/><text x="268" y="135" class="d-mono" text-anchor="middle">billing</text>
  <text x="320" y="135" class="d-mono" fill="var(--warn)">clean prompts; context must travel with the handoff</text>

  <text x="14" y="176" class="d-label">GROUP CHAT — shared transcript, a policy picks the speaker</text>
  <rect x="14" y="184" width="292" height="44" rx="6" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="202" class="d-mono">shared message list · round-robin | model-selected | handoff</text>
  <text x="26" y="220" class="d-mono" fill="var(--fg-faint)">every agent reads everything — cost is O(agents × turns)</text>
  <text x="320" y="208" class="d-mono" fill="var(--warn)">good for debate; expensive, and it can talk forever</text>

  <text x="14" y="256" class="d-label">SWARM / PEER-TO-PEER — agents message each other freely</text>
  <rect x="14" y="264" width="292" height="28" rx="6" class="d-box" stroke="var(--danger)"/>
  <text x="26" y="282" class="d-mono" fill="var(--danger)">no owner, no termination argument, traces that cannot be read</text>
  <text x="320" y="282" class="d-mono" fill="var(--danger)">demos beautifully · do not ship this</text>
</svg>`;

const chapter: Chapter = {
  id: "c17",
  num: 17,
  layer: "systems",
  title: "Multi-Agent Systems",
  subtitle: "When a second agent helps, and the four ways it usually does not",
  blurb:
    "Multi-agent is a context-isolation decision before it is an architecture. Orchestrator–worker, handoffs, group chat, and an honest account of the coordination costs that make a single agent with good tools win more often than not.",
  lines: 176,
  file: "code/c17_multi_agent.ts",
  tags: ["orchestrator", "subagents", "handoff", "group chat", "context isolation", "coordination cost"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The reason that is actually good",
      html:
        p(`Most arguments for multi-agent systems are bad. "Specialisation" is a prompt, not an agent. "Separation of concerns" is an org chart projected onto software. "It mirrors how a team works" is an analogy, and analogies are not architecture.`) +
        p(`There is one good reason, and it is mechanical: <strong>context isolation</strong>. A subagent that reads forty search results and returns three sentences has spent forty results' worth of tokens in a context that is then <em>thrown away</em>. The parent never pays for them — not on that turn, and not on any of the twenty turns after it (${ch("c01", "C01")}). Compaction gets you a 4:1 compression ratio; a subagent gets you 100:1, because it discards rather than summarises.`) +
        p(`The second good reason follows from it: <strong>parallelism</strong>. Five independent searches in five contexts finish in the time of one.`) +
        note("key", "The test", p(`Before adding an agent, ask: <em>would this work produce a large amount of intermediate material the main agent does not need to keep?</em> If yes, that is a subagent. If no — if you just want different instructions — that is a prompt, or a routing branch (${ch("c11", "C11")}), and it costs you nothing.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Four topologies",
      html:
        fig({ label: "Diagram", title: "topologies, best first", body: TOPO_SVG,
          caption: `The ordering is not aesthetic. It tracks how easy the system is to terminate, debug and evaluate, which is what determines whether it survives contact with production.` }) +
        `<h3>Orchestrator–worker: a subagent is a tool</h3>` +
        p(`The cleanest implementation is the one that requires no new concepts. A subagent is a ${ch("c03", "C03")} tool whose implementation happens to be another agent.`) +
        code({ title: "code/c17_multi_agent.ts — the whole pattern",
          src: `export function asTool(name: string, cfg: AgentConfig, description: string): Tool {
  return {
    name, description, readOnly: cfg.tools.every((t) => t.readOnly),
    input: obj({
      task: str({ description: "a complete, self-contained instruction — the subagent sees nothing else" }),
      context: opt(str({ description: "facts it needs that it cannot look up" })),
    }),
    async run({ task, context }, ctx) {
      // A FRESH context. This is the entire point: nothing from the parent leaks in,
      // and nothing from the child leaks out except the return value.
      const result = await runAgent(task, {
        ...cfg,
        system: cfg.system + (context ? \`\\n\\nContext from the orchestrator:\\n\${context}\` : ""),
        limits: { maxSteps: 8, maxTokens: 60_000, wallClockMs: 120_000 },
        signal: ctx.signal,                 // cancellation propagates down
        ledger: ctx.ledger.child(name),     // cost attribution (C01)
      });
      // Only this string enters the parent's context.
      return result.ok ? result.answer : \`\${name} could not finish: \${result.reason}. \${result.partial ?? ""}\`;
    },
  };
}`,
        }) +
        p(`Three properties fall out for free. The parent's loop is unchanged; it is calling a tool. Budgets nest, so a runaway subagent cannot exhaust the parent. And the orchestrator retains the only view of the whole task, which is what makes the result coherent.`) +
        `<h3>Handoff: control transfers, context must travel</h3>` +
        p(`A handoff is a different move: agent A stops, agent B continues, and the user is now talking to B. The OpenAI Agents SDK models it as a tool that swaps which agent owns the loop; AutoGen's <code>Swarm</code> uses an explicit <code>HandoffMessage</code>.`) +
        code({ title: "the part that is always wrong the first time",
          src: `const handoffToBilling = defineTool({
  name: "handoff_to_billing",
  description: "Transfer to the billing specialist. Use when the request needs invoice or payment access.",
  input: obj({
    // Not optional. A handoff that carries only "the user has a billing question"
    // makes the user repeat everything, which is the single most common failure.
    summary: str({ description: "what has been established so far, including what you ruled out" }),
    userGoal: str({ description: "what the user actually wants, in their words" }),
    openQuestions: arr(str()),
  }),
  async run({ summary, userGoal, openQuestions }, ctx) {
    ctx.state.activeAgent = "billing";
    ctx.state.messages = [userText(
      \`[Handed off from support]\\nUser's goal: \${userGoal}\\n\\nEstablished:\\n\${summary}\\n\\n\` +
      \`Still open:\\n\${openQuestions.map((q) => \`- \${q}\`).join("\\n")}\`)];
    return "Transferred.";
  },
});`,
        }) +
        `<h3>Group chat: shared transcript, a policy picks the speaker</h3>` +
        p(`Several agents write into one message list and a selector decides who speaks next — round-robin, a model choosing, or explicit handoffs. AutoGen's team presets are exactly this: <code>RoundRobinGroupChat</code>, <code>SelectorGroupChat</code>, <code>Swarm</code>, with termination conditions supplied separately.`) +
        p(`The cost model is brutal and worth stating: every agent reads the whole transcript, so tokens scale with <em>agents × turns</em>. A five-agent, ten-turn discussion is roughly fifty full-context reads. It is genuinely useful for adversarial review — a proposer and a critic reach better answers than either alone — and rarely worth it for getting work done.`) },

    { id: "mechanics", kicker: "Mechanics", title: "The coordination costs nobody budgets for",
      html:
        table(["Cost", "What it looks like"], [
          ["<b>Serialisation</b>", "Everything between agents is a string. Structure, uncertainty and provenance are lost at every boundary"],
          ["<b>Lost context</b>", "The subagent does not know what the parent knows, so it re-derives, asks, or guesses"],
          ["<b>Duplicated work</b>", "Three researchers, one corpus, three overlapping searches"],
          ["<b>Conflict</b>", "Two subagents return contradictory findings; someone must adjudicate, and nobody was assigned to"],
          ["<b>Debuggability</b>", "A failure now spans four traces and three boundaries (${C20})"],
          ["<b>Latency floor</b>", "Orchestrator call + subagent run + synthesis. Never faster than the slowest worker"],
        ].map((r) => r.map((c) => c.replace("${C20}", `<a href="/c20/" class="mono">C20</a>`))) as string[][]) +
        p(`These are why the honest default is <em>one agent with good tools</em>, and why multi-agent should be a response to a measured problem rather than an opening move.`) +
        `<h3>The task brief is the interface</h3>` +
        p(`A subagent sees exactly one thing: the string you hand it. Vague briefs are the dominant cause of bad multi-agent output, and the fix is unglamorous.`) +
        code({ title: "the difference between 40% and 90% useful subagent results",
          src: `// ✗ The subagent does not know the scope, the format, or what already exists.
"Research competitor pricing"

// ✓ Objective, boundaries, format, and what NOT to do.
\`Find current list pricing for Acme, Globex and Initech cloud storage.

SCOPE: public pricing pages and published press releases only. Do not use
third-party aggregators or analyst estimates — we need citable primary sources.

FOR EACH: vendor, plan name, price per TB per month, minimum commitment,
the URL, and the date the page was last updated.

RETURN: a markdown table plus one paragraph on notable differences in how they
meter egress. Under 400 words.

DO NOT: research vendors not listed. Do not compare with our own pricing —
another agent is doing that, and we do not want two overlapping analyses.\`
// Objective · boundaries · output format · explicit non-goals. All four, every time.`,
        }) +
        `<h3>Termination, which group chat does not give you for free</h3>` +
        p(`A single agent stops when it emits no tool calls. A group of agents has no such condition. They will politely agree with each other indefinitely. AutoGen makes termination an explicit object for this reason, and you should too.`) +
        code({ title: "compose stopping conditions, and always include a hard cap",
          src: `type Termination = (transcript: Message[], state: TeamState) => string | null;

const maxMessages = (n: number): Termination => (t) => t.length >= n ? \`message cap \${n}\` : null;
const textMention = (s: string): Termination => (t) => last(t)?.text?.includes(s) ? \`saw "\${s}"\` : null;
const noProgress = (n: number): Termination => (t, st) =>
  st.turnsSinceStateChange >= n ? \`\${n} turns with no change to the artefact\` : null;
const budget = (tok: number): Termination => (_, st) => st.usage.total >= tok ? "token budget" : null;

const any = (...cs: Termination[]): Termination => (t, s) => cs.map((c) => c(t, s)).find(Boolean) ?? null;

// Always include a hard cap. The others are the ones you want to fire;
// this is the one that guarantees the run ends.
const stop = any(textMention("APPROVED"), noProgress(3), maxMessages(20), budget(200_000));`,
        }) +
        note("warn", "The failure that looks like success", p(`Two agents converging on agreement is not evidence of a good answer. A proposer and a critic will reach consensus on a wrong answer just as readily as a right one, usually faster, because agreement is the path of least resistance. If you use a critic, it needs the independence from ${ch("c10", "C10")}: a fresh context and a rubric, not a conversation.`)) },

    { id: "explore", kicker: "Explore", title: "Is the second agent paying for itself?",
      html:
        p(`Compare architectures on the same task. Watch quality against cost and latency, and note how sensitive everything is to brief quality.`) +
        lab({ label: "Simulator", title: "topology vs task shape",
          body: `
<div class="controls">
  <div class="ctl"><label>independent subtasks</label><input type="range" id="t17-n" min="1" max="12" step="1" value="5"><span class="val" id="t17-n-v">5</span></div>
  <div class="ctl"><label>intermediate data per subtask</label><input type="range" id="t17-d" min="500" max="40000" step="500" value="14000"><span class="val" id="t17-d-v">14,000 tok</span></div>
  <div class="ctl"><label>interdependence</label><input type="range" id="t17-i" min="0" max="100" step="10" value="20"><span class="val" id="t17-i-v">20%</span></div>
  <div class="ctl"><label>brief quality</label><select id="t17-b"><option value="0">vague ("research X")</option><option value="1" selected>full brief (scope, format, non-goals)</option></select></div>
</div>
<div id="t17-rows" style="margin-top:.5rem"></div>
<div class="note" id="t17-note" style="margin-top:1rem"></div>`,
          script: `
function upd() {
  var N = +document.getElementById("t17-n").value, D = +document.getElementById("t17-d").value,
      I = +document.getElementById("t17-i").value / 100, brief = document.getElementById("t17-b").value === "1";
  document.getElementById("t17-n-v").textContent = N;
  document.getElementById("t17-d-v").textContent = D.toLocaleString() + " tok";
  document.getElementById("t17-i-v").textContent = (I * 100) + "%";

  var briefMul = brief ? 1 : 0.62;
  var archs = [];

  // single agent: all intermediate data stays in context, re-sent each turn
  var singleTok = N * D * (1 + N * 0.35);
  archs.push({ k: "single agent", q: Math.max(.3, .93 - (N * D) / 260000 - I * .04), tok: singleTok,
               wall: N * 9, note: "context bloat grows with N × D" });

  // orchestrator-worker: workers' context discarded
  var owTok = N * D * 0.12 + N * 2200 + 6000;
  archs.push({ k: "orchestrator–worker", q: Math.min(.96, (.9 - I * .45) * briefMul + .05), tok: owTok,
               wall: 9 + Math.max(9, 11) + 6, note: "parallel, isolated contexts" });

  // handoff: sequential, context loss at each boundary
  archs.push({ k: "handoff chain", q: Math.max(.25, (.88 - N * .04) * briefMul), tok: N * D * 0.3 + N * 3000,
               wall: N * 8, note: "sequential; detail lost at each transfer" });

  // group chat: everyone reads everything
  archs.push({ k: "group chat (N agents)", q: Math.min(.94, (.86 - I * .15) * briefMul + (I > .5 ? .06 : 0)),
               tok: N * N * 6000 + N * D * 0.5, wall: N * 14, note: "tokens scale with agents × turns" });

  var best = archs.reduce(function (a, b) { return (b.q / Math.log(b.tok)) > (a.q / Math.log(a.tok)) ? b : a; });
  document.getElementById("t17-rows").innerHTML = archs.map(function (a) {
    var col = a.q > .85 ? "var(--ok)" : a.q > .65 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.35rem 0">' +
      '<span class="mono small" style="width:12rem;color:' + (a === best ? "var(--accent)" : "var(--fg-muted)") + ';font-weight:' + (a === best ? 600 : 400) + '">' + a.k + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (a.q * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(a.q * 100) + '%</span>' +
      '<span class="mono small muted" style="width:11rem;text-align:right">' + Math.round(a.tok / 1000) + 'K tok · ' + a.wall + 's</span></div>';
  }).join("");

  var n = document.getElementById("t17-note");
  if (!brief) n.innerHTML = "<b>Vague briefs.</b> Every multi-agent row drops and the single agent does not — because the single agent never had to serialise its intent through a string. Brief quality is the dominant variable in multi-agent performance, ahead of topology.";
  else if (I > .6) n.innerHTML = "<b>Highly interdependent subtasks.</b> Splitting them means each agent is missing what the others found. The single agent wins because everything is in one context. Decomposition requires independence — that is the actual precondition.";
  else if (N <= 2 || D < 3000) n.innerHTML = "<b>Not enough work to divide.</b> Two subtasks producing little intermediate data do not justify the coordination cost. Look at the token columns: the orchestrator's overhead is most of the difference.";
  else n.innerHTML = "<b>The case where multi-agent wins.</b> Many independent subtasks, each generating a lot of material the parent does not need. Orchestrator–worker discards ~88% of it. That is the whole argument — context isolation, not specialisation.";
}
["t17-n","t17-d","t17-i","t17-b"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set interdependence to 80%: every multi-agent row falls below the single agent. Then set brief quality to vague: they fall further, and the single agent does not move. Those two knobs explain most multi-agent disappointment.`,
        }) },

    { id: "build", kicker: "Build it", title: "An orchestrator that stays in charge",
      html:
        code({ title: "code/c17_multi_agent.ts — decompose, dispatch, synthesise",
          src: `export async function orchestrate(goal: string, workers: Record<string, AgentConfig>, model: Model) {
  // 1. The lead plans, and must justify each split — this suppresses the reflex
  //    to fan out three agents for a task one could do.
  const plan = await structured(model, [{ role: "user", content: DECOMPOSE_PROMPT(goal, workers) }],
    obj({ subtasks: arr(obj({
      worker: enumOf(Object.keys(workers) as [string, ...string[]]),
      brief: str({ minLength: 120, description: "objective, scope, output format, non-goals" }),
      whySeparate: str({ description: "what large intermediate output justifies its own context" }),
      dependsOn: arr(int()),
    })) }));

  // 2. Dependency waves, parallel within each.
  const results: Result[] = [];
  for (const wave of topologicalWaves(plan.subtasks)) {
    const settled = await Promise.allSettled(wave.map((st) =>
      runAgent(st.brief + priorFindings(results, st.dependsOn), {
        ...workers[st.worker], limits: WORKER_LIMITS, ledger: ledger.child(st.worker) })));
    // A failed worker is a finding, not an abort: the lead decides what to do.
    results.push(...settled.map((s, i) => s.status === "fulfilled" ? s.value
      : { worker: wave[i].worker, ok: false, error: String(s.reason) }));
  }

  // 3. Synthesis, with contradictions surfaced rather than smoothed over.
  return model([{ role: "user", content:
    \`Goal: \${goal}\\n\\nWorker results:\\n\${render(results)}\\n\\n\` +
    \`Produce the final answer. Where workers disagree, say so explicitly and explain \` +
    \`which you trust and why — do not average them. Note any subtask that failed and \` +
    \`what is therefore unknown.\` }], { temperature: 0 });
}`,
        }) +
        p(`Three deliberate choices. <code>whySeparate</code> forces the lead to justify each agent, which measurably reduces unnecessary fan-out. A failed worker becomes a finding rather than an exception. And the synthesis prompt <em>forbids averaging</em>. The default behaviour when two workers disagree is a smooth paragraph that hides the conflict, which is the worst possible output.`) +
        `<h3>Cost attribution</h3>` +
        code({ title: "nested ledgers, or you will not know where the money went",
          src: `// ledger.child(name) from C01. A run's cost then decomposes:
//
//   run r_7c21                      $1.84   38s
//   ├─ orchestrator                 $0.21    4 calls
//   ├─ researcher[acme]             $0.44   11 calls   ← discarded 14,200 tok of context
//   ├─ researcher[globex]           $0.39    9 calls
//   ├─ researcher[initech]          $0.51   13 calls   ← why is this one 30% dearer?
//   └─ synthesis                    $0.29    1 call
//
// Without child ledgers this is a single number and that last question is unanswerable.`,
        }) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c17_multi_agent.ts

#   C17 · Multi-Agent Systems
#
#   waves: t1+t2+t3 → t4
#
#     ✓ scale       read  12,800 tok, returned  60 tok   scale: finding for t1
#     ✓ ops         read  12,800 tok, returned  60 tok   ops: finding for t2
#     ✗ pricing     read  12,800 tok, returned   0 tok   FINDING: no public pricing above 100M vectors
#     ✓ synthesis   read  12,800 tok, returned  60 tok   synthesis: finding for t4
#
#   context isolation, measured:
#     intermediate tokens read by workers   51,200
#     tokens that entered the orchestrator  180
#     compression ratio                     284:1
#     orchestrator context at synthesis     6,180 tok
#
#   Compaction gets you roughly 4:1 because it summarises. A subagent DISCARDS,
#   so the parent never pays for those tokens on any subsequent turn.
#
#   cost attribution (nested ledgers — otherwise this is one number):
#
#     run                      4 calls     51,200 in    1,600 out  $0.1776
#       ├ scale[t1]            1 calls     12,800 in      400 out  $0.0444
#       ├ ops[t2]              1 calls     12,800 in      400 out  $0.0444
#       ├ pricing[t3]          1 calls     12,800 in      400 out  $0.0444
#       ├ synthesis[t4]        1 calls     12,800 in      400 out  $0.0444
#
#   and the failed worker did not abort the run — it became a finding the
#   synthesiser must report under "not established".
#
#   topology vs task shape · 5 subtasks, 14K intermediate tokens each
#
#   independent, full briefs
# …
#      100%  the full brief`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Anthropic's multi-agent research system write-up</strong> reports the pattern this chapter argues for: an orchestrator with parallel subagents beats a single agent on breadth-first research, and costs several times more tokens. The honest framing is that multi-agent buys quality with money, and is worth it only where the task is genuinely parallel.`,
          `<strong>The OpenAI Agents SDK</strong> models handoffs as tools and guardrails as input/output checks, and is worth reading for how small the handoff abstraction can be.`,
          `<strong>AutoGen</strong> gives you the team presets and termination conditions directly: <code>RoundRobinGroupChat</code>, <code>SelectorGroupChat</code>, <code>Swarm</code>, <code>MagenticOneGroupChat</code>, with <code>TextMentionTermination</code> and friends composed in. The next chapter rebuilds what sits underneath them.`,
          `<strong>Subagents cannot ask the user.</strong> Anything needing human input escalates to the orchestrator (${ch("c16", "C16")}). A subagent that blocks on a question deadlocks a parallel wave.`,
          `<strong>Start with one agent.</strong> Split only when you can point at the specific intermediate output that is poisoning the main context. "It feels cleaner" is not that.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `For each, decide single agent, orchestrator–worker, or handoff: (a) summarise 50 documents; (b) debug a failing test; (c) a support bot spanning billing, shipping and technical; (d) write a report needing research on 6 competitors.`,
      answer: ul([
        `<b>(a) Orchestrator–worker.</b> Fifty independent subtasks, each producing a document's worth of material the parent never needs. The textbook case.`,
        `<b>(b) Single agent.</b> Every step depends on the last; splitting means each agent is missing what the others found. Debugging is the canonical interdependent task.`,
        `<b>(c) Handoff</b>, if the domains need genuinely different tools and permissions. If they only need different instructions, it is routing (${ch("c11", "C11")}) — cheaper, and no context-loss boundary.`,
        `<b>(d) Orchestrator–worker</b> for the six research tasks, then a single agent to write. Note the split: research parallelises, writing does not, because the report needs one voice and all six findings in one context.`,
      ]) },

    { difficulty: "core",
      prompt: `Two subagents return contradictory findings — one says the API rate limit is 100/min, the other says 1000/min. Design the resolution. Why is "ask a third agent" usually wrong?`,
      answer: ol([
        `<strong>Require provenance in every result.</strong> A finding without a source cannot be adjudicated. The worker's brief must demand it: claim, source URL or tool call, and date.`,
        `<strong>Prefer the better source, mechanically.</strong> Official documentation over a blog post; a live API response over documentation; newer over older. Most contradictions resolve at this step with no model call: one worker read a 2019 page.`,
        `<strong>If sources are equally good, get ground truth.</strong> Call the API and read the rate-limit header (${ch("c10", "C10")}). One tool call settles it definitively.`,
        `<strong>If ground truth is unavailable, surface the conflict.</strong> "Sources disagree: the docs say 100/min (updated 2019), the developer portal says 1000/min (2024). Assuming 100/min as the safe bound; verify before relying on it." That is a better output than a confident wrong number.`,
      ]) +
      p(`<strong>Why a third agent is usually wrong:</strong> it has the same information as the synthesiser and no new evidence, so it is ${ch("c10", "C10")}'s rung 4 with extra latency — a tiebreak decided by fluency rather than fact. It also shares the other agents' blind spots, so on the cases where both workers were misled by the same stale documentation, the third will be too.`) +
      p(`The exception that is genuinely useful: a third agent whose job is <em>to go and find new evidence</em> — "resolve this contradiction by finding a primary source". That is a research task, not an adjudication, and it works because it adds information rather than opinion.`) },

    { difficulty: "core",
      prompt: `Implement worker budgets that nest correctly: a runaway subagent must not exhaust the parent, and cancelling the parent must stop every worker immediately.`,
      answer: code({ title: "reserve downward, propagate signals downward",
        src: `export class NestedBudget {
  constructor(private parent: NestedBudget | null, private limits: Limits,
              private ctrl = new AbortController()) {
    // Cancelling the parent cancels every child, transitively.
    parent?.signal.addEventListener("abort", () => this.ctrl.abort(), { once: true });
  }

  get signal() { return this.ctrl.signal; }

  /** Carve a child budget out of what remains, never exceeding it. */
  child(name: string, want: Partial<Limits>): NestedBudget {
    const left = this.remaining();
    const limits: Limits = {
      maxSteps:    Math.min(want.maxSteps    ?? left.maxSteps,    Math.floor(left.maxSteps * 0.5)),
      maxTokens:   Math.min(want.maxTokens   ?? left.maxTokens,   Math.floor(left.maxTokens * 0.4)),
      wallClockMs: Math.min(want.wallClockMs ?? left.wallClockMs, left.wallClockMs),
    };
    const c = new NestedBudget(this, limits);
    this.children.push({ name, budget: c });
    return c;
  }

  /** A child's spend counts against the parent as it happens, not at the end. */
  record(u: Usage): void { this.usage.add(u); this.parent?.record(u); }
}` }) +
      ul([
        `<strong>Cap each child at a fraction of what remains</strong>, not at a fixed number. One worker must not be able to consume the whole remaining budget, or a parallel wave's last worker gets nothing.`,
        `<strong>Charge spend upward as it happens.</strong> Accounting only on completion means the parent discovers it is over budget after five workers have already finished.`,
        `<strong>Chain the abort signals.</strong> One <code>AbortController</code> per level, each listening to its parent — so a user cancellation reaches a worker that is three levels down and mid-fetch.</li>`,
        `<strong>Reserve for synthesis.</strong> Parallel workers must not collectively consume everything, or the orchestrator cannot afford the call that produces the answer. Hold back ~20% before dispatching.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Your five-agent system produces good results and nobody can debug it. Design the observability that makes a multi-agent failure diagnosable in under five minutes.`,
      answer: ol([
        `<strong>One trace id, propagated everywhere.</strong> Every model call, tool call and subagent run carries the root run id plus a span id and a parent span id. Without this you have five unrelated logs and a guess (${ch("c20", "C20")}).`,
        `<strong>Record the boundaries as first-class events.</strong> <code>subagent_dispatched</code> with the exact brief, <code>subagent_returned</code> with the exact string. Those two strings are the interface, and nearly every multi-agent bug is visible in one of them — a brief that omitted a constraint, or a result that dropped a caveat.`,
        `<strong>Render the tree, not a list.</strong> A flat log of 300 events across five agents is unreadable. The waterfall — orchestrator at the top, workers nested, with duration, tokens and cost per span — makes "which worker was slow and expensive" a glance rather than a query.`,
        `<strong>Diff the brief against the result.</strong> An automated check: did the worker's output contain every element the brief asked for (each field, the format, the word limit)? Briefs and results drifting apart is the single most common silent failure, and it is mechanically detectable.`,
        `<strong>Keep every worker's full transcript, addressable by span id.</strong> Discarded from the parent's <em>context</em> is not the same as discarded from your <em>logs</em>. When a worker returns something odd you need the forty search results it read.`,
        `<strong>Flag contradictions automatically.</strong> Run a cheap check across worker results for conflicting claims about the same subject, and surface it in the trace even when the synthesiser smoothed it over.`,
      ]) +
      p(`The five-minute test is a good bar: open the waterfall, find the span that is red or slow, read its brief and its result, and open its transcript if needed. If any of those four steps requires writing a query, the tooling is not finished.`) },
  ],

  qa: [
    { q: "Isn't 'specialist agents' a good reason to split?", a: p(`Specialisation is achieved by a prompt and a tool subset, which costs nothing. An agent boundary additionally costs serialisation, context loss and a debugging seam. If the only thing you need is different instructions, use routing (${ch("c11", "C11")}), and you get the specialisation without paying for the boundary.`) },
    { q: "How many subagents in parallel?", a: p(`Bounded by what you can afford and by rate limits, not by the decomposition. Five to ten is typical. Remember that each holds a context and a concurrency slot, and that token-per-minute limits bite long before request-per-minute limits (${ch("c01", "C01")}).`) },
    { q: "Should subagents share memory?", a: p(`Read, usually yes: shared semantic memory keeps them consistent about the user and the domain. Write, usually no: concurrent workers writing memories produces duplicates and contradictions with no adjudicator (${ch("c07", "C07")}). Let the orchestrator write after synthesis, when the outcome is known.`) },
    { q: "What about agents that spawn agents?", a: p(`Allow one level by default. Two levels is occasionally justified for genuinely hierarchical work; unbounded recursion is a cost explosion waiting for an unlucky prompt. Enforce a depth limit in the runtime, not in the prompt.`) },
    { q: "Do the workers need to be the same model?", a: p(`No, and varying it is a good cost lever: a cheap model for extraction and search, a capable one for synthesis and for the orchestrator's decomposition. The orchestrator is where the reasoning is hardest and where the fewest tokens are spent — exactly the right place for the expensive model.`) },
  ],

  project: {
    title: "Project · An orchestrator that earns its keep",
    brief: p(`Build an orchestrator–worker system for a genuinely parallel task, and prove with numbers that it beats your single agent on the same task, or discover that it does not, which is an equally good outcome.`),
    spec: [
      "<code>asTool()</code> wrapping an agent as a tool with a fresh context, nested budgets and a chained abort signal.",
      "A decomposition step whose schema requires a <code>whySeparate</code> justification and a brief of at least 120 characters.",
      "Briefs containing objective, scope, output format and explicit non-goals — all four.",
      "Dependency waves with parallel execution inside each, and failed workers surfaced as findings rather than aborts.",
      "A synthesis prompt that forbids averaging contradictions and requires naming failed subtasks.",
      "Nested cost ledgers producing a per-worker breakdown.",
      "A comparison on the same 10 tasks: single agent vs orchestrator, reporting quality, tokens, wall-clock and cost.",
    ],
    stretch: [
      "Add a handoff agent with a mandatory context-transfer schema, and measure how often the user has to repeat themselves versus a naive handoff.",
      "Implement a two-agent proposer/critic group chat with composed termination conditions, and check whether its agreements are actually better than the proposer alone.",
      "Build the trace waterfall from the exercises and use it to diagnose a deliberately broken worker.",
    ],
  },

  quiz: [
    { q: "What is the strongest reason to use a subagent?",
      options: ["Context isolation — the subagent's intermediate material is discarded rather than accumulating in the parent", "Specialisation through different system prompts", "Separation of concerns", "Each agent can use a different model"],
      answer: 0,
      why: "Specialisation is a prompt and costs nothing. A subagent boundary buys discarding: forty search results are read in a context that is thrown away, so the parent never pays for them on any subsequent turn. That is a ~100:1 compression compaction cannot match." },
    { q: "Which task shape is worst suited to multi-agent decomposition?",
      options: ["Highly interdependent work such as debugging, where each step depends on what the last revealed", "Many independent searches", "Processing 50 documents", "Comparing several vendors"],
      answer: 0,
      why: "Splitting interdependent work means each agent is missing what the others found, and the serialisation boundary loses exactly the detail that mattered. The simulator shows every multi-agent row falling below the single agent as interdependence rises." },
    { q: "What must a handoff carry beyond 'the user has a billing question'?",
      options: ["What has been established, what was ruled out, the user's goal in their words, and the open questions", "The full message history verbatim", "The previous agent's system prompt", "A confidence score"],
      answer: 0,
      why: "A bare handoff makes the user repeat themselves, which is the most common and most visible multi-agent failure. Making the summary a required schema field is what forces it to happen." },
    { q: "Why does group chat scale badly?",
      options: ["Every agent reads the whole transcript, so tokens scale with agents × turns", "Agents cannot run in parallel", "The selector model is expensive", "Transcripts exceed the context window immediately"],
      answer: 0,
      why: "Five agents over ten turns is roughly fifty full-context reads. It is genuinely useful for adversarial review, and rarely worth it for getting work done." },
    { q: "Two workers return contradictory findings. What should the synthesiser do?",
      options: ["State the disagreement explicitly, say which it trusts and why, and prefer ground truth where available", "Average the two values", "Pick the more recent result", "Ask a third agent to adjudicate"],
      answer: 0,
      why: "Averaging hides the conflict in a smooth paragraph, which is the worst output. A third agent has no new evidence and shares the same blind spots — unless its job is to go and find a primary source, which adds information rather than opinion." },
    { q: "What is the dominant variable in multi-agent performance?",
      options: ["Brief quality — objective, scope, output format and explicit non-goals", "The number of agents", "Which topology is used", "The model used by the workers"],
      answer: 0,
      why: "A subagent sees exactly one string. In the simulator, switching briefs from vague to complete moves every multi-agent row substantially while leaving the single-agent row unchanged, because the single agent never had to serialise its intent." },
  ],

  continues: p(`Wrapping agents as tools works, and it has a ceiling: it is a call tree, so agents cannot react to events, cannot be addressed by identity, and cannot run in separate processes. Underneath every serious multi-agent framework is a message-passing runtime that removes those limits. ${ch("c18", "C18")} builds one, following the design AutoGen settled on.`),
};

export default chapter;
