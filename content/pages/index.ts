import type { Chapter, Page } from "../../src/types.ts";
import { LAYERS, SITE } from "../../src/curriculum.ts";
import { esc } from "../../src/ui.ts";
import { glossaryPage } from "./glossary.ts";
import { setupPage } from "./setup.ts";
import { comparePage } from "./compare.ts";
import { timelinePage } from "./timeline.ts";
import { referencesPage } from "./references.ts";

/* ---------- derived pages: built from chapter data ---------- */

function mapPage(chs: Chapter[]): Page {
  const blocks = LAYERS.map((l) => {
    const items = chs.filter((c) => c.layer === l.id);
    if (!items.length) return "";
    return `<div class="layer">
  <div class="layer-head"><h3>${esc(l.name)}</h3><span class="range">${l.from}–${l.to}</span>
  <p class="ldesc">${esc(l.desc)}</p></div>
  <div class="chlist">${items
    .map(
      (c) => `<a class="chrow" href="/${c.id}/"><span class="cid">${c.id.toUpperCase()}<br><span class="faint" style="font-weight:400">${c.lines}L</span></span>
      <div><h4>${esc(c.title)}</h4><p class="csub">${esc(c.subtitle)}</p><p>${esc(c.blurb)}</p>
      <p style="margin-top:.4rem">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</p></div></a>`
    )
    .join("")}</div>
  ${l.bridge ? `<p class="bridge">${esc(l.bridge)}</p>` : ""}
</div>`;
  }).join("");

  return {
    slug: "map",
    wide: true,
    kicker: "The curriculum",
    title: "The map",
    subtitle: `All ${chs.length} chapters, the order they build in, and the constraint each layer answers.`,
    html:
      `<p class="lede">Each layer exists because the layer before it created a problem. The bridges in italics are the argument of the course: read them in order and the sequence stops being a list of techniques.</p>` +
      blocks,
  };
}

function answersPage(chs: Chapter[]): Page {
  const html = chs
    .map(
      (c) => `<section class="sec" id="${c.id}">
  <p class="kicker">${c.id.toUpperCase()} · ${esc(c.subtitle)}</p>
  <h2><a href="/${c.id}/" style="text-decoration:none">${esc(c.title)}</a></h2>
  ${c.exercises
    .map(
      (e, n) => `<div class="ex-item"><span class="n">${n + 1}</span><div>
      <p>${e.prompt} <span class="ex-diff">${e.difficulty}</span></p>
      <details class="ans"><summary>Answer</summary><div class="inner">${e.answer}</div></details></div></div>`
    )
    .join("")}
</section>`
    )
    .join("");
  const toc = `<div class="grid3">${chs
    .map((c) => `<a class="card" href="#${c.id}"><span class="cnum">${c.id.toUpperCase()}</span><h4>${esc(c.title)}</h4></a>`)
    .join("")}</div>`;
  return {
    slug: "answers",
    kicker: "Reference",
    title: "Exercise answers",
    subtitle: `Worked answers to all ${chs.reduce((n, c) => n + c.exercises.length, 0)} exercises, in chapter order.`,
    html:
      `<p class="lede">Answers are collapsed by default. Reading one before attempting the exercise costs you most of its value. The exercises exist to surface the gap between following a mechanism and implementing it.</p>${toc}${html}`,
  };
}

function qaPage(chs: Chapter[]): Page {
  const html = chs
    .map(
      (c) => `<section class="sec" id="${c.id}">
  <p class="kicker">${c.id.toUpperCase()}</p>
  <h2><a href="/${c.id}/" style="text-decoration:none">${esc(c.title)}</a></h2>
  ${c.qa.map((x) => `<details class="qa"><summary>${esc(x.q)}</summary><div class="inner">${x.a}</div></details>`).join("")}
</section>`
    )
    .join("");
  return {
    slug: "qa",
    kicker: "Reference",
    title: "Q&A",
    subtitle: `Every question the chapters answer, in one place — ${chs.reduce((n, c) => n + c.qa.length, 0)} of them.`,
    html: `<p class="lede">These are the questions that actually come up: the misconceptions, the "why not just…", and the decisions that look arbitrary until you have hit the failure they prevent. Use the search (⌘K) or your browser's find.</p>${html}`,
  };
}

function projectsPage(chs: Chapter[]): Page {
  const capstones = chs.filter((c) => c.layer === "capstone");
  const normal = chs.filter((c) => c.layer !== "capstone");
  return {
    slug: "projects",
    kicker: "Build",
    title: "Projects & capstones",
    subtitle: `One project per chapter, and two capstones that assemble the whole course into working agents.`,
    html:
      `<p class="lede">Chapter projects are small and sharp — an afternoon each, designed to be dropped into the agent you are carrying forward from C04. The two capstones are the real thing: complete agents with a spec, an eval set and a bar to clear.</p>
    <section class="sec"><p class="kicker">Capstones</p><h2>The two you should finish</h2>
    <div class="grid2">${capstones
      .map(
        (c) => `<a class="card" href="/${c.id}/"><span class="cnum">${c.id.toUpperCase()}</span><h4>${esc(c.project.title)}</h4><p>${esc(c.blurb)}</p></a>`
      )
      .join("")}</div></section>
    <section class="sec"><p class="kicker">Chapter projects</p><h2>One per chapter</h2>
    ${normal
      .map(
        (c) => `<div class="ex-item"><span class="n" style="width:auto;padding:0 .35rem">${c.id.toUpperCase()}</span><div>
        <p><a href="/${c.id}/#project"><strong>${esc(c.project.title)}</strong></a></p>
        ${c.project.brief}
        <details class="ans"><summary>Acceptance criteria</summary><div class="inner"><ul>${c.project.spec
          .map((s) => `<li>${s}</li>`)
          .join("")}</ul>${
          c.project.stretch?.length
            ? `<p><strong>Stretch:</strong></p><ul>${c.project.stretch.map((s) => `<li>${s}</li>`).join("")}</ul>`
            : ""
        }</div></details></div></div>`
      )
      .join("")}
    </section>`,
  };
}

export function pages(chs: Chapter[]): Page[] {
  return [
    mapPage(chs),
    projectsPage(chs),
    qaPage(chs),
    answersPage(chs),
    glossaryPage(),
    setupPage(),
    comparePage(),
    timelinePage(),
    referencesPage(),
  ];
}

export { SITE };
