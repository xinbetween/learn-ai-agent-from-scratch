import type { Page } from "../../src/types.ts";

interface Term { t: string; d: string; ch?: string; also?: string[] }

const TERMS: Term[] = [
  { t: "Agent", d: "A program in which a model decides what happens next, in a loop, with tools that change the world. The distinguishing property is that control flow is produced at runtime rather than written in advance.", ch: "c00" },
  { t: "Agency dial", d: "The spectrum from a fixed pipeline (position 0) through router and chain to a tool-using agent (3) and open-ended code-writing agent (4). Turning it right buys coverage of unanticipated inputs and costs predictability.", ch: "c00" },
  { t: "Agent loop", d: "Call the model, read its decision, run any tools it requested, append the results, repeat. Four lines; everything hard about agents follows from it meeting a real environment.", ch: "c04" },
  { t: "AgentId", d: "An agent's address in a message-passing runtime: a type (the registered behaviour) and a key (the instance, with its own state and mailbox). Addressing one creates it on demand.", ch: "c18" },
  { t: "apply_patch", d: "A line-oriented file-edit format using *** Begin Patch sentinels and @@ context locators rather than line numbers, so a model never has to count lines or escape a code fragment into a JSON string.", ch: "c14" },
  { t: "Approval policy", d: "When a human is asked, as an axis independent of what the sandbox permits. Values range from never through on-failure and on-request to every action — the last of which produces rubber-stamping.", ch: "c16" },
  { t: "Blast radius", d: "What the worst single tool call could do, written as a sentence with a verb and an object. Used with reversibility to decide whether an action needs approval.", ch: "c16" },
  { t: "BM25", d: "A lexical ranking function whose IDF term weights rare words heavily — which is why it finds exact identifiers that embeddings miss.", ch: "c06" },
  { t: "Caused tokens", d: "A tool result's true cost: its size multiplied by the number of model calls that follow it, since the message array is resent whole each turn. Ranking tools this way finds budget leaks that per-call cost cannot.", ch: "c20" },
  { t: "Circuit breaker", d: "After N consecutive failures, fail fast for a cooldown period. In an agent its value is legibility: 'unavailable for 24 more seconds' is an observation the model can route around.", ch: "c12" },
  { t: "Compaction", d: "Summarising the middle of the message array while keeping the system prompt, the goal and the most recent turns verbatim. Lossy, so offload first.", ch: "c05" },
  { t: "Confused deputy", d: "An agent holding your authority while following instructions from anyone whose text reaches its context. The fix is to shrink the authority, not to improve the instructions.", ch: "c21" },
  { t: "Constrained decoding", d: "Masking tokens that would violate a grammar derived from your schema, making malformed output unrepresentable. Guarantees shape; says nothing about whether the values are correct.", ch: "c02" },
  { t: "Context engineering", d: "Deciding what is in the request at all, in what order, at what cost, refreshed how often — as distinct from prompt engineering, which is choosing the words.", ch: "c05" },
  { t: "Context window", d: "The model's entire world for one call. Finite, unevenly attended, and resent in full every turn.", ch: "c05" },
  { t: "CodeAct", d: "Replacing a tool-call decision with a program. Wins on composition, arithmetic precision, and context economy — large intermediate data never enters the message array.", ch: "c13" },
  { t: "Degradation ladder", d: "An ordered sequence of responses as a budget is consumed — compact, drop tools, cheaper model, narrow the goal, final report — each announced to the model so it can prioritise.", ch: "c12" },
  { t: "Durable execution", d: "Recording every side effect so a resumed run replays recorded results rather than re-executing them. Makes a run survive crashes, deploys and long human approvals.", ch: "c08" },
  { t: "Egress", d: "Any channel by which data can leave — an HTTP tool, an email, a git push, or a markdown image the user's browser fetches. Harder to enumerate than tools, and where real incidents happen.", ch: "c21" },
  { t: "Elicitation", d: "An MCP client capability letting a server ask the user for information mid-operation.", ch: "c15" },
  { t: "Episodic memory", d: "What happened in past runs, with outcomes. Written when a run ends, retrieved by similarity to the current task.", ch: "c07" },
  { t: "Event sourcing", d: "Storing a run as an append-only log of events, with state as a fold over them. Gives replay, forking and audit from one structure.", ch: "c08" },
  { t: "Fencing token", d: "A monotonically increasing number issued with a lease; the store rejects writes carrying a stale one. Prevents a paused worker from writing after its lease expired.", ch: "c08" },
  { t: "Grounding", d: "Checking mechanically that a claim's supporting text actually appears in a retrieved source span — including that its numbers match.", ch: "c23" },
  { t: "Handoff", d: "Transferring control from one agent to another, with the conversation continuing under the new agent. Fails when the handoff carries no context and the user must repeat themselves.", ch: "c17" },
  { t: "Hybrid search", d: "Running vector and lexical retrieval together and fusing the rankings, usually with Reciprocal Rank Fusion. The default, because each fails where the other succeeds.", ch: "c06" },
  { t: "Idempotency key", d: "A client-supplied identifier that lets a downstream system deduplicate a repeated write. Removes the entire class of 'did the timed-out call take effect' problems.", ch: "c08" },
  { t: "Lethal trifecta", d: "Untrusted content, private data access, and a way to communicate externally. Any two are manageable; all three is an exfiltration channel.", ch: "c21" },
  { t: "LLM-as-judge", d: "Using a model to grade output against a rubric. Subject to position, verbosity and self-preference bias; must be calibrated against human grades before it gates anything.", ch: "c19" },
  { t: "Lost in the middle", d: "The measured tendency for material in the middle of a long context to influence the output less than material at either end.", ch: "c05" },
  { t: "MCP", d: "The Model Context Protocol: JSON-RPC over stdio or streamable HTTP, letting any agent use any server's tools, resources and prompts. Solves plumbing, not tool quality, context cost or trust.", ch: "c15" },
  { t: "Orchestrator–worker", d: "A lead agent decomposing a task and dispatching subagents with isolated contexts, then synthesising. The multi-agent topology that usually works.", ch: "c17" },
  { t: "Partial report", d: "What an agent returns when it must stop early: what it established with evidence, what was in progress, what remains unknown, and the exact next step. An agent should never fail empty.", ch: "c12" },
  { t: "Procedural memory", d: "Learned constraints about how to do things here — 'deploys need the VPN first'. Often best implemented as a version-controlled file the agent reads and appends to.", ch: "c07" },
  { t: "Prompt caching", d: "Billing a repeated request prefix at a steep discount. Requires the prefix to be byte-identical, so interpolating anything per-turn destroys it.", ch: "c01" },
  { t: "Prompt injection", d: "Instructions embedded in content the model processes, which it cannot distinguish from your instructions. Has no general solution; design so a successful injection does not matter.", ch: "c21" },
  { t: "Quarantined reader", d: "A model that sees untrusted content, has no tools, and returns only typed values — so an injection has no channel to become an instruction.", ch: "c21" },
  { t: "ReAct", d: "Interleaving reasoning and acting, so each thought is grounded by the last observation and each action chosen by the last thought.", ch: "c04" },
  { t: "Reranking", d: "Scoring query and candidate together with a cross-encoder after cheap retrieval has produced a shortlist. Cheap recall first, expensive precision second.", ch: "c06" },
  { t: "Repeat detector", d: "Code watching the trace for identical or oscillating tool calls, injecting an observation describing the loop. Models break their own loops once told; they cannot see them unaided.", ch: "c04" },
  { t: "Reversibility", d: "How cheap and certain the undo is. Outranks apparent severity when deciding what needs approval: deleting 400 files under git is recoverable, sending one email is not.", ch: "c16" },
  { t: "RRF", d: "Reciprocal Rank Fusion: sum 1/(k+rank) across retrievers. Uses ranks rather than scores, so incomparable scoring scales never have to be normalised.", ch: "c06" },
  { t: "Sandbox mode", d: "What a process can reach — read-only, workspace-write, or full access — as an axis independent of the approval policy.", ch: "c13" },
  { t: "Semantic memory", d: "Durable facts about a user, domain or system. Few enough to inject in full rather than retrieve.", ch: "c07" },
  { t: "Self-consistency gate", d: "Sample twice in parallel and run expensive verification only when the samples disagree, concentrating spend on genuinely ambiguous cases.", ch: "c10" },
  { t: "Span", d: "One timed, attributed operation in a trace, nested under a parent. Model calls, tool calls, retrievals and subagent runs are all spans.", ch: "c20" },
  { t: "Stop reason", d: "Why the model stopped: end_turn, tool_use, max_tokens, stop_sequence, refusal. Control flow, not telemetry — and max_tokens must never be treated as an answer.", ch: "c01" },
  { t: "Structured output", d: "Getting a typed value rather than prose. Constrain the decoder first, validate always, and repair in a fixed cheapest-first order.", ch: "c02" },
  { t: "Subagent", d: "An agent invoked as a tool, with a fresh context that is discarded on return. The justification is context isolation, not specialisation.", ch: "c17" },
  { t: "Tail sampling", d: "Deciding which traces to keep after a run finishes, when its terminal state and step count are known — so anomalies are never dropped.", ch: "c20" },
  { t: "Terminal state", d: "How a run ended: answered, budget, stuck, blocked, error, cancelled. The distribution over these is more actionable than an error rate.", ch: "c12" },
  { t: "TopicId", d: "A broadcast address: a topic type and a source. A TypeSubscription maps topic type to agent type and carries the source across as the agent key.", ch: "c18" },
  { t: "Tool", d: "A name, a description, an input schema and a function. The description is read by the model on every call and matters more than the implementation.", ch: "c03" },
  { t: "Tool poisoning", d: "Hiding instructions in a tool's description, which the user never reads and the model always does. The reason MCP tool metadata from untrusted servers must be pinned and reviewed.", ch: "c15" },
  { t: "Trajectory eval", d: "Scoring how a run proceeded — steps, wasted calls, required and forbidden tools, error recovery — rather than only its outcome. Moves before outcome does.", ch: "c19" },
  { t: "Usage", d: "Input, output and cache token counts returned on every model call. Accumulated at the client, not the loop, so retries and subagent spend are counted.", ch: "c01" },
];

