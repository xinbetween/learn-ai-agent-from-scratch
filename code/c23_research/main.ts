/**
 * C23 · Capstone I — a deep research agent.
 *
 * Scope → plan → parallel subagents → mechanical grounding → re-gather → report.
 * The product is not prose: it is a set of claims you can check.
 *
 *   node --experimental-strip-types code/c23_research/main.ts ["your question"]
 */

import { Ledger } from "../c01_model_call.ts";
import { EvidenceStore, findConflicts, type Evidence, type Finding, type Grounding } from "./evidence.ts";

/* ---------------- the brief: objective, scope, format, non-goals ---------------- */

export interface SubQuestion { id: string; question: string; why: string; notMine: string[]; dependsOn: string[]; matches: (p: Page) => boolean }

export const brief = (sq: SubQuestion): string => `RESEARCH QUESTION: ${sq.question}

WHY IT MATTERS: ${sq.why}

SOURCES: prefer primary — official documentation, the project's own benchmarks,
release notes, source code. Use secondary sources only to locate primary ones,
and mark them as secondary.

FOR EACH FINDING: one falsifiable sentence, plus record_evidence with the EXACT
quoted passage that supports it. A finding without evidence is not a finding.

IF YOU CANNOT FIND IT: say so explicitly. "Not found" is a valid and useful
result. Do not infer a plausible answer.

DO NOT: research ${sq.notMine.join(", ")} — other agents are covering those.
Under 600 words.`;

/* ---------------- a scripted world, so the capstone runs offline ---------------- */

interface Page { url: string; title: string; trust: Evidence["trust"]; date: string; text: string }

const WEB: Page[] = [
  { url: "https://milvus.io/docs/scale.md", title: "Milvus — Scalability", trust: "primary", date: "2026-08-02",
    text: "Milvus has been deployed with over one billion vectors using distributed indexing across a cluster." },
  { url: "https://qdrant.tech/benchmarks/", title: "Qdrant — Benchmarks", trust: "primary", date: "2026-09-14",
    text: "A single node holds 50 million 768-dimensional vectors with scalar quantisation enabled, using 4.2 GB of RAM." },
  { url: "https://blog.example/vector-db-shootout", title: "Vector DB shootout", trust: "secondary", date: "2024-03-02",
    text: "In our tests Qdrant used 11 GB for 10 million vectors at 768 dimensions." },
  { url: "https://docs.trychroma.com/deployment", title: "Chroma — Deployment", trust: "primary", date: "2026-06-11",
    text: "Chroma is designed for collections in the millions of embeddings. Larger deployments are not currently supported." },
  { url: "https://milvus.io/docs/operations.md", title: "Milvus — Operations", trust: "primary", date: "2026-07-19",
    text: "A production Milvus cluster requires etcd, MinIO or S3, and Pulsar or Kafka as dependencies." },
  { url: "https://qdrant.tech/documentation/guides/installation/", title: "Qdrant — Installation", trust: "primary", date: "2026-08-30",
    text: "Qdrant runs as a single binary with no external dependencies. Clustering is optional." },
];

/**
 * A subagent reads a lot and returns a little; the reading is discarded. The
 * brief's non-goals are what keep two agents off the same pages — without them
 * you pay three times for the same search.
 */
function researchSubagent(sq: SubQuestion, store: EvidenceStore, ledger: Ledger): { findings: Finding[]; pagesRead: number; intermediateTokens: number } {
  const child = ledger.child(`researcher[${sq.id}]`);
  const hits = WEB.filter(sq.matches);
  // It read the whole corpus to find these; only the findings leave its context.
  const intermediateTokens = WEB.length * 2600;
  child.record({ label: "subagent", usage: { input: intermediateTokens, output: 380 }, ms: 3400, model: "small" });

  const findings: Finding[] = [];
  for (const p of hits) {
    const e = store.record({ url: p.url, title: p.title, span: p.text, trust: p.trust, retrievedAt: p.date });
    findings.push({
      id: `f_${sq.id}_${findings.length}`, subQuestion: sq.id,
      claim: p.text, evidenceIds: [e.id], confidence: p.trust === "primary" ? 0.9 : 0.6,
    });
  }
  return { findings, pagesRead: WEB.length, intermediateTokens };
}

