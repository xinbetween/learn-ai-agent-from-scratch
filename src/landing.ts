import type { Chapter } from "./types.ts";
import { LAYERS, SITE } from "./curriculum.ts";
import { esc } from "./ui.ts";
import { shell } from "./render.ts";
import { type Locale, DEFAULT_LOCALE, localePath, LANDING, layerFor } from "./i18n.ts";

/** The hero diagram: one turn of the agent loop. Pure SVG, theme-aware. */
const HERO_DIAGRAM = `
<div class="fig">
  <div class="fig-head"><span class="ft">Chapter 4 · the whole agent</span><span>one iteration = one decision</span></div>
  <div class="fig-body">
  <svg viewBox="0 0 700 300" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img" aria-label="The agent loop: goal, context, model, decide, tool, observation, back to context">
    <defs>
      <marker id="hx" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
      <marker id="hxa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
    </defs>

    <text x="20" y="26" class="d-label">ONE ITERATION = ONE DECISION</text>

    <rect x="20" y="48" width="96" height="46" rx="6" class="d-box"/>
    <text x="68" y="68" class="d-text" text-anchor="middle">goal</text>
    <text x="68" y="84" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">"book it"</text>

    <path d="M120 71 L152 71" class="d-arrow" marker-end="url(#hx)"/>

    <rect x="156" y="40" width="108" height="62" rx="6" class="d-box-m"/>
    <text x="210" y="62" class="d-text" text-anchor="middle">context</text>
    <text x="210" y="78" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">messages[]</text>
    <text x="210" y="92" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">+ tool defs</text>

    <path d="M268 71 L300 71" class="d-arrow" marker-end="url(#hx)"/>

    <rect x="304" y="40" width="104" height="62" rx="6" class="d-box-a"/>
    <text x="356" y="64" class="d-text" text-anchor="middle">model call</text>
    <text x="356" y="82" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">1 round trip</text>

    <path d="M412 71 L444 71" class="d-arrow-a" marker-end="url(#hxa)"/>

    <rect x="448" y="40" width="96" height="62" rx="6" class="d-box"/>
    <text x="496" y="64" class="d-text" text-anchor="middle">decision</text>
    <text x="496" y="82" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">stop | call</text>

    <!-- branch up: finish -->
    <path d="M548 58 L596 58 L596 44" class="d-arrow" marker-end="url(#hx)"/>
    <rect x="552" y="6" width="130" height="34" rx="6" class="d-box"/>
    <text x="617" y="27" class="d-text" text-anchor="middle">answer to user</text>

    <!-- branch down: tool -->
    <path d="M548 86 L596 86 L596 120" class="d-arrow-a" marker-end="url(#hxa)"/>
    <rect x="520" y="124" width="160" height="54" rx="6" class="d-box-t"/>
    <text x="600" y="145" class="d-text" text-anchor="middle">tool call</text>
    <text x="600" y="163" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">search · read · run · edit</text>

    <path d="M520 151 L360 151" class="d-arrow-a" marker-end="url(#hxa)"/>
    <rect x="232" y="124" width="126" height="54" rx="6" class="d-box-t"/>
    <text x="295" y="145" class="d-text" text-anchor="middle">observation</text>
    <text x="295" y="163" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">the real world</text>

    <path d="M232 151 L200 151 L200 108" class="d-arrow-a" marker-end="url(#hxa)"/>
    <text x="196" y="132" class="d-mono" text-anchor="end" fill="var(--accent)">append</text>

    <line x1="20" y1="204" x2="680" y2="204" stroke="var(--border)"/>
    <text x="20" y="228" class="d-label">WHAT GROWS EACH ITERATION</text>

    <rect x="20" y="240" width="118" height="24" rx="4" class="d-box-m"/>
    <text x="79" y="256" class="d-mono" text-anchor="middle">system</text>
    <rect x="142" y="240" width="88" height="24" rx="4" class="d-box"/>
    <text x="186" y="256" class="d-mono" text-anchor="middle">goal</text>
    <rect x="234" y="240" width="104" height="24" rx="4" class="d-box-a"/>
    <text x="286" y="256" class="d-mono" text-anchor="middle">tool_use</text>
    <rect x="342" y="240" width="118" height="24" rx="4" class="d-box-t"/>
    <text x="401" y="256" class="d-mono" text-anchor="middle">tool_result</text>
    <rect x="464" y="240" width="104" height="24" rx="4" class="d-box-a"/>
    <text x="516" y="256" class="d-mono" text-anchor="middle">tool_use</text>
    <rect x="572" y="240" width="108" height="24" rx="4" class="d-box-t" opacity=".45"/>
    <text x="626" y="256" class="d-mono" text-anchor="middle" opacity=".6">…</text>

    <text x="20" y="286" class="d-mono" fill="var(--fg-faint)">every iteration re-sends the whole thing — C05 is about what you are allowed to drop</text>
  </svg>
  </div>
</div>`;

