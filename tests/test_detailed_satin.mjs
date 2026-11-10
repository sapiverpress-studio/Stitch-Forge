import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {EmbConstant,EmbPattern,readPes,readDst,writePes,writeDst} from '@guillaumemmm/tsembroidery';
import {zipSync,unzipSync} from 'fflate';
import {addDetailedSatin} from '../netlify/functions/lib/detailed-satin-export.mjs';
import satin from '../site/detailed-satin.js';

const W=240,H=240,frame=84;
const sha=(...parts)=>{const h=createHash('sha256');for(const part of parts)h.update(part);return h.digest('hex');};
const json=x=>Buffer.from(JSON.stringify(x));
function syntheticSubject(colour){
 const rgba=Buffer.alloc(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if((x-120)**2+(y-120)**2>90**2)continue;
  rgba.set([...colour,255],4*(y*W+x));
 }
 return rgba;
}

test('satin derives a single closed silhouette from source pixels',()=>{
 const rgba=syntheticSubject([203,124,79]);
 const result=satin.plan(rgba,W,H,80);
 assert.deepEqual(result,satin.plan(rgba,W,H,80));
 const [outline]=result.columns;
 assert.equal(result.columns.length,1);
 assert.equal(outline.closed,true);
 assert.deepEqual(outline.left[0],outline.left.at(-1));
 assert.deepEqual(outline.right[0],outline.right.at(-1));
 assert.throws(()=>satin.plan(Buffer.alloc(rgba.length),W,H,80),/continuous edge/);
});

function machineFixture(colour){
 const rgb=Array.from(Buffer.from(colour.slice(1),'hex'));
 const rgba=syntheticSubject(rgb),dimensions=Buffer.alloc(8);
 dimensions.writeUInt32BE(W,0);dimensions.writeUInt32BE(H,4);
 const source={width:W,height:H,sha256:sha(dimensions,rgba)},palette=[colour];
 const header=JSON.stringify({schema:'stitch-forge-artwork-request-v1',texturePolicy:'off',imageWidthMm:80,source,palette});
 const packet={header,rgbaGzip:gzipSync(rgba).toString('base64'),requestId:'a'.repeat(64)};
 const base=new EmbPattern();
 base.addThread({hex:colour});
 for(const offset of [100,200,300,400])base.moveAbs(offset,offset);
 for(const [x,y] of [[400,400],[410,410],[420,420]])base.stitchAbs(x,y);
 base.end();
 const pes=writePes(base,{encode:false}),dst=writeDst(base,{encode:false});
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkstitch="http://inkstitch.org/namespace"></svg>');
 const receipt={requestId:packet.requestId,pesSha256:sha(pes),svgSha256:sha(svg)};
 const preview={requestId:packet.requestId,palette,widthMm:frame,heightMm:frame};
 const decoded=Object.entries({pes,dst}).map(([format,bytes])=>({
  format,sha256:sha(bytes),needleStitches:3,translationToSourceMm:[0,0],requestedColourOrder:palette,
  needlePointsOutsideWorkingColour:0,needleSegmentsOutsideWorkingColour:0}));
 const report={requestId:packet.requestId,source,sourceBinding:{foregroundIndependentlyVerified:true,sourceMeanRgbDistance:0},
  machineEligible:false,physicalQualityVerified:false,unresolvedObjects:0,workflow:'TWO_NATIVE_PHASES_NO_AI',
  nativeInputSha256:receipt.svgSha256,decoded};
 return {packet,receipt,files:{
  'artwork-trial.pes':pes,'artwork-trial.dst':dst,'native-artwork-input.svg':svg,
  'machine-report.json':json(report),'decoded-preview.json':json(preview)}};
}

for(const colour of ['#CB7C4F','#000000'])test('finished PES and DST agree and retain the base for '+colour,async()=>{
 const {files,packet,receipt}=machineFixture(colour);
 const output=unzipSync(await addDetailedSatin(zipSync(files),packet,receipt));
 const report=JSON.parse(Buffer.from(output['machine-report.json']));
 const preview=JSON.parse(Buffer.from(output['decoded-preview.json']));
 const needles=pattern=>pattern.stitches.filter(stitch=>stitch[2]===EmbConstant.STITCH);
 const pes=readPes(output['artwork-trial.pes']),dst=readDst(output['artwork-trial.dst']);
 assert.deepEqual(needles(pes),needles(dst));
 assert.deepEqual(needles(pes).slice(0,3),needles(readPes(files['artwork-trial.pes'])));
 assert.ok(report.satinFinish.needleStitches>300);
 assert.equal(needles(pes).length,3+report.satinFinish.needleStitches);
 assert.equal(pes.countColorChanges(),colour==='#000000'?0:1);
 assert.equal(pes.threadlist.at(-1).hexColor(),'#000000');
 assert.equal(preview.segments.at(-1)[4],preview.palette.length-1);
 assert.match(Buffer.from(output['native-artwork-input.svg']).toString(),/inkstitch:satin_column="true"/);
 await assert.rejects(addDetailedSatin(zipSync(files),packet,{...receipt,pesSha256:'b'.repeat(64)}),/base motif/);
});
