/** Shared evidence store: exact quoted spans, addressable, checkable. */

export interface Evidence {
  id: string;
  url: string; title: string; retrievedAt: string;
  span: string;                              // the EXACT text — this is the ground truth
  trust: "primary" | "secondary" | "unknown";
}

export interface Finding {
  id: string;
  subQuestion: string;
  claim: string;                             // one falsifiable sentence
  evidenceIds: string[];                     // ≥1, or this is not a finding
  confidence: number;
}

export type Grounding =
  | { kind: "verbatim"; evidenceId: string }
  | { kind: "paraphrase"; evidenceId: string; overlap: number }
  | { kind: "numeric_mismatch"; claimed: string; found: string[] }
  | { kind: "none" };

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").replace(/\s+/g, " ").trim();

const shingle = (t: string, k: number): Set<string> => {
  const w = normalise(t).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(" "));
  return out;
};

const overlap = (a: Set<string>, b: Set<string>): number => {
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
};

/** Numbers written any of the ways a model writes them. */
const numbersIn = (t: string): string[] =>
  (t.match(/\b\d[\d,._]*\s*(?:million|billion|m|bn|b|k|gb|mb|tb|days?|hours?)?\b/gi) ?? [])
    .map((x) => x.trim().toLowerCase().replace(/[,_]/g, ""));

const canonicalNumber = (raw: string): number | null => {
  const m = /^([\d.]+)\s*(million|billion|m|bn|b|k)?/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  const mult = { million: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, k: 1e3 }[m[2] ?? ""] ?? 1;
  return n * mult;
};

/**
 * Two figures only conflict if they measure the SAME THING. Comparing every number
 * to every other number means a shared "768 dimensions" masks a real disagreement
 * about memory — which is how a conflict detector silently does nothing.
 */
type Quantity = { unit: string; value: number };

const quantitiesIn = (t: string): Quantity[] => {
  const out: Quantity[] = [];
  const re = /\b([\d.,_]+)\s*(million|billion|bn|k|gb|mb|tb|dimensional|dimensions|days?|hours?|queries per second|qps)?\b/gi;
  for (const m of t.matchAll(re)) {
    const value = canonicalNumber(`${m[1].replace(/[,_]/g, "")} ${m[2] ?? ""}`.trim());
    if (value === null) continue;
    const raw = (m[2] ?? "").toLowerCase();
    const unit =
      /^(gb|mb|tb)$/.test(raw) ? "memory"
      : /^(million|billion|bn|k)$/.test(raw) ? "count"
      : /^(dimensional|dimensions)$/.test(raw) ? "dimensions"
      : /^(queries per second|qps)$/.test(raw) ? "throughput"
      : /^(days?|hours?)$/.test(raw) ? "duration"
      : "bare";
    out.push({ unit, value: unit === "memory" && raw === "mb" ? value / 1024 : unit === "memory" && raw === "tb" ? value * 1024 : value });
  }
  return out;
};

export class EvidenceStore {
  private items = new Map<string, Evidence>();
  private n = 0;

  record(e: Omit<Evidence, "id">): Evidence {
    const item: Evidence = { ...e, id: `e${++this.n}` };
    this.items.set(item.id, item);
    return item;
  }
  get(id: string): Evidence | undefined { return this.items.get(id); }
  all(): Evidence[] { return [...this.items.values()]; }

  /**
   * Mechanical grounding. Numbers first: a fabricated figure beside a genuine
   * citation is the failure that destroys trust, and it is trivially checkable.
   */
  ground(f: Finding): Grounding {
    const spans = f.evidenceIds.map((id) => this.get(id)).filter((x): x is Evidence => !!x);
    if (!spans.length) return { kind: "none" };
    const corpus = spans.map((s) => normalise(s.span)).join(" ");
    const corpusNums = spans.flatMap((s) => numbersIn(s.span)).map(canonicalNumber).filter((x): x is number => x !== null);

    for (const raw of numbersIn(f.claim)) {
      const v = canonicalNumber(raw);
      if (v === null) continue;
      if (!corpusNums.some((c) => Math.abs(c - v) / Math.max(c, v, 1) < 0.02)) {
        return { kind: "numeric_mismatch", claimed: raw, found: spans.flatMap((s) => numbersIn(s.span)) };
      }
    }

    for (const q of f.claim.match(/"([^"]{8,})"/g) ?? []) {
      if (!corpus.includes(normalise(q.slice(1, -1)))) return { kind: "none" };
    }

    if (spans.some((s) => normalise(s.span).includes(normalise(f.claim)))) {
      return { kind: "verbatim", evidenceId: spans[0].id };
    }
    const grams = shingle(f.claim, 4);
    let bestId = spans[0].id, best = 0;
    for (const s of spans) {
      const o = overlap(grams, shingle(s.span, 4));
      if (o > best) { best = o; bestId = s.id; }
    }
    return best >= 0.3 ? { kind: "paraphrase", evidenceId: bestId, overlap: best } : { kind: "none" };
  }
}

/* ---------------- conflicts ---------------- */

export interface Conflict { subject: string; sides: Array<{ finding: Finding; evidence: Evidence }>; preferred: string | null; why: string }

const TRUST_RANK = { primary: 2, secondary: 1, unknown: 0 };

export function findConflicts(findings: Finding[], store: EvidenceStore): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = findings[i], b = findings[j];
      if (a.subQuestion !== b.subQuestion) continue;
      const qa = quantitiesIn(a.claim), qb = quantitiesIn(b.claim);
      // Compare only quantities of the same kind, and only kinds both claims state.
      const shared = [...new Set(qa.map((q) => q.unit))].filter((u) => u !== "bare" && qb.some((q) => q.unit === u));
      if (!shared.length) continue;
      const disagree = shared.some((u) => {
        const xs = qa.filter((q) => q.unit === u).map((q) => q.value);
        const ys = qb.filter((q) => q.unit === u).map((q) => q.value);
        return xs.every((x) => ys.every((y) => Math.abs(x - y) / Math.max(x, y, 1) > 0.15));
      });
      if (!disagree) continue;

      const ea = store.get(a.evidenceIds[0])!, eb = store.get(b.evidenceIds[0])!;
      // Resolve by SOURCE QUALITY, never by averaging.
      let preferred: string | null = null, why = "both sources are equally strong — escalate rather than choose";
      if (TRUST_RANK[ea.trust] !== TRUST_RANK[eb.trust]) {
        const win = TRUST_RANK[ea.trust] > TRUST_RANK[eb.trust] ? ea : eb;
        preferred = win.id; why = `${win.trust} source preferred over ${(win === ea ? eb : ea).trust}`;
      } else if (ea.retrievedAt !== eb.retrievedAt) {
        const win = ea.retrievedAt > eb.retrievedAt ? ea : eb;
        preferred = win.id; why = `more recent (${win.retrievedAt})`;
      }
      out.push({ subject: a.subQuestion, sides: [{ finding: a, evidence: ea }, { finding: b, evidence: eb }], preferred, why });
    }
  }
  return out;
}
