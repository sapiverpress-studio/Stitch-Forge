import test from "node:test";
import assert from "node:assert/strict";
import handler,{verifyGeometryPlan,parseModelResponse} from "../netlify/functions/reconstruct-embroidery.mjs";
const region=(id,kind="fill")=>({id,label:id,kind,semantic:kind==="fill"?"wing_panel":"wing_vein",
 color:"#C4B3A2",layer:0,confidence:"medium",
 points:kind==="fill"?[{x:100,y:200},{x:250,y:160},{x:400,y:230},{x:370,y:400},{x:140,y:420}]:
 [{x:120,y:210},{x:240,y:230},{x:310,y:310}],
 notes:"Synthetic test"});
const plan=()=>({subject:"Synthetic moth",regions:[region("left"),region("right")],
 warnings:["Not fabric tested"],requires_machine_test:true});
test("accepts explicit proposed fill geometry, not rectangles alone",()=>{
 const result=verifyGeometryPlan(plan());
 assert.equal(result.status,"AI_GEOMETRY_PROPOSAL_NOT_STITCHED");
 assert.equal(result.regions.length,2);
 assert.equal(result.requires_machine_test,true);
});
test("rejects unsafe geometry, missing fill points, colours, and duplicate ids",()=>{
 const cases=[
  x=>x.regions[0].points[0].x=-2,
  x=>x.regions[0].points=x.regions[0].points.slice(0,3),
  x=>x.regions[0].color="bronze",
  x=>x.regions[1].id=x.regions[0].id,
  x=>x.requires_machine_test=false,
  x=>x.regions[0].points.push({...x.regions[0].points[0]})
 ];
 for(const mutate of cases){const value=plan();mutate(value);assert.throws(()=>verifyGeometryPlan(value));}
});
test("the private reconstruction endpoint sends image with store false and returns schema-checked geometry",async()=>{
 const originalKey=process.env.OPENAI_API_KEY,originalToken=process.env.STITCH_FORGE_ANALYSIS_TOKEN,originalFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY="fake-test-only-key";process.env.STITCH_FORGE_ANALYSIS_TOKEN="fake-test-only-token";
 const image=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.alloc(110)]);
 let called=false;
 try{
  globalThis.fetch=async(url,options)=>{
   called=true;assert.equal(url,"https://api.openai.com/v1/responses");
   assert.equal(options.headers.Authorization,"Bearer fake-test-only-key");
   const request=JSON.parse(options.body);assert.equal(request.store,false);
   assert.equal(request.input[0].content[1].type,"input_image");
   assert.ok(request.text.format.strict);
   return new Response(JSON.stringify({status:"completed",model:"synthetic-model",output:[
    {type:"message",content:[{type:"output_text",text:JSON.stringify(plan())}]}]}),
    {status:200,headers:{"Content-Type":"application/json"}});
  };
  const request=new Request("https://test.invalid/api/reconstruct-embroidery",{
   method:"POST",headers:{Authorization:"Bearer fake-test-only-token","Content-Type":"application/json"},
   body:JSON.stringify({image:"data:image/png;base64,"+image.toString("base64")})});
  const response=await handler(request);
  assert.equal(response.status,200);assert.equal((await response.json()).regions.length,2);assert.ok(called);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;
  if(originalToken===undefined)delete process.env.STITCH_FORGE_ANALYSIS_TOKEN;else process.env.STITCH_FORGE_ANALYSIS_TOKEN=originalToken;
 }
});
test("model accepts exactly four corners and removes duplicate closing/adjacent vertices",()=>{
 const p=plan();
 p.regions=[{...region("square"),points:[
  {x:100,y:100},{x:400,y:100},{x:400,y:100},{x:400,y:400},
  {x:100,y:400},{x:100,y:100}]}];
 const model={status:"completed",output:[{type:"message",content:[
  {type:"output_text",text:JSON.stringify(p)}]}]};
 const out=parseModelResponse(model);
 assert.deepEqual(out.regions[0].points,[
  {x:100,y:100},{x:400,y:100},{x:400,y:400},{x:100,y:400}]);
 assert.equal(out.model_rejected_count,0);
 assert.equal(out.regions.length,1);
 assert.equal(verifyGeometryPlan({...p,regions:p.regions.map(r=>({...r,points:r.points.slice(0,4)}))}).regions.length,1);
});

test("rejects invalid regions individually but never claims incomplete plan is ready for machine",()=>{
 const p=plan();
 p.regions.push({...region("bad"),points:[{x:100,y:100},{x:120,y:120},{x:140,y:140}]});
 const out=parseModelResponse({status:"completed",output:[{type:"message",content:[
  {type:"output_text",text:JSON.stringify(p)}]}]});
 assert.equal(out.regions.length,2);
 assert.equal(out.model_rejected_count,1);
 assert.deepEqual(out.model_rejected_reasons,["degenerate_outline"]);
 assert.equal(out.requires_machine_test,true);
 const invalid=plan();
 invalid.regions=[{...region("out-of-bounds"),points:[
  {x:-9,y:100},{x:200,y:100},{x:200,y:400},{x:100,y:400}]}];
 assert.throws(()=>parseModelResponse({status:"completed",output:[{type:"message",content:[
  {type:"output_text",text:JSON.stringify(invalid)}]}]}),/INVALID_MODEL_GEOMETRY/);
});

test("duplicate ids never silently produce multiple machine regions",()=>{
 const p=plan();p.regions[1].id=p.regions[0].id;
 const out=parseModelResponse({status:"completed",output:[{type:"message",content:[
  {type:"output_text",text:JSON.stringify(p)}]}]});
 assert.equal(out.regions.length,1);
 assert.equal(out.model_rejected_count,1);
 assert.deepEqual(out.model_rejected_reasons,["duplicate_id"]);
});

test("missing private token cannot invoke paid OpenAI",async()=>{
 const response=await handler(new Request("https://test.invalid/api/reconstruct-embroidery",{method:"POST",
 headers:{"Content-Type":"application/json"},body:"{}"}));
 assert.equal(response.status,401);
});
test("incomplete AI output is explicitly rejected",()=>{
 assert.throws(()=>parseModelResponse({status:"incomplete",output:[]}),/INCOMPLETE_MODEL/);
});

test("supports detailed non-moth plans beyond the former sixteen-region ceiling",()=>{
 const p=plan();p.subject="Synthetic botanical line drawing";
 p.regions=Array.from({length:19},(_,i)=>({...region('detail-'+i,'running'),semantic:'detail'}));
 assert.equal(verifyGeometryPlan(p).regions.length,19);
 p.regions=Array.from({length:33},(_,i)=>({...region('detail-'+i,'running'),semantic:'detail'}));
 assert.throws(()=>verifyGeometryPlan(p));
});
