const test=require("node:test"),assert=require("node:assert/strict");
const {reconstruct}=require("../site/auto-reconstruct.js");
const w=240,h=160;
function source(){
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4,wing=(((x-64)/51)**2+((y-70)/43)**2<1)||
   (((x-174)/51)**2+((y-70)/43)**2<1);
  rgba[k]=rgba[k+1]=rgba[k+2]=wing?193:0;rgba[k+3]=255;
 }
 return rgba;
}
function region(id,cx){
 const positions=[[-.95,-.2],[-.75,-.75],[0,-1],[.75,-.75],[.98,0],[.7,.85],[0,1],[-.8,.7]];
 return{id,label:id,kind:"fill",semantic:"wing_panel",color:id==="left"?"#AABBDD":"#EECCAA",
 layer:0,confidence:"high",points:positions.map(([dx,dy])=>({
  x:Math.round((cx+dx*58)*1000/w),y:Math.round((70+dy*50)*1000/h)
 }))};
}
const plan=()=>({status:"AI_GEOMETRY_PROPOSAL_NOT_STITCHED",regions:[region("left",64),region("right",174)]});
test("automatically reconstructs two separate image-grounded wing fill contours",()=>{
 const result=reconstruct(source(),w,h,plan());
 assert.equal(result.status,"AUTO_RECONSTRUCTED_DRAFT_NOT_MACHINE_VERIFIED");
 assert.equal(result.regions.length,2);
 assert.equal(result.regions.filter(r=>r.kind==="fill").length,2);
 assert.notDeepEqual(result.regions[0].points,plan().regions[0].points.map(p=>[p.x*w/1000,p.y*h/1000]));
 assert.ok(result.regions.every(r=>r.geometrySource==="ai_polygon_intersected_with_artwork_pixels"));
 assert.ok(result.regions.every(r=>r.points.length>20&&r.points.length<=115));
 assert.ok(result.regions.every(r=>r.sourceSupport>.5));
 assert.deepEqual(result.regions.map(r=>r.color),["#AABBDD","#EECCAA"]);
});
test("does not invent wing fills where no artwork exists",()=>{
 const empty=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++)empty[i*4+3]=255;
 assert.throws(()=>reconstruct(empty,w,h,plan()),/at least two/);
});
test("rejects nonuniform photo background rather than pretending to segment it",()=>{
 const image=source();
 const coords=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1]];
 for(let j=0;j<coords.length;j++){const [x,y]=coords[j],k=(y*w+x)*4;image[k]=j*45;image[k+1]=j*25;image[k+2]=j*12;}
 assert.throws(()=>reconstruct(image,w,h,plan()),/Background is complex/);
});
test("rejects malformed AI shapes and too many regions",()=>{
 const invalid=plan();invalid.regions[0].points[2].x=1400;
 assert.throws(()=>reconstruct(source(),w,h,invalid),/invalid region/i);
 const huge=plan();huge.regions=Array(17).fill(region("same",64));
 assert.throws(()=>reconstruct(source(),w,h,huge),/Invalid AI geometry plan/);
});

test("retains pale low-contrast wing panels against a flat pale background",()=>{
 const image=source();
 for(let i=0;i<w*h;i++){const j=4*i;
  const wing=image[j]===193;image[j]=image[j+1]=image[j+2]=wing?241:250;
 }
 const result=reconstruct(image,w,h,plan());
 assert.equal(result.regions.filter(r=>r.kind==="fill").length,2);
 assert.ok(result.regions.every(r=>r.pixelArea>100));
});
test("snaps running veins to dark original pixels; rejects invented lines across flat fills",()=>{
 const image=source();
 for(let y=40;y<=101;y++)for(let x=63;x<=65;x++){
  const k=(y*w+x)*4;image[k]=image[k+1]=image[k+2]=17;
 }
 const line=(id,cx)=>({id,label:id,kind:"running",semantic:"wing_vein",color:"#342F31",
  confidence:"medium",layer:1,points:[{x:Math.round(cx*1000/w),y:Math.round(42*1000/h)},
   {x:Math.round(cx*1000/w),y:Math.round(98*1000/h)}]});
 const accepted=plan();accepted.regions.push(line("real-vein",66),line("invented",174));
 const result=reconstruct(image,w,h,accepted);
 const real=result.regions.find(r=>r.id==="real-vein");
 assert.ok(real,"image-grounded vein is retained");
 assert.equal(real.geometrySource,"source_pixel_contrast_snapped_centreline");
 assert.ok(real.points.length>=2);
 assert.ok(real.points.every(p=>Math.abs(p[0]-64)<=5));
 assert.ok(result.rejected.some(r=>r.id==="invented"&&r.reason==="line_not_supported_by_image_contrast"));
});

test("fills visible dark markings only, not an enclosing pale wing polygon",()=>{
 const image=source();
 for(let y=50;y<92;y++)for(let x=43;x<89;x++){
  if(((x-65)/10)**2+((y-70)/12)**2<1){
   const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=25;
  }
 }
 const marker={id:"left-mark",label:"Real left wing spot",kind:"fill",
  semantic:"wing_marking",color:"#191919",layer:1,confidence:"high",
  points:[[42,43],[85,45],[92,70],[85,95],[42,96],[38,70]]
   .map(([x,y])=>({x:Math.round(x*1000/w),y:Math.round(y*1000/h)}))};
 const proposed=plan();proposed.regions.push(marker);
 const out=reconstruct(image,w,h,proposed);
 const found=out.regions.find(r=>r.id==="left-mark");
 assert.ok(found,"actual marking should be extracted automatically");
 assert.equal(found.geometrySource,"ai_polygon_intersected_with_colour_matched_artwork_pixels");
 assert.ok(found.pixelArea>200&&found.pixelArea<450);
 assert.ok(found.sourceSupport<.5,"marking did not become a filled AI search polygon");
 assert.equal(found.color,"#191919");
 const absent=reconstruct(source(),w,h,proposed);
 assert.ok(!absent.regions.some(r=>r.id==="left-mark"));
 assert.ok(absent.rejected.some(r=>r.id==="left-mark"&&r.reason==="marking_colour_not_supported_by_pixels"));
});
