/* The private worker supplies the audited base plan. This adds one source-bound
 * final thread pass and verifies the rewritten formats before release. */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {EmbConstant,readDst,readPes,writeDst,writePes} from '@guillaumemmm/tsembroidery';
import {zipSync} from 'fflate';
import {readNativeArchive} from './native-archive.mjs';
import source from '../../../site/auto-reconstruct.js';
import satin from '../../../site/detailed-satin.js';

const {STITCH,JUMP,TRIM,COLOR_CHANGE,END}=EmbConstant;
const {FINISH,COLOUR}=satin;
const EDGE_TOLERANCE_MM=.82;
const text=new TextDecoder(),encode=new TextEncoder();
const sha=(...items)=>{const hash=createHash('sha256');for(const item of items)hash.update(item);return hash.digest('hex');};
const readJson=(files,name)=>JSON.parse(text.decode(files[name]));
const json=value=>encode.encode(JSON.stringify(value));
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const position=(point,origin)=>point.slice(0,2).map((n,i)=>Number((n/10+origin[i]).toFixed(6)));
const units=(point,origin)=>point.map((n,i)=>Math.round((n-origin[i])*10));

function decode(pattern,origin,frame){
 const stitches=pattern.stitches,needles=[],segments=[],counts={stitches:0,jumps:0,trims:0,changes:0};
 const density=new Map();
 let previous=null,maxMove=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 if(stitches.length>125000||stitches.at(-1)?.[2]!==END)throw Error('Incomplete satin machine file.');
 for(const entry of stitches){
  const [x,y,command]=entry,point=position(entry,origin);
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw Error('Invalid machine coordinates.');
  if(command===STITCH){
   if(point.some((n,i)=>n<0||n>frame[i]))throw Error('Satin file exceeds the design frame.');
   counts.stitches++;
   needles.push([...point,counts.changes]);
   const [a,b]=point,key=Math.floor(a)+','+Math.floor(b);
   density.set(key,1+(density.get(key)||0));
   minX=Math.min(minX,a);maxX=Math.max(maxX,a);minY=Math.min(minY,b);maxY=Math.max(maxY,b);
   if(previous&&length(previous,point)>0){
    maxMove=Math.max(maxMove,length(previous,point));
    segments.push([...previous,...point,counts.changes]);
   }
  }else if(command===JUMP)counts.jumps++;
  else if(command===TRIM)counts.trims++;
  else if(command===COLOR_CHANGE)counts.changes++;
  else if(command!==END)throw Error('Unexpected command in the satin export.');
  previous=point;
 }
 let peak=0;
 for(const value of density.values())peak=Math.max(peak,value);
 if(peak>120||maxMove>3.650001||!needles.length)throw Error('Satin file failed the stitch length or density limit.');
 return {needles,segments,counts,bounds:[maxX-minX,maxY-minY].map(n=>Number(n.toFixed(1))),peak,maxMove};
}

function orderColumns(columns,start){
 const remaining=columns.slice(),ordered=[];
 for(let cursor=start;remaining.length;){
  let best=Infinity,index=-1,entry=0;
  for(const [i,column] of remaining.entries()){
   const n=column.left.length-1;
   const offsets=column.closed?Array.from({length:n},(_,j)=>j):[0,n];
   for(const j of offsets){
    const d=length(midpoint(column.left[j],column.right[j]),cursor);
    if(d<best){best=d;index=i;entry=j;}
   }
  }
  const [column]=remaining.splice(index,1);
  const orient=rail=>{
   if(!column.closed)return entry?rail.slice().reverse():rail;
   const rotated=rail.slice(entry,-1).concat(rail.slice(0,entry));
   return [...rotated,rotated[0]];
  };
  const left=orient(column.left),right=orient(column.right);
  ordered.push({left,right,closed:column.closed});
  cursor=midpoint(left[0],right[0]);
 }
 return ordered;
}

function sewColumn({left,right}){
 const centres=left.map((p,i)=>midpoint(p,right[i])),underlay=[centres[0]];
 // Keep the centre walk close to the rails at corners.
 for(let i=1,last=0;i<centres.length;i++){
  const a=centres[last],b=centres[i];
  const bend=centres.slice(last+1,i).some(p=>
   Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))>length(a,b)*.13);
  if(bend||length(a,b)>=1.16||i===centres.length-1){underlay.push(b);last=i;}
 }
 const top=left.map((p,i)=>i%2?right[i]:p).reverse();
 const lock=(a,b)=>a.map((v,i)=>v+(b[i]-v)*.24/Math.max(.24,length(a,b)));
 return [underlay[0],lock(underlay[0],underlay[1]),...underlay,
  ...top,lock(top.at(-1),top.at(-2)),top.at(-1)];
}

