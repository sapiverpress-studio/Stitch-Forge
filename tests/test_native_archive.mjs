import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync} from 'fflate';
import {readNativeArchive} from '../netlify/functions/lib/native-archive.mjs';

function fixture(){
 return {
  'machine-report.json':new TextEncoder().encode('{"audit":"trial"}'),
  'decoded-preview.json':new TextEncoder().encode('{"schema":"test"}'),
  'artwork-trial.pes':new TextEncoder().encode('#PES0060'+'.'.repeat(120)),
  'artwork-trial.dst':new Uint8Array(520).fill(44),
  'native-artwork-input.svg':new TextEncoder().encode('<svg/>')
 };
}
test('Netlify server ZIP validator reads audited trial without browser pipeline',()=>{
 const files=fixture(),archive=zipSync(files,{level:5});
 const result=readNativeArchive(archive);
 for(const [name,value] of Object.entries(files))
  assert.deepEqual(result[name],value);
 assert.equal(Object.getPrototypeOf(result),null);
});
test('native ZIP validator rejects CRC tampering',()=>{
 const archive=zipSync(fixture(),{level:5}),bad=archive.slice();
 const dv=new DataView(bad.buffer,bad.byteOffset,bad.byteLength);
 let at=-1;
 for(let i=0;i<bad.length-4;i++)if(dv.getUint32(i,true)===0x02014b50){at=i;break;}
 assert.ok(at>0);
 dv.setUint32(at+16,0,true);
 assert.throws(()=>readNativeArchive(bad),/checksum/);
});
test('native ZIP validator rejects path traversal and incomplete archives',()=>{
 const files=fixture();
 assert.throws(()=>readNativeArchive(zipSync({...files,'../secret.txt':new Uint8Array([1])})),/Unsafe native archive entry/);
 delete files['artwork-trial.dst'];
 assert.throws(()=>readNativeArchive(zipSync(files)),/incomplete/);
});
test('native ZIP validator rejects non-ZIP and oversized archives',()=>{
 assert.throws(()=>readNativeArchive(new Uint8Array(120)),/Broken or multi-volume/);
 assert.throws(()=>readNativeArchive(new Uint8Array(3000001)),/Invalid native archive size/);
});
test('private satin exporter has no browser pipeline import or dynamic editor requires',()=>{
 const source=readFileSync(new URL('../netlify/functions/lib/detailed-satin-export.mjs',import.meta.url),'utf8');
 assert.match(source,/from '\.\/native-archive\.mjs'/);
 assert.doesNotMatch(source,/site\/artwork-pipeline\.js|pipeline\.readArchive/);
});
