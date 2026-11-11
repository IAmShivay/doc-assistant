/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sql.js', 'pdf-parse'],
  },
};

module.exports = nextConfig;
