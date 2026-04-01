/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@students-talk': require('path').resolve(__dirname, '../../packages'),
    };
    return config;
  },
}

module.exports = nextConfig
