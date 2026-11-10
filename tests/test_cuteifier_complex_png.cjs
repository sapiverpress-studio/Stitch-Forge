const test=require('node:test');
const assert=require('node:assert/strict');
const image=require('../site/detailed-motif.js');
const outline=require('../site/ember-prep-core.js');

// Dense contrasting speckles stand in for a feathered or illustrated animal.
// This previously produced ~145 regions and blocked PNG download despite
// having no relevance to a machine-file stitch object budget.
function detailedSource(){
 const w=240,h=240,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=15;y<225;y++)for(let x=15;x<225;x++){
  const j=(y*w+x)*4;rgba.set([192,130,82,255],j);
  const n=16,step=205/n,gx=Math.floor((x-19)/step),gy=Math.floor((y-19)/step);
  if(gx>=0&&gy>=0&&gx<n&&gy<n&&
     (x-19)%step<4&&(y-19)%step<4){
   rgba.set([gx%2?20:58,gy%2?51:30,26,255],j);
  }
 }
 return {rgba,w,h};
}

test('a detailed bird-like input exceeding 110 regions still creates PNG-only artwork',()=>{
 const {rgba,w,h}=detailedSource();
 assert.throws(()=>image.prepare(rgba,w,h,{widthMm:80,preset:'body'}),/separate thread shapes/);
 const converted=image.prepare(rgba,w,h,{widthMm:80,preset:'body',imageOnly:true});
 assert.ok(converted.quality.regions>110,'regression fixture must exceed original object limit');
 const ink=outline.prepare(converted.rgba,w,h,{outline:'bold',detail:'major'});
 assert.deepEqual([ink.width,ink.height],[w,h]);
 assert.deepEqual([...ink.rgba.slice(0,4)],[0,0,0,0]);
 assert.ok(ink.quality.foregroundPixels>5000);
 assert.ok(ink.quality.outlinePixels>0);
 assert.ok(converted.quality.warnings.some(warning=>warning.includes('downloadable')));
});

test('simplification still refuses invalid input rather than producing a bogus file',()=>{
 const {rgba,w,h}=detailedSource();
 assert.throws(()=>image.prepare(rgba,w,h,{widthMm:2,imageOnly:true}),/widths from 30 to 200 mm/);
 assert.throws(()=>image.prepare(rgba,w,h,{preset:'invalid',imageOnly:true}),/Unknown Detailed Motif/);
});
