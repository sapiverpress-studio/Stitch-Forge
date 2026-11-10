/* Private WebP art is delivered to the browser; the browser converts to PNG. */
import {authorised,JOB_ID,getJobs,getEnv,expired,json,HEADERS} from './lib/cuteifier-jobs.mjs';
export function createResult({jobs=getJobs,env=getEnv,now=()=>Date.now()}={}){
 return async request=>{
  if(request.method!=='GET')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!JOB_ID.test(id))return json(404,{error:'Image job not found'});
  try{
   const store=jobs(),state=await store.get('state/'+id,{type:'json'});
   if(!state)return json(404,{error:'Image job not found'});
   if(expired(state,now()))return json(410,{error:'Image job expired'});
   if(state.status!=='done'||state.format!=='webp'||state.bytes<100||state.bytes>4500000)
    return json(409,{error:'The requested image is not ready'});
   const bytes=await store.get('output/'+id,{type:'arrayBuffer'});
   if(!bytes||bytes.byteLength!==state.bytes)return json(503,{error:'Prepared image not available'});
   return new Response(bytes,{status:200,headers:{...HEADERS,'Content-Type':'image/webp','Content-Length':String(bytes.byteLength)}});
  }catch{return json(503,{error:'Unable to retrieve the image'});}
 };
}
export default createResult();
export const config={path:'/api/cuteifier-result'};
