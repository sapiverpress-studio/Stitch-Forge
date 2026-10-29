const test=require("node:test"),assert=require("node:assert/strict");
const {reconstruct,analyseArtwork,formatFillValidationFailure}=require("../site/auto-reconstruct.js");
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
test("formats individual rejected fill diagnostics",()=>{
 const failures=[
  {region:2,reason:"Region is too thin for experimental tatami fill"},
  {region:5,reason:"Boundary crosses itself; reposition the points"},
  {region:7,reason:"Fill points must remain inside the artwork"},
  {region:9,reason:"Region is too small or flattened for a fill"},
  {region:10,reason:"Boundary points too close together"},
  {region:11,reason:"Closing edge too short"}
 ];
 const accepted=[{region:1,label:"body"},{region:3,label:"left wing"},{region:4,label:"right wing"}];
 failures[0].label="eye";failures[1].label="antenna";
 const message=formatFillValidationFailure(accepted,failures);
 assert.match(message,/Basic geometry checks passed for 3 region\(s\): region 1 \(body\), region 3 \(left wing\), region 4 \(right wing\)/);
 assert.match(message,/region 2 \(eye\): Region is too thin for experimental tatami fill/);
 assert.match(message,/region 5 \(antenna\): Boundary crosses itself; reposition the points/);
 assert.match(message,/region 7: Fill points must remain inside the artwork/);
 assert.match(message,/region 9: Region is too small or flattened for a fill/);
 assert.match(message,/2 additional fill region\(s\) failed/);
 assert.match(message,/original design is unchanged; partial replacement and machine export were blocked/);
 assert.equal((message.match(/region \d+(?: \([^)]*\))?:/g)||[]).length,4);
});
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
 assert.throws(()=>reconstruct(empty,w,h,plan()),/any supported regions/);
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
 const huge=plan();huge.regions=Array(33).fill(region("same",64));
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

test("supports a single rectangular logo on opaque and transparent backgrounds",()=>{
 for(const transparent of [false,true]){
  const image=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const j=(y*w+x)*4,logo=x>=60&&x<180&&y>=40&&y<120;
   image[j]=logo?35:255;image[j+1]=logo?100:255;image[j+2]=logo?160:255;
   image[j+3]=logo||!transparent?255:0;
  }
  const points=[[50,30],[120,30],[190,30],[190,80],[190,130],[120,130],[50,130],[50,80]];
  const p={status:plan().status,regions:[{id:'logo',label:'Synthetic rectangular logo',kind:'fill',
   semantic:'other',color:'#2364A0',layer:0,confidence:'high',
   points:points.map(([x,y])=>({x:Math.round(x*1000/w),y:Math.round(y*1000/h)}))}]};
  const out=reconstruct(image,w,h,p);
  assert.equal(out.regions.length,1);assert.equal(out.rejected.length,0);
  assert.equal(out.regions[0].points.length,4);
  assert.equal(out.regions[0].pixelArea,120*80);
 }
});
test("supports line-only artwork without inventing fill regions",()=>{
 const image=new Uint8ClampedArray(w*h*4);image.fill(255);
 for(let y=35;y<125;y++)for(let x=98;x<=102;x++){
  const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=20;
 }
 const p={status:plan().status,regions:[{id:'line',label:'Synthetic line art',kind:'running',
  semantic:'detail',color:'#141414',layer:0,confidence:'high',
  points:[{x:417,y:250},{x:417,y:750}]}]};
 const out=reconstruct(image,w,h,p);
 assert.equal(out.regions.length,1);assert.equal(out.regions[0].kind,'running');
 assert.equal(out.rejected.length,0);
});

