/* Deliver private native output only after background completion. */
import {authorised,JOB_ID,getJobs,getEnv,expired,json,HEADERS} from './lib/artwork-jobs.mjs';
export function createResult({jobs=getJobs,env=getEnv,now=()=>Date.now()}={}){
 return async function result(request){
  if(request.method!=='GET')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!JOB_ID.test(id))return json(404,{error:'Artwork job not found'});
  try{
   const store=jobs(),record=await store.get('state/'+id,{type:'json'});
   if(!record)return json(404,{error:'Artwork job not found'});
   if(expired(record,now()))return json(410,{error:'Artwork job expired'});
   if(record.status!=='done')return json(409,{error:'Artwork is still processing or failed'});
   if(record.status!=='done'||record.audit!=='SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED'||!(/^[0-9a-f]{64}$/).test(record.sha||''))
    return json(502,{error:'Native job metadata invalid'});
   const bytes=await store.get('output/'+id,{type:'arrayBuffer'});
   if(!bytes||bytes.byteLength<20||bytes.byteLength>3000000)return json(503,{error:'Verified native output unavailable'});
   const headers={...HEADERS,'Content-Type':'application/zip',
    'X-Stitch-Forge-Audit':record.audit,'X-Stitch-Forge-SHA256':record.sha};
   return new Response(bytes,{status:200,headers});
  }catch{return json(503,{error:'Private native output unavailable'});}
 };
}
export default createResult();
export const config={path:'/api/artwork-job-result'};
