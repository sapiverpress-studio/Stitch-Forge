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

from artwork_packet import decode_packet,encoded,inflate
from artwork_trial import build_trial_svg,texture_trial,run_trial,validate_native_payload,checked_masks
from repair_policy import choose_source_preserving_repair
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
    if (not isinstance(receipt,dict) or
            set(receipt) not in ({'requestId','objectIds','issuedAt','mac'},
                                 {'requestId','objectIds','issuedAt','mac','mode'}) or
            ('mode' in receipt and receipt['mode'] not in (
                'fill_preserving','source_scanline','sectioned_tatami','original_layout'))):
        raise ValueError('Invalid native repair receipt')
    ids=receipt['objectIds'];unsigned={k:v for k,v in receipt.items() if k!='mac'}
    if (receipt['requestId']!=identity or isinstance(receipt['issuedAt'],bool) or not isinstance(receipt['issuedAt'],int)
            or not 0<=now-receipt['issuedAt']<=900 or not isinstance(ids,list) or not 1<=len(ids)<=12
            or (receipt.get('mode') == 'original_layout' and ids != ['layout'])
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


def native_export_timeout():
    """Bound the private native Ink/Stitch phase, separate from Cloud Run/Netlify.

    Default 40s preserves existing production behavior. A staged revision can
    explicitly opt into a longer 40–120s limit. Invalid settings fail closed;
    this is never an unlimited or client-controllable processing budget.
    """
    raw=os.environ.get('STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS','40')
    if not raw.isascii() or not raw.isdecimal() or len(raw)>3:
        raise ValueError('Invalid native export time budget')
    seconds=int(raw)
    if not 40<=seconds<=120:
        raise ValueError('Native export time budget outside safe limit')
    return seconds


def export_one(svg,directory,executable,fmt):
    path=Path(directory)/'trusted-artwork.svg';path.write_bytes(svg)
    argv=[str(executable),'--extension=output','--format='+fmt]
    if fmt=='pes':argv.append('--version=6')
    result=_run_engine(argv+[str(path)],timeout_seconds=native_export_timeout())
    if result.returncode:raise DigitiserError('Native artwork phase failed')
    validate_native_payload(fmt,result.stdout)
    return result.stdout


def process_phase(obj,*,executable,secret,epoch=None):
    plan,meta,identity,evidence=decode_packet(obj)
    now=int(time.time() if epoch is None else epoch)
    signed_objects=repair_objects(obj.get('repairReceipt'),identity,secret,now)
    mode=obj['repairReceipt'].get('mode') if signed_objects else None
    original_layout=mode=='original_layout'
    overrides=() if original_layout else signed_objects
    hybrid_profile=None
    if os.environ.get("STITCH_FORGE_HOME_HYBRID_ENABLED","0")=="1":
        # The browser supplies a source-verified pixel packet. The private
        # worker reconstructs the actual Home plan from those SAME bytes,
        # retaining browser-visible request/source/physical identity.
        from home_live_bridge import derive_hybrid_plan
        plan,evidence,hybrid_profile=derive_hybrid_plan(
            obj,plan,meta,identity,evidence)
    if not original_layout and os.environ.get('STITCH_FORGE_ADAPTIVE_ARTWORK', '0') == '1':
        import numpy as np
        from PIL import Image
        from artwork_layout import prepare_layout

        masks, scale = checked_masks(plan)
        w, h = plan['source']['width'], plan['source']['height']
        rgba = np.frombuffer(inflate(obj['rgbaGzip'], w*h*4), dtype=np.uint8).reshape(h, w, 4)
        if evidence.get('originalSourceSha256Verified') is True:
            with Image.open(BytesIO(base64.b64decode(obj['originalPngBase64'], validate=True))) as image:
                rgba = np.asarray(image.convert('RGBA').resize((w, h), Image.Resampling.LANCZOS))
        plan = prepare_layout(plan, masks, rgba[:, :, :3], scale,
                              allow_consolidation=meta['texturePolicy'] == 'if_needed')
        layout = plan['adaptiveArtworkLayout']
        if layout['colourConsolidated'] or layout.get('sourceMarksRestored'):
            evidence = {**evidence, 'sourceMeanRgbDistance': layout['outputMeanRgbDistance'],
                        'sourcePixelsBeyondRgb60': layout['outputPixelsBeyondRgb60']}
    plan,svg=prepared(plan,meta['texturePolicy'])
    # Legacy signed receipts remain readable for an in-flight request; new
    # repairs preserve the original fill rather than replacing it with linework.
    fill_repair=mode=='fill_preserving'
    scanline_repair=mode=='source_scanline'
    sectioned_repair=mode=='sectioned_tatami'
    if overrides:
        svg,_,_=build_trial_svg(plan,partition_fills=True,
            fill_repair_overrides=overrides if fill_repair else (),
            scanline_overrides=overrides if scanline_repair else (),
            section_overrides=overrides if sectioned_repair else (),
            running_overrides=overrides if mode is None else ())
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
        report=run_trial(plan,executable,tmp,native_outputs={'pes':pes,'dst':dst},
            partition_fills=True,fill_repair_overrides=overrides if fill_repair else (),
            scanline_overrides=overrides if scanline_repair else (),
            section_overrides=overrides if sectioned_repair else (),
            running_overrides=overrides if mode is None else ())
        if any(r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour'] for r in report['decoded']):
            if os.environ.get('STITCH_FORGE_LOCAL_DIAGNOSTICS_DIR'):
                (Path(tmp)/'failed-native-pass-report.json').write_text(json.dumps(report,separators=(',',':')))
            if signed_objects:raise ValueError('Decoded source-containment audit failed')
            try:
                ids=source_repair_candidates(plan,report)
                repair_mode=(choose_source_preserving_repair(plan,ids)
                    if os.environ.get('STITCH_FORGE_AUTO_SOURCE_REPAIR','0')=='1'
                    else 'sectioned_tatami' if os.environ.get(
                        'STITCH_FORGE_SECTIONED_TATAMI_REPAIR','0')=='1'
                    else 'source_scanline' if os.environ.get(
                        'STITCH_FORGE_SOURCE_SCANLINE_REPAIR','0')=='1'
                    else 'fill_preserving')
            except ValueError:
                if not plan.get('adaptiveArtworkLayout'):raise
                ids=['layout']
                repair_mode='original_layout'
            receipt={'requestId':identity,'objectIds':ids,'issuedAt':now,
                     'mode':repair_mode}
            receipt['mac']=repair_signature(receipt,secret)
            return {'status':'BOUNDED_NATIVE_REPAIR_REQUIRED','requestId':identity,'repairReceipt':receipt}
        report.update(requestId=identity,sourceBinding=evidence,nativePasses=2 if signed_objects else 1,maxNativePasses=2,
            nativeInputSha256=sha256(svg).hexdigest(),workflow='TWO_NATIVE_PHASES_NO_AI',machineEligible=False)
        if original_layout:
            report['stitchPlanning']['adaptiveArtworkLayout']={
                'colourDecision':'original_layout_after_native_audit','colourConsolidated':False,
                'sourceForegroundPreserved':True}
        if hybrid_profile is not None:
            report['homeHybrid']=hybrid_profile
            if 'home_hybrid_likeness_unverified' not in report['blockers']:
                report['blockers'].append('home_hybrid_likeness_unverified')
        preview=json.loads((Path(tmp)/'decoded-preview.json').read_text());preview['requestId']=identity
        readme=('STITCH FORGE — ENGINEERING TRIAL, NOT MACHINE APPROVED\n\n'
            'Actual native Ink/Stitch PES6 and DST, independently decoded and checked against prepared source colours.\n'
            'This is not physical embroidery or professional digitising approval.\n'
            'Review machine-report.json for unresolved details, texture changes, direction, trim/routing, underlay and fabric limitations.\n'
            'decoded-preview.json contains actual decoded needle segments, not a stitch simulation.\n'
            'DST needs the requested external colour order in the report; PES6 preserves working-palette RGB.\n')
        readme+='native-artwork-input.svg is the actual editable native input; inspect/edit it in Ink/Stitch before any physical trial.\n'
        entries=[('artwork-trial.pes',pes),('artwork-trial.dst',dst),
                 ('machine-report.json',json.dumps(report,separators=(',',':')).encode()),
                 ('decoded-preview.json',json.dumps(preview,separators=(',',':')).encode()),
                 ('native-artwork-input.svg',svg),('READ_ME_NOT_APPROVED.txt',readme.encode())]
        if report['stitchPlanning'].get('adaptiveArtworkLayout'):
            checklist=(
                'PHYSICAL SEW-OUT RECORD\n\n'
                'Use a spare swatch with the intended fabric, stabiliser, needle and thread.\n'
                'Match the design dimensions in machine-report.json and keep that report with the sample.\n'
                'For DST, set the thread order listed in requestedColourOrder.\n'
                'Record the file format and SHA256, date, operator, machine model, hoop and settings.\n'
                'Record actual stitched width and height, elapsed time, thread breaks and manual cuts.\n'
                'Inspect the face and reverse for gaps, bunching, exposed travel, shifting and puckering.\n'
                'Photograph the front and reverse, and record pass, fail or adjustments needed.\n'
                'The result applies to this file, size and machine and material setup.\n')
            entries.append(('SEW_OUT_CHECKLIST.txt',checklist.encode()))
        result=BytesIO()
        with zipfile.ZipFile(result,'w',zipfile.ZIP_DEFLATED) as z:
            for name,data in entries:z.writestr(name,data)
        payload=result.getvalue()
        if len(payload)>3000000:raise ValueError('Native artwork result exceeds download budget')
        return payload
