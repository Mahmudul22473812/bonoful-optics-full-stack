import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const work=resolve(root,'../work');
mkdirSync(work,{recursive:true});
const password=randomBytes(24).toString('hex');
const credentialsPath=resolve(work,'postgres-password.txt');
if(!existsSync(resolve(root,'backend/.env'))) {
  writeFileSync(credentialsPath,password,{mode:0o600});
  const env=`NODE_ENV=development\nPORT=4000\nDATABASE_URL=postgresql://bonoful:${password}@127.0.0.1:55432/bonoful?schema=public\nWEB_ORIGIN=http://localhost:3000\nDATA_KEY=${randomBytes(32).toString('hex')}\nFILE_ROOT=./storage\nSEED_ADMIN_EMAIL=admin@bonoful.local\nSEED_ADMIN_PASSWORD=B0!${randomBytes(18).toString('hex')}\nSEED_STAFF_EMAIL=staff@bonoful.local\nSEED_STAFF_PASSWORD=B0!${randomBytes(18).toString('hex')}\nSEED_CUSTOMER_EMAIL=customer@bonoful.local\nSEED_CUSTOMER_PASSWORD=B0!${randomBytes(18).toString('hex')}\n`;
  writeFileSync(resolve(root,'backend/.env'),env,{mode:0o600});
}
if(!existsSync(resolve(root,'.env.local'))) writeFileSync(resolve(root,'.env.local'),'API_URL=http://127.0.0.1:4000\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\n',{mode:0o600});
console.log('Local environment is ready. Credentials stay in backend/.env.');
