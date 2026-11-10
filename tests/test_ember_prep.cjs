const test=require('node:test');
const assert=require('node:assert/strict');
const outline=require('../site/ember-prep-core.js');
function example(){
 const w=64,h=64,rgba=new Uint8ClampedArray(w*h*4);
 for(let y=9;y<54;y++)for(let x=11;x<51;x++){
  const c=x<32?[206,142,89,255]:[94,149,189,255];
  rgba.set(c,(y*w+x)*4);
 }
 rgba.set([26,19,14,255],(25*w+20)*4);
 return {w,h,rgba};
}
test('Ember prep creates a transparent black outline without background pixels',()=>{
 const {w,h,rgba}=example();
 const a=outline.prepare(rgba,w,h),b=outline.prepare(rgba,w,h);
 assert.deepEqual(a,b);
 assert.deepEqual([...a.rgba.slice(0,4)],[0,0,0,0]);
 assert.deepEqual([...a.rgba.slice((10*w+11)*4,(10*w+11)*4+4)],[0,0,0,255]);
 assert.deepEqual([...a.rgba.slice((30*w+17)*4,(30*w+17)*4+4)],[206,142,89,255]);
 assert.deepEqual([...a.rgba.slice((25*w+20)*4,(25*w+20)*4+4)],[0,0,0,255]);
 assert.equal(a.quality.semanticRedraw,false);
});
test('major boundary is optional and bold grows outer outline',()=>{
 const {w,h,rgba}=example();
 const outer=outline.prepare(rgba,w,h,{detail:'outer'});
 const major=outline.prepare(rgba,w,h,{detail:'major'});
 const bold=outline.prepare(rgba,w,h,{outline:'bold',detail:'outer'});
 assert.equal(outer.quality.internalBoundaryPixels,0);
 assert.ok(major.quality.internalBoundaryPixels>0);
 assert.ok(bold.quality.outlinePixels>outer.quality.outlinePixels);
});
test('invalid colours, sizes and completely opaque images fail safely',()=>{
 const {w,h,rgba}=example();
 assert.throws(()=>outline.prepare(rgba,w,h,{outline:'giant'}),/valid outline/);
 assert.throws(()=>outline.prepare(rgba,w,h,{detail:'unknown'}),/outer or major/);
 assert.throws(()=>outline.prepare(new Uint8ClampedArray(w*h*4).fill(255),w,h),/transparent subject/);
});
