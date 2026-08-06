# CI/CD Pipeline — Vision Agent Perú

> Detailed documentation of the GitHub Actions workflow, known issues,
> and preemptive guidance to prevent repeating past failures.

## Workflow file

`.github/workflows/deploy.yml`

## Triggers

| Trigger | When | Action |
|---------|------|--------|
| `push` to `main` | Any commit to main | Auto-build + deploy |
| `workflow_dispatch` | Manual via `gh workflow run` or GitHub UI | Same |

## Pipeline overview

```
┌─────────────────────────────────────────────────────────┐
│  push to main OR workflow_dispatch                       │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  build job (ubuntu-24.04, Node 22, 15-min timeout)       │
│                                                          │
│  1. checkout                                             │
│  2. setup-node (npm cache enabled)                       │
│  3. npm install --legacy-peer-deps                       │
│  4. rm -rf src/app/api  ← static export compatibility    │
│  5. npx next build    ← produces ./out                   │
│  6. touch out/.nojekyll                                  │
│  7. configure-pages                                      │
│  8. upload-pages-artifact                                │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  deploy job (ubuntu-24.04, 5-min timeout)                │
│                                                          │
│  1. deploy-pages  ← publishes artifact to GitHub Pages   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Live: https://pillb.github.io/vision-agent-peru/        │
└─────────────────────────────────────────────────────────┘
```

## Concurrency control

```yaml
concurrency:
  group: "pages"
  cancel-in-progress: true
```

**Why `cancel-in-progress: true`**: When multiple pushes happen in quick succession (e.g., a fix-up commit right after the first), the older runs are cancelled. This saves runner time and prevents the 4-run queue buildup seen on 2026-08-06.

**When to use `false`**: Only if you need every run to complete (e.g., release pipelines). For a static site, `true` is correct.

## Known issues and fixes

### Issue 1: Runner acquisition failure (RESOLVED)

**Symptom**:
```
ANNOTATIONS
X The job was not acquired by Runner of type hosted even after multiple attempts
```

**Root cause**: GitHub Actions infra — `ubuntu-latest` runners are sometimes unavailable due to high demand. The job would wait 15+ minutes then fail.

**Frequency**: 4 of 6 runs failed on 2026-08-06 due to this issue.

**Fix applied**:
- Changed `runs-on: ubuntu-latest` → `runs-on: ubuntu-24.04` (less contested)
- Added `timeout-minutes: 15` to fail fast instead of waiting 6 hours
- Set `cancel-in-progress: true` to reduce queue buildup

**Preempt**: If you see this error, it's NOT a code issue. Just re-trigger:
```bash
gh workflow run deploy.yml --ref main
```

### Issue 2: Node.js 20 deprecation (RESOLVED)

**Symptom**:
```
! Node.js 20 is deprecated. The following actions target Node.js 20
  but are being forced to run on Node.js 24: actions/checkout@v4, ...
```

**Root cause**: GitHub deprecated Node 20 on 2025-09-19. Actions using Node 20 are forced to Node 24, which may cause subtle breakage.

**Fix applied**: Changed `node-version: '20'` → `node-version: '22'` (current LTS).

**Preempt**: Monitor https://github.blog/changelog/ for future deprecations. The next bump will be to Node 24 when 22 is deprecated (estimated 2027).

### Issue 3: API routes in static export (RESOLVED)

**Symptom**: `next build` fails with:
```
Error: Export encountered errors
/api/judge, /api/alert, /api/report are not supported with output: 'export'
```

**Root cause**: Next.js static export (`output: 'export'`) does not support API routes. The repo has API routes for dev mode (LLM judge, alert, report), but they can't be deployed to GitHub Pages.

**Fix applied**: CI removes API routes before build:
```yaml
- name: Remove API routes (incompatible with static export)
  run: rm -rf src/app/api
```

**Preempt**: 
- Never add client code that calls `/api/*` without checking `apiRoutesAvailable()` first
- The `src/lib/deployment.ts` module provides `isGitHubPages()` and `apiRoutesAvailable()` helpers
- See D1 fix in the adversarial tests

### Issue 4: Dev server OOM in sandbox (CONTEXT-SPECIFIC)

**Symptom**: Local dev server dies with:
```
Out of memory: Killed process next-server (pid 4042)
```

