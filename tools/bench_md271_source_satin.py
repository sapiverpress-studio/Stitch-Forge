"""Real native PES/DST source-bound satin-vs-tatami A/B without live change.

This is a test of a limited stitch-object family, NOT a visual fidelity or
fabric sew-out benchmark. Public synthetic simple straight source objects ONLY.
"""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import struct
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_packet import regions_from_labels
from artwork_trial import run_trial


def synthetic_source_plan():
    w,h=160,130
    labels=np.zeros((h,w),dtype=np.uint8)
    # 3.3-mm-wide horizontal genuine original colour component.
    labels[39:50,12:112]=1
    image=Image.new('L',(w,h))
    d=ImageDraw.Draw(image)
    d.ellipse((55,66,133,118),fill=2)
    oval=np.asarray(image,dtype=np.uint8)
    labels[oval==2]=2
    palette=['#114488','#DDAA22']
    rgba=np.zeros((h,w,4),dtype=np.uint8)
    for value,color in enumerate(palette,1):
        area=labels==value
        rgba[area,:3]=[int(color[i:i+2],16) for i in (1,3,5)]
        rgba[area,3]=255
    native=48.
    regions,parts=regions_from_labels(labels,palette)
    pixels=int((labels>0).sum())
    source={'sha256':sha256(struct.pack('>II',w,h)+rgba.tobytes()).hexdigest(),
            'width':w,'height':h,'originalWidth':w,'originalHeight':h}
    plan={'schema':'stitch-forge-source-object-plan-v1',
          'source':source,
          'physical':{'imageWidthMm':native,'imageHeightMm':native*h/w,
                      'scaleMmPerPixel':native/w},
          'sourcePlanSignature':sha256(rgba.tobytes()+labels.tobytes()).hexdigest(),
          'regions':regions,
          'summary':{'sourceParts':parts,'workingParts':parts,
                     'sourcePixels':pixels,'representedPixels':pixels,
                     'omittedPixels':0},
          'machineEligible':False}
    return plan


def compare(engine,out):
    root=Path(out);root.mkdir(parents=True,exist_ok=True)
    plan=synthetic_source_plan()
    findings=[]
    for kind,enabled in [('tatami',False),('bounded_satin',True)]:
        os.environ['STITCH_FORGE_AUTO_SATIN_TRIAL']='1' if enabled else '0'
        os.environ['STITCH_FORGE_CONTOUR_FILL_TRIAL']='0'
        dest=root/kind
        report=run_trial(plan,Path(engine),dest,timeout_seconds=115,partition_fills=True)
        audit=report['stitchPlanning']['sourceSatinTrial']
        if bool(audit['enabled'])!=enabled:
            raise RuntimeError('Native trial flag not reflected in actual manifest')
        if enabled and audit['acceptedObjects']<1:
            raise RuntimeError('No real source colour object was converted to satin')
        if not enabled and audit['acceptedObjects']!=0:
            raise RuntimeError('Baseline accidentally contains source satin')
        formats={x['format']:x for x in report['decoded']}
        if set(formats)!={'pes','dst'} or any(
            v['needlePointsOutsideWorkingColour'] or
            v['needleSegmentsOutsideWorkingColour'] for v in formats.values()):
            raise RuntimeError('Source-contained real PES/DST not validated')
        if formats['pes']['needleStitches']!=formats['dst']['needleStitches']:
            raise RuntimeError('PES/DST decoded stitch counts diverge')
        findings.append({
            'mode':kind,'originalSourceSha256':plan['source']['sha256'],
            'sourceParts':report['objectSummary']['sourceParts'],
            'physicalWidthMm':plan['physical']['imageWidthMm'],
            'nativePaths':report['nativePaths'],
            'nativeSatinObjects':audit['acceptedObjects'],
            'pesNeedles':formats['pes']['needleStitches'],
            'pesTrims':formats['pes']['trims'],
            'pesJumps':formats['pes']['jumps'],
            'maxNeedleLengthMm':formats['pes']['maxNeedleMoveMm'],
            'peakNeedlesPerMmSquare':formats['pes']['maxNeedlesInOneMmSquare'],
            'unresolvedSourceObjects':report['unresolvedObjects'],
            'machineEligible':False,
            'physicalSewoutVerified':False,
        })
    a,b=findings
    if a['originalSourceSha256']!=b['originalSourceSha256'] or a['sourceParts']!=b['sourceParts']:
        raise RuntimeError('Comparison changed original source geometry')
    result={'schema':'stitch-forge-md271-source-satin-real-PES-DST-ab',
            'result':'REAL_NATIVE_SOURCE_AUDITED_NOT_SEWOUT_APPROVED',
            'testIllustration':'synthetic-straight-colour-bar-and-ellipse',
            'comparison':findings,'nativeSourceContainmentPassed':True,
            'sourceSemanticsVerified':False,'physicalSewoutVerified':False,
            'recommendsProductionDeployment':False}
    (root/'md271-satin-native-AB-NOT-APPROVED.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--engine',required=True)
    p.add_argument('--output',required=True)
    args=p.parse_args()
    compare(args.engine,args.output)