function append(pattern,runs,origin,changeColour){
 pattern.stitches.pop();
 const [x,y]=pattern.stitches.at(-1);
 pattern.addStitchAbsolute(TRIM,x,y);
 if(changeColour){
  pattern.addStitchAbsolute(COLOR_CHANGE,x,y);
  pattern.addThread({hex:COLOUR,description:'Black satin finish'});
 }
 const expected=[];
 for(const run of runs){
  const points=run.map(p=>units(p,origin)).filter((p,i,a)=>!i||length(p,a[i-1])>0);
  const [a,b]=pattern.stitches.at(-1),[c,d]=points[0];
  const jumps=Math.max(1,Math.ceil(Math.max(Math.abs(c-a),Math.abs(d-b))/120));
  for(let i=1;i<=jumps;i++)pattern.addStitchAbsolute(JUMP,Math.round(a+(c-a)*i/jumps),Math.round(b+(d-b)*i/jumps));
  for(const [x,y] of points){
   pattern.addStitchAbsolute(STITCH,x,y);
   expected.push(position([x,y],origin));
  }
  pattern.trim();
 }
 pattern.end();
 return expected;
}

function verifySatin(segments,rgba,{source:{width:w,height:h},imageWidthMm}){
 const mask=source.sourceForegroundMask(new Uint8ClampedArray(rgba),w,h);
 const scale=imageWidthMm/w,reach=EDGE_TOLERANCE_MM,radius=Math.ceil(reach/scale);
 function nearSubject(x,y){
  const a=Math.floor((x-2)/scale),b=Math.floor((y-2)/scale);
  if(a>=0&&a<w&&b>=0&&b<h&&mask[b*w+a])return true;
  for(let row=Math.max(0,b-radius);row<Math.min(h,b+radius+1);row++)
   for(let col=Math.max(0,a-radius);col<Math.min(w,a+radius+1);col++)
    if(mask[row*w+col]&&Math.hypot(2+(col+.5)*scale-x,2+(row+.5)*scale-y)<=reach)return true;
  return false;
 }
 for(const [x,y,a,b] of segments){
  const span=Math.hypot(a-x,b-y),steps=Math.max(1,Math.ceil(span/.18));
  if(span>1.8)throw Error('A black satin stitch crosses too far between its rails.');
  for(let k=0;k<=steps;k++)if(!nearSubject(x+(a-x)*k/steps,y+(b-y)*k/steps))
   throw Error('A black satin stitch would leave the approved silhouette.');
 }
}

function retainsBaseCommands(before,after){
 // PEC writers can flag a trim on an initial repositioning move before any
 // needle drop. All travel and thread commands after sewing starts must match.
 const leading=commands=>{
  const first=commands.findIndex(item=>item[2]===STITCH);
  return {first,moves:commands.slice(0,first).filter(item=>item[2]!==TRIM)};
 };
 const original=leading(before),finished=leading(after);
 return equal(original.moves,finished.moves)&&
  equal(before.slice(original.first),after.slice(finished.first,finished.first+before.length-original.first));
}

function satinSvg(base,columns,pitch){
 const svg=text.decode(base),end=svg.lastIndexOf('</svg>');
 if(end<0||!svg.includes('xmlns:inkstitch="http://inkstitch.org/namespace"'))
  throw Error('The editable base SVG is incomplete.');
 const paths=[];
 for(const {left,right} of columns){
  // Split long/closed rails into editable open native satin columns.
  for(let start=0;start<left.length-1;){
   const end=Math.min(start+350,left.length-1);
   const lines=[left.slice(start,end+1),right.slice(start,end+1)];
   for(let i=start+4;i<end-2;i+=10){
    const a=left[i],b=right[i],width=length(a,b);
    const normal=b.map((v,j)=>(v-a[j])*.13/width);
    lines.push([a.map((v,j)=>v-normal[j]),b.map((v,j)=>v+normal[j])]);
   }
   const d=lines.map(line=>'M '+line.map(p=>p.map(n=>n.toFixed(4)).join(',')).join(' L ')).join(' ');
   paths.push('<path id="detailed-black-satin-'+(paths.length+1)+'" d="'+d+'" fill="none" stroke="'+COLOUR+'" stroke-width=".17"'+
    ' inkstitch:satin_column="true" inkstitch:satin_method="satin_column" inkstitch:center_walk_underlay="true"'+
    ' inkstitch:zigzag_spacing_mm="'+pitch+'" inkstitch:max_stitch_length_mm="2.5"/>');
   start=end;
  }
 }
 return encode.encode(svg.slice(0,end)+paths.join('')+svg.slice(end));
}

