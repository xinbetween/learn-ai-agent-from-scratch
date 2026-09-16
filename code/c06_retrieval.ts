/**
 * C06 · Retrieval — structural chunking, a flat vector index, BM25, and RRF.
 *   node --experimental-strip-types code/c06_retrieval.ts
 */

export interface Chunk { id: string; text: string; path: string; headings: string[] }

/* ---------------- chunking: split on seams, carry the heading path ---------------- */

export function chunkMarkdown(doc: string, path: string, maxTokens = 220): Chunk[] {
  const out: Chunk[] = [];
  let headings: string[] = [];
  let buf: string[] = [];
  let n = 0;

  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (!text) return;
    // The heading path prepended IS the cheap version of contextual retrieval.
    out.push({ id: `${path}#${n++}`, path, headings: [...headings],
               text: `${path} — ${headings.join(" > ")}\n\n${text}` });
  };

  for (const line of doc.split("\n")) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); headings = [...headings.slice(0, h[1].length - 1), h[2]]; continue; }
    buf.push(line);
    if (est(buf.join("\n")) > maxTokens) {
      const parts = splitRecursive(buf.join("\n"), maxTokens, ["\n\n", "\n", ". ", " "]);
      for (const part of parts.slice(0, -1)) { buf = [part]; flush(); }
      buf = [parts.at(-1)!];
    }
  }
  flush();
  return out;
}

const est = (s: string) => Math.ceil(s.length / 3.7);

function splitRecursive(text: string, maxTokens: number, seps: string[]): string[] {
  if (est(text) <= maxTokens || !seps.length) return [text];
  const [sep, ...rest] = seps;
  const parts = text.split(sep);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    const next = cur ? cur + sep + p : p;
    if (est(next) > maxTokens && cur) { out.push(...splitRecursive(cur, maxTokens, rest)); cur = p; }
    else cur = next;
  }
  if (cur) out.push(...splitRecursive(cur, maxTokens, rest));
  return out;
}

/* ---------------- embeddings ---------------- */

/**
 * A deterministic hashing embedder, so the course runs offline. It captures
 * lexical co-occurrence rather than meaning — which is exactly the property that
 * makes the vector-vs-BM25 comparison below honest rather than rigged.
 */
export function embed(text: string, dim = 256): Float32Array {
  const v = new Float32Array(dim);
  const words = tokenize(text);
  for (let i = 0; i < words.length; i++) {
    for (const gram of [words[i], words.slice(i, i + 2).join(" ")]) {
      if (!gram) continue;
      let h = 2166136261;
      for (let c = 0; c < gram.length; c++) { h ^= gram.charCodeAt(c); h = Math.imul(h, 16777619); }
      v[Math.abs(h) % dim] += 1;
    }
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

export const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9_]+/g, " ").split(" ").filter(Boolean);

/* ---------------- flat vector index ---------------- */

export class FlatIndex {
  private vectors: Float32Array[] = [];
  private ids: string[] = [];
  add(id: string, text: string): void { this.ids.push(id); this.vectors.push(embed(text)); }
  search(query: string, k: number): string[] {
    const q = embed(query);
    return this.vectors
      .map((v, i) => { let d = 0; for (let j = 0; j < v.length; j++) d += v[j] * q[j]; return [this.ids[i], d] as const; })
      .filter(([, d]) => d > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id);
  }
}

/* ---------------- BM25 ---------------- */

export class BM25 {
  private df = new Map<string, number>();
  private docs: Array<{ id: string; tf: Map<string, number>; len: number }> = [];
  private totalLen = 0;

  add(id: string, text: string): void {
    const terms = tokenize(text);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.docs.push({ id, tf, len: terms.length });
    this.totalLen += terms.length;
  }

  search(query: string, k: number, k1 = 1.5, b = 0.75): string[] {
    const avg = this.totalLen / Math.max(this.docs.length, 1);
    const terms = tokenize(query);
    const N = this.docs.length;
    return this.docs.map((d) => {
      let s = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        // IDF: rare terms dominate. This is why BM25 finds ERR_4471 and vectors do not.
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / avg)));
      }
      return [d.id, s] as const;
    }).filter(([, s]) => s > 0).sort((a, b2) => b2[1] - a[1]).slice(0, k).map(([id]) => id);
  }
}

/* ---------------- fusion ---------------- */

