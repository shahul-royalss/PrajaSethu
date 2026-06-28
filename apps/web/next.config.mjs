/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pilot ships without ESLint config; don't let lint block production builds.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
