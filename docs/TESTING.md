# Testing Strategy — Vision Agent Perú

> How tests are organized, how to run them, and how to add new ones.

## Test tiers

### Tier 1: Adversarial unit tests (`npm run test`)

- **File**: `scripts/adversarial-tests.ts`
- **Count**: 2071+ tests (as of 2026-08-06)
- **Runtime**: ~2 seconds
- **Framework**: Custom minimal framework (no deps)
- **Covers**: anomaly edge cases, agent rules, model registry, claim-to-code, prompt injection, rate limiting, ensemble, temporal lifecycle, security fixtures, Round 3/4/5 modules

#### Run

```bash
npm run test
# or
npx tsx scripts/adversarial-tests.ts
```

#### Add a new test

```typescript
// At the end of scripts/adversarial-tests.ts, before the FINAL SUMMARY:

describe('NewFeature: does X correctly', () => {
  const { newFunction } = require('../src/lib/new-module')
  assert(newFunction(input) === expected, 'should do X')
})
```

#### Test patterns

```typescript
// Pattern 1: Pure function test
describe('Module: function behaves correctly', () => {
  const result = someFunction(input)
  assert(result.field === expected, 'field should match')
})

// Pattern 2: Edge case test
describe('Module: handles empty input', () => {
  const result = someFunction([])
  assert(result.count === 0, 'count should be 0 for empty input')
})

// Pattern 3: Negative test (should NOT do X)
describe('Module: does not call API on GitHub Pages', () => {
  const code = fs.readFileSync('src/lib/module.ts', 'utf-8')
  assert(!code.includes('fetch(/api/'), 'must not call API without checking')
})

// Pattern 4: Regression test (specific past bug)
describe('D7: Agent respects useCase.actions — no email when not listed', () => {
  const uc = makeMockUseCase({ actions: ['badge', 'log_hit'] })  // NO send_email
  const ctx = makeMockCtx({ useCase: uc, capabilityLevel: 'agentic' })
  const d = decide(ctx)
  assert(!d.actions.some(a => a.name === 'send_email'),
    'send_email must NOT be dispatched when useCase.actions does not list it')
})
```

### Tier 2: Formal Playwright suite (`npm run test:formal`)

- **File**: `scripts/playwright/ui.spec.js`
- **Count**: 14 tests
- **Runtime**: ~2 minutes
- **Framework**: `@playwright/test`
- **Covers**: page load, prototype tab, dropdown selectors, start/pause, fire detection, use case switching, LLM judge toggle, model selector, accessibility, reduced motion, 200% zoom, D14 production hook check

#### Run

```bash
# Against dev server (must be running on localhost:3000)
npm run test:formal

# Against production
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal

# Run specific test
NODE_PATH=/home/z/.npm-global/lib/node_modules \
  /home/z/.npm-global/bin/playwright test \
  --config=playwright.config.js \
  --grep "page loads with three visible tabs"
```

#### Add a new test

```javascript
// In scripts/playwright/ui.spec.js

test('new feature works correctly', async ({ page }) => {
  test.setTimeout(120_000)  // 2 min for model load
  await ensureServer(page)
  await clickPrototypeTab(page)
  await waitForModelReady(page)

  // Use getByTestId or getByRole — NEVER window.__visionStore
  await page.getByTestId('new-feature-button').click({ force: true, noWaitAfter: true })
  await expect(page.getByText('Expected text')).toBeVisible()
})
```

#### Forbidden patterns (D13)

```javascript
// ❌ NEVER do these in formal Playwright tests:
await page.evaluate(() => window.__visionStore.setActiveUseCase('fire_smoke'))
await page.evaluate(() => { const btn = document.querySelector('button'); btn.click() })
await page.evaluate(() => usePrototypeStore.getState().setRunning(true))

// ✅ ALWAYS do these instead:
await page.getByTestId('use-case-trigger').click()
await page.getByRole('option', { name: /Fire|Fuego/i }).click()
await page.getByTestId('start-pause-button').click({ force: true, noWaitAfter: true })
```

### Tier 3: Legacy ad-hoc Playwright (`npm run test:pw`)

- **File**: `scripts/pw-r3r4-validation.js`
- **Status**: DEPRECATED — kept for backward compat, replaced by formal suite
- **Uses**: `window.__visionStore` (only works in dev)

This suite is being phased out. New tests should go in `scripts/playwright/ui.spec.js`.

## Test data

### Mock contexts

The adversarial test suite uses these helpers:

```typescript
makeMockUseCase(overrides?)    // Creates a UseCase with all fields
makeMockCtx(overrides?)        // Creates an AgentContext with stats, detections, etc.
makeSample(count, t?)          // Creates an AnomalySample
makeSamples(counts[])          // Creates an AnomalySample[]
```

