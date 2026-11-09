/* Source-derived illustration. No model, network call, or stitch generation. */
(function (root) {
'use strict';

const PRESETS = {
  balanced: { colours: 6, smooth: 1, contrast: 1 },
  detail: { colours: 7, smooth: .76, contrast: .78 },
  clean: { colours: 5, smooth: 1.28, contrast: 1.25 }
};
const NORMALS = [[1,0], [0,1], [1,1], [1,-1]];
const BACKGROUND = 255;
const MAX_PARTS = 110;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hex = colour => '#' + colour.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
const light = (r, g, b) => .30*r + .59*g + .11*b;

function neighbours(index, w, n, visit) {
  const x = index % w;
  if (x) visit(index - 1);
  if (x + 1 < w) visit(index + 1);
  if (index >= w) visit(index - w);
  if (index + w < n) visit(index + w);
}

function components(labels, w, diagonal = false) {
  const owners = new Uint32Array(labels.length);
  const queue = new Int32Array(labels.length), parts = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] === BACKGROUND || owners[start]) continue;
    const id = parts.length + 1, colour = labels[start];
    let count = 1, minX = w, maxX = 0, minY = labels.length/w, maxY = 0;
    queue[0] = start;
    owners[start] = id;
    function add(index) {
      if (!owners[index] && labels[index] === colour) {
        owners[index] = id;
        queue[count++] = index;
      }
    }
    for (let i = 0; i < count; i++) {
      const index = queue[i], x = index % w, y = (index-x)/w;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      neighbours(index, w, labels.length, add);
      if (diagonal) {
        if (x && y) add(index-w-1);
        if (x+1<w && y) add(index-w+1);
        if (x && index+w<labels.length) add(index+w-1);
        if (x+1<w && index+w<labels.length) add(index+w+1);
      }
    }
    parts.push({ id, colour, minX, maxX, minY, maxY, pixels: queue.slice(0, count) });
  }
  return { owners, parts };
}

function isolate(rgba, w, h) {
  const labels = new Uint8Array(w*h).fill(BACKGROUND);
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h-1)*w+x);
  for (let y = 1; y < h-1; y++) border.push(y*w, y*w+w-1);
  const transparent = border.filter(i => rgba[i*4+3] < 35).length;
  let background;
  if (transparent >= .92*border.length) {
    background = 'alpha';
    for (let i = 0; i < labels.length; i++) if (rgba[i*4+3] >= 94) labels[i] = 0;
  } else {
    if (border.some(i => rgba[i*4+3] < 245)) throw Error('The subject touches an uncertain background. Leave a clear margin or use a transparent PNG.');
    const centre = [0,1,2].map(c => border.reduce((sum, i) => sum + rgba[i*4+c], 0)/border.length);
    const delta = i => Math.hypot(rgba[i*4]-centre[0],rgba[i*4+1]-centre[1],rgba[i*4+2]-centre[2]);
    const variation = Math.max(...border.map(delta));
    if (variation > 40) throw Error('The background is too varied to separate confidently. Use a single subject on transparency or a plain contrasting background.');
    background = 'plain_border';
    labels.fill(0);
    const queue = new Int32Array(w*h), threshold = clamp(variation+9, 19, 49);
    let count = 0;
    function add(i) {
      if (!labels[i] && delta(i) <= threshold) {
        labels[i] = BACKGROUND;
        queue[count++] = i;
      }
    }
    border.forEach(add);
    for (let i = 0; i < count; i++) neighbours(queue[i], w, labels.length, add);
  }

  const { parts } = components(labels, w);
  parts.sort((a,b) => b.pixels.length-a.pixels.length);
  const main = parts[0];
  if (!main || main.pixels.length < w*h*.035)
    throw Error('A clear foreground subject could not be found. Use a larger subject on a contrasting background.');
  if (parts[1]?.pixels.length > main.pixels.length*.18)
    throw Error('Several substantial disconnected shapes were found. Detailed Motif works on one connected subject.');
  if (background === 'plain_border' && border.some(i => labels[i] === 0))
    throw Error('The subject reaches the edge of the background. Use an uncropped image with a clear border.');
  const keep = new Uint8Array(w*h);
  for (const i of main.pixels) keep[i] = 1;
  // Retain nearby substantial islands (for example a detached marking), not isolated specks.
  const halo = Math.round(Math.max(w,h)*.022);
  for (const part of parts.slice(1)) {
    if (part.pixels.length < Math.max(14, main.pixels.length*.0012)) continue;
    const near = part.pixels.some(i => {
      const x = i%w, y = (i-x)/w;
      for (const [dx,dy] of [[halo,0],[-halo,0],[0,halo],[0,-halo],[halo,halo],[-halo,halo],[halo,-halo],[-halo,-halo]]) {
        const a=x+dx,b=y+dy;
        if (a>=0 && a<w && b>=0 && b<h && keep[b*w+a]) return true;
      }
      return false;
    });
    if (near) for (const i of part.pixels) keep[i] = 1;
  }
  return { mask: keep, main, background, discarded: parts.reduce((s,p)=>s+p.pixels.length,0)-keep.reduce((s,x)=>s+x,0) };
}

