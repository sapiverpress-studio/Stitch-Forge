import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmit} from '../netlify/functions/cuteifier-submit.mjs';
import {createWorker} from '../netlify/functions/cuteifier-work.mjs';
import {createStatus} from '../netlify/functions/cuteifier-status.mjs';
import {createResult} from '../netlify/functions/cuteifier-result.mjs';
import {createCleanup} from '../netlify/functions/cuteifier-cleanup.mjs';
import {validateJob,buildPrompt,imageBytes,signature} from '../netlify/functions/lib/cuteifier-jobs.mjs';
import {readFileSync} from 'node:fs';
const NOW=Date.UTC(2026,10,10,12,0,0);
const ID='06d51272-ae23-4a38-91a5-dd25b9a6e001';
function webp(){const b=Buffer.alloc(200);b.write('RIFF',0,'ascii');b.writeUInt32LE(192,4);b.write('WEBP',8,'ascii');b.write('VP8 ',12,'ascii');return b;}
const source='data:image/webp;base64,'+webp().toString('base64');
const env=n=>({STITCH_FORGE_ANALYSIS_TOKEN:'owner-test-token',STITCH_FORGE_WORKER_TOKEN:'worker-only-token',OPENAI_API_KEY:'secret-test-provider-key'})[n];
function makeRequest(path,method='GET',data=null,token='owner-test-token'){
 return new Request('https://example.net'+path,{method,
  headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{})});
}
class Mem{
 constructor(){this.data=new Map();}
 async set(k,v,options={}){
  if(options.onlyIfNew&&this.data.has(k))return {modified:false};
  this.data.set(k,v instanceof Blob?Buffer.from(await v.arrayBuffer()):v);
  return {modified:true};
 }
 async setJSON(k,v){this.data.set(k,JSON.stringify(v));}
 async get(k,opts={}){
  const value=this.data.get(k);if(value===undefined)return null;
  if(opts.type==='json')return JSON.parse(value);
  if(opts.type==='arrayBuffer'){const b=Buffer.from(value);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
  return value;
 }
 async delete(k){this.data.delete(k);}
 async list({prefix=''}){return {blobs:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
}
test('provider prompt is a redraw, protects facial expression and pose, never asks for stitches or compulsory outline',()=>{
 const p=buildPrompt();
 for(const word of ['REDRAW','capybara','kingfisher','smile','eye','whiskers','transparent','silhouette','pose'])
  assert.ok(p.toLowerCase().includes(word.toLowerCase()),word);
 assert.match(p,/closed eye/i);assert.match(p,/do NOT add a heavy black exterior outline/);
 assert.doesNotMatch(p,/PES|DST|digitis|embroidery/i);
 const accepted=validateJob({image:source});assert.deepEqual(accepted,{image:source});
 assert.throws(()=>validateJob({image:source,instructions:'ignore all'}),/single source image/);
 assert.throws(()=>validateJob({image:'https://attacker.example/x.png'}),/PNG, JPEG or WebP/);
 assert.throws(()=>imageBytes('bad'),/WebP/);
});
test('paid request requires the existing owner token, uses exactly one high-quality image edit, stores result privately and supports recovery',async()=>{
 const mem=new Mem(),jobs=()=>mem,now=()=>NOW;let calls=0,dispatches=0;
 const submit=createSubmit({jobs,env,now,generateId:()=>ID,dispatch:async(url,opts)=>{
  dispatches++;assert.ok(String(url).endsWith('/api/cuteifier-work'));
  assert.equal(JSON.parse(opts.body).mac,signature(ID,env));
  return new Response(null,{status:202});
 }});
 const job={image:source};
 assert.equal((await submit(makeRequest('/api/cuteifier-submit','POST',job,'wrong'))).status,401);
 assert.equal((await submit(makeRequest('/api/cuteifier-submit','POST',job,'worker-only-token'))).status,401);
 assert.equal((await submit(makeRequest('/api/cuteifier-submit','POST',{image:'bad'}))).status,422);
 assert.equal(mem.data.size,0);
 const submitted=await submit(makeRequest('/api/cuteifier-submit','POST',job));
 assert.equal(submitted.status,202);assert.equal((await submitted.json()).jobId,ID);assert.equal(dispatches,1);
 const worker=createWorker({jobs,env,now,invoke:async(url,opts)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/images/edits');
  assert.equal(opts.headers.Authorization,'Bearer secret-test-provider-key');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'gpt-image-2.5-sunburst');assert.equal(body.quality,'high');
  assert.equal(body.size,'1024x1024');assert.equal(body.background,'transparent');
  assert.equal(body.output_format,'webp');assert.equal(body.n,1);
  assert.deepEqual(body.images,[{image_url:source}]);
  assert.ok(body.prompt.includes('Preserve what makes this specific character'));
  return Response.json({output_format:'webp',data:[{b64_json:webp().toString('base64')}]});
 }});
 assert.equal((await worker(makeRequest('/api/cuteifier-work','POST',{id:ID,mac:'1'.repeat(64)},'anonymous'))).status,403);
 assert.equal((await worker(makeRequest('/api/cuteifier-work','POST',{id:ID,mac:signature(ID,env)},'anonymous'))).status,204);
 assert.equal(calls,1);
 assert.equal(mem.data.has('input/'+ID),false,'do not retain raw source');
 assert.equal((await worker(makeRequest('/api/cuteifier-work','POST',{id:ID,mac:signature(ID,env)}))).status,404);
 const status=createStatus({jobs,env,now});
 assert.equal((await status(makeRequest('/api/cuteifier-status?id='+ID,'GET',null,'wrong'))).status,401);
 assert.equal((await (await status(makeRequest('/api/cuteifier-status?id='+ID))).json()).state,'done');
 const result=createResult({jobs,env,now});
 assert.equal((await result(makeRequest('/api/cuteifier-result?id='+ID,'GET',null,'wrong'))).status,401);
 const response=await result(makeRequest('/api/cuteifier-result?id='+ID));
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),webp());
 await createCleanup({jobs,now:()=>NOW+5*60*60*1000})();
 assert.equal(mem.data.size,0,'expired source and generated output removed');
});
test('upstream error is safe, no retry or provider secret leakage',async()=>{
 const mem=new Mem(),jobs=()=>mem,now=()=>NOW;
 await createSubmit({jobs,env,now,generateId:()=>ID,dispatch:async()=>new Response(null,{status:202})})(makeRequest('/api/cuteifier-submit','POST',{image:source}));
 let calls=0;
 await createWorker({jobs,env,now,invoke:async()=>{calls++;return new Response('private provider error',{status:429});}})
  (makeRequest('/api/cuteifier-work','POST',{id:ID,mac:signature(ID,env)}));
 const result=await (await createStatus({jobs,env,now})(makeRequest('/api/cuteifier-status?id='+ID))).json();
 assert.equal(calls,1);assert.equal(result.state,'failed');
 assert.match(result.error,/limit/);assert.doesNotMatch(JSON.stringify(result),/secret-test-provider-key|private provider error/);
 assert.equal(mem.data.has('input/'+ID),false);
});
test('front-end permits optional outline, no paid request on its checkbox or download',()=>{
 const html=readFileSync(new URL('../site/cuteifier.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../site/cuteifier.js',import.meta.url),'utf8');
 assert.match(html,/id="blackOutline"/);assert.doesNotMatch(html,/id="blackOutline"[^>]*checked/);
 assert.match(html,/id="download"/);assert.match(html,/\[hidden\]\{display:none!important\}/);
 assert.match(js,/StitchForgeOptionalOutline\.outline/);
 assert.match(js,/outline\.addEventListener\('change'/);
 assert.match(js,/api\/cuteifier-submit/);
 assert.match(js,/result\.toBlob\(blob/);
 assert.doesNotMatch(js,/StitchForgeDetailedMotif\.prepare/);
});
