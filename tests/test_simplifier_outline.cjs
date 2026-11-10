const test=require('node:test');
const assert=require('node:assert/strict');
const {outline}=require('../site/simplifier-outline.js');
const w=64,h=64,rgba=new Uint8ClampedArray(w*h*4);
for(let y=12;y<52;y++)for(let x=12;x<52;x++){
 rgba.set(x<30?[185,115,72,255]:[51,145,190,255],(y*w+x)*4);
}
// Deliberate inner transparent hole must NOT receive an extra black contour.
for(let y=30;y<35;y++)for(let x=30;x<35;x++)rgba.set([0,0,0,0],(y*w+x)*4);
test('default original image remains untouched; outline runs only on explicit invocation',()=>{
 const source=new Uint8ClampedArray(rgba);
 const processed=outline(rgba,w,h);
 assert.deepEqual(rgba,source,'must not mutate simplifier output');
 assert.deepEqual([...processed.slice((12*w+20)*4,(12*w+20)*4+4)],[0,0,0,255]);
 assert.deepEqual([...processed.slice((22*w+20)*4,(22*w+20)*4+4)],[185,115,72,255]);
 assert.deepEqual([...processed.slice((22*w+35)*4,(22*w+35)*4+4)],[51,145,190,255],'no black border at colour change');
 assert.deepEqual([...processed.slice((30*w+29)*4,(30*w+29)*4+4)],[185,115,72,255],'do not outline transparent internal hole');
 assert.deepEqual([...processed.slice(0,4)],[0,0,0,0]);
});
test('outline is deterministic and rejects bad parameters',()=>{
 assert.deepEqual(outline(rgba,w,h),outline(rgba,w,h));
 assert.throws(()=>outline(rgba,w,h,{thickness:9}),/Invalid outline width/);
 assert.throws(()=>outline(rgba,w,0),/Invalid artwork dimensions/);
});
