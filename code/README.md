# Runnable course code

One file per chapter. Each runs standalone, offline, with no API key:

```bash
node --experimental-strip-types code/c04_agent_loop.ts    # Node 22.6–22.17
node code/c04_agent_loop.ts                               # Node 22.18+
```

`npm run check:code` executes every file and fails if any does not run.

| File | Chapter | What it demonstrates |
| --- | --- | --- |
| `c00_agency_dial.ts` | C00 | Five dial positions measured on one task; a working four-line loop |
| `c01_model_call.ts` | C01 | The `Model` type, live + mock clients, retries, the usage ledger |
| `c02_structured_output.ts` | C02 | Schema library, the repair ladder, compounding parse failure |
| `c03_tools.ts` | C03 | Registry where nothing throws; parallel reads; truncation |
| `c04_agent_loop.ts` | C04 | **The agent.** Budget, repeat detection, degradation |
| `c05_context.ts` | C05 | Four strategies over 40 turns; offloading; region assembly |
| `c06_retrieval.ts` | C06 | Structural chunking, flat index, BM25, RRF, per-class recall |
| `c07_memory.ts` | C07 | Extraction, contradiction resolution, decay over 180 days |
| `c08_durability.ts` | C08 | Event sourcing, replay, the duplicate-vs-silent-loss matrix |
| `c09_planning.ts` | C09 | Patch-only plan revision, evidence-backed completion, waves |
| `c10_reflection.ts` | C10 | The verification ladder measured; grounding; critic termination |
| `c11_control_flow.ts` | C11 | Five composition primitives; the cost of all-agent architecture |
| `c12_failure.ts` | C12 | Four-layer classification, circuit breaker, tool budgets |
| `c13_sandbox.ts` | C13 | Worker sandbox vs eight hostile payloads, plus real work |
| `c14_apply_patch.ts` | C14 | The patch format: parser, matching ladder, atomicity |
| `c15_mcp.ts` | C15 | JSON-RPC framing, client/server, tool poisoning, schema pinning |
| `c16_approvals.ts` | C16 | Two axes, scoped grants, durable suspension, fatigue arithmetic |
| `c17_multi_agent.ts` | C17 | Orchestrator with nested ledgers; topology vs task shape |
| `c18_runtime.ts` | C18 | `AgentId`, `TopicId`, subscriptions, mailboxes, eviction |
| `c19_evals.ts` | C19 | Wilson intervals, McNemar, per-tag gating, power |
| `c20_tracing.ts` | C20 | Spans via `AsyncLocalStorage`, waterfall, caused-token blame |
| `c21_security.ts` | C21 | Trifecta guard, sanitiser, red team: structural vs probabilistic |
| `c22_serving.ts` | C22 | Resumable SSE, leases and fencing, capacity, a chaos test |
| `c23_research/` | C23 | **Capstone I** — plan, parallel subagents, grounding, report |
| `c24_coder/` | C24 | **Capstone II** — orient, patch, test, repair, with guards |

Read them in order the first time. `c01_model_call.ts` defines the types the
others import; `c04_agent_loop.ts` is the file the whole course modifies.
