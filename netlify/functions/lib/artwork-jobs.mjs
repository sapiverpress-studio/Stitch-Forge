/* Private, bounded artwork jobs. No artwork or credentials are public. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const MAX_BYTES=4000000;
export const MAX_AGE_MS=8*60*60*1000;
export const STORE_NAME='stitch-forge-artwork-jobs-v1';
export const JOB_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const HEADERS=Object.freeze({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
export const getEnv=name=>globalThis.Netlify?.env?.get(name)??process.env[name];
export const getJobs=()=>getStore({name:STORE_NAME,consistency:'strong'});
export const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...HEADERS,'Content-Type':'application/json'}});

function equal(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export function authorised(request,env=getEnv){
 const header=request.headers.get('authorization');
 const secret=env('STITCH_FORGE_ANALYSIS_TOKEN');
 return !!(secret&&header?.startsWith('Bearer ')&&equal(header.slice(7),secret));
}
export function signature(id,env=getEnv){
 const secret=env('STITCH_FORGE_WORKER_TOKEN');
 if(!secret||!JOB_ID.test(id))throw Error('Artwork job signing unavailable');
 return createHmac('sha256',secret).update('STITCH_FORGE_BACKGROUND_PHASE_V1:').update(id).digest('hex');
}
export function signed(id,mac,env=getEnv){
 try{return !!(typeof mac==='string'&&/^[0-9a-f]{64}$/.test(mac)&&equal(signature(id,env),mac));}
 catch{return false;}
}
export function newJobId(){return randomUUID();}
export function expired(record,now=Date.now()){
 return !record||!Number.isFinite(record.createdAt)||now-record.createdAt>MAX_AGE_MS||now<record.createdAt-60000;
}
export function validPacket(body){
 if(typeof body!=='string'||Buffer.byteLength(body)>MAX_BYTES||Buffer.byteLength(body)<60)return false;
 let obj;try{obj=JSON.parse(body)}catch{return false;}
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||typeof obj.header!=='string'||obj.header.length>2000||
  !/^[0-9a-f]{64}$/.test(obj.requestId||'')||
  typeof obj.rgbaGzip!=='string'||typeof obj.labelsGzip!=='string'||
  obj.rgbaGzip.length>3200000||obj.labelsGzip.length>1000000)return false;
 const keys=['header','rgbaGzip','labelsGzip','requestId'];
 if('profile' in obj){
  let header;
  try{header=JSON.parse(obj.header);}catch{return false;}
  if(obj.profile!=='detailed_motif'||header?.schema!=='stitch-forge-artwork-request-v1'||
     header.texturePolicy!=='off'||'originalPngBase64' in obj)return false;
  keys.push('profile');
 }
 if('originalPngBase64' in obj){
  let header;
  try{header=JSON.parse(obj.header);}catch{return false;}
  if(header?.schema!=='stitch-forge-artwork-request-v2'||
     !header.originalPng||typeof header.originalPng!=='object'||
     !/^[0-9a-f]{64}$/.test(header.originalPng.sha256||'')||
     !Number.isInteger(header.originalPng.bytes)||
     header.originalPng.bytes<100||header.originalPng.bytes>2450000||
     typeof obj.originalPngBase64!=='string'||obj.originalPngBase64.length>3266672||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(obj.originalPngBase64))
   return false;
  keys.push('originalPngBase64');
 }else if(obj.header.includes('stitch-forge-artwork-request-v2'))return false;
 return Object.keys(obj).sort().join(',')===keys.sort().join(',');
}
export async function bodyText(request,max=MAX_BYTES){
 if(Number(request.headers.get('content-length')||0)>max)throw Error('Artwork request too large');
 const input=await request.arrayBuffer();
 if(input.byteLength>max)throw Error('Artwork request too large');
 return Buffer.from(input).toString('utf8');
}
