# AGENTS.md — Vision Agent Perú

> Instructions for AI agents (and humans) working on this repository.
> Read this BEFORE making changes. Follow the conventions to avoid
> repeating past issues.

## Repository overview

- **Repository**: https://github.com/PillB/vision-agent-peru
- **Live site**: https://pillb.github.io/vision-agent-peru/
- **Stack**: Next.js 16 + TypeScript + Tailwind + shadcn/ui + TF.js + HuggingFace transformers.js
- **Deployment**: GitHub Pages (static export) — NO server, NO API routes in production
- **Local dev**: `npm run dev` → http://localhost:3000

## Essential commands

```bash
# Development
npm run dev                    # Start dev server (port 3000)
npm run lint                   # ESLint
npx tsc --noEmit               # TypeScript check (pre-existing errors in examples/ and skills/ are OK)

# Tests
npm run test                   # Adversarial test suite (tsx scripts/adversarial-tests.ts)
npm run test:pw                # Legacy Playwright validation (pw-r3r4-validation.js)
npm run test:formal            # Formal @playwright/test suite (scripts/playwright/ui.spec.js)

# Formal Playwright against production
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal

# Build
npm run build                  # Next.js build (standalone)
npx next build                 # Static export (used by CI)
```

## Architecture — what lives where

```
src/
├── app/
│   ├── page.tsx              # Root page — 3 tabs (Overview / Brief / Prototype)
│   ├── api/                  # API routes — REMOVED during CI build (static export)
│   └── actions/              # Server actions (set-locale only)
├── components/
│   ├── prototype/            # The functional prototype tab
│   │   ├── camera-view.tsx          # Detection pipeline (COCO-SSD + HF + pixel-anomaly)
│   │   ├── alerts-panel.tsx         # Tier-based alert folding
│   │   ├── evidence-panel.tsx       # Evidence search UI (Round 3)
│   │   ├── nl-search-panel.tsx      # Natural-language search (Round 3)
│   │   ├── incident-panel.tsx       # 12-state incident machine UI (Round 5)
│   │   ├── model-selector.tsx       # Model dropdown with adapter status badges
│   │   └── use-agent-actions.ts     # Action execution hook
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── agent.ts              # decide() — deterministic rule engine
│   ├── agentic-response.ts   # 9-stage agentic loop (Round 5)
│   ├── incident-state-machine.ts  # 12-state incident machine (Round 5)
│   ├── association.ts        # Cross-video candidate association (Round 4)
│   ├── evidence.ts           # Evidence search pipeline (Round 3)
│   ├── video-indexer.ts      # Multi-video upload + sampling (Round 3)
│   ├── query-parser.ts       # NL query parser (Round 3)
│   ├── idb.ts                # IndexedDB wrapper (D12 fix)
│   ├── dev-store-hook.ts     # Dev-only window.__visionStore (D14 fix)
│   ├── deployment.ts         # GH Pages detection
│   ├── models/registry.ts    # Model selector registry
│   ├── specialized-models.ts # HF multi-model ensemble
│   ├── pixel-anomaly.ts      # Color-based anomaly detection
│   ├── identity.ts           # WithinFeedTracker + AppearanceTracker
│   ├── anomaly.ts            # Z-score / EMA / peakZ stats
│   └── use-cases.ts          # 15 use case definitions
└── ...
scripts/
├── adversarial-tests.ts     # 2071+ unit tests (run with: npm run test)
├── playwright/ui.spec.js    # 14 formal Playwright tests
└── pw-*.js                  # Legacy ad-hoc Playwright scripts (deprecated)
.github/workflows/deploy.yml # CI/CD — see DEPLOYMENT.md
```

## Critical conventions — DO NOT violate

### 1. No API routes in production

GitHub Pages is a static host. API routes are REMOVED during CI build:
```yaml
- name: Remove API routes (incompatible with static export)
  run: rm -rf src/app/api
```
**Never** add client code that calls `/api/*` without checking `apiRoutesAvailable()` first. See `src/lib/deployment.ts`.

### 2. No `window.__visionStore` in production

