#!/bin/bash
set -e
cd /home/z/my-project

echo "=== GitHub Pages Deployment ==="

# 1. Temporarily move API routes (they can't be statically exported)
echo "1. Temporarily removing API routes (not compatible with static export)..."
mkdir -p /tmp/api-backup
cp -r src/app/api/* /tmp/api-backup/ 2>/dev/null || true
rm -rf src/app/api

# 2. Build static export
echo "2. Building static export..."
DEPLOY_TARGET=github-pages npx next build

# 3. Add .nojekyll (bypass Jekyll processing)
echo "3. Adding .nojekyll..."
touch out/.nojekyll

# 4. Restore API routes
echo "4. Restoring API routes..."
mkdir -p src/app/api
cp -r /tmp/api-backup/* src/app/api/ 2>/dev/null || true
rm -rf /tmp/api-backup

# 5. Deploy to gh-pages branch
echo "5. Deploying to gh-pages branch..."
export PATH="/home/z/.local/bin:$PATH"

# Create a temporary directory for the gh-pages content
TEMP_DIR=$(mktemp -d)
cp -r out/* "$TEMP_DIR/"
cd "$TEMP_DIR"

# Initialize a new git repo and push to gh-pages branch
git init
git config user.name "GitHub Actions"
git config user.email "actions@github.com"
git add -A
git commit -m "Deploy to GitHub Pages ($(date -u +'%Y-%m-%d %H:%M:%S UTC'))"

# Push to gh-pages branch
git push --force "https://github.com/PillB/vision-agent-peru.git" main:gh-pages

# Cleanup
cd /home/z/my-project
rm -rf "$TEMP_DIR"

echo ""
echo "=== Deployment Complete ==="
echo "URL: https://pillb.github.io/vision-agent-peru/"
echo "(May take 1-2 minutes for GitHub Pages to update)"
