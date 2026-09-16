import type { Chapter } from "../../src/types.ts";
import { code, fig, lab, note, table, p, ul, ol, ch } from "../../src/ui.ts";

const PIPE_SVG = `
<svg viewBox="0 0 700 280" width="100%" style="max-width:700px;display:block;margin:0 auto" role="img"
     aria-label="Retrieval pipeline from corpus to context, showing where recall and precision are lost">
  <defs><marker id="r6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)"/></marker></defs>
  <text x="14" y="18" class="d-label">EVERY STAGE THROWS THINGS AWAY — RECALL IS LOST EARLY AND NEVER COMES BACK</text>

  <rect x="14" y="34" width="96" height="46" rx="6" class="d-box"/>
  <text x="62" y="54" class="d-text" text-anchor="middle">corpus</text>
  <text x="62" y="70" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">10M tok</text>
  <path d="M114 57 L146 57" class="d-arrow" marker-end="url(#r6)"/>

  <rect x="150" y="34" width="96" height="46" rx="6" class="d-box-m"/>
  <text x="198" y="54" class="d-text" text-anchor="middle">chunk</text>
  <text x="198" y="70" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">8,000 chunks</text>
  <path d="M250 57 L282 57" class="d-arrow" marker-end="url(#r6)"/>

  <rect x="286" y="34" width="110" height="46" rx="6" class="d-box-t"/>
  <text x="341" y="54" class="d-text" text-anchor="middle">hybrid search</text>
  <text x="341" y="70" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">top 50</text>
  <path d="M400 57 L432 57" class="d-arrow" marker-end="url(#r6)"/>

  <rect x="436" y="34" width="100" height="46" rx="6" class="d-box-p"/>
  <text x="486" y="54" class="d-text" text-anchor="middle">rerank</text>
  <text x="486" y="70" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">top 5</text>
  <path d="M540 57 L572 57" class="d-arrow" marker-end="url(#r6)"/>

  <rect x="576" y="34" width="110" height="46" rx="6" class="d-box-a"/>
  <text x="631" y="54" class="d-text" text-anchor="middle">context</text>
  <text x="631" y="70" class="d-mono" text-anchor="middle" fill="var(--fg-faint)">~2.5K tok</text>

  <text x="14" y="108" class="d-label">WHERE IT GOES WRONG</text>
  <rect x="150" y="118" width="96" height="40" rx="5" class="d-box" stroke="var(--danger)"/>
  <text x="198" y="134" class="d-mono" text-anchor="middle" fill="var(--danger)">split mid-</text>
  <text x="198" y="148" class="d-mono" text-anchor="middle" fill="var(--danger)">fact</text>

  <rect x="286" y="118" width="110" height="40" rx="5" class="d-box" stroke="var(--danger)"/>
  <text x="341" y="134" class="d-mono" text-anchor="middle" fill="var(--danger)">vectors miss</text>
  <text x="341" y="148" class="d-mono" text-anchor="middle" fill="var(--danger)">exact IDs</text>

  <rect x="436" y="118" width="100" height="40" rx="5" class="d-box" stroke="var(--warn)"/>
  <text x="486" y="134" class="d-mono" text-anchor="middle" fill="var(--warn)">costs 200ms</text>
  <text x="486" y="148" class="d-mono" text-anchor="middle" fill="var(--warn)">worth it</text>

  <rect x="576" y="118" width="110" height="40" rx="5" class="d-box" stroke="var(--warn)"/>
  <text x="631" y="134" class="d-mono" text-anchor="middle" fill="var(--warn)">best chunk</text>
  <text x="631" y="148" class="d-mono" text-anchor="middle" fill="var(--warn)">goes LAST</text>

  <line x1="14" y1="178" x2="686" y2="178" stroke="var(--border)"/>
  <text x="14" y="200" class="d-label">THE AGENT DIFFERENCE: RETRIEVAL IS A TOOL, NOT A PREPROCESSING STEP</text>
  <rect x="14" y="212" width="320" height="52" rx="6" class="d-box" stroke-dasharray="3 3"/>
  <text x="26" y="232" class="d-mono" fill="var(--fg-faint)">classic RAG: retrieve once on the user's</text>
  <text x="26" y="248" class="d-mono" fill="var(--fg-faint)">words, then answer. one shot, no recovery.</text>

  <rect x="352" y="212" width="334" height="52" rx="6" class="d-box-a"/>
  <text x="364" y="232" class="d-mono">agentic: search → read result → refine query →</text>
  <text x="364" y="248" class="d-mono">search again. the loop IS the retry strategy.</text>
</svg>`;

