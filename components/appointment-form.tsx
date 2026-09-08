'use client';
import { useState } from 'react';
import { send, errorMessage } from '@/lib/api';
import { Alert } from './ui';
export function AppointmentForm() {
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const fields=new FormData(form);setBusy(true);setError('');try{const result=await send<{message:string}>('appointments',{name:fields.get('name'),email:fields.get('email'),phone:fields.get('phone'),service:fields.get('service'),preferredAt:new Date(String(fields.get('preferredAt'))).toISOString()});setMessage(result.message);form.reset();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>
    <div className="form-grid"><label>Name<input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Phone<input name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel"/></label><label>Service<select name="service"><option>Eye examination</option><option>Lens consultation</option><option>Frame fitting</option></select></label><label className="span-two">Preferred date and time<input name="preferredAt" type="datetime-local" required/></label></div>
    <p className="small-note">This is a request, not a confirmed booking. The store will confirm availability and any charges before your visit.</p>{error&&<Alert>{error}</Alert>}{message&&<p role="status">{message}</p>}<button className="button button-dark" disabled={busy}>{busy?'Sending…':'Request appointment'}</button>
  </form>;
}
