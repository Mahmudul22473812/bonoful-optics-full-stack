'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCommerce } from './commerce-provider';
import { Alert } from './ui';
import { errorMessage,send } from '@/lib/api';

const titles:Record<string,string>={'login':'Welcome back.','register':'A clearer beginning.','forgot-password':'Let’s get you back in.','reset-password':'Choose a new password.','verify-email':'Verify your email.'};
export function AuthForm({action,token,returnTo}:{action:string;token?:string;returnTo:string}){
 const {login,ready}=useCommerce();const router=useRouter();const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <main className="auth-page"><div className="auth-intro"><p className="eyebrow">Your Bonoful account</p><h1>{titles[action]}</h1><p>Save the frames you love, keep your prescriptions private, and follow every order.</p><Link className="text-link" href="/shop">Explore the collection →</Link></div><form className="auth-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');const data=Object.fromEntries(new FormData(e.currentTarget));try{if(action==='login'){await login(String(data.email),String(data.password));router.push(returnTo);return;}const payload=action==='register'?{name:data.name,email:data.email,password:data.password}:action==='forgot-password'?{email:data.email}:action==='reset-password'?{token,password:data.password}:{token};const result=await send<{message:string}>(`auth/${action}`,payload);setMessage(result.message);}catch(error){setError(errorMessage(error));}finally{setBusy(false);}}}>
  <h2>{action==='login'?'Sign in':action==='register'?'Create an account':action==='verify-email'?'Confirm email address':'Account recovery'}</h2>
  {action==='register'&&<label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}
  {['login','register','forgot-password'].includes(action)&&<label>Email address<input name="email" type="email" autoComplete="email" required/></label>}
  {['login','register','reset-password'].includes(action)&&<label>Password<input name="password" type="password" autoComplete={action==='login'?'current-password':'new-password'} required minLength={action==='login'?1:12} maxLength={128}/>{action!=='login'&&<small>At least 12 characters, including upper case, lower case, and a number.</small>}</label>}
  {action==='register'&&<label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} data-match="password"/></label>}
  {action==='verify-email'&&<p>Confirm your email to place orders and keep your account up to date.</p>}
  {error&&<Alert>{error}</Alert>}{message&&<p className="success-message" role="status">{message}</p>}
  <button className="button button-dark button-wide" disabled={busy||!ready}>{busy?'Please wait…':action==='login'?'Sign in':action==='register'?'Create account':action==='verify-email'?'Verify email':'Continue'}</button>
  {action==='login'?<div className="auth-links"><Link href="/forgot-password">Forgot password?</Link><Link href="/register">Create an account →</Link></div>:<p className="small-note"><Link href="/login">Back to sign in →</Link></p>}
 </form></main>;
}
