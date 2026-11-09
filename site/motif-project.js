/* Portable, local motif document. Imported machine bytes are kept as evidence;
 * only a fresh authenticated native result unlocks machine downloads in-app. */
(function (root) {
'use strict';

const SCHEMA='stitch-forge-motif-v1', MAX_IMAGE_BYTES=12000000, MAX_PROJECT_BYTES=28000000;
const encoder=new TextEncoder();

function fromBase64(value,max) {
  if (typeof value!=='string' || !value.length || value.length%4 ||
      value.length>Math.ceil(max/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw Error('The saved project contains invalid encoded data.');
  const bytes=typeof Uint8Array.fromBase64==='function'
    ? Uint8Array.fromBase64(value) : Uint8Array.from(atob(value),letter=>letter.charCodeAt(0));
  if (bytes.length>max) throw Error('A saved project component is too large.');
  return bytes;
}

function toBase64(bytes) {
  if (typeof bytes.toBase64==='function') return bytes.toBase64();
  let binary='';
  for (let i=0;i<bytes.length;i+=32768)
    binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}

function imageBytes(dataURL) {
  if (typeof dataURL!=='string') throw Error('The image is missing.');
  const head=/^data:image\/(png|jpe?g|webp);base64,/.exec(dataURL);
  if (!head) throw Error('Choose a PNG, JPG or WebP image.');
  const format=head[1]==='jpg'?'jpeg':head[1], bytes=fromBase64(dataURL.slice(head[0].length),MAX_IMAGE_BYTES);
  const starts=(at,signature)=>signature.every((n,i)=>bytes[at+i]===n);
  if (format==='png' && !starts(0,[137,80,78,71,13,10,26,10]) ||
      format==='jpeg' && !starts(0,[255,216,255]) ||
      format==='webp' && (!starts(0,[82,73,70,70])||!starts(8,[87,69,66,80])))
    throw Error('The image contents do not match its file type.');
  return {format,bytes};
}

async function create({name,source,artwork,packed,result}) {
  const api=root.StitchForgeArtworkPipeline, geometry=root.StitchForgeSourceRegionProject;
  const original=imageBytes(source.data), illustration=imageBytes(artwork.data);
  const record={
    schema:SCHEMA, name:String(name||'Embroidery motif').slice(0,80),
    coordinateSystem:{unit:'mm',origin:'artwork-top-left',axes:'x-right-y-down'},
    source:{name:String(source.name||'original').slice(0,140),data:source.data,
      sha256:await api.digest(original.bytes)},
    illustration:{data:artwork.data,sha256:await api.digest(illustration.bytes),
      widthMm:packed.sizing.requestedDesignWidthMm,preset:artwork.preset,palette:artwork.palette,
      blackSatin:!!packed.finishPlanSha256},
    editableRegions:JSON.parse(geometry.serialiseDraft(packed.draft)),
    stitchSettings:result.report.stitchPlanning,
    native:{requestId:packed.packet.requestId,archiveBase64:toBase64(result.bytes),
      sha256:await api.digest(result.bytes),physicalSewoutVerified:false}
  };
  const bytes=encoder.encode(JSON.stringify(record));
  if (bytes.length>MAX_PROJECT_BYTES) throw Error('The complete project exceeds the save size limit.');
  return bytes;
}

async function open(file) {
  if (!file.size || file.size>MAX_PROJECT_BYTES) throw Error('The motif project exceeds the file size limit.');
  const data=JSON.parse(await file.text()), api=root.StitchForgeArtworkPipeline;
  const geometry=root.StitchForgeSourceRegionProject;
  if (data?.schema!==SCHEMA || typeof data.name!=='string' || data.name.length>80 ||
      typeof data.source?.name!=='string'||data.source.name.length>140 ||
      data.coordinateSystem?.unit!=='mm'||data.coordinateSystem.origin!=='artwork-top-left'||
      data.coordinateSystem.axes!=='x-right-y-down' ||
      !['body','balanced','detail','clean'].includes(data.illustration?.preset) ||
      !Number.isFinite(data.illustration.widthMm)||data.illustration.widthMm<30||data.illustration.widthMm>200 ||
      !Array.isArray(data.illustration.palette)||data.illustration.palette.length>8 ||
      (data.illustration.blackSatin!==undefined&&typeof data.illustration.blackSatin!=='boolean') ||
      !/^[a-f0-9]{64}$/.test(data.native?.requestId||''))
    throw Error('This is not a supported Stitch Forge motif project.');
  const original=imageBytes(data.source.data), illustration=imageBytes(data.illustration.data);
  const archive=fromBase64(data.native.archiveBase64,3000000);
  if (illustration.format!=='png'|| await api.digest(original.bytes)!==data.source.sha256 ||
      await api.digest(illustration.bytes)!==data.illustration.sha256 ||
      await api.digest(archive)!==data.native.sha256)
    throw Error('A saved image or machine archive failed its integrity check.');
  await api.readArchive(archive);
  const savedDraft=geometry.parseDraft(JSON.stringify(data.editableRegions));
  return {name:data.name,source:data.source,illustration:data.illustration,savedDraft};
}

root.StitchForgeMotifProject=Object.freeze({create,open,imageBytes,MAX_IMAGE_BYTES});
})(typeof window==='undefined'?globalThis:window);
