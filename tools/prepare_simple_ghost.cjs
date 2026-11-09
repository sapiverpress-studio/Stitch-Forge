#!/usr/bin/env node
/* Convert the same synthetic ghost RGBA through the REAL shipped browser
 * source/palette and signed packet modules. Native export happens in Python
 * only after the worker independently verifies every signed byte.
 */
const fs=require('node:fs'),path=require('node:path'),P=require('../site/artwork-pipeline.js');
const {ghost}=require('./simple_ghost_fixture.cjs');
(async()=>{
 const out=process.argv[2];if(!out)throw Error('Output directory required');
 fs.mkdirSync(out,{recursive:true});
 const {pixels,width,height}=ghost();
 const packed=await P.pack(pixels,width,height,
  {imageWidthMm:80,originalWidth:width,originalHeight:height,
   texturePolicy:'off',sizeMode:'visible',maxWorkingParts:160,profile:'simple_motif'});
 fs.writeFileSync(path.join(out,'ghost-actual-source-packet.json'),
   JSON.stringify({...packed.packet,phase:'pes'}));
 fs.writeFileSync(path.join(out,'ghost-source-plan.json'),JSON.stringify(packed.plan));
 fs.writeFileSync(path.join(out,'ghost-source-pixels.rgba'),Buffer.from(pixels));
 console.log(JSON.stringify({
  status:'SIGNED_BROWSER_SOURCE_PACKET_PREPARED_FOR_NATIVE_EXPORT',
  palette:packed.motifQuality.palette,sourcePixels:packed.motifQuality.sourcePixels,
  components:packed.motifQuality.components,physicalFrameWidthMm:packed.sizing.imageWidthMm,
  sourceSignature:packed.packet.requestId,
  machineFileGenerated:false},null,2));
})().catch(e=>{console.error(e?.stack||e);process.exitCode=1});
