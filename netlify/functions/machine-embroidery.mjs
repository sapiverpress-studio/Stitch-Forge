/* Private Netlify-to-native-Ink/Stitch bridge. Disabled unless a separate
 * dedicated, sandboxed HTTPS worker and its token are configured.
 * Original images, SVG markup and OpenAI output are NEVER forwarded.
 */
import {timingSafeEqual} from "node:crypto";
import {acquireCloudRunIdToken,cloudRunAudience} from "./lib/cloud-run-auth.mjs";
const HEADERS={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(code,error)=>new Response(JSON.stringify({error}),{status:code,
 headers:{...HEADERS,"Content-Type":"application/json; charset=utf-8"}});
const allowed=new Set(["paths","pathStyles","pathColors","pathSettings","width",
 "hoop","settings","stitchMode","threadColor","design_width_mm"]);
function auth(value,secret){
 if(!secret||!value?.startsWith("Bearer "))return false;
 const a=Buffer.from(value.slice(7)),b=Buffer.from(secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function geometryPayload(body){
 if(!body||typeof body!=="object"||Array.isArray(body))throw Error("bad_geometry");
 if(Object.keys(body).some(k=>!allowed.has(k)))throw Error("bad_geometry");
 if(!Array.isArray(body.paths)||!Array.isArray(body.pathColors)||
    body.pathColors.length!==body.paths.length)throw Error("bad_geometry");
 const serialised=JSON.stringify(body);
 if(serialised.length>250000)throw Error("bad_geometry");
 return serialised;
}
export default async function machineEmbroidery(request){
 if(request.method!=="POST")return json(405,"POST only");
 if(!auth(request.headers.get("authorization"),process.env.STITCH_FORGE_ANALYSIS_TOKEN))
  return json(401,"Owner token required");
 const worker=process.env.STITCH_FORGE_ENGINE_URL||"";
 const workerToken=process.env.STITCH_FORGE_WORKER_TOKEN||"";
 if(!workerToken||!/^https:\/\/[a-z0-9][a-z0-9.:-]+\/v1\/digitise$/i.test(worker))
  return json(503,"Native embroidery worker not configured; machine files remain blocked");
 if(!request.headers.get("content-type")?.startsWith("application/json"))
  return json(415,"JSON required");
 if(Number(request.headers.get("content-length")||0)>250000)return json(413,"Project too large");
 let data;
 try{
  const raw=await request.text();
  if(raw.length>250000)return json(413,"Project too large");
  data=geometryPayload(JSON.parse(raw));
 }catch{return json(422,"Geometry-only project required");}
 // Cloud Run is private by default. Google IAM validates the ID token,
 // while our own worker separately validates its independent bearer secret.
 // X-Serverless-Authorization is stripped by Cloud Run before the container.
 let googleIdToken=null;
 const workerHostname=new URL(worker).hostname;
 if(workerHostname.endsWith(".run.app")){
  if(!process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON)
   return json(503,"Private Cloud Run caller identity not configured");
  try{
   cloudRunAudience(worker); // require exact HTTPS run.app /v1/digitise path
   googleIdToken=await acquireCloudRunIdToken(
    worker,process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON);
  }catch{return json(502,"Cloud Run IAM identity unavailable");}
 }else if(process.env.STITCH_FORGE_CLOUD_RUN_CALLER_JSON){
  // A credential must never be exchanged for an unrelated host.
  return json(503,"Cloud Run identity requires an approved run.app endpoint");
 }
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),55000);
 try{
  const upstream=await fetch(worker,{method:"POST",signal:abort.signal,
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+workerToken,
      ...(googleIdToken?{"X-Serverless-Authorization":"Bearer "+googleIdToken}:{})},
    body:data,redirect:"error"});
  if(!upstream.ok)return json(upstream.status===429?429:502,
    upstream.status===429?"Engine busy":"Engine rejected project or is unavailable");
  if(!upstream.headers.get("content-type")?.startsWith("application/zip"))
   return json(502,"Engine returned wrong content type");
  const length=Number(upstream.headers.get("content-length"));
  const digest=upstream.headers.get("x-stitch-forge-sha256");
  const audit=upstream.headers.get("x-stitch-forge-audit");
  if(!Number.isInteger(length)||length<100||length>3000000||
     !/^[0-9a-f]{64}$/.test(digest||"")||
     audit!=="STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED")
   return json(502,"Missing valid independent machine audit");
  const bytes=new Uint8Array(await upstream.arrayBuffer());
  if(bytes.length!==length||bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)
   return json(502,"Engine returned invalid machine archive");
  const {createHash}=await import("node:crypto");
  if(createHash("sha256").update(bytes).digest("hex")!==digest)
   return json(502,"Machine archive checksum mismatch");
  return new Response(bytes,{status:200,headers:{
   ...HEADERS,"Content-Type":"application/zip",
   "Content-Disposition":'attachment; filename="stitch-forge-UNTESTED.zip"',
   "X-Stitch-Forge-Audit":audit,"X-Stitch-Forge-SHA256":digest
  }});
 }catch{return json(502,"Machine generation unavailable; design remains editable");}
 finally{clearTimeout(timer);}
}
export const config={path:"/api/machine-embroidery"};