test("rejects holes and preserves disconnected components separately",()=>{
 for(const hole of [true,false]){
  const image=source();
  for(let y=0;y<h;y++)for(let x=20;x<110;x++){
   if(hole?((x-64)**2+(y-70)**2<12**2):(x>=60&&x<=68)){
    const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=0;
   }
  }
  const out=reconstruct(image,w,h,plan());
  if(hole)assert.ok(out.rejected.some(r=>r.id==='left'&&r.reason==='fill_holes_not_supported'));
  else {assert.equal(out.regions.filter(r=>r.parentId==='left').length,2);assert.deepEqual(out.rejected,[]);}
 }
});

test("zero-cost local artwork audit finds real colour groups and source detail",()=>{
 const width=128,height=128,rgba=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const j=4*(y*width+x),background=x<12||x>=116||y<12||y>=116;
  rgba[j]=background?255:x<64?10:225;
  rgba[j+1]=background?255:x<64?90:95;
  rgba[j+2]=background?255:x<64?210:10;
  rgba[j+3]=255;
 }
 const audit=analyseArtwork(rgba,width,height);
 assert.equal(audit.source,"local_pixel_scan");
 assert.equal(audit.requiresMachineTest,true);
 assert.ok(audit.foregroundPixels>10000);
 assert.equal(audit.palette.length,2);
 assert.deepEqual(audit.palette.map(c=>c.color),["#0A5AD2","#E15F0A"]);
 assert.equal(audit.palette.reduce((sum,c)=>sum+c.percent,0),100);
 assert.ok(audit.edgeDensity>0&&audit.hotspot.length===4);
 assert.equal(audit.transparentBackground,false);
});
test("mixed-colour subject is split by original pixels rather than copying one filled bounding area",()=>{
 const width=128,height=128,rgba=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const j=4*(y*width+x),background=x<12||x>=116||y<12||y>=116;
  rgba[j]=background?255:x<64?10:225;
  rgba[j+1]=background?255:x<64?90:95;
  rgba[j+2]=background?255:x<64?210:10;
  rgba[j+3]=255;
 }
 const points=[[6,6],[122,6],[122,122],[6,122]].map(([x,y])=>({
  x:Math.round(1000*x/width),y:Math.round(1000*y/height)}));
 const regions=[["left-blue","#0A5AD2"],["right-orange","#E15F0A"]].map(([id,color],layer)=>({
  id,label:id,kind:"fill",semantic:"other",color,confidence:"high",layer,points}));
 const result=reconstruct(rgba,width,height,{status:"AI_GEOMETRY_PROPOSAL_NOT_STITCHED",regions});
 assert.deepEqual(result.rejected,[]);
 assert.equal(result.regions.length,2);
 assert.deepEqual(result.regions.map(r=>r.pixelArea),[5408,5408]);
 assert.ok(result.regions.every(r=>r.geometrySource==="ai_polygon_intersected_with_colour_matched_artwork_pixels"));
 const [left,right]=result.regions;
 assert.ok(Math.max(...left.points.map(p=>p[0]))<=64);
 assert.ok(Math.min(...right.points.map(p=>p[0]))>=64);
 assert.ok(result.regions.every(r=>r.colourEvidence===.5));
});
test("local analysis rejects empty/unseparable artwork rather than inventing a colour plan",()=>{
 const pixels=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++)pixels[4*i+3]=255;
 assert.throws(()=>analyseArtwork(pixels,w,h),/too little distinguishable foreground/);
});

