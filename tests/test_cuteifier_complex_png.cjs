const test=require('node:test');
const assert=require('node:assert/strict');
const motif=require('../site/detailed-motif.js');
const w=160,h=144,rgba=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 if(((x-80)/56)**2+((y-70)/50)**2>1)continue;
 const change=(x*17+y*29)%17-8;
 rgba.set([185+change,124+change,76+change,255],(y*w+x)*4);
 if(x>=57&&x<77&&y>=48&&y<52)rgba.set([19,15,12,255],(y*w+x)*4);
}
test('original capybara-style simplifier produces unmodified, transparent artwork',()=>{
 const a=motif.prepare(rgba,w,h,{preset:'body',widthMm:80,imageOnly:true});
 const b=motif.prepare(rgba,w,h,{preset:'body',widthMm:80,imageOnly:true});
 assert.deepEqual(a,b);
 assert.equal(a.width,w);assert.equal(a.height,h);
 assert.equal(a.rgba[3],0);
 assert.equal(a.rgba[(70*w+80)*4+3],255);
 assert.ok(a.palette.length>0);
});
test('image-only mode does not affect native region-budget checks',()=>{
 assert.throws(()=>motif.prepare(rgba,w,h,{widthMm:1,imageOnly:true}),/widths from 30 to 200 mm/);
});
