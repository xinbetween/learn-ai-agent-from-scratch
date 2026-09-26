import type { Layer } from "./types.ts";

export const SITE = {
  title: "Build an AI Agent From Scratch",
  short: "AI Agents",
  tagline:
    "Build an AI agent from scratch in TypeScript: the ReAct loop, tools, code actions, context engineering, memory, planning, MCP, multi-agent systems, evals and security. 27 chapters, no framework.",
  chapters: 27,
  lines: 6191,
  lang: "TypeScript",
  /** Social links in the top nav. Empty string renders an inert placeholder. */
  links: { github: "https://github.com/xinbetween/learn-ai-agent-from-scratch", x: "https://x.com/xinbetween" },
};

export const LAYERS: Layer[] = [
  {
    id: "machine",
    name: "The Shape of the Thing",
    from: "C00",
    to: "C00",
    desc:
      "One prologue chapter: what separates an agent from a chatbot and from a workflow, and the one dial that decides which you are building.",
    bridge: "…which tells you what an agent is. Now build the smallest one that works. So:",
  },
  {
    id: "model",
    name: "The Model",
    from: "C01",
    to: "C04",
    desc:
      "A model call, a typed output, a tool, and the loop that joins them. At the end of this layer you have a working agent in about 120 lines.",
    bridge: "…which leaves you with an agent that works and forgets everything. So:",
  },
  {
    id: "context",
    name: "Context & Memory",
    from: "C05",
    to: "C08",
    desc:
      "The context window is the agent's entire world and it is small. Budget it, retrieve into it, remember across it, and survive a crash in the middle of it.",
    bridge: "…which gives the agent a past. It still has no plan. So:",
  },
  {
    id: "reasoning",
    name: "Reasoning & Control",
    from: "C09",
    to: "C12",
    desc:
      "Decompose the task, check the work, decide how much freedom the model actually gets, and handle the four ways every agent fails.",
    bridge: "…which makes the agent reliable inside its own head. Now let it touch the world. So:",
  },
  {
    id: "environment",
    name: "The Environment",
    from: "C13",
    to: "C16",
    desc:
      "Code execution, what an action can even be, files and the shell, the Model Context Protocol, and the human who has to approve the dangerous parts.",
    bridge: "…which is one capable agent. Production needs more than one, and needs proof. So:",
  },
  {
    id: "systems",
    name: "Systems & Production",
    from: "C17",
    to: "C22",
    desc:
      "Many agents, the event-driven runtime underneath them, measurement, observability, the security model agents break by design, and the server that ships it.",
    bridge: "…which is everything the course has to teach. Now assemble it twice. So:",
  },
  {
    id: "capstone",
    name: "The Capstones",
    from: "C23",
    to: "C24",
    desc:
      "Two complete agents, built end to end from the parts in this course: a deep-research agent and a coding agent that edits your files.",
    bridge: "",
  },
];

export const layerById = (id: string): Layer =>
  LAYERS.find((l) => l.id === id) ?? LAYERS[0];

/** Accent class per layer, used for chips and diagrams. */
export const layerTone: Record<string, string> = {
  machine: "a",
  model: "a",
  context: "m",
  reasoning: "p",
  environment: "t",
  systems: "a",
  capstone: "a",
};
