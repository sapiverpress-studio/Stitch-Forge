"""Real Ink/Stitch curved/tapered native A/B on identical source artwork.

Tests a genuinely different source-derived satin column's decoded PES/DST
needle direction, not just SVG metadata. No Kingfisher upload/deployment.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import struct
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_packet import regions_from_labels
from artwork_trial import run_trial


def synthetic_curved_plan():
    w,h=170,130
    labels=np.zeros((h,w),dtype=np.uint8)
    for x in range(18,145):
        t=(x-18)/127
        middle=45+5*math.sin(math.pi*t)
        half=6+2*t
        for y in range(int(round(middle-half)),int(round(middle+half))):
            labels[y,x]=1
    im=Image.new('L',(w,h))
    d=ImageDraw.Draw(im)
    d.ellipse((52,79,130,123),fill=2)
    labels[np.asarray(im,dtype=np.uint8)==2]=2
    palette=['#114488','#DDAA22']
    rgba=np.zeros((h,w,4),dtype=np.uint8)
    for i,colour in enumerate(palette,1):
        area=labels==i
        rgba[area,:3]=[int(colour[k:k+2],16) for k in (1,3,5)]
        rgba[area,3]=255
    physical_width=51.
    regions,parts=regions_from_labels(labels,palette)
    count=int((labels>0).sum())
    plan={'schema':'stitch-forge-source-object-plan-v1',
          'source':{'sha256':sha256(struct.pack('>II',w,h)+rgba.tobytes()).hexdigest(),
                    'width':w,'height':h,'originalWidth':w,'originalHeight':h},
          'physical':{'imageWidthMm':physical_width,
                      'imageHeightMm':physical_width*h/w,
                      'scaleMmPerPixel':physical_width/w},
          'sourcePlanSignature':sha256(rgba.tobytes()+labels.tobytes()).hexdigest(),
          'regions':regions,
          'summary':{'sourceParts':parts,'workingParts':parts,
                     'sourcePixels':count,'representedPixels':count,
                     'omittedPixels':0},
          'machineEligible':False}
    return plan


def evaluate(engine,output):
    root=Path(output);root.mkdir(parents=True,exist_ok=True)
    plan=synthetic_curved_plan()
    trials=[]
    directions=[]
    for name,enabled in [('tatami',False),('source_curved_satin',True)]:
        os.environ['STITCH_FORGE_AUTO_SATIN_TRIAL']='0'
        os.environ['STITCH_FORGE_CURVED_SATIN_TRIAL']='1' if enabled else '0'
        out=root/name
        report=run_trial(plan,Path(engine),out,timeout_seconds=115,
                         partition_fills=True)
        audit=report['stitchPlanning']['sourceCurvedSatinTrial']
        if audit['enabled']!=enabled or audit['acceptedObjects']!=(1 if enabled else 0):
            raise RuntimeError('Curved source geometry was not made into a real native satin object')
        native={q['format']:q for q in report['decoded']}
        if set(native)!={'pes','dst'} or native['pes']['needleStitches']!=native['dst']['needleStitches']:
            raise RuntimeError('Genuine independently decoded PES/DST consistency failed')
        if any(q['needlePointsOutsideWorkingColour'] or
               q['needleSegmentsOutsideWorkingColour'] for q in native.values()):
            raise RuntimeError('Curved satin needle points/segments leave actual source colour')
        preview=json.loads((out/'decoded-preview.json').read_text())
        sample=[]
        for ax,ay,bx,by,color in preview['segments']:
            x=(ax+bx)/2
            y=(ay+by)/2
            if color!=0 or not 6.8<=x<=45.8 or not 12.5<=y<=20:
                continue
            dx,dy=bx-ax,by-ay
            if (dx*dx+dy*dy)**.5>.25:
                sample.append((round(dx,4),round(dy,4)))
        if len(sample)<10:
            raise RuntimeError('Cannot attribute enough real decoded stitches to source curved region')
        transverse=sum(abs(dy)>1.5*abs(dx) for dx,dy in sample)/len(sample)
        directions.append(sample)
        trials.append({'mode':name,'sourceSha256':plan['source']['sha256'],
                       'sourcePixels':plan['summary']['sourcePixels'],
                       'nativeCurvedSatinObjects':audit['acceptedObjects'],
                       'nativePaths':report['nativePaths'],
                       'pesStitches':native['pes']['needleStitches'],
                       'pesTrims':native['pes']['trims'],
                       'pesJumps':native['pes']['jumps'],
                       'maxNeedleMoveMm':native['pes']['maxNeedleMoveMm'],
                       'maxNeedlesInMmSquare':native['pes']['maxNeedlesInOneMmSquare'],
                       'sourceRegionCrossWidthFraction':round(transverse,4),
                       'unresolvedObjects':report['unresolvedObjects'],
                       'sourceContainmentVerified':True,
                       'machineApproved':False})
    a,b=trials
    if a['sourceSha256']!=b['sourceSha256'] or a['sourcePixels']!=b['sourcePixels']:
        raise RuntimeError('Source was modified by the new stitch-family planner')
    if directions[0]==directions[1]:
        raise RuntimeError('Only native SVG metadata changed; actual needle paths are identical')
    if b['sourceRegionCrossWidthFraction']<=a['sourceRegionCrossWidthFraction']+.10:
        raise RuntimeError('Curved satin did not produce actual cross-width stitches')
    result={'schema':'MD272-source-curved-satin-native-PES-DST-AB-v1',
            'result':'SOURCE_AUDITED_REAL_NATIVE_NOT_SEWOUT_APPROVED',
            'sourceIdentical':True,'realNeedlePathsChanged':True,
            'sourceContourBreachCount':0,
            'artwork':'synthetic-gently-curved-tapered-strip-and-ellipse',
            'trials':trials,
            'actualFabricQualityVerified':False,
            'licensedDetailedArtImprovementVerified':False,
            'kingfisherImprovementVerified':False,
            'recommendsDeployment':False}
    (root/'md272-curved-satin-AB-NOT-APPROVED.json').write_text(
        json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--engine',required=True)
    p.add_argument('--output',required=True)
    args=p.parse_args()
    evaluate(args.engine,args.output)