The dev-only store hook lives in `src/lib/dev-store-hook.ts` and is loaded via dynamic import in `src/app/page.tsx` ONLY when `NODE_ENV !== 'production'`. Next.js tree-shakes it out of production builds.

**Never** add `window.__visionStore` to a production code path. The formal Playwright suite verifies its absence (D14 test).

### 3. UseCase.actions is authoritative

The agent's `decide()` function filters every action through `useCase.actions`. If a use case doesn't list `'send_email'`, the agent WILL NOT dispatch it. See D7 fix in `src/lib/agent.ts`.

**Never** hardcode actions by tier — always check `allowedActions.has(name)`.

### 4. Model adapters must be honest

Every model in `src/lib/models/registry.ts` has an `adapterImplemented: boolean` field. Models with `adapterImplemented: false` are displayed in the UI but cannot actually run. See D9 fix.

**Never** claim a model works without an adapter. Mark it `adapterImplemented: false` and show the "Adapter pending" badge.

### 5. Appearance similarity is NOT identity

The disclaimer "Appearance similarity does not establish identity" is PERMANENT. Internal IDs are track IDs, candidate IDs, association IDs — NOT identity. See section 2 of SOLARIZE SYSTEM PROMPT.

**Never** call candidate matching "identity" or use the term "digital identity" for color histograms / embeddings.

### 6. Sensitive terms are rejected, not silently transformed

The NL query parser (`src/lib/query-parser.ts`) REJECTS queries about race, ethnicity, religion, disability, medical status, political views, socioeconomic status, emotion, and subjective criminality. See section 3 of SOLARIZE SYSTEM PROMPT.

**Never** silently transform a sensitive query — always return a clear explanation.

### 7. Judge runs BEFORE escalate — never in parallel

The `orderActionsSequentially()` function in `src/lib/incident-state-machine.ts` enforces this. See section 20 of SOLARIZE SYSTEM PROMPT.

**Never** run `llm_judge` and `escalate` concurrently.

### 8. Absence is never definitive

The `assessAbsence()` function in `src/lib/association.ts` never says "this person is not in the video." It returns `candidate_found`, `no_confident_candidate`, or `inconclusive`. See section 17 of SOLARIZE SYSTEM PROMPT.

**Never** claim definitive absence — always include coverage + limitations.

## Common pitfalls — issues we've already fixed

### CI/CD runner acquisition failures

**Symptom**: `The job was not acquired by Runner of type hosted even after multiple attempts`
**Root cause**: GitHub infra — `ubuntu-latest` is sometimes unavailable due to high demand.
**Fix applied**: Switched to `ubuntu-24.04` + `cancel-in-progress: true` + `timeout-minutes: 15`.
**Preempt**: If you see this error, just re-trigger the workflow — it's not a code issue.

### Node.js 20 deprecation

**Symptom**: Warning annotation in CI runs.
**Fix applied**: Bumped `node-version: '20'` to `'22'` (LTS).
**Preempt**: Monitor GitHub Actions deprecation announcements. Next bump: Node 24 when 22 is deprecated.

### Dev server OOM in sandbox

**Symptom**: Dev server dies unexpectedly with `Out of memory: Killed process next-server`.
**Root cause**: 4GB RAM sandbox + no swap + Chrome + dev server competing.
**Fix applied**: Use `NODE_OPTIONS="--max-old-space-size=1024" npm run dev` in constrained environments.
**Preempt**: For local dev on normal hardware (8GB+), no limit needed. For CI, the build is single-process.

### Canvas repaint stalls Playwright actionability checks

**Symptom**: Playwright `locator.click()` times out at 15s on the start-pause button.
**Root cause**: The canvas overlay repaints every 1.5s during detection, making Playwright think the button is unstable.
**Fix applied**: All clicks on `start-pause-button` use `{ force: true, noWaitAfter: true, timeout: 60_000 }`.
**Preempt**: When writing new Playwright tests for controls near the canvas, use `force: true`.

### Fire tagged as 'person'

**Symptom**: Fire detections showed class='person' instead of 'fire'.
**Root cause**: `detectionClasses[0]='person'` was used as the synthetic detection class.
**Fix applied**: Added `specializedClassName` field to UseCase. See D5 fix.
**Preempt**: Always use `specializedClassName` for HF model detections, never `detectionClasses[0]`.

