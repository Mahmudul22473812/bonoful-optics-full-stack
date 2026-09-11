import Link from 'next/link';
import Image from 'next/image';
import {ProductCard} from '@/components/product-card';
import {getProducts,serverApi} from '@/lib/server-api';
import type {Facets,Product} from '@/lib/catalog';

export const dynamic='force-dynamic';

function ProductSection({title,kicker,products,href='/shop'}:{title:string;kicker:string;products:Product[];href?:string}){
 if(!products.length)return null;
 const id=`section-${title.replaceAll(' ','-').toLowerCase()}`;
 return <section className="home-product-section" aria-labelledby={id}><div className="collection-heading"><div><p className="eyebrow">{kicker}</p><h2 id={id}>{title}</h2></div><Link href={href} className="text-link">View all <span aria-hidden="true">→</span></Link></div><div className="product-grid">{products.slice(0,4).map(product=><ProductCard key={product.id} product={product}/>)}</div></section>;
}

export default async function Home(){
 let newest:Product[]=[],best:Product[]=[],featured:Product[]=[],brands:Facets['brands']=[];
 try{const [newResult,bestResult,featuredResult,facets]=await Promise.all([getProducts('limit=8&sort=newest'),getProducts('limit=8&sort=best-selling'),getProducts('limit=8&featured=true&sort=newest'),serverApi<Facets>('catalog/facets')]);newest=newResult.items;best=bestResult.items;featured=featuredResult.items;brands=facets.brands;}catch{}
 const offers=[...new Map([...newest,...featured,...best].filter(product=>product.variants.some(variant=>variant.salePrice!=null)).map(product=>[product.id,product])).values()];
 return <main className="store-home">
  <section className="shop-hero"><div className="shop-hero-copy"><p className="eyebrow">Bonoful Optics</p><h1>Find your<br/>everyday frame.</h1><p>Comfortable eyeglasses and sunglasses.<br/>A style for every day, a fit for you.</p><Link href="/shop" className="button button-dark">Shop all eyewear <span aria-hidden="true">↗</span></Link></div><div className="shop-hero-image"><Image src="/media/black-round-unsplash.jpg" alt="Round black eyeglasses on a light surface" fill priority sizes="(max-width:700px) 100vw, 55vw"/><Link href="/shop?category=Eyeglasses" className="hero-image-link">Explore eyeglasses <span>→</span></Link></div></section>
  <section className="home-collection"><div className="collection-heading"><div><h2>Find a pair you’ll love</h2><p>Browse by the style that suits your day.</p></div><Link href="/shop" className="text-link">View all <span aria-hidden="true">→</span></Link></div><nav className="category-tabs" aria-label="Shop by category">{[['All eyewear','/shop'],['Eyeglasses','/shop?category=Eyeglasses'],['Sunglasses','/shop?category=Sunglasses'],['Reading glasses','/shop?category=Reading+Glasses'],['Kids','/shop?gender=Kids']].map(([label,href])=><Link href={href} key={label}>{label}</Link>)}</nav></section>
  {newest.length?<ProductSection title="New arrivals" kicker="Fresh in store" products={newest} href="/shop?sort=newest"/>:<div className="empty-state"><h2>Products are temporarily unavailable.</h2><Link className="button button-outline" href="/shop">Try the shop again</Link></div>}
  <ProductSection title="Customer favourites" kicker="Most chosen" products={best} href="/shop?sort=best-selling"/>
  {offers.length>0&&<ProductSection title="Special offers" kicker="Worth a look" products={offers}/>}
  {brands.length>0&&<section className="popular-brands" aria-labelledby="popular-brands-title"><div className="collection-heading"><div><p className="eyebrow">The names in our cabinet</p><h2 id="popular-brands-title">Popular brands</h2></div></div><div className="brand-grid">{brands.map(brand=><Link key={brand.id} href={`/shop?brand=${encodeURIComponent(brand.name)}`}><span>{brand.name}</span><small>Shop the collection <b aria-hidden="true">→</b></small></Link>)}</div></section>}
  <section className="store-benefits" aria-labelledby="benefits-title"><div className="benefits-intro"><p className="eyebrow">Shopping made simple</p><h2 id="benefits-title">Care at every step.</h2><p>From choosing your frame to receiving it, our local team keeps the experience clear and comfortable.</p></div><div className="benefit-grid"><article><span aria-hidden="true">↗</span><h3>Fast local delivery</h3><p>Quick, careful delivery with clear order updates.</p></article><article><span aria-hidden="true">♡</span><h3>Real customer support</h3><p>Friendly help from people who understand eyewear.</p></article><article><span aria-hidden="true">✓</span><h3>Secure ordering</h3><p>Protected account details and stock checked at checkout.</p></article></div></section>
 </main>;
}
