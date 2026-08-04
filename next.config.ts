import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true' || process.env.DEPLOY_TARGET === 'github-pages'
const repoName = 'vision-agent-peru'

const nextConfig: NextConfig = {
  // Use 'standalone' for dev/server, 'export' for GitHub Pages static hosting
  output: isGitHubPages ? "export" : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // GitHub Pages serves from a subdirectory (/vision-agent-peru/)
  // basePath + assetPrefix ensure all routes and assets resolve correctly
  ...(isGitHubPages ? {
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`,
    images: {
      unoptimized: true,
    },
  } : {}),
  // trailingSlash helps GitHub Pages serve .html files for nested routes
  trailingSlash: true,
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
