import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatus} from '../netlify/functions/artwork-job-status.mjs';
import {createWorker} from '../netlify/functions/artwork-job-work.mjs';
import {signature} from '../netlify/functions/lib/artwork-jobs.mjs';

const ID='12345678-1234-4234-9234-123456789abc';
const env=k=>({
 STITCH_FORGE_ANALYSIS_TOKEN:'owner-secret-test',
 STITCH_FORGE_WORKER_TOKEN:'worker-secret-test',
 STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'1'
})[k];
function storage(createdAt=1000){
 const map=new Map([
  ['state/'+ID,{status:'queued',createdAt}],
  ['input/'+ID,'private-test-input']
 ]);
 return {map,
  async get(key){return map.get(key)??null;},
  async set(key,value,{onlyIfNew=false}={}){
   if(onlyIfNew&&map.has(key))return {modified:false};
   map.set(key,value);return {modified:true};
  },
  async setJSON(key,value){map.set(key,value);return {modified:true};},
  async delete(key){map.delete(key);}
 };
}
const poll=()=>new Request('https://private.example/api/artwork-job-status?id='+ID,{
 headers:{Authorization:'Bearer owner-secret-test'}
});
test('job below startup threshold continues waiting without deleting artwork',async()=>{
 const data=storage(),status=createStatus({jobs:()=>data,env,now:()=>120999});
 const response=await status(poll());
 assert.equal((await response.json()).state,'queued');
 assert.equal(data.map.has('input/'+ID),true);
 assert.equal(data.map.has('lock/'+ID),false);
});
test('startup crash yields actionable failure and deletes private uploaded artwork',async()=>{
 const data=storage(),status=createStatus({jobs:()=>data,env,now:()=>121001});
 const response=await status(poll());
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.state,'failed');
 assert.match(result.error,/did not start/);
 assert.equal(data.map.has('input/'+ID),false);
 assert.equal(data.map.get('state/'+ID).status,'failed');
 assert.equal(data.map.has('lock/'+ID),true);
 // No delayed duplicate job is permitted once the queue timed out.
 const worker=createWorker({jobs:()=>data,env,bridge:()=>{throw Error('must not call Cloud Run');}});
 const late=await worker(new Request('https://private.example/api/artwork-job-work',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:ID,mac:signature(ID,env)})
 }));
 assert.equal(late.status,404);
});
test('polling does not override a worker that has already claimed its lock',async()=>{
 const data=storage();
 data.map.set('lock/'+ID,'claimed');
 const status=createStatus({jobs:()=>data,env,now:()=>121001});
 const result=await (await status(poll())).json();
 assert.equal(result.state,'queued');
 assert.equal(data.map.has('input/'+ID),true);
});
