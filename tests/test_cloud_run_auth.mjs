import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,createVerify} from "node:crypto";
import {cloudRunAudience,acquireCloudRunIdToken} from "../netlify/functions/lib/cloud-run-auth.mjs";

const URL="https://stitch-forge-worker-7qaz-ew.a.run.app/v1/digitise";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const credential=JSON.stringify({
 type:"service_account",client_email:"stitch-forge-invoker@test-project.iam.gserviceaccount.com",
 private_key:privateKey.export({type:"pkcs8",format:"pem"}).toString(),
 private_key_id:"a".repeat(40)
});
test("only an exact secure run.app worker origin can receive a Google IAM token",()=>{
 assert.equal(cloudRunAudience(URL),"https://stitch-forge-worker-7qaz-ew.a.run.app");
 for(const unsafe of [
  "https://evil.example/v1/digitise",
  "http://stitch-forge.a.run.app/v1/digitise",
  "https://stitch-forge.a.run.app:444/v1/digitise",
  "https://stitch-forge.a.run.app/v1/digitise?other=true",
  "https://stitch-forge.a.run.app/v1/digitise#hash",
  "https://stitch-forge.a.run.app/other",
  "https://fake-run.app/v1/digitise",
  "https://attacker@stitch-forge.a.run.app/v1/digitise"
 ])assert.throws(()=>cloudRunAudience(unsafe),unsafe);
});
test("server-only JWT is signed with restricted caller key, audience-locked and exchanged with Google",async()=>{
 let called=0;
 const token=await acquireCloudRunIdToken(URL,credential,{
  epoch:1800000000,
  fetchImpl:async (url,opts)=>{
   called++;
   assert.equal(url,"https://oauth2.googleapis.com/token");
   assert.equal(opts.method,"POST");
   const form=new URLSearchParams(opts.body);
   assert.equal(form.get("grant_type"),"urn:ietf:params:oauth:grant-type:jwt-bearer");
   const jwt=form.get("assertion");
   const [head,body,sig]=jwt.split(".");
   const claims=JSON.parse(Buffer.from(body,"base64url").toString());
   assert.deepEqual(JSON.parse(Buffer.from(head,"base64url").toString()).alg,"RS256");
   assert.equal(claims.aud,"https://oauth2.googleapis.com/token");
   assert.equal(claims.target_audience,"https://stitch-forge-worker-7qaz-ew.a.run.app");
   assert.equal(claims.exp-claims.iat,1800);
   const verifier=createVerify("RSA-SHA256");
   verifier.update(head+"."+body);verifier.end();
   assert.ok(verifier.verify(publicKey,Buffer.from(sig,"base64url")));
   return new Response(JSON.stringify({id_token:"aaaa.bbbb.cccc"}),{status:200});
  }
 });
 assert.equal(token,"aaaa.bbbb.cccc");
 assert.equal(called,1);
});
test("malformed caller credentials and failed Google ID-token exchange fail closed",async()=>{
 await assert.rejects(acquireCloudRunIdToken(URL,"not-json"),/credentials/);
 await assert.rejects(acquireCloudRunIdToken(URL,JSON.stringify({type:"service_account"})),/credentials/);
 await assert.rejects(acquireCloudRunIdToken(URL,credential,{
  fetchImpl:async()=>new Response("bad",{status:403})
 }),/Google rejected/);
 await assert.rejects(acquireCloudRunIdToken(URL,credential,{
  fetchImpl:async()=>new Response(JSON.stringify({access_token:"not-an-id-token"}),{status:200})
 }),/ID token/);
});
