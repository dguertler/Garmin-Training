/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['pg', 'web-push', 'nodemailer'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
      }
    } else {
      const existingExternals = config.externals || []
      const externalsArray = Array.isArray(existingExternals)
        ? existingExternals
        : [existingExternals]
      config.externals = [
        ...externalsArray,
        'pg',
        'pg-native',
        'web-push',
        'nodemailer',
      ]
    }
    return config
  },
}

module.exports = nextConfig