test('pixel audit catches an entirely omitted subject without any rejected AI proposals',()=>{
 const partial=plan();partial.regions=partial.regions.slice(0,1);
 const out=reconstruct(source(),w,h,partial);
 assert.equal(out.rejected.length,0);
 assert.ok(out.quality.coverage<.55);
 assert.ok(out.quality.blockers.includes('uncovered_source_artwork'));
 assert.equal(out.quality.machineEligible,false);
});
test('pixel audit catches missing interior colour despite a complete silhouette',()=>{
 const image=source();
 for(let y=65;y<75;y++)for(let x=60;x<70;x++){let j=(y*w+x)*4;image[j]=230;image[j+1]=40;image[j+2]=20;}
 const out=reconstruct(image,w,h,plan());
 assert.ok(out.quality.coverage>.95);
 assert.ok(out.quality.blockers.includes('unrepresented_source_colours'));
});
test('small source holes never become false fill',()=>{
 const image=source();const j=(70*w+64)*4;image[j]=image[j+1]=image[j+2]=0;
 const out=reconstruct(image,w,h,plan());
 assert.ok(out.rejected.some(r=>r.reason==='fill_holes_not_supported'));
});
test('perimeter inspection detects a complex border missed by six-point sampling',()=>{
 const image=source();for(let x=12;x<48;x++){image[4*x]=220;image[4*x+1]=120;}
 assert.throws(()=>reconstruct(image,w,h,plan()),/Background is complex/);
});
test('duplicate semantic ids cannot bypass region ownership',()=>{
 const p=plan();p.regions[1].id=p.regions[0].id;
 assert.throws(()=>reconstruct(source(),w,h,p),/Duplicate region id/);
});
test('audited contours retain pixels without large background bridges',()=>{
 const out=reconstruct(source(),w,h,plan());
 assert.ok(out.quality.coverage>.97);
 assert.ok(out.quality.falseFillPixels<out.quality.foregroundPixels*.005);
 assert.equal(out.quality.machineEligible,true);
});
test('low-confidence geometry remains editable but cannot trigger automatic machine export',()=>{
 const p=plan();p.regions[0].confidence='low';
 const out=reconstruct(source(),w,h,p);
 assert.equal(out.regions.length,2);
 assert.ok(out.quality.blockers.includes('low_confidence_regions'));
});


test("tiny high-contrast feather-like stroke triggers missing-detail block below broad palette threshold",()=>{
 const image=source();
 for(let x=48;x<65;x++)for(let y=62;y<64;y++){
  const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=15;
 }
 const result=reconstruct(image,w,h,plan());
 assert.equal(result.quality.missingColourGroups,0);
 assert.ok(result.quality.unrepresentedFineDetails>=1);
 assert.ok(result.quality.unrepresentedFineDetailPixels>=12);
 assert.ok(result.quality.blockers.includes("unrepresented_fine_details"));
 assert.equal(result.quality.machineEligible,false);
});
test("missing small eye prevents export rather than disappearing into the wing",()=>{
 const image=source();
 for(let y=65;y<70;y++)for(let x=59;x<64;x++){
  const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=12;
 }
 const output=reconstruct(image,w,h,plan());
 assert.ok(output.quality.unrepresentedFineDetails>=1);
 assert.ok(output.quality.blockers.includes("unrepresented_fine_details"));
});
test("the same small eye is recovered when the single AI plan includes its marking",()=>{
 const image=source();
 for(let y=65;y<70;y++)for(let x=59;x<64;x++){
  const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=12;
 }
 const detail={id:"eye",label:"Tiny eye",kind:"fill",semantic:"wing_marking",
   color:"#0C0C0C",layer:1,confidence:"high",
   points:[[55,61],[68,61],[68,74],[55,74]].map(([x,y])=>({
     x:Math.round(x*1000/w),y:Math.round(y*1000/h)}))};
 const p=plan();p.regions.push(detail);
 const output=reconstruct(image,w,h,p);
 const eye=output.regions.find(r=>r.id==="eye");
 assert.ok(eye,"small source-backed feature must not be deleted by 35 px contour filter");
 assert.equal(eye.pixelArea,25);
 assert.deepEqual(output.rejected,[]);
 assert.equal(output.quality.unrepresentedFineDetails,0);
 assert.equal(output.quality.machineEligible,true);
});
test("one unsupported dark pixel is below the coherent feature threshold",()=>{
 const image=source(),j=(70*w+64)*4;
 image[j]=image[j+1]=image[j+2]=10;
 const output=reconstruct(image,w,h,plan());
 assert.equal(output.quality.unrepresentedFineDetails,0);
});
test("low contrast feather texture does not trigger the high contrast sentinel",()=>{
 const image=source();
 for(let x=48;x<65;x++)for(let y=62;y<64;y++){
  const j=(y*w+x)*4;image[j]=image[j+1]=image[j+2]=158;
 }
 const output=reconstruct(image,w,h,plan());
 assert.equal(output.quality.unrepresentedFineDetails,0);
});


