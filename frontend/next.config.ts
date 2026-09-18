import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Internal backend target (points to Render live backend https://thionline.onrender.com)
    let rawUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://thionline.onrender.com';
    
    // Prevent infinite self-referencing loops (if NEXT_PUBLIC_API_URL equals frontend domain)
    if (
      rawUrl.includes('hoccungai.io.vn') ||
      rawUrl.startsWith('/') ||
      rawUrl.endsWith('/api') ||
      rawUrl.endsWith('/api/')
    ) {
      rawUrl = 'https://thionline.onrender.com';
    }

    const cleanBase = rawUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${cleanBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