export function glossaryPage(): Page {
  const letters = [...new Set(TERMS.map((t) => t.t[0].toUpperCase()))].sort();
  const sorted = [...TERMS].sort((a, b) => a.t.localeCompare(b.t));
  return {
    slug: "glossary",
    kicker: "Reference",
    title: "Glossary",
    subtitle: `${TERMS.length} terms, each defined as this course uses it and linked to where it is built.`,
    html:
      `<p class="lede">Definitions are operational rather than encyclopaedic: what the term means when you are writing the code.</p>
      <p class="small muted">${letters.map((l) => `<a href="#L${l}" class="pill">${l}</a>`).join(" ")}</p>` +
      sorted
        .map((t, i) => {
          const letter = t.t[0].toUpperCase();
          const first = sorted.findIndex((x) => x.t[0].toUpperCase() === letter) === i;
          return `${first ? `<h3 id="L${letter}" style="margin-top:2rem;color:var(--accent)">${letter}</h3>` : ""}
        <div class="ex-item" style="grid-template-columns:1fr">
          <div><p><strong>${t.t}</strong>${t.ch ? ` <a href="/${t.ch}/" class="pill a">${t.ch.toUpperCase()}</a>` : ""}</p>
          <p class="muted" style="font-size:.9375rem">${t.d}</p></div>
        </div>`;
        })
        .join(""),
  };
}
