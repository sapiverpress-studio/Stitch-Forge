/** Benchmark upstream Lilo 1.4.0 without modifying its digitizing algorithms.
 * Run inside an EPHEMERAL clone of Kadwood/lilo. Input is checked CC0-only.
 * Requires externally created raw RGBA fixture data, never private owner art.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { initVtracerNode } from '@lilo/engine/node';
import { autoDigitize, designToEmbroidery } from '@lilo/engine';

const inputDir = process.env.LILO_BENCH_INPUT;
const outputDir = process.env.LILO_BENCH_OUTPUT;
if (!inputDir || !outputDir) throw Error('Missing benchmark input/output');
mkdirSync(outputDir, {recursive:true});
await initVtracerNode();
const report={schema:'stitch-forge-external-lilo-v1',
 upstream:'Kadwood/lilo',commit:'c82a9d7ddae21e73048ccd4163b2ad22c4829f8c',
 release:'v1.4.0',publicCC0Only:true,physicalSewoutVerified:false,
 candidateMachineApproved:false,results:[]};
for (const id of ['macaw','rose']) {
 const info=JSON.parse(readFileSync(join(inputDir,id+'.json'),'utf8'));
 const rgba=readFileSync(join(inputDir,id+'.rgba'));
 if(rgba.length!==info.width*info.height*4)throw Error('RGBA byte count mismatch');
 if(createHash('sha256').update(rgba).digest('hex')!==info.rgbaSha256)
   throw Error('Public input integrity mismatch');
 const scale=80/Math.max(info.width,info.height);
 const record={fixture:id,inputSourceSha256:info.pngSha256,
  maxSideMm:80,colours:9,quality:'premium',nativeFiles:[],success:false};
 try{
  const result=await autoDigitize({width:info.width,height:info.height,
      data:new Uint8ClampedArray(rgba)},
   {colors:9,widthMm:Math.round(info.width*scale*1000)/1000,
    heightMm:Math.round(info.height*scale*1000)/1000,
    quality:'premium',removeBackground:true,maxImageSide:800});
  record.objectCount=result.design.objects.length;
  record.threadCount=result.design.threads.length;
  record.palette=result.palette.map(x=>({
     sourceHex:x.sourceHex,threadHex:x.thread?.hex,
     share:Number(x.share.toFixed(4))}));
  for(const ext of ['pes','dst']){
   const output=designToEmbroidery(result.design,ext,{label:'LILO-CC0'});
   const filename=id+'-Lilo-premium-NOT-APPROVED.'+ext;
   writeFileSync(join(outputDir,filename),output.bytes);
   record.nativeFiles.push({ext,filename,
      sha256:createHash('sha256').update(output.bytes).digest('hex'),
      bytes:output.bytes.length,
      stats:output.stats,
      warnings:output.warnings.map(w=>w.message).slice(0,30)});
  }
  writeFileSync(join(outputDir,id+'.lilo.trace.svg'),result.svg);
  record.success=record.nativeFiles.length===2;
 }catch(e){
  record.failure=String(e?.stack||e).slice(0,2400);
 }
 report.results.push(record);
 console.log(JSON.stringify(record));
}
writeFileSync(join(outputDir,'LILO-EXTERNAL-ENGINE-REPORT.json'),
 JSON.stringify(report,null,2)+'\n');
if(report.results.some(x=>!x.success))process.exitCode=1;
