/* Owner-only job state; no private source, prompts, credentials or thumbnails. */
import {authorised,JOB_ID,getJobs,getEnv,expired,json,HEADERS} from './lib/cuteifier-jobs.mjs';
export function createStatus({jobs=getJobs,env=getEnv,now=()=>Date.now()}={}){
 return async request=>{
  if(request.method!=='GET')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!JOB_ID.test(id))return json(404,{error:'Image job not found'});
  try{
   const record=await jobs().get('state/'+id,{type:'json'});
   if(!record)return json(404,{error:'Image job not found'});
   if(expired(record,now()))return json(410,{error:'This image job has expired'});
   if(!['queued','running','done','failed'].includes(record.status))
    return json(502,{error:'Invalid image job status'});
   return json(200,{state:record.status,
    ...(record.status==='failed'?{error:record.error||'The AI editor could not finish.'}:{})});
  }catch{return json(503,{error:'Image job status is temporarily unavailable'});}
 };
}
export default createStatus();
export const config={path:'/api/cuteifier-status',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:60}};
