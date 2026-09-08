'use client';
import Link from 'next/link';
import {imagesForColour} from '@/lib/product-images';
import {ProductColours} from './product-colours';
import Image from 'next/image';
import {useState} from 'react';
import {HeartIcon} from './icons';
import {useCommerce} from './commerce-provider';
import {formatPrice,type Product} from '@/lib/catalog';
export function ProductCard({product:original}:{product:Product}){
 const [colour,setColour]=useState(original.color);const v=original.variants.find(v=>v.color===colour&&v.stock>0)??original.variants.find(v=>v.color===colour);const product=v?{...original,color:v.color,variantId:v.id,price:v.price,salePrice:v.salePrice,stock:v.stock,images:imagesForColour(original,colour)}:original;
 const {wishlist,toggleWishlist,addToCart,ready}=useCommerce();const [adding,setAdding]=useState(false);const saved=wishlist.includes(product.id);const available=product.variants.some(v=>v.stock>0);const sale=product.salePrice!=null;
 return <article className="product-card"><div className="product-visual"><Link href={'/products/'+product.slug} className="product-image">{(sale||product.isNew)&&<span className="tag">{sale?'Sale':'New'}</span>}{product.images[0]?<Image src={product.images[0].url} alt={product.images[0].alt} fill sizes="(max-width:560px) 48vw, (max-width:1000px) 33vw, 24vw"/>:<span>No image available</span>}</Link><button type="button" aria-label={(saved?'Remove ':'Save ')+product.name+(saved?' from wishlist':' to wishlist')} aria-pressed={saved} className={'heart '+(saved?'saved':'')} onClick={()=>void toggleWishlist(product.id).catch(()=>{})}><HeartIcon filled={saved}/></button></div><ProductColours product={original} selected={colour} onSelect={setColour}/><Link href={'/products/'+product.slug} className="product-meta"><div><h3>{product.name}</h3><p>{product.material} · {product.color}</p></div><div className="price-stack"><strong>{formatPrice(product.salePrice??product.price)}</strong>{sale&&<s>{formatPrice(product.price)}</s>}</div></Link><div className="card-action">{product.variants.length>1?<Link className="button button-outline" href={'/products/'+product.slug}>Choose options <span>→</span></Link>:<button className="button button-outline" disabled={!ready||!available||adding} onClick={async()=>{setAdding(true);try{await addToCart(product);}catch{}finally{setAdding(false);}}}>{adding?'Adding…':available?'Add to cart':'Out of stock'}{available&&!adding&&<span aria-hidden="true">+</span>}</button>}</div></article>;
}