### Static test fixtures

- Camera images in `public/sim/` — pre-extracted JPEG frames from stock video
- Used for headless Chromium (which can't decode video in software GL)

## Coverage by module

| Module | Adversarial tests | Playwright tests | Notes |
|--------|-------------------|------------------|-------|
| `anomaly.ts` | 15+ | — | Edge cases, boundary values |
| `agent.ts` | 30+ | — | Rule types, capability gating, D7 |
| `use-cases.ts` | 20+ | 1 (switching) | Claim-to-code, 15 use cases |
| `models/registry.ts` | 25+ | 1 (model selector) | Ranking, revisions, adapters |
| `specialized-models.ts` | 20+ | — | Ensemble, fire detection |
| `pixel-anomaly.ts` | 10+ | — | Bbox computation |
| `identity.ts` | 15+ | — | Tracker, appearance features |
| `evidence.ts` | 10+ | 1 (evidence panel) | IndexedDB, search |
| `agentic-response.ts` | 10+ | — | 9-stage loop |
| `association.ts` | 15+ | — | Cross-video, absence |
| `incident-state-machine.ts` | 20+ | 1 (incident panel) | State machine, idempotency |
| `query-parser.ts` | 10+ | — | NL parsing, sensitive terms |
| `video-indexer.ts` | 5+ | — | Multi-video upload |
| `dev-store-hook.ts` | 5+ | 1 (D14 check) | Production absence |
| `api/judge/route.ts` | 10+ | — | Prompt injection, rate limit |
| **Total** | **2071+** | **14** | |

## Pre-deployment checklist

Before merging to `main`:

```bash
# 1. TypeScript check
npx tsc --noEmit 2>&1 | grep -v "examples/\|skills/\|scripts/adversarial-tests.ts"
# Expected: 0 new errors

# 2. Lint
npm run lint
# Expected: 0 errors

# 3. Adversarial tests
npm run test
# Expected: 2071+ pass, 0 fail

# 4. Formal Playwright (against dev)
npm run test:formal
# Expected: 14 pass

# 5. (Optional) Formal Playwright against production after deploy
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal
# Expected: 14 pass
```

## Continuous Integration

The CI pipeline (`.github/workflows/deploy.yml`) currently runs:
- `npm install --legacy-peer-deps`
- `npx next build`

It does NOT run tests in CI (to keep build time under 3 minutes). Tests must be run locally before pushing.

### Future improvement: Add tests to CI

```yaml
- name: Run adversarial tests
  run: npm run test

- name: Run lint
  run: npm run lint
```

This would add ~30s to the build but catch regressions before deploy.

## Test naming conventions

### Adversarial tests

```
<DefectID or Round>: <Module> — <behavior being tested>
```

Examples:
- `D7: Agent respects useCase.actions — no email when not listed`
- `Round3: query parser rejects sensitive terms`
- `Round4: open-set rejection prevents forced merge`
- `Round5: idempotency key is deterministic`

### Playwright tests

Use descriptive sentences:
- `page loads with three visible tabs`
- `fire use case on fire camera produces detections`
- `production build does not expose the dev store hook`

## Common test pitfalls

### 1. Forgetting to handle async

```typescript
// ❌ Wrong — doesn't await
describe('Async: handles promise', () => {
  const result = asyncFunction()  // returns Promise
  assert(result.field === expected, 'should match')  // fails — result is Promise
})

// ✅ Correct — use sync test or make describe async
describe('Async: handles promise', () => {
  const result = await asyncFunction()  // top-level await
  assert(result.field === expected, 'should match')
})
```

### 2. Using `window.__visionStore` in Playwright

```javascript
// ❌ Wrong — bypasses UI, fails in production
const state = await page.evaluate(() => window.__visionStore.getState())

// ✅ Correct — reads from rendered DOM
const text = await page.locator('body').textContent()
expect(text).toContain('expected text')
```

### 3. Not handling canvas repaints in Playwright

```javascript
// ❌ Wrong — times out due to canvas repaint instability
await page.getByTestId('start-pause-button').click()

// ✅ Correct — force + noWaitAfter
await page.getByTestId('start-pause-button').click({ force: true, noWaitAfter: true, timeout: 60_000 })
```

### 4. Testing implementation instead of behavior

```typescript
// ❌ Wrong — tests internal state
assert(store.getState().currentTier === 3, 'tier should be 3')

// ✅ Correct — tests observable behavior
const text = await page.locator('body').textContent()
expect(text).toContain('Tier 3')
```
