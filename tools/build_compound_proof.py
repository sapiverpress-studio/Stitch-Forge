"""Produce actual source-raster → native compound → decoded PES/DST evidence.

All controls are expressly synthetic, authored in pixels, then passed through
the app's automatic source-region extractor. No ideal boundary is supplied.
Requires a local pinned Ink/Stitch executable; never calls a hosted worker.
"""
import argparse
import base64
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'services/digitiser'))
from compound_acceptance import run_compound_acceptance


def uri(file, mime):
    return 'data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()


def build(engine, output):
    output.mkdir(parents=True, exist_ok=True)
    cases = [('horizontal', 0, False, False, 80), ('diagonal', 37, False, False, 80),
             ('underlay', 0, True, False, 80), ('nested-island', 90, True, True, 64)]
    results, cards = [], []
    for name, angle, underlay, nested, width in cases:
        folder = output/name
        command = ['node', str(ROOT/'tools/extract_compound_control.cjs'), str(folder)]
        if nested:
            command.append('nested')
        project = json.loads(subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True).stdout)
        project['settings'].update(angleDeg=angle, underlay=underlay)
        project['imageWidthMm'] = width
        (folder/'source-extracted-compound-control.json').write_text(json.dumps(project, indent=2)+'\n')
        source = Image.frombytes('RGBA', (160,128), (folder/'source.rgba').read_bytes())
        source.save(folder/'source.png'); (folder/'source.rgba').unlink()
        report = run_compound_acceptance(project, engine, folder)
        report['case'] = name
        results.append(report)
        for stem in ('native-compound-input', 'decoded-pes', 'decoded-dst'):
            subprocess.run(['inkscape', str(folder/(stem+'.svg')), '--export-width=840',
                            '--export-filename='+str(folder/(stem+'.png'))],
                           check=True, capture_output=True, text=True)
        pes = next(r for r in report['decoded'] if r['format']=='pes')
        dst = next(r for r in report['decoded'] if r['format']=='dst')
        panels = [('Original synthetic raster', folder/'source.png'),
                  ('Automatically extracted native geometry', folder/'native-compound-input.png'),
                  ('Actual decoded PES needle movements', folder/'decoded-pes.png'),
                  ('Actual decoded DST needle movements', folder/'decoded-dst.png')]
        images = ''.join('<figure><figcaption>'+title+'</figcaption><img alt="'+title+'" src="'+uri(file,'image/png')+'"></figure>' for title,file in panels)
        cards.append(f'''<article id="{name}"><h2>{name.replace('-', ' ').title()}</h2>
<p>Requested fill angle {angle}° · row spacing 0.6 mm · maximum stitch 3.5 mm · underlay {str(underlay).lower()} · full image width {width} mm.</p>
<div class="panels">{images}</div>
<p><b>{pes['needleStitches']:,} independently decoded needle stitches in each format.</b> PES: {pes['jumps']} jumps, {pes['trims']} trim, {pes['colourChanges']} colour change. DST: {dst['jumps']} jumps, {dst['trims']} trims, {dst['colourChanges']} colour change. Jumps are excluded from the displayed needle paths.</p>
<p>Outside requested source-colour areas: <b>0 needle points and 0 needle segments</b>, with 0.11 mm boundary tolerance. Maximum actual needle move {pes['maxNeedleMoveMm']:.3f} mm. Measured row gap {pes['medianDecodedRowGapMm']:.4f} mm; {pes['longStitchLengthAlignedWithin4DegFraction']*100:.1f}% of long-stitch length follows the requested angle within 4°.</p>
<p>Decoded needle extents {pes['boundsMm'][0]:.1f} × {pes['boundsMm'][1]:.1f} mm; source boundary extents {pes['expectedBoundsMm'][0]:.1f} × {pes['expectedBoundsMm'][1]:.1f} mm. Fill rows can stop before the boundary; no outline stitch was invented. DST uses an explicit source-frame origin; PES is checked against every DST needle after translation, without rescaling.</p>
<p>PES decoded palette: {', '.join(pes['decodedPalette'])}. DST thread identity is unverified. Native geometry has a 2 mm frame margin. These test settings are not fabric presets.</p></article>''')
    horizontal = next(x for x in results if x['case']=='horizontal')['decoded'][0]['needleStitches']
    underlay = next(x for x in results if x['case']=='underlay')['decoded'][0]['needleStitches']
    if underlay <= horizontal:
        raise ValueError('Underlay control did not increase actual stitch count')
    (output/'acceptance-report.json').write_text(json.dumps(results, indent=2)+'\n')
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge MD-2.44 · actual compound fill machine evidence</title>
<style>body{margin:0;background:#edf4f2;color:#183940;font:17px/1.55 system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:20px}h1{font-size:1.6rem}h2{font-size:1.25rem}article{margin:22px 0;padding:20px;border:1px solid #9abcb6;border-radius:14px;background:white}.panels{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}figure{margin:0;min-width:0}figcaption{font-weight:650;min-height:4.5em}img{display:block;width:100%;height:auto;background:white}.notice{border-left:5px solid #a33e2f;background:#fff3e9;padding:15px}nav{display:flex;gap:15px;flex-wrap:wrap}a{color:#126475}@media(max-width:900px){.panels{grid-template-columns:1fr 1fr}}@media(max-width:550px){main{padding:12px}article{padding:14px}.panels{grid-template-columns:1fr}figcaption{min-height:0;margin:10px 0}h1{font-size:1.3rem}}</style>
<main><h1>MD-2.44 · real compound fill machine instructions</h1>
<p class="notice"><b>Synthetic control evidence, not detailed-artwork or physical embroidery approval.</b> These authored raster controls were automatically converted into pixel rings, then generated locally by real Ink/Stitch 3.3.0. Every PES/DST needle was independently decoded with pyembroidery 1.5.1. No AI or hosted worker was used. The butterfly/bird/flower source drafts still have no stitch plan or machine files.</p>
<nav><a href="#horizontal">Horizontal</a><a href="#diagonal">Diagonal</a><a href="#underlay">Underlay</a><a href="#nested-island">Nested island + size change</a></nav>
'''+'\n'.join(cards)+'''
<p>Remaining limits: thousands of fragmented real-art colour regions, semantic and thread colour uncertainty, compound point editing, local minimum-width detection, routing/density optimisation and fabric suitability. Source drafts and hosted exports stay machine-ineligible.</p></main></html>'''
    (output/'Compound_Machine_Evidence_OFFLINE.html').write_text(document)
    print(json.dumps({'cases': [r['case'] for r in results], 'reports': results}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--engine', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT/'docs/test-evidence/MD-2.44-compound-machine')
    args = parser.parse_args()
    build(args.engine, args.output)