function sampleChannels(rgba, mask, w, radius) {
  const h = mask.length/w;
  const channels = Array.from({length:3}, () => new Float32Array(mask.length));
  // Box integral: a small uniform average to remove sub-pixel texture before edge-aware filtering.
  const stride=w+1, integral = Array.from({length:4}, () => new Float64Array(stride*(h+1)));
  for (let y=1; y<=h; y++) {
    const sums=[0,0,0,0];
    for (let x=1; x<=w; x++) {
      const i=(y-1)*w+x-1,j=y*stride+x;
      if (mask[i]) {
        for (let c=0;c<3;c++) sums[c]+=rgba[i*4+c];
        sums[3]++;
      }
      for (let c=0;c<4;c++) integral[c][j]=integral[c][j-stride]+sums[c];
    }
  }
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const i=y*w+x;
    if (!mask[i]) continue;
    const a=Math.max(0,x-radius), b=Math.min(w,x+radius+1);
    const top=Math.max(0,y-radius)*stride, bottom=Math.min(h,y+radius+1)*stride;
    const sum = p => p[bottom+b]-p[top+b]-p[bottom+a]+p[top+a];
    const count=sum(integral[3]);
    for (let c=0;c<3;c++) channels[c][i]=sum(integral[c])/count;
  }
  return channels;
}

function smoothMasses(rgba, mask, w, pxMm, strength) {
  const h = mask.length/w;
  const source = sampleChannels(rgba,mask,w,Math.max(1,Math.round(pxMm*.22)));
  const stride = Math.max(1,Math.round(pxMm*.37*strength));
  const offsets = [[0,0,4]];
  for (const [x,y] of NORMALS) for (const sign of [-1,1]) {
    offsets.push([x*sign*stride,y*sign*stride,3]);
    offsets.push([x*sign*stride*2,y*sign*stride*2,2]);
    offsets.push([x*sign*stride*4,y*sign*stride*4,1]);
  }
  let current=source;
  for (let pass=0; pass<3; pass++) {
    const output = source.map(() => new Float32Array(mask.length));
    for (let i=0; i<mask.length; i++) {
      if (!mask[i]) continue;
      const x=i%w,y=(i-x)/w;
      let r=0,g=0,b=0,total=0;
      for (const [dx,dy,space] of offsets) {
        const a=x+dx,v=y+dy,j=v*w+a;
        if (a<0||a>=w||v<0||v>=h||!mask[j]) continue;
        const dr=source[0][j]-source[0][i],dg=source[1][j]-source[1][i],db=source[2][j]-source[2][i];
        const diff=(dr*dr+dg*dg+db*db)/2700;
        const weight=space/((1+diff)*(1+diff));
        r+=current[0][j]*weight; g+=current[1][j]*weight; b+=current[2][j]*weight; total+=weight;
      }
      output[0][i]=r/total;output[1][i]=g/total;output[2][i]=b/total;
    }
    current=output;
  }
  return current;
}

