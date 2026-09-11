import { apiOrigin } from '@/lib/server-api';
export const dynamic='force-dynamic';
async function proxy(request:Request,context:{params:Promise<{path:string[]}>}){
  const {path}=await context.params;
  if(!path.length||path.some(p=>!/^[-a-zA-Z0-9_.]+$/.test(p)||p==='.'||p==='..'))return Response.json({error:{message:'Invalid API path.'}},{status:400});
  const url=new URL(request.url);
  const incomingOrigin=request.headers.get('origin');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&incomingOrigin&&incomingOrigin!==url.origin)return Response.json({error:{message:'Untrusted request origin.'}},{status:403});
  const headers=new Headers();
  for(const name of ['content-type','cookie','x-csrf-token']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  headers.set('origin',url.origin);
  try {
    const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
    if(body&&body.byteLength>6*1024*1024)return Response.json({error:{message:'Upload exceeds the size limit.'}},{status:413});
    const response=await fetch(`${apiOrigin()}/api/v1/${path.join('/')}${url.search}`,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(75000)});
    const outgoing=new Headers();
    for(const name of ['content-type','content-disposition','x-content-type-options']){const value=response.headers.get(name);if(value)outgoing.set(name,value);}
    outgoing.set('Cache-Control','no-store');
    for(const cookie of response.headers.getSetCookie())outgoing.append('Set-Cookie',cookie);
    return new Response(response.body,{status:response.status,headers:outgoing});
  }catch{return Response.json({error:{message:'Our service is temporarily unavailable. Please try again shortly.'}},{status:503});}
}
export {proxy as GET,proxy as POST,proxy as PATCH,proxy as DELETE};
