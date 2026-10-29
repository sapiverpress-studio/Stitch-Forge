// Synthetic resolution/fragmentation acceptance, no model or hosted requests.
const {reconstruct}=require('../site/auto-reconstruct.js');
const results=[];
for(const size of [256,512,768]){
 const data=new Uint8ClampedArray(size*size*4);data.fill(255);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const ellipse=((x-size*.5)/(size*.35))**2+((y-size*.5)/(size*.3))**2<1;
  if(ellipse){const k=(y*size+x)*4;data[k]=30;data[k+1]=110;data[k+2]=190;}
 }
 const plan={status:'AI_GEOMETRY_PROPOSAL_NOT_STITCHED',regions:[{id:'ellipse',label:'ellipse',kind:'fill',semantic:'other',color:'#1E6EBE',layer:0,confidence:'high',points:[{x:100,y:150},{x:900,y:150},{x:900,y:850},{x:100,y:850}]}]};
 const times=[];let result;
 for(let i=0;i<3;i++){const start=performance.now();result=reconstruct(data,size,size,plan);times.push(performance.now()-start);}
 if(!result.quality.machineEligible||result.rejected.length)throw Error('Resolution fixture rejected: '+size);
 results.push({size,times_ms:times,vertices:result.regions[0].points.length,quality:result.quality});
}
console.log(JSON.stringify({runtime:process.version,scope:'Synthetic curves on desktop Node, not physical Android or fabric',results},null,2));
