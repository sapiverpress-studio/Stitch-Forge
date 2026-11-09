/* Temporary hosted acceptance route. The lease authorises one exact packet
 * and only its own resulting job. Removed after preview verification. */
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import submit from './artwork-job-submit.mjs';
import status from './artwork-job-status.mjs';
import result from './artwork-job-result.mjs';
import {boundedBytes} from './artwork-embroidery.mjs';
import {getEnv,JOB_ID,json,HEADERS} from './lib/artwork-jobs.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>/^[a-f0-9]{64}$/.test(a||'')&&/^[a-f0-9]{64}$/.test(b||'')&&
 timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const unavailable=()=>new Response(null,{status:404,headers:HEADERS});

export default async function previewCheck(request){
 const url=new URL(request.url);
 const [until,key,fixture]=(getEnv('STITCH_FORGE_DETAILED_MOTIF_CHECK')||'').split(':');
 const now=Math.floor(Date.now()/1000);
 const auth=request.headers.get('authorization')||'';
 if(!url.hostname.startsWith('deploy-preview-2--')||!/^\d{10}$/.test(until||'')||
    Number(until)<now||Number(until)-now>1200||
    !/^Bearer [a-f0-9]{64}$/.test(auth)||!same(hash(auth.slice(7)),key))return unavailable();
 const owner=getEnv('STITCH_FORGE_ANALYSIS_TOKEN'),worker=getEnv('STITCH_FORGE_WORKER_TOKEN');
 if(!owner||!worker)return unavailable();
 const headers={Authorization:'Bearer '+owner};
 const proof=id=>createHmac('sha256',worker).update('stitch-forge-preview-check:'+key+':'+id).digest('hex');
 if(request.method==='POST'){
  let body;
  try{body=await boundedBytes(request.body,4000000);}catch{return unavailable();}
  if(!same(hash(body),fixture))return unavailable();
  const submission=await submit(new Request(new URL('/api/artwork-job-submit',url),
   {method:'POST',headers:{...headers,'Content-Type':'application/json'},body}));
  if(submission.status!==202)return submission;
  const {jobId}=await submission.json();
  if(!JOB_ID.test(jobId))return unavailable();
  return json(202,{jobId,proof:proof(jobId)});
 }
 const id=url.searchParams.get('id')||'';
 if(request.method!=='GET'||!JOB_ID.test(id)||!same(request.headers.get('x-preview-job-proof'),proof(id)))return unavailable();
 const path=url.searchParams.get('view')==='result'?'result':'status';
 return (path==='result'?result:status)(new Request(new URL('/api/artwork-job-'+path+'?id='+id,url),{headers}));
}

export const config={path:'/api/detailed-motif-preview-check'};
