import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkBridge,boundedBytes} from '../netlify/functions/artwork-embroidery.mjs';
const values={STITCH_FORGE_ANALYSIS_TOKEN:'local-owner',STITCH_FORGE_WORKER_TOKEN:'local-worker',STITCH_FORGE_ENGINE_URL:'https://native.example.test/v1/digitise',STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'1'};
const packet={header:'{}',rgbaGzip:'AA==',labelsGzip:'AA==',requestId:'a'.repeat(64),phase:'pes'};
const request=(body=packet,token='local-owner')=>new Request('https://app.example.test/api/artwork-embroidery',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
test('artwork bridge is authenticated, disabled by default and does not invoke OpenAI',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('No network allowed');};
 const disabled=createArtworkBridge({getEnv:k=>({...values,STITCH_FORGE_ARTWORK_TRIAL_ENABLED:'0'})[k],fetchImpl});
 assert.equal((await disabled(request())).status,503);assert.equal((await disabled(request(packet,'wrong'))).status,401);assert.equal(calls,0);
});
test('only bounded native phase packets reach the fixed private worker route',async()=>{
 let calls=0;const bridge=createArtworkBridge({getEnv:k=>values[k],fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://native.example.test/v1/artwork-trial');assert.equal(options.headers.Authorization,'Bearer local-worker');assert.equal(options.redirect,'error');
  return new Response(JSON.stringify({requestId:packet.requestId,pesBase64:'',receipt:{requestId:packet.requestId,mac:'b'.repeat(64)}}),{headers:{'content-type':'application/json'}});
 }});
 assert.equal((await bridge(request({...packet,svg:'<svg/>'}))).status,422);assert.equal(calls,0);
 assert.equal((await bridge(request())).status,200);assert.equal(calls,1);
});
test('native busy/failed phases remain failures with no legacy file substitute',async()=>{
 for(const code of [422,429,503,504]){
  const bridge=createArtworkBridge({getEnv:k=>values[k],fetchImpl:async()=>new Response('{}',{status:code})});
  assert.equal((await bridge(request())).status,code);
 }
});
test('response and request readers stop at their byte budget',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(11));c.close();}});
 await assert.rejects(boundedBytes(stream,10),/limit/);
});
test('a native repair response is forwarded once and cannot loop through the bridge',async()=>{
 const response={status:'BOUNDED_NATIVE_REPAIR_REQUIRED',requestId:packet.requestId,repairReceipt:{requestId:packet.requestId,objectIds:['123456-0'],issuedAt:1000,mac:'c'.repeat(64)}};
 const bridge=createArtworkBridge({getEnv:k=>values[k],fetchImpl:async()=>new Response(JSON.stringify(response),{status:202,headers:{'content-type':'application/json'}})});
 const second={...packet,phase:'dst',receipt:{},pesBase64:''};
 assert.equal((await bridge(request(second))).status,202);
 assert.equal((await bridge(request({...second,repairReceipt:response.repairReceipt}))).status,502);
});
