const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const tokenAPI=require('../site/private-token-storage.js');
const index=fs.readFileSync(path.resolve(__dirname,'../site/index.html'),'utf8');
const ui=fs.readFileSync(path.resolve(__dirname,'../site/auto-reconstruct-ui.js'),'utf8');
const ai=fs.readFileSync(path.resolve(__dirname,'../site/ai-details.js'),'utf8');
function fakeStorage(){const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('owner token persists only on this browser storage and can be forgotten',()=>{
 const old=globalThis.localStorage,storage=fakeStorage();globalThis.localStorage=storage;
 try{
  assert.equal(tokenAPI.read(),'');
  assert.equal(tokenAPI.save('test-owner-token'),true);
  assert.equal(tokenAPI.read(),'test-owner-token');
  assert.equal(storage.getItem(tokenAPI.key),'test-owner-token');
  assert.equal(tokenAPI.save('x'.repeat(4097)),false);
  assert.equal(tokenAPI.read(),'test-owner-token');
  assert.equal(tokenAPI.forget(),true);
  assert.equal(tokenAPI.read(),'');
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
test('blocked browser storage fails safely, never blocks generation',()=>{
 const old=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 try{assert.equal(tokenAPI.read(),'');assert.equal(tokenAPI.save('owner-token'),false);assert.equal(tokenAPI.forget(),false);}
 finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
test('the user controls local persistence and can remove saved access token',()=>{
 assert.match(index,/\/private-token-storage\.js/);
 assert.match(ui,/id="sfRememberToken" type="checkbox" checked/);
 assert.match(ui,/id="sfForgetToken"[^>]*>Forget saved token/);
 assert.match(ui,/const tokenStore=window\.StitchForgeTokenStore/);
 assert.match(ui,/q\('#sfForgetToken'\)\.onclick/);
 assert.match(ui,/tokenStore\?\.save\(token\)/);
 assert.match(ui,/tokenStore\?\.forget\(\)/);
 assert.doesNotMatch(ui,/localStorage\.setItem\(/);
});
test('one main button requests AI features at most once before the native stitch workflow',()=>{
 assert.match(ui,/id="sfAutoRun" type="button">Generate embroidery/);
 assert.match(ui,/id="sfAutoUseAI" type="checkbox" checked/);
 assert.match(ui,/fetch\('\/api\/analyse-embroidery'/);
 assert.match(ui,/aiCached\?\.source===source/);
 assert.match(ui,/const result=await api\.generate\(packed/);
 assert.ok(ui.indexOf('await analyseNativeFeatures(source,token,nativeAbort.signal)')<
  ui.indexOf('const result=await api.generate(packed'));
 assert.match(ui,/Continuing native digitising without a second paid AI request/);
 assert.match(ui,/No substitute machine file was produced/);
 assert.match(ai,/stitchforge:automatic-ai-report/);
 assert.match(ui,/AI advice does not yet change stitch geometry/);
});
test('legacy manual ZIP remains explicitly separate',()=>{
 assert.match(index,/Legacy outline ZIP/);
 assert.match(ui,/Download PES\/DST trial ZIP/);
});
