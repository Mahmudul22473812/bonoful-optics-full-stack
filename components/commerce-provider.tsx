'use client';
import { createContext,useCallback,useContext,useEffect,useMemo,useState } from 'react';
import type { Product } from '@/lib/catalog';
import { api,errorMessage,send,setCsrf } from '@/lib/api';

export type User={id:string;email:string;name:string;phone?:string;verified:boolean;role:string;roleId:string;permissions:string[]};
export type CartLine={id:string;product:Product;quantity:number;variantId:string;available:boolean};
type Value={cartOpen:boolean;openCart:()=>void;closeCart:()=>void;user:User|null;ready:boolean;cart:CartLine[];wishlist:string[];savedProducts:Product[];cartCount:number;message:string;busy:boolean;refresh:()=>Promise<void>;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;addToCart:(product:Product,quantity?:number)=>Promise<void>;updateQuantity:(variantId:string,quantity:number)=>Promise<void>;removeFromCart:(variantId:string)=>Promise<void>;toggleWishlist:(productId:string)=>Promise<void>};
const Context=createContext<Value|null>(null);
let sessionRequest:Promise<{csrf:string;user:User|null}>|null=null;
function sessionBootstrap(){return sessionRequest??=api<{csrf:string;user:User|null}>('auth/session').finally(()=>{sessionRequest=null;});}
export function CommerceProvider({children}:{children:React.ReactNode}){
  const [cartOpen,setCartOpen]=useState(false);
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[cart,setCart]=useState<CartLine[]>([]),[savedProducts,setSaved]=useState<Product[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{const session=await sessionBootstrap();setCsrf(session.csrf);setUser(session.user);const result=await api<{items:CartLine[]}>('cart');setCart(result.items);if(session.user){const saved=await api<{items:Product[]}>('wishlist');setSaved(saved.items);}else setSaved([]);},[]);
  useEffect(()=>{void refresh().catch(e=>setMessage(errorMessage(e))).finally(()=>setReady(true));},[refresh]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timer);},[message]);
  const mutate=useCallback(async(action:()=>Promise<void>)=>{setBusy(true);try{await action();}catch(error){setMessage(errorMessage(error));throw error;}finally{setBusy(false);}},[]);
  const value=useMemo<Value>(()=>({cartOpen,openCart:()=>setCartOpen(true),closeCart:()=>setCartOpen(false),user,ready,cart,savedProducts,wishlist:savedProducts.map(p=>p.id),cartCount:cart.reduce((n,i)=>n+i.quantity,0),message,busy,refresh,
    async login(email,password){const session=await send<{csrf:string;user:User}>('auth/login',{email,password});setCsrf(session.csrf);setUser(session.user);await refresh();},
    async logout(){await send('auth/logout',{});setUser(null);setCart([]);setSaved([]);await refresh();},
    async addToCart(product,quantity=1){await mutate(async()=>{const result=await send<{items:CartLine[]}>('cart',{action:'add',variantId:product.variantId,quantity});setCart(result.items);setCartOpen(true);});},
    async updateQuantity(variantId,quantity){await mutate(async()=>{const result=await send<{items:CartLine[]}>('cart',{action:'set',variantId,quantity});setCart(result.items);});},
    async removeFromCart(variantId){await mutate(async()=>{const result=await send<{items:CartLine[]}>('cart',{action:'remove',variantId});setCart(result.items);});},
    async toggleWishlist(productId){if(!user){setMessage('Sign in to save your favourite frames.');return;}await mutate(async()=>{const result=await send<{items:Product[]}>('wishlist',{productId,saved:!savedProducts.some(p=>p.id===productId)});setSaved(result.items);});},
  }),[cartOpen,user,ready,cart,savedProducts,message,busy,refresh,mutate]);
  return <Context.Provider value={value}>{children}{message&&<div className="global-toast" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss notification">×</button></div>}</Context.Provider>;
}
export function useCommerce(){const value=useContext(Context);if(!value)throw new Error('CommerceProvider required');return value;}
