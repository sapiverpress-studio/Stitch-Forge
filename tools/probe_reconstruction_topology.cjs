// Local structural investigation. No AI response is fabricated or replayed.
// Optional input: raw RGBA8 file, width, height, and a public sample label.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'..');
const {ledgerFromMask,maskFromLedger}=require('../site/source-mask-ledger.js');
let source=fs.readFileSync(path.join(repo,'site/auto-reconstruct.js'),'utf8');
const exportAt='root.StitchForgeAutoReconstruct=Object.freeze(';
if(!source.includes(exportAt))throw Error('Probe no longer matches module; review its instrumentation');
// The scratch VM exposes functions and rejected reasons. Geometry logic is unchanged.
source=source.replace(exportAt,'root.__probe={foregroundMask};'+exportAt);
const context={Uint8ClampedArray,Uint8Array,Int16Array,Uint32Array,module:{exports:{}}};
vm.createContext(context);vm.runInContext(source,context);
const {reconstruct,analyseArtwork}=context.module.exports;
const region=(color='#4080C0')=>({id:'probe',label:'Diagnostic search area',kind:'fill',semantic:'other',color,
 layer:0,confidence:'high',points:[{x:50,y:50},{x:950,y:50},{x:950,y:950},{x:50,y:950}]});
function run(name,rgba,w,h,r=region()){
 try{
  const out=reconstruct(rgba,w,h,{status:'AI_GEOMETRY_PROPOSAL_NOT_STITCHED',regions:[r]});
  return {name,status:'returned',regionCount:out.regions.length,coverage:out.quality.coverage,rejected:out.rejected};
 }catch(e){return {name,status:'refused',error:e.message,rejected:e.rejected||[]};}
}
function controls(){
 const w=128,h=128,make=()=>new Uint8ClampedArray(w*h*4);
 const pixel=(a,x,y,rgb,alpha=255)=>a.set([...rgb,alpha],(y*w+x)*4);
 const rectangle=a=>{for(let y=20;y<108;y++)for(let x=20;x<108;x++)pixel(a,x,y,[64,128,192]);};
 const output=[];
 let a=make();rectangle(a);output.push(run('solid_rectangle',a,w,h));
 a=make();rectangle(a);pixel(a,14,14,[64,128,192]);output.push(run('rectangle_plus_one_pixel_island',a,w,h));
 a=make();rectangle(a);pixel(a,60,60,[0,0,0],0);output.push(run('rectangle_with_one_pixel_hole',a,w,h));
 a=make();for(let y=20;y<108;y++)for(let x=20;x<108;x++)pixel(a,x,y,[180,90,30]);
 for(let y=22;y<106;y+=4)for(let x=22;x<106;x+=4)pixel(a,x,y,[64,128,192]);
 const r=region();r.semantic='marking';output.push(run('many_isolated_colour_marks',a,w,h,r));
 return output;
}
function colourMaskProbes(file,w,h,label){
 const rgba=new Uint8ClampedArray(fs.readFileSync(file));
 const inspection=analyseArtwork(rgba,w,h),foreground=context.__probe.foregroundMask(rgba,w,h),masks=[];
 for(const [index,c] of inspection.palette.entries()){
  const rgb=[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)),mask=new Uint8Array(w*h);
  for(let k=0;k<mask.length;k++){
   const j=k*4;if(foreground[k]&&Math.hypot(rgba[j]-rgb[0],rgba[j+1]-rgb[1],rgba[j+2]-rgb[2])<=48)mask[k]=1;
  }
  const r=region(c.color);r.semantic='marking';r.points=[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}];
  const current=run('palette-mask-'+(index+1),rgba,w,h,r);
  const ledger=ledgerFromMask(mask,w,h),roundtrip=maskFromLedger(ledger);
  masks.push({index:index+1,selectedPixels:ledger.foregroundPixels,components:ledger.components.length,
   smallComponents:ledger.components.filter(c=>c.reviewFlags.length).length,
   currentStatus:current.status,currentRejectedReasons:current.rejected.map(r=>r.reason),
   maskLedgerRoundtripExact:Buffer.from(roundtrip).equals(Buffer.from(mask)),machineApproved:false});
 }
 return {label,width:w,height:h,paletteMasks:masks.length,
  explanation:'Whole-image colour search masks, not AI-proposed boundaries. This isolates mask handling and is not reconstruction acceptance.',masks};
}
(async()=>{
 const {parseModelResponse}=await import(pathToFileURL(path.join(repo,'netlify/functions/reconstruct-embroidery.mjs')));
 const r={...region(),notes:'Synthetic triangle control',points:[{x:200,y:200},{x:800,y:200},{x:500,y:800},{x:200,y:200}]};
 const plan={subject:'synthetic triangle',regions:[r],warnings:[],requires_machine_test:true};
 let triangle;
 try{const out=parseModelResponse({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan)}]}]});
  triangle={status:'accepted',uniqueVertices:out.regions[0].points.length};}
 catch(e){triangle={status:'refused',error:e.message,diagnostics:e.diagnostics};}
 const args=process.argv.slice(2);
 console.log(JSON.stringify({scope:'Local structural probes only. No model call, semantic reconstruction, stitch plan or machine files.',
  controls:controls(),closedTriangle:triangle,
  ...(args.length?{suppliedRaster:colourMaskProbes(args[0],Number(args[1]),Number(args[2]),args[3]||'supplied-raster')}:{})},null,2));
})();
