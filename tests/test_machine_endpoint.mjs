import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync} from "node:crypto";
import machine, {geometryPayload} from "../netlify/functions/machine-embroidery.mjs";

const original={...process.env};
const project={paths:[[[100,100],[220,100],[220,220],[100,220],[100,100]],
                         [[110,110],[130,150]]],
 pathStyles:["tatami","running"],pathColors:["#AABBCC","#334455"],width:78,hoop:150};
const req=(obj=project,token="owner-token")=>new Request("https://example.test/api/machine-embroidery",{
 method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token},
 body:JSON.stringify(obj)});
function setEnv(worker){
 process.env.STITCH_FORGE_ANALYSIS_TOKEN="owner-token";
 if(worker){
 process.env.STITCH_FORGE_ENGINE_URL="https://native.example.test/v1/digitise";
 process.env.STITCH_FORGE_WORKER_TOKEN="worker-only-secret";
 }else{delete process.env.STITCH_FORGE_ENGINE_URL;delete process.env.STITCH_FORGE_WORKER_TOKEN;}
}
test.after(()=>{for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];Object.assign(process.env,original)});

test("disabled without worker, owner auth required",async()=>{
 setEnv(false);
 assert.equal((await machine(req())).status,503);
 assert.equal((await machine(req(project,"wrong"))).status,401);
});
test("geometry allowlist refuses original raster or arbitrary SVG",()=>{
 for(const key of ["image","reference","svg","sourceImage"]){
 assert.throws(()=>geometryPayload({...project,[key]:"private customer photo"}));
 }
 assert.doesNotThrow(()=>geometryPayload(project));
});
test("real worker response requires audited checksum, ZIP signature and size",async()=>{
 setEnv(true);
 const old=globalThis.fetch;
 const bytes=Uint8Array.from([80,75,3,4,...Array(128).fill(44)]);
 const digest=createHash("sha256").update(bytes).digest("hex");
 const workerHeaders={"content-type":"application/zip","content-length":String(bytes.length),
  "x-stitch-forge-sha256":digest,
  "x-stitch-forge-audit":"STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED"};
 try{
  let called=0;
  globalThis.fetch=async (_url,options)=>{
   called++;
   assert.equal(options.headers.Authorization,"Bearer worker-only-secret");
   assert.deepEqual(JSON.parse(options.body),project);
   return new Response(bytes,{status:200,headers:workerHeaders});
  };
  const ok=await machine(req());
  assert.equal(ok.status,200);
  assert.equal(called,1);
  assert.equal(ok.headers.get("x-stitch-forge-audit"),
               "STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED");
  assert.deepEqual(new Uint8Array(await ok.arrayBuffer()),bytes);
  globalThis.fetch=async()=>new Response(bytes,{status:200,
   headers:{...workerHeaders,"x-stitch-forge-sha256":"0".repeat(64)}});
  assert.equal((await machine(req())).status,502);
  globalThis.fetch=async()=>new Response(bytes,{status:200,
   headers:{...workerHeaders,"x-stitch-forge-audit":"NOT_AUDITED"}});
  assert.equal((await machine(req())).status,502);
 }finally{globalThis.fetch=old;}
});

test("private Cloud Run requires BOTH Google IAM and separate worker secret",async()=>{
 setEnv(true);
 const endpoint="https://stitch-forge-private-xzy.a.run.app/v1/digitise";
 process.env.STITCH_FORGE_ENGINE_URL=endpoint;
 delete process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON;
 assert.equal((await machine(req())).status,503);
 const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON=JSON.stringify({
  type:"service_account",
  client_email:"invoker@test-project.iam.gserviceaccount.com",
  private_key:privateKey.export({type:"pkcs8",format:"pem"}).toString()
 });
 const bytes=Uint8Array.from([80,75,3,4,...Array(128).fill(19)]);
 const digest=createHash("sha256").update(bytes).digest("hex");
 const headers={"content-type":"application/zip","content-length":String(bytes.length),
  "x-stitch-forge-sha256":digest,
  "x-stitch-forge-audit":"STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED"};
 const originalFetch=globalThis.fetch;
 try{
  const calls=[];
  globalThis.fetch=async (url,opts)=>{
   calls.push(url);
   if(url==="https://oauth2.googleapis.com/token"){
    assert.equal(opts.method,"POST");
    assert.ok(new URLSearchParams(opts.body).get("assertion"));
    return new Response(JSON.stringify({id_token:"a.b.c"}),{status:200});
   }
   assert.equal(url,endpoint);
   assert.equal(opts.headers.Authorization,"Bearer worker-only-secret");
   assert.equal(opts.headers["X-Serverless-Authorization"],"Bearer a.b.c");
   return new Response(bytes,{status:200,headers});
  };
  assert.equal((await machine(req())).status,200);
  assert.deepEqual(calls,["https://oauth2.googleapis.com/token",endpoint]);
  process.env.STITCH_FORGE_ENGINE_URL="https://bad.example/v1/digitise";
  assert.equal((await machine(req())).status,503);
  assert.deepEqual(calls,["https://oauth2.googleapis.com/token",endpoint]);
 }finally{globalThis.fetch=originalFetch;delete process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON;}
});
