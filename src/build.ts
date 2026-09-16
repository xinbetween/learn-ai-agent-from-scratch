/** Static site generator. Run: npm run build */
import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Chapter, Page } from "./types.ts";
import { SITE } from "./curriculum.ts";
import { renderChapter, renderPage, buildSearchIndex } from "./render.ts";
import { renderLanding } from "./landing.ts";
import { chapters } from "../content/chapters/index.ts";
import { pages } from "../content/pages/index.ts";
import { type Locale, LOCALES, DEFAULT_LOCALE, BASE_PATH, localePath, url, t } from "./i18n.ts";
import { zhChapters, zhPageMeta, zhTranslatedPages } from "../content/zh/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");
/** Absolute origin used for the sitemap, robots.txt and canonical URLs.
 *  Defaults to where the site actually answers; the deploy workflow sets it
 *  explicitly. Must agree with SITE_BASE_PATH — asserted below. */
const BASE = (process.env.SITE_URL ?? "https://agent.xinbetween.com").replace(/\/+$/, "");

function write(rel: string, body: string) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body, "utf8");
}

/** The paths handed in already carry the base path, so compose them against
 *  the origin alone — otherwise SITE_URL's own sub-path gets doubled. */
const ORIGIN = new URL(BASE).origin;

/* SITE_URL and SITE_BASE_PATH describe the same fact twice, and setting one
   without the other produces a site where every asset and link 404s while the
   build still reports success. Fail here instead. */
{
  const declared = new URL(BASE).pathname.replace(/\/+$/, "");
  if (declared !== BASE_PATH) {
    console.error(
      `\nSITE_URL and SITE_BASE_PATH disagree:\n` +
        `  SITE_URL path : "${declared || "(root)"}"  (from ${BASE})\n` +
        `  SITE_BASE_PATH: "${BASE_PATH || "(root)"}"\n` +
        `They must describe the same sub-path. A custom domain at its origin ` +
        `root means both are empty; project Pages hosting means both are /<repo>.\n`
    );
    process.exit(1);
  }
}
const HOME = localePath(DEFAULT_LOCALE, "/");

function sitemap(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `<url><loc>${ORIGIN}${u}</loc><changefreq>monthly</changefreq><priority>${
        u === HOME ? "1.0" : "0.8"
      }</priority></url>`
  )
  .join("\n")}
