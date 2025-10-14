import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable trailing slashes to prevent routing issues
  trailingSlash: false,
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://jaime.capital/api',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://jaime.capital',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://jaime.capital/api',
  },
  // Ensure environment variables are available at build time
  publicRuntimeConfig: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://jaime.capital',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://jaime.capital/api',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://jaime.capital/api',
  },
  // Ensure environment variables are available at build time
  serverExternalPackages: ['nodemailer', '@prisma/client'],
  // Ensure Prisma Client is properly bundled
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client');
    }
    return config;
  },
};

export default nextConfig;
