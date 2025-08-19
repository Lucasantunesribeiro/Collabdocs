/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações de webpack para otimização
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Otimizações para produção
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
  
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    // Otimizações experimentais
    optimizePackageImports: ['@collab-docs/shared', '@collab-docs/yjs-provider'],
  },
  
  transpilePackages: ['@collab-docs/shared', '@collab-docs/yjs-provider'],
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_API_URL || 'https://collab-docs.collabdocs.workers.dev',
  },
};

module.exports = nextConfig;