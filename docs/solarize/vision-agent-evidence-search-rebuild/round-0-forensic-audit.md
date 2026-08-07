# Round 0 forensic audit

Baseline source was frozen at `ea584dcb043fa1ad95467d8efd8e8f359c321a34` before production edits. Rollback is that immutable Git commit. The live site and local source were reproduced independently.

## Input-to-outcome trace

The legacy camera loop selected a use case but did not restrict execution to selected model adapters. It generated detections, derived a count z-score, passed that proxy as `frame_diff`, evaluated broad rules, then launched report, judge, email, and escalation work with `Promise.all`. The judge result was recorded but did not own an execution gate. On static GitHub Pages, `/api/alert`, `/api/report`, `/api/judge`, and the three PowerPoint routes did not exist.

The legacy cross-feed module reduced crops to dominant color and bounding-box geometry, called the result identity, and retained a global gallery. That evidence cannot establish identity and is excluded from the rebuilt workspace.

## Reproduced defect table

| ID | Reproduced defect | Baseline evidence | Acceptance test |
|---|---|---|---|
| D1 | Removed API routes still called | GET 404 / POST 405 for alert, report, judge; strategic exports also referenced APIs | `production-smoke.spec.ts` records zero API requests and checks hooks |
| D2 | Concurrent action/judge/report | legacy `camera-view.tsx` used `Promise.all` | `agentic-control.test.ts` asserts ordered gate |
| D3 | Judge could lack visual evidence | judge call accepted text-only context | evidence validation requires non-empty IDs and records visual reference when present |
| D4 | Color/geometry called identity | legacy `identity.ts` global gallery | active UI uses association vocabulary and disclaimer |
| D5 | Person triggered unrelated hazards | person count z-score fed multiple rules | six negative controls in `agent-use-case-safety.test.ts` |
| D6 | `frame_diff` was a count proxy | count z-score assigned to `frame_diff` | pixel difference negative control |
| D7 | `UseCase.actions` did not govern execution | action hooks could dispatch irrespective of case allowlist | executor-side allowlist test |
| D8 | Parking threshold zero always true | zero threshold comparison | zero is telemetry-only test |
| D9 | Selectable models lacked adapters | selection affected a boolean while full ensemble ran | runtime-plan unavailable test |
| D10 | Zero-valued best rank mishandled | falsy handling/ranking defects | rank-zero test |
| D11 | Mutable/placeholder revisions | revisions were not supplied to runtime | immutable active-adapter contract |
| D12 | IndexedDB/24h claim mismatch | primary store was memory-backed | reopen/purge IndexedDB test |
| D13 | Playwright bypassed UI | direct Zustand and raw dispatch | canonical suites use roles/labels only |
| D14 | Test hook in production | `window.__visionStore` exposure | production smoke asserts absence |
| D15 | Test-count claims unreproducible | undeclared `tsx`, hard-coded tool path | exact package scripts and `--list` result |
| D16 | Unsupported quantitative/readiness claims | live visible claims vs measured 7301 ms | claim registry and corrected copy |

## Baseline results

- Live analysis: about 0.1 cycles/s, 7301 ms displayed latency, six detections.
- Adversarial harness: 2070/2071, failing the after-hours time gate.
- ESLint: 159 errors and three warnings.
- TypeScript: six errors.
- Formal Playwright: 14 Chromium-only cases, 11 arbitrary waits, four forced clicks, Firefox/WebKit commented out.

Machine-readable evidence is in `artifacts/baseline/live-baseline.json`.
