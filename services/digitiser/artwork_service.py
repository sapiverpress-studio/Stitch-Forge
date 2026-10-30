"""Two stateless native phases: no background job, storage service or paid AI.

The short-lived receipt binds a real PES6 to exact source bytes, dimensions,
proposed geometry, texture policy and compiled SVG. Only then can DST complete
the independently decoded, source-contained trial transaction. No approval flag
is ever granted; a geometrically unsafe result is not returned for download.
"""
import base64
from hashlib import sha256
import hmac
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import zipfile
import shutil
import os
from contextlib import contextmanager

from artwork_packet import decode_packet,encoded
from artwork_trial import build_trial_svg,texture_trial,run_trial,validate_native_payload,checked_masks
from inkstitch_cli import _run_engine,DigitiserError

AUDIT='SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED'


@contextmanager
def local_workspace(identity,plan):
    """Optional private loopback diagnostics. No credentials or original raster."""
    target=os.environ.get('STITCH_FORGE_LOCAL_DIAGNOSTICS_DIR')
    with TemporaryDirectory(prefix='stitch-forge-artwork-') as tmp:
        if target:(Path(tmp)/'prepared-private-plan.json').write_text(json.dumps(plan,separators=(',',':')))
        try:yield tmp
        except Exception as error:
            if target:(Path(tmp)/'failure.json').write_text(json.dumps({'error':str(error),'machineEligible':False}))
            raise
        finally:
            if target:
                try:shutil.copytree(tmp,Path(target)/identity,dirs_exist_ok=True)
                except OSError:pass


def prepared(plan,policy):
    try:
        svg,_,_=build_trial_svg(plan,partition_fills=True)
        return plan,svg
    except ValueError as error:
        # Only named resource refusals permit the disclosed texture pass.
        if policy!='if_needed' or not ('exceeds path/vertex budget' in str(error) or 'SVG exceeds engine input budget' in str(error)):raise
        adjusted=texture_trial(plan,.21)
        svg,_,_=build_trial_svg(adjusted,partition_fills=True)
        return adjusted,svg


def signature(receipt,secret):
    return hmac.new(secret.encode(),b'STITCH_FORGE_ARTWORK_PHASE_V1\x00'+json.dumps(receipt,sort_keys=True,separators=(',',':')).encode(),'sha256').hexdigest()


def repair_signature(receipt,secret):
    return hmac.new(secret.encode(),b'STITCH_FORGE_ARTWORK_REPAIR_V1\x00'+json.dumps(receipt,sort_keys=True,separators=(',',':')).encode(),'sha256').hexdigest()


def repair_objects(receipt,identity,secret,now):
    if receipt is None:return ()
    if not isinstance(receipt,dict) or set(receipt)!={'requestId','objectIds','issuedAt','mac'}:raise ValueError('Invalid native repair receipt')
    ids=receipt['objectIds'];unsigned={k:v for k,v in receipt.items() if k!='mac'}
    if (receipt['requestId']!=identity or isinstance(receipt['issuedAt'],bool) or not isinstance(receipt['issuedAt'],int)
            or not 0<=now-receipt['issuedAt']<=900 or not isinstance(ids,list) or not 1<=len(ids)<=12
            or any(not isinstance(i,str) or len(i)>30 for i in ids) or sorted(set(ids))!=ids
            or not isinstance(receipt['mac'],str) or not hmac.compare_digest(receipt['mac'],repair_signature(unsigned,secret))):
        raise ValueError('Changed or stale native repair receipt')
    return tuple(ids)


def source_repair_candidates(plan,report):
    """Attribute every failed whole segment to one original source component.

    At most 12 faults and 2% of selected pixels. No altered masks, coordinate
    edits or needle re-encoding; a fresh native generation is mandatory.
    """
    from shapely import Point,Polygon
    from xml.etree import ElementTree as ET
    import re
    svg,manifest,_=build_trial_svg(plan,partition_fills=True);bad=report['decoded'][0]
    if bad['needlePointsOutsideWorkingColour'] or not 1<=bad['needleSegmentsOutsideWorkingColour']<=12 or len(bad['firstOutsideSegments'])!=bad['needleSegmentsOutsideWorkingColour']:
        raise ValueError('Decoded source-containment audit failed')
    shapes={}
    for node in ET.fromstring(svg).iter():
        if node.tag.rsplit('}',1)[-1]!='path' or node.get('fill') in (None,'none'):continue
        rings=[]
        for ring in node.get('d').split('Z'):
            nums=[float(n) for n in re.findall(r'-?\d+(?:\.\d+)?',ring)]
            if nums:rings.append(list(zip(nums[::2],nums[1::2])))
        shapes[node.get('id')]=Polygon(rings[0],rings[1:]).buffer(.11)
    chosen={}
    for fault in bad['firstOutsideSegments']:
        candidates=[];points=[Point(xy) for xy in (fault['fromMm'],fault['toMm'])]
        for piece in manifest['nativeFillPieces']:
            if piece['color']==fault['color'] and all(shapes[piece['nativePathId']].covers(p) for p in points):
                candidates.append((piece['id'],piece['pixels']))
        if len(candidates)!=1:raise ValueError('Decoded source-containment audit failed')
        chosen[candidates[0][0]]=candidates[0][1]
    if not chosen or len(chosen)>12 or sum(chosen.values())>plan['summary']['sourcePixels']*.02:raise ValueError('Decoded source-containment audit failed')
    return sorted(chosen)


