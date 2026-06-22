import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
}

export default config
