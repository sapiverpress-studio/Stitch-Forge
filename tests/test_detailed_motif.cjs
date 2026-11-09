const test=require('node:test');
const assert=require('node:assert/strict');
const {gunzipSync}=require('node:zlib');
const motif=require('../site/detailed-motif.js');
const pipeline=require('../site/artwork-pipeline.js');

const w=160,h=144;
const place=(rgba,x,y,colour)=>rgba.set(colour,(y*w+x)*4);
function raster(opaque) {
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(opaque) place(rgba,x,y,[248,245,240,255]);
  if(((x-80)/59)**2+((y-70)/50)**2>1)continue;
  const variation=(x*19+y*71)%23-11,shade=y<75?0:-36;
  place(rgba,x,y,[195+variation+shade,126+variation+shade,73+variation+shade,255]);
  // A thin curved, high-contrast ridge embedded in low-contrast texture.
  const eye=49+Math.round((x-66)**2/60);
  if(x>=51&&x<=79&&Math.abs(y-eye)<=1)place(rgba,x,y,[22,15,12,255]);
 }
 if(!opaque)place(rgba,4,5,[190,110,60,255]);
 return rgba;
}

test('detailed motif isolates alpha subject, removes flecks and retains a curved contrast mark',()=>{
 const input=raster(false), a=motif.prepare(input,w,h),b=motif.prepare(input,w,h);
 assert.deepEqual(a,b);
 assert.ok(a.palette.length>=3&&a.palette.length<=8);
 assert.ok(a.quality.contrastGroups>0);
 assert.equal(a.quality.removedFragmentsPixels,1);
 assert.equal(a.rgba[(5*w+4)*4+3],0);
 assert.equal(a.rgba[(70*w+80)*4+3],255);
 assert.ok(a.rgba[(49*w+66)*4]<65);
 assert.ok(a.rgba[(46*w+66)*4]>100);
});

test('plain opaque borders separate by connectivity; ambiguous backgrounds are refused',()=>{
 const input=raster(true), result=motif.prepare(input,w,h);
 assert.equal(result.quality.background,'plain_border');
 assert.equal(result.rgba[3],0);
 assert.equal(result.rgba[(70*w+80)*4+3],255);
 for(let x=0;x<w/2;x++)place(input,x,0,[1,30,60,255]);
 assert.throws(()=>motif.prepare(input,w,h),/background is too varied/);
});

test('signed detailed packet contains exactly the approved illustration and palette',async()=>{
 const illustration=motif.prepare(raster(false),w,h);
 const options={profile:'detailed_motif',sizeMode:'visible',texturePolicy:'off',approvedPalette:illustration.palette};
 const {packet,draft,plan}=await pipeline.pack(illustration.rgba,w,h,options);
 assert.deepEqual(gunzipSync(Buffer.from(packet.rgbaGzip,'base64')),Buffer.from(illustration.rgba));
 const labels=gunzipSync(Buffer.from(packet.labelsGzip,'base64'));
 const header=JSON.parse(packet.header);
 assert.equal(header.schema,'stitch-forge-artwork-request-v1');
 assert.equal(header.texturePolicy,'off');
 assert.deepEqual(header.palette,illustration.palette);
 assert.equal(plan.summary.recolouredPixels,0);
 assert.equal(plan.summary.omittedPixels,0);
 assert.equal(draft.foregroundPixels,labels.filter(n=>n>0).length);
 for(let i=0;i<labels.length;i++){
  const at=4*i;
  if(!labels[i]){assert.equal(illustration.rgba[at+3],0);continue;}
  const rgb=Buffer.from(illustration.rgba.slice(at,at+3)).toString('hex').toUpperCase();
  assert.equal('#'+rgb,header.palette[labels[i]-1]);
 }
 await assert.rejects(()=>pipeline.pack(illustration.rgba,w,h,{...options,texturePolicy:'if_needed'}),/must not silently/);
 await assert.rejects(()=>pipeline.pack(illustration.rgba,w,h,{...options,approvedPalette:illustration.palette.slice(1)}),/differ from the illustration palette/);
});
