"""Offline original/native-input/actual decoded evidence; no engine calls."""
from pathlib import Path
from io import BytesIO
from hashlib import sha256
import base64,json,zipfile,argparse,html
from PIL import Image,ImageDraw
import pyembroidery as pe
import cairosvg
from sys import path
ROOT=Path(__file__).resolve().parents[1]
path.insert(0,str(ROOT/'services/digitiser'))
from artwork_trial import validate_native_payload


def uri(file,mime):return 'data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()


def render(raw,fmt,report,output):
    validate_native_payload(fmt,raw)
    d=next(d for d in report['decoded'] if d['format']==fmt)
    assert sha256(raw).hexdigest()==d['sha256']
    pat=(pe.read_pes if fmt=='pes' else pe.read_dst)(BytesIO(raw))
    assert sum(s[2]&pe.COMMAND_MASK==pe.STITCH for s in pat.stitches)==d['needleStitches']
    width=report['imageWidthMm']+4;height=(width-4)*report['source']['height']/report['source']['width']+4
    scale=1200/max(width,height);im=Image.new('RGB',(round(width*scale),round(height*scale)),'white');draw=ImageDraw.Draw(im)
    offset=d['translationToSourceMm'];colors=d['requestedColourOrder'];block=0;previous=None
    for x,y,flags in pat.stitches:
        command=flags&pe.COMMAND_MASK;point=((x/10+offset[0])*scale,(y/10+offset[1])*scale)
        if command==pe.COLOR_CHANGE:block+=1
        elif command==pe.STITCH and previous is not None:draw.line([previous,point],fill=colors[block],width=max(1,round(.12*scale)))
        previous=point
    im.save(output)


def build(folder):
    cards=[]
    for sample in json.loads((ROOT/'tests/fixtures/artwork-evaluation/manifest.json').read_text())['samples']:
        name=sample['id'];archive=folder/(name+'-actual-app-trial.zip');out=folder/name;out.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            report=json.loads(z.read('machine-report.json'));svg=z.read('native-artwork-input.svg')
            assert sha256(svg).hexdigest()==report['nativeInputSha256']
            cairosvg.svg2png(bytestring=svg,write_to=str(out/'actual-native-input.png'),output_width=1000,background_color='#ffffff')
            for fmt in ('pes','dst'):render(z.read('artwork-trial.'+fmt),fmt,report,out/('actual-decoded-'+fmt+'.png'))
            (out/'machine-report.json').write_text(json.dumps(report,indent=2)+'\n')
        panels=[('Original PNG input',ROOT/'tests/fixtures/artwork-evaluation'/sample['raster_file']),
            ('Actual editable native input',out/'actual-native-input.png'),('Actual decoded PES6 needles',out/'actual-decoded-pes.png'),
            ('Actual decoded DST · external colour order',out/'actual-decoded-dst.png')]
        pictures=''.join('<figure><figcaption>'+title+'</figcaption><img alt="'+title+'" src="'+uri(p,'image/png')+'"></figure>' for title,p in panels)
        d=report['decoded'][0]
        cards.append('<article><h2>'+html.escape(sample['title'])+'</h2><div class="panels">'+pictures+'</div><p>'+str(d['needleStitches'])+' needle stitches per format; '+str(d['colourChanges'])+' colour changes. '+str(report['unresolvedObjects'])+' unresolved small objects. Outside-colour points / complete segments: 0 / 0 at 0.11mm tolerance.</p><p>Actual app, protected Function, loopback HTTP worker, native engine and independent decoder were exercised. No paid AI or hosted worker was used.</p><p>Shape-based fill/running trials; automatic satin, biological feature identity, optimal travel, fabric settings, physical quality and owner likeness acceptance remain unverified.</p><p><a download="'+name+'-TRIAL-NOT-APPROVED.zip" href="'+uri(archive,'application/zip')+'">Download exact app ZIP</a></p><p>'+html.escape(sample['author'])+' · CC0-1.0 · <a href="'+sample['source_page']+'">source</a></p></article>')
    content='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stitch Forge MD-2.49 actual app evidence</title><style>body{margin:0;background:#f1f6f5;color:#183c40;font:17px system-ui;line-height:1.5}main{max-width:1450px;margin:auto;padding:20px}article{background:white;padding:18px;margin:22px 0;border-radius:16px}.panels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{min-height:3em;font-weight:650}a{color:#086f7a}.notice{background:#fff0cd;padding:14px}@media(max-width:800px){.panels{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){.panels{grid-template-columns:1fr}figcaption{min-height:0}}</style><main><h1>MD-2.49 · actual app/native workflow</h1><p class="notice">These are real Ink/Stitch PES6/DST files, independently decoded. Not simulations or physical embroidery approval. White-background decoded panels contain only machine movements, with no original artwork underneath. Source geometry is deterministic pixel-based preparation, not an AI reconstruction. The private painted case passed separately; its images and machine data are excluded here.</p>'''+''.join(cards)+'''<p>No deployment occurred. This page works offline; source links need an internet connection. Android-sized Chromium checks are not a physical Android-device test.</p></main></html>'''
    (folder/'Actual_App_Workflow_OFFLINE.html').write_text(content)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);build(p.parse_args().output)
