import type { Page } from "../../src/types.ts";
import { code, note, table, p, ul, ol } from "../../src/ui.ts";

export function setupPage(): Page {
  return {
    slug: "setup",
    kicker: "Getting started",
    title: "Local setup",
    subtitle: "Node 22, TypeScript with no build step, and a mock model so every chapter runs offline for free.",
    html:
      p(`Everything in this course runs with Node's own TypeScript support and the standard library. There is no bundler, no framework, and no required API key. Each chapter ships a deterministic mock model, and the live path is opt-in.`) +

      `<h3>Requirements</h3>` +
      table(["", "Version", "Why"], [
        ["Node.js", "22.6 or newer", "Native TypeScript type stripping — <code>.ts</code> files run directly"],
        ["An editor with TS", "any", "The types are the documentation"],
        ["ripgrep <span class='muted'>(optional)</span>", "any", "Only for C14 and C24's search tool"],
        ["Git", "any", "C24's undo is built on <code>git stash create</code>"],
      ]) +

      code({ title: "check your version", lang: "bash", plain: true,
        src: `node --version        # need v22.6.0 or newer
# On 22.6–22.17 you need the flag:
node --experimental-strip-types file.ts
# On 22.18+ and Node 24, TypeScript runs with no flag:
node file.ts` }) +

      note("", "Why no build step", p(`Type stripping erases annotations and runs the result: you get TypeScript's types while reading and editing, and a file you can run with one command. It only erases — it does not transform — so four constructs are unsupported: <code>enum</code>, <code>namespace</code>, decorators, and <strong>parameter properties</strong> (<code>constructor(private x: T)</code>). The last one catches everyone; write the field and the assignment out instead. Every file in <code>code/</code> avoids all four, and <code>npm run check:code</code> executes each one to prove it.`)) +

      `<h3>Get the code</h3>` +
      code({ title: "", lang: "bash", plain: true,
        src: `git clone <this-repo> agent-course && cd agent-course
npm install                      # devDependency: typescript, for editor types only
npm run build                    # regenerate this site into dist/
npm run serve                    # http://localhost:4321
npm run verify                   # run every code file, rebuild, check outputs are current

# run any chapter's file
npm run agent code/c04_agent_loop.ts
node --experimental-strip-types code/c04_agent_loop.ts     # equivalent` }) +

      `<h3>Running without an API key</h3>` +
      p(`Every runnable file defaults to a mock model: a deterministic scripted implementation of the same <code>Model</code> interface from C01. Same types, same code paths, no network, no spend, identical output every run.`) +
      code({ title: "the mock, and the switch",
        src: `import { mockModel, liveModel } from "./c01_model_call.ts";

const model = process.argv.includes("--live")
  ? liveModel({ provider: "anthropic", model: "claude-sonnet-5" })
  : mockModel(SCRIPT);      // deterministic, offline, free

// Because both satisfy the Model type, nothing downstream changes.` }) +

      `<h3>Running against a real model</h3>` +
      code({ title: "", lang: "bash", plain: true,
        src: `export ANTHROPIC_API_KEY=sk-ant-...        # or OPENAI_API_KEY
node --experimental-strip-types code/c04_agent_loop.ts --live

# A whole-course run of every chapter's live path costs roughly $2–4.
# Start with C04 and C23; they are where a real model changes what you see.` }) +
      note("warn", "Set a spend limit first", p(`Before running anything with <code>--live</code>, set a hard spend cap in your provider's dashboard. C12's simulator exists because runaway loops are real, and the first one you encounter should cost a few cents rather than a few hundred dollars.`)) +

      `<h3>Optional, per chapter</h3>` +
      table(["Chapter", "Wants", "Fallback if absent"], [
        ["C06 Retrieval", "An embedding endpoint", "A deterministic hash-based fake embedder — the ranking mechanics still work"],
        ["C13 Code execution", "Docker, for the container isolation level", "Worker threads; the payload suite still runs"],
        ["C14 / C24", "ripgrep", "A slower pure-JS scanner"],
        ["C15 MCP", "Any MCP server", "The course ships a local one to connect to"],
        ["C22 Serving", "—", "In-memory queue and event bus; the chaos test runs offline"],
      ]) +

      `<h3>Project layout</h3>` +
      code({ title: "", lang: "bash", plain: true,
        src: `code/                    runnable chapter files — one per chapter, start here
  c00_agency_dial.ts     the five positions on the dial, measured
  c01_model_call.ts      the Model type everything else imports
  …
  c23_research/          capstone I — deep research agent
  c24_coder/             capstone II — coding agent
content/chapters/        this site's chapter content (TypeScript, one file each)
src/                     the static-site generator
scripts/sync-outputs.ts  runs each code file and rewrites the chapter's output block
scripts/check-code.ts    asserts every file in code/ executes under strip-only mode
static/                  styles.css, app.js` }) +

      `<h3>How to work through it</h3>` +
      ol([
        `<strong>Read in order the first time.</strong> Each layer exists because the previous one created a problem; the sequence is the argument.`,
        `<strong>Run the file before reading the chapter's code section.</strong> Seeing the output first makes the explanation land.`,
        `<strong>Break the simulator deliberately.</strong> They are implementations, not animations. Push the sliders until something fails and work out why.`,
        `<strong>Do the exercises before opening the answers.</strong> The gap between following a mechanism and implementing it is where the learning is.`,
        `<strong>Carry one agent forward.</strong> Build the C04 agent on a domain you care about and modify it each chapter, rather than starting fresh each time.`,
      ]) +
      note("good", "Every output on this site is real", p(`The "run it" block in each chapter is generated by executing that chapter's file and pasting what it printed. <code>npm run sync -- --check</code> fails if any block has drifted from what the code actually produces, so the site cannot claim output the program does not print.`)) +
      p(`Roughly 25–40 hours for the chapters, plus 10–20 per capstone. Chapters C00–C04 are the irreducible core; if you only have an afternoon, read those.`),
  };
}