### Hardcoded bounding boxes

**Symptom**: All detections showed the same bbox `[0.2, 0.2, 0.6, 0.6]`.
**Fix applied**: `computeAnomalyBbox()` scans actual canvas pixels for the anomalous region.
**Preempt**: Never hardcode bboxes — always compute from actual pixel data.

## Testing strategy

### Adversarial tests (`npm run test`)

- 2071+ tests in `scripts/adversarial-tests.ts`
- Run with `npx tsx scripts/adversarial-tests.ts`
- Covers: anomaly edge cases, agent rules, model registry, claim-to-code, prompt injection, rate limiting, ensemble, temporal lifecycle, security fixtures, Round 3/4/5 modules
- **Add new tests** whenever you fix a defect — regression protection

### Formal Playwright suite (`npm run test:formal`)

- 14 tests in `scripts/playwright/ui.spec.js`
- Uses VISIBLE CONTROLS ONLY — no `window.__visionStore`, no direct Zustand mutation
- Run against dev: `npm run test:formal`
- Run against production: `BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal`
- **Add new tests** for new UI features — use `data-testid` attributes

### Pre-deployment checklist

Before merging to main:
1. `npx tsc --noEmit` — 0 new errors (pre-existing errors in `examples/` and `skills/` are OK)
2. `npm run test` — all tests pass
3. `npm run lint` — 0 errors
4. If UI changes: `npm run test:formal` — all tests pass
5. Commit with conventional message (see below)

## Commit message conventions

Use conventional commits with a clear scope:

```
<type>(<scope>): <description>

<body — what changed and why>

<footer — test counts, deployment status>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`
Scopes: `agent`, `evidence`, `association`, `incident`, `playwright`, `model`, `ui`

Example:
```
fix(incident): enforce sequential judge gating — judge BEFORE escalate

Section 20 of Solarize prompt forbids parallel judge + escalation.
orderActionsSequentially() now puts llm_judge first in the execution
order, preventing the race condition where escalate fires before the
judge verdict returns.

Tests: 2071/2071 pass (+4 new sequential gating tests)
```

## Deployment flow

1. Push to `main` → GitHub Actions triggers `deploy.yml`
2. Build job: checkout → Node 22 → npm install → rm src/app/api → next build → upload artifact
3. Deploy job: deploy-pages → live at https://pillb.github.io/vision-agent-peru/
4. Verify: `curl -s -o /dev/null -w "%{http_code}" https://pillb.github.io/vision-agent-peru/` → 200

See `DEPLOYMENT.md` for full details, troubleshooting, and preemptive guidance.

## When things go wrong

### Build fails in CI

1. Check `gh run view <run-id> --log-failed`
2. Common causes:
   - TypeScript error in new code → fix locally with `npx tsc --noEmit`
   - API route in static export → already handled by `rm -rf src/app/api` in CI
   - Missing dependency → `npm install --legacy-peer-deps`
3. Re-push the fix — CI auto-triggers

### Runner acquisition failure

**Not a code issue** — GitHub infra problem. Just re-trigger:
```bash
gh workflow run deploy.yml --ref main
```

### Production shows old content

GitHub Pages caches aggressively. Hard-refresh with:
```bash
curl -s -o /dev/null -w "%{http_code}" https://pillb.github.io/vision-agent-peru/?v=$(date +%s)
```

Or check the JS bundle hash to confirm new code deployed:
```bash
curl -s https://pillb.github.io/vision-agent-peru/ | grep -oE "_next/static/chunks/[^\"]+\.js" | head -3
```

## References

- `DEPLOYMENT.md` — full deployment guide + troubleshooting
- `docs/CI-CD.md` — CI/CD pipeline details + preemptive guidance
- `docs/TESTING.md` — testing strategy + how to add tests
- `AGENT_STATE.md` — original mission + phase retrospection
- `worklog.md` — chronological work log
- `upload/SOLARIZE SYSTEM PROMPT-2.md` — governing methodology (1871 lines)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
