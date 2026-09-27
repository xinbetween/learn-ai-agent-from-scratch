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
| `c08_memory.ts` | C08 | Extraction, contradiction resolution, decay over 180 days |
| `c09_durability.ts` | C09 | Event sourcing, replay, the duplicate-vs-silent-loss matrix |
| `c10_planning.ts` | C10 | Patch-only plan revision, evidence-backed completion, waves |
| `c11_reflection.ts` | C11 | The verification ladder measured; grounding; critic termination |
| `c12_control_flow.ts` | C12 | Five composition primitives; the cost of all-agent architecture |
| `c13_failure.ts` | C13 | Four-layer classification, circuit breaker, tool budgets |
| `c14_sandbox.ts` | C14 | Worker sandbox vs eight hostile payloads, plus real work |
| `c16_apply_patch.ts` | C16 | The patch format: parser, matching ladder, atomicity |
| `c17_mcp.ts` | C17 | JSON-RPC framing, client/server, tool poisoning, schema pinning |
| `c19_approvals.ts` | C19 | Two axes, scoped grants, durable suspension, fatigue arithmetic |
| `c20_multi_agent.ts` | C20 | Orchestrator with nested ledgers; topology vs task shape |
| `c21_runtime.ts` | C21 | `AgentId`, `TopicId`, subscriptions, mailboxes, eviction |
| `c22_evals.ts` | C22 | Wilson intervals, McNemar, per-tag gating, power |
| `c23_tracing.ts` | C23 | Spans via `AsyncLocalStorage`, waterfall, caused-token blame |
| `c24_security.ts` | C24 | Trifecta guard, sanitiser, red team: structural vs probabilistic |
| `c26_serving.ts` | C26 | Resumable SSE, leases and fencing, capacity, a chaos test |
| `c27_research/` | C27 | **Capstone I** — plan, parallel subagents, grounding, report |
| `c28_coder/` | C28 | **Capstone II** — orient, patch, test, repair, with guards |

Read them in order the first time. `c01_model_call.ts` defines the types the
others import; `c04_agent_loop.ts` is the file the whole course modifies.
