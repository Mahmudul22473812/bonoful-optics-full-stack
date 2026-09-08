import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output:'standalone',
  poweredByHeader:false,
  images:{remotePatterns:[],formats:['image/avif','image/webp']},
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},{source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Cache-Control',value:'private, no-store'}]}];},
};

export default nextConfig;
