export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
let csrf='';
export const setCsrf=(value:string)=>{csrf=value;};
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const isForm=typeof FormData!=='undefined'&&options.body instanceof FormData;
  const response=await fetch(`/api/v1/${path}`,{...options,credentials:'same-origin',cache:'no-store',headers:{...(isForm?{}:{'Content-Type':'application/json'}),...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
  const data=await response.json().catch(()=>({error:{message:'The service is temporarily unavailable.'}})) as {error?:{message:string|string[]}};
  if(!response.ok){const message=data.error?.message;throw new ApiError(Array.isArray(message)?message.join(' '):message??'Request failed.',response.status);}
  return data as T;
}
export const send=<T>(path:string,body:unknown,method='POST')=>api<T>(path,{method,body:JSON.stringify(body)});
export const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Please try again.';
