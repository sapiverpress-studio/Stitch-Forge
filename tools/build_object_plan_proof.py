"""Offline source/object comparisons using actual application modules and CC0 PNGs."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import cairosvg

ROOT = Path(__file__).resolve().parents[1]


def uri(data, mime='image/png'):
    return 'data:' + mime + ';base64,' + base64.b64encode(data).decode()


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    modules = ['fill-geometry.js', 'auto-reconstruct.js', 'source-mask-ledger.js', 'source-topology.js',
               'source-region-graph.js', 'source-region-project.js', 'source-object-plan.js']
    hashes = {name: hashlib.sha256((ROOT/'site'/name).read_bytes()).hexdigest() for name in modules}
    scripts = ''.join('<script>'+ (ROOT/'site'/name).read_text().replace('</script', '<\\/script')+'</script>' for name in modules)
    reports, cards = [], []
    samples = json.loads((ROOT/'tests/fixtures/artwork-evaluation/manifest.json').read_text())['samples']
    for sample in samples:
        name = sample['id']
        source = ROOT/'docs/test-evidence/MD-2.47-textured-preview'/name/'source-graph-project.json'
        folder = output/name
        folder.mkdir(exist_ok=True)
        code = '''const fs=require('fs'),P=require('./site/source-region-project.js'),A=require('./site/source-object-plan.js');
(async()=>{const d=P.parseDraft(fs.readFileSync(process.argv[1],'utf8')),p=await A.build(d);fs.writeFileSync(process.argv[2]+'/prepared.svg',A.geometrySvg(p));fs.writeFileSync(process.argv[2]+'/object-plan.json',JSON.stringify(p));console.log(JSON.stringify(p.summary));})().catch(e=>{console.error(e.stack);process.exitCode=1;});'''
        run = subprocess.run(['node', '-e', code, str(source), str(folder)], cwd=ROOT, capture_output=True, text=True, check=True)
        report = {'sample': name, **json.loads(run.stdout), 'machineEligible': False, 'humanLikenessVerified': False}
        reports.append(report)
        cairosvg.svg2png(url=str(folder/'prepared.svg'), write_to=str(folder/'prepared.png'), output_width=768)
        before = source.parent/'after.png'
        original = ROOT/'tests/fixtures/artwork-evaluation'/sample['raster_file']
        panels = ''.join('<figure><figcaption>'+label+'</figcaption><img alt="'+label+'" src="'+uri(path.read_bytes())+'"></figure>'
                         for label, path in [('Original PNG', original), ('MD-2.47 working colours', before), ('Prepared artwork — not stitches', folder/'prepared.png')])
        cards.append('<article><h2>'+sample['title']+'</h2><div class="panels">'+panels+'</div><p>'+f"{report['sourceParts']:,} → {report['workingParts']:,} pieces. {report['recolouredPixels']:,} selected pixels change working colour; {report['protectedParts']:,} contrasting candidates retained. {report['omittedPixels']} pixels omitted. This remains too fragmented for a complete approved stitch plan."+'</p></article>')
    private_tool = '''<article><h2>Prepare your original artwork privately</h2><p>Nothing is uploaded. The original reference remains separate. This creates colour geometry, not embroidery files.</p>
<label>Original PNG, JPEG or WebP <input id="file" type="file" accept="image/png,image/jpeg,image/webp"></label>
<label>Full image width (mm) <input id="width" type="number" min="10" max="250" value="80"></label>
<button id="prepare">Prepare artwork locally</button> <button id="save" disabled>Save prepared artwork · not stitches</button>
<p id="status" role="status">Choose the original image.</p><div id="result" class="panels"></div></article>'''
    client = '''<script>
(()=>{'use strict';const q=s=>document.querySelector(s);let plan=null,busy=false,generation=0,urls=[];
function clear(){generation++;plan=null;q('#save').disabled=true;q('#result').replaceChildren();for(const u of urls)URL.revokeObjectURL(u);urls=[];}
q('#file').onchange=clear;q('#width').onchange=clear;
q('#prepare').onclick=async()=>{if(busy)return;const file=q('#file').files[0];if(!file)return;busy=true;const token=++generation;q('#prepare').disabled=true;q('#save').disabled=true;q('#status').textContent='Reading pixels and preparing shapes locally…';
const url=URL.createObjectURL(file);urls.push(url);
try{const im=new Image();await new Promise((yes,no)=>{im.onload=yes;im.onerror=no;im.src=url;});if(im.naturalWidth*im.naturalHeight>45000000)throw Error('Image exceeds 45 megapixels');
const scale=Math.min(1,768/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(im.naturalWidth*scale);canvas.height=Math.round(im.naturalHeight*scale);
const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,canvas.width,canvas.height);
const P=window.StitchForgeSourceRegionProject,A=window.StitchForgeSourceObjectPlan,d=await P.createInspectionDraft(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{imageWidthMm:Number(q('#width').value),originalWidth:im.naturalWidth,originalHeight:im.naturalHeight}),p=await A.build(d);
if(token!==generation)throw Error('Artwork or size changed; stale result discarded');
const sources=[url,'data:image/svg+xml;base64,'+btoa(P.geometrySvg(d)),'data:image/svg+xml;base64,'+btoa(A.geometrySvg(p))];q('#result').replaceChildren(...sources.map((src,i)=>{const f=document.createElement('figure'),c=document.createElement('figcaption'),img=new Image();c.textContent=['Original','Working colours','Prepared artwork — not stitches'][i];img.alt=c.textContent;img.src=src;f.append(c,img);return f;}));
plan=p;q('#save').disabled=false;const s=p.summary;q('#status').textContent=s.sourceParts+' → '+s.workingParts+' pieces. '+s.recolouredPixels+' pixels recoloured; '+s.protectedParts+' contrasting candidates retained. No selected pixels omitted. '+(d.approximation?'Fine source graph unavailable. ':'')+'Semantic details and all stitch planning remain unverified.';
}catch(e){q('#status').textContent='Preparation refused: '+e.message;}finally{busy=false;q('#prepare').disabled=false;}};
q('#save').onclick=()=>{if(!plan)return;const text=JSON.stringify(plan);if(new TextEncoder().encode(text).length>8000000){q('#status').textContent='Prepared artwork exceeds the 8MB download budget.';return;}const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='prepared-artwork-NOT-DIGITISED-PRIVATE.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};})();
</script>'''
    html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge MD-2.48 · prepared artwork</title>
<style>body{font:17px/1.5 system-ui;background:#edf4f2;color:#183940;margin:0}main{max-width:1200px;margin:auto;padding:18px}article{background:white;padding:18px;border:1px solid #a0bdb6;border-radius:12px;margin:20px 0}.panels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}figure{margin:0;min-width:0}figcaption{font-weight:650}img{width:100%;height:auto}label{display:block}button,input{font:inherit;max-width:100%;padding:10px;margin:8px 0}button{border:1px solid #146e7b;border-radius:8px}.notice{border-left:5px solid #ac5631;padding:12px;background:#fff3e8}@media(max-width:650px){.panels{grid-template-columns:1fr}main,article{padding:12px}}</style>
<main><h1>MD-2.48 · source-bound artwork preparation</h1><p class="notice">Actual computed colour geometry. No AI semantics, stitch simulation or PES/DST is shown here. Small shading fragments may join adjacent stable cores; the source silhouette and selected transparent holes remain accounted for. Contrasting candidates are numerical hypotheses, not verified eyes or feathers.</p>'''+private_tool+''.join(cards)+'''<p>Public examples: CC0 vector-origin illustrations tested only as PNGs. The algorithm receives no source vectors. Physical sewing, thread colour and owner likeness acceptance are unverified.</p></main>'''+scripts+client+'</html>'
    (output/'Prepared_Artwork_OFFLINE.html').write_text(html)
    (output/'acceptance-report.json').write_text(json.dumps(reports, indent=2)+'\n')
    (output/'embedded-module-sha256.json').write_text(json.dumps(hashes, indent=2)+'\n')
    print(json.dumps(reports, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    build(parser.parse_args().output)
