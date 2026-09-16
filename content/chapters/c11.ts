import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const PATTERNS_SVG = `
<svg viewBox="0 0 700 320" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Five composition patterns from chaining to autonomous agent">
  <defs><marker id="c11" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker></defs>

  <text x="14" y="16" class="d-label">CHAINING — fixed order, each output feeds the next</text>
  <g><rect x="14" y="24" width="60" height="24" rx="4" class="d-box"/><text x="44" y="40" class="d-mono" text-anchor="middle">draft</text>
  <path d="M78 36 L94 36" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="98" y="24" width="60" height="24" rx="4" class="d-box"/><text x="128" y="40" class="d-mono" text-anchor="middle">check</text>
  <path d="M162 36 L178 36" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="182" y="24" width="60" height="24" rx="4" class="d-box"/><text x="212" y="40" class="d-mono" text-anchor="middle">polish</text></g>
  <text x="260" y="40" class="d-mono" fill="var(--fg-faint)">use when the steps never change and each is easier alone</text>

  <text x="14" y="76" class="d-label">ROUTING — one classification, then a specialised path</text>
  <g><rect x="14" y="84" width="60" height="24" rx="4" class="d-box-p"/><text x="44" y="100" class="d-mono" text-anchor="middle">classify</text>
  <path d="M78 96 L96 84" class="d-arrow" marker-end="url(#c11)"/><path d="M78 96 L96 96" class="d-arrow" marker-end="url(#c11)"/><path d="M78 96 L96 108" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="100" y="74" width="74" height="18" rx="3" class="d-box"/><text x="137" y="87" class="d-mono" text-anchor="middle">refund</text>
  <rect x="100" y="87" width="74" height="18" rx="3" class="d-box"/><text x="137" y="100" class="d-mono" text-anchor="middle">tracking</text>
  <rect x="100" y="100" width="74" height="18" rx="3" class="d-box"/><text x="137" y="113" class="d-mono" text-anchor="middle">escalate</text></g>
  <text x="194" y="100" class="d-mono" fill="var(--fg-faint)">cheap, testable, each path gets its own prompt and eval set</text>

  <text x="14" y="146" class="d-label">PARALLEL — independent work, then merge</text>
  <g><rect x="14" y="154" width="54" height="24" rx="4" class="d-box"/><text x="41" y="170" class="d-mono" text-anchor="middle">split</text>
  <rect x="86" y="146" width="66" height="16" rx="3" class="d-box-t"/><rect x="86" y="164" width="66" height="16" rx="3" class="d-box-t"/><rect x="86" y="182" width="66" height="16" rx="3" class="d-box-t"/>
  <text x="119" y="158" class="d-mono" text-anchor="middle">a</text><text x="119" y="176" class="d-mono" text-anchor="middle">b</text><text x="119" y="194" class="d-mono" text-anchor="middle">c</text>
  <path d="M156 170 L172 170" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="176" y="158" width="60" height="24" rx="4" class="d-box"/><text x="206" y="174" class="d-mono" text-anchor="middle">merge</text></g>
  <text x="252" y="174" class="d-mono" fill="var(--fg-faint)">latency win, and independent votes on the same question</text>

  <text x="14" y="222" class="d-label">ORCHESTRATOR — model decides which workers, workers are fixed</text>
  <g><rect x="14" y="230" width="78" height="24" rx="4" class="d-box-a"/><text x="53" y="246" class="d-mono" text-anchor="middle">orchestr.</text>
  <path d="M96 242 L116 230" class="d-arrow" marker-end="url(#c11)"/><path d="M96 242 L116 242" class="d-arrow" marker-end="url(#c11)"/><path d="M96 242 L116 254" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="120" y="222" width="60" height="16" rx="3" class="d-box-t"/><rect x="120" y="238" width="60" height="16" rx="3" class="d-box-t"/><rect x="120" y="254" width="60" height="16" rx="3" class="d-box-t"/>
  <path d="M184 246 L200 246" class="d-arrow" marker-end="url(#c11)"/>
  <rect x="204" y="234" width="58" height="24" rx="4" class="d-box"/><text x="233" y="250" class="d-mono" text-anchor="middle">synth</text></g>
  <text x="278" y="246" class="d-mono" fill="var(--fg-faint)">C17 — agency in selection only, not in the workers</text>

  <text x="14" y="292" class="d-label">AGENT — model owns order, tool choice and stopping</text>
  <rect x="14" y="300" width="250" height="16" rx="3" class="d-box-a"/>
  <text x="139" y="312" class="d-mono" text-anchor="middle">loop until it decides to stop  (C04)</text>
  <text x="278" y="312" class="d-mono" fill="var(--danger)">most expensive, least predictable — earn it</text>
</svg>`;

