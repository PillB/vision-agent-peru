# Deployment Guide — Vision Agent Perú

> How to build, deploy, and troubleshoot the GitHub Pages deployment.
> Read this BEFORE making changes to `.github/workflows/deploy.yml`.

## Deployment target

- **Host**: GitHub Pages (static site, no server)
- **URL**: https://pillb.github.io/vision-agent-peru/
- **Base path**: `/vision-agent-peru/` (configured in `next.config.ts`)
- **Build output**: `out/` directory (Next.js static export)

## CI/CD pipeline

The deployment is fully automated via `.github/workflows/deploy.yml`.

### Triggers

- **Push to `main`** → auto-triggers build + deploy
- **Manual** → `gh workflow run deploy.yml --ref main` or via GitHub UI

### Pipeline stages

```
push to main
    ↓
build job (ubuntu-24.04, Node 22)
    ├── checkout
    ├── setup-node (with npm cache)
    ├── npm install --legacy-peer-deps
    ├── rm -rf src/app/api        ← API routes incompatible with static export
    ├── npx next build            ← produces ./out directory
    ├── touch out/.nojekyll       ← bypass Jekyll processing
    ├── configure-pages
    └── upload-pages-artifact
    ↓
deploy job (ubuntu-24.04)
    └── deploy-pages              ← publishes artifact to GitHub Pages
    ↓
live at https://pillb.github.io/vision-agent-peru/
```

### Configuration

| Setting | Value | Why |
|---------|-------|-----|
| `runs-on` | `ubuntu-24.04` | Less contested than `ubuntu-latest` — fixes runner acquisition failures |
| `node-version` | `22` | Node 20 deprecated 2025-09-19; Node 22 is current LTS |
| `concurrency.cancel-in-progress` | `true` | Cancel superseded runs — saves runner time |
| `timeout-minutes` (build) | `15` | Fail fast if runner can't be acquired |
| `timeout-minutes` (deploy) | `5` | Deploy is fast; 5 min is generous |
| `npm install --legacy-peer-deps` | required | Peer dep conflict between HF transformers.js and Next.js |

## Local build verification

Before pushing, verify the build works locally:

```bash
# 1. TypeScript check (pre-existing errors in examples/ and skills/ are OK)
npx tsc --noEmit 2>&1 | grep -v "examples/\|skills/\|scripts/adversarial-tests.ts"

# 2. Lint
npm run lint

# 3. Adversarial tests
npm run test

# 4. Simulate the CI build
rm -rf src/app/api
GITHUB_ACTIONS=true DEPLOY_TARGET=github-pages npx next build
ls out/  # should contain index.html, _next/, etc.

# 5. Restore the API routes (for local dev)
git checkout src/app/api
```

## Post-deployment verification

After the CI run completes:

```bash
# 1. Check the live site returns 200
curl -s -o /dev/null -w "%{http_code}" https://pillb.github.io/vision-agent-peru/

# 2. Verify new code is in the JS bundle
# (look for your new component name or data-testid)
curl -s https://pillb.github.io/vision-agent-peru/ \
  | grep -oE "_next/static/chunks/[^\"]+\.js" | head -5

# 3. Search the bundles for your new code
for chunk in $(curl -s https://pillb.github.io/vision-agent-peru/ \
  | grep -oE "_next/static/chunks/[^\"]+\.js" | head -15); do
  count=$(curl -s "https://pillb.github.io/vision-agent-peru/$chunk" \
    | grep -c "YourNewComponent")
  if [ "$count" != "0" ]; then echo "$chunk: $count matches"; fi
done

# 4. Run formal Playwright suite against production
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal

# 5. Verify D14 — dev store hook NOT in production
# (the Playwright suite has a test for this, but you can also check manually)
curl -s https://pillb.github.io/vision-agent-peru/ | grep -c "__visionStore"
# Expected: 0
```

## Troubleshooting

### Issue: `The job was not acquired by Runner of type hosted`

**Cause**: GitHub Actions infra — `ubuntu-latest` / `ubuntu-24.04` runners are sometimes unavailable due to high demand. This is NOT a code issue.

**Fix**: Just re-trigger the workflow:
```bash
gh workflow run deploy.yml --ref main
```

If it fails repeatedly (3+ times), wait 15 minutes for GitHub infra to recover, then retry.

**Preempt**: The workflow uses `ubuntu-24.04` (less contested than `ubuntu-latest`) and `cancel-in-progress: true` to avoid queue buildup.

### Issue: Build fails with TypeScript error

**Cause**: New code introduced a type error.

**Fix**:
```bash
npx tsc --noEmit
# Fix the errors in YOUR code (ignore errors in examples/ and skills/)
```

Then commit + push. CI auto-triggers.

### Issue: Build fails with `next build` error

**Cause**: Usually one of:
1. API route in static export → already handled by `rm -rf src/app/api` in CI
2. Missing `basePath` in `next.config.ts` → check the export config
3. Image optimization incompatibility → `images.unoptimized: true` is set

