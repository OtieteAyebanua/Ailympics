import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next uses its own tsconfig so it never clashes with Vite's `tsc -b`
  // (root tsconfig.json stays a Vite project-references file).
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  // The Vite source has pre-existing lint findings unrelated to the migration;
  // don't let them block the Next build while both apps coexist.
  eslint: { ignoreDuringBuilds: true },
  // Native/driver packages must stay external (not bundled) in server code.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // Audio assets (stadium samples) → emit as files, import resolves to a URL.
  webpack: (config) => {
    config.module.rules.push({ test: /\.(mp3|wav|ogg)$/, type: 'asset/resource' });
    // wagmi's unused Tempo connector does `import('accounts').catch(...)` — an
    // optional dep we never install. Stub it so webpack doesn't fail the build.
    config.resolve.fallback = { ...config.resolve.fallback, accounts: false };
    return config;
  },
};

export default nextConfig;