export async function addDetailedSatin(payload,packet,receipt){
 const files=readNativeArchive(new Uint8Array(payload));
 const report=readJson(files,'machine-report.json'),preview=readJson(files,'decoded-preview.json');
 const baseSvg=files['native-artwork-input.svg'];
 const header=JSON.parse(packet.header),{width,height,sha256:sourceSha}=header.source;
 if(!['stitch-forge-artwork-request-v1','stitch-forge-artwork-request-v2'].includes(header.schema)||
    !Number.isInteger(width)||!Number.isInteger(height)||width*height>750000||Math.min(width,height)<48||
    receipt.requestId!==packet.requestId||report.requestId!==packet.requestId||preview.requestId!==packet.requestId||
    report.source?.sha256!==sourceSha||report.sourceBinding?.foregroundIndependentlyVerified!==true||
    report.machineEligible!==false||report.physicalQualityVerified!==false||
    report.workflow!=='TWO_NATIVE_PHASES_NO_AI'||!Array.isArray(report.decoded)||report.decoded.length!==2||
    !Array.isArray(preview.palette)||preview.palette.length<1||preview.palette.length>12||
    !baseSvg||sha(baseSvg)!==receipt.svgSha256||report.nativeInputSha256!==receipt.svgSha256||
    sha(files['artwork-trial.pes'])!==receipt.pesSha256)
  throw Error('The base motif did not pass the approved native checks for satin.');
 const rgba=gunzipSync(Buffer.from(packet.rgbaGzip,'base64'),{maxOutputLength:4*width*height});
 const dimensions=Buffer.alloc(8);dimensions.writeUInt32BE(width,0);dimensions.writeUInt32BE(height,4);
 if(rgba.length!==4*width*height||sha(dimensions,rgba)!==sourceSha)
  throw Error('Satin planning image does not match the approved source.');
 const plan=satin.plan(rgba,width,height,header.imageWidthMm);
 const frame=[preview.widthMm,preview.heightMm];
 if(!frame.every(Number.isFinite)||Math.abs(frame[0]-header.imageWidthMm-4)>1e-6||
    Math.abs(frame[1]-header.imageWidthMm*height/width-4)>1e-6)
  throw Error('Native satin frame does not match the approved source.');
 const basePalette=preview.palette,changeColour=basePalette.at(-1)!==COLOUR;
 const palette=changeColour?[...basePalette,COLOUR]:basePalette;
 const formats={pes:{read:readPes,write:writePes},dst:{read:readDst,write:writeDst}};
 const dstOrigin=report.decoded.find(item=>item.format==='dst')?.translationToSourceMm;
 if(!Array.isArray(dstOrigin)||dstOrigin.length!==2||!dstOrigin.every(Number.isFinite))
  throw Error('The native base origin is missing.');
 let runs,columns,baseNeedles,finalNeedles,finalSegments,finishStitches;
 const decoded=[];
 for(const [format,{read,write}] of Object.entries(formats)){
  const name='artwork-trial.'+format,base=report.decoded.find(item=>item.format===format);
  const original=base?.translationToSourceMm;
  if(!base||!Array.isArray(original)||original.length!==2||!original.every(Number.isFinite)||
     base.needlePointsOutsideWorkingColour!==0||base.needleSegmentsOutsideWorkingColour!==0||
     !equal(base.requestedColourOrder,basePalette)||sha(files[name])!==base.sha256)
   throw Error('The signed base file failed source containment for satin.');
  // PES and DST origins differ by an integer number of needle units. Use a
  // common fraction so floating point noise cannot move points across a tie.
  const origin=original.map((n,i)=>{
   const delta=(n-dstOrigin[i])*10;
   if(Math.abs(delta-Math.round(delta))>1e-6)throw Error('Native coordinate origins disagree.');
   return (Math.round(dstOrigin[i]*1e6)+100000*Math.round(delta))/1e6;
  });
  const pattern=read(files[name]),before=decode(pattern,origin,frame);
  if(before.counts.stitches!==base.needleStitches||before.counts.changes!==basePalette.length-1||
     (baseNeedles&&!equal(before.needles,baseNeedles)))
   throw Error('The base PES and DST disagree before finishing.');
  if(!runs){
   baseNeedles=before.needles;
   columns=orderColumns(plan.columns,baseNeedles.at(-1));
   runs=columns.map(sewColumn);
  }
  const baseCommands=pattern.stitches.slice(0,-1);
  const expected=append(pattern,runs,origin,changeColour);
  const bytes=write(pattern,{encode:false});
  const reread=read(bytes),actual=decode(reread,origin,frame);
  const oldStitches=before.needles.length;
  if(!retainsBaseCommands(baseCommands,reread.stitches))
   throw Error('The '+format.toUpperCase()+' satin rewrite changed the original machine commands.');
  if(actual.counts.changes!==palette.length-1||actual.needles.length!==oldStitches+expected.length||
     !equal(actual.needles.slice(0,oldStitches),before.needles)||
     !equal(actual.segments.slice(0,before.segments.length),before.segments)||
     !equal(actual.needles.slice(oldStitches),expected.map(p=>[...p,palette.length-1]))||
     (format==='pes'&&!equal(reread.threadlist.map(thread=>thread.hexColor().toUpperCase()),palette))||
     (finalNeedles&&(!equal(finalNeedles,actual.needles)||!equal(finalSegments,actual.segments))))
   throw Error('Finished files disagree with the audited base or the planned black satin.');
  if(!finalSegments)verifySatin(actual.segments.slice(before.segments.length),rgba,header);
  finalNeedles=actual.needles;finalSegments=actual.segments;finishStitches=expected.length;
  decoded.push({...base,translationToSourceMm:origin,sha256:sha(bytes),
   needleStitches:actual.counts.stitches,colourChanges:actual.counts.changes,
   jumps:actual.counts.jumps,trims:actual.counts.trims,boundsMm:actual.bounds,
   maxNeedleMoveMm:actual.maxMove,maxNeedlesInOneMmSquare:actual.peak,requestedColourOrder:palette});
  files[name]=bytes;
 }
 files['native-artwork-input.svg']=satinSvg(baseSvg,columns,plan.pitchMm);
 const finish={type:FINISH,colour:COLOUR,planSha256:sha(json(plan)),needleStitches:finishStitches,
  columnCount:columns.length,edgeToleranceMm:EDGE_TOLERANCE_MM,
  basePesSha256:receipt.pesSha256,baseSvgSha256:receipt.svgSha256};
 files['decoded-preview.json']=json({...preview,palette,segments:finalSegments});
 files['machine-report.json']=json({...report,decoded,satinFinish:finish,
  workflow:'TWO_NATIVE_PHASES_WITH_SATIN_FINISH',nativeInputSha256:sha(files['native-artwork-input.svg']),
  structuralAudit:decoded.map(item=>({name:'artwork-trial.'+item.format,format:item.format,stops:0,
   needle_stitches:item.needleStitches,jumps:item.jumps,changes:item.colourChanges,
   bounds_mm:item.boundsMm,trims:item.trims,max_needle_move_mm:item.maxNeedleMoveMm,
   thread_colors:item.format==='pes'?palette:[]})),
  stitchPlanning:{...report.stitchPlanning,finish:{type:FINISH,colour:COLOUR,
   spacingMm:plan.pitchMm,centerWalkUnderlay:true,outlineColumns:1}},
  limitations:[...(report.limitations||[]),'Working-colour containment covers the retained base stitches. The added black satin pass has a separate silhouette tolerance. Physical sew-out remains pending.']});
 files['READ_ME_NOT_APPROVED.txt']=encode.encode(
  'Stitch Forge digitally audited trial. A physical sew-out remains pending.\n'+
  'Ink/Stitch generated the original colour blocks. Stitch Forge appended the final black satin pass.\n'+
  'PES and DST were decoded and checked after finishing. For DST, use the thread order in the machine report.\n');
 const archive=zipSync(files,{level:5});
 if(archive.length>3000000)throw Error('The finished trial archive exceeds the download limit.');
 return archive;
}
