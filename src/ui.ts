/** Small HTML component helpers shared by every chapter. */

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KEYWORDS = new Set(
  ("const let var function return if else for while do break continue new class extends " +
   "interface type enum implements import export from default async await yield try catch " +
   "finally throw typeof instanceof in of this super null undefined true false void never " +
   "unknown any string number boolean object symbol bigint readonly public private protected " +
   "static abstract as satisfies keyof infer declare namespace module get set delete").split(" ")
);

type Tok = [cls: string, text: string];

/** Tiny scanner good enough for TypeScript, JSON, and shell snippets. */
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const push = (c: string, t: string) => { if (t) out.push([c, t]); };
  while (i < src.length) {
    const c = src[i];
    // comments
    if (c === "/" && src[i + 1] === "/") { const j = src.indexOf("\n", i); const e = j === -1 ? src.length : j; push("t-c", src.slice(i, e)); i = e; continue; }
    if (c === "#" && (i === 0 || src[i - 1] === "\n" || src[i - 1] === " ")) { const j = src.indexOf("\n", i); const e = j === -1 ? src.length : j; push("t-c", src.slice(i, e)); i = e; continue; }
    if (c === "/" && src[i + 1] === "*") { const j = src.indexOf("*/", i + 2); const e = j === -1 ? src.length : j + 2; push("t-c", src.slice(i, e)); i = e; continue; }
    // strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length) { if (src[j] === "\\") { j += 2; continue; } if (src[j] === c) { j++; break; } j++; }
      push("t-s", src.slice(i, j)); i = j; continue;
    }
    // numbers
    if (/[0-9]/.test(c) && !/[A-Za-z_$]/.test(src[i - 1] ?? "")) {
      let j = i; while (j < src.length && /[0-9a-fA-FxX._]/.test(src[j])) j++;
      push("t-n", src.slice(i, j)); i = j; continue;
    }
    // identifiers
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j; while (src[k] === " ") k++;
      if (KEYWORDS.has(word)) push("t-k", word);
      else if (src[k] === "(") push("t-f", word);
      else push("", word);
      i = j; continue;
    }
    push("", c); i++;
  }
  return out;
}

export function highlight(src: string): string {
  return tokenize(src)
    .map(([cls, t]) => (cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t)))
    .join("");
}

/** A code block with a filename header and copy button. */
export function code(opts: { title?: string; lang?: string; src: string; plain?: boolean }): string {
  const { title = "", lang = "typescript", src, plain = false } = opts;
  const body = plain ? esc(src.trim()) : highlight(src.trim());
  return `<div class="code">
  <div class="code-head"><span>${esc(title)}</span><button class="copy" type="button">copy</button><span class="lang">${esc(lang)}</span></div>
  <pre><code>${body}</code></pre>
</div>`;
}

/** A figure with a labelled header and caption. Body is arbitrary HTML/SVG. */
export function fig(opts: { label: string; title: string; body: string; caption?: string }): string {
  return `<figure>
  <div class="fig">
    <div class="fig-head"><span class="ft">${esc(opts.label)}</span><span>${esc(opts.title)}</span></div>
    <div class="fig-body">${opts.body}</div>
  </div>
  ${opts.caption ? `<figcaption>${opts.caption}</figcaption>` : ""}
</figure>`;
}

/** An interactive lab shell. `body` is HTML; the behaviour is registered in `script`. */
export function lab(opts: { label: string; title: string; body: string; script: string; caption?: string }): string {
  return `<div class="lab">
  <div class="lab-head"><span class="lt">${esc(opts.label)}</span><span>${esc(opts.title)}</span></div>
  <div class="lab-body">${opts.body}</div>
</div>
${opts.caption ? `<p class="small muted">${opts.caption}</p>` : ""}
<script>registerLab(function(){\n${opts.script}\n});</script>`;
}

export function note(kind: "key" | "warn" | "bad" | "good" | "", title: string, html: string): string {
  return `<div class="note ${kind}"><span class="note-t">${esc(title)}</span>${html}</div>`;
}

export function table(headers: string[], rows: string[][]): string {
  return `<div class="tbl-wrap"><table>
  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
</table></div>`;
}

/** Horizontal flow diagram made of boxes and arrows. */
export function flow(nodes: Array<{ t: string; s?: string; tone?: "" | "a" | "t" | "m" | "p" }>, sep = "→"): string {
  return `<div class="flow">${nodes
    .map((n) => `<div class="fnode ${n.tone ?? ""}"><b>${n.t}</b>${n.s ? `<span>${n.s}</span>` : ""}</div>`)
    .join(`<span class="farrow">${sep}</span>`)}</div>`;
}

/** Inline SVG arrow markers, included once per diagram that needs them. */
export const ARROW_DEFS = `<defs>
  <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker>
  <marker id="ara" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)"/></marker>
</defs>`;

export const p = (s: string) => `<p>${s}</p>`;
export const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
export const ol = (items: string[]) => `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
export const h3 = (s: string) => `<h3>${s}</h3>`;
/** Link to another chapter by id. */
export const ch = (id: string, text?: string) =>
  `<a href="/${id}/" class="mono">${text ?? id.toUpperCase()}</a>`;
