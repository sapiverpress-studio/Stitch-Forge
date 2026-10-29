#!/usr/bin/env python3
"""Build a self-contained local artwork-scan inspector from the tracked scanner."""
from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'site/auto-reconstruct.js'

PAGE = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Offline inspection of Stitch Forge's local artwork pixel scan.">
<title>Stitch Forge — local artwork scan inspection</title>
<style>
:root{font:16px/1.45 system-ui,sans-serif;color:#17242a;background:#f2f5f6}*{box-sizing:border-box}body{margin:0 auto;max-width:1100px;padding:1rem}h1{font-size:1.55rem}h2{font-size:1.15rem;margin-top:0}.notice{padding:.8rem 1rem;background:#fff0c2;border:1px solid #d1a832;border-radius:.5rem}.privacy{color:#40525b}.controls{display:flex;gap:.8rem;align-items:center;flex-wrap:wrap;margin:1rem 0}.controls input,button{font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}.panel{background:#fff;border:1px solid #cbd4d9;border-radius:.65rem;padding:1rem;min-width:0}.preview{width:100%;height:auto;max-height:60vh;object-fit:contain;background:#edf0f1}.metrics{display:grid;grid-template-columns:1fr auto;gap:.3rem .75rem}.metrics dt{color:#40525b}.metrics dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:.5rem}.swatch{border:1px solid #aab5ba;border-radius:.4rem;padding:.35rem;font-size:.82rem}.chip{height:1.4rem;border:1px solid #777;border-radius:.2rem;margin-bottom:.2rem}.empty{border:1px dashed #9eaaaf;border-radius:.45rem;padding:1rem;color:#40525b}.small{font-size:.88rem;color:#40525b}button{padding:.55rem .8rem;border-radius:.4rem;border:1px solid #34545e;background:#e8f1f3}button:disabled{opacity:.55}pre{white-space:pre-wrap;overflow-wrap:anywhere}
</style>
</head>
<body>
<h1>Stitch Forge: local artwork scan</h1>
<p class="notice"><strong>Evidence boundary:</strong> this page runs the existing deterministic pixel scan only. It does not reconstruct semantic regions, choose stitch types, create stitch guides, call an AI service, generate PES/DST, or prove embroidery quality.</p>
<p class="privacy">Choose an image from this device. Processing stays in this browser tab; the page contains no network requests. A large image is proportionally reduced only for this scan.</p>
<div class="controls"><label for="imageFile"><strong>Artwork image</strong></label><input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp"><button id="saveReport" disabled>Save local scan report</button><span id="status" role="status">Choose an image to inspect.</span></div>
<main class="grid">
 <section class="panel"><h2>Original artwork</h2><img id="source" class="preview" alt="Selected source artwork; no image loaded"></section>
 <section class="panel"><h2>What the local scan measured</h2><dl id="metrics" class="metrics"><dt>Status</dt><dd>Not run</dd></dl><h3>Coarse colour histogram</h3><div id="palette" class="palette"><p class="small">No scan yet.</p></div><p class="small">These are frequent RGB bins, not detected design regions or thread assignments.</p></section>
 <section class="panel"><h2>Automatic reconstruction</h2><div class="empty"><strong>No regions were produced by this scan.</strong><p>This is expected: the local scanner reports foreground, palette and edge statistics. A separate geometry reconstruction stage is required.</p></div></section>
 <section class="panel"><h2>Stitch plan and machine files</h2><div class="empty"><strong>No stitch plan or machine file exists for this inspection.</strong><p>There are no proposed stitch directions, Ink/Stitch stitches, or decoded PES/DST panels to show.</p></div></section>
</main>
<canvas id="work" hidden></canvas>
<!-- BEGIN_TRACKED_AUTO_RECONSTRUCT_SOURCE -->
<script>
__TRACKED_MODULE__
</script>
<!-- END_TRACKED_AUTO_RECONSTRUCT_SOURCE -->
<script>
(() => {
 const input=document.getElementById('imageFile'),image=document.getElementById('source'),canvas=document.getElementById('work'),status=document.getElementById('status'),metrics=document.getElementById('metrics'),palette=document.getElementById('palette'),save=document.getElementById('saveReport');
 let lastReport=null,objectUrl=null;
 function showMetrics(report){
  const pairs=[['Scan status',report.source],['Scan input',`${report.width} × ${report.height} px`],['Foreground pixels',report.foregroundPixels.toLocaleString()],['Foreground share',`${(100*report.foregroundPixels/(report.width*report.height)).toFixed(1)}%`],['Quantized colour bins',report.distinctColourBins],['Edge density',report.edgeDensity],['Detail flag',report.detailLevel],['Transparent background detected',report.transparentBackground?'yes':'no'],['Semantic regions produced','0'],['Stitch plan / PES / DST','none']];
  metrics.replaceChildren();for(const [label,value] of pairs){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);metrics.append(dt,dd);}
  palette.replaceChildren();for(const item of report.palette){const box=document.createElement('div'),chip=document.createElement('div'),text=document.createElement('div');box.className='swatch';chip.className='chip';chip.style.backgroundColor=item.color;text.textContent=`${item.color} · ${item.percent}%`;box.append(chip,text);palette.append(box);}
 }
 input.addEventListener('change',()=>{
  const file=input.files&&input.files[0];if(!file)return;
  lastReport=null;save.disabled=true;metrics.replaceChildren();palette.replaceChildren();
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000){status.textContent='Choose a PNG, JPEG or WebP image under 20 MB.';return;}
  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);image.alt='Selected original artwork: '+file.name;status.textContent='Reading image locally…';
  image.onload=()=>{
   try{
    if(image.naturalWidth*image.naturalHeight>16000000)throw Error('Image exceeds the 16-megapixel local decode limit');
    const factor=Math.min(1,Math.sqrt(700000/(image.naturalWidth*image.naturalHeight))),w=Math.floor(image.naturalWidth*factor),h=Math.floor(image.naturalHeight*factor);if(w<48||h<48||w*h>750000)throw Error('Image dimensions exceed local scan limits after proportional resize');
    canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h).data;
    lastReport=window.StitchForgeAutoReconstruct.analyseArtwork(pixels,w,h);
    lastReport.originalDimensions=[image.naturalWidth,image.naturalHeight];lastReport.scaleForPixelScan=[w,h];lastReport.reconstruction='NOT_RUN';lastReport.stitchPlan='NONE';lastReport.machineFiles='NONE';
    showMetrics(lastReport);save.disabled=false;status.textContent='Local pixel scan complete; no region geometry was reconstructed.';
   }catch(error){lastReport=null;status.textContent='Scan refused: '+String(error&&error.message||error);}
  };
  image.onerror=()=>{lastReport=null;status.textContent='Could not read this image in the browser.';};
  image.src=objectUrl;
 });
 save.addEventListener('click',()=>{if(!lastReport)return;const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='stitch-forge-local-pixel-scan.json';a.click();URL.revokeObjectURL(url);});
})();
</script>
</body></html>
'''


def build() -> str:
    source = SOURCE.read_text(encoding='utf-8').rstrip()
    if '</script' in source.lower():
        raise ValueError('Tracked module cannot safely be inlined into script tag')
    page = PAGE.replace('__TRACKED_MODULE__', source)
    digest = sha256(source.encode()).hexdigest()
    return page.replace('<body>', f'<body data-auto-reconstruct-sha256="{digest}">', 1)


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build(), encoding='utf-8')
    print(f'Wrote self-contained local pixel-scan inspector: {args.output}')


if __name__ == '__main__':
    main()
