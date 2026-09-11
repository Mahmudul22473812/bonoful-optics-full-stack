import type { Metadata } from 'next';
import {notFound} from 'next/navigation';
export const metadata:Metadata={title:'My account',robots:{index:false,follow:false}};
export default async function Account({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section[0]&&!['orders','wishlist','profile','addresses','prescriptions','reviews'].includes(section[0]))notFound();if(section.length>2||(section.length===2&&section[0]!=='orders'))notFound();return null;}
