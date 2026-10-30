"""Show actual licensed raster -> native trial -> independently decoded stitches."""
import argparse
import base64
import json
from pathlib import Path
import cairosvg

ROOT=Path(__file__).resolve().parents[1]


def uri(path,mime='image/png'):
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()


def build(output):
    cards=[];summary=[]
    samples=json.loads((ROOT/'tests/fixtures/artwork-evaluation/manifest.json').read_text())['samples']
    for sample in samples:
        folder=output/'artwork-machine'/sample['id']
        if not (folder/'machine-report.json').is_file():continue
        report=json.loads((folder/'machine-report.json').read_text())
        for stem in ['prepared-artwork','actual-decoded-pes','actual-decoded-dst']:
            cairosvg.svg2png(url=str(folder/(stem+'.svg')),write_to=str(folder/(stem+'.png')),output_width=900,background_color='#ffffff')
        panels=[('Original raster input',ROOT/'tests/fixtures/artwork-evaluation'/sample['raster_file']),
                ('Prepared colour geometry',folder/'prepared-artwork.png'),
                ('Actual decoded native PES6 stitches',folder/'actual-decoded-pes.png'),
                ('Actual decoded DST stitches · external colour order',folder/'actual-decoded-dst.png')]
        figures=''.join('<figure><figcaption>'+title+'</figcaption><img alt="'+title+'" src="'+uri(path)+'"></figure>' for title,path in panels)
        rows=''.join('<tr><td>'+r['format'].upper()+'</td><td>'+str(r['needleStitches'])+'</td><td>'+str(r['colourChanges'])+'</td><td>'+str(r['jumps'])+'</td><td>'+str(r['trims'])+'</td><td>'+str(r['needlePointsOutsideWorkingColour'])+' / '+str(r['needleSegmentsOutsideWorkingColour'])+'</td></tr>' for r in report['decoded'])
        cp=report['decoded'][0]['coverageProxy'];proximity=sum(v['pixelsNearDecodedPath'] for v in cp.values())/sum(v['selectedPixels'] for v in cp.values())
        summary.append({'sample':sample['id'],'source':report['source'],'nativePaths':report['nativePaths'],
            'unresolvedObjects':report['unresolvedObjects'],'unresolvedPixels':report['unresolvedPixels'],
            'decodedNeedleStitchesPerFormat':report['decoded'][0]['needleStitches'],
            'outsideNeedlePoints':report['decoded'][0]['needlePointsOutsideWorkingColour'],
            'outsideNeedleSegments':report['decoded'][0]['needleSegmentsOutsideWorkingColour'],
            'pathProximityProxyFraction':proximity,'machineEligible':False,'blockers':report['blockers']})
        machine_ok=not any(r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour'] for r in report['decoded'])
        direction=report['decoded'][0]['fillDirectionAudit'];auditable=[d for d in direction.values() if d['attributedLongSegmentMm']>=3]
        low=min((d['alignedLongSegmentFraction'] for d in auditable),default=0)
        cards.append(f'''<article><h2>{sample['title']}</h2><div class="panels">{figures}</div>
<p><b>{report['nativePaths']} native paths; {report['unresolvedObjects']} unresolved small pieces ({report['unresolvedPixels']} selected pixels).</b> Nothing unresolved is silently called digitised.</p>
<div class="table"><table><thead><tr><th>File</th><th>Needles</th><th>Colour changes</th><th>Jumps</th><th>Trims</th><th>Outside points / segments</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Needle and complete-segment colour containment: {'passed' if machine_ok else 'FAILED'}, with 0.11mm coordinate tolerance. PES6 source RGB/order and every PES/DST needle coordinate were independently cross-checked; DST itself has no RGB thread palette. Jump/trim counts differ by file encoding and decoder.</p>
<p>{len(auditable)} fill objects have at least 3mm of attributed long segments. Their lowest aligned-length fraction is {low:.3f}, using an 8° coordinate allowance. Directions come from shape axes, not AI feather/petal understanding. Running skeletons are source-supported proposals; no satin rails are inferred here.</p>
<p>{proximity*100:.2f}% of selected analysis pixels are near an actual decoded path under the explicit 0.25mm raster proximity measure. This is <b>not a likeness score, stitch coverage guarantee or physical thread/fabric measurement</b>.</p>
<p>Expected visible features from the source manifest: {', '.join(sample['expected_visible_features'])}. Their semantic identity and owner likeness acceptance remain unverified.</p>
<p class="notice">Approval remains blocked: {', '.join(report['blockers'])}. Underlay is off for this controlled trial. Thread ties, dense areas, travel efficiency, layering, tension, fabric and finished quality need further work and a sew-out.</p>
<a download="{sample['id']}-machine-report-NOT-APPROVED.json" href="{uri(folder/'machine-report.json','application/json')}">Save the exact machine report</a>
<p class="credit">{sample['author']}; CC0-1.0; source: <a href="{sample['source_page']}">{sample['title']}</a>. No source-vector paths were supplied to digitising.</p></article>''')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge MD-2.48 · real artwork engine trials</title>
<style>body{font:17px/1.5 system-ui;margin:0;color:#183940;background:#edf4f2}main{max-width:1450px;margin:auto;padding:18px}article{padding:18px;background:white;border:1px solid #9bbab4;border-radius:12px;margin:22px 0}.panels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0;min-width:0}figcaption{font-weight:650;min-height:3em}img{display:block;width:100%;height:auto;background:white}.notice{border-left:5px solid #a8512a;background:#fff2e6;padding:12px}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:8px;border:1px solid #bacac6}.credit{font-size:.85rem}a{color:#126475}@media(max-width:800px){.panels{grid-template-columns:1fr 1fr}}@media(max-width:500px){main,article{padding:12px}.panels{grid-template-columns:1fr}figcaption{min-height:0}}</style>
<main><h1>MD-2.48 · actual native artwork trials</h1><p class="notice"><b>Real Ink/Stitch 3.3.0 files, independently decoded by pyembroidery 1.5.1. Not stitch simulations or professional approval.</b> These are non-synthetic, licensed vector-origin illustrations provided to the automatic pipeline as PNGs. No ideal vector regions or paid AI were used. The private painted input exceeded the native path budget before an additional bounded texture/branch-routing experiment. Its later native result and artwork remain private and are excluded from these public panels.</p>'''+''.join(cards)+'''<p>All files are local engineering trials. No Netlify deployment, hosted worker, paid model or physical embroidery occurred. Source preparation and app deployment remain separate from these local native trials.</p></main></html>'''
    (output/'Native_Artwork_Evidence_OFFLINE.html').write_text(html)
    (output/'native-artwork-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);build(p.parse_args().output)
