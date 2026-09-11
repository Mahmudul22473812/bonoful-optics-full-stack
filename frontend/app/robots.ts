import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots{const origin=process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000';return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/account','/api','/checkout','/cart','/login','/register','/reset-password','/verify-account']},sitemap:`${origin}/sitemap.xml`};}
