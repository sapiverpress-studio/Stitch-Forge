"""Build actual source-region evidence from CC0 PNG inputs; never source SVGs.

Uses installed Pillow, native Node and Inkscape. No AI, hosted worker or network.
The standalone inspector embeds the same JS modules used by the app.
"""
import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests/fixtures/artwork-evaluation'


def data_uri(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((FIXTURES / 'manifest.json').read_text())
    reports, cards = [], []
    for sample in manifest['samples']:
        source = FIXTURES / sample['raster_file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == sample['raster_sha256']
        image = Image.open(source).convert('RGBA')
        folder = output / sample['id']
        with tempfile.NamedTemporaryFile() as raw:
            raw.write(image.tobytes()); raw.flush()
            run = subprocess.run(['node', str(ROOT / 'tools/evaluate_source_regions.cjs'), raw.name,
                                  str(image.width), str(image.height), str(folder)],
                                 cwd=ROOT, check=True, capture_output=True, text=True)
        report = json.loads(run.stdout)
        report['sample'] = sample['id']
        report['licence'] = sample['licence']
        report['expected_features'] = sample['expected_visible_features']
        report['feature_semantics_verified'] = False
        report['actual_stitch_types'] = []
        reports.append(report)
        # Render the actual generated geometry SVG, without a display alpha clip.
        subprocess.run(['inkscape', str(folder / 'automatic-source-geometry.svg'),
                        '--export-filename=' + str(folder / 'automatic-source-geometry.png'),
                        '--export-width=' + str(image.width), '--export-height=' + str(image.height)],
                       check=True, capture_output=True, text=True)
        uncertainty = (folder / 'uncertainty.mask').read_bytes()
        overlay = Image.new('RGBA', image.size)
        overlay.putdata([(220, 25, 65, 230) if x else (0, 0, 0, 0) for x in uncertainty])
        overlay.save(folder / 'palette-uncertainty.png')
        (folder / 'uncertainty.mask').unlink()
        image.save(folder / 'source.png')
        pct = report['quantisation']['pixelsBeyondRgb60'] / report['selectedPixels'] * 100
        cards.append(f'''<article><h2>{html.escape(sample['title'])}</h2>
<div class="pair"><figure><figcaption>Original raster · {image.width} × {image.height}</figcaption><img src="{data_uri(source, 'image/png')}" alt="Original {html.escape(sample['id'])}"></figure>
<figure><figcaption>Automatic source-region geometry · no AI</figcaption><div class="stack"><img src="{data_uri(folder / 'automatic-source-geometry.png', 'image/png')}" alt="Actual automatic source geometry"><img class="uncertain" hidden src="{data_uri(folder / 'palette-uncertainty.png', 'image/png')}" alt="Pixels with palette difference above RGB distance 60"></div></figure></div>
<p>{report['colorGroups']} colour groups · {report['componentCount']:,} pieces · {report['holeCount']} holes · {report['smallComponents']:,} small pieces retained for review.</p>
<p><b>All {report['selectedPixels']:,} selected pixels round-trip exactly through contours.</b> This measures storage and geometry, not semantic accuracy. {report['excludedVisiblePixels']:,} partly visible source pixels are excluded by the foreground threshold ({report['excludedOpaquePixels']} fully opaque).</p>
<p>Palette uncertainty: {report['quantisation']['pixelsBeyondRgb60']:,} pixels ({pct:.2f}%) differ by RGB distance &gt;60. Exact original shades, eyes, veins and feather identities are <b>unverified</b>.</p>
<p>Save → reload and width edit: verified without geometry loss. Stitch planning, AI interpretation, PES/DST and physical quality: <b>not verified</b>.</p>
<p class="credit">{html.escape(sample['author'])} · CC0 · <a href="{html.escape(sample['source_page'])}">source and licence</a>. Existing vector-origin illustration tested as a PNG; original vector paths were not input.</p></article>''')
    (output / 'acceptance-report.json').write_text(json.dumps(reports, indent=2) + '\n')
    modules = ['auto-reconstruct.js', 'source-mask-ledger.js', 'source-topology.js', 'source-region-project.js']
    sources = {name: (ROOT / 'site' / name).read_text() for name in modules}
    hashes = {name: hashlib.sha256(source.encode()).hexdigest() for name, source in sources.items()}
    (output / 'embedded-module-sha256.json').write_text(json.dumps(hashes, indent=2) + '\n')
    scripts = '\n'.join('<script data-module="' + name + '">\n' + sources[name].replace('</script', '<\\/script') + '\n</script>' for name in modules)
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge MD-2.43 · actual source regions</title>
<style>[hidden]{display:none!important}body{margin:0;background:#eef4f3;color:#163b42;font:17px/1.55 system-ui,sans-serif}main{max-width:1100px;padding:20px;margin:auto}h1{font-size:1.65rem}h2{font-size:1.3rem}article,section{background:white;border:1px solid #9abcb6;border-radius:14px;padding:20px;margin:20px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0;min-width:0}figcaption{font-weight:650;margin-bottom:10px}img{display:block;width:100%;height:auto;background:#fff}.stack{position:relative}.stack .uncertain{position:absolute;inset:0;background:transparent}.credit{font-size:.85rem}button,input{font:inherit;max-width:100%;padding:10px;margin:5px 0}button{border:1px solid #227681;border-radius:10px;background:#e9f5f3;color:#163b42}label{display:block}.notice{border-left:5px solid #b64635;padding:10px;background:#fff3eb}.result{white-space:pre-wrap}#localResult img{max-height:560px;object-fit:contain}a{color:#126475}@media(max-width:650px){main{padding:12px}article,section{padding:14px}.pair{grid-template-columns:1fr}h1{font-size:1.35rem}}</style>
<main><h1>MD-2.43 · source regions with preserved topology</h1>
<p class="notice"><b>Geometry evidence only.</b> This page shows actual automatic raster colour partitions. No AI reconstruction, proposed stitches, Ink/Stitch output or PES/DST was produced for these illustrations. The many retained fragments still require semantic grouping and stitch planning.</p>
<label><input type="checkbox" id="uncertainty"> Show measured palette uncertainty in red</label>
''' + '\n'.join(cards) + '''
<section><h2>Inspect your own artwork privately</h2><p>The same source-region code runs entirely on this device, with analysis reduced to at most 768 pixels on the longer side. No image is sent anywhere. A saved source project contains private artwork geometry.</p>
<label for="artwork">Choose original PNG, JPEG or WebP</label><input type="file" id="artwork" accept="image/png,image/jpeg,image/webp">
<label for="width">Full source image width (mm)</label><input type="number" id="width" value="80" min="10" max="250">
<button id="inspect">Inspect locally</button><button id="save" disabled>Save private source-region project</button><button id="svg" disabled>Download geometry SVG</button>
<p id="localStatus" role="status">No private image selected. No AI credits are used.</p><div id="localResult"></div></section>
<p>Current blockers: unverified semantic colour boundaries, small/touching regions, quantised colour identity, absent stitch planning and absent realistic-art machine/physical acceptance. An exact mask is not a professional embroidery result.</p></main>
''' + scripts + '''
<script>
const q=s=>document.querySelector(s),api=window.StitchForgeSourceRegionProject;let draft=null,busy=false;
q('#uncertainty').onchange=()=>document.querySelectorAll('.uncertain').forEach(x=>x.hidden=!q('#uncertainty').checked);
function save(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
q('#inspect').onclick=async()=>{if(busy)return;const file=q('#artwork').files[0];if(!file){q('#localStatus').textContent='Choose an original image first.';return;}busy=true;q('#inspect').disabled=true;const imageUrl=URL.createObjectURL(file);try{
 const image=new Image();await new Promise((yes,no)=>{image.onload=yes;image.onerror=no;image.src=imageUrl;});if(image.naturalWidth*image.naturalHeight>45000000)throw Error('Image exceeds 45 megapixels');
 const scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const next=await api.createDraft(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{imageWidthMm:Number(q('#width').value),originalWidth:image.naturalWidth,originalHeight:image.naturalHeight});
 const svg=api.geometrySvg(next),img=new Image();img.alt='Actual local automatic colour geometry, not stitches';img.src='data:image/svg+xml;base64,'+btoa(svg);q('#localResult').replaceChildren(img);draft=next;q('#save').disabled=false;q('#svg').disabled=false;
 q('#localStatus').textContent=next.summary.colorGroups+' colour groups, '+next.summary.componentCount+' pieces, '+next.summary.holeCount+' holes. '+next.summary.smallComponents+' small pieces retained for review. '+next.quantisation.pixelsBeyondRgb60+' pixels beyond RGB distance 60. Semantic reconstruction and stitch planning remain unverified.';
 }catch(error){q('#localStatus').textContent='Inspection refused: '+(error.message||'Image could not be read')+'. Previous draft unchanged.';}finally{URL.revokeObjectURL(imageUrl);busy=false;q('#inspect').disabled=false;}};
q('#save').onclick=()=>{if(draft)save(api.serialiseDraft(draft),'stitch-forge-source-regions-PRIVATE.json','application/json');};
q('#svg').onclick=()=>{if(draft)save(api.geometrySvg(draft),'stitch-forge-source-geometry-NOT-DIGITISED.svg','image/svg+xml');};
</script></html>'''
    (output / 'Source_Regions_OFFLINE.html').write_text(document)
    print(json.dumps({'output': str(output), 'samples': reports}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/test-evidence/MD-2.43-source-region-drafts')
    build(parser.parse_args().output)
