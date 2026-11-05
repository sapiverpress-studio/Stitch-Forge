"""Unmodified StitchFoundry release CLI comparison on CC0 PNGs only.

The program itself is downloaded from upstream's published release and its SHA
verified in the CI workflow. No owner image or downstream algorithm is used.
"""
from __future__ import annotations
import base64, hashlib, json, os, subprocess, sys
from pathlib import Path
from PIL import Image
import pyembroidery

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'tests'/'fixtures'/'artwork-evaluation'
SAMPLES=('macaw','rose')

def main():
    if len(sys.argv)!=3:
        raise ValueError('Usage: benchmark_stitchfoundry.py CLI OUTPUT')
    cli=Path(sys.argv[1]).resolve()
    output=Path(sys.argv[2])
    output.mkdir(parents=True,exist_ok=True)
    rows=json.loads((BASE/'manifest.json').read_text())['samples']
    report={'schema':'stitch-forge-stitchfoundry-upstream-v1',
      'engine':'StitchFoundry','version':'v0.14.0-rc.1',
      'ownerPrivateArtUsed':False,'machineApproved':False,
      'physicalSewoutVerified':False,'results':[]}
    for name in SAMPLES:
        rec=next(v for v in rows if v['id']==name)
        if rec['licence']!='CC0-1.0':
            raise RuntimeError('Non-CC0 input forbidden')
        data=(BASE/rec['raster_file']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=rec['raster_sha256']:
            raise RuntimeError('Licensed source SHA mismatch')
        inp=output/(name+'.png');inp.write_bytes(data)
        cmd=[str(cli),'run','--in',str(inp),
             '--cmd','select.all',
             '--cmd','embroidery.autoDigitize','--params',
             json.dumps({'colors':9,'detail':72,'noise':15,
                 'removeBackground':True,'size':80,'keepImage':False}),
             '--cmd','embroidery.export','--params','{"format":"pes"}',
             '--cmd','embroidery.export','--params','{"format":"dst"}']
        try:
            p=subprocess.run(cmd,capture_output=True,text=True,timeout=180,
                env={**os.environ,'VECTORCRAFT_CONFIG_DIR':str(output/'config')})
        except subprocess.TimeoutExpired:
            report['results'].append({'fixture':name,'status':'TIMEOUT_AT_180_SECONDS'})
            continue
        result={'fixture':name,'sourceSha256':rec['raster_sha256'],
                'returncode':p.returncode,
                'stderrTail':p.stderr[-800:],
                'steps':[],
                'native':[]}
        for line in p.stdout.splitlines():
            try:
                o=json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(o,dict):continue
            # CLI prints one JSON object per open/command result. Keep only
            # bounded report fields; never log native base64.
            value=o.get('result',o.get('value',{}))
            if not isinstance(value,dict):value={}
            if isinstance(value.get('dataBase64'),str):
                fmt=value.get('format')
                if fmt in ('pes','dst'):
                    payload=base64.b64decode(value['dataBase64'],validate=True)
                    target=output/f'{name}-STITCHFOUNDRY-NOT-APPROVED.{fmt}'
                    target.write_bytes(payload)
                    native=pyembroidery.read(str(target))
                    needles=sum(1 for t in native.stitches if (t[2]&pyembroidery.COMMAND_MASK)==pyembroidery.STITCH)
                    coords=[(x,y) for x,y,c in native.stitches if (c&pyembroidery.COMMAND_MASK)==pyembroidery.STITCH]
                    bounds=[round((max(v)-min(v))/10,2) for v in zip(*coords)] if coords else []
                    result['native'].append({'format':fmt,'sha256':hashlib.sha256(payload).hexdigest(),
                       'bytes':len(payload),'needleStitches':needles,'boundsMm':bounds})
                result['steps'].append({'type':'machine-export','format':fmt,'bytes':len(value['dataBase64'])})
            else:
                safe={k:v for k,v in value.items() if k not in ('pngBase64','dataBase64','image','payload')}
                result['steps'].append({'keys':list(o.keys()),'value':str(safe)[:550]})
        result['status']='PASS_FORMATS' if {x['format'] for x in result['native']}=={'pes','dst'} else 'NO_NATIVE_FILES'
        report['results'].append(result)
        print(json.dumps({k:v for k,v in result.items() if k!='steps'}),flush=True)
    (output/'STITCHFOUNDRY-CC0-REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
    if not all(v['status']=='PASS_FORMATS' for v in report['results']):
        raise RuntimeError('Unmodified StitchFoundry failed end-to-end PNG -> PES/DST')

if __name__=='__main__':
    main()