**Root cause**: The development sandbox has 4GB RAM and no swap. Running `next dev` + Chrome + TF.js simultaneously exceeds the limit.

**Fix applied**: Use `NODE_OPTIONS="--max-old-space-size=1024"` in constrained environments.

**Preempt**: 
- This is a LOCAL issue only — CI builds are single-process and don't OOM
- For local dev on normal hardware (8GB+), no limit is needed
- The formal Playwright suite runs against production, not local dev, to avoid this

### Issue 5: Playwright actionability timeout on canvas-adjacent controls (RESOLVED)

**Symptom**: Playwright test fails with:
```
TimeoutError: locator.click: Timeout 15000ms exceeded
- waiting for getByTestId('start-pause-button')
- attempting click action
- element is visible, enabled and stable
- scrolling into view if needed
- done scrolling
```

**Root cause**: The canvas overlay repaints every 1.5s during the detection loop. Playwright's actionability check interprets this as instability and never settles.

**Fix applied**: All clicks on `start-pause-button` use:
```javascript
{ force: true, noWaitAfter: true, timeout: 60_000 }
```

**Preempt**: When writing new Playwright tests for controls near the canvas:
- Always use `force: true` to bypass actionability checks
- Always use `noWaitAfter: true` to avoid waiting for navigations that won't happen
- Use `test.setTimeout(120_000)` for tests that involve model loading

## Monitoring commands

### Check recent runs

```bash
gh run list --limit 10
```

### View specific run details

```bash
gh run view <run-id>
```

### View failed run logs

```bash
gh run view <run-id> --log-failed
```

### Trigger manual deployment

```bash
gh workflow run deploy.yml --ref main
```

### Check live site health

```bash
curl -s -o /dev/null -w "Status: %{http_code} | Time: %{time_total}s\n" \
  https://pillb.github.io/vision-agent-peru/
```

### Run formal tests against production

```bash
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal
```

## Preemptive guidance

### DO: Use `ubuntu-24.04` instead of `ubuntu-latest`

`ubuntu-latest` currently resolves to `ubuntu-24.04`, but explicitly pinning avoids surprises when GitHub changes the default. It's also less contested by other users.

### DO: Pin Node version to current LTS

Node 22 is the current LTS (until October 2025, then maintenance until 2027). Pinning avoids deprecation warnings and forced upgrades.

### DO: Enable npm cache

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'  # speeds up install by ~30s
```

### DO: Cancel superseded runs

`cancel-in-progress: true` saves runner time and prevents queue buildup.

### DO: Set reasonable timeouts

- Build: 15 minutes (typical: 2-3 min)
- Deploy: 5 minutes (typical: 15 sec)

Without timeouts, a stuck runner can wait 6 hours (GitHub's default).

### DON'T: Add API routes without a static-export fallback

If you add a new API route, the client MUST check `apiRoutesAvailable()` before calling it. On GitHub Pages, the route won't exist — return a simulated result instead.

### DON'T: Use `window.__visionStore` in production code

The dev-only hook is tree-shaken out of production via dynamic import. If you add it to a production code path, the D14 test will fail.

### DON'T: Use `ubuntu-latest` without checking

GitHub sometimes changes what `ubuntu-latest` points to. Pinning to `ubuntu-24.04` ensures reproducibility.

### DON'T: Forget `--legacy-peer-deps`

The repo has a peer dependency conflict between `@huggingface/transformers` and `next`. Without `--legacy-peer-deps`, `npm install` fails. This is a known issue that will be resolved when Next.js updates its peer deps.

## CI/CD metrics

Current performance (as of 2026-08-06):

| Metric | Value |
|--------|-------|
| Build time (typical) | 1m 57s |
| Deploy time (typical) | 13s |
| Total pipeline time | ~2m 10s |
| Success rate (last 10 runs) | 60% (4 failures were runner-acquisition, not code) |
| Adversarial tests | 2071 |
| Formal Playwright tests | 14 |

## Future improvements

1. **Add a smoke test step** to CI — after deploy, run `curl` + a single Playwright test to verify the site is live
2. **Add a Lighthouse CI step** — audit performance, accessibility, SEO
3. **Add a bundle size check** — fail if the JS bundle grows > 10% without justification
4. **Add cross-browser testing** — currently only Chromium; add Firefox + WebKit
5. **Add a dependency review** — fail if a new dependency has a known vulnerability
