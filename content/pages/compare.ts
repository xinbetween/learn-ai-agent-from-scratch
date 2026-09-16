import type { Page } from "../../src/types.ts";
import { table, note, p, ul, code } from "../../src/ui.ts";

export function comparePage(): Page {
  return {
    slug: "compare",
    kicker: "Context",
    title: "Frameworks, in the course's vocabulary",
    subtitle: "What each one gives you, which chapter it corresponds to, and what it still leaves you to build.",
    html:
      p(`<span class="lede">This course builds everything from scratch so that framework APIs stop being vocabulary. Once you have written the loop, the context manager and the runtime yourself, these tools are legible as choices rather than as magic, and the comparison below is about <em>which layer each one occupies</em>, not which is best.</span>`) +

      note("key", "The honest summary", p(`Most agent frameworks provide a loop and a tool abstraction; the exact API and defaults differ. They cannot choose your context budget, retry semantics, eval set, permission model, or the partial result a user receives when a budget expires. Those design decisions remain yours.`)) +

      `<h3>The landscape by layer</h3>` +
      table(["", "Layer it occupies", "Corresponds to", "Leaves you"], [
        ["<b>LangGraph</b>", "Graph orchestration — nodes, edges, conditional edges, checkpointers", "C08, C11, C16", "Context strategy, tool quality, evals"],
        ["<b>AutoGen</b> (core)", "Event-driven actor runtime — AgentId, TopicId, subscriptions", "C18", "Everything above the message layer"],
        ["<b>AutoGen</b> (agentchat)", "Opinionated teams — RoundRobinGroupChat, SelectorGroupChat, Swarm", "C17", "Termination design, briefs, cost control"],
        ["<b>OpenAI Agents SDK</b>", "Loop, handoffs, guardrails, sessions", "C04, C16, C17", "Context engineering, memory, durability"],
        ["<b>Claude Agent SDK</b>", "Loop with a filesystem and shell tool set, permission modes", "C04, C14, C16", "Domain tools, evals, multi-agent design"],
        ["<b>CrewAI</b>", "Role-based teams with tasks and processes", "C17", "Nearly all of C05–C12"],
        ["<b>smolagents</b>", "Minimal loop; code-writing agents by default", "C04, C13", "Sandboxing at production grade, context, evals"],
        ["<b>Pydantic AI</b>", "Typed outputs, dependency injection, validation", "C02", "The loop is thin; context and memory are yours"],
        ["<b>Temporal / Restate</b>", "Durable execution underneath anything", "C08", "All agent-specific concerns"],
        ["<b>MCP</b>", "A wire protocol for tools — not a framework", "C15", "Tool quality, context cost, trust"],
      ]) +

      `<h3>Where each one's loop lives</h3>` +
      p(`Useful when reading the source: each of these frameworks has a control loop analogous to ${'<a href="/c04/" class="mono">C04</a>'}, though its orchestration and stopping rules vary.`) +
      code({ title: "the same four lines, five times", lang: "text", plain: true,
        src: `this course        runAgent()              while (true) { model → decide → tools → append }
LangGraph          create_react_agent      agent node ⇄ tools node, conditional edge on tool_calls
AutoGen            AssistantAgent          on_messages(), bounded by max_tool_iterations
OpenAI Agents SDK  Runner.run              bounded by max_turns; handoffs swap the owning agent
Claude Agent SDK   query()                 loop with filesystem/shell tools and a permission layer
smolagents         CodeAgent.run           the "tool call" is a Python snippet` }) +

      `<h3>Choosing, in four questions</h3>` +
      table(["If you…", "Reach for"], [
        ["Want explicit, inspectable control flow with checkpointing", "LangGraph"],
        ["Need per-entity agent identity, events, or separate processes", "AutoGen core (C18)"],
        ["Want the shortest path from zero to a working tool-using agent", "The vendor SDK for the model you use"],
        ["Are building a coding agent", "Claude Agent SDK or Codex's architecture as a reference, and read <code>apply_patch</code> (C14)"],
        ["Need runs that survive deploys and hour-long approvals", "A durable execution engine, or C08's forty lines"],
        ["Want tools usable across several agents or teams", "MCP (C15)"],
        ["Have one agent, one process, and five tools", "<b>No framework.</b> C04 is 120 lines and you will understand all of it"],
      ]) +

      `<h3>What none of them do for you</h3>` +
      ul([
        `<strong>Decide your context budget</strong> (C05). Every framework will happily grow the message array until the API rejects it.`,
        `<strong>Write good tool descriptions</strong> (C03). The most valuable work in the whole system, and entirely yours.`,
        `<strong>Tell you what the user gets when the budget runs out</strong> (C12). All of them have a max-iterations setting; almost none has an opinion about the partial work.`,
        `<strong>Build your eval set</strong> (C19). The thing that converts changes into knowledge.`,
        `<strong>Design the permission model</strong> (C16). They give you hooks; the policy — and the attention budget it spends — is a product decision.`,
        `<strong>Remove a circle from the lethal trifecta</strong> (C21). Architectural, and it cannot be a library.`,
      ]) +

      note("", "A reasonable path", p(`Build C00–C04 from scratch — an afternoon, and it changes how every framework reads. Then adopt one for the plumbing you no longer want to own, and keep writing the parts this course says are yours. The point was never to avoid frameworks; it was to be able to tell what they are and are not doing.`)),
  };
}
