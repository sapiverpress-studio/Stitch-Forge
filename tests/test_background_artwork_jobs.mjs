import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorised,signature,validPacket,expired} from '../netlify/functions/lib/artwork-jobs.mjs';
import {createSubmit} from '../netlify/functions/artwork-job-submit.mjs';
import {createWorker} from '../netlify/functions/artwork-job-work.mjs';
import {createStatus} from '../netlify/functions/artwork-job-status.mjs';
import {createResult} from '../netlify/functions/artwork-job-result.mjs';

const ID='12345678-1234-4234-9234-123456789abc',SOURCE='a'.repeat(64);
const packet={header:'header',rgbaGzip:'AAA===',labelsGzip:'AAA===',requestId:SOURCE};
const owner='private-owner-token',workerSecret='private-worker-token';
function environment(key){
 return {STITCH_FORGE_ANALYSIS_TOKEN:owner,STITCH_FORGE_WORKER_TOKEN:workerSecret,
  STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'1'}[key];
}
function store(){
 const map=new Map();
 return {
  map,
  async set(k,val,opts={}){if(opts.onlyIfNew&&map.has(k))return {modified:false};
   map.set(k,val);return {modified:true};},
  async setJSON(k,v){map.set(k,structuredClone(v));return {modified:true};},
  async get(k,opts={}){if(!map.has(k))return null;const v=map.get(k);
   if(opts.type==='json')return structuredClone(v);
   if(opts.type==='arrayBuffer')return v instanceof Blob?v.arrayBuffer():new Blob([v]).arrayBuffer();
   return v;},
  async delete(k){map.delete(k);}
 };
}
const headers={Authorization:'Bearer '+owner,'Content-Type':'application/json'};
const request=(path,options={})=>new Request('https://example.netlify.app'+path,options);
function fixture(){
 const jobs=store(),image={...packet};
 const pes=Buffer.concat([Buffer.from('#PES0060'),Buffer.alloc(60,42)]);
 const zip=Buffer.concat([Buffer.from('PK\x03\x04'),Buffer.alloc(160,11)]);
 const digest=x=>createHash('sha256').update(x).digest('hex');
 let phases=[];
 const receipt={requestId:SOURCE,pesSha256:digest(pes),svgSha256:'c'.repeat(64),mac:'d'.repeat(64)};
 const bridge=()=>async req=>{
  const body=await req.json();phases.push(body.phase);
  assert.equal(body.requestId,SOURCE);
  if(body.phase==='pes')return Response.json({requestId:SOURCE,pesBase64:pes.toString('base64'),receipt});
  if(body.phase==='dst'){
   assert.equal(body.receipt.pesSha256,receipt.pesSha256);
   return new Response(zip,{headers:{'Content-Type':'application/zip',
    'X-Stitch-Forge-Audit':'SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED',
    'X-Stitch-Forge-SHA256':digest(zip)}});
  }
  throw Error('Unexpected phase');
 };
 const work=createWorker({jobs:()=>jobs,env:environment,bridge});
 const dispatch=async (_url,options)=>{
  assert.equal(options.method,'POST');
  // The real endpoint returns 202 immediately; simulated worker finishes later.
  await work(request('/api/artwork-job-work',{method:'POST',headers:options.headers,body:options.body}));
  return new Response(null,{status:202});
 };
 const submit=createSubmit({jobs:()=>jobs,dispatch,env:environment,generateId:()=>ID});
 const status=createStatus({jobs:()=>jobs,env:environment});
 const result=createResult({jobs:()=>jobs,env:environment});
 return {jobs,submit,status,result,work,phases,receipt,zip,image};
}

test('bounded source packet is schema-bound and rejects attempts to inject a phase or secret',()=>{
 assert.equal(validPacket(JSON.stringify(packet)),true);
 for(const forged of [{...packet,phase:'dst'},{...packet,workerToken:'foo'},
  {...packet,requestId:'notsha'}, {...packet,rgbaGzip:null}])
  assert.equal(validPacket(JSON.stringify(forged)),false);
 assert.equal(expired({createdAt:1000},1000+8*3600_000+1),true);
});
test('an unrecognised owner cannot submit, poll or retrieve any private artwork',async()=>{
 const f=fixture(),bad={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet)};
 assert.equal((await f.submit(request('/api/artwork-job-submit',bad))).status,401);
 assert.equal((await f.status(request('/api/artwork-job-status?id='+ID))).status,401);
 assert.equal((await f.result(request('/api/artwork-job-result?id='+ID))).status,401);
 assert.equal(f.jobs.map.size,0);
});
test('one queued job completes both native phases, preserves bound receipt and releases an audited ZIP',async()=>{
 const f=fixture();
 const submission=await f.submit(request('/api/artwork-job-submit',{method:'POST',headers,body:JSON.stringify(packet)}));
 assert.equal(submission.status,202);
 assert.equal((await submission.json()).jobId,ID);
 assert.deepEqual(f.phases,['pes','dst']);
 const state=await f.status(request('/api/artwork-job-status?id='+ID,{headers:{Authorization:'Bearer '+owner}}));
 assert.equal(state.status,200);
 const body=await state.json();
 assert.equal(body.state,'done');assert.equal(body.receipt.svgSha256,f.receipt.svgSha256);
 const downloaded=await f.result(request('/api/artwork-job-result?id='+ID,{headers:{Authorization:'Bearer '+owner}}));
 assert.equal(downloaded.status,200);
 assert.equal(downloaded.headers.get('x-stitch-forge-audit'),'SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED');
 assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),f.zip);
 assert.equal(f.jobs.map.has('input/'+ID),false);
});
test('tampered dispatch signatures and repeated dispatches do not start duplicate native processing',async()=>{
 const f=fixture(),input=JSON.stringify(packet);
 f.jobs.map.set('input/'+ID,input);f.jobs.map.set('state/'+ID,{status:'queued',createdAt:Date.now()});
 const fail=await f.work(request('/api/artwork-job-work',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:ID,mac:'0'.repeat(64)})}));
 assert.equal(fail.status,403);assert.deepEqual(f.phases,[]);
 const valid={method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:ID,mac:signature(ID,environment)})};
 assert.equal((await f.work(request('/api/artwork-job-work',valid))).status,204);
 assert.equal((await f.work(request('/api/artwork-job-work',valid))).status,404);
 assert.deepEqual(f.phases,['pes','dst']);
});
test('native worker errors fail closed without output or browser fallback',async()=>{
 const f=fixture(),broken=createWorker({jobs:()=>f.jobs,env:environment,
  bridge:()=>async()=>new Response(JSON.stringify({error:'Engine timed out'}),{status:504,headers:{'Content-Type':'application/json'}})});
 f.jobs.map.set('input/'+ID,JSON.stringify(packet));
 f.jobs.map.set('state/'+ID,{status:'queued',createdAt:Date.now()});
 await broken(request('/api/artwork-job-work',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:ID,mac:signature(ID,environment)})}));
 const state=await f.status(request('/api/artwork-job-status?id='+ID,{headers:{Authorization:'Bearer '+owner}}));
 assert.equal((await state.json()).state,'failed');
 assert.equal(f.jobs.map.has('output/'+ID),false);
 assert.equal((await f.result(request('/api/artwork-job-result?id='+ID,{headers:{Authorization:'Bearer '+owner}}))).status,409);
});
