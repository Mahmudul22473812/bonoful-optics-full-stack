import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output:'standalone',
  poweredByHeader:false,
  // Product photos are already compressed by the API. Next's optimiser cannot
  // validate same-origin authenticated file routes reliably in production, so
  // render those prepared assets directly across cards, galleries and carts.
  images:{remotePatterns:[],formats:['image/avif','image/webp'],unoptimized:true},
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},{source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Cache-Control',value:'private, no-store'}]}];},
};

export default nextConfig;
