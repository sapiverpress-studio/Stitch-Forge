"""Actual old/new 12-colour comparisons from licensed PNGs; no model call."""
import argparse,base64,hashlib,json,subprocess,tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/artwork-evaluation'

def uri(file,mime='image/png'):
    return 'data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()

def build(output,version):
    output.mkdir(parents=True,exist_ok=True)
    samples=json.loads((FIXTURES/'manifest.json').read_text())['samples'];reports=[];cards=[]
    for sample in samples:
        file=FIXTURES/sample['raster_file'];image=Image.open(file).convert('RGBA');folder=output/sample['id']
        with tempfile.NamedTemporaryFile() as raw:
            raw.write(image.tobytes());raw.flush()
            run=subprocess.run(['node',str(ROOT/'tools/evaluate_region_graph.cjs'),raw.name,str(image.width),str(image.height),str(folder),version],cwd=ROOT,check=True,capture_output=True,text=True)
        report=json.loads(run.stdout);report['sample']=sample['id'];reports.append(report)
        for stem in ['before','adaptive','after']:
            subprocess.run(['inkscape',str(folder/(stem+'.svg')),'--export-width='+str(image.width),'--export-height='+str(image.height),'--export-filename='+str(folder/(stem+'.png'))],check=True,capture_output=True,text=True)
        panels=[('Original raster',file),('Previous common-colour approximation',folder/'before.png'),('New working-colour approximation',folder/'after.png')]
        if version=='MD-2.46':
            panels=[('Original raster',file),('MD-2.45 working colours',folder/'adaptive.png'),('MD-2.46 simplified boundaries',folder/'after.png')]
        mask=(folder/'changed-boundaries.mask').read_bytes();overlay=Image.new('RGBA',image.size)
        overlay.putdata([(220,20,55,240) if x else (0,0,0,0) for x in mask]);overlay.save(folder/'changed-boundaries.png');(folder/'changed-boundaries.mask').unlink()
        figures=''.join('<figure><figcaption>'+title+'</figcaption><img alt="'+title+'" src="'+uri(img)+'"></figure>' for title,img in panels)
        simplification=report.get('simplification',{});candidate=report.get('physicalCandidates',{})
        cards.append(f'''<article><h2>{sample['title']}</h2><div class="panels">{figures}</div>
<p>Still at most 12 working colours. Selected pixels with RGB distance &gt;60 from the working palette: <b>{report['before']['pixelsBeyondRgb60']:,} before → {report['after']['pixelsBeyondRgb60']:,} after.</b> This is a colour measurement, not a likeness score or thread match.</p>
<p>Mean RGB distance: {report['before']['meanRgbDistance']:.2f} → {report['after']['meanRgbDistance']:.2f}. Shading simplification can trade lower average fidelity for retaining a contrasting marking.</p>
<p>All {sum(n['pixelArea'] for n in json.loads((folder/'source-graph-project.json').read_text())['graph']['nodes']):,} selected pixels remain in {report['referenceNodes']:,} stable reference pieces. {report['smallContrastingCandidates']} small contrasting candidates; {report['protectedColourMismatch']} colour checks and {report['collapsedProtectedEdges']} contrast checks still need review. No eye/feather identity is claimed from those counts.</p>
<p>{report['workingComponents']:,} working pieces remain. Save/reload, physical resizing and mask/ring accounting verified. Source labels, stitch planning, machine files and human/physical quality remain unverified for this artwork.</p>
<p><b>Boundary grouping:</b> {report['beforeGrouping']['workingComponents']:,} → {report['workingComponents']:,} working pieces. {simplification.get('pixelsReassigned',0):,} pixels change working colour in {simplification.get('nodesReassigned',0):,} tiny blend candidates, at most one analysis pixel ({simplification.get('maxBoundaryShiftMm',0):.3f} mm at this size). All reference nodes and selected foreground pixels remain; zero protected core pixels are reassigned.</p>
<p>RGB-distance &gt;60 checks before grouping → after: {report['beforeGrouping']['quantisation']['pixelsBeyondRgb60']:,} → {report['after']['pixelsBeyondRgb60']:,}. Grouping can worsen pixel colour fidelity while simplifying fine antialiased edges. It is a working approximation for visual review, not proof that those marks were noise.</p>
<p><b>Unverified physical candidates:</b> {candidate.get('fill_candidate',0)} possible fills; {candidate.get('narrow_detail_review',0)} narrow details; {candidate.get('small_detail_review',0)} small details; {candidate.get('tiny_blend_review',0)} tiny blends for review. No candidate is omitted, and no density, underlay or machine instructions are generated.</p>
<p class="credit">{sample['author']} · CC0 · <a href="{sample['source_page']}">source/licence</a>. Existing illustration raster used as input; no source vector outlines supplied.</p></article>''')
    (output/'acceptance-report.json').write_text(json.dumps(reports,indent=2)+'\n')
    private_tool=''
    if version in ['MD-2.46','MD-2.47']:
        names=['auto-reconstruct.js','source-mask-ledger.js','source-topology.js','source-region-graph.js','source-region-project.js','source-stitch-candidates.js']
        sources={name:(ROOT/'site'/name).read_text() for name in names}
        (output/'embedded-module-sha256.json').write_text(json.dumps({name:hashlib.sha256(code.encode()).hexdigest() for name,code in sources.items()},indent=2)+'\n')
        private_tool='''<article id="privateInspector"><h2>Try your own artwork privately</h2><p>The same app modules run locally in this file. No image upload, AI credits or hosted worker. The result is a working colour/shape approximation and unverified size-based candidates, with no PES/DST generation.</p>
<label for="tryArtwork">Original PNG, JPEG or WebP</label><input type="file" id="tryArtwork" accept="image/png,image/jpeg,image/webp">
<label for="tryWidth">Full source image width (mm)</label><input type="number" id="tryWidth" min="10" max="250" value="80">
<label><input type="checkbox" id="trySimplify" checked> Simplify tiny possible boundary blends</label>
<div><button id="tryInspect">Inspect locally</button><button id="trySave" disabled>Save private source project</button><button id="trySvg" disabled>Download geometry SVG</button><button id="tryCandidates" disabled>Download unverified stitch candidates</button></div>
<p id="tryStatus" role="status">Choose an original image. It stays on this device. Source analysis is limited to 768 pixels on the longer side.</p><div id="tryResult" class="privatePair"></div></article>'''
        private_tool+=''.join('<script data-module="'+name+'">\n'+code.replace('</script','<\\/script')+'\n</script>' for name,code in sources.items())
        private_tool+='''<script>
(()=>{'use strict';const q=s=>document.querySelector(s),api=window.StitchForgeSourceRegionProject;let draft=null,busy=false,generation=0,previewUrl=null;
function invalidate(){generation++;draft=null;for(const id of ['trySave','trySvg','tryCandidates'])q('#'+id).disabled=true;q('#tryResult').replaceChildren();q('#tryStatus').textContent='Source or settings changed. Inspect locally to rebuild.';}
for(const id of ['tryArtwork','tryWidth','trySimplify'])q('#'+id).onchange=invalidate;
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
q('#tryInspect').onclick=async()=>{if(busy)return;const file=q('#tryArtwork').files[0];if(!file){q('#tryStatus').textContent='Choose an original image first.';return;}busy=true;q('#tryInspect').disabled=true;const current=++generation,url=URL.createObjectURL(file);let keep=false;
try{const image=new Image();await new Promise((yes,no)=>{image.onload=yes;image.onerror=()=>no(Error('Cannot read image'));image.src=url;});if(image.naturalWidth*image.naturalHeight>45000000)throw Error('Image exceeds 45 megapixels');
const scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
const next=await api.createInspectionDraft(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{imageWidthMm:Number(q('#tryWidth').value),originalWidth:image.naturalWidth,originalHeight:image.naturalHeight,simplifyBoundaryBlends:q('#trySimplify').checked});
if(current!==generation)throw Error('Source/settings changed during analysis; stale result discarded');
const original=new Image(),working=new Image();original.alt='Original private image';original.src=url;working.alt='Actual automatic working approximation, not stitches';working.src='data:image/svg+xml;base64,'+btoa(api.geometrySvg(next));q('#tryResult').replaceChildren(original,working);
if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=url;keep=true;draft=next;for(const id of ['trySave','trySvg'])q('#'+id).disabled=false;q('#tryCandidates').disabled=!next.graph;
q('#tryStatus').textContent=next.summary.colorGroups+' working colours; '+next.summary.componentCount+' working pieces. '+next.quantisation.pixelsBeyondRgb60+' pixels differ strongly from the palette. '+(next.graph?.simplification?.pixelsReassigned||0)+' pixels have simplified working boundaries. '+(next.approximation?'Preview fallback: fine reference graph unavailable; small details and stitch planning unverified.':'Original references retained; no verified stitch plan or machine files.');
}catch(e){q('#tryStatus').textContent='Inspection refused: '+e.message;}finally{if(!keep)URL.revokeObjectURL(url);busy=false;q('#tryInspect').disabled=false;}};
q('#trySave').onclick=()=>{if(draft)download(api.serialiseDraft(draft),'stitch-forge-source-regions-PRIVATE.json','application/json');};
q('#trySvg').onclick=()=>{if(draft)download(api.geometrySvg(draft),'stitch-forge-geometry-NOT-DIGITISED.svg','image/svg+xml');};
q('#tryCandidates').onclick=async()=>{if(!draft)return;const current=draft,start=generation;q('#tryCandidates').disabled=true;try{const result=await window.StitchForgeSourceStitchCandidates.buildCandidates(current);if(start!==generation||draft!==current)throw Error('Source/size changed; stale candidates discarded');download(JSON.stringify(result,null,2),'stitch-forge-candidates-UNVERIFIED-PRIVATE.json','application/json');q('#tryStatus').textContent=result.summary.fill_candidate+' possible fills, '+result.summary.narrow_detail_review+' narrow details and '+result.summary.tiny_blend_review+' tiny blends for review. Nothing omitted. No stitches, density or underlay generated.';}catch(e){q('#tryStatus').textContent=e.message;}finally{q('#tryCandidates').disabled=!draft;}};
})();
</script>'''
    text='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge '''+version+''' · working likeness</title>
<style>body{margin:0;background:#edf4f2;color:#183940;font:17px/1.55 system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:20px}h1{font-size:1.55rem}h2{font-size:1.25rem}article{background:white;border:1px solid #9bbcb5;border-radius:14px;margin:20px 0;padding:20px}.panels{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.privatePair{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0;min-width:0}figcaption{font-weight:650;min-height:3.5em}img{display:block;width:100%;height:auto;background:white}button,input{font:inherit;max-width:100%;padding:10px;margin:5px 0}button{border:1px solid #227681;border-radius:10px;background:#e9f5f3;color:#163b42}label{display:block}.notice{border-left:5px solid #a33e2f;padding:14px;background:#fff4ea}.credit{font-size:.85rem}a{color:#126475}@media(max-width:650px){main{padding:12px}article{padding:14px}.panels,.privatePair{grid-template-columns:1fr}figcaption{min-height:0;margin:8px 0}}</style>
<main><h1>'''+version+''' · a practical working likeness</h1><p class="notice">Target: recognisable shapes, convincing colours, important markings and clean boundaries; fine shading may be simplified. These panels show actual automatic raster-derived colour approximations. They are <b>not AI semantic reconstruction, stitch simulations or PES/DST evidence</b>. A 12-colour limit remains; every selected source pixel is retained separately for review.</p>
'''+''.join(cards)+private_tool+'''<p>Source references survive even when working colours simplify shading. Small boundary blends are hypotheses, not confirmed noise. Review unresolved markings before any later stitch plan. No deployment, paid AI request or hosted worker was used.</p></main></html>'''
    (output/'Working_Likeness_OFFLINE.html').write_text(text)
    print(json.dumps(reports,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--version',default='MD-2.45');a=p.parse_args();build(a.output,a.version)
