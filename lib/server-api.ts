import type { Product, PageResult } from './catalog';
export const apiOrigin=()=>process.env.API_URL??'http://127.0.0.1:4000';
export async function serverApi<T>(path:string):Promise<T>{const response=await fetch(`${apiOrigin()}/api/v1/${path}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`Catalog service returned ${response.status}`);return response.json() as Promise<T>;}
export const getProducts=(query='')=>serverApi<PageResult<Product>>(`products${query?`?${query}`:''}`);
