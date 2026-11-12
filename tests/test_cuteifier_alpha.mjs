import test from 'node:test';
import assert from 'node:assert/strict';
import alpha from '../site/cuteifier-alpha.js';
function fixture({width=100,height=100,inside=252,outside=0}={}) {
 const rgba = new Uint8ClampedArray(width*height*4);
 for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
  rgba[(y*width+x)*4+3]=(x>=20 && x<80 && y>=20 && y<80)?inside:outside;
 }
 return {rgba,width,height};
}
test('cutout: near-opaque watercolour pixels with genuine transparent margin are accepted',()=>{
 const f=fixture();
 const result=alpha.inspect(f.rgba,f.width,f.height,'cutout');
 assert.equal(result.valid,true);
 assert.equal(result.exactlyOpaque,0);
 assert.ok(result.nearlyOpaque>0);
});
test('cutout: low-alpha corners are allowed, but opaque canvas and fake transparency are rejected',()=>{
 const f=fixture({outside:6});
 assert.equal(alpha.inspect(f.rgba,f.width,f.height,'cutout').valid,true);
 const opaque=fixture({inside:255,outside:255});
 assert.equal(alpha.inspect(opaque.rgba,opaque.width,opaque.height,'cutout').valid,false);
 const faint=fixture({inside:50,outside:0});
 assert.equal(alpha.inspect(faint.rgba,faint.width,faint.height,'cutout').valid,false);
 const crowded=fixture({inside:252,outside:255});
 assert.equal(alpha.inspect(crowded.rgba,crowded.width,crowded.height,'cutout').valid,false);
});
test('full design: original strict opaque policy is unchanged',()=>{
 let f=fixture({inside:255,outside:255});
 assert.equal(alpha.inspect(f.rgba,f.width,f.height,'full-design').valid,true);
 f=fixture({inside:252,outside:0});
 assert.equal(alpha.inspect(f.rgba,f.width,f.height,'full-design').valid,false);
});
