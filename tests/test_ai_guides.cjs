const test=require('node:test');
const assert=require('node:assert/strict');
const {buildDraft}=require('../site/ai-guides.js');
function synthetic(withLine=true){
 const w=160,h=120,pixels=new Uint8ClampedArray(w*h*4);
 for(let k=0;k<w*h;k++)pixels.set([239,239,239,255],k*4);
 if(withLine)for(let y=30;y<35;y++)for(let x=30;x<125;x++)pixels.set([77,66,54,255],(y*w+x)*4);
 return {w,h,pixels};
}
const regions=[
 {id:'vein',label:'Vein',category:'wing_vein',suggested_color:'#ac8653',bbox:{x_min:100,y_min:100,x_max:900,y_max:750}},
 {id:'wing',label:'Wing',category:'wing',suggested_color:'#d0d0d0',bbox:{x_min:0,y_min:0,x_max:1000,y_max:1000}}
];
test('detail paths follow source-image lines; AI rectangles and fills do not become stitches',()=>{
 let {w,h,pixels}=synthetic();
 const result=buildDraft(pixels,w,h,regions,78);
 assert.equal(result.status,'DRAFT_IMAGE_DERIVED_NOT_MACHINE_VERIFIED');
 assert.equal(result.proposedRegions,1);assert.equal(result.ignoredNonLineRegions,1);
 assert.ok(result.paths.length>0);
 assert.ok(result.paths.every(x=>x.regionId==='vein'&&x.suggestedStitch==='running'));
 assert.ok(result.paths.every(x=>x.points.every(([x,y])=>x>20&&x<135&&y>24&&y<43)));
});
test('no image details => no invented stitch paths',()=>{
 const {w,h,pixels}=synthetic(false);
 assert.equal(buildDraft(pixels,w,h,regions,78).paths.length,0);
});
test('invalid bounds and excessive limits are rejected',()=>{
 const {w,h,pixels}=synthetic();
 assert.throws(()=>buildDraft(pixels,w,h,regions,78,{threshold:2}));
 assert.throws(()=>buildDraft(pixels,w,h,regions,78,{maxGuides:1000}));
 assert.throws(()=>buildDraft(pixels,w,h,Array(25).fill(regions[0]),78));
 assert.throws(()=>buildDraft(pixels,w+1,h,regions,78));
 assert.ok(buildDraft(pixels,w,h,regions,78,{maxGuides:1}).paths.length<=1);
});
