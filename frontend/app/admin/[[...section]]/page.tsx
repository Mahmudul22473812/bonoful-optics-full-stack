import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

export const metadata:Metadata={title:'Store administration',robots:{index:false,follow:false}};
export default async function Admin({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section[0]&&!['products','categories','brands','inventory','movements','orders','suppliers','purchase-orders','customers','staff','roles','coupons','reviews','audit','appointments','prescriptions'].includes(section[0]))notFound();return null;}
