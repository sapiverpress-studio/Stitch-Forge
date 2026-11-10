/* Private Netlify-native reader for the audited Ink/Stitch ZIP.
 * Never import the browser artwork pipeline here: that module dynamically
 * requires editor-only dependencies which Netlify cannot resolve in a function.
 * Mirror the browser's archive limits, integrity checks and required entries.
 */
import {inflateRawSync} from 'node:zlib';

const MAX_ARCHIVE_BYTES=3000000;
const MAX_UNPACKED_BYTES=20000000;
const REQUIRED=['machine-report.json','decoded-preview.json','artwork-trial.pes','artwork-trial.dst'];

function crc32(bytes){
 let value=-1;
 for(const byte of bytes){
  value^=byte;
  for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);
 }
 return (value^-1)>>>0;
}

export function readNativeArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<100||bytes.length>MAX_ARCHIVE_BYTES)
  throw Error('Invalid native archive size');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 }
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true)||
  view.getUint16(end+8,true)!==view.getUint16(end+10,true)||
  end+22+view.getUint16(end+20,true)!==bytes.length)
  throw Error('Broken or multi-volume native archive');
 const count=view.getUint16(end+10,true);
 const centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
 let at=centralOffset,unpacked=0;
 if(count<4||count>12||centralOffset+centralSize!==end)
  throw Error('Native archive directory budget failed');
 const files=Object.create(null);
 const decoder=new TextDecoder('utf-8',{fatal:true});
 for(let index=0;index<count;index++){
  if(at+46>end||view.getUint32(at,true)!==0x02014b50)
   throw Error('Broken native archive directory');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true);
  const crc=view.getUint32(at+16,true),compressed=view.getUint32(at+20,true);
  const size=view.getUint32(at+24,true),nameLen=view.getUint16(at+28,true);
  const extraLen=view.getUint16(at+30,true),commentLen=view.getUint16(at+32,true);
  const offset=view.getUint32(at+42,true);
  unpacked+=size;
  if((flags&1)||![0,8].includes(method)||unpacked>MAX_UNPACKED_BYTES||
   at+46+nameLen+extraLen+commentLen>end)
   throw Error('Native archive exceeds extraction budget');
  const name=decoder.decode(bytes.subarray(at+46,at+46+nameLen));
  if(!/^[a-zA-Z0-9._-]{1,100}$/.test(name)||
   Object.hasOwn(files,name)||offset+30>centralOffset||
   view.getUint32(offset,true)!==0x04034b50||
   view.getUint16(offset+8,true)!==method)
   throw Error('Unsafe native archive entry');
  const localNameLen=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true);
  const start=offset+30+localNameLen+localExtra;
  if(decoder.decode(bytes.subarray(offset+30,offset+30+localNameLen))!==name||
   start+compressed>centralOffset)
   throw Error('Native archive entry overlaps directory');
  const chunk=bytes.subarray(start,start+compressed);
  const raw=method===0?chunk.slice():new Uint8Array(inflateRawSync(chunk,{maxOutputLength:Math.max(size,1)}));
  if(raw.length!==size||crc32(raw)!==crc)
   throw Error('Native archive checksum failed');
  files[name]=raw;
  at+=46+nameLen+extraLen+commentLen;
 }
 if(at!==end||REQUIRED.some(name=>!files[name]))
  throw Error('Native archive is incomplete');
 if(decoder.decode(files['artwork-trial.pes'].subarray(0,8))!=='#PES0060'||
  files['artwork-trial.dst'].length<515)
  throw Error('Native machine files are incomplete');
 return files;
}
