import type { Chapter, Layer, Page } from "./types.ts";
import { LAYERS, SITE } from "./curriculum.ts";
import { esc } from "./ui.ts";
import { type Locale, LOCALES, LOCALE_META, DEFAULT_LOCALE, localePath, stripLocale, t, layerFor } from "./i18n.ts";

const NAV = [
  { href: "/map/", key: "nav.map" },
  { href: "/projects/", key: "nav.projects" },
  { href: "/qa/", key: "nav.qa" },
  { href: "/answers/", key: "nav.answers" },
  { href: "/glossary/", key: "nav.glossary" },
  { href: "/compare/", key: "nav.compare" },
];

/** Inline icons for the top nav. Stroke icons inherit `currentColor`. */
const ICON = {
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16.2 16.2 3.6 3.6"/></svg>`,
  theme: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.93c.58.1.79-.25.79-.56v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.96 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64z"/></svg>`,
};

/** A social link, or an inert placeholder when no URL is configured yet. */
function social(href: string, label: string, icon: string, unset: string): string {
  return href
    ? `<a class="icon-btn box" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}" title="${esc(label)}">${icon}</a>`
    : `<a class="icon-btn box" href="#" data-placeholder aria-label="${esc(label)}" title="${esc(label)} — ${esc(unset)}">${icon}</a>`;
}

function topNav(path: string, loc: Locale): string {
  const L = (p: string) => localePath(loc, p);
  const canonical = stripLocale(path);
  const langs = LOCALES.map((l) => {
    const on = l === loc;
    return `<a class="seg-b" href="${localePath(l, canonical)}" hreflang="${LOCALE_META[l].lang}"${
      on ? ' aria-current="true"' : ""
    } title="${esc(LOCALE_META[l].name)}">${LOCALE_META[l].label}</a>`;
  }).join("");

  return `<header class="nav">
  <button class="icon-btn nav-toggle" id="nav-toggle" aria-label="${esc(t(loc, "nav.openChapters"))}">${ICON.menu}</button>
  <a class="nav-brand" href="${L("/")}"><span class="nav-mark">A</span><span class="nav-name">${esc(SITE.short)}</span></a>
  <nav class="nav-links">${NAV.map(
    (n) => `<a href="${L(n.href)}"${canonical.startsWith(n.href) ? ' aria-current="page"' : ""}>${esc(t(loc, n.key))}</a>`
  ).join("")}</nav>
  <span class="nav-spacer"></span>
  <div class="nav-actions">
    <a class="nav-cta" href="${L("/c00/")}">${esc(t(loc, "nav.start"))} <span aria-hidden="true">→</span></a>
    <button class="nav-search" id="search-btn" type="button" aria-label="${esc(t(loc, "nav.searchAria"))}">
      ${ICON.search}<span class="nav-search-label">${esc(t(loc, "nav.search"))}</span><kbd>⌘K</kbd>
    </button>
    <div class="seg" role="group" aria-label="${esc(t(loc, "nav.language"))}">${langs}</div>
    <button class="icon-btn box" id="theme-btn" aria-label="${esc(t(loc, "nav.themeAria"))}" title="${esc(t(loc, "nav.theme"))}">${ICON.theme}</button>
    ${social(SITE.links.github, t(loc, "nav.github"), ICON.github, t(loc, "nav.linkUnset"))}
    ${social(SITE.links.x, t(loc, "nav.x"), ICON.x, t(loc, "nav.linkUnset"))}
  </div>
</header>
<div class="scrim"></div>
<div class="search-ov" id="search-ov">
  <div class="search-box">
    <input type="text" placeholder="${esc(t(loc, "nav.searchPlaceholder"))}" aria-label="${esc(t(loc, "nav.search"))}">
    <div class="search-res"></div>
  </div>
</div>`;
}

function sidebar(chapters: Chapter[], loc: Locale, activeId?: string): string {
  const groups = LAYERS.map((raw) => {
    const l = layerFor(loc, raw);
    const items = chapters.filter((c) => c.layer === l.id);
    if (!items.length) return "";
    return `<div class="side-group"><h4>${esc(l.name)}</h4>${items
      .map(
        (c) =>
          `<a class="side-link" data-ch="${c.id}" href="${localePath(loc, `/${c.id}/`)}"${
            c.id === activeId ? ' aria-current="page"' : ""
          }><span class="sid">${c.id.toUpperCase()}</span><span>${esc(c.title)}</span></a>`
      )
      .join("")}</div>`;
  }).join("");
  return `<aside class="sidebar" data-open="false"><nav>${groups}</nav></aside>`;
}