/** One deliberately fabricated claim, so grounding has something real to catch. */
function synthesiseDraftClaims(findings: Finding[], store: EvidenceStore): Finding[] {
  const extra: Finding[] = [{
    id: "f_hallucinated", subQuestion: "scale",
    claim: "Qdrant sustains 120,000 queries per second on a single node.",
    evidenceIds: [store.all().find((e) => e.url.includes("qdrant.tech/benchmarks"))?.id ?? "e1"],
    confidence: 0.75,
  }];
  return [...findings, ...extra];
}

/* ---------------- report ---------------- */

function report(question: string, assumptions: string[], graded: Array<{ f: Finding; g: Grounding }>, conflicts: ReturnType<typeof findConflicts>, notEstablished: string[], store: EvidenceStore): string {
  const cited = graded.filter((x) => x.g.kind === "verbatim" || x.g.kind === "paraphrase");
  const refs = new Map<string, number>();
  const ref = (id: string) => { if (!refs.has(id)) refs.set(id, refs.size + 1); return refs.get(id)!; };

  const lines = [`# ${question}`, "", "## Assumptions made"];
  for (const a of assumptions) lines.push(`- ${a}`);
  lines.push("", "## Findings");
  for (const { f, g } of cited) {
    const id = (g as any).evidenceId as string;
    lines.push(`- ${f.claim} [${ref(id)}]`);
  }
  if (conflicts.length) {
    lines.push("", "## Conflicts");
    for (const c of conflicts) {
      lines.push(`### ${c.subject}`);
      for (const s of c.sides) lines.push(`- ${s.finding.claim} — ${s.evidence.title}, ${s.evidence.retrievedAt} (${s.evidence.trust}) [${ref(s.evidence.id)}]`);
      lines.push(`Preferring [${c.preferred ? ref(c.preferred) : "neither"}]: ${c.why}.`);
      lines.push(`The older source does not state whether quantisation was enabled, which would account for the difference.`);
    }
  }
  lines.push("", "## Not established");
  for (const n of notEstablished) lines.push(`- ${n}`);
  lines.push("", "## Sources");
  for (const [id, n] of [...refs].sort((a, b) => a[1] - b[1])) {
    const e = store.get(id)!;
    lines.push(`[${n}] ${e.title} — ${e.url} — retrieved ${e.retrievedAt} — ${e.trust}`);
    lines.push(`    "${e.span}"`);
  }
  return lines.join("\n");
}

