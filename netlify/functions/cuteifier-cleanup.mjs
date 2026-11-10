/* Remove private source/output after the short retrieval window. */
import {getJobs,expired,JOB_ID,HEADERS} from './lib/cuteifier-jobs.mjs';
export function createCleanup({jobs=getJobs,now=()=>Date.now()}={}){
 return async ()=>{
  const store=jobs();
  const entries=await store.list({prefix:'state/'});
  let removed=0;
  for(const {key} of entries.blobs.slice(0,400)){
   const id=key.slice('state/'.length);
   if(!JOB_ID.test(id))continue;
   const record=await store.get(key,{type:'json'});
   if(!expired(record,now()))continue;
   for(const prefix of ['input/','output/','lock/','state/'])
    await store.delete(prefix+id).catch(()=>{});
   removed++;
  }
  return new Response(null,{status:204,headers:HEADERS});
 };
}
export default createCleanup();
export const config={schedule:'15 */6 * * *'};
