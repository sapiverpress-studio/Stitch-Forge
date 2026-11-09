/* Synthetic reference motif (not user artwork). The PNG's decoded RGBA is
 * identical to this array; no model, sample downloads or external packages.
 */
function ghost(w=192,h=192){
 const pixels=new Uint8ClampedArray(w*h*4);
 const body=(x,y)=>{
  if(y<24||y>168)return false;
  const head=(x-96)**2+(y-81)**2<=55**2;
  const shirt=y>=81&&x>=41&&x<=151&&y<=154+5*Math.cos((x-41)*Math.PI/19);
  return head||shirt;
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!body(x,y))continue;
  const at=(y*w+x)*4;
  const border=!body(x-3,y)||!body(x+3,y)||!body(x,y-3)||!body(x,y+3);
  const eye=(x-78)**2+(y-84)**2<=7**2||(x-115)**2+(y-84)**2<=7**2;
  const mouth=((x-97)/7)**2+((y-115)/9)**2<=1;
  const dark=border||eye||mouth;
  pixels[at]=pixels[at+1]=pixels[at+2]=dark?19:246;
  pixels[at+3]=255;
 }
 return {pixels,width:w,height:h};
}
function fleckedGhost(){
 const fixture=ghost(),{pixels,width:w,height:h}=fixture;
 let added=0;
 // More than 160 independent pale shade flecks: previously made the
 // automatic native workflow refuse the whole image before stitch creation.
 for(let y=45;y<151;y+=5)for(let x=47;x<148;x+=5){
  const i=(y*w+x)*4;
  if(added>=240||pixels[i]!==246||pixels[i+1]!==246||
     pixels[i+2]!==246||pixels[i+3]!==255)continue;
  if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]]
      .some(([xx,yy])=>pixels[(yy*w+xx)*4]!==246))continue;
  pixels[i]=pixels[i+1]=pixels[i+2]=210;
  added++;
 }
 if(added!==240)throw Error('Synthetic source flecks setup unexpectedly changed');
 return {...fixture,added};
}
module.exports={ghost,fleckedGhost};
