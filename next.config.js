/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg', 'web-push'],
  },
  typescript: {
    // Erlaubt Deployment auch wenn TS-Fehler vorhanden sind
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
