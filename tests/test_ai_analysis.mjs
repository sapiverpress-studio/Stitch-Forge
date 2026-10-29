import test from "node:test";
import assert from "node:assert/strict";
import handler, {checkImage,verifyProposal,extractOutput} from "../netlify/functions/analyse-embroidery.mjs";

const goodRegion=()=>({
 id:"left-wing-veins",label:"Left wing veins",category:"wing_vein",
 bbox:{x_min:80,y_min:180,x_max:450,y_max:680},
 suggested_color:"#8a7659",suggested_stitch:"running",confidence:"medium",
 notes:"Human review needed for small branching veins"
});
const example=()=>({subject:"Decorative moth",regions:[goodRegion()],
 overlooked_details:["Wing veins"],warnings:["Fine details may not embroider"],requires_human_review:true});
test("recognises internal wing detail as a region, not a stitched file",()=>{
 const output=verifyProposal(example());
 assert.equal(output.status,"REGION_PROPOSAL_NOT_DIGITISED");
 assert.equal(output.regions[0].category,"wing_vein");
 assert.equal(output.coordinate_system,"normalized_image_0_1000");
});
test("rejects hallucinated or malformed geometry and unsupported types",()=>{
 for(const field of [
   p=>p.regions[0].bbox.x_max=9999,
   p=>p.regions[0].bbox.x_min=600,
   p=>p.regions[0].suggested_stitch="machine-ready",
   p=>p.regions[0].suggested_color="<script>",
   p=>p.requires_human_review=false,
   p=>p.regions.push(p.regions[0])
 ]) {
   const p=example();field(p);assert.throws(()=>verifyProposal(p));
 }
});
test("checks MIME signature and payload limits",()=>{
 const fake=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.alloc(120)]);
 const encoded="data:image/png;base64,"+fake.toString("base64");
 assert.equal(checkImage(encoded),encoded);
 assert.throws(()=>checkImage(encoded.replace("png","jpeg")));
 assert.throws(()=>checkImage("data:text/html;base64,AAA="));
});
test("requires access token, and never calls provider when absent",async()=>{
 const old=process.env.STITCH_FORGE_ANALYSIS_TOKEN;
 process.env.STITCH_FORGE_ANALYSIS_TOKEN="test-private-token";
 try{
  const response=await handler(new Request("https://test.invalid/api/analyse-embroidery",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:"invalid"})}));
  assert.equal(response.status,401);
 }finally{
  if(old===undefined)delete process.env.STITCH_FORGE_ANALYSIS_TOKEN;
  else process.env.STITCH_FORGE_ANALYSIS_TOKEN=old;
 }
});
test("requires structured completed response",()=>{
 assert.deepEqual(extractOutput({status:"completed",output:[{
  type:"message",content:[{type:"output_text",text:JSON.stringify(example())}]
 }]}).regions,[goodRegion()]);
 assert.throws(()=>extractOutput({status:"incomplete",output:[]}));
});

test("authenticated request sends an image to OpenAI with store disabled",async()=>{
 const savedKey=process.env.OPENAI_API_KEY;
 const savedToken=process.env.STITCH_FORGE_ANALYSIS_TOKEN;
 const savedFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY="synthetic-test-api-key";
 process.env.STITCH_FORGE_ANALYSIS_TOKEN="synthetic-test-access-token";
 let called=false;
 globalThis.fetch=async(url,opts)=>{
  called=true;
  assert.equal(url,"https://api.openai.com/v1/responses");
  const request=JSON.parse(opts.body);
  assert.equal(request.store,false);
  assert.equal(request.input[0].content[1].type,"input_image");
  assert.ok(request.text.format.strict);
  return new Response(JSON.stringify({status:"completed",model:"synthetic-model",
    output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(example())}]}],
    usage:{input_tokens:100,output_tokens:40}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const fake=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.alloc(120)]);
  const response=await handler(new Request("https://test.invalid/api/analyse-embroidery",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer synthetic-test-access-token"},
   body:JSON.stringify({image:"data:image/png;base64,"+fake.toString("base64")})}));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.status,"REGION_PROPOSAL_NOT_DIGITISED");
  assert.equal(result.regions[0].label,"Left wing veins");
  assert.ok(called);
 }finally{
  globalThis.fetch=savedFetch;
  if(savedKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedKey;
  if(savedToken===undefined)delete process.env.STITCH_FORGE_ANALYSIS_TOKEN;else process.env.STITCH_FORGE_ANALYSIS_TOKEN=savedToken;
 }
});

test("identifies incomplete, invalid, rate-limited, and network OpenAI failures without leaking response bodies",async()=>{
 const savedKey=process.env.OPENAI_API_KEY;
 const savedToken=process.env.STITCH_FORGE_ANALYSIS_TOKEN;
 const originalFetch=globalThis.fetch;
 const originalError=console.error;
 process.env.OPENAI_API_KEY="synthetic-test-api-key";
 process.env.STITCH_FORGE_ANALYSIS_TOKEN="synthetic-test-access-token";
 const png=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.alloc(120)]);
 const requestBody=JSON.stringify({image:"data:image/png;base64,"+png.toString("base64")});
 const outcomes=[
  {upstream:{status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]},code:"RESPONSE_INCOMPLETE"},
  {upstream:{status:"completed",output:[{type:"message",content:[{type:"output_text",
    text:JSON.stringify({...example(),regions:[{...goodRegion(),suggested_color:"beige"}]})}]}]},code:"RESPONSE_INVALID_REGIONS"},
  {status:400,code:"UPSTREAM_BAD_REQUEST"},
  {status:429,code:"UPSTREAM_RATE_LIMIT"},
  {network:true,code:"NETWORK_ERROR"}
 ];
 console.error=()=>{}; // tests do not print errors or user details
 try{
  for(const item of outcomes){
   globalThis.fetch=async()=>{
    if(item.network)throw Error("synthetic provider connection issue");
    return new Response(JSON.stringify(item.upstream||{error:{message:"synthetic unsafe raw response"}}),{
     status:item.status||200,headers:{"Content-Type":"application/json"}});
   };
   const response=await handler(new Request("https://test.invalid/api/analyse-embroidery",{
    method:"POST",headers:{"Content-Type":"application/json",
     "Authorization":"Bearer synthetic-test-access-token"},body:requestBody}));
   assert.equal(response.status,502,item.code);
   const data=await response.json();
   assert.equal(data.code,item.code);
   assert.ok(data.error.length>12);
   assert.ok(!JSON.stringify(data).includes("unsafe raw response"));
   assert.ok(!JSON.stringify(data).includes("synthetic-test-api-key"));
  }
 }finally{
  globalThis.fetch=originalFetch;
  console.error=originalError;
  if(savedKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedKey;
  if(savedToken===undefined)delete process.env.STITCH_FORGE_ANALYSIS_TOKEN;else process.env.STITCH_FORGE_ANALYSIS_TOKEN=savedToken;
 }
});