/** Ranks, not scores — so incomparable scales never have to be normalised. */
export function rrf(rankings: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  for (const r of rankings) r.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/* ---------------- corpus + eval ---------------- */

const DOCS: Record<string, string> = {
  "policies/returns.md": `# Returns Policy
## Standard window
Customers may return most items within 30 days of delivery for a full refund.
## Electronics
Electronics must be returned within 14 days of delivery. This window does not apply
when a fault has been reported through support, in which case the warranty terms govern.
## Exclusions
Perishable goods and personalised items cannot be returned.`,

  "policies/shipping.md": `# Shipping Policy
## Delivery estimates
Standard delivery is 3-5 working days. Express delivery is next working day.
## Unshipped orders
Orders that have not yet been dispatched can be cancelled from the account page.
Orders already in transit cannot be cancelled and must be returned after delivery.`,

  "runbooks/errors.md": `# Error reference
## ERR_4471
ERR_4471 is raised when the session store rejects a write because the entry has expired.
Resolution: clear the session cookie and re-authenticate. Escalate if it recurs.
## ERR_2203
ERR_2203 indicates a downstream timeout from the carrier tracking API.`,

  "runbooks/refunds.md": `# Refund runbook
## Issuing a refund
Refunds are issued to the original payment method and take 5-10 working days.
## Partial refunds
Partial refunds require a supervisor approval code.`,
};

interface Query { q: string; gold: string; cls: string }
const QUERIES: Query[] = [
  { q: "what does error ERR_4471 mean", gold: "runbooks/errors.md", cls: "exact ID" },
  { q: "ERR_2203", gold: "runbooks/errors.md", cls: "exact ID" },
  { q: "how do refunds work", gold: "policies/returns.md", cls: "conceptual" },
  { q: "can I send something back after a month", gold: "policies/returns.md", cls: "conceptual" },
  { q: "how long does money take to come back", gold: "runbooks/refunds.md", cls: "conceptual" },
  { q: "orders not yet shipped", gold: "policies/shipping.md", cls: "negation" },
  { q: "items that cannot be returned", gold: "policies/returns.md", cls: "negation" },
  { q: "is a faulty television returnable after 20 days", gold: "policies/returns.md", cls: "multi-hop" },
];

function main(): void {
  console.log("\n  C06 · Retrieval\n");

  const chunks: Chunk[] = [];
  for (const [path, doc] of Object.entries(DOCS)) chunks.push(...chunkMarkdown(doc, path));
  console.log(`  indexed ${Object.keys(DOCS).length} documents → ${chunks.length} chunks (structural, heading-prefixed)\n`);

  const vec = new FlatIndex(), bm = new BM25();
  for (const c of chunks) { vec.add(c.id, c.text); bm.add(c.id, c.text); }
  const pathOf = (id: string) => chunks.find((c) => c.id === id)?.path ?? "";

  const retrievers: Array<[string, (q: string, k: number) => string[]]> = [
    ["vector only", (q, k) => vec.search(q, k)],
    ["bm25 only", (q, k) => bm.search(q, k)],
    ["hybrid (RRF)", (q, k) => rrf([vec.search(q, 20), bm.search(q, 20)]).slice(0, k)],
  ];

  // With only 9 chunks, recall@5 retrieves more than half the corpus and every
  // retriever scores 100%. recall@1 and MRR are what discriminate at this scale —
  // a reminder that an eval metric has to be chosen against the corpus you have.
  const classes = [...new Set(QUERIES.map((q) => q.cls))];
  console.log(`  recall@1 by query class  (9 chunks — recall@5 is saturated and tells you nothing)\n`);
  console.log(`  ${"retriever".padEnd(15)} ${"overall".padStart(8)} ${"MRR".padStart(6)} ${classes.map((c) => c.padStart(12)).join("")}`);
  for (const [name, search] of retrievers) {
    const top1 = (q: Query) => pathOf(search(q.q, 1)[0] ?? "") === q.gold;
    const rr = (q: Query) => {
      const at = search(q.q, 5).map(pathOf).indexOf(q.gold);
      return at === -1 ? 0 : 1 / (at + 1);
    };
    const overall = QUERIES.filter(top1).length / QUERIES.length;
    const mrr = QUERIES.reduce((t, q) => t + rr(q), 0) / QUERIES.length;
    const per = classes.map((c) => {
      const qs = QUERIES.filter((q) => q.cls === c);
      return (Math.round((qs.filter(top1).length / qs.length) * 100) + "%").padStart(12);
    });
    console.log(`  ${name.padEnd(15)} ${(Math.round(overall * 100) + "%").padStart(8)} ${mrr.toFixed(2).padStart(6)} ${per.join("")}`);
  }

  console.log(`\n  Read that table with a caveat: the offline embedder here is a hashing`);
  console.log(`  function over word bigrams, so it captures lexical overlap rather than`);
  console.log(`  meaning. A real embedding model would score far higher on the conceptual`);
  console.log(`  column and no higher on exact IDs — which is the shape the chapter claims,`);
  console.log(`  and which you should verify on your own corpus rather than take from here.`);

  console.log(`\n  the row that explains hybrid: vector search on an exact identifier\n`);
  for (const q of QUERIES.filter((x) => x.cls === "exact ID")) {
    const v = vec.search(q.q, 1).map(pathOf)[0] ?? "(nothing)";
    const b = bm.search(q.q, 1).map(pathOf)[0] ?? "(nothing)";
    console.log(`    "${q.q}"`);
    console.log(`      vector → ${v.padEnd(24)} ${v === q.gold ? "✓" : "✗"}`);
    console.log(`      bm25   → ${b.padEnd(24)} ${b === q.gold ? "✓" : "✗"}   (IDF weights a near-unique token heavily)`);
  }

  console.log(`\n  what the search tool returns when nothing matches:\n`);
  console.log(`    No passages matched "quantum teleportation refunds". The index covers`);
  console.log(`    returns, shipping and error runbooks. Try broader terms, or call list_sections().`);
  console.log(`\n  An empty result is not an error — and saying what the index covers is what`);
  console.log(`  lets the agent recover instead of concluding the tool is broken.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
