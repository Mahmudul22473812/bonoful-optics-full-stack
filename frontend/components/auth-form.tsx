'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useCommerce } from './commerce-provider';
import { Alert } from './ui';
import { errorMessage,send } from '@/lib/api';

type Method='EMAIL'|'PHONE';
type Verification={identifier:string;masked:string;method:Method};
type OtpResponse={message:string;identifier:string;method:Method;cooldownSeconds:number};
const titles:Record<string,string>={'login':'Welcome back.','register':'A clearer beginning.','forgot-password':'Let’s get you back in.','reset-password':'Choose a new password.','verify-account':'Verify your account.'};

function OtpPanel({verification}:{verification:Verification}) {
 const router=useRouter();
 const [otp,setOtp]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('OTP sent successfully.'),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(60);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(value=>value-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function verify(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setMessage('');try{const result=await send<{message:string}>('auth/verify-account-otp',{identifier:verification.identifier,method:verification.method,otp});setMessage(result.message);setTimeout(()=>router.push('/login?verified=1'),900);}catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}}
 async function resend(){setBusy(true);setError('');setMessage('');try{const result=await send<OtpResponse>('auth/request-verification-otp',{identifier:verification.identifier,method:verification.method});setMessage(result.message);setCooldown(result.cooldownSeconds);setOtp('');}catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}}
 return <form className="auth-form otp-form" onSubmit={verify}>
  <p className="eyebrow">Secure verification</p><h2>Enter your verification code</h2>
  <p>We sent a six-digit code to <strong>{verification.masked}</strong>. It expires in 10 minutes.</p>
  <label>One-time password<input className="otp-input" name="otp" value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} required aria-describedby="otp-help"/></label>
  <small id="otp-help">Enter all six digits. The code can only be used once.</small>
  {error&&<Alert>{error}</Alert>}{message&&<p className="success-message" role="status">{message}</p>}
  <button className="button button-dark button-wide" disabled={busy||otp.length!==6}>{busy?'Checking…':'Verify account'}</button>
  <button className="otp-resend" type="button" disabled={busy||cooldown>0} onClick={()=>void resend()}>{cooldown>0?`Resend OTP in ${cooldown}s`:'Resend OTP'}</button>
  <p className="small-note"><Link href="/login">Back to sign in →</Link></p>
 </form>;
}

export function AuthForm({action,token,returnTo}:{action:string;token?:string;returnTo:string}){
 const {login,ready}=useCommerce();const router=useRouter();
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[method,setMethod]=useState<Method>('EMAIL'),[verification,setVerification]=useState<Verification|null>(null);
 if(verification)return <main className="auth-page"><div className="auth-intro"><p className="eyebrow">Your Bonoful account</p><h1>Almost there.</h1><p>Verify your contact detail to protect your account and place orders securely.</p></div><OtpPanel verification={verification}/></main>;
 return <main className="auth-page"><div className="auth-intro"><p className="eyebrow">Your Bonoful account</p><h1>{titles[action]}</h1><p>Save the frames you love, keep your prescriptions private, and follow every order.</p><Link className="text-link" href="/shop">Explore the collection →</Link></div><form className="auth-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');const data=Object.fromEntries(new FormData(e.currentTarget));try{
   if(action==='login'){await login(String(data.email),String(data.password));router.push(returnTo);return;}
   if(action==='verify-account'){const identifier=String(data.identifier);const result=await send<OtpResponse>('auth/request-verification-otp',{identifier,method});setVerification({identifier,method,masked:result.identifier});return;}
   const payload=action==='register'?{name:data.name,email:data.email,phone:data.phone||undefined,password:data.password,verificationMethod:method}:action==='forgot-password'?{email:data.email}:action==='reset-password'?{token,password:data.password}:{token};
   const result=await send<OtpResponse|{message:string}>(`auth/${action}`,payload);if(action==='register'){const registered=result as OtpResponse;setVerification({identifier:method==='EMAIL'?String(data.email):String(data.phone),method,masked:registered.identifier});}else setMessage(result.message);
  }catch(reason){setError(errorMessage(reason));}finally{setBusy(false);}}}>
  <h2>{action==='login'?'Sign in':action==='register'?'Create an account':action==='verify-account'?'Request a verification code':'Account recovery'}</h2>
  {action==='register'&&<label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}
  {['login','register','forgot-password'].includes(action)&&<label>Email address<input name="email" type="email" autoComplete="email" required/></label>}
  {action==='register'&&<><label>Verification method<select value={method} onChange={event=>setMethod(event.target.value as Method)}><option value="EMAIL">Email address</option><option value="PHONE">Phone number</option></select></label>{method==='PHONE'&&<label>Phone number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" pattern="\+?[1-9]\d{7,14}" required/><small>Use the international format, including country code.</small></label>}</>}
  {action==='verify-account'&&<><label>Verification method<select value={method} onChange={event=>setMethod(event.target.value as Method)}><option value="EMAIL">Email address</option><option value="PHONE">Phone number</option></select></label><label>{method==='EMAIL'?'Email address':'Phone number'}<input name="identifier" type={method==='EMAIL'?'email':'tel'} autoComplete={method==='EMAIL'?'email':'tel'} placeholder={method==='PHONE'?'+8801XXXXXXXXX':undefined} required/></label></>}
  {['login','register','reset-password'].includes(action)&&<label>Password<input name="password" type="password" autoComplete={action==='login'?'current-password':'new-password'} required minLength={action==='login'?1:12} maxLength={128}/>{action!=='login'&&<small>At least 12 characters, including upper case, lower case, and a number.</small>}</label>}
  {action==='register'&&<label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} data-match="password"/></label>}
  {error&&<Alert>{error}</Alert>}{message&&<p className="success-message" role="status">{message}</p>}
  <button className="button button-dark button-wide" disabled={busy||!ready}>{busy?'Please wait…':action==='login'?'Sign in':action==='register'?'Create account':action==='verify-account'?'Send OTP':'Continue'}</button>
  {action==='login'?<div className="auth-links"><Link href="/forgot-password">Forgot password?</Link><Link href="/register">Create an account →</Link><Link href="/verify-account">Verify account →</Link></div>:<p className="small-note"><Link href="/login">Back to sign in →</Link></p>}
 </form></main>;
}
