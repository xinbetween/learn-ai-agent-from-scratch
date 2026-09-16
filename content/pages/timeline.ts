import type { Page } from "../../src/types.ts";
import { p, note } from "../../src/ui.ts";

interface Item { when: string; what: string; why: string; ch?: string }

const ITEMS: Item[] = [
  { when: "1986", what: "Brooks: the subsumption architecture", why: "Intelligent behaviour from layered reactive loops rather than from a world model. The argument that the loop is the architecture predates the models by forty years." },
  { when: "1973 →", what: "The actor model (Hewitt); Erlang/OTP", why: "Addressed entities with mailboxes, created on demand, supervised. The design agent runtimes rediscover.", ch: "c18" },
  { when: "2020", what: "Retrieval-augmented generation", why: "Retrieve, then generate. The framing agents later broke by making retrieval a tool called in a loop.", ch: "c06" },
  { when: "2022-01", what: "Chain-of-thought prompting", why: "Reasoning steps in the output improve the output. The ancestor of every 'think before acting' instruction." },
  { when: "2022-10", what: "ReAct (Yao et al.)", why: "Interleave reasoning and acting. This is the agent loop, and the paper's Thought/Action/Observation format is still visible in every trace.", ch: "c04" },
  { when: "2023-06", what: "Native function calling", why: "Tool use stops being a parsing problem. Constrained decoding for schemas follows from the same machinery.", ch: "c03" },
  { when: "2023-03", what: "AutoGPT, BabyAGI", why: "Fully autonomous loops. Mostly did not work, and were enormously clarifying about why: no termination, no verification, no context management.", ch: "c12" },
  { when: "2023-03", what: "Reflexion, self-refine", why: "Critique and revise. Later measurement showed the gains concentrate where an external signal exists — C10's ladder.", ch: "c10" },
  { when: "2023-07", what: "Lost in the Middle (Liu et al.)", why: "Attention over long contexts is not uniform. Made position a design variable rather than an afterthought.", ch: "c05" },
  { when: "2023-08", what: "AutoGen", why: "Multi-agent conversation as a first-class abstraction; later rebuilt on an event-driven actor core.", ch: "c18" },
  { when: "2024-01", what: "LangGraph", why: "Agents as explicit state graphs with checkpointing. Made durability and human-in-the-loop interrupts ordinary.", ch: "c08" },
  { when: "2024-08", what: "Prompt caching becomes general", why: "Repeated prefixes billed at a fraction. Turned the resend-everything cost model from prohibitive to manageable.", ch: "c01" },
  { when: "2024-11", what: "Model Context Protocol", why: "A standard wire format for tools. N×M integrations become N+M — and tool descriptions become a supply-chain concern.", ch: "c15" },
  { when: "2024-12", what: "Anthropic: Building Effective Agents", why: "The composition patterns, and the argument for the simplest thing that works. The most-cited practical write-up in the field.", ch: "c11" },
  { when: "2025", what: "Coding agents become the dominant category", why: "Claude Code, Codex, Cursor's agent mode. Ground truth in the loop is why this domain worked first.", ch: "c24" },
  { when: "2025", what: "apply_patch and structured edit formats", why: "The realisation that the file-edit interface, not the model, caps a coding agent's reliability.", ch: "c14" },
  { when: "2025", what: "The lethal trifecta framing", why: "Prompt injection reframed from 'make the model resist' to 'which capability do you remove'. Converted an unsolvable problem into an architectural one.", ch: "c21" },
  { when: "2025", what: "CaMeL and dual-LLM patterns", why: "A privileged planner that never sees untrusted data, and a quarantined model that returns only typed values.", ch: "c21" },
  { when: "2025", what: "Deep research agents ship widely", why: "Orchestrator plus parallel subagents plus citation grounding, as a product rather than a demo.", ch: "c23" },
  { when: "2025–26", what: "Agent evaluation becomes a discipline", why: "τ-bench, SWE-bench variants, trajectory scoring, LLM-judge calibration. The field stops reporting vibes.", ch: "c19" },
];

export function timelinePage(): Page {
  return {
    slug: "timeline",
    kicker: "Context",
    title: "How we got here",
    subtitle: "The ideas this course teaches, in the order they arrived — and what each one was a response to.",
    html:
      p(`<span class="lede">Most of these are not model improvements. They are engineering responses to constraints that appeared once people tried to make models do multi-step work in the real world, which is the argument of the whole course, laid out chronologically.</span>`) +
      `<div style="border-left:2px solid var(--border);margin-left:.5rem;padding-left:1.25rem">` +
      ITEMS.map((i) => `<div style="margin:1.5rem 0;position:relative">
        <span style="position:absolute;left:-1.6rem;top:.35rem;width:.5rem;height:.5rem;border-radius:50%;background:var(--accent)"></span>
        <p class="mono small" style="color:var(--accent);margin:0">${i.when}</p>
        <p style="margin:.15rem 0 .25rem;font-weight:600">${i.what}${i.ch ? ` <a href="/${i.ch}/" class="pill a">${i.ch.toUpperCase()}</a>` : ""}</p>
        <p class="muted" style="margin:0;font-size:.9375rem">${i.why}</p>
      </div>`).join("") +
      `</div>` +
      note("", "What has not changed", p(`The loop. ReAct's four lines from 2022 are the four lines in C04. Every subsequent entry on this list is a technique for managing a consequence of that loop meeting a real environment — cost, context, failure, trust — rather than a replacement for it. That stability is why it is worth learning the loop properly.`)),
  };
}
