/* Declared synthetic raster controls; all output rings are extracted by the
 * actual source-mask/topology modules. No ideal polygon outlines are supplied.
 */
const fs=require('node:fs'),path=require('node:path');
const {createDraft}=require('../site/source-region-project.js');
const assert=require('node:assert/strict');
(async()=>{
 const output=process.argv[2],nested=process.argv[3]==='nested',w=160,h=128;
 const rgba=new Uint8ClampedArray(w*h*4),red=new Uint8Array(w*h),blue=new Uint8Array(w*h);
 for(let y=16;y<112;y++)for(let x=12;x<124;x++)if(!(x>=48&&x<88&&y>=40&&y<80))red[y*w+x]=1;
 const bounds=nested?[60,52,76,68]:[136,48,152,80];
 for(let y=bounds[1];y<bounds[3];y++)for(let x=bounds[0];x<bounds[2];x++)blue[y*w+x]=1;
 for(const [mask,color] of [[red,'#ED171F'],[blue,'#0A55A3']]){
  for(let k=0;k<mask.length;k++)if(mask[k])rgba.set([...([1,3,5].map(i=>parseInt(color.slice(i,i+2),16))),255],k*4);
 }
 // The raster, not the authoring masks, is given to the actual app extractor.
 const draft=await createDraft(rgba,w,h,{imageWidthMm:80}),regions=[];
 for(const source of draft.regions){
  for(const c of source.topology.components){
   assert.equal(c.rings.filter(r=>r.role==='outer').length,1);
   regions.push({id:'source-component-'+(regions.length+1),color:source.color,
    outer:c.rings.find(r=>r.role==='outer').points,holes:c.rings.filter(r=>r.role==='hole').map(r=>r.points)});
  }
 }
 const regionOrder=regions.slice().sort((a,b)=>(a.color==='#ED171F'?-1:1)-(b.color==='#ED171F'?-1:1)).map(r=>r.id);
 const result={schema:'stitch-forge-local-compound-control-v1',source:{width:w,height:h,sha256:draft.source.sha256},
  imageWidthMm:80,regions,regionOrder,
  settings:{angleDeg:0,rowSpacingMm:.6,maxStitchMm:3.5,underlay:false}};
 if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'source.rgba'),rgba);
  fs.writeFileSync(path.join(output,'source-extracted-compound-control.json'),JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
})();