function colourDistance(r,g,b, colour) {
  const dr=r-colour[0],dg=g-colour[1],db=b-colour[2];
  return light(dr,dg,db)**2 + .85*(dr-dg)**2 + .62*(db-dg)**2;
}

function paletteOf(channels, mask, limit) {
  const bins = new Map();
  for (let i=0;i<mask.length;i+=2) {
    if (!mask[i]) continue;
    const r=channels[0][i],g=channels[1][i],b=channels[2][i];
    const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
    const bin=bins.get(key)||[0,0,0,0];
    bin[0]+=r; bin[1]+=g; bin[2]+=b; bin[3]++;
    bins.set(key,bin);
  }
  const samples=[...bins.values()].map(([r,g,b,n])=>[r/n,g/n,b/n,n]).sort((a,b)=>b[3]-a[3]);
  if (!samples.length) throw Error('No stable thread colours could be estimated.');
  let palette=[samples[0].slice(0,3)];
  while (palette.length<Math.min(samples.length,limit)) {
    let seed=null,score=0;
    for (const [r,g,b,n] of samples) {
      const distance=Math.min(...palette.map(c=>colourDistance(r,g,b,c)));
      const merit=distance*Math.sqrt(n);
      if (merit>score) { score=merit;seed=[r,g,b]; }
    }
    if (!seed||score<70) break;
    palette.push(seed);
  }
  for (let pass=0;pass<12;pass++) {
    const sums=palette.map(()=>[0,0,0,0]);
    for (const [r,g,b,n] of samples) {
      const slot=sums[nearest(r,g,b,palette)];
      slot[0]+=n*r;slot[1]+=n*g;slot[2]+=n*b;slot[3]+=n;
    }
    palette=palette.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(x=>x/sums[i][3]):c);
  }
  return palette.map(c=>c.map(Math.round));
}

function nearest(r,g,b,palette) {
  let best=0,least=Infinity;
  for (let j=0;j<palette.length;j++) {
    const distance=colourDistance(r,g,b,palette[j]);
    if (distance<least) { least=distance;best=j; }
  }
  return best;
}

function regularise(labels, w, radius) {
  for (let pass=0;pass<2;pass++) {
    const before=labels.slice(), counts=new Uint16Array(8);
    const h=labels.length/w;
    for (let i=0;i<labels.length;i++) {
      if (before[i]===BACKGROUND) continue;
      const x=i%w,y=(i-x)/w;
      counts.fill(0);
      for (let dy=-radius;dy<=radius;dy++) for (let dx=-radius;dx<=radius;dx++) {
        if (x+dx<0||x+dx>=w||y+dy<0||y+dy>=h) continue;
        const colour=before[i+dy*w+dx];
        if (colour!==BACKGROUND) counts[colour]++;
      }
      let best=before[i];
      for (let j=0;j<counts.length;j++) if (counts[j]>counts[best]+1) best=j;
      labels[i]=best;
    }
  }
}

