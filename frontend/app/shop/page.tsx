import type { Metadata } from 'next';
import { CatalogBrowser } from '@/components/catalog-browser';
import { Breadcrumb,EmptyState } from '@/components/ui';
import { getProducts,serverApi } from '@/lib/server-api';
import type { Facets } from '@/lib/catalog';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Shop eyewear',description:'Find your next frame. Explore eyeglasses, sunglasses, readers and more.',alternates:{canonical:'/shop'}};
export default async function Shop({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;const query=Object.fromEntries(Object.entries(raw).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
 let content;try{const [result,facets]=await Promise.all([getProducts(new URLSearchParams(query).toString()),serverApi<Facets>('catalog/facets')]);content=<CatalogBrowser result={result} facets={facets} query={query}/>;}catch{content=<EmptyState title="The collection is temporarily unavailable" href="/shop" label="Try again">Please try again in a moment.</EmptyState>;}
 return <main className="page-shell"><Breadcrumb items={[{label:'The collection'}]}/><div className="page-title"><h1>Shop eyewear</h1><p>Find your size, shape and everyday fit.</p></div>{content}</main>;
}
