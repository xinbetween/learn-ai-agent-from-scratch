import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const BUDGET_SVG = `
<svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="The context window as a budget with fixed and variable regions">
  <text x="14" y="18" class="d-label">200K CONTEXT — BUT THE USABLE BUDGET IS MUCH SMALLER</text>

  <rect x="14" y="30" width="672" height="34" rx="5" class="d-box-m"/>
  <text x="24" y="52" class="d-mono">system prompt + tool schemas · 6K · FIXED, cacheable, paid every turn</text>

  <rect x="14" y="70" width="672" height="28" rx="5" class="d-box"/>
  <text x="24" y="89" class="d-mono">retrieved documents · 12K · REFRESHED per turn (C06)</text>

  <rect x="14" y="104" width="672" height="28" rx="5" class="d-box-p"/>
  <text x="24" y="123" class="d-mono">memory + goal + plan · 3K · PINNED, never evicted (C07, C09)</text>

  <rect x="14" y="138" width="430" height="46" rx="5" class="d-box-t"/>
  <text x="24" y="157" class="d-mono">conversation + observations · GROWS every turn</text>
  <text x="24" y="175" class="d-mono" fill="var(--fg-faint)">the only region you control at runtime — this is what compaction eats</text>

  <rect x="448" y="138" width="238" height="46" rx="5" class="d-box" stroke-dasharray="4 3"/>
  <text x="567" y="157" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">headroom for the reply</text>
  <text x="567" y="175" class="d-mono" text-anchor="middle" fill="var(--danger)">reserve it or the run dies</text>

  <line x1="14" y1="204" x2="686" y2="204" stroke="var(--border)"/>
  <text x="14" y="226" class="d-label">ATTENTION IS NOT UNIFORM ACROSS THAT BAR</text>

  <path d="M20 288 C 90 240, 120 250, 180 268 S 300 286, 350 286 S 480 282, 560 262 C 620 246, 660 238, 680 232"
        fill="none" stroke="var(--accent)" stroke-width="2"/>
  <text x="24" y="250" class="d-mono" fill="var(--accent)">high</text>
  <text x="350" y="272" class="d-mono" text-anchor="middle" fill="var(--danger)">lost in the middle</text>
  <text x="676" y="250" class="d-mono" text-anchor="end" fill="var(--accent)">high</text>
  <text x="14" y="298" class="d-mono" fill="var(--fg-faint)">start</text>
  <text x="686" y="298" class="d-mono" text-anchor="end" fill="var(--fg-faint)">end (most recent)</text>
</svg>`;

