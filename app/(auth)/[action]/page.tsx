import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
export const metadata:Metadata={title:'Your account',robots:{index:false,follow:false}};
export default async function AuthPage({params,searchParams}:{params:Promise<{action:string}>;searchParams:Promise<{token?:string;returnTo?:string}>}){const {action}=await params;if(!['login','register','forgot-password','reset-password','verify-email'].includes(action))notFound();const query=await searchParams;const target=query.returnTo;const returnTo=target?.startsWith('/')&&!target.startsWith('//')&&!target.includes('\\')?target:'/account';return <AuthForm action={action} token={query.token} returnTo={returnTo}/>;}
