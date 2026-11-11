import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorised,signature,validPacket,expired} from '../netlify/functions/lib/artwork-jobs.mjs';
import {createSubmit} from '../netlify/functions/artwork-job-submit.mjs';
import {createWorker} from '../netlify/functions/artwork-job-work.mjs';
import {createStatus} from '../netlify/functions/artwork-job-status.mjs';
import {createResult} from '../netlify/functions/artwork-job-result.mjs';
import artworkPipeline from '../site/artwork-pipeline.js';

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
  {...packet,requestId:'notsha'}, {...packet,rgbaGzip:null},
  {...packet,mode:'fine-detail'},{...packet,finish:'anything-else'}])
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

test('private V2 full-source input is deleted if background dispatch fails',async()=>{
 const jobs=store();
 const source=Buffer.alloc(180,17);
 Buffer.from([137,80,78,71,13,10,26,10]).copy(source,0);
 const origHeader=JSON.stringify({schema:'stitch-forge-artwork-request-v2',
  originalPng:{sha256:createHash('sha256').update(source).digest('hex'),
               bytes:source.length}});
 const body={...packet,header:origHeader,originalPngBase64:source.toString('base64')};
 assert.equal(validPacket(JSON.stringify(body)),true);
 const submit=createSubmit({jobs:()=>jobs,env:environment,
  generateId:()=>ID,
  dispatch:async()=>new Response(null,{status:503})});
 assert.deepEqual(await (await submit(request('/api/artwork-job-submit?mode=fine-detail'))).json(),{available:false});
 const closed=await submit(request('/api/artwork-job-submit',{
  method:'POST',headers,body:JSON.stringify({...body,mode:'fine-detail'})}));
 assert.equal(closed.status,503);
 assert.equal(jobs.map.size,0,'fine detail without a worker must not store the source');
 const response=await submit(request('/api/artwork-job-submit',{
  method:'POST',headers,body:JSON.stringify(body)}));
 assert.equal(response.status,502);
 assert.equal(jobs.map.has('input/'+ID),false,
  'Original customer source bytes must not remain stored after dispatch refusal');
 assert.equal(jobs.map.get('state/'+ID).status,'failed');
});

test('Fine Detail recognises a tagged multi-label Cloud Run host and refuses other hosts',async()=>{
 const readiness=request('/api/artwork-job-submit?mode=fine-detail');
 for(const [host,available] of [['fine-detail---worker-abc-ew.a.run.app',true],['fine-detail.example.net',false]]){
  const env=key=>key==='STITCH_FORGE_FINE_DETAIL_ENGINE_URL'?'https://'+host+'/v1/digitise':environment(key);
  assert.deepEqual(await (await createSubmit({env})(readiness)).json(),{available});
 }
});

const releaseRevision=process.env.STITCH_FORGE_RELEASE_WORKER_REVISION;
const fullImageReleaseUrl=process.env.STITCH_FORGE_FULL_IMAGE_RELEASE_URL;
test('configured Cloud Run worker exports audited embroidery files',{
 skip:!releaseRevision&&!fullImageReleaseUrl,timeout:480000
},async t=>{
 // Only enabled for a release check in the existing private Netlify build.
 // This PNG is a synthetic two-colour rectangle on transparent pixels.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAIAAAABgCAYAAADVenpJAAAAyUlEQVR42u3cUQ2AIBRAUXQGsITfpjGEEUxgBEOYxm9L0EBDoHMPzwnA2OOOP0gJAAAAAAAAAKhNU7pAP6+XMX4nb0vRGbZG+G8CEAACQAAIAAEgAASAABAAAkAACAABUKsuwibPcQ832OGY3AAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAATwnxP0CUt/ZuAASAABAAAkAACAABIAAEgAAQAAJAAAgAAAAAAAAAAICX3KjTCM9kmIm6AAAAAElFTkSuQmCC','base64');
 const fullImage=Boolean(fullImageReleaseUrl);
 // The Full image sample has the same two colours and reaches every edge.
 const originalPng=fullImage?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAIAAAABgCAYAAADVenpJAAAA3UlEQVR42u3cQQ2AMBBFQSAVUBM9owYRKKmYquGMGDBBDz/MKNhsXvbWrvXsz8JvbVYgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAAJCgJQ977iFtsuw4XAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAuArEf8DpLy1dwEQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAAJnkBjCUHDtmgJjcAAAAASUVORK5CYII=','base64'):png;
 const width=128,height=96,rgba=new Uint8ClampedArray(width*height*4);
 const margin=fullImage?0:16;
 for(let y=margin;y<height-margin;y++)for(let x=margin;x<width-margin;x++){
  const inset=y>=32&&y<64&&x>=41&&x<86;
  rgba.set(inset?[235,152,50,255]:[16,105,135,255],(y*width+x)*4);
 }
 const endpoint=fullImageReleaseUrl||process.env.STITCH_FORGE_ENGINE_URL;
 const token=process.env.STITCH_FORGE_ANALYSIS_TOKEN;
 assert.ok(endpoint&&token,'Release worker and owner settings must be available to the check');
 // Supply the release target to the in-memory job handlers during the build.
 const env=key=>key==='STITCH_FORGE_FINE_DETAIL_ENGINE_URL'?endpoint:process.env[key];
 for(const fineDetail of fullImage?[true]:[false,true]){
  const mode=fullImage?'Full image':fineDetail?'Fine Detail':'Standard';
  const jobs=store(),settings={jobs:()=>jobs,env};
  const work=createWorker(settings);
  const submit=createSubmit({...settings,dispatch:async (url,{method,headers,body})=>{
   await work(new Request(url,{method,headers,body}));
   return new Response(null,{status:202});
  }});
  const handlers={'/api/artwork-job-submit':submit,'/api/artwork-job-status':createStatus(settings),
   '/api/artwork-job-result':createResult(settings)};
  const fetchImpl=(path,options)=>handlers[path.split('?')[0]](request(path,options));
  const packed=await artworkPipeline.pack(rgba,width,height,{imageWidthMm:40,sizeMode:fullImage?'canvas':'visible',
   originalPngBytes:fineDetail?originalPng:null,fullImage});
  const {report,bytes}=await artworkPipeline.generate(packed,{token,fetchImpl,background:true,fineDetail});
  if(fullImage){
   assert.equal(report.sourceBinding?.fullImage,true,'Full image source binding');
   assert.match(report.workerRevision,/^stitch-forge-worker-staging-[0-9]+-[a-z0-9]+$/);
  }else assert.equal(report.workerRevision,releaseRevision,mode+' worker revision');
  assert.ok(report.stitchPlanning?.adaptiveArtworkLayout,mode+' adaptive stitch planning');
  assert.ok((await artworkPipeline.readArchive(bytes))['SEW_OUT_CHECKLIST.txt'],mode+' sew-out checklist');
  t.diagnostic(`${mode} checked ${report.decoded[0].needleStitches} decoded needle stitches in PES and DST on ${report.workerRevision}`);
 }
});
