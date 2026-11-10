/* Authenticated, consent-triggered image generation submission.
 * The paid AI request runs only in a private background worker.
 */
import {authorised,getEnv,getJobs,newId,signature,json,HEADERS,validateJob} from './lib/cuteifier-jobs.mjs';
export function createSubmit({jobs=getJobs,dispatch=(...args)=>fetch(...args),env=getEnv,generateId=newId,now=()=>Date.now()}={}){
 return async request=>{
  if(request.method!=='POST')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Enter your private Stitch Forge access token to use the paid AI redraw.'});
  if(!env('OPENAI_API_KEY')||!env('STITCH_FORGE_WORKER_TOKEN'))return json(503,{error:'AI image editing is not configured on the website.'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json(415,{error:'JSON required'});
  let data;
  try{
   if(Number(request.headers.get('content-length')||0)>2300000)return json(413,{error:'Source image is too large'});
   const body=await request.text();if(body.length>2300000)return json(413,{error:'Source image is too large'});
   data=validateJob(JSON.parse(body));
  }catch(error){return json(422,{error:'Unable to read a valid source image: '+String(error?.message||'Invalid file').slice(0,100)});}
  const id=generateId(),createdAt=now();let store=null;
  try{
   store=jobs();
   await store.set('input/'+id,JSON.stringify(data));
   await store.setJSON('state/'+id,{status:'queued',createdAt});
   const response=await dispatch(new URL('/api/cuteifier-work',request.url),{
    method:'POST',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,mac:signature(id,env)}),signal:AbortSignal.timeout(9000)
   });
   if(response.status!==202){
    await store.setJSON('state/'+id,{status:'failed',createdAt,error:'Unable to start the image editor.'});
    await store.delete('input/'+id).catch(()=>{});
    return json(502,{error:'The image editor did not start. Your artwork has not been processed.'});
   }
   return json(202,{jobId:id,status:'queued'});
  }catch{
   if(store)await store.delete('input/'+id).catch(()=>{});
   return json(503,{error:'Private image job storage is unavailable. No image generation was confirmed.'});
  }
 };
}
export default createSubmit();
export const config={path:'/api/cuteifier-submit',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:3}};
