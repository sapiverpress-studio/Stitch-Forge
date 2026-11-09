/* Same repository app + real Function handler + real local WSGI/native engine.
 * Loopback only. No Netlify/Cloud Run call, deployment or OpenAI connection.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createArtworkBridge,boundedBytes} from '../netlify/functions/artwork-embroidery.mjs';
import {createSubmit} from '../netlify/functions/artwork-job-submit.mjs';
import {createWorker} from '../netlify/functions/artwork-job-work.mjs';
import {createStatus} from '../netlify/functions/artwork-job-status.mjs';
import {createResult} from '../netlify/functions/artwork-job-result.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startLocalApp({ownerToken,engine,port=0,python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',onPhase=()=>{},diagnosticsDirectory=null}={}){
 if(typeof ownerToken!=='string'||ownerToken.length<12||!fs.statSync(engine).isFile())throw Error('Explicit local access token and installed engine are required');
 const workerToken=randomBytes(32).toString('hex');
 const childEnv={PATH:process.env.PATH,HOME:process.env.HOME,LANG:process.env.LANG||'C.UTF-8',PYTHONPATH:process.env.PYTHONPATH||'',LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH||'',
  STITCH_FORGE_WORKER_TOKEN:workerToken,STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'1',STITCH_FORGE_INKSTITCH_PATH:engine};
 if(diagnosticsDirectory)childEnv.STITCH_FORGE_LOCAL_DIAGNOSTICS_DIR=path.resolve(diagnosticsDirectory);
 const worker=spawn(python,[path.join(ROOT,'tools/local_worker_server.py')],{env:childEnv,stdio:['ignore','pipe','pipe']});
 let stderr='';worker.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-3000);});
 const nativePort=await new Promise((resolve,reject)=>{
  let out='';const timer=setTimeout(()=>reject(Error('Local worker startup timed out')),10000);
  worker.stdout.on('data',chunk=>{out+=chunk.toString();if(out.includes('\n')){clearTimeout(timer);const n=Number(out.trim().split('\n')[0]);Number.isInteger(n)&&n>0?resolve(n):reject(Error('Invalid local worker port'));}});
  worker.once('error',reject);worker.once('exit',()=>{clearTimeout(timer);reject(Error('Local worker could not start'));});
 }).catch(error=>{worker.kill('SIGTERM');throw error;});
 const values={STITCH_FORGE_ANALYSIS_TOKEN:ownerToken,STITCH_FORGE_WORKER_TOKEN:workerToken,STITCH_FORGE_ENGINE_URL:'https://local-native.invalid/v1/digitise',STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'1'};
 const env=key=>values[key];
 const bridgeOptions={getEnv:env,fetchImpl:async(url,options)=>{
  if(url!=='https://local-native.invalid/v1/artwork-trial')throw Error('External network is disabled in the local app');
  const begin=Date.now(),phase=JSON.parse(options.body).phase;
  const response=await fetch('http://127.0.0.1:'+nativePort+'/v1/artwork-trial',options);
  onPhase({phase,status:response.status,elapsedMs:Date.now()-begin});
  return response;
 }};
 const bridge=createArtworkBridge(bridgeOptions);
 const state=new Map(), pending=new Set();
 const store={
  async set(key,value,options){if(options?.onlyIfNew&&state.has(key))return {modified:false};state.set(key,value);return {modified:true};},
  async setJSON(key,value){state.set(key,structuredClone(value));},
  async get(key,options){
   const value=state.get(key);
   if(options?.type==='arrayBuffer')return value?.arrayBuffer()??null;
   return value??null;
  },
  async delete(key){state.delete(key);}
 };
 const jobs=()=>store;
 const workerJob=createWorker({jobs,env,bridge:options=>createArtworkBridge({...bridgeOptions,...options})});
 const dispatch=async(url,options)=>{
  const work=workerJob(new Request(url,options));
  pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));
  return new Response(null,{status:202});
 };
 const routes=new Map([
  ['/api/artwork-embroidery',bridge],
  ['/api/artwork-job-submit',createSubmit({jobs,env,dispatch})],
  ['/api/artwork-job-status',createStatus({jobs,env})],
  ['/api/artwork-job-result',createResult({jobs,env})]
 ]);
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const route=routes.get(url.pathname);
   if(route){
    const hasBody=!['GET','HEAD'].includes(req.method);
    const input=hasBody?ReadableStream.from(req):null;
    const data=hasBody?await boundedBytes(input,4000000):undefined;
    const response=await route(new Request('https://local-app.invalid'+url.pathname+url.search,
      {method:req.method,headers:req.headers,body:data}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body)for await(const chunk of response.body)res.write(chunk);
    res.end();return;
   }
   if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Paid and external APIs are disabled in the local app"}');return;}
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!['GET','HEAD'].includes(req.method)||!/^(?:assets\/)?[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(name)){res.writeHead(404);res.end();return;}
   const file=path.join(ROOT,'site',name);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   const type=name.endsWith('.js')?'text/javascript':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'text/html';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
  }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Local request failed"}');}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,phases:onPhase,
  close:async()=>{await new Promise(resolve=>server.close(resolve));await Promise.allSettled(pending);worker.kill('SIGINT');await new Promise(resolve=>{worker.once('exit',resolve);setTimeout(resolve,5000);});},workerError:()=>stderr};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),engine=args[args.indexOf('--engine')+1],pi=args.indexOf('--port'),port=pi<0?0:Number(args[pi+1]);
 const app=await startLocalApp({ownerToken:process.env.STITCH_FORGE_LOCAL_OWNER_TOKEN,engine,port});
 console.log('Local Stitch Forge: '+app.url);console.log('Native artwork trial only; no external or paid APIs.');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