const chapter: Chapter = {
  id: "c06",
  num: 6,
  layer: "context",
  title: "Retrieval",
  subtitle: "Getting the right 2,000 tokens out of ten million",
  blurb:
    "Chunking, embeddings, hybrid search and reranking, built from scratch — and the reframe that matters: in an agent, retrieval is a tool the model calls in a loop, not a preprocessing step you run once.",
  lines: 249,
  file: "code/c06_retrieval.ts",
  tags: ["RAG", "embeddings", "chunking", "BM25", "hybrid search", "reranking", "agentic retrieval"],

  sections: [
    {
      id: "motivation",
      kicker: "Motivation",
      title: "Why not just put everything in the context",
      html:
        p(`Because "everything" is ten million tokens and the window is two hundred thousand. And even if it fit, ${ch("c05", "C05")} showed that stuffing it would make quality worse, not better. Retrieval is the function that chooses which 2,000 tokens are worth the space.`) +
        p(`The classic framing — <em>retrieval-augmented generation</em> — is a one-shot pipeline: take the user's question, find some documents, paste them in, answer. That framing is a poor fit for agents and the difference is not cosmetic. An agent can read a result, notice it answered the wrong question, reformulate, and search again. The loop from ${ch("c04", "C04")} <em>is</em> the retry strategy, which means retrieval quality matters less than people think and retrieval <em>legibility</em> matters more.`) +
        note("key", "The two framings", p(`<strong>RAG:</strong> retrieval is a preprocessing step; if it fails, the answer is wrong. <strong>Agentic retrieval:</strong> retrieval is a tool; if it fails, the agent notices and tries differently. Design for the second, which means your search tool must return results the model can <em>assess</em>, including an honest "nothing matched".`)),
    },
    {
      id: "core-idea",
      kicker: "Core idea",
      title: "Four stages, each discarding something",
      html:
        fig({ label: "Diagram", title: "corpus to context", body: PIPE_SVG,
          caption: `Recall lost at the chunking stage cannot be recovered by a better reranker. The stages are ordered by how expensive they are per candidate, which is why you cast a wide net cheaply and narrow it expensively.` }) +
        `<h3>Chunking is the decision that matters most</h3>` +
        p(`Chunking is usually treated as a parameter (<code>size=512, overlap=50</code>) and it is actually the stage where most retrieval quality is won or lost. A chunk is the unit you retrieve, so a chunk must be <em>independently meaningful</em>.`) +
        table(
          ["Strategy", "How", "When"],
          [
            ["<b>Fixed-size</b>", "N tokens, M overlap", "Baseline only. Splits mid-sentence, mid-table, mid-function"],
            ["<b>Structural</b>", "Split on markdown headings, HTML sections, function boundaries", "<b>Default.</b> The document already tells you where the seams are"],
            ["<b>Recursive</b>", "Try paragraph, then sentence, then character until under the cap", "Good fallback inside a structural section that is too big"],
            ["<b>Contextual</b>", "Prepend a generated sentence of document/section context to each chunk", "Highest quality, costs one model call per chunk at index time"],
          ]
        ) +
        p(`The contextual variant is worth understanding because it fixes the dominant failure. A chunk that reads <em>"The limit is 14 days unless the item is faulty."</em> is useless in isolation. What limit? Which items? Prepending <em>"From the Returns Policy, section 3, Electronics:"</em> makes it retrievable and usable. Anthropic's contextual-retrieval work reports large error reductions from exactly this, and you can approximate it for free by prepending the heading path.`) +
        `<h3>Embeddings, and what they are bad at</h3>` +
        p(`An embedding maps text to a vector such that similar meanings are close. Cosine similarity ranks by meaning, which is exactly what keyword search cannot do. It also fails precisely where keyword search shines:`) +
        ul([
          `<strong>Exact identifiers.</strong> <code>ERR_4471</code>, <code>getUserById</code>, an order number. The embedding of a rare token is noise; BM25 finds it instantly.`,
          `<strong>Negation.</strong> "orders <em>not</em> shipped" embeds close to "orders shipped".`,
          `<strong>Rare, precise terms.</strong> Domain jargon the embedding model never saw well.`,
        ]) +
        p(`Which is why the default is <strong>hybrid</strong> rather than plain vector search: run both, fuse the rankings. The fusion that works and needs no tuning is Reciprocal Rank Fusion. It uses <em>ranks</em> rather than scores, so you never have to normalise incomparable numbers.`) +
        code({
          title: "RRF — six lines, no hyperparameters worth tuning",
          src: `export function rrf(rankings: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// Use: rrf([vectorSearch(q, 50), bm25(q, 50)]) → fused ranking.
// A document ranked #1 by one retriever and #40 by the other still beats
// one ranked #12 by both. That asymmetry is the point.`,
        }) +
        `<h3>Reranking: the highest-value 200ms in the pipeline</h3>` +
        p(`Retrieval gets you 50 plausible candidates. A cross-encoder reranker reads the query <em>and</em> each candidate together and scores relevance directly. That is far more accurate than comparing two independently-computed vectors, and far too slow to run over the whole corpus. That is the whole design: cheap recall, expensive precision, in that order.`),
    },
    {
      id: "mechanics",
      kicker: "Mechanics",
      title: "Building it without a vector database",
      html:
        p(`For under a million chunks you do not need a vector database. Brute-force cosine over a <code>Float32Array</code> is fast enough and removes an entire operational dependency.`) +
        code({
          title: "code/c06_retrieval.ts — a flat index",
          src: `export class FlatIndex {
  private vectors!: Float32Array;   // n × dim, contiguous — one allocation
  private meta: ChunkMeta[] = [];
  private dim = 0;

  add(chunks: Array<{ text: string; vector: Float32Array; meta: ChunkMeta }>): void { /* … */ }

  search(query: Float32Array, k: number): Array<{ id: number; score: number }> {
    const n = this.meta.length, d = this.dim;
    // Vectors are pre-normalised at insert, so cosine reduces to a dot product.
    const heap = new MinHeap<{ id: number; score: number }>(k, (a, b) => a.score - b.score);
    for (let i = 0; i < n; i++) {
      let dot = 0;
      const off = i * d;
      for (let j = 0; j < d; j++) dot += this.vectors[off + j] * query[j];
      heap.offer({ id: i, score: dot });     // bounded heap: O(n log k), not a full sort
    }
    return heap.drain();
  }
}
// 100k chunks × 1024 dims ≈ 400MB and ~40ms per query in plain JS.
// Past ~1M chunks, that is when a real index (HNSW, IVF) starts to earn its keep.`,
        }) +
        `<h3>BM25 in thirty lines</h3>` +
        code({
          title: "the other half of hybrid",
          src: `export class BM25 {
  private df = new Map<string, number>();       // document frequency
  private docs: Array<{ id: string; tf: Map<string, number>; len: number }> = [];
  private avgLen = 0;

  search(query: string, k: number, k1 = 1.5, b = 0.75): Array<{ id: string; score: number }> {
    const terms = tokenize(query);
    const N = this.docs.length;
    const scored = this.docs.map((doc) => {
      let s = 0;
      for (const t of terms) {
        const f = doc.tf.get(t);
        if (!f) continue;
        // IDF: rare terms dominate. This is why BM25 finds ERR_4471 and vectors do not.
        const idf = Math.log(1 + (N - (this.df.get(t) ?? 0) + 0.5) / ((this.df.get(t) ?? 0) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.len / this.avgLen)));
      }
      return { id: doc.id, score: s };
    });
    return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  }
}`,
        }) +
        `<h3>The search tool, and why its failure message matters</h3>` +
        p(`In an agent, the retriever is a ${ch("c03", "C03")} tool, and its contract with the model is what determines whether a bad search is recoverable.`) +
        code({
          title: "a result the model can assess",
          src: `const searchDocs = defineTool({
  name: "search_docs",
  description: \`Search internal documentation. Keyword and semantic search combined.
USE WHEN: you need policy, process or reference material.
NOT FOR: live data about a specific order — use search_orders.
RETURNS: up to 5 passages with source path, section heading, and a relevance score
0–1. An empty result means nothing matched — it is not an error.\`,
  input: obj({ query: str(), filter: opt(str({ description: "path prefix, e.g. policies/" })) }),
  readOnly: true,
  async run({ query, filter }) {
    const hits = await retriever.search(query, { k: 5, filter });
    if (!hits.length) {
      // The single most important string in the whole pipeline.
      return \`No passages matched "\${query}". The index covers \${retriever.stats.sections}. \` +
             \`Try broader terms, or list_sections() to see what exists.\`;
    }
    return hits.map((h) =>
      \`--- \${h.path} § \${h.heading}  (score \${h.score.toFixed(2)})\\n\${h.text}\`).join("\\n\\n");
  },
});`,
        }) +
        note("good", "Return provenance, always", p(`Every passage carries its path and heading. Three consequences: the model can cite (and users trust cited answers far more), the model can ask for <em>more of that document</em> as a next step, and when the answer is wrong you can tell instantly whether retrieval or reasoning failed. Provenance costs about ten tokens per passage and it is never not worth it.`)),
    },
    {
      id: "explore",
      kicker: "Explore",
      title: "Tune the pipeline against real query types",
      html:
        p(`Four query classes, four very different winners. Adjust the pipeline and watch which classes you are helping and which you are quietly breaking.`) +
        lab({
          label: "Simulator",
          title: "retrieval quality by query type",
          body: `
<div class="controls">
  <div class="ctl"><label>chunking</label>
    <select id="r6-chunk"><option value="fixed">fixed 512</option><option value="struct" selected>structural</option><option value="ctx">contextual (+heading)</option></select></div>
  <div class="ctl"><label>retriever</label>
    <select id="r6-ret"><option value="vec">vector only</option><option value="bm">BM25 only</option><option value="hy" selected>hybrid (RRF)</option></select></div>
  <div class="ctl"><label>rerank</label>
    <select id="r6-rr"><option value="0">off</option><option value="1" selected>cross-encoder top-50→5</option></select></div>
  <div class="ctl"><label>agent may re-query</label>
    <select id="r6-loop"><option value="0">no (one-shot RAG)</option><option value="1" selected>yes (agentic)</option></select></div>
</div>
<div id="r6-rows" style="margin-top:.5rem"></div>
<div class="stats">
  <div class="stat"><b id="r6-avg">—</b><span>mean answer-supported rate</span></div>
  <div class="stat"><b id="r6-lat">—</b><span>added latency</span></div>
  <div class="stat"><b id="r6-idx">—</b><span>index cost per 1M tokens</span></div>
</div>
<div class="note" id="r6-note" style="margin-top:1rem"></div>`,
          script: `
var Q = [
  { k: "exact ID — \\"what is ERR_4471\\"",        vec: .28, bm: .93, ctxBonus: .02, rrBonus: .03 },
  { k: "conceptual — \\"how do refunds work\\"",   vec: .78, bm: .49, ctxBonus: .09, rrBonus: .10 },
  { k: "multi-hop — \\"is 4471 refundable\\"",     vec: .42, bm: .35, ctxBonus: .12, rrBonus: .08 },
  { k: "negation — \\"orders NOT shipped\\"",      vec: .31, bm: .58, ctxBonus: .04, rrBonus: .12 }
];
function upd() {
  var chunk = document.getElementById("r6-chunk").value, ret = document.getElementById("r6-ret").value,
      rr = document.getElementById("r6-rr").value === "1", loop = document.getElementById("r6-loop").value === "1";
  var chunkMul = { fixed: .82, struct: 1.0, ctx: 1.0 }[chunk];
  var rows = [], sum = 0;
  Q.forEach(function (q) {
    var base = ret === "vec" ? q.vec : ret === "bm" ? q.bm : Math.min(.97, Math.max(q.vec, q.bm) + Math.min(q.vec, q.bm) * .42);
    var s = base * chunkMul;
    if (chunk === "ctx") s += q.ctxBonus;
    if (rr) s += q.rrBonus;
    // the loop rescues a share of the misses — this is the agentic difference
    if (loop) s = s + (1 - s) * (q.k.indexOf("multi-hop") >= 0 ? .62 : .45);
    s = Math.max(.05, Math.min(.99, s));
    sum += s;
    rows.push([q.k, s]);
  });
  document.getElementById("r6-rows").innerHTML = rows.map(function (r) {
    var col = r[1] > .85 ? "var(--ok)" : r[1] > .6 ? "var(--accent)" : "var(--danger)";
    return '<div style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0">' +
      '<span class="mono small" style="width:17rem;color:var(--fg-muted)">' + r[0] + '</span>' +
      '<span class="meter" style="flex:1"><i style="width:' + (r[1] * 100) + '%;background:' + col + '"></i></span>' +
      '<span class="mono small" style="width:3rem;text-align:right">' + Math.round(r[1] * 100) + '%</span></div>';
  }).join("");
  document.getElementById("r6-avg").textContent = Math.round((sum / Q.length) * 100) + "%";
  document.getElementById("r6-lat").textContent = (rr ? 210 : 40) + (ret === "hy" ? 25 : 0) + (loop ? 1400 : 0) + " ms";
  document.getElementById("r6-idx").textContent = chunk === "ctx" ? "$1.40" : "$0.02";

  var n = document.getElementById("r6-note");
  if (ret === "vec") n.innerHTML = "<b>Vector-only loses exact IDs.</b> Look at the first row. Embeddings of rare tokens are close to noise; BM25's IDF term finds them immediately. This single row is why hybrid is the default.";
  else if (ret === "bm") n.innerHTML = "<b>BM25-only loses concepts.</b> \\"How do refunds work\\" shares no rare terms with a policy document that says \\"returns are accepted within 30 days\\". Lexical search cannot bridge vocabulary.";
  else if (!loop) n.innerHTML = "<b>One-shot RAG.</b> A retrieval miss is a wrong answer — there is no second chance. Turn the loop on and watch multi-hop especially: the agent reads a partial result, reformulates, searches again.";
  else n.innerHTML = "<b>This is the production shape.</b> Structural or contextual chunks, hybrid retrieval, a reranker, and an agent allowed to re-query. Note that the loop helps multi-hop most — that is precisely the class one-shot RAG cannot do at all.";
}
["r6-chunk","r6-ret","r6-rr","r6-loop"].forEach(function (i) { document.getElementById(i).addEventListener("change", upd); });
upd();`,
          caption: `The row to watch is multi-hop. No chunking strategy and no reranker fixes it, because the question needs two retrievals where the second depends on the first result. Only the loop fixes it, which is the argument for treating retrieval as a tool.`,
        }),
    },
    {
      id: "build",
      kicker: "Build it",
      title: "Chunking that respects structure",
      html:
        code({
          title: "code/c06_retrieval.ts — split on seams, carry the heading path",
          src: `export function chunkMarkdown(doc: string, path: string, maxTokens = 500): Chunk[] {
  const lines = doc.split("\\n");
  const chunks: Chunk[] = [];
  let headings: string[] = [];     // the current heading stack, e.g. ["Returns", "Electronics"]
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\\n").trim();
    if (!text) return;
    chunks.push({
      // The heading path prepended IS the cheap version of contextual retrieval.
      // "Returns Policy > Electronics: The limit is 14 days unless faulty."
      text: \`\${path} — \${headings.join(" > ")}\\n\\n\${text}\`,
      path, headings: [...headings], tokens: estimateTokens(text),
    });
    buf = [];
  };

  for (const line of lines) {
    const h = /^(#{1,6})\\s+(.*)$/.exec(line);
    if (h) {
      flush();                                       // a heading is always a seam
      const level = h[1].length;
      headings = [...headings.slice(0, level - 1), h[2]];
      continue;
    }
    buf.push(line);
    if (estimateTokens(buf.join("\\n")) > maxTokens) {
      // Too big for one section: recurse on paragraph boundaries, never mid-sentence.
      const parts = splitRecursive(buf.join("\\n"), maxTokens, ["\\n\\n", "\\n", ". ", " "]);
      for (const part of parts.slice(0, -1)) { buf = [part]; flush(); }
      buf = [parts.at(-1)!];
    }
  }
  flush();
  return chunks;
}`,
        }) +
        p(`Two details that matter more than the algorithm. <strong>The heading path is prepended to the chunk text</strong>, so it is both embedded and visible to the model. That is contextual retrieval for free. And <strong>a heading is always a seam</strong>, even for short sections, because a chunk that spans two policies is a chunk that answers neither question well.`) +
        code({
          title: "run it",
          lang: "bash",
          plain: true,
          src: `node --experimental-strip-types code/c06_retrieval.ts

#   C06 · Retrieval
#
#   indexed 4 documents → 9 chunks (structural, heading-prefixed)
#
#   recall@1 by query class  (9 chunks — recall@5 is saturated and tells you nothing)
#
#   retriever        overall    MRR     exact ID  conceptual    negation   multi-hop
#   vector only          50%   0.69          50%          0%        100%        100%
#   bm25 only            63%   0.69         100%         33%        100%          0%
#   hybrid (RRF)         50%   0.70         100%          0%        100%          0%
#
#   Read that table with a caveat: the offline embedder here is a hashing
#   function over word bigrams, so it captures lexical overlap rather than
#   meaning. A real embedding model would score far higher on the conceptual
#   column and no higher on exact IDs — which is the shape the chapter claims,
#   and which you should verify on your own corpus rather than take from here.
#
#   the row that explains hybrid: vector search on an exact identifier
#
#     "what does error ERR_4471 mean"
#       vector → runbooks/refunds.md      ✗
#       bm25   → runbooks/errors.md       ✓   (IDF weights a near-unique token heavily)
#     "ERR_2203"
#       vector → runbooks/errors.md       ✓
#       bm25   → runbooks/errors.md       ✓   (IDF weights a near-unique token heavily)
#
#   what the search tool returns when nothing matches:
#
#     No passages matched "quantum teleportation refunds". The index covers
#     returns, shipping and error runbooks. Try broader terms, or call list_sections().
#
#   An empty result is not an error — and saying what the index covers is what
#   lets the agent recover instead of concluding the tool is broken.`,
        }),
    },
    {
      id: "production",
      kicker: "Production notes",
      title: "Field notes",
      html:
        ul([
          `<strong>Do not reach for a vector database on day one.</strong> Brute force over a few hundred thousand chunks is milliseconds and no operations. Adopt a real index when you measurably need it, and let the measurement be query latency at your actual corpus size rather than a blog post's.`,
          `<strong>Grep is a retrieval tool.</strong> For codebases, ripgrep beats embeddings for most queries and coding agents lean on it heavily. Do not embed a repository before trying exact search over it; the identifiers a developer searches for are exactly the tokens embeddings handle worst.`,
          `<strong>Contextual retrieval is worth its indexing cost</strong> if the corpus is stable. One model call per chunk at index time, reported to cut retrieval failures substantially. If the corpus changes hourly, the heading-path approximation captures much of the benefit for free.`,
          `<strong>Evaluate retrieval separately from the agent.</strong> Build a set of queries with known gold passages and track recall@k and MRR. Otherwise every quality regression turns into an argument about whether it was the prompt, the model or the index. It is usually the index.`,
          `<strong>Chunk size interacts with your reranker's window.</strong> A 2,000-token chunk that gets truncated by the reranker is scored on its first half only. Keep chunks comfortably inside it.`,
        ]),
    },
  ],

  exercises: [
    { difficulty: "warm-up",
      prompt: `A user asks "what does error ERR_4471 mean?" and vector search returns five passages about error handling generally, none mentioning ERR_4471 — which is documented. Explain the failure and give two fixes.`,
      answer:
        p(`<code>ERR_4471</code> is a rare token. Embedding models represent rare tokens poorly. The vector is dominated by the generic "error" signal, so everything about errors looks equally close. This is the canonical vector-search failure.`) +
        ul([
          `<strong>Hybrid retrieval.</strong> BM25's IDF term gives a near-unique token enormous weight, so the passage containing it ranks first. RRF fuses that with the semantic ranking and neither class of query loses.`,
          `<strong>A pattern-matched fast path.</strong> If the query matches <code>/[A-Z]+_\\d+/</code> or looks like an identifier, run exact search first and return it directly. Cheap, deterministic, and it also fixes file paths, order numbers and function names.`,
        ]) +
        p(`A third that costs nothing: make the search tool's empty/poor-result message suggest exact search explicitly, so the agent can recover on its own.`) },
    { difficulty: "core",
      prompt: `Design chunking for an API reference where each endpoint has a description, parameter table, example request and example response. Fixed-size chunking scores terribly. Say why, and what you would do instead.`,
      answer:
        p(`Fixed-size chunking cuts a parameter table in half, separates an example request from its response, and produces chunks like <em>"| limit | integer | Max results |"</em>, which embeds near every other parameter table in the corpus and is useless retrieved alone.`) +
        code({ title: "one endpoint, one chunk", src: `function chunkApiReference(spec: OpenApiDoc): Chunk[] {
  return Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.entries(ops).map(([method, op]) => ({
      // The whole endpoint is the atomic unit: nobody ever wants half of one.
      text: [
        \`\${method.toUpperCase()} \${path} — \${op.summary}\`,
        op.description,
        \`Parameters:\\n\${renderParams(op.parameters)}\`,
        \`Example request:\\n\${renderExample(op.requestBody)}\`,
        \`Example response (200):\\n\${renderExample(op.responses["200"])}\`,
        \`Errors: \${Object.keys(op.responses).filter((c) => c >= "400").join(", ")}\`,
      ].join("\\n\\n"),
      meta: { method, path, tags: op.tags, operationId: op.operationId },
    })));
}` }) +
        ul([
          `<strong>The natural unit is the endpoint</strong>, even at 1,500 tokens. Nobody ever wants half an endpoint, and over-splitting costs far more here than over-large chunks.`,
          `<strong>Emit a second, tiny chunk per endpoint</strong> containing just <code>METHOD /path — summary</code>. It retrieves well for "how do I list orders" and gives the agent a cheap index to navigate from.`,
          `<strong>Keep structured metadata</strong> (method, path, tags) so the search tool can offer a filter. "Search only POST endpoints under /orders" is a capability the agent will use if you give it.`,
        ]) },
    { difficulty: "core",
      prompt: `Implement query expansion: before searching, have the model generate three alternative phrasings, search all four, and fuse. When is this worth the extra call, and when does it actively hurt?`,
      answer:
        code({ title: "expand, search in parallel, fuse by rank", src: `async function expandedSearch(q: string, model: Model, idx: Retriever, k = 5) {
  const alts = await structured(model, [{ role: "user", content:
    \`Write 3 alternative phrasings of this search query using different vocabulary.
Include one that uses likely document jargon, and one that is broader.
Query: \${q}\` }], arr(str()), { attempts: 1 });

  const rankings = await Promise.all([q, ...alts].map((query) => idx.search(query, 30)));
  return rrf(rankings.map((r) => r.map((h) => h.id))).slice(0, k);
}` }) +
        p(`<strong>Worth it when:</strong> the vocabulary gap is real — users say "refund", documents say "returns"; users describe symptoms, documents describe causes. Also when recall matters far more than latency (research tasks, ${ch("c23", "C23")}'s capstone).`) +
        p(`<strong>Hurts when:</strong> the query contains an exact identifier — expansion dilutes <code>ERR_4471</code> into four queries of which three are generic, and RRF then promotes generic matches. Also in an interactive agent, where it adds ~900ms to <em>every</em> search and the agent could have reformulated itself for free after seeing the first result.`) +
        p(`<strong>The rule:</strong> skip expansion when the query matches an identifier pattern; skip it when the agent is allowed to re-query anyway. Use it for one-shot pipelines and for deliberately exhaustive search.`) },
    { difficulty: "stretch",
      prompt: `Build a retrieval eval set for your own corpus without hand-labelling hundreds of queries. Describe the method, and the bias it introduces.`,
      answer:
        ol([
          `<strong>Generate queries from passages.</strong> For 200 randomly sampled chunks, ask a model: "write the question a user would ask that this passage uniquely answers". The source chunk is the gold document. This gives you 200 labelled pairs in one batch job.`,
          `<strong>Filter for uniqueness.</strong> Run each generated query through the retriever; if the gold chunk is not in the top 50, inspect it — either the query is bad or you have found a real retrieval failure. Discard queries whose answer genuinely appears in several chunks.`,
          `<strong>Add real queries.</strong> Mine your logs, your support tickets, your search box. Twenty real queries are worth a hundred synthetic ones.`,
          `<strong>Add the hard classes deliberately.</strong> Hand-write ten exact-ID queries, ten negations and ten multi-hop questions. These are the classes that break, and random sampling will underrepresent them.`,
          `<strong>Report per class, never as one number.</strong> A change that lifts the mean while halving exact-ID recall is a regression you will otherwise ship.`,
        ]) +
        p(`<strong>The bias:</strong> generated queries are written <em>from</em> the passage, so they inherit its vocabulary, which is exactly the vocabulary-gap problem a real user's query has and yours does not. Synthetic evals therefore systematically overestimate retrieval quality, and they overestimate vector search most of all. That is why the hand-written hard cases and the log-mined real queries are not optional garnish; they are the part that tells the truth.`) },
  ],

  qa: [
    { q: "Is RAG dead now that context windows are huge?", a: p(`No, for three reasons that have nothing to do with the window size: corpora are far larger than any window; sending 200K tokens costs 200K tokens on every turn of an agent loop; and ${ch("c05", "C05")}'s attention effects mean stuffed context is worse than curated context at equal relevance. What <em>has</em> changed is that naive one-shot RAG is obsolete, replaced by agentic retrieval, where the loop provides the retries.`) },
    { q: "Which embedding model should I use?", a: p(`Almost any current one is fine; the gap between good embedding models is smaller than the gap between good and bad chunking. Pick one, check it handles your language and your domain jargon, and spend your effort on chunking, hybrid search and evaluation. Do budget for re-embedding the corpus when you switch — and never mix vectors from two models in one index.`) },
    { q: "How many chunks should I put in the context?", a: p(`Three to five after reranking, not twenty. More chunks means more distractors, and ${ch("c05", "C05")}'s middle region is where they land. If five good chunks do not answer the question, the answer is another search rather than more chunks, and in an agent the model can make that call itself.`) },
    { q: "Should the agent see relevance scores?", a: p(`Yes. A model given scores behaves sensibly with them: it treats a 0.31 result with suspicion and says so, rather than confidently synthesising from a weak match. It also gives it a reason to search again. Ten tokens per passage for a calibration signal is a good trade.`) },
    { q: "How do I handle a corpus that changes constantly?", a: p(`Incremental indexing keyed by content hash — re-embed only changed chunks — plus a <code>last_modified</code> field in the metadata that the search tool surfaces. Stale results are worse than no results in an agent, because the model has no way to know. If freshness is critical, make it a filter the agent can set, and say so in the tool description.`) },
  ],

  project: {
    title: "Project · A retriever you can defend",
    brief: p(`Index a corpus you actually care about — your notes, a documentation site, a repository — and expose it to your ${ch("c04", "C04")} agent as a tool. The deliverable is not the retriever; it is the eval that proves it works.`),
    spec: [
      "Structural chunking with the heading path prepended to each chunk's text.",
      "A flat vector index (brute-force cosine over pre-normalised vectors) and a BM25 index over the same chunks.",
      "Hybrid search fused with RRF, returning path, heading, score and text.",
      "A <code>search_docs</code> tool whose empty-result message names what the index covers and what to try next.",
      "An eval set of at least 60 queries — generated, log-mined, plus hand-written exact-ID, negation and multi-hop cases — reporting recall@5 and MRR <em>per class</em>.",
      "A comparison table: vector only, BM25 only, hybrid, hybrid+rerank. With numbers from your corpus, not from this page.",
    ],
    stretch: [
      "Add contextual retrieval: one model call per chunk at index time generating a situating sentence. Measure the delta on your eval set and decide whether it earns its cost.",
      "Add a metadata filter and teach the agent to use it via the tool description.",
      "Measure the agentic lift: run your eval with one-shot retrieval and then with the agent allowed three searches. Report the multi-hop row separately.",
    ],
  },

  quiz: [
    { q: "Why does vector search fail on a query like 'what is ERR_4471'?",
      options: ["Rare tokens are poorly represented in embeddings, so the vector is dominated by the generic 'error' signal", "The query is too short to embed", "Vector indexes cannot store numbers", "Cosine similarity is undefined for rare terms"],
      answer: 0,
      why: "Embeddings capture meaning, and a near-unique identifier carries little learnable meaning. BM25's IDF term does the opposite — it weights rare terms most heavily. This single failure class is the whole argument for hybrid retrieval." },
    { q: "What does Reciprocal Rank Fusion combine?",
      options: ["Ranks from multiple retrievers, avoiding the need to normalise incomparable scores", "Embedding vectors from multiple models", "Chunks from multiple documents", "Relevance scores weighted by retriever confidence"],
      answer: 0,
      why: "A cosine similarity of 0.82 and a BM25 score of 14.3 are not comparable and normalising them is a tuning nightmare. RRF sums 1/(k+rank), so only ordering matters — and a document ranked #1 by one retriever beats one ranked #12 by both." },
    { q: "Which chunking failure is most damaging, and why can no later stage fix it?",
      options: ["Splitting a self-contained fact across two chunks — recall lost at indexing time cannot be recovered by reranking", "Chunks that are slightly too large", "Chunks that overlap by too many tokens", "Using markdown headings as boundaries"],
      answer: 0,
      why: "Every stage after chunking can only re-order what chunking produced. If the fact is split so that neither half is retrievable or meaningful, the best reranker in the world has nothing to promote." },
    { q: "In an agent, what is the most important property of a search tool's empty result?",
      options: ["It says what the index covers and what to try next, so the agent can recover rather than concluding the tool is broken", "It returns an error so the loop terminates", "It returns the closest matches anyway", "It is silent, to save tokens"],
      answer: 0,
      why: "The loop is the retry strategy, but only if the failure is legible. 'No results' teaches the agent nothing; 'no passages matched X, the index covers policies and runbooks, try list_sections()' turns a dead end into a next step." },
    { q: "Where should the highest-scoring retrieved passage be placed in the request?",
      options: ["Closest to the question — the end of the request, not the start of the list", "First, matching the ranked order", "In the middle, surrounded by context", "In the system prompt"],
      answer: 0,
      why: "C05's position effect: the end of the request is a high-attention region. Most implementations render results in ranked order out of habit from search UIs, which puts the best passage furthest from the question." },
    { q: "Which query class does the agentic loop help most, and why?",
      options: ["Multi-hop — the second retrieval depends on what the first returned, which one-shot RAG cannot express", "Exact-ID, because retries eventually find the token", "Conceptual, because more phrasings are tried", "Negation, because the model rewrites the query"],
      answer: 0,
      why: "A question like 'is order 4471 refundable' needs the order's category before the right policy query can even be formed. No chunking strategy or reranker fixes that; only a loop that reads a result and searches again does." },
  ],

  continues: p(`Retrieval finds what was written down before the run started. It cannot tell you what <em>this</em> user told you last week, which approach failed on Tuesday, or that this customer always wants the invoice as a PDF. That is memory — knowledge the agent writes itself, and the hard part is not storing it. ${ch("c07", "C07")} is about deciding what deserves to be remembered.`),
};

export default chapter;