def verify_receipt(obj,identity,svg,secret,now):
    receipt=obj.get('receipt')
    if not isinstance(receipt,dict) or set(receipt)!={'requestId','pesSha256','svgSha256','issuedAt','mac'}:raise ValueError('Invalid native receipt')
    unsigned={k:v for k,v in receipt.items() if k!='mac'}
    if (isinstance(receipt['issuedAt'],bool) or not isinstance(receipt['issuedAt'],int) or not 0<=now-receipt['issuedAt']<=900
            or receipt['requestId']!=identity or receipt['svgSha256']!=sha256(svg).hexdigest()
            or not isinstance(receipt['mac'],str) or not hmac.compare_digest(receipt['mac'],signature(unsigned,secret))):raise ValueError('Stale or changed native receipt')
    pes=encoded(obj.get('pesBase64'),1500000)
    if sha256(pes).hexdigest()!=receipt['pesSha256']:raise ValueError('Changed native PES bytes')
    validate_native_payload('pes',pes)
    return pes


def export_one(svg,directory,executable,fmt):
    path=Path(directory)/'trusted-artwork.svg';path.write_bytes(svg)
    argv=[str(executable),'--extension=output','--format='+fmt]
    if fmt=='pes':argv.append('--version=6')
    result=_run_engine(argv+[str(path)],timeout_seconds=40)
    if result.returncode:raise DigitiserError('Native artwork phase failed')
    validate_native_payload(fmt,result.stdout)
    return result.stdout


def process_phase(obj,*,executable,secret,epoch=None):
    plan,meta,identity,evidence=decode_packet(obj)
    plan,svg=prepared(plan,meta['texturePolicy']);now=int(time.time() if epoch is None else epoch)
    overrides=repair_objects(obj.get('repairReceipt'),identity,secret,now)
    if overrides:svg,_,_=build_trial_svg(plan,partition_fills=True,running_overrides=overrides)
    with local_workspace(identity,plan) as tmp:
        if obj['phase']=='pes':
            pes=export_one(svg,tmp,executable,'pes')
            receipt={'requestId':identity,'pesSha256':sha256(pes).hexdigest(),'svgSha256':sha256(svg).hexdigest(),'issuedAt':now}
            receipt['mac']=signature(receipt,secret)
            return {'requestId':identity,'pesBase64':base64.b64encode(pes).decode(),'receipt':receipt}
        pes=verify_receipt(obj,identity,svg,secret,now)
        dst=export_one(svg,tmp,executable,'dst')
        if os.environ.get('STITCH_FORGE_LOCAL_DIAGNOSTICS_DIR'):
            (Path(tmp)/'native-phase.pes').write_bytes(pes);(Path(tmp)/'native-phase.dst').write_bytes(dst)
        report=run_trial(plan,executable,tmp,native_outputs={'pes':pes,'dst':dst},partition_fills=True,running_overrides=overrides)
        if any(r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour'] for r in report['decoded']):
            if overrides:raise ValueError('Decoded source-containment audit failed')
            ids=source_repair_candidates(plan,report)
            if os.environ.get('STITCH_FORGE_LOCAL_DIAGNOSTICS_DIR'):
                (Path(tmp)/'failed-native-pass-report.json').write_text(json.dumps(report,separators=(',',':')))
            receipt={'requestId':identity,'objectIds':ids,'issuedAt':now};receipt['mac']=repair_signature(receipt,secret)
            return {'status':'BOUNDED_NATIVE_REPAIR_REQUIRED','requestId':identity,'repairReceipt':receipt}
        report.update(requestId=identity,sourceBinding=evidence,nativePasses=2 if overrides else 1,maxNativePasses=2,
            nativeInputSha256=sha256(svg).hexdigest(),workflow='TWO_NATIVE_PHASES_NO_AI',machineEligible=False)
        preview=json.loads((Path(tmp)/'decoded-preview.json').read_text());preview['requestId']=identity
        readme=('STITCH FORGE — ENGINEERING TRIAL, NOT MACHINE APPROVED\n\n'
            'Actual native Ink/Stitch PES6 and DST, independently decoded and checked against prepared source colours.\n'
            'This is not physical embroidery or professional digitising approval.\n'
            'Review machine-report.json for unresolved details, texture changes, direction, trim/routing, underlay and fabric limitations.\n'
            'decoded-preview.json contains actual decoded needle segments, not a stitch simulation.\n'
            'DST needs the requested external colour order in the report; PES6 preserves working-palette RGB.\n')
        readme+='native-artwork-input.svg is the actual editable native input; inspect/edit it in Ink/Stitch before any physical trial.\n'
        result=BytesIO()
        with zipfile.ZipFile(result,'w',zipfile.ZIP_DEFLATED) as z:
            for name,data in [('artwork-trial.pes',pes),('artwork-trial.dst',dst),
                ('machine-report.json',json.dumps(report,separators=(',',':')).encode()),
                ('decoded-preview.json',json.dumps(preview,separators=(',',':')).encode()),
                ('native-artwork-input.svg',svg),('READ_ME_NOT_APPROVED.txt',readme.encode())]:z.writestr(name,data)
        payload=result.getvalue()
        if len(payload)>3000000:raise ValueError('Native artwork result exceeds download budget')
        return payload
