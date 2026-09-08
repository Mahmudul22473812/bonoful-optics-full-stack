import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/server-api';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const origin=process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000';const result:MetadataRoute.Sitemap=['','/shop','/about','/services','/contact'].map(path=>({url:origin+path,changeFrequency:'weekly'}));let page=1;for(;;){const products=await getProducts(`limit=50&page=${page}`);result.push(...products.items.map(p=>({url:`${origin}/products/${p.slug}`,changeFrequency:'weekly' as const})));if(page++>=(products.pages??1))break;}return result;}
