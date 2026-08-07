import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true' || process.env.DEPLOY_TARGET === 'github-pages'
const repoName = 'vision-agent-peru'

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : "standalone",
  reactStrictMode: false,
  ...(isGitHubPages ? {
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`,
    images: {
      unoptimized: true,
    },
  } : {}),
  trailingSlash: true,
};

// Use static i18n config for GitHub Pages (no cookies), normal config for dev
const i18nConfigPath = isGitHubPages ? './src/i18n/request-static.ts' : './src/i18n/request.ts'
const withNextIntl = createNextIntlPlugin(i18nConfigPath);

export default withNextIntl(nextConfig);
