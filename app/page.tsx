import Link from 'next/link';
import Image from 'next/image';
import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/lib/server-api';
import type { Product } from '@/lib/catalog';
export const dynamic='force-dynamic';
export default async function Home(){
 let products:Product[]=[];try{products=(await getProducts('limit=8&sort=best-selling')).items;}catch{}
 return <main className="store-home">
  <section className="shop-hero"><div className="shop-hero-copy"><p className="eyebrow">Bonoful Optics</p><h1>Find your<br/>everyday frame.</h1><p>Comfortable eyeglasses and sunglasses.<br/>A style for every day, a fit for you.</p><Link href="/shop" className="button button-dark">Shop all eyewear <span aria-hidden="true">↗</span></Link></div><div className="shop-hero-image"><Image src="/media/black-round-unsplash.jpg" alt="Round black eyeglasses on a light surface" fill priority sizes="(max-width:700px) 100vw, 55vw"/><Link href="/shop?category=Eyeglasses" className="hero-image-link">Explore eyeglasses <span>→</span></Link></div></section>
  <section className="home-collection"><div className="collection-heading"><div><h2>Find a pair you’ll love</h2><p>Browse our latest selection.</p></div><Link href="/shop" className="text-link">View all →</Link></div><nav className="category-tabs" aria-label="Shop by category">{[['All eyewear','/shop'],['Eyeglasses','/shop?category=Eyeglasses'],['Sunglasses','/shop?category=Sunglasses'],['Reading glasses','/shop?category=Reading+Glasses'],['Kids','/shop?gender=Kids']].map(([label,href])=><Link href={href} key={label}>{label}</Link>)}</nav>{products.length?<div className="product-grid">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="empty-state"><h2>Products are temporarily unavailable.</h2><Link className="button button-outline" href="/shop">Try the shop again</Link></div>}</section>
 </main>;
}