function railFor(c: Chapter, chapters: Chapter[], loc: Locale): string {
  const items = [
    ...c.sections.map((s) => ({ id: s.id, t: s.title })),
    { id: "exercises", t: t(loc, "sec.exercises") },
    { id: "qa", t: t(loc, "sec.qaTitle") },
    { id: "project", t: t(loc, "sec.project") },
    { id: "review", t: t(loc, "sec.reviewTitle") },
  ];
  return `<aside class="rail">
  <h4>${esc(t(loc, "rail.onThisPage"))}</h4>
  <ol>${items.map((i) => `<li><a href="#${i.id}" data-spy>${esc(i.t)}</a></li>`).join("")}</ol>
  <h4>${esc(t(loc, "rail.progress"))}</h4>
  <div class="prog-box" id="prog-box" data-total="${chapters.length}">
    <div class="pt">${esc(t(loc, "rail.chaptersPassed"))}</div>
    <div class="meter"><i style="width:0%"></i></div>
    <div class="pn2">${esc(t(loc, "rail.begin"))}</div>
    <p style="margin:.5rem 0 0"><button class="copy" id="prog-reset" type="button">${esc(t(loc, "rail.reset"))}</button></p>
  </div>
</aside>`;
}

function footer(loc: Locale): string {
  const L = (p: string) => localePath(loc, p);
  return `<footer class="foot"><div class="foot-in">
  <div>
    <h5>${esc(SITE.title)}</h5>
    <p class="about">${esc(
      t(loc, "foot.about", {
        chapters: SITE.chapters,
        lines: SITE.lines.toLocaleString("en-US"),
        lang: SITE.lang,
      })
    )}</p>
  </div>
  <div><h5>${esc(t(loc, "foot.course"))}</h5><ul>
    <li><a href="${L("/c00/")}">${t(loc, "foot.startAt")}</a></li>
    <li><a href="${L("/map/")}">${t(loc, "foot.theMap")}</a></li>
    <li><a href="${L("/setup/")}">${t(loc, "foot.setup")}</a></li>
    <li><a href="${L("/projects/")}">${t(loc, "foot.projects")}</a></li>
  </ul></div>
  <div><h5>${esc(t(loc, "foot.reference"))}</h5><ul>
    <li><a href="${L("/answers/")}">${t(loc, "foot.answers")}</a></li>
    <li><a href="${L("/qa/")}">${t(loc, "foot.qa")}</a></li>
    <li><a href="${L("/glossary/")}">${t(loc, "foot.glossary")}</a></li>
    <li><a href="${L("/compare/")}">${t(loc, "foot.compare")}</a></li>
    <li><a href="${L("/timeline/")}">${t(loc, "foot.timeline")}</a></li>
    <li><a href="${L("/references/")}">${t(loc, "foot.references")}</a></li>
  </ul></div>
</div></footer>`;
}

export function shell(opts: {
  title: string;
  desc: string;
  path: string;
  content: string;
  chapterId?: string;
  searchIndex: string;
  keywords?: string[];
  locale?: Locale;
}): string {
  const loc: Locale = opts.locale ?? DEFAULT_LOCALE;
  const canonical = stripLocale(opts.path);
  const full = canonical === "/" ? SITE.title : `${opts.title} · ${SITE.short}`;
  const alternates = LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${LOCALE_META[l].lang}" href="${localePath(l, canonical)}">`
  ).join("\n");
  return `<!doctype html>
<html lang="${LOCALE_META[loc].lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(opts.desc)}">
${opts.keywords?.length ? `<meta name="keywords" content="${esc(opts.keywords.join(","))}">` : ""}
<meta name="theme-color" content="#fbfaf8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#100f0d" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(opts.desc)}">
<meta property="og:type" content="website">
${alternates}
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23b4530a'/><text x='16' y='23' font-family='monospace' font-size='20' font-weight='700' fill='%23fbfaf8' text-anchor='middle'>A</text></svg>">
<script>(function(){try{var t=JSON.parse(localStorage.getItem("agentcourse.theme")||'"system"');if(t!=="system")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>
</head>
<body${opts.chapterId ? ` data-chapter="${opts.chapterId}"` : ""}>
<a class="skip" href="#main">${esc(t(loc, "nav.skip"))}</a>
${topNav(opts.path, loc)}
${opts.content}
${footer(loc)}
<script>window.__SEARCH_INDEX__=${opts.searchIndex};</script>
<script src="/app.js"></script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */

export function renderChapter(
  c: Chapter,
  chapters: Chapter[],
  searchIndex: string,
  loc: Locale = DEFAULT_LOCALE,
  fallback = false
): string {
  const L = (p: string) => localePath(loc, p);
  const i = chapters.findIndex((x) => x.id === c.id);
  const prev = chapters[i - 1];
  const next = chapters[i + 1];
  const layer = layerFor(loc, LAYERS.find((l) => l.id === c.layer)!);

  const sections = c.sections
    .map(
      (s) => `<section class="sec" id="${s.id}">
  <p class="kicker">${esc(s.kicker)}</p>
  <h2>${esc(s.title)}</h2>
  ${s.html}