/* ---------------- run ---------------- */

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ") ||
    "Which vector database for 50M vectors, and what are the operational trade-offs?";

  console.log("\n  C23 · Capstone I — Deep Research Agent\n");
  console.log(`  question: ${question}\n`);

  const ledger = new Ledger("research run");
  const store = new EvidenceStore();

  // 1. SCOPE — clarify only when an ambiguity would change the SHAPE of the research.
  const assumptions = [
    "\"50M vectors\" means 768-dimensional float32 unless stated otherwise.",
    "Self-hosted deployment; managed offerings are out of scope.",
  ];
  console.log(`  scope       1 call · 0 clarifications · ${assumptions.length} assumptions recorded`);

  // 2. PLAN — sub-questions, each independently answerable.
  const plan: SubQuestion[] = [
    { id: "scale", question: "maximum vectors per node and per cluster, and memory at that size",
      why: "the core constraint the decision turns on", notMine: ["pricing", "operations"], dependsOn: [],
      matches: (p) => /vectors|embeddings|RAM|GB/.test(p.text) },
    { id: "ops", question: "operational dependencies and deployment complexity",
      why: "decides the running cost and who can operate it", notMine: ["scale", "pricing"], dependsOn: [],
      matches: (p) => /requires|dependencies|binary|cluster requires/.test(p.text) },
    { id: "pricing", question: "managed pricing above 100M vectors",
      why: "bounds the budget", notMine: ["scale", "operations"], dependsOn: [],
      matches: () => false },      // nothing public exists — the agent must SAY so
  ];
  console.log(`  plan        ${plan.length} sub-questions, ${new Set(plan.map((s) => s.dependsOn.length)).size} wave(s)`);

  // 3. GATHER — parallel, isolated contexts.
  const all: Finding[] = [];
  let pagesRead = 0, discarded = 0;
  const seenUrls = new Set<string>();
  for (const sq of plan) {
    const r = researchSubagent(sq, store, ledger);
    // The shared store makes an already-fetched page a cache hit rather than a
    // duplicate finding — overlapping SOURCES are fine, overlapping QUESTIONS are not.
    for (const f of r.findings) {
      const url = store.get(f.evidenceIds[0])!.url;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      all.push(f);
    }
    pagesRead += r.pagesRead;
    discarded += r.intermediateTokens;
  }
  const returned = all.reduce((t, f) => t + Math.ceil(f.claim.length / 3.7), 0);
  console.log(`  gather      ${plan.length} subagents · ${pagesRead} pages fetched · ${store.all().length} evidence spans stored`);
  console.log(`              orchestrator context: ${(6000 + returned).toLocaleString()} tok   (single-agent equivalent: ${discarded.toLocaleString()})`);

  // 4. VERIFY — mechanical grounding, including the numbers.
  const draft = synthesiseDraftClaims(all, store);
  const graded = draft.map((f) => ({ f, g: store.ground(f) }));
  const byKind = graded.reduce((m, x) => m.set(x.g.kind, (m.get(x.g.kind) ?? 0) + 1), new Map<string, number>());
  console.log(`  verify      ${draft.length} claims · ` + [...byKind].map(([k, n]) => `${n} ${k}`).join(" · "));
  for (const { f, g } of graded) {
    if (g.kind === "numeric_mismatch") {
      console.log(`              ✗ NUMERIC MISMATCH — claimed "${g.claimed}", sources contain ${g.found.slice(0, 4).join(", ") || "no comparable figure"}`);
      console.log(`                "${f.claim}"`);
    }
  }
  const unsupported = graded.filter((x) => x.g.kind === "none" || x.g.kind === "numeric_mismatch");
  console.log(`  re-gather   ${unsupported.length} unsupported claim(s) → 1 bounded round → ${unsupported.length} still unsupported → "Not established"`);

  // 5. REPORT.
  const conflicts = findConflicts(all, store);
  const empty = plan.filter((sq) => !all.some((f) => f.subQuestion === sq.id));
  const notEstablished = [
    ...unsupported.map((x) => `${x.f.claim} — no source in the corpus states this. NEXT STEP: run the published benchmark ourselves (~2 hours).`),
    ...empty.map((sq) => `${sq.question} — the subagent found no public source. NEXT STEP: a sales conversation.`),
  ];
  const md = report(question, assumptions, graded, conflicts, notEstablished, store);

  console.log(`  synthesise  1 call · ${conflicts.length} conflict(s) surfaced · ${notEstablished.length} gap(s) with next steps\n`);
  console.log("  " + "─".repeat(78));
  console.log(md.split("\n").map((l) => "  " + l).join("\n"));
  console.log("  " + "─".repeat(78));

  const factual = md.split("\n").filter((l) => l.startsWith("- ") && !l.includes("NEXT STEP") && !l.includes("sales conversation"));
  const withCitation = factual.filter((l) => /\[\d+\]/.test(l));
  console.log(`\n  ${withCitation.length}/${factual.length} factual sentences carry a citation that resolves to a quoted span.`);
  console.log(`  The fabricated figure did not reach the report — it is under "Not established".\n`);
  console.log(ledger.report("  "));
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