export function renderLanding(
  chapters: Chapter[],
  searchIndex: string,
  loc: Locale = DEFAULT_LOCALE
): string {
  const C = LANDING[loc];
  const L = (p: string) => localePath(loc, p);

  const layerBlocks = LAYERS.map((raw) => {
    const l = layerFor(loc, raw);
    const items = chapters.filter((c) => c.layer === l.id);
    return `<div class="layer">
  <div class="layer-head">
    <h3>${esc(l.name)}</h3>
    <span class="range">${l.from}–${l.to}</span>
    <p class="ldesc">${esc(l.desc)}</p>
  </div>
  <div class="chlist">${items
    .map(
      (c) => `<a class="chrow" href="${L(`/${c.id}/`)}">
      <span class="cid">${c.id.toUpperCase()}<br><span class="faint" style="font-weight:400">${c.lines}L</span></span>
      <div><h4>${esc(c.title)}</h4><p class="csub">${esc(c.subtitle)}</p><p>${esc(c.blurb)}</p></div>
    </a>`
    )
    .join("")}</div>
  ${l.bridge ? `<p class="bridge">${esc(l.bridge)}</p>` : ""}
</div>`;
  }).join("");

  const card = (x: { h: string; p: string }, n?: number) =>
    `<div class="card">${n !== undefined ? `<span class="cnum">0${n}</span>` : ""}<h4>${x.h}</h4><p>${x.p}</p></div>`;

  const content = `<div class="landing">
<section class="lhero">
  <p class="eyebrow">${esc(
    C.eyebrow
      .replace("{chapters}", String(SITE.chapters))
      .replace("{lines}", SITE.lines.toLocaleString("en-US"))
      .replace("{lang}", SITE.lang)
  )}</p>
  <h1>${C.h1}</h1>
  <p class="blurb">${esc(C.blurb1)}</p>
  <p class="blurb">${esc(C.blurb2)}</p>
  <div class="cta-row">
    <a class="btn primary" href="${L("/c00/")}" style="padding:.5rem 1rem">${C.ctaStart}</a>
    <a class="btn" href="${L("/map/")}" style="padding:.5rem 1rem">${C.ctaMap}</a>
    <a class="btn" href="${L("/projects/")}" style="padding:.5rem 1rem">${C.ctaProjects}</a>
  </div>
  <div class="termline"><span class="p">$</span> git clone … &amp;&amp; node --experimental-strip-types code/c04_agent_loop.ts</div>
</section>

<section class="lsec" style="border-top:0">
  ${HERO_DIAGRAM}
</section>

<section class="lsec">
  <div class="grid3">
    ${C.cards.map((x, n) => card(x, n + 1)).join("")}
  </div>
</section>

<section class="lsec">
  <p class="kicker">${esc(C.whoKicker)}</p>
  <h2>${esc(C.whoTitle)}</h2>
  <p class="lead">${esc(C.whoLead)}</p>
  <div class="grid2">
    ${C.who
      .map((x) => `<a class="card" href="${L(x.href)}"><h4>${x.h}</h4><p>${x.p}</p></a>`)
      .join("")}
  </div>
</section>

<section class="lsec">
  <p class="kicker">${esc(C.currKicker)}</p>
  <h2>${esc(C.currTitle)}</h2>
  <p class="lead">${esc(C.currLead)}</p>
  ${layerBlocks}
</section>

<section class="lsec">
  <p class="kicker">${esc(C.everyKicker)}</p>
  <h2>${esc(C.everyTitle)}</h2>
  <div class="grid2">
    ${C.every.map((x) => card(x)).join("")}
  </div>
</section>

<section class="lsec">
  <h2>${esc(C.beginTitle)}</h2>
  <p class="lead">${esc(C.beginLead)}</p>
  <p><a class="btn primary" href="${L("/c00/")}" style="padding:.5rem 1rem">${C.beginCta}</a></p>
</section>
</div>`;

  return shell({
    title: SITE.title,
    desc: SITE.tagline,
    path: L("/"),
    content,
    searchIndex,
    locale: loc,
    keywords: [
      "AI agent", "ReAct", "tool calling", "function calling", "context engineering",
      "agent memory", "RAG", "MCP", "multi-agent", "AutoGen", "LangGraph", "agent evals",
      "prompt injection", "TypeScript agent",
    ],
  });
}