</section>`
    )
    .join("\n");

  const exercises = `<section class="sec" id="exercises">
  <p class="kicker">${esc(t(loc, "sec.exercises"))}</p>
  <h2>${esc(t(loc, "sec.exercisesTitle"))}</h2>
  <p class="muted">${t(loc, "sec.exercisesLede", { answers: L("/answers/") })}</p>
  <div class="ex">${c.exercises
    .map(
      (e, n) => `<div class="ex-item">
    <span class="n">${n + 1}</span>
    <div>
      <p>${e.prompt} <span class="ex-diff">${e.difficulty}</span></p>
      <details class="ans"><summary>${esc(t(loc, "sec.answer"))}</summary><div class="inner">${e.answer}</div></details>
    </div>
  </div>`
    )
    .join("")}</div>
</section>`;

  const qa = `<section class="sec" id="qa">
  <p class="kicker">${esc(t(loc, "sec.qa"))}</p>
  <h2>${esc(t(loc, "sec.qaTitle"))}</h2>
  ${c.qa
    .map(
      (x) => `<details class="qa"><summary>${esc(x.q)}</summary><div class="inner">${x.a}</div></details>`
    )
    .join("")}
</section>`;

  const project = `<section class="sec" id="project">
  <p class="kicker">${esc(t(loc, "sec.project"))}</p>
  <h2>${esc(c.project.title)}</h2>
  ${c.project.brief}
  <h3>${esc(t(loc, "sec.doneMeans"))}</h3>
  <ul>${c.project.spec.map((s) => `<li>${s}</li>`).join("")}</ul>
  ${
    c.project.stretch?.length
      ? `<h3>${esc(t(loc, "sec.ifYouWantMore"))}</h3><ul>${c.project.stretch.map((s) => `<li>${s}</li>`).join("")}</ul>`
      : ""
  }
</section>`;

  const review = `<section class="sec" id="review">
  <p class="kicker">${esc(t(loc, "sec.review"))}</p>
  <h2>${esc(t(loc, "sec.reviewTitle"))}</h2>
  <p class="muted">${esc(t(loc, "sec.reviewLede"))}</p>
  <div class="quiz" data-quiz>
    <div class="quiz-head"><span>${esc(t(loc, "sec.review"))}</span><span class="qprog">${esc(t(loc, "quiz.question"))} <span class="qnum">1</span> ${esc(t(loc, "quiz.of"))} <span class="qtot">6</span></span></div>
    <div class="quiz-body">
      <p class="qtext"></p>
      <div class="qopts"></div>
      <div class="qexp" style="display:none"></div>
    </div>
    <div class="quiz-foot">
      <button class="btn primary q-next" type="button" disabled>${esc(t(loc, "quiz.next"))}</button>
      <button class="btn q-again" type="button" style="display:none">${esc(t(loc, "quiz.retake"))}</button>
      <span class="score">0 / 6</span>
    </div>
  </div>
  <script type="application/json" id="quiz-data">${JSON.stringify(c.quiz).replace(/</g, "\\u003c")}</script>