function mergeFlecks(labels,w,palette,minArea,protectedColour=-1) {
  for (let pass=0;pass<8;pass++) {
    const {parts,owners}=components(labels,w);
    let changed=false;
    for (const part of parts) {
      if (part.colour===protectedColour || part.pixels.length>=minArea) continue;
      const contacts=new Uint32Array(palette.length);
      for (const i of part.pixels) neighbours(i,w,labels.length,j=>{
        const colour=labels[j];
        if (colour===BACKGROUND || colour===part.colour) return;
        const target=parts[owners[j]-1];
        if (target.pixels.length>part.pixels.length || target.id<part.id && target.pixels.length===part.pixels.length)
          contacts[colour]+=colour===protectedColour?1:target.pixels.length>=minArea?12:3;
      });
      const [r,g,b]=palette[part.colour];
      let best=-1,score=0;
      for (let j=0;j<contacts.length;j++) {
        const value=contacts[j]/(25+Math.sqrt(colourDistance(r,g,b,palette[j])));
        if (value>score) {score=value;best=j;}
      }
      if (best<0) continue;
      for (const i of part.pixels) labels[i]=best;
      changed=true;
    }
    if (!changed) break;
  }
}

function retainInk(rgba,mask,w,pxMm,contrast,channels,labels,palette) {
  const h=mask.length/w, luminance=new Float32Array(mask.length);
  for (let i=0;i<mask.length;i++) if (mask[i]) luminance[i]=light(rgba[i*4],rgba[i*4+1],rgba[i*4+2]);
  const response=new Float32Array(mask.length), narrow=new Float32Array(mask.length), ridge=new Uint8Array(mask.length).fill(BACKGROUND);
  const steps=[...new Set([1,Math.max(2,Math.round(pxMm*.48)),Math.max(3,Math.round(pxMm*.9))])];
  for (let i=0;i<mask.length;i++) {
    if (!mask[i]) continue;
    const x=i%w,y=(i-x)/w;
    const own=luminance[i];
    let best=0, fine=0;
    for (const [dx,dy] of NORMALS) for (const step of steps) {
      const a=i+step*(dx+dy*w),b=i-step*(dx+dy*w);
      if (x-step*Math.abs(dx)<0||x+step*Math.abs(dx)>=w||y-step*Math.abs(dy)<0||
          y+step*Math.abs(dy)>=h||!mask[a]||!mask[b]) continue;
      const left=luminance[a]-own,right=luminance[b]-own;
      const value=.76*Math.min(left,right)+.24*Math.max(left,right);
      best=Math.max(best,value);
      if (step<=Math.max(2,Math.round(pxMm*.48))) fine=Math.max(fine,value);
    }
    const backdrop=light(channels[0][i],channels[1][i],channels[2][i]);
    const colour=palette[labels[i]], massLight=light(...colour);
    if (own<168 && own<backdrop-8 && own<massLight-6 && best>12*contrast) {
      ridge[i]=0;
      response[i]=best;narrow[i]=fine;
    }
  }

  const {parts}=components(ridge,w,true);
  const candidates=[];
  for (const part of parts) {
    const span=Math.max(part.maxX-part.minX+1,part.maxY-part.minY+1);
    if (span<pxMm*1.35 || part.pixels.length<Math.max(5,pxMm)) continue;
    let max=0,sum=0,luma=0,fine=0;
    for (const i of part.pixels) { const v=response[i];max=Math.max(max,v);sum+=v;luma+=luminance[i];fine+=narrow[i]; }
    const mean=sum/part.pixels.length;
    const meanLuma=luma/part.pixels.length, meanFine=fine/part.pixels.length;
    if (max<26*contrast || mean<17*contrast || meanLuma>146 ||
        (meanLuma>83 && meanFine<14*contrast) || (meanLuma>105 && (mean<36*contrast || meanFine<35*contrast))) continue;
    candidates.push({...part, score:Math.sqrt(span)*mean, mean});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const selected=candidates.slice(0,16);
  if (!selected.length) return {parts:0,pixels:0};

  const dark=[0,1,2].map(channel=>{
    const values=selected.slice(0,8).flatMap(part=>Array.from(part.pixels,i=>rgba[i*4+channel]));
    values.sort((a,b)=>a-b);
    return values[Math.floor(values.length*.16)];
  });
  const nearestColour=nearest(...dark,palette);
  const ink=colourDistance(...dark,palette[nearestColour])<270 ? nearestColour : palette.push(dark)-1;
  let pixels=0;
  for (const part of selected) {
    for (const i of part.pixels) {
      labels[i]=ink;
      pixels++;
      // A diagonal digital stroke needs 4-connected geometry for the native worker.
      if (i%w+1<w && i+w+1<mask.length && ridge[i+w+1]===0 && mask[i+1] && mask[i+w])
        labels[response[i+1]>response[i+w]?i+1:i+w]=ink;
      if (i%w && i+w-1<mask.length && ridge[i+w-1]===0 && mask[i-1] && mask[i+w])
        labels[response[i-1]>response[i+w]?i-1:i+w]=ink;
    }
  }
  return {parts:selected.length,pixels,colour:ink};
}

function prepare(rgba,w,h,{widthMm=80,preset='balanced'}={}) {
  if (!(rgba instanceof Uint8ClampedArray)||!Number.isInteger(w)||!Number.isInteger(h)||
      w<48||h<48||Math.max(w,h)>640||rgba.length!==4*w*h) throw Error('The artwork analysis size is unsupported.');
  if (!Number.isFinite(widthMm)||widthMm<30||widthMm>200) throw Error('Detailed Motif supports visible widths from 30 to 200 mm.');
  if (!Object.hasOwn(PRESETS,preset)) throw Error('Unknown Detailed Motif preparation setting.');
  const config=PRESETS[preset], subject=isolate(rgba,w,h);
  const {mask,main}=subject;
  const visibleWidth=main.maxX-main.minX+1, visibleHeight=main.maxY-main.minY+1;
  if (visibleWidth<40||visibleHeight<40) throw Error('The subject is too narrow to resolve important details. Crop excess margins or use a higher-resolution source.');
  if (widthMm*visibleHeight/visibleWidth>250) throw Error('The subject is too tall at this width. Reduce the width before preparing.');
  const pxMm=visibleWidth/widthMm;
  const channels=smoothMasses(rgba,mask,w,pxMm,config.smooth);
  const palette=paletteOf(channels,mask,config.colours);
  const labels=new Uint8Array(w*h).fill(BACKGROUND);
  for (let i=0;i<labels.length;i++) if (mask[i]) labels[i]=nearest(channels[0][i],channels[1][i],channels[2][i],palette);
  const radius=clamp(Math.round(pxMm*.49*config.smooth),1,5);
  regularise(labels,w,radius);
  mergeFlecks(labels,w,palette,Math.max(8,pxMm*pxMm*1.55*config.smooth));
  const ink=retainInk(rgba,mask,w,pxMm,config.contrast,channels,labels,palette);
  mergeFlecks(labels,w,palette,Math.max(7,pxMm*pxMm*.72),ink.colour);
  const output=new Uint8ClampedArray(rgba.length), used=new Set();
  for (let i=0;i<labels.length;i++) if (mask[i]) {
    const c=labels[i],at=i*4;
    output.set(palette[c],at);output[at+3]=255;
    used.add(c);
  }
  const regions=components(labels,w).parts;
  if (regions.length>MAX_PARTS)
    throw Error('This image still has '+regions.length+' separate thread shapes. Try the cleaner version or choose a simpler source.');
  const warnings=[];
  if (subject.discarded) warnings.push('Detached fragments were removed. Compare the outer edges and any fine projections.');
  if (!ink.parts) warnings.push('No separate fine dark marks were detected. Check any eyes, markings or other fine details before approval.');
  return { rgba:output,width:w,height:h,palette:[...new Set([...used].map(i=>hex(palette[i])))].sort(),
    quality:{preset,visibleWidthMm:widthMm,background:subject.background,removedFragmentsPixels:subject.discarded,
      regions:regions.length,contrastGroups:ink.parts,contrastPixels:ink.pixels,warnings} };
}

const api=Object.freeze({prepare});
root.StitchForgeDetailedMotif=api;
if (typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window==='undefined'?globalThis:window);
