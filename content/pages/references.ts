import type { Page } from "../../src/types.ts";
import { p, note } from "../../src/ui.ts";

interface Ref { title: string; who: string; what: string; ch: string; url?: string }

const REFS: Ref[] = [
  { title: "Building Effective Agents", who: "Anthropic", ch: "c11", what: "The composition patterns — chaining, routing, parallelisation, orchestrator–worker — and the argument for the simplest thing that works. Read this first if you read nothing else." },
  { title: "ReAct: Synergizing Reasoning and Acting", who: "Yao et al., 2022", ch: "c04", what: "The agent loop, formalised. Worth reading for the original Thought/Action/Observation traces, which make the structure unmistakable." },
  { title: "Lost in the Middle", who: "Liu et al., 2023", ch: "c05", what: "Measured non-uniform attention across long contexts. The empirical basis for treating position as a design variable." },
  { title: "Reflexion; Self-Refine", who: "Shinn et al.; Madaan et al., 2023", ch: "c10", what: "Critic loops and their limits. The gains concentrate where an external signal is available, which is C10's whole argument." },
  { title: "Contextual Retrieval", who: "Anthropic", ch: "c06", what: "Prepending generated context to each chunk before embedding, with measured reductions in retrieval failure." },
  { title: "Model Context Protocol specification", who: "Anthropic / the MCP community", ch: "c15", what: "The protocol itself, and — more importantly — its security section on user consent and untrusted tool annotations." },
  { title: "autogen-core", who: "Microsoft", ch: "c18", what: "The clearest open implementation of an agent runtime: AgentId, TopicId, TypeSubscription, RoutedAgent, and a distributed runtime that agent code cannot tell apart from the local one." },
  { title: "AutoGen AgentChat teams", who: "Microsoft", ch: "c17", what: "RoundRobinGroupChat, SelectorGroupChat, Swarm, MagenticOne, and composable termination conditions." },
  { title: "codex-rs apply-patch", who: "OpenAI", ch: "c14", what: "The patch format and parser: sentinels, @@ locators, Add/Update/Delete/Move, fuzzy punctuation normalisation, and the refusal to apply a patch that was not explicitly invoked." },
  { title: "Codex configuration reference", who: "OpenAI", ch: "c16", what: "sandbox_mode and approval_policy as independent axes, with the dangerous combination reachable and centrally forbiddable." },
  { title: "Prompt injection, and the lethal trifecta", who: "Simon Willison", ch: "c21", what: "The clearest available writing on why injection has no general fix, and the framing that turns it into an architecture question." },
  { title: "Defeating Prompt Injections by Design (CaMeL)", who: "Debenedetti et al., 2025", ch: "c21", what: "A privileged planner that never sees untrusted data, a quarantined model that emits only typed values, and dataflow policies between them." },
  { title: "OWASP Top 10 for LLM Applications", who: "OWASP", ch: "c21", what: "The vocabulary your security team already uses. Mapping your design onto it shortens a review considerably." },
  { title: "How we built our multi-agent research system", who: "Anthropic", ch: "c17", what: "An orchestrator with parallel subagents on real research tasks, and an honest account of the token multiple it costs." },
  { title: "τ-bench; SWE-bench; GAIA", who: "various", ch: "c19", what: "Agent benchmarks worth knowing for orientation and model selection — and worth not confusing with your own eval set." },
  { title: "OpenTelemetry GenAI semantic conventions", who: "OpenTelemetry", ch: "c20", what: "Standard attribute names for model calls, so your traces render in any compatible backend." },
  { title: "Designing Data-Intensive Applications, ch. 8–9", who: "Kleppmann", ch: "c08", what: "Leases, fencing tokens, exactly-once semantics. Agents rediscover distributed-systems problems, and this is where the answers already are." },
  { title: "Instructor; Outlines; XGrammar", who: "various", ch: "c02", what: "Three implementations of constrained decoding at different layers — library, server, kernel. Reading one demystifies it." },
];

export function referencesPage(): Page {
  const byCh = [...REFS].sort((a, b) => a.ch.localeCompare(b.ch));
  return {
    slug: "references",
    kicker: "Reference",
    title: "Sources worth reading",
    subtitle: "The papers, specifications and implementations behind each chapter — with what to take from each.",
    html:
      p(`<span class="lede">This is a short list on purpose. Each entry is something that changed how the corresponding chapter is written, and each has a note saying what to take from it rather than just what it is.</span>`) +
      byCh.map((r) => `<div class="ex-item" style="grid-template-columns:3rem 1fr">
        <span class="n" style="width:auto;padding:0 .35rem">${r.ch.toUpperCase()}</span>
        <div>
          <p style="margin:0 0 .15rem"><strong>${r.title}</strong> <span class="muted small">— ${r.who}</span></p>
          <p class="muted" style="margin:0;font-size:.9375rem">${r.what}</p>
        </div></div>`).join("") +
      note("", "On reading production source", p(`The highest-value reading on this list is not a paper. It is <code>autogen-core</code>'s runtime and Codex's <code>apply_patch</code> — two compact, well-commented implementations of things this course builds. After the corresponding chapters they read as familiar code with better error handling, which is the point of having built them yourself.`)),
  };
}
