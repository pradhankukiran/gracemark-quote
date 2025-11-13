/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@cerebras/cerebras_cloud_sdk'],
  webpack: (config, { isServer }) => {
    // Exclude Cerebras SDK from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@cerebras/cerebras_cloud_sdk': false,
      }
      config.resolve.alias = {
        ...config.resolve.alias,
        '@cerebras/cerebras_cloud_sdk': false,
      }
    }
    return config
  },
}

export default nextConfig