const chapter: Chapter = {
  id: "c11",
  num: 11,
  layer: "reasoning",
  title: "Control Flow",
  subtitle: "Where to put the `if` statement",
  blurb:
    "Five composition patterns and a decision procedure for choosing between them. The most valuable architectural skill in agent engineering is noticing which decisions never needed a model at all.",
  lines: 153,
  file: "code/c11_control_flow.ts",
  tags: ["workflows", "routing", "chaining", "parallelisation", "orchestrator", "agency dial", "determinism"],

  sections: [
    { id: "motivation", kicker: "Motivation", title: "The most expensive `if` in your system",
      html:
        p(`Your agent has a tool called <code>get_weather</code>. On every run where the user mentions a city, the model decides to call it. That decision costs a model call, adds a round trip, and could go the other way on an unlucky sample.`) +
        p(`It is also not a decision. The rule is <em>"if the request mentions a place and a time, fetch the weather"</em> — three lines of code, zero tokens, zero variance, and a unit test. You gave a stochastic process a job that a deterministic one does better.`) +
        p(`This chapter is about spotting that pattern, which is everywhere once you look. ${ch("c00", "C00")} introduced the dial; this is how to actually choose a position, at the level of individual decisions rather than whole systems.`) +
        note("key", "The question to keep asking", p(`For every decision your agent makes: <strong>could I have written this rule down?</strong> If yes, write it down. Model calls are for decisions you cannot enumerate. Everything else is paying a premium for nondeterminism you did not want.`)) },

    { id: "core-idea", kicker: "Core idea", title: "Five patterns",
      html:
        fig({ label: "Diagram", title: "composition patterns, cheapest first", body: PATTERNS_SVG,
          caption: `These compose: a routing step whose branches are chains, one of which ends in an agent. Most good production systems are exactly that — a deterministic skeleton with agency in the two places that need it.` }) +
        table(["Pattern", "Who decides", "Cost", "Reach for it when"], [
          ["<b>Chaining</b>", "You", "N calls, fixed", "The steps never change and each is easier in isolation"],
          ["<b>Routing</b>", "Model picks 1 of N", "1 + branch", "Inputs fall into distinct kinds needing different handling"],
          ["<b>Parallel</b>", "You", "N calls, 1 wall-clock", "Independent subtasks, or several votes on one question"],
          ["<b>Orchestrator</b>", "Model picks workers", "1 + k + 1", "Which subtasks are needed depends on the input"],
          ["<b>Agent</b>", "Model, every step", "unbounded", "The next step depends on what the last one returned"],
        ]) +
        `<h3>Routing is the most underrated</h3>` +
        p(`A single cheap classification into three or four branches buys most of what people build agents for, at a fraction of the cost, and each branch gets a focused prompt, a small tool set, and its own eval set. That last point matters more than the cost: <em>you can measure a branch</em>. "Refund requests succeed 94% of the time, tracking 99%, escalations 87%" is an actionable dashboard. "The agent succeeds 93% of the time" is not.`) +
        code({ title: "code/c11_control_flow.ts — a router with a real escape hatch",
          src: `const ROUTES = {
  refund:   { system: REFUND_PROMPT,   tools: [orders, policies, issueRefund], maxSteps: 6 },
  tracking: { system: TRACKING_PROMPT, tools: [orders, carrier],               maxSteps: 3 },
  policy:   { system: POLICY_PROMPT,   tools: [searchDocs],                    maxSteps: 4 },
  other:    { system: GENERAL_PROMPT,  tools: ALL_TOOLS,                       maxSteps: 12 },
} as const;

export async function handle(request: string, model: Model) {
  const { route, confidence } = await structured(model, [{ role: "user", content: ROUTE_PROMPT + request }],
    obj({ route: enumOf(["refund", "tracking", "policy", "other"] as const),
          confidence: num({ min: 0, max: 1 }) }),
    { model: "small" });                       // classification does not need the big model

  // Low confidence falls back to the general agent rather than guessing a branch.
  // Without this, an unusual request gets a specialist that cannot help it.
  const cfg = confidence < 0.7 ? ROUTES.other : ROUTES[route];
  return runAgent(request, cfg);
}`,
        }) +
        p(`Two design points. The classifier uses a small model, because routing is the archetypal cheap-model task. And the <code>other</code> branch is a real agent, not an error: a router without a general fallback fails on exactly the inputs that motivated building an agent in the first place.`) +
        `<h3>Parallel has two different uses</h3>` +
        ul([
          `<strong>Sectioning</strong> — genuinely independent subtasks run concurrently. A latency win, and the win is large: five 2-second calls become one 2-second wave.`,
          `<strong>Voting</strong> — the same question asked several ways, then aggregated. Buys accuracy on high-stakes judgements, and is the honest version of ${ch("c10", "C10")}'s self-consistency: three independent samples with a majority rule beat one sample plus "are you sure?".`,
        ]) },

    { id: "mechanics", kicker: "Mechanics", title: "The decision procedure",
      html:
        p(`Apply this per <em>decision</em>, not per system. Most systems land in several places at once, which is correct.`) +
        code({ title: "five questions, in order", lang: "text", plain: true,
          src: `1. Can I write this rule down?
   yes → write code. No model call. (This eliminates more decisions than you expect.)

2. Is it a classification into a fixed, known set?
   yes → routing, with a small model and a confidence threshold.

3. Do I know the full sequence of steps before I start?
   yes → chaining. Parallelise any steps that do not depend on each other.

4. Does the SET of steps depend on the input, but each step is itself well-defined?
   yes → orchestrator: the model picks which workers to run, the workers are fixed.

5. Does step N+1 depend on the CONTENT returned by step N, in ways you cannot enumerate?
   yes → agent. This is the only question whose "yes" earns the loop.
   no  → you are at 1–4. Go back.`,
        }) +
        p(`Question 5 is the real test, and it has a precise reading. "Search, then summarise" is a chain: the second step needs the first step's <em>output</em>, but you always knew it was coming. "Search, and if the results contradict the policy, search the policy index instead, and if that is ambiguous, ask the user" is an agent, because the branch structure is a function of content you have not seen.`) +
        `<h3>The hybrid that most production systems converge on</h3>` +
        code({ title: "deterministic skeleton, agency in two places",
          src: `export async function handleTicket(ticket: Ticket) {
  // 1. RULES. No model. Free, instant, testable, auditable.
  if (ticket.priority === "P0") return escalateToHuman(ticket);
  if (isDuplicate(ticket)) return linkToExisting(ticket);
  if (ticket.body.length < 20) return askForDetail(ticket);

  // 2. ROUTE. One small-model call.
  const { route, confidence } = await classify(ticket);

  // 3. FIXED CHAIN for the common, well-understood case — 70% of traffic.
  if (route === "tracking" && confidence > 0.85) {
    const order = await lookupOrder(ticket.orderId);          // deterministic
    const status = await carrier.track(order.tracking);       // deterministic
    return writeReply(TRACKING_TEMPLATE, { order, status });  // one model call for prose
  }

  // 4. AGENT for the long tail — 30% of traffic, 90% of the difficulty.
  return runAgent(ticket.body, ROUTES[route]);
}`,
        }) +
        note("good", "The shape to aim for", p(`Seventy per cent of traffic takes a path with one cheap model call and predictable latency. Thirty per cent gets the full agent. Cost drops by roughly an order of magnitude, p50 latency by more, and the agent's eval set is now the hard cases only, which makes it far easier to improve.`)) +
        `<h3>Do not confuse "the model is involved" with "this is an agent"</h3>` +
        p(`Step 3 above makes a model call. It is not an agent: the model writes prose into a fixed shape, and the control flow is yours. That distinction is what makes the branch testable, cheap, and explainable to whoever signs off on it.`) },

    { id: "explore", kicker: "Explore", title: "Architect a system under a traffic mix",
      html:
        p(`Set your traffic mix and assign each class a pattern. Watch cost, p50, p99, and the share of traffic whose behaviour you can actually predict.`) +
        lab({ label: "Simulator", title: "pattern assignment under load",
          body: `
<div class="controls">
  <div class="ctl"><label>simple &amp; routine</label><input type="range" id="f11-a" min="0" max="100" step="5" value="55"><span class="val" id="f11-a-v">55%</span></div>
  <div class="ctl"><label>needs a branch</label><input type="range" id="f11-b" min="0" max="100" step="5" value="25"><span class="val" id="f11-b-v">25%</span></div>
  <div class="ctl"><label>genuinely open-ended</label><span class="val" id="f11-c-v">20%</span></div>
</div>
<div class="controls" style="border-top:1px solid var(--border);padding-top:.75rem">
  <div class="ctl"><label>pattern for simple</label><select id="f11-pa"><option value="rule">rules (no model)</option><option value="chain" selected>fixed chain</option><option value="agent">agent</option></select></div>
  <div class="ctl"><label>pattern for branching</label><select id="f11-pb"><option value="chain">fixed chain</option><option value="route" selected>routing</option><option value="agent">agent</option></select></div>
  <div class="ctl"><label>pattern for open-ended</label><select id="f11-pc"><option value="route">routing</option><option value="orch">orchestrator</option><option value="agent" selected>agent</option></select></div>
  <div class="ctl"><label>volume / day</label><input type="range" id="f11-v" min="100" max="100000" step="100" value="10000"><span class="val" id="f11-v-v">10,000</span></div>
</div>
<div id="f11-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="f11-cost">—</b><span>$ / day</span></div>
  <div class="stat"><b id="f11-p50">—</b><span>p50 latency</span></div>
  <div class="stat"><b id="f11-p99">—</b><span>p99 latency</span></div>
  <div class="stat"><b id="f11-succ">—</b><span>overall success</span></div>
  <div class="stat"><b id="f11-pred">—</b><span>predictable traffic</span></div>
</div>
<div class="note" id="f11-note" style="margin-top:1rem"></div>`,
          script: `
var P = {
  rule:  { cost: 0,      p50: 30,   p99: 60,    det: 1,   fit: { simple: .97, branch: .55, open: .12 } },
  chain: { cost: .0022,  p50: 1400, p99: 2600,  det: 1,   fit: { simple: .95, branch: .74, open: .34 } },
  route: { cost: .0035,  p50: 1900, p99: 4200,  det: .9,  fit: { simple: .95, branch: .93, open: .55 } },
  orch:  { cost: .0180,  p50: 5200, p99: 15000, det: .35, fit: { simple: .93, branch: .90, open: .82 } },
  agent: { cost: .0290,  p50: 7400, p99: 31000, det: 0,   fit: { simple: .91, branch: .89, open: .90 } }
};
function upd() {
  var a = +document.getElementById("f11-a").value, b = +document.getElementById("f11-b").value;
  if (a + b > 100) b = 100 - a;
  document.getElementById("f11-b").value = b;
  var c = 100 - a - b;
  document.getElementById("f11-a-v").textContent = a + "%";
  document.getElementById("f11-b-v").textContent = b + "%";
  document.getElementById("f11-c-v").textContent = c + "%";
  var V = +document.getElementById("f11-v").value;
  document.getElementById("f11-v-v").textContent = V.toLocaleString();

  var mix = [
    { k: "simple & routine",     share: a / 100, kind: "simple", pat: document.getElementById("f11-pa").value },
    { k: "needs a branch",       share: b / 100, kind: "branch", pat: document.getElementById("f11-pb").value },
    { k: "genuinely open-ended", share: c / 100, kind: "open",   pat: document.getElementById("f11-pc").value }
  ];
  var cost = 0, succ = 0, det = 0, lat = [];
  document.getElementById("f11-rows").innerHTML = mix.map(function (m) {
    var p = P[m.pat], s = p.fit[m.kind];
    cost += m.share * V * p.cost; succ += m.share * s; det += m.share * p.det;
    lat.push({ w: m.share, p50: p.p50, p99: p.p99 });
    var col = s > .9 ? "var(--ok)" : s > .7 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:12rem;color:var(--fg-muted)">' + m.k + ' · ' + Math.round(m.share * 100) + '%</span>' +
      '<span class="mono small" style="width:5rem;color:var(--accent)">' + m.pat + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (s * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(s * 100) + '%</span></div>';
  }).join("");

  var p50 = lat.reduce(function (t, x) { return t + x.w * x.p50; }, 0);
  var p99 = Math.max.apply(null, lat.filter(function (x) { return x.w > .05; }).map(function (x) { return x.p99; }));
  document.getElementById("f11-cost").textContent = "$" + cost.toFixed(0);
  document.getElementById("f11-p50").textContent = (p50 / 1000).toFixed(1) + "s";
  document.getElementById("f11-p99").textContent = (p99 / 1000).toFixed(1) + "s";
  document.getElementById("f11-succ").textContent = Math.round(succ * 100) + "%";
  document.getElementById("f11-pred").textContent = Math.round(det * 100) + "%";

  var allAgent = mix.every(function (m) { return m.pat === "agent"; });
  var n = document.getElementById("f11-note");
  if (allAgent) n.innerHTML = "<b>Everything is an agent.</b> Success is fine and you are paying roughly 10× for it, with a p99 measured in half-minutes and 0% of traffic whose behaviour you can predict. This is the most common architecture in a first production release.";
  else if (mix[0].pat === "rule") n.innerHTML = "<b>Rules on the routine path.</b> Zero cost, 30ms, fully testable — for the majority of traffic. Check the success bar for that row: if it is above 95%, those requests genuinely did not need a model, and you just removed most of your bill.";
  else if (mix[2].pat !== "agent" && c > 15) n.innerHTML = "<b>Open-ended traffic is being forced down a fixed path.</b> Look at its success row. This is the mirror-image mistake: agency is expensive, and refusing to pay for it where it is genuinely needed shows up as a fifth of your users being quietly failed.";
  else n.innerHTML = "<b>A sensible allocation.</b> Deterministic where the rules are writable, routing where the kinds are known, and an agent only for the genuinely open tail. Note the predictable-traffic figure — that is the share you can test, explain and put an SLA on.";
}
["f11-a","f11-b","f11-v","f11-pa","f11-pb","f11-pc"].forEach(function (i) {
  document.getElementById(i).addEventListener("input", upd); document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `Set all three to "agent" and read the cost and p99. Then set simple to "rules" and branching to "routing". The success number barely moves and everything else improves by an order of magnitude, which is the entire argument of this chapter in one interaction.`,
        }) },

    { id: "build", kicker: "Build it", title: "One interface for every pattern",
      html:
        p(`If every pattern has the same signature, you can change a decision's position on the dial without rewriting its call sites, and you can A/B two positions against the same eval set.`) +
        code({ title: "code/c11_control_flow.ts — patterns as values",
          src: `export type Handler<I, O> = (input: I, ctx: Ctx) => Promise<O>;

export const chain = <I, O>(...steps: Handler<any, any>[]): Handler<I, O> =>
  async (input, ctx) => {
    let v: any = input;
    for (const s of steps) v = await s(v, ctx);
    return v;
  };

export const route = <I, O>(
  classify: Handler<I, { route: string; confidence: number }>,
  routes: Record<string, Handler<I, O>>,
  fallback: Handler<I, O>,
  minConfidence = 0.7,
): Handler<I, O> =>
  async (input, ctx) => {
    const { route: r, confidence } = await classify(input, ctx);
    ctx.log("route", { route: r, confidence });            // routing decisions are eval gold
    return (confidence >= minConfidence && routes[r] ? routes[r] : fallback)(input, ctx);
  };

export const parallel = <I, O, R>(
  branches: Handler<I, O>[], merge: (results: O[], input: I) => Promise<R>,
): Handler<I, R> =>
  async (input, ctx) => {
    const settled = await Promise.allSettled(branches.map((b) => b(input, ctx)));
    const ok = settled.filter(isFulfilled).map((s) => s.value);
    if (!ok.length) throw new AggregateError(settled.map((s) => (s as any).reason));
    return merge(ok, input);                                // partial results still merge
  };

export const agent = (cfg: AgentConfig): Handler<string, AgentResult> =>
  (goal, ctx) => runAgent(goal, { ...cfg, ctx });

// Composition is just application:
const support = route(classify, {
  tracking: chain(lookupOrder, trackShipment, writeReply),
  refund:   agent(REFUND_CFG),
  policy:   chain(searchPolicies, writeAnswer),
}, agent(GENERAL_CFG));`,
        }) +
        p(`<code>ctx.log("route", …)</code> is small and important: routing decisions with their confidence are the highest-value thing you can log. They tell you which branch is misfiring, where the confidence threshold should sit, and whether a new category has appeared in your traffic.`) +
        code({ title: "run it", lang: "bash", plain: true,
          src: `node --experimental-strip-types code/c11_control_flow.ts

#   C11 · Control Flow
#
#   a hybrid in action — one router, two chains, two agents:
#
#     Order 4471 is in transit.
#     [agent] worked out refund eligibility for: I want my money back for 4471
#     [chain] policy answer for "what are the rules on re…"
#     [general agent] handling an unclassified request: my cat walked across t
#
#     routing log: tracking@0.91  refund@0.94  policy@0.88  other@0.41
#     the last one fell back to the general agent — which is what the fallback is for
#
#   parallel with one failed branch: majority of 2 surviving branches: high
#   allSettled, not all — one rejection must not discard the others
#
#   10,000 requests/day · 55% routine, 25% needs a branch, 20% open-ended
#
#   architecture                      $/day     p50      p99  success  predictable
#   everything is an agent             $290    7.4s    31.0s      90%           0%
#   route → chain | agent               $79    2.7s    31.0s      94%          78%
#   rules → route → chain|agent         $67    2.0s    31.0s      95%          78%
#
#   Success barely moves. Cost falls by an order of magnitude, p50 by more, and
#   83% of traffic becomes something you can test, explain and put an SLA on.
#
#   the opposite error — refusing to pay for agency where it is needed:
#     force open-ended down a chain       $13    0.8s     4.2s      83%
#     cheapest of all, and a fifth of users are quietly failed.`,
        }) },

    { id: "production", kicker: "Production notes", title: "Field notes",
      html:
        ul([
          `<strong>Anthropic's "Building Effective Agents"</strong> is the canonical write-up of these patterns and is worth reading in full. Its central claim — use the simplest composition that works, and add agency only where it buys real task performance — is the thesis of this chapter.`,
          `<strong>LangGraph</strong> is a direct implementation of this space: nodes are handlers, edges are control flow, conditional edges are routing, and an agent is a cycle. Building this vocabulary yourself first is why its API stops looking arbitrary.`,
          `<strong>Routing decisions are where cheap models earn their keep.</strong> A small model classifying into four buckets at 99% accuracy costs a fraction of the capable model's call and lands on the latency-critical path. This is the single easiest cost win in most systems.`,
          `<strong>Instrument the boundaries.</strong> Success rate per branch, confidence distribution, fallback rate. A rising fallback rate is an early signal that your traffic has shifted and a category is missing.`,
          `<strong>Start agentic, then harden.</strong> A legitimate development order: build the agent first to discover what the task actually requires, read fifty traces, notice that eight steps are always identical, and promote them into a chain. You end up with the hybrid, and you got there from evidence rather than guesswork.`,
        ]) },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `For each, name the cheapest pattern that works: (a) translate a document into five languages; (b) answer a question about a 200-page PDF; (c) triage an incident; (d) write a blog post, check it for errors, then polish it; (e) "do whatever is needed to make CI green".`,
      answer: ul([
        `<b>(a) Parallel (sectioning).</b> Five independent calls, one wall-clock. No agency anywhere.`,
        `<b>(b) Chain.</b> Retrieve, then answer. Two steps, always the same two. If follow-up questions are likely, an agent with a search tool — but a single question is a chain.`,
        `<b>(c) Routing.</b> Classify severity and type, then run a severity-specific handler. P0 should bypass the model entirely and page a human — that is question 1.`,
        `<b>(d) Chain.</b> Three fixed steps in a fixed order. The classic case where splitting a hard task into easy ones raises quality with no agency.`,
        `<b>(e) Agent.</b> The next step depends entirely on what the last build output said. This is the only one where question 5 is genuinely yes.`,
      ]) },

    { difficulty: "core",
      prompt: `Your agent has 12 tools. Reviewing 100 traces, you find 4 tools are called in the same order 80% of the time. What do you do, and what do you check first?`,
      answer: p(`That fixed sub-sequence is a chain the model is rediscovering (and paying for) on every run. Two options:`) +
        ol([
          `<strong>Collapse into one composite tool.</strong> <code>investigate_order(id)</code> internally calls all four and returns a combined result. The model makes one decision instead of four, and you save three round trips and three sets of tokens. Keep the individual tools available for the 20% case.`,
          `<strong>Promote it to a chain before the agent runs.</strong> If the sequence always starts the run, run it deterministically and give the agent its results as initial context. It now starts step 1 already informed.`,
        ]) +
        p(`<strong>Check first, before doing either:</strong> what is in the other 20%? If those runs deviate because the first tool returned something unexpected, that deviation is the valuable behaviour and collapsing the sequence destroys it. The composite tool must then surface enough detail for the agent to notice the same thing, which usually means returning the sub-results rather than just a summary.`) +
        p(`Also check <em>ordering variance</em>: if the four tools appear in different orders in the 80%, they are independent and the real win is parallelism, not composition.`) },

    { difficulty: "core",
      prompt: `Implement a routing layer that improves itself: it should detect when a new category appears in traffic and surface it, without silently changing behaviour.`,
      answer: code({ title: "the fallback rate is the signal",
        src: `export class AdaptiveRouter {
  private fallbacks: Array<{ input: string; confidence: number; at: number }> = [];

  async route(input: string, ctx: Ctx): Promise<Handler<string, Result>> {
    const { route, confidence } = await this.classify(input);
    ctx.metric("route.confidence", confidence, { route });

    if (confidence < this.threshold) {
      this.fallbacks.push({ input, confidence, at: Date.now() });
      ctx.metric("route.fallback", 1);
      return this.general;                 // behaviour is unchanged: still the safe path
    }
    return this.routes[route];
  }

  /** Offline, on a schedule. Proposes — never applies. */
  async proposeCategories(model: Model): Promise<CategoryProposal[]> {
    const recent = this.fallbacks.filter((f) => f.at > Date.now() - 7 * 864e5);
    if (recent.length < 30) return [];                       // not enough signal
    const clusters = await clusterByEmbedding(recent.map((f) => f.input), { minSize: 8 });
    return Promise.all(clusters.map(async (c) => ({
      size: c.length,
      examples: c.slice(0, 5),
      proposed: await structured(model, [{ role: "user", content: NAME_CATEGORY_PROMPT + c.slice(0, 20).join("\\n") }],
        obj({ name: str(), description: str(), suggestedTools: arr(str()) })),
    })));
  }
}` }) +
      ul([
        `<strong>Propose, never auto-apply.</strong> A router that adds categories on its own changes system behaviour with no review, no eval, and no rollback. The output is a pull request, not a deployment.`,
        `<strong>The fallback rate is the monitor.</strong> A step change in it means traffic has shifted — a new product launched, a policy changed, an incident is generating a novel request type. That alert is worth more than the clustering.`,
        `<strong>Watch the low-confidence <em>successes</em> too.</strong> Requests routed at confidence 0.71 that succeeded are evidence the threshold could come down; ones that failed are evidence it should go up. Log the outcome alongside the confidence or you cannot tune it.`,
      ]) },

    { difficulty: "stretch",
      prompt: `Write the migration plan for turning a working all-agent system into the hybrid, without a regression. Include how you decide what to promote and how you prove it was safe.`,
      answer: ol([
        `<strong>Build the eval set first, from production.</strong> Sample 200 real requests stratified by outcome, including failures. Record current behaviour as the baseline. Nothing else in this plan is safe without this step. You cannot prove no regression against a baseline you do not have.`,
        `<strong>Cluster the traces, not the requests.</strong> Group by <em>tool sequence</em>. The clusters that are large and low-variance are your promotion candidates; high-variance clusters stay agentic no matter how large.`,
        `<strong>Promote one cluster, shadow first.</strong> Implement the chain, run it in parallel with the agent on live traffic, and compare outputs without serving the new path. Disagreements are your review queue, and they are usually where you discover the agent was doing something subtle.`,
        `<strong>Ship behind a confidence gate.</strong> The chain handles the request only when the router is confident <em>and</em> the input matches the cluster's preconditions. Everything else falls through to the agent. Fail open toward the agent, always.`,
        `<strong>Measure four things per cluster:</strong> success rate versus baseline, cost, p50/p99, and fallback rate. Promote the next cluster only when the previous one has been stable for a week.`,
        `<strong>Keep the agent path warm.</strong> Route a small percentage of eligible traffic to it permanently. It is your control group, and it is how you notice that the chain has silently degraded as the world changed around it.`,
      ]) +
      p(`<strong>The mistake to avoid:</strong> promoting based on frequency alone. A cluster covering 30% of traffic with high tool-order variance is frequent <em>because</em> it is varied, and freezing it into a chain converts a flexible success into a rigid failure. Variance within a cluster, not its size, is the promotion criterion.`) },
  ],

  qa: [
    { q: "Isn't a router just an agent with one step?", a: p(`Mechanically similar, structurally different in the way that matters: the router's branches are fixed and enumerable, so each can be prompted, tested and measured independently. "Refunds succeed 94%, tracking 99%" is a dashboard you can act on; "the agent succeeds 93%" is not.`) },
    { q: "How do I know if a decision is genuinely non-enumerable?", a: p(`Try to enumerate it. Sit down and write the rules for twenty real examples. If you finish in twenty minutes, it was enumerable and you now have the code. If you keep hitting "well, it depends on what the search returned" — that is question 5, and you have earned the loop.`) },
    { q: "Does the hybrid make the system harder to maintain?", a: p(`It makes it harder to <em>describe</em> and much easier to maintain, because failures are localised. In an all-agent system, every bug is a prompt change affecting everything. In the hybrid, a broken tracking flow is a broken function with a test.`) },
    { q: "Where does human-in-the-loop fit in this taxonomy?", a: p(`As a node like any other — a handler that blocks on an approval, with the durability from ${ch("c08", "C08")} so the process need not stay alive. The interesting design question is <em>where</em> in the graph the approval sits, and ${ch("c16", "C16")} argues it belongs at the last reversible point, not at the end.`) },
    { q: "Should the router and the agent share a system prompt?", a: p(`No. Each branch should have the narrowest prompt and the smallest tool set that does its job. That is most of the benefit of routing (${ch("c03", "C03")}: fewer, disjoint tools select better). Share the tool <em>definitions</em>; do not share the instructions.`) },
  ],

  project: {
    title: "Project · Convert your agent to a hybrid",
    brief: p(`Take the agent you have been building and find the parts that never needed agency. The measurable goal: cut cost and p50 substantially with no loss in success rate.`),
    spec: [
      "The five composition primitives — <code>rule</code>, <code>chain</code>, <code>route</code>, <code>parallel</code>, <code>agent</code> — sharing one <code>Handler</code> signature.",
      "An eval set of at least 50 real or realistic requests with recorded baseline behaviour, built <em>before</em> any change.",
      "At least one decision moved from the model to code, with the test that replaces it.",
      "A router with a small model, a confidence threshold, a general-agent fallback, and logging of route and confidence on every request.",
      "At least one fixed chain for a high-volume case, gated on router confidence.",
      "A before/after table: cost per 1,000 requests, p50, p99, success rate, and share of traffic on a deterministic path.",
    ],
    stretch: [
      "Add the fallback-clustering job that proposes new categories as a report, never applying them.",
      "Shadow-run a promoted chain against the agent on the same inputs and review every disagreement.",
      "Add parallel voting to your highest-stakes decision and measure whether three samples with a majority rule beat one sample plus a critic, at comparable cost.",
    ],
  },

  quiz: [
    { q: "What is the first question in the decision procedure?",
      options: ["Can I write this rule down? If yes, write code — no model call", "Which model should handle this?", "How many steps will this take?", "Does this need tools?"],
      answer: 0,
      why: "It eliminates more decisions than any other question. Giving a stochastic process a job a deterministic one does better costs money, latency and predictability, and buys nothing." },
    { q: "What distinguishes a chain from an agent?",
      options: ["In a chain you know the full sequence before starting; in an agent the next step depends on content you have not seen", "Chains cannot use tools", "Agents use larger models", "Chains cannot make model calls"],
      answer: 0,
      why: "'Search then summarise' is a chain — you always knew step 2 was coming. 'Search, and if the results contradict the policy, search the policy index instead' is an agent, because the branch structure is a function of unseen content." },
    { q: "Why does a router need a general-agent fallback?",
      options: ["Without one, unusual inputs get a specialist that cannot handle them — exactly the cases that motivated agency", "To handle API errors from the classifier", "To reduce cost on common paths", "To satisfy the confidence threshold"],
      answer: 0,
      why: "A confident misroute sends a novel request to a branch with the wrong prompt and wrong tools. Falling back below a confidence threshold keeps the long tail working, which is the whole reason you built an agent." },
    { q: "In the simulator, what happened when every traffic class was handled by an agent?",
      options: ["Success was fine but cost was roughly 10× higher, p99 was tens of seconds, and no traffic was predictable", "Success dropped sharply", "Latency improved due to parallelism", "Cost was unchanged but reliability fell"],
      answer: 0,
      why: "That is the characteristic shape of a first production release: it works, and it is paying an order of magnitude for flexibility that most requests never use — with a p99 nobody can put an SLA on." },
    { q: "Four tools are always called in the same order in 80% of traces. What should you check before collapsing them into one composite tool?",
      options: ["What happens in the other 20% — that deviation may be the valuable behaviour", "Whether the tools are read-only", "Whether the model supports parallel tool calls", "Whether the tools share a schema"],
      answer: 0,
      why: "If runs deviate because the first tool returned something unexpected, the composite must surface enough detail for the agent to notice the same thing. Collapsing blindly turns an adaptive success into a rigid failure." },
    { q: "What is the right criterion for promoting an agentic path into a fixed chain?",
      options: ["Low variance in the tool sequence within that cluster — not how much traffic it represents", "The size of the cluster", "The cost of the cluster", "The average number of steps"],
      answer: 0,
      why: "A large cluster with high tool-order variance is frequent because it is varied. Freezing it removes exactly the adaptability that was doing the work. Variance, not volume, decides." },
  ],

  continues: p(`You now have a system with the right amount of agency in the right places. It will still fail — tools time out, models return nonsense, APIs rate-limit, and the agent occasionally decides to do something inexplicable. ${ch("c12", "C12")} is the taxonomy of those failures and the specific recovery each one needs, because "wrap it in a try/catch and retry" is wrong for most of them.`),
};

export default chapter;
