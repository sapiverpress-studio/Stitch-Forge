/* Synchronous, authenticated job submission; no native processing here. */
import {authorised,bodyText,validPacket,getJobs,getEnv,newJobId,signature,json,HEADERS} from './lib/artwork-jobs.mjs';
export function createSubmit({jobs=getJobs,dispatch=(...args)=>fetch(...args),env=getEnv,generateId=newJobId,now=()=>Date.now()}={}){
 return async function submit(request){
  if(request.method!=='POST')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  if(env('STITCH_FORGE_ARTWORK_TRIAL_ENABLED')!=='1')return json(503,{error:'Native artwork trial unavailable'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json(415,{error:'JSON required'});
  let body;
  try{body=await bodyText(request);if(!validPacket(body))return json(422,{error:'Invalid bounded native artwork packet'});}
  catch{return json(413,{error:'Artwork exceeds submission budget'});}
  const id=generateId(),createdAt=now();
  try{
   const store=jobs();
   await store.set('input/'+id,body);
   await store.setJSON('state/'+id,{status:'queued',createdAt});
   const target=new URL('/api/artwork-job-work',request.url);
   const response=await dispatch(target,{method:'POST',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({id,mac:signature(id,env)}),
    signal:AbortSignal.timeout(9000)});
   if(response.status!==202){
    await store.setJSON('state/'+id,{status:'failed',createdAt,error:'Background worker could not start'});
    return json(502,{error:'Background worker could not start'});
   }
   return json(202,{jobId:id,status:'queued'});
  }catch{
   return json(503,{error:'Private artwork job storage or dispatch unavailable'});
  }
 };
}
export default createSubmit();
export const config={path:'/api/artwork-job-submit'};
