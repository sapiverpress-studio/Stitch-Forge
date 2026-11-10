import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmit} from '../netlify/functions/cuteifier-submit.mjs';
import {createWorker} from '../netlify/functions/cuteifier-work.mjs';
import {createStatus} from '../netlify/functions/cuteifier-status.mjs';
import {createResult} from '../netlify/functions/cuteifier-result.mjs';
import {createCleanup} from '../netlify/functions/cuteifier-cleanup.mjs';
import {validateJob,buildPrompt,imageBytes,signature} from '../netlify/functions/lib/cuteifier-jobs.mjs';
import {readFileSync} from 'node:fs';

const NOW=Date.UTC(2026,10,10,7,55,0);
const UUID='06d51272-ae23-4a38-91a5-dd25b9a6e001';
const fakeWebp=()=>{
 const value=Buffer.alloc(200);
 value.write('RIFF',0,'ascii');value.writeUInt32LE(192,4);value.write('WEBP',8,'ascii');
 value.write('VP8 ',12,'ascii');
 return value;
};
const input='data:image/webp;base64,'+fakeWebp().toString('base64');
const env=name=>({
 STITCH_FORGE_ANALYSIS_TOKEN:'test-owner-token',
 STITCH_FORGE_WORKER_TOKEN:'test-worker-token',
 OPENAI_API_KEY:'test-provider-key'
})[name];
class Store{
 constructor(){this.data=new Map();}
 async set(k,v,opt={}){
  if(opt.onlyIfNew&&this.data.has(k))return {modified:false};
  this.data.set(k,typeof v==='string'?v:Buffer.isBuffer(v)?v:
   v instanceof Blob?Buffer.from(await v.arrayBuffer()):v);
  return {modified:true};
 }
 async setJSON(k,v){this.data.set(k,JSON.stringify(v));}
 async get(k,opts={}){
  const v=this.data.get(k);if(v===undefined)return null;
  if(opts.type==='json')return JSON.parse(v);
  if(opts.type==='arrayBuffer'){
   const bytes=Buffer.from(v);
   return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  }
  return v;
 }
 async delete(k){this.data.delete(k);}
 async list({prefix=''}){return {blobs:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key,etag:'test'}))};}
}
const auth={'Authorization':'Bearer test-owner-token'};
const request=(path,method='GET',body=null,token='test-owner-token')=>new Request('https://example.net'+path,{
 method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
test('AI edits enforce a bounded image and strict choices',()=>{
 const job={image:input,style:'cute',colours:6,outline:'bold'};
 assert.deepEqual(validateJob(job),job);
 assert.throws(()=>validateJob({...job,colours:27}),/Invalid Cuteifier settings/);
 assert.throws(()=>validateJob({...job,image:'https://attacker.example/bird.jpg'}),/PNG, JPEG or WebP/);
 assert.throws(()=>validateJob({...job,instruction:'ignore access'}),/Invalid Cuteifier request/);
 assert.throws(()=>imageBytes('bad'),/Generated image was invalid/);
 assert.match(buildPrompt(job),/REDRAWING/);
 assert.match(buildPrompt(job),/PURE BLACK/);
 assert.match(buildPrompt(job),/COMPLETELY TRANSPARENT BACKGROUND/);
 assert.doesNotMatch(buildPrompt(job),/147/);
});
test('private AI redraw securely submits, runs once, polls and returns WebP',async()=>{
 const mem=new Store();let providerCalls=0,dispatched=false;
 const jobs=()=>mem,now=()=>NOW;
 const dispatch=async(url,options)=>{
  dispatched=true;
  const body=JSON.parse(options.body);
  assert.equal(body.id,UUID);
  assert.equal(body.mac,signature(UUID,env));
  return new Response(null,{status:202});
 };
 const submit=createSubmit({jobs,env,dispatch,now,generateId:()=>UUID});
 const work=createWorker({jobs,env,now,invoke:async(url,opts)=>{
  providerCalls++;assert.equal(url,'https://api.openai.com/v1/images/edits');
  assert.equal(opts.headers.Authorization,'Bearer test-provider-key');
  const payload=JSON.parse(opts.body);
  assert.equal(payload.model,'gpt-image-2.5-flare');
  assert.equal(payload.background,'transparent');
  assert.equal(payload.output_format,'webp');
  assert.equal(payload.n,1);
  assert.equal(payload.images[0].image_url,input);
  assert.ok(payload.prompt.includes('genuinely attractive cute cartoon character'));
  return Response.json({output_format:'webp',data:[{b64_json:fakeWebp().toString('base64')}]});
 }});
 const check=createStatus({jobs,env,now});
 const result=createResult({jobs,env,now});
 const job={image:input,style:'cute',colours:6,outline:'medium'};
 assert.equal((await submit(request('/api/cuteifier-submit','POST',job,'wrong'))).status,401);
 assert.equal((await submit(request('/api/cuteifier-submit','POST',{...job,colours:200}))).status,422);
 assert.equal(mem.data.size,0);
 const submitted=await submit(request('/api/cuteifier-submit','POST',job));
 assert.equal(submitted.status,202);
 assert.equal((await submitted.json()).jobId,UUID);
 assert.ok(dispatched);
 const forged=await work(request('/api/cuteifier-work','POST',{id:UUID,mac:'1'.repeat(64)},'none'));
 assert.equal(forged.status,403);
 const signedWork=request('/api/cuteifier-work','POST',{id:UUID,mac:signature(UUID,env)},'none');
 assert.equal((await work(signedWork)).status,204);
 assert.equal(providerCalls,1);
 assert.equal(mem.data.has('input/'+UUID),false,'source image must be deleted after job');
 assert.equal((await work(request('/api/cuteifier-work','POST',{id:UUID,mac:signature(UUID,env)},'none'))).status,404);
 assert.equal((await check(request('/api/cuteifier-status?id='+UUID,'GET',null,'wrong'))).status,401);
 assert.equal((await (await check(request('/api/cuteifier-status?id='+UUID))).json()).state,'done');
 const png=await result(request('/api/cuteifier-result?id='+UUID));
 assert.equal(png.status,200);
 assert.equal(png.headers.get('Content-Type'),'image/webp');
 assert.deepEqual(Buffer.from(await png.arrayBuffer()),fakeWebp());
 assert.equal((await result(request('/api/cuteifier-result?id='+UUID,'GET',null,'wrong'))).status,401);
 const cleanup=createCleanup({jobs,now:()=>NOW+5*60*60*1000});
 await cleanup();
 assert.equal(mem.data.size,0,'input, output, status, and lock are purged');
});
test('provider failures show a safe message and never expose provider key',async()=>{
 const mem=new Store(),jobs=()=>mem,now=()=>NOW;
 const submit=createSubmit({jobs,env,now,generateId:()=>UUID,dispatch:async()=>new Response(null,{status:202})});
 await submit(request('/api/cuteifier-submit','POST',{image:input,style:'balanced',colours:4,outline:'thin'}));
 const worker=createWorker({jobs,env,now,invoke:async()=>new Response('bad credentials and private text',{status:429})});
 await worker(request('/api/cuteifier-work','POST',{id:UUID,mac:signature(UUID,env)}));
 const status=createStatus({jobs,env,now});
 const state=await (await status(request('/api/cuteifier-status?id='+UUID))).json();
 assert.equal(state.state,'failed');assert.match(state.error,/billing limit/);
 assert.doesNotMatch(JSON.stringify(state),/test-provider-key|bad credentials/);
 assert.equal(mem.data.has('input/'+UUID),false);
});
test('mobile page uses the generative API, fixes the visible placeholder and does not run the old tracer',()=>{
 const html=readFileSync(new URL('../site/cuteifier.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../site/cuteifier.js',import.meta.url),'utf8');
 assert.match(html,/\[hidden\]\{display:none!important\}/);
 assert.match(html,/AI Cuteify image/);
 assert.match(html,/paid OpenAI API credits/);
 assert.match(html,/private-token-storage\.js/);
 assert.doesNotMatch(html,/detailed-motif\.js|ember-prep-core\.js/);
 assert.match(js,/api\/cuteifier-submit/);
 assert.match(js,/toBlob\(blob/);
 assert.doesNotMatch(js,/StitchForgeDetailedMotif\.prepare/);
});