**Fix**:
```bash
# Reproduce locally
rm -rf src/app/api
GITHUB_ACTIONS=true DEPLOY_TARGET=github-pages npx next build
```

### Issue: Production shows old content

**Cause**: GitHub Pages CDN cache. Usually resolves within 1-2 minutes.

**Fix**: Hard-refresh:
```bash
curl -s "https://pillb.github.io/vision-agent-peru/?v=$(date +%s)" -o /dev/null -w "%{http_code}\n"
```

Or check the JS bundle hash to confirm new code deployed:
```bash
curl -s https://pillb.github.io/vision-agent-peru/ | grep -oE "_next/static/chunks/[^\"]+\.js" | head -3
```

### Issue: `window.__visionStore` appears in production

**Cause**: Someone added it to a production code path.

**Fix**: The hook must ONLY be loaded via dynamic import in `src/app/page.tsx`:
```typescript
useEffect(() => {
  if (process.env.NODE_ENV !== 'production') {
    import('@/lib/dev-store-hook').then(({ installDevStoreHook }) => {
      installDevStoreHook()
    }).catch(() => {})
  }
}, [])
```

Verify with the formal Playwright suite's "production build does not expose the dev store hook" test.

### Issue: Node.js deprecation warning

**Status**: Currently a warning. Node 20 was deprecated 2025-09-19.

**Fix applied**: Workflow uses `node-version: '22'`.

**Preempt**: Monitor https://github.blog/changelog/ for future deprecations. Next bump: Node 24 when 22 is deprecated (likely 2027).

## Manual deployment (if CI is down)

If GitHub Actions is completely down, you can deploy manually:

```bash
# 1. Build locally
rm -rf src/app/api
GITHUB_ACTIONS=true DEPLOY_TARGET=github-pages npx next build

# 2. The out/ directory contains the static site
# 3. Use gh-pages CLI or git subtree push
npx gh-pages -d out -r https://github.com/PillB/vision-agent-peru.git
```

⚠️ **Manual deployment bypasses CI checks** — only use in emergencies. Run `npm run test` locally first.

## Environment variables

The build uses these env vars (set in CI, not required locally):

| Variable | Value | Purpose |
|----------|-------|---------|
| `GITHUB_ACTIONS` | `true` | Tells Next.js this is a CI build |
| `DEPLOY_TARGET` | `github-pages` | Triggers static export in `next.config.ts` |

No secrets are needed — the deployment uses the default `GITHUB_TOKEN` provided by GitHub Actions.

## Rollback

To rollback to a previous deployment:

```bash
# 1. Find the last known-good commit
git log --oneline -20

# 2. Reset to that commit (locally)
git checkout <good-commit-sha>

# 3. Force-push (use with caution — coordinate with team first)
git push origin main --force-with-lease

# 4. CI auto-triggers a new deployment from the rolled-back commit
```

⚠️ **Force-push is forbidden by convention** (see SOLARIZE SYSTEM PROMPT section 28). Only use for emergency rollbacks and coordinate with the team.

## Monitoring

### Check deployment status

```bash
# Latest runs
gh run list --limit 5

# Specific run details
gh run view <run-id>

# Live site health
curl -s -o /dev/null -w "Status: %{http_code} | Time: %{time_total}s\n" \
  https://pillb.github.io/vision-agent-peru/
```

### Run formal tests against production

```bash
BASE_URL=https://pillb.github.io/vision-agent-peru/ npm run test:formal
```

Expected: 14/14 tests pass.

## Preemptive guidance — issues to prevent

### 1. Always check `apiRoutesAvailable()` before fetch

```typescript
import { apiRoutesAvailable, isGitHubPages } from '@/lib/deployment'

if (!apiRoutesAvailable() || isGitHubPages()) {
  // Simulate the action — don't call /api/*
  return { simulated: true, verdict: 'real' }
}
// Safe to call /api/*
const res = await fetch('/api/judge', { ... })
```

### 2. Always use `data-testid` on interactive controls

Playwright tests use `getByTestId()` for stable selectors:
```tsx
<Button data-testid="start-pause-button">Start</Button>
<SelectTrigger data-testid="use-case-trigger">...</SelectTrigger>
```

### 3. Always add `adapterImplemented` to new models

```typescript
{
  id: 'new-model',
  // ...
  adapterImplemented: false,  // true ONLY if you've written the adapter
}
```

### 4. Always pin model revisions

```typescript
{
  modelId: 'Xenova/some-model',
  revision: 'abc123...',  // 40-char HF commit hash — NEVER 'main'
}
```

### 5. Always add adversarial tests for new features

When you add a new module, add tests to `scripts/adversarial-tests.ts`:
```typescript
describe('NewFeature: does X', () => {
  const { newFunction } = require('../src/lib/new-module')
  assert(newFunction() === expected, 'should do X')
})
```

### 6. Never run judge and escalate in parallel

Use `orderActionsSequentially()` to enforce the correct order:
```typescript
const ordered = orderActionsSequentially(['escalate', 'llm_judge', 'badge'])
// → ['llm_judge', 'badge', 'escalate']
```
