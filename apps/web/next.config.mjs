/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pilot ships without ESLint config; don't let lint block production builds.
  eslint: { ignoreDuringBuilds: true },

  // NOTE: the /api/* → NestJS proxy is a RUNTIME route handler at
  // app/api/[...path]/route.ts (not a build-time rewrite), so API_PROXY_TARGET
  // is read live at request time and the same image works on any host.
};

export default nextConfig;
