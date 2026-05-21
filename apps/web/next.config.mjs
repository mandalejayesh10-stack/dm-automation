const nextConfig = {
  transpilePackages: ["@aisma/database"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" }
    ]
  }
};

export default nextConfig;
