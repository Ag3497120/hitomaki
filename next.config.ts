import type { NextConfig } from 'next';

const nextConfig: NextConfig =
  process.env.HITOMAKI_GITHUB_PAGES === '1'
    ? { output: 'export', basePath: '/hitomaki', trailingSlash: true }
    : {};

export default nextConfig;