test('automatically recovers omitted eye from source colour, but blocks machine export',()=>{
 const img=source();
 for(let y=65;y<70;y++)for(let x=59;x<64;x++){const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=12;}
 const out=reconstruct(img,w,h,plan());
 const part=out.regions.find(r=>r.geometrySource==='local_contrast_island_unverified_stitch_type');
 assert.ok(part);assert.equal(part.pixelArea,25);assert.equal(part.color,'#0C0C0C');
 assert.equal(part.parentId,'left');assert.equal(part.confidence,'low');
 assert.equal(part.requiresDigitisingReview,true);assert.equal(out.quality.autoRecoveredDetails,1);
 assert.equal(out.quality.remainingUnrepresentedFineDetails,0);
 assert.ok(out.quality.blockers.includes('unverified_auto_recovered_details'));
 assert.equal(out.quality.machineEligible,false);
});
test('automatically recovers 2-pixel feather stripe as editable geometry',()=>{
 const img=source();
 for(let y=62;y<64;y++)for(let x=48;x<65;x++){const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=15;}
 const out=reconstruct(img,w,h,plan());
 const p=out.regions.find(r=>r.geometrySource==='local_contrast_island_unverified_stitch_type');
 assert.ok(p);assert.equal(p.pixelArea,34);assert.equal(p.color,'#0F0F0F');
 assert.equal(out.quality.machineEligible,false);
});
test('does not duplicate an eye that was in the one-call AI geometry plan',()=>{
 const img=source();
 for(let y=65;y<70;y++)for(let x=59;x<64;x++){const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=12;}
 const p=plan();p.regions.push({id:'eye',label:'eye',kind:'fill',semantic:'wing_marking',
 color:'#0C0C0C',layer:1,confidence:'high',points:[[55,61],[68,61],[68,74],[55,74]]
 .map(([x,y])=>({x:Math.round(x*1000/w),y:Math.round(y*1000/h)}))});
 const out=reconstruct(img,w,h,p);
 assert.equal(out.quality.autoRecoveredDetails,0);
 assert.equal(out.regions.filter(r=>r.id==='eye').length,1);
});
test('does not recover noise, low-contrast shading or absent/black holes',()=>{
 for(const type of ['noise','shade','hole']){
  const img=source();
  if(type==='noise'){const j=(70*w+64)*4;img[j]=img[j+1]=img[j+2]=10;}
  if(type==='shade')for(let y=62;y<64;y++)for(let x=48;x<65;x++){
   const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=158;}
  if(type==='hole')for(let y=64;y<72;y++)for(let x=59;x<67;x++){
   const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=0;}
  const out=reconstruct(img,w,h,plan());
  assert.equal(out.quality.autoRecoveredDetails,0);
  if(type==='hole')assert.ok(out.rejected.some(r=>r.reason==='fill_holes_not_supported'));
 }
});
test('unclassified recovery is ordered after source base and keeps IDs unique',()=>{
 const img=source();
 for(let y=63;y<69;y++)for(let x=57;x<63;x++){
  const j=(y*w+x)*4;img[j]=img[j+1]=img[j+2]=18;}
 const out=reconstruct(img,w,h,plan()),r=out.regions.find(r=>r.recoveryStatus);
 assert.ok(r);assert.equal(out.regions.indexOf(r),out.regions.findIndex(t=>t.id==='left')+1);
 assert.equal(new Set(out.regions.map(r=>r.id)).size,out.regions.length);
 assert.equal(out.quality.machineEligible,false);
});
