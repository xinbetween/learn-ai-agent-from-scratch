import type { Page } from "../../src/types.ts";
import { p, note } from "../../src/ui.ts";

interface Ref { title: string; who: string; what: string; ch: string; url: string }

const REFS: Ref[] = [
  { title: "Building Effective Agents", who: "Anthropic", ch: "c11", url: "https://www.anthropic.com/research/building-effective-agents", what: "Composition patterns—chaining, routing, parallelisation, and orchestrator–worker—and a strong case for starting with the simplest design that meets the task." },
  { title: "ReAct: Synergizing Reasoning and Acting", who: "Yao et al., 2022", ch: "c04", url: "https://arxiv.org/abs/2210.03629", what: "The original Thought/Action/Observation formulation behind the loop taught in C04." },
  { title: "Lost in the Middle", who: "Liu et al., 2023", ch: "c05", url: "https://arxiv.org/abs/2307.03172", what: "Evidence that position in a long context affects retrieval performance; treat ordering as a design variable." },
  { title: "Reflexion", who: "Shinn et al., 2023", ch: "c10", url: "https://arxiv.org/abs/2303.11366", what: "A useful starting point for critic loops. Its results are a prompt to evaluate your own feedback signal, not a guarantee that self-critique helps every task." },
  { title: "Self-Refine", who: "Madaan et al., 2023", ch: "c10", url: "https://arxiv.org/abs/2303.17651", what: "An iterative feedback-and-refinement pattern; compare it with Reflexion when designing C10-style verification." },
  { title: "Contextual Retrieval", who: "Anthropic", ch: "c06", url: "https://www.anthropic.com/news/contextual-retrieval", what: "Generated context can be prepended to chunks before embedding; the article reports retrieval improvements on Anthropic's evaluations." },
  { title: "Model Context Protocol specification", who: "MCP community", ch: "c15", url: "https://modelcontextprotocol.io/specification", what: "The protocol and its security guidance, including consent and careful treatment of untrusted servers and annotations." },
  { title: "AutoGen Core", who: "Microsoft", ch: "c18", url: "https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/agent-and-agent-runtime.html", what: "A concrete actor-runtime design: AgentId, TopicId, TypeSubscription, RoutedAgent, and runtime-managed delivery." },
  { title: "AutoGen AgentChat teams", who: "Microsoft", ch: "c17", url: "https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html", what: "Team patterns such as round-robin, selector, swarm, and explicit termination conditions." },
  { title: "Codex repository", who: "OpenAI", ch: "c14", url: "https://github.com/openai/codex", what: "A production codebase to compare with the course's patch engine; inspect the current implementation rather than relying on a frozen format description." },
  { title: "OpenAI MCP tool approvals", who: "OpenAI", ch: "c16", url: "https://platform.openai.com/docs/guides/tools-connectors-mcp", what: "An example of approval policy at a tool boundary. Treat provider-specific settings as one layer of a broader permission design." },
  { title: "Prompt injection and the lethal trifecta", who: "Simon Willison", ch: "c21", url: "https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/", what: "A clear framing of why untrusted content, private data, and external communication form an exfiltration risk." },
  { title: "Defeating Prompt Injections by Design (CaMeL)", who: "Debenedetti et al., 2025", ch: "c21", url: "https://arxiv.org/abs/2503.18813", what: "A capability-separation approach: a privileged planner, a quarantined reader, typed values, and explicit dataflow policy." },
  { title: "OWASP Top 10 for LLM Applications", who: "OWASP", ch: "c21", url: "https://genai.owasp.org/llm-top-10/", what: "A shared vocabulary for security review; map the system's threats and mitigations to it." },
  { title: "How we built our multi-agent research system", who: "Anthropic", ch: "c17", url: "https://www.anthropic.com/engineering/multi-agent-research-system", what: "A production-oriented account of orchestration, parallel subagents, and the cost trade-offs involved." },
  { title: "τ-bench", who: "Yao et al., 2024", ch: "c19", url: "https://arxiv.org/abs/2406.12045", what: "A benchmark for tool-agent interaction; use it for orientation, not as a substitute for a task-specific evaluation set." },
  { title: "SWE-bench", who: "Jimenez et al., 2024", ch: "c19", url: "https://arxiv.org/abs/2310.06770", what: "A benchmark for resolving real GitHub issues. Its setup is useful context for evaluating coding agents." },
  { title: "GAIA", who: "Mialon et al., 2023", ch: "c19", url: "https://arxiv.org/abs/2311.12983", what: "A benchmark for general-assistant reasoning with tools; it is another point of reference, not your product's eval set." },
  { title: "OpenTelemetry GenAI semantic conventions", who: "OpenTelemetry", ch: "c20", url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/", what: "Standard semantic-convention names for model and agent telemetry; verify compatibility with your tracing backend." },
  { title: "Designing Data-Intensive Applications, ch. 8–9", who: "Martin Kleppmann", ch: "c08", url: "https://dataintensive.net/", what: "The distributed-systems foundations for leases, fencing tokens, and delivery semantics." },
  { title: "Instructor; Outlines; XGrammar", who: "various", ch: "c02", url: "https://github.com/mlc-ai/xgrammar", what: "Three ways to implement constrained decoding at different layers—library, serving stack, and grammar engine." },
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
          <p style="margin:0 0 .15rem"><strong><a href="${r.url}" rel="noopener noreferrer">${r.title}</a></strong> <span class="muted small">— ${r.who}</span></p>
          <p class="muted" style="margin:0;font-size:.9375rem">${r.what}</p>
        </div></div>`).join("") +
      note("", "On reading production source", p(`The highest-value reading on this list is not a paper. It is <code>autogen-core</code>'s runtime and Codex's <code>apply_patch</code> — two compact, well-commented implementations of things this course builds. After the corresponding chapters they read as familiar code with better error handling, which is the point of having built them yourself.`)),
  };
}
