# Vision Agent Perú evidence-search rebuild report

## Executive result

The rebuilt product is a local-first, review-oriented evidence prototype. It no longer represents color/geometry as identity, no longer lets a person count trigger unrelated hazard alerts, no longer treats count variation as frame differencing, no longer runs judge/report/escalation concurrently, and no longer treats missing GitHub Pages APIs as success. Model-dependent search and association remain explicitly experimental because no held-out browser benchmark justifies accuracy, calibration, throughput, or false-positive-reduction claims.

## Status by functionality

### Validated functionality

- Independent Overview, Strategic Brief, Live Prototype, and Evidence Workspace destinations; the restored prototype retains its camera/use-case/model controls, metrics, trace, alerts, local tracks, actions, reports, evidence, natural-language search, and incident-state panels.
- Static capability detection, no production test hook, selected runtime adapters only, zero-valued rank preservation.
- Deterministic action allowlists, sequential judge gate, malformed/inconclusive handling, approval rejection, idempotency, circuit breaker, bounded retry/compensation, and outcome verification.
- False-positive verdict suppression: the executor is never called after the verdict; proven in contract and visible-control tests.
- Person-only negative controls for fire, flood, graffiti, landslide, slip, and post-quake.
- Actual pixel temporal difference and parking threshold-zero telemetry behavior.
- IndexedDB schema/reopen/purge behavior, structured query privacy rejection, open-set rejection, safe absence wording and coverage fields.
- Local deterministic evidence export with SHA-256 generation and non-immutable disclaimer.

### Experimental functionality

- Immutable-revision YOLOS-tiny browser detection.
- Restored live-camera prototype execution using the same pinned YOLOS-tiny adapter; its device/domain performance remains experimental.
- ByteTrack-compatible two-stage within-video tracking.
- CLIP natural-language/reference retrieval.
- Cross-video appearance/topology/time candidate fusion.
- Model-dependent thresholds, recall, open-set quality, latency, and throughput.

### Simulated functionality

- Repository fixture loading for visible search/near-miss/timeline/review demonstrations.
- The false-positive UI proof. Both paths are labeled simulation in records and copy.

### Unavailable functionality

- Authenticated LLM judge on GitHub Pages.
- Email, ticketing, dispatch, access-control changes, emergency messaging, and external evidence transmission.
- Server-generated PowerPoint downloads on GitHub Pages.
- Facial recognition and permanent watchlists.

### Research-only functionality

- MobileCLIP released weights; BoT-SORT-style appearance-assisted tracking.
- Age, perceived gender, body proportion, and gait. These never enter operational search, association, retention, or action authorization.

### Roadmap functionality

- Consented held-out dataset and browser benchmark; threshold calibration; full tracker evaluation; manual assistive-technology audit; authenticated service integration; cryptographic evidence chain; operational incident response runbooks.

## Corrected overclaims

The public copy no longer claims 60% false-positive reduction, 10 FPS, fixed sub-two-second latency, 30× speed, zero-backend functionality, immutable logs, definitive identity/re-identification, or production readiness. The 24-hour retention text now describes enforced startup purge for specified browser stores and its limitations.

## Unresolved limitations and risks

- Model: no held-out surveillance accuracy, fairness, calibration, FPS, memory, or thermal benchmark. Similarity scores are not probabilities.
- Privacy: scene crops and embeddings remain sensitive; browser deletion cannot recall exported copies or guarantee deletion while the app never opens.
- Operations: no authenticated external action service; GitHub Pages is deliberately local-only. Browser model/decoder/storage failures are device-specific.
- Evidence: JSON SHA-256 detects later byte changes but is not a trusted timestamp, signer, immutable audit service, or legal chain of custody.

## Verification evidence

- Round 0: `round-0-forensic-audit.md`, `artifacts/baseline/live-baseline.json`, and hashed screenshots/trace/video/results under `artifacts/baseline/live-capture/` from CI run `31202076015`.
- Unit/contract/model: `tests/unit`, `tests/contracts`, `tests/models` and exact `package.json` scripts.
- Browser matrix: `playwright.config.ts`, `tests/e2e`; CI run `31201270165` passed 68 cases with two documented standards-based skips and retained reports/traces/screenshots/failure-video policy.
- CI/deploy: `.github/workflows/deploy.yml`; quiet runs `31202697338` and `31203192364` passed on `dee1ff6`; merged commit `d88c53d` passed build, Pages deployment and live smoke in run `31203666357`. Exact route probes and artifact names are in `deployment_verification.json` and `artifacts/deployment/deployment-evidence.json`.

## Completion claim evidence

| Completion claim | Classification | Exact evidence |
|---|---|---|
| Pages sends no removed API request and disables unavailable controls | Validated | `tests/e2e/production-smoke.spec.ts`; live-smoke job and network attachment in run `31203666357`; independent route probes in `deployment_verification.json` |
| False-positive verdict prevents escalation | Validated | `tests/contracts/agentic-control.test.ts`; visible proof in `tests/e2e/workspace.spec.ts`; `artifacts/action-traces/false-positive-proof.json` |
| Use-case action policy is authoritative | Validated | `src/lib/action-orchestrator.ts`; allowlist-bypass contract test |
| Generic person detections cannot trigger unrelated hazards | Validated | six negative controls in `tests/contracts/agent-use-case-safety.test.ts` |
| Frame difference and parking-zero semantics are corrected | Validated | pixel-difference and telemetry-only contracts in `tests/contracts/agent-use-case-safety.test.ts` |
| Browser index, retention and privacy query rejection work within stated limits | Validated prototype | `tests/unit/idb-retention.test.ts`, `tests/unit/query-privacy.test.ts`, `src/lib/idb.ts` |
| Search, tracking and association model quality | Experimental | immutable adapters in `src/lib/yolos-detector.ts` and `src/lib/vlm-embeddings.ts`; null held-out metrics in benchmark ledgers |
| Fixture review workflow | Simulated | explicit labels and visible controls in `src/components/evidence-workspace.tsx`; fixture Playwright test |
| External actions and authenticated judge on Pages | Unavailable | `action_tool_registry.json`; disabled-control production smoke |
| Sensitive attribute inference | Research-only | operational denylist in `src/lib/query-parser.ts`; privacy tests |
| Cryptographic chain of custody and calibrated production deployment | Roadmap | open risks R1, R2 and R9 in `remaining-risk-registry.json` |

No completion claim in this report relies on a simulated fixture to prove model quality.