</section>`;

  const pn = `<nav class="pn">
  ${
    prev
      ? `<a href="${L(`/${prev.id}/`)}"><span class="dir">← ${esc(t(loc, "pn.prev"))} · ${prev.id.toUpperCase()}</span><span class="t">${esc(
          prev.title
        )}</span><span class="s">${esc(prev.subtitle)}</span></a>`
      : `<a href="${L("/map/")}"><span class="dir">← ${esc(t(loc, "pn.theMap"))}</span><span class="t">${esc(t(loc, "pn.allLayers"))}</span><span class="s">${esc(t(loc, "pn.howTheyFit"))}</span></a>`
  }
  ${
    next
      ? `<a class="next" href="${L(`/${next.id}/`)}"><span class="dir">${esc(t(loc, "pn.next"))} · ${next.id.toUpperCase()} →</span><span class="t">${esc(
          next.title
        )}</span><span class="s">${esc(next.subtitle)}</span></a>`
      : `<a class="next" href="${L("/projects/")}"><span class="dir">${esc(t(loc, "pn.next"))} →</span><span class="t">${esc(t(loc, "pn.projects"))}</span><span class="s">${esc(t(loc, "pn.everything"))}</span></a>`
  }
</nav>`;

  const banner = fallback
    ? `<div class="note warn" style="margin:0 0 1.5rem"><span class="note-t">${esc(
        t(loc, "fallback.title")
      )}</span><p>${esc(t(loc, "fallback.body"))}</p></div>`
    : "";

  const content = `<div class="layout">
${sidebar(chapters, loc, c.id)}
<main id="main"><div class="wrap">
  ${banner}
  <div class="hero">
    <div class="hero-meta">
      <span class="chip-id">${c.id.toUpperCase()}</span>
      <span>${esc(layer.name)}</span><span>·</span>
      <span>${c.lines} ${esc(t(loc, "chapter.lines"))}</span><span>·</span>
      <span>${esc(c.file)}</span>
    </div>
    <h1>${esc(c.title)}</h1>
    <p class="sub">${esc(c.subtitle)}</p>
    <div class="tags">${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
  </div>
${sections}
${exercises}
${qa}
${project}
${
  c.continues
    ? `<section class="sec"><p class="kicker">Continue</p><h2>${
        next ? esc(next.title) : "Where this goes"
      }</h2>${c.continues}</section>`
    : ""
}
${review}
${pn}
</div></main>
${railFor(c, chapters, loc)}
</div>`;

  return shell({
    title: `${c.title}: ${c.subtitle}`,
    desc: c.blurb,
    path: L(`/${c.id}/`),
    chapterId: c.id,
    content,
    searchIndex,
    keywords: c.tags,
    locale: loc,
  });
}

export function renderPage(
  pg: Page,
  chapters: Chapter[],
  searchIndex: string,
  loc: Locale = DEFAULT_LOCALE,
  fallback = false
): string {
  const banner = fallback
    ? `<div class="note warn" style="margin:0 0 1.5rem"><span class="note-t">${esc(
        t(loc, "fallback.title")
      )}</span><p>${esc(t(loc, "fallback.body"))}</p></div>`
    : "";
  const content = `<div class="layout">
${sidebar(chapters, loc)}
<main id="main"><div class="${pg.wide ? "wrap-wide" : "wrap"}">
  ${banner}
  <div class="hero">
    <p class="kicker">${esc(pg.kicker)}</p>
    <h1>${esc(pg.title)}</h1>
    <p class="sub">${esc(pg.subtitle)}</p>
  </div>
  ${pg.html}
</div></main>
</div>`;
  return shell({
    title: pg.title,
    desc: pg.subtitle,
    path: localePath(loc, `/${pg.slug}/`),
    content,
    searchIndex,
    locale: loc,
  });
}

export function buildSearchIndex(
  chapters: Chapter[],
  pages: Page[],
  loc: Locale = DEFAULT_LOCALE
): string {
  const items = [
    ...chapters.map((c) => ({
      i: c.id.toUpperCase(),
      t: c.title,
      s: c.subtitle,
      u: localePath(loc, `/${c.id}/`),
      k: c.tags.join(" "),
    })),
    ...pages.map((p) => ({
      i: "page",
      t: p.title,
      s: p.subtitle,
      u: localePath(loc, `/${p.slug}/`),
      k: "",
    })),
  ];
  return JSON.stringify(items);
}

export { sidebar, footer, topNav };
export { LAYERS, SITE };
export type { Layer };