const chapter: Chapter = {
  id: "c05",
  num: 5,
  layer: "context",
  title: "Context Engineering",
  subtitle: "The window is a budget, and position is a feature",
  blurb:
    "The context window is the agent's entire world and it is both finite and unevenly attended. Budgeting it, ordering it, and compacting it are the difference between an agent that handles four steps and one that handles forty.",
  lines: 195,
  file: "code/c05_context.ts",
  tags: ["context window", "lost in the middle", "compaction", "prompt caching", "summarisation", "pinning", "offloading"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "The agent that forgot what it was doing",
      html:
        p(`Your ${ch("c04", "C04")} agent works beautifully for six steps. On step fourteen it does something baffling: it re-reads a file it already read, contradicts a conclusion it reached at step three, or answers a question the user never asked. Nothing crashed. The model did not get worse. The <em>context</em> got worse.`) +
        p(`Two distinct things go wrong, and they need separate fixes:`) +
        ol([
          `<strong>The hard limit.</strong> <code>messages</code> exceeds what the model accepts and the API returns a 400. Abrupt, obvious, and the easy one.`,
          `<strong>The soft limit.</strong> Long before the hard limit, quality degrades. The goal is 40,000 tokens up-scroll, sandwiched between eleven tool results, and the model's attention over that span is measurably non-uniform: strongest at the beginning and the end, weakest in the middle. This is the well-replicated <em>lost in the middle</em> effect, and it means a fact you put in the context is not necessarily a fact the model uses.`,
        ]) +
        note("key", "The reframe", p(`Stop thinking of the context window as storage and start thinking of it as a <strong>working set you curate every turn</strong>. The question is never "does this fit" but "of everything I could send, what are the 20,000 tokens that most improve the next decision, and where in the request do I put them".`)),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Four regions, three operations",
      html:
        p(`Treat the request as regions with different lifetimes and different rules, rather than as one array you append to.`) +
        table(
          ["Region", "Lifetime", "Rule"],
          [
            ["<b>Fixed</b> — system prompt, tool schemas", "Whole run", "Byte-identical every turn so the cache holds. Never interpolate."],
            ["<b>Pinned</b> — goal, plan, key decisions, memory", "Whole run", "Re-stated near the <em>end</em> of the request, not just the start."],
            ["<b>Refreshed</b> — retrieved documents", "One turn", "Re-selected per turn for the current sub-question (${C06})."],
            ["<b>Rolling</b> — conversation, observations", "Until compacted", "The only region that grows. This is what you evict."],
          ].map((r) => r.map((c) => c.replace("${C06}", `<a href="/c06/" class="mono">C06</a>`))) as string[][]
        ) +
        p(`Three operations keep the rolling region in budget, in increasing order of information loss:`) +
        `<h3>1 · Offload — move it out, leave a pointer</h3>` +
        p(`The cheapest operation, and the most underused. A 40 KB file read does not need to live in the context; write it to a scratch directory and leave <code>"Wrote 40KB to /tmp/run/report.json (1,203 rows). Fields: id, status, total. Use read_lines to inspect."</code> The agent retains the <em>capability</em> to see it at a cost of 30 tokens instead of 10,000.`) +
        p(`This is what makes long agent runs possible at all, and it is why filesystem tools (${ch("c14", "C14")}) matter far beyond coding agents: the filesystem is external memory with a well-understood API the model already knows.`) +
        `<h3>2 · Compact — summarise the middle, keep the ends</h3>` +
        code({
          title: "the shape that works",
          src: `async function compact(messages: Message[], model: Model, budget: number): Promise<Message[]> {
  const head = messages.slice(0, 2);                 // system + original goal: never touch
  const tail = messages.slice(-KEEP_VERBATIM);       // last ~6 turns: the model is mid-thought
  const middle = messages.slice(2, -KEEP_VERBATIM);
  if (middle.length === 0) return messages;

  const summary = await model([
    { role: "user", content:
      \`Summarise this portion of an agent's work log. Preserve, in this order:\\n\` +
      \`1. FACTS ESTABLISHED — each with the tool call that produced it.\\n\` +
      \`2. DEAD ENDS — what was tried and failed, so it is not retried.\\n\` +
      \`3. OPEN QUESTIONS — what remains unresolved.\\n\` +
      \`4. ARTEFACTS — file paths, IDs, URLs produced. Reproduce these EXACTLY.\\n\\n\` +
      \`Omit reasoning, pleasantries, and superseded intermediate results.\\n\\n\` +
      render(middle) }
  ], { temperature: 0, maxTokens: budget });

  return [...head, { role: "user", content: \`[Earlier work, compacted]\\n\${textOf(summary)}\` }, ...tail];
}`,
        }) +
        note("warn", "Dead ends are the part everyone drops", p(`A summary that records only successes lets the agent cheerfully retry the three approaches that already failed, with no memory of why they failed. "Tried X, returned 0 results because the index only covers 2023+" is worth more tokens than most of what it replaces.`)) +
        `<h3>3 · Evict — drop it and accept the loss</h3>` +
        p(`Last resort, and it should be <em>ordered</em>: superseded tool results first (an old <code>list_files</code> after three edits), then old reasoning text, then old observations, never the goal and never the most recent turns. A FIFO that drops the oldest messages is the naive version and it deletes the goal, which is the one thing that must survive.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "Position is a feature you control",
      html:
        fig({
          label: "Diagram",
          title: "the budget, and the attention curve over it",
          body: BUDGET_SVG,
          caption: `The lower curve is why "it fits in the context" is not the same as "the model will use it". Material in the middle of a long request is measurably less influential than the same material at either end.`,
        }) +
        `<h3>Four ordering rules that cost nothing</h3>` +
        ol([
          `<strong>Stable prefix first.</strong> System prompt and tool schemas at the very front, byte-identical, so prompt caching holds. This is a cost rule that happens to align with the attention rule.`,
          `<strong>Restate the goal near the end.</strong> One line: <code>"Current goal: determine refund eligibility for order 4471. Step 9 of at most 12."</code> Cheap, and it lands in the high-attention region. Agents that wander on long tasks are usually agents whose goal is buried 30,000 tokens up.`,
          `<strong>Most relevant retrieved chunk last.</strong> If you retrieve five passages, put the best one closest to the question, not first. Most RAG implementations do the opposite, out of habit from ranked search results.`,
          `<strong>Instructions after data, for long data.</strong> With a 20,000-token document, "here is a document [doc] now do X" beats "do X to the following [doc]", because the instruction then sits in the recency region where it is attended most strongly.`,
        ]) +
        `<h3>Compaction is a checkpoint, not a cleanup</h3>` +
        p(`The moment you compact, you have produced a self-contained description of the run's state. That artefact is worth keeping for its own sake: it is the resume point for ${ch("c08", "C08")}, the handoff note for ${ch("c17", "C17")}, and the audit record for ${ch("c20", "C20")}. Compact to a durable log, not into the void.`) +
        `<h3>When to trigger</h3>` +
        table(
          ["Trigger", "Good for", "Watch out"],
          [
            ["Token threshold (e.g. 70% of window)", "Default. Predictable.", "Can fire mid-tool-sequence; wait for a turn boundary"],
            ["Phase boundary (plan step complete)", "Cleanest summaries", "Requires an explicit plan (${C09})"],
            ["Model-requested (a <code>compact</code> tool)", "The model knows what it is done with", "It will forget to call it"],
            ["Every N turns", "Simple", "Compacts when nothing changed; wastes a call"],
          ].map((r) => r.map((c) => c.replace("${C09}", `<a href="/c09/" class="mono">C09</a>`))) as string[][]
        ) +
        note("bad", "The compaction death spiral", p(`Compaction needs a model call, and that call needs the oversized context as input. If you wait until 98% full, the compaction request itself does not fit, and you are stuck with no way out. Trigger at 70%, reserve headroom, and if compaction ever fails, fall back to <em>ordered eviction</em>, which needs no model call at all.`)),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Run 40 turns and manage the budget",
      html:
        p(`Each turn adds an observation. Pick a strategy and see how far the agent gets before the window kills it, and separately how much of what it established it still knows.`) +
        lab({
          label: "Simulator",
          title: "context budget over a long run",
          body: `
<div class="controls">
  <div class="ctl"><label>strategy</label>
    <select id="c5-strat">
      <option value="none">none — append forever</option>
      <option value="fifo">FIFO — drop oldest</option>
      <option value="compact" selected>compact at 70%</option>
      <option value="offload">offload + compact</option>
    </select></div>
  <div class="ctl"><label>window</label>
    <select id="c5-win"><option value="32000">32K</option><option value="128000" selected>128K</option><option value="200000">200K</option></select></div>
  <div class="ctl"><label>avg observation</label>
    <input type="range" id="c5-obs" min="200" max="8000" step="100" value="2500"><span class="val" id="c5-obs-v">2,500</span></div>
  <div class="ctl"><label>turns</label>
    <input type="range" id="c5-turns" min="5" max="60" step="1" value="40"><span class="val" id="c5-turns-v">40</span></div>
</div>
<div style="margin-top:.5rem">
  <div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">context used per turn · red = over the limit</div>
  <div class="bars" id="c5-bars" style="height:7rem"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;margin-top:1rem">
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">facts still recoverable</div>
    <div class="meter"><i id="c5-know" style="width:0%;background:var(--ok)"></i></div><div class="mono small muted" id="c5-know-v">—</div></div>
  <div><div class="pt" style="font:600 .6875rem var(--font-mono);color:var(--fg-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem">goal still in high-attention zone</div>
    <div class="meter"><i id="c5-goal" style="width:0%;background:var(--tool)"></i></div><div class="mono small muted" id="c5-goal-v">—</div></div>
</div>
<div class="stats">
  <div class="stat"><b id="c5-died">—</b><span>died at turn</span></div>
  <div class="stat"><b id="c5-comp">0</b><span>compactions</span></div>
  <div class="stat"><b id="c5-cost">—</b><span>total input tokens</span></div>
  <div class="stat"><b id="c5-peak">—</b><span>peak context</span></div>
</div>
<div class="note" id="c5-note" style="margin-top:1rem"></div>`,
          script: `
var els = ["c5-strat","c5-win","c5-obs","c5-turns"].map(function (i) { return document.getElementById(i); });
function upd() {
  var strat = els[0].value, win = +els[1].value, obs = +els[2].value, T = +els[3].value;
  els[2].nextElementSibling.textContent = obs.toLocaleString();
  els[3].nextElementSibling.textContent = T;

  var FIXED = 6000, RESERVE = 8000, usable = win - RESERVE;
  var ctx = FIXED + 400, bars = [], died = null, comps = 0, total = 0, peak = 0;
  var facts = 0, factsKept = 0, goalDist = 0;

  for (var t = 1; t <= T; t++) {
    var add = obs + 200;
    if (strat === "offload") add = Math.min(add, 450);   // big results go to disk, pointer stays
    ctx += add; facts++;
    goalDist = ctx - FIXED;

    if (ctx > usable) {
      if (strat === "none") { died = died || t; }
      else if (strat === "fifo") {
        // drops oldest — including, eventually, the goal
        while (ctx > usable * 0.8) { ctx -= (obs + 200); factsKept = Math.max(0, factsKept - 1); }
      }
    }
    if ((strat === "compact" || strat === "offload") && ctx > usable * 0.7) {
      comps++;
      var kept = FIXED + 400 + 2200 + (strat === "offload" ? 1200 : 1800);  // summary + recent tail
      ctx = kept;
      factsKept = Math.round(facts * (strat === "offload" ? 0.88 : 0.74));  // summary lossiness
    } else if (strat !== "fifo") factsKept = facts;

    total += ctx; peak = Math.max(peak, ctx);
    bars.push({ v: ctx, over: ctx > usable });
    if (died) break;
  }

  var mx = Math.max(win, peak);
  document.getElementById("c5-bars").innerHTML = bars.map(function (b, i) {
    return '<div class="bar' + (b.over ? "" : "") + '" style="height:' + Math.max(2, (b.v / mx) * 100) + '%;background:' +
      (b.over ? "var(--danger)" : "var(--accent)") + '" title="turn ' + (i + 1) + ': ' + b.v.toLocaleString() + ' tok"></div>';
  }).join("");

  var knowRate = strat === "none" ? (died ? 1 : 1) : (facts ? factsKept / facts : 1);
  document.getElementById("c5-know").style.width = (knowRate * 100) + "%";
  document.getElementById("c5-know-v").textContent = Math.round(knowRate * 100) + "% of established facts survive in context";
  var goalScore = strat === "fifo" ? Math.max(0, 1 - bars.length / 25) : (strat === "none" ? Math.max(0.1, 1 - goalDist / usable) : 0.95);
  document.getElementById("c5-goal").style.width = (goalScore * 100) + "%";
  document.getElementById("c5-goal-v").textContent = strat === "fifo" ? "FIFO evicted the goal itself" :
    (strat === "none" ? "goal is " + Math.round(goalDist / 1000) + "K tokens up-scroll" : "goal restated near the end each turn");

  document.getElementById("c5-died").textContent = died ? died : "—";
  document.getElementById("c5-comp").textContent = comps;
  document.getElementById("c5-cost").textContent = total.toLocaleString();
  document.getElementById("c5-peak").textContent = peak.toLocaleString();

  var n = document.getElementById("c5-note");
  if (strat === "none" && died) n.innerHTML = "<b>Hard failure at turn " + died + ".</b> The API rejects the request. Note the bars were already red before it died — quality was degrading for several turns before anything threw.";
  else if (strat === "fifo") n.innerHTML = "<b>FIFO is the trap.</b> It never exceeds the window, so it looks like it works. But it drops the oldest messages — which are the system prompt and the goal. The agent keeps running and stops knowing what it was doing.";
  else if (strat === "compact") n.innerHTML = "<b>Compaction works, and it is lossy.</b> Roughly a quarter of established facts do not survive each summary. Compare the fact-retention bar against 'offload + compact'.";
  else n.innerHTML = "<b>Offload first, compact second.</b> Large results go to disk with a pointer left behind, so compaction has far less to destroy — and anything summarised away is still <i>on disk</i>, retrievable by path. This is why long-running agents need a filesystem (C14).";
}
els.forEach(function (e) { e.addEventListener("input", upd); e.addEventListener("change", upd); });
upd();`,
          caption: `Set the strategy to FIFO and watch the fact-retention and goal bars while the context bars stay comfortably under the limit. That is the failure everybody ships: nothing errors, the agent just quietly stops knowing what it is doing.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "A context manager between the loop and the model",
      html:
        p(`Everything in this chapter is one function inserted at one seam. ${ch("c04", "C04")}'s loop called <code>cfg.model(messages, …)</code>; it now calls <code>cfg.model(ctx.build(messages), …)</code>, and the loop is otherwise unchanged.`) +
        code({
          title: "code/c05_context.ts — assemble, never just append",
          src: `export class ContextManager {
  constructor(
    private readonly window: number,
    private readonly reserve = 8_000,          // headroom for the reply
    private readonly compactAt = 0.7,
  ) {}

  /** Called before every model call. Returns the array actually sent. */
  async build(state: RunState, model: Model): Promise<Message[]> {
    if (this.estimate(state) > this.window * this.compactAt) {
      state.rolling = await this.compact(state, model);   // durable: also written to the log
    }

    return [
      // 1. FIXED — byte-identical, so the cache holds.
      { role: "system", content: state.system },

      // 2. PINNED — memory and prior decisions, early.
      ...(state.memory.length ? [userText(renderMemory(state.memory))] : []),

      // 3. ROLLING — the conversation.
      ...state.rolling,

      // 4. REFRESHED — retrieval for THIS turn, best chunk last (C06).
      ...(state.retrieved.length ? [userText(renderChunks(state.retrieved))] : []),

      // 5. RESTATED GOAL — last position, highest attention. ~40 tokens, large effect.
      userText(\`Current goal: \${state.goal}\\nStep \${state.step} of at most \${state.maxSteps}.\` +
               (state.plan ? \`\\nPlan status:\\n\${renderPlan(state.plan)}\` : "")),
    ];
  }

  private estimate(s: RunState): number {
    // Cheap local estimate; the real counter only for decisions that matter.
    return Math.ceil(JSON.stringify(s.rolling).length / 3.6) + s.systemTokens + this.reserve;
  }
}`,
        }) +
        p(`Two things worth noticing. The goal block is the last thing in the request, deliberately. And <code>build()</code> is pure assembly from named regions. No code path anywhere simply pushes onto an array and hopes.`) +
        `<h3>Ordered eviction, for when compaction is not available</h3>` +
        code({
          title: "drop in a defensible order",
          src: `const EVICTION_ORDER: Array<(m: Message, i: number, all: Message[]) => boolean> = [
  // 1. Tool results superseded by a later call to the same tool with the same args.
  (m, i, all) => isToolResult(m) && supersededLater(m, i, all),
  // 2. Assistant reasoning text older than the last 6 turns (the actions remain).
  (m, i, all) => isReasoningText(m) && i < all.length - 12,
  // 3. Large observations older than the last 10 turns, replaced by a one-line stub.
  (m, i, all) => isToolResult(m) && tokens(m) > 1_000 && i < all.length - 20,
];
// Never eligible: the system prompt, the original goal, the last 6 turns,
// and any message carrying an artefact path or ID the agent may still need.`,
        }) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c05_context.ts

#   C05 · Context Engineering — 40 turns, 128K window, 3.5K observations
#
#   strategy            died  compactions  input tokens  peak ctx  facts kept  goal in tail
#   none                t=31            0     2,033,600   121,100        100%  no
#   fifo                   —            0     2,953,300   117,400         65%  no
#   compact                —            1     1,816,000    80,700         88%  yes
#   offload+compact        —            0       510,200    18,800        100%  yes
#
#   FIFO never exceeds the window, so it looks like it works. It drops the oldest
#   messages — the system prompt and the goal — and the agent keeps running while
#   quietly forgetting what it was doing. Nothing errors.
#
#   what build() actually sends, in order:
#
#     1. system     541 tok  You are a support agent.
#     2. user        37 tok  [{"type":"text","text":"What you know from previous sessions:\\
#     3. user        13 tok  [{"type":"text","text":"turn 0 observation"}]
#     4. user        13 tok  [{"type":"text","text":"turn 1 observation"}]
#     5. user        13 tok  [{"type":"text","text":"turn 2 observation"}]
#     6. user        13 tok  [{"type":"text","text":"turn 3 observation"}]
#     7. user        13 tok  [{"type":"text","text":"turn 4 observation"}]
#     8. user        13 tok  [{"type":"text","text":"turn 5 observation"}]
#     9. user        22 tok  [{"type":"text","text":"Returns Policy § 3: electronics 14 day
#     10. user        29 tok  [{"type":"text","text":"Current goal: Determine refund eligibi
#
#   The goal is the LAST block — about 40 tokens in the highest-attention position.
#
#   offload(): 13,730 tokens becomes 81:
#
#     [Result too large for context — written to /tmp/agent/list_orders-c1.txt]
#     Size: 50,801 bytes, ~13,730 tokens, 1203 lines.
#     First line: {"id":0,"status":"shipped","total":40}
#     Last line:  {"id":1202,"status":"shipped","total":1242}
#     To inspect: read_lines("/tmp/agent/list_orders-c1.txt", start, end).`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "What real agents do",
      html:
        ul([
          `<strong>Claude Code compacts</strong> when the context approaches its limit, producing a structured summary of the session and continuing from it — and it surfaces the compaction to the user, which is the right call: a silent lossy transformation of the agent's memory is exactly the kind of thing a user should be told about.`,
          `<strong>Codex and other coding agents offload aggressively</strong> by design: the repository is the memory. The agent reads a file, acts, and does not retain the file, because it can always read it again. Any agent with a durable external store can use this pattern, and most do not.`,
          `<strong>Prompt caching interacts with everything here.</strong> Compaction rewrites the middle of your array, invalidating the cache from that point. Compact at a turn boundary, keep the cached prefix intact, and you pay the rewrite once rather than continuously.`,
          `<strong>"Just use a bigger window" is not a plan.</strong> Bigger windows raise the hard limit, not the soft one. Attention over a very long context is still uneven, and cost scales with what you send. A 200K-token request is not eight times better than a 25K one. It is eight times more expensive and often worse.`,
          `<strong>Read the research:</strong> Liu et al., <em>Lost in the Middle</em> (2023) for the position effect; the various context-rot and long-context evaluation studies for how degradation varies by task. The practical upshot has been stable for years: shorter, better-ordered context beats longer context at equal relevance.`,
        ]),
    },
  ],

  exercises: [
    {
      difficulty: "warm-up",
      prompt: `Your agent hits the context limit at turn 30. A colleague suggests switching to a model with a 4× larger window. Give two reasons that is a partial fix, and say what you would do first.`,
      answer:
        ul([
          `<strong>It postpones the hard limit and does nothing for the soft one.</strong> The quality degradation that started around turn 18 — re-reading files, contradicting earlier conclusions — is a position and dilution problem, not a capacity one. You will now reach turn 60 with an agent that has been mildly confused for forty turns.`,
          `<strong>Cost scales with what you send, not with the limit.</strong> Four times the context at the same turn count is roughly four times the input bill, on the most expensive calls of the run.`,
        ]) +
        p(`<strong>Do first:</strong> measure where the tokens go. In nearly every case one or two tools dominate, and capping their output (${ch("c03", "C03")}) plus offloading large results to disk buys more than a bigger window, for free. The simulator's "offload + compact" row cuts total input tokens by 5× on the same task.`),
    },
    {
      difficulty: "core",
      prompt: `Write the compaction prompt for a coding agent. It must survive a 60-turn refactor across twelve files. Say what must be preserved exactly and what should be dropped.`,
      answer:
        code({
          title: "domain-specific, because generic summaries lose the wrong things",
          src: `Summarise this portion of a coding session. This summary REPLACES the original
transcript, so anything omitted is permanently lost to the agent.

PRESERVE EXACTLY — reproduce character for character, never paraphrase:
  - Every file path touched, with what changed in each (one line per file).
  - Function, class and symbol names involved.
  - Exact error messages and stack-trace top frames still unresolved.
  - Shell commands that must be re-run to verify (test invocations, build commands).
  - Any decision made about approach, with the reason.

PRESERVE AS PROSE:
  - What the refactor is trying to achieve, in one sentence.
  - Invariants discovered ("callers assume this returns null, not undefined").
  - Approaches tried and abandoned, WITH the reason they failed.

DROP:
  - File contents already written to disk (they are on disk; record the path).
  - Successful intermediate steps whose result is superseded.
  - Reasoning that led to a decision already recorded above.
  - Tool results from searches whose findings are captured above.

Output under 1,500 tokens, in the section order given.`,
        }) +
        p(`Three design points. <strong>Tell it the summary is destructive</strong> — models are measurably more careful when told the original is being discarded. <strong>Separate "exactly" from "as prose"</strong>, because paraphrasing a file path is catastrophic and paraphrasing a rationale is fine. <strong>Keep the abandoned approaches</strong>, or the agent will re-try them with no memory of why they failed — the single most expensive compaction bug in coding agents.`),
    },
    {
      difficulty: "core",
      prompt: `Implement <code>offload(result, tool, dir)</code>: write a large tool result to disk and return the stub that goes into the context. What must the stub contain for the agent to still be able to use the data?`,
      answer:
        code({
          title: "a pointer is only useful if it is actionable",
          src: `export async function offload(
  result: string, tool: string, ctx: ToolContext, threshold = 2_000,
): Promise<string> {
  if (estimateTokens(result) <= threshold) return result;

  const path = join(ctx.workingDir, ".agent", \`\${tool}-\${ctx.callId}.json\`);
  await writeFile(path, result, "utf8");

  const preview = structuralPreview(result);   // keys, row count, first + last record
  return [
    \`[Result too large for context — written to \${path}]\`,
    \`Size: \${result.length.toLocaleString()} bytes, ~\${estimateTokens(result).toLocaleString()} tokens.\`,
    \`Shape: \${preview.shape}\`,                       // "array of 1,203 objects"
    \`Fields: \${preview.fields.join(", ")}\`,           // so it can query without reading
    \`First record: \${preview.first}\`,
    \`Last record: \${preview.last}\`,
    \`To inspect: read_lines("\${path}", start, end) or jq_query("\${path}", "<filter>").\`,
  ].join("\\n");
}`,
        }) +
        p(`The stub needs four things or it is a dead end: <strong>the path</strong> (exact), <strong>the shape</strong> (so the agent knows what it is dealing with), <strong>the field names</strong> (so it can write a query without reading the file first), and <strong>the tool to use next</strong>, named explicitly. A stub that says only "result too large" teaches the agent that the tool is broken.`) +
        p(`Including first and last records matters more than it looks: they answer "did this return what I expected" for a surprising share of cases, at a cost of about 60 tokens, avoiding the read entirely.`),
    },
    {
      difficulty: "stretch",
      prompt: `Design an experiment that measures whether restating the goal near the end of the request actually helps <em>your</em> agent. Include the metric, the confound you must control, and the sample size.`,
      answer:
        ol([
          `<strong>Task set.</strong> 40–60 tasks that require at least 12 steps, with programmatically checkable answers (an ID, a number, a file state). Long tasks — the effect is invisible at 4 steps.`,
          `<strong>Conditions.</strong> A: goal only in the first user message. B: goal in the first message plus a restatement as the final block. Identical everything else, including tool order and temperature 0.`,
          `<strong>Metric.</strong> Primary: task success rate. Secondary, and more diagnostic: <em>goal drift</em> — the fraction of runs containing a tool call unrelated to the goal after step 8, which you can label with a cheap classifier over the trace. Drift usually moves before success does.`,
          `<strong>Confounds to control.</strong> (a) The restatement adds tokens, so also run a condition C that adds the same number of <em>irrelevant</em> tokens at the end — otherwise you are measuring "more tokens" not "goal position". (b) Prompt caching: the restatement sits after the cached prefix, so it does not invalidate the cache, but confirm that in your usage numbers. (c) Run order and time of day, since model backends change; interleave conditions rather than running A then B.`,
          `<strong>Sample size.</strong> To detect a 10-point difference in a success rate near 70% at 80% power you need roughly 300 runs per arm. That is usually unaffordable, so accept a larger detectable effect (20 points, ~80 runs per arm) and treat the result as directional. Report the confidence interval, not the point estimate.`,
        ]) +
        p(`Two honest notes. The effect is <em>task-dependent</em>: large on long multi-hop tasks, near zero on short ones — so a null result on the wrong task set tells you nothing. And this is the smallest complete example of ${ch("c19", "C19")}: if you can run this experiment, you can evaluate any change to your agent, which is the more valuable capability.`),
    },
  ],

  qa: [
    { q: "Is context engineering just prompt engineering?", a: p(`Prompt engineering is choosing the words. Context engineering is choosing <em>what is in the request at all</em>, in what order, at what cost, refreshed how often. In an agent the second dominates: the system prompt is written once and the context is rebuilt every turn, which is where both the money and the quality live.`) },
    { q: "How lossy is compaction, really?", a: p(`Measurably. In the simulator's model roughly a quarter of established facts fail to survive a generic summary, and the real figure depends entirely on the prompt. A domain-specific one that names what to preserve does far better. The mitigation that actually works is <em>offloading first</em>, so the material still exists on disk and the summary only has to remember that it does.`) },
    { q: "Should I compact or start a fresh subagent?", a: p(`Both are context resets; the difference is whether the parent keeps the detail. Compact when the work is one continuing thread and the summary is enough. Spawn a subagent (${ch("c17", "C17")}) when a sub-task will generate a lot of intermediate noise the parent genuinely does not need — a search sweep, a build-and-fix cycle. The subagent's context is discarded wholesale and only its conclusion returns, which is compaction with a much better compression ratio.`) },
    { q: "Does prompt caching survive compaction?", a: p(`The prefix does, if you keep it intact. Compaction rewrites the middle, so everything from the first changed byte onwards is a cache miss on the next call: one expensive turn, then the new prefix caches. The failure mode to avoid is compacting frequently, or compacting in a way that touches the system prompt, which means you never get a cache hit at all.`) },
    { q: "How do I know the goal is drifting before the user tells me?", a: p(`Log a one-line <em>goal-relevance</em> judgement per step — cheap model, or even a keyword overlap heuristic — and chart it across the run. A downward trend after step 8 is drift. This is a much earlier signal than task failure, and it is the metric that tells you whether your context strategy is working. ${ch("c20", "C20")} builds it.`) },
  ],

  project: {
    title: "Project · A context manager for your agent",
    brief:
      p(`Insert a <code>ContextManager</code> at the seam you left in ${ch("c04", "C04")}. The agent's behaviour on short tasks must not change at all; on long ones it should stop dying.`),
    spec: [
      "Four named regions — fixed, pinned, rolling, refreshed — assembled by <code>build()</code>. No code path anywhere appends directly to what gets sent.",
      "Token estimation with an explicit reserve for the reply, and compaction triggered at 70% of the window at a turn boundary only.",
      "A compaction prompt that preserves facts-with-provenance, dead ends, open questions and artefact paths, in that order.",
      "Automatic offloading of any tool result over a threshold, with an actionable stub (path, shape, fields, next tool).",
      "The goal restated as the final block of every request, with step number.",
      "Ordered eviction as a fallback when compaction fails, with the system prompt, the goal and the last six turns never eligible.",
      "A 40-turn test proving the run completes and that a fact established at turn 3 is still recoverable at turn 38.",
    ],
    stretch: [
      "Write each compaction to a durable log and add <code>resume(runId)</code> that rebuilds state from it — you have just built half of C08.",
      "Measure it: run your agent over the same 20 long tasks with strategies none / fifo / compact / offload+compact, and report success rate, total input tokens and fact retention. Keep the harness.",
      "Implement the goal-relevance trace metric and chart it per step for a run that goes wrong.",
    ],
  },

  quiz: [
    {
      q: "What is the 'soft limit' of a context window?",
      options: [
        "Quality degrades well before the hard token limit, because attention across a long context is uneven — material in the middle is used less",
        "The provider's rate limit on tokens per minute",
        "The point at which prompt caching stops working",
        "The maximum output tokens the model can generate",
      ],
      answer: 0,
      why: "The hard limit throws a 400 and is easy to handle. The soft limit is silent: the goal is 40K tokens up-scroll, sandwiched between observations, and the model's attention over that span is not uniform. Fitting in the window is not the same as being used.",
    },
    {
      q: "Why is FIFO eviction of the oldest messages a trap?",
      options: [
        "The oldest messages are the system prompt and the original goal — it never overflows, and the agent quietly stops knowing what it is doing",
        "It is too slow to compute on every turn",
        "It invalidates prompt caching",
        "It drops the most recent tool results",
      ],
      answer: 0,
      why: "FIFO looks like it works because nothing ever errors. But it evicts exactly what must be permanent. Eviction has to be ordered by what is safe to lose — superseded results first, never the goal and never the recent turns.",
    },
    {
      q: "Which is the cheapest operation for keeping a long run inside budget?",
      options: [
        "Offloading large results to disk and leaving an actionable pointer",
        "Compacting the middle with a summarisation call",
        "Switching to a larger context window",
        "Evicting the oldest observations",
      ],
      answer: 0,
      why: "Offloading costs no model call and loses no information, because the data is still there, retrievable by path. It turns a 10,000-token observation into a 30-token stub. It should always run before compaction, because it means compaction has far less to destroy.",
    },
    {
      q: "What must a compaction summary preserve that generic summaries usually drop?",
      options: [
        "Dead ends — what was tried, and why it failed",
        "The full text of every tool result",
        "The model's reasoning for each decision",
        "Timestamps for every step",
      ],
      answer: 0,
      why: "A summary of successes only lets the agent cheerfully retry the three approaches that already failed, with no memory of why. 'Tried X, got 0 results because the index only covers 2023+' is worth more tokens than most of what it replaces.",
    },
    {
      q: "Where should the current goal be restated in the request?",
      options: [
        "As the final block, after the conversation and any retrieved material",
        "Only in the first user message, to keep the cached prefix stable",
        "In the middle, so it is equidistant from everything",
        "Repeated before every tool result",
      ],
      answer: 0,
      why: "The end of the request is a high-attention position, and it sits after the cached prefix so it costs nothing in cache terms. About 40 tokens, and it is the standard fix for agents that wander on long tasks because their goal is buried 30,000 tokens up-scroll.",
    },
    {
      q: "Why must compaction trigger at around 70% rather than at 95%?",
      options: [
        "Compaction itself needs a model call that takes the oversized context as input — at 95% that request no longer fits",
        "Models refuse to summarise contexts over 95% full",
        "Prompt caching expires above 70%",
        "Output tokens are billed more above 95%",
      ],
      answer: 0,
      why: "The compaction death spiral: you wait too long, the summarisation request itself exceeds the window, and there is no way out. Trigger early, reserve headroom for the reply, and keep ordered eviction as a fallback since it needs no model call at all.",
    },
  ],

  continues:
    p(`Curating the context assumes you have the right material to put in it. Most of what an agent needs was never in the conversation. It is in a wiki, a codebase, a ticket system, a set of PDFs. Getting the right 2,000 tokens out of ten million and into the high-attention region is its own discipline, and ${ch("c06", "C06")} builds it from the embedding up.`),
};

export default chapter;
