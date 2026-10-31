/* Delete completed/abandoned private artwork after its retention window.
 * Scheduled once daily; bounded so cleanup never consumes job runtime.
 */
import {getJobs,MAX_AGE_MS} from './lib/artwork-jobs.mjs';
export async function cleanup({store=getJobs(),now=()=>Date.now()}={}){
 let checked=0,removed=0;
 for await (const page of store.list({prefix:'state/',paginate:true})){
  for(const item of page.blobs){
   if(checked++>=200)return {checked,removed,truncated:true};
   const id=item.key.slice('state/'.length);
   if(!/^[a-f0-9-]{36}$/i.test(id))continue;
   const state=await store.get(item.key,{type:'json'}).catch(()=>null);
   if(!state||!Number.isFinite(state.createdAt)||now()-state.createdAt<MAX_AGE_MS)continue;
   await Promise.allSettled(['state/','input/','output/','lock/'].map(prefix=>store.delete(prefix+id)));
   removed++;
  }
 }
 return {checked,removed,truncated:false};
}
export default async()=>{await cleanup();return new Response(null,{status:204});};
export const config={schedule:'17 3 * * *'};
