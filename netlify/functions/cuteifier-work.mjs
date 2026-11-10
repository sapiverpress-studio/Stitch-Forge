/* Private long-running AI image edit; bounded input, output and no public API key. */
import {signed,JOB_ID,getJobs,getEnv,expired,HEADERS,buildPrompt,imageBytes} from './lib/cuteifier-jobs.mjs';
function codeOf(status){
 if(status===401||status===403)return 'The configured OpenAI API key or image-model access was rejected.';
 if(status===429)return 'OpenAI reached a rate limit or billing limit. Check API usage and retry later.';
 if(status===400||status===422)return 'The image editing provider rejected the artwork or settings.';
 if(status>=500)return 'The image editing provider is temporarily unavailable.';
 return 'The AI image edit could not be completed.';
}
export function createWorker({jobs=getJobs,env=getEnv,invoke=(...args)=>fetch(...args),now=()=>Date.now()}={}){
 return async request=>{
  if(request.method!=='POST')return new Response(null,{status:405,headers:HEADERS});
  let id,mac;
  try{
   const body=await request.text();if(body.length>400)throw Error('oversized');
   ({id,mac}=JSON.parse(body));
  }catch{return new Response(null,{status:400,headers:HEADERS});}
  if(!JOB_ID.test(id)||!signed(id,mac,env))return new Response(null,{status:403,headers:HEADERS});
  const store=jobs(),state=await store.get('state/'+id,{type:'json'});
  if(expired(state,now())||!['queued','running'].includes(state.status))
   return new Response(null,{status:404,headers:HEADERS});
  const claim=await store.set('lock/'+id,'claimed',{onlyIfNew:true});
  if(!claim.modified)return new Response(null,{status:204,headers:HEADERS});
  const createdAt=state.createdAt;
  try{
   await store.setJSON('state/'+id,{status:'running',createdAt});
   const input=await store.get('input/'+id);
   if(!input||input.length>2300000)throw Error('Private reference image is missing.');
   const job=JSON.parse(input),key=env('OPENAI_API_KEY');
   const mode=job.mode||'cutout',size=job.size||'1024x1024';
   if(!key)throw Error('OpenAI editing is not configured.');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),210000);
   let response;
   try{
    response=await invoke('https://api.openai.com/v1/images/edits',{
     method:'POST',signal:controller.signal,
     headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
     body:JSON.stringify({
      model:'gpt-image-2.5-sunburst',
      images:[{image_url:job.image}],
      prompt:buildPrompt(job),
      size,quality:'high',n:1,
      background:mode==='full-design'?'opaque':'transparent',output_format:'webp',output_compression:90
     })
    });
   }finally{clearTimeout(timer);}
   if(!response.ok)throw Error(codeOf(response.status));
   const answer=await response.json();
   if(answer?.output_format && answer.output_format!=='webp')
    throw Error('AI returned an unexpected image format.');
   const image=imageBytes(answer?.data?.[0]?.b64_json);
   await store.set('output/'+id,new Blob([image],{type:'image/webp'}));
   await store.setJSON('state/'+id,{status:'done',createdAt,bytes:image.length,format:'webp',mode});
  }catch(error){
   const message=error?.name==='AbortError'?'The AI image editor timed out. Please try again later.':
    String(error?.message||'AI image generation failed.').slice(0,200);
   await store.setJSON('state/'+id,{status:'failed',createdAt,error:message}).catch(()=>{});
  }finally{
   await store.delete('input/'+id).catch(()=>{});
  }
  return new Response(null,{status:204,headers:HEADERS});
 };
}
export default createWorker();
export const config={path:'/api/cuteifier-work',background:true};
