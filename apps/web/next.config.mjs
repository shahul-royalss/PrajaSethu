/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pilot ships without ESLint config; don't let lint block production builds.
  eslint: { ignoreDuringBuilds: true },

  // Same-origin API proxy: the browser calls relative `/api/*` and Next forwards it
  // to the NestJS service. This removes CORS and avoids baking the API's public URL
  // into the client bundle — so one public URL serves the whole app in production.
  // In dev, set NEXT_PUBLIC_API_BASE=http://localhost:4000/api to call the API
  // directly instead (see apps/web/.env.local).
  async rewrites() {
    let target = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
    if (!/^https?:\/\//.test(target)) {
      // Accept a bare host[:port]. Public hosts (with a dot, e.g. *.onrender.com)
      // get https; internal names (docker service "api", localhost) get http.
      const isPublic = target.includes('.') && !/^\d+\.\d+\.\d+\.\d+/.test(target) && !target.startsWith('localhost');
      target = `${isPublic ? 'https' : 'http'}://${target}`;
    }
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
