# Deliverable index

Status reflects evidence available in the repository. “Experimental” is not promoted to validated merely because an adapter exists.

| # | Required deliverable | Status | Exact evidence |
|---:|---|---|---|
| 1 | Forensic audit | Complete | `round-0-forensic-audit.md`, `artifacts/baseline/live-baseline.json` |
| 2 | Live baseline screenshots and traces | Complete | `artifacts/baseline/live-capture/` manifest, three destination screenshots, trace, video and Playwright result from run `31202076015` |
| 3 | Capability truth ledger | Complete | `capability_truth_ledger.json` |
| 4 | Competitor capability matrix | Complete | `competitor-capability-matrix.md`, primary links only |
| 5 | Current-claim audit | Complete | `claim_registry.json`, corrected `messages/*.json`, `tab1-overview.tsx` |
| 6 | Model and adapter inventory | Complete | `model-and-adapter-inventory.md`, `src/lib/models/registry.ts` |
| 7 | Use-case evidence contracts | Complete | `use-case-evidence-contracts.json`, negative-control tests |
| 8 | Corrected action state machine | Complete | `src/lib/action-orchestrator.ts` |
| 9 | Static capability profiles | Complete | `src/lib/deployment.ts`, `incident-state-machine.ts` |
| 10 | Reproducible test scripts | Complete | exact scripts in `package.json`, locked dependencies |
| 11 | Complete Playwright suite | Complete: 68 passed, 2 standards-based skips | `playwright.config.ts`, `tests/e2e`, CI run `31201270165` |
| 12 | Semantic multi-video search | Experimental | `evidence-workspace.tsx`, `vlm-embeddings.ts`, `evidence.ts` |
| 13 | Browser index | Validated prototype | `idb.ts`, reopen/purge test |
| 14 | Reference-image search | Experimental | visible reference input and pinned CLIP adapter |
| 15 | Candidate association review | Experimental proposal + validated review controls | `association.ts`, visible confirm/reject test |
| 16 | Safe absence workflow | Complete deterministic contract | exact wording/coverage unit and visible tests |
| 17 | Calibrated model-fusion policy | Corrected: uncalibrated experimental fusion | `association.ts`; calibration is prohibited until held-out benchmark |
| 18 | Model cards | Complete | `model-cards.md` |
| 19 | Dataset cards | Complete | `dataset-cards.md` |
| 20 | Action policy registry | Complete | `action-policy-registry.json` |
| 21 | Approval workflow | Complete locally; external service unavailable | orchestrator and approval/rejection test |
| 22 | Evidence export | Validated prototype | `createEvidenceExport`, sample artifact |
| 23 | Privacy and retention controls | Complete as bounded browser controls | privacy report, query tests, IndexedDB purge |
| 24 | Accessibility report | Complete automated gate; manual AT audit remains a recorded risk | privacy/security/accessibility/performance report, axe tests, CI run `31201270165` |
| 25 | Security report | Complete with open risks | same report, action contracts, risk registry |
| 26 | Performance report | Complete without unsupported metrics | same report, benchmark JSON |
| 27 | Benchmark reports | Honest incomplete benchmark | null metrics in benchmark JSON; no fabricated promotion |
| 28 | Deployment evidence | Complete | `deployment_verification.json`, `artifacts/deployment/deployment-evidence.json`, run `31203666357` |
| 29 | Live-site retest | Complete | successful post-deploy Playwright job in run `31203666357`; independent GET/POST route probes in deployment evidence |
| 30 | Phase retrospectives | Complete | `phase-retrospectives.md` |
| 31 | Remaining-risk registry | Complete | `remaining-risk-registry.json` |