</urlset>`;
}

/** The chapter set as a locale sees it: translated where available. */
function chaptersFor(loc: Locale, all: Chapter[]): Chapter[] {
  if (loc === DEFAULT_LOCALE) return all;
  return all.map((c) => zhChapters[c.id] ?? c);
}

/** Pages for a locale, with translated titles where we have them. */
function pagesFor(loc: Locale, chs: Chapter[]): Page[] {
  const pgs = pages(chs);
  if (loc === DEFAULT_LOCALE) return pgs;
  return pgs.map((pg) => {
    const meta = zhPageMeta[pg.slug];
    return meta ? { ...pg, ...meta } : pg;
  });
}

function main() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const all: Chapter[] = chapters;
  const urls: string[] = [];
  let pageCount = 0;

  for (const loc of LOCALES) {
    const chs = chaptersFor(loc, all);
    const pgs = pagesFor(loc, chs);
    const index = buildSearchIndex(chs, pgs, loc);
    const dir = loc === DEFAULT_LOCALE ? "" : `${loc}/`;

    write(`${dir}index.html`, renderLanding(chs, index, loc));
    urls.push(localePath(loc, "/"));

    for (const c of chs) {
      const translated = loc === DEFAULT_LOCALE || Boolean(zhChapters[c.id]);
      write(`${dir}${c.id}/index.html`, renderChapter(c, chs, index, loc, !translated));
      urls.push(localePath(loc, `/${c.id}/`));
    }

    for (const pg of pgs) {
      const translated = loc === DEFAULT_LOCALE || zhTranslatedPages.has(pg.slug);
      write(`${dir}${pg.slug}/index.html`, renderPage(pg, chs, index, loc, !translated));
      urls.push(localePath(loc, `/${pg.slug}/`));
      if (loc === DEFAULT_LOCALE) pageCount++;
    }

    write(
      `${dir}404.html`,
      renderPage(
        {
          slug: "404",
          title: t(loc, "404.title"),
          kicker: t(loc, "404.kicker"),
          subtitle: t(loc, "404.subtitle"),
          html: t(loc, "404.body", {
            home: localePath(loc, "/"),
            map: localePath(loc, "/map/"),
            n: all.length,
          }),
        },
        chs,
        index,
        loc
      )
    );
  }

  // static assets
  cpSync(join(ROOT, "static"), OUT, { recursive: true });
  // publish the runnable course code so chapters can link to it
  if (existsSync(join(ROOT, "code"))) {
    cpSync(join(ROOT, "code"), join(OUT, "code"), { recursive: true });
  }

  write("sitemap.xml", sitemap(urls));
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}${localePath(DEFAULT_LOCALE, "/sitemap.xml")}\n`);
  write(
    "manifest.webmanifest",
    JSON.stringify({ name: SITE.title, short_name: SITE.short, start_url: HOME, display: "standalone", background_color: "#fbfaf8", theme_color: "#b4530a", icons: [{ src: url("/favicon.svg"), sizes: "any", type: "image/svg+xml" }] }, null, 2)
  );

  const codeFiles = existsSync(join(ROOT, "code")) ? readdirSync(join(ROOT, "code")).filter((f) => f.endsWith(".ts")) : [];
  const zhDone = Object.keys(zhChapters).length;
  console.log(
    `built ${all.length} chapters + ${pageCount} pages + ${codeFiles.length} runnable files ` +
      `\u00d7 ${LOCALES.length} locales \u2192 dist/  (zh: ${zhDone}/${all.length} chapters translated)`
  );

  // sanity: every chapter must be complete
  const problems: string[] = [];
  for (const c of all) {
    if (c.sections.length < 4) problems.push(`${c.id}: only ${c.sections.length} sections`);
    if (c.quiz.length !== 6) problems.push(`${c.id}: ${c.quiz.length} quiz questions (want 6)`);
    if (c.exercises.length < 3) problems.push(`${c.id}: ${c.exercises.length} exercises`);
    if (c.qa.length < 3) problems.push(`${c.id}: ${c.qa.length} Q&A entries`);
    for (const q of c.quiz) if (q.answer < 0 || q.answer > 3) problems.push(`${c.id}: bad quiz answer index`);
  }
  // translations must keep the same shape as the original
  for (const [id, c] of Object.entries(zhChapters)) {
    const orig = all.find((x) => x.id === id);
    if (!orig) { problems.push(`zh/${id}: no such chapter`); continue; }
    if (c.sections.length !== orig.sections.length) problems.push(`zh/${id}: ${c.sections.length} sections, original has ${orig.sections.length}`);
    if (c.quiz.length !== orig.quiz.length) problems.push(`zh/${id}: ${c.quiz.length} quiz questions, original has ${orig.quiz.length}`);
    if (c.exercises.length !== orig.exercises.length) problems.push(`zh/${id}: ${c.exercises.length} exercises, original has ${orig.exercises.length}`);
    if (c.qa.length !== orig.qa.length) problems.push(`zh/${id}: ${c.qa.length} Q&A entries, original has ${orig.qa.length}`);
    for (let i = 0; i < Math.min(c.quiz.length, orig.quiz.length); i++) {
      if (c.quiz[i].answer !== orig.quiz[i].answer) problems.push(`zh/${id}: quiz ${i + 1} answer index differs from the original`);
    }
  }
  if (problems.length) {
    console.error("\nINCOMPLETE:\n" + problems.map((p) => "  - " + p).join("\n"));
    process.exitCode = 1;
  }
}

main();
