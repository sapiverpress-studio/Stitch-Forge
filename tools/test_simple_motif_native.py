#!/usr/bin/env python3
"""Actual browser-source packet -> existing private worker two-phase PES6/DST.

The synthetic ghost is generated in JS by the same motif preparation shipped
to mobile. The worker independently rechecks pixels, labels, sizes and native
source colour containment. NEVER marks a physical sew-out as approved.
"""
from __future__ import annotations
import argparse
import base64
from io import BytesIO
import json
from pathlib import Path
import sys
import time
import zipfile

from PIL import Image, ImageDraw
import pyembroidery

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services'/'digitiser'))
from artwork_packet import decode_packet
from artwork_service import process_phase
from artwork_trial import validate_native_payload


def run(engine,folder):
    folder=Path(folder)
    packet=json.loads((folder/'ghost-actual-source-packet.json').read_text())
    plan,_,identity,evidence=decode_packet(packet)
    if (not evidence['foregroundIndependentlyVerified']
            or plan['summary']['sourcePixels']<2000
            or len(plan['regions'])!=2
            or plan['summary']['omittedPixels']!=0):
        raise RuntimeError('Actual browser source partition failed original-mask audit')
    now=int(time.time())
    secret='md277-synthetic-only-secret-for-native-test'
    def one(p):
        return process_phase(p,executable=str(engine),secret=secret,epoch=now)
    first=one(packet)
    for attempt in range(2):
        if not isinstance(first,dict) or first.get('requestId')!=identity or 'pesBase64' not in first:
            raise RuntimeError('Worker did not generate the signed first PES phase')
        second=one({**packet,'phase':'dst','pesBase64':first['pesBase64'],'receipt':first['receipt'],
                  **({'repairReceipt':packet['repairReceipt']} if 'repairReceipt' in packet else {})})
        if isinstance(second,bytes):
            break
        if (attempt or not isinstance(second,dict)
                or second.get('status')!='BOUNDED_NATIVE_REPAIR_REQUIRED'):
            raise RuntimeError('Unresolved native stitch containment or repair failure')
        packet['repairReceipt']=second['repairReceipt']
        first=one(packet)
    else:
        raise RuntimeError('Native source repair budget exceeded')
    with zipfile.ZipFile(BytesIO(second)) as z:
        pes=z.read('artwork-trial.pes')
        dst=z.read('artwork-trial.dst')
        report=json.loads(z.read('machine-report.json'))
        preview=json.loads(z.read('decoded-preview.json'))
        svg=z.read('native-artwork-input.svg')
    validate_native_payload('pes',pes)
    validate_native_payload('dst',dst)
    rows={x['format']:x for x in report['decoded']}
    if (set(rows)!={'pes','dst'} or
        not all(x['needleStitches']>100 and
             x['needlePointsOutsideWorkingColour']==0 and
             x['needleSegmentsOutsideWorkingColour']==0 for x in rows.values()) or
        rows['pes']['needleStitches']!=rows['dst']['needleStitches'] or
        report['requestId']!=identity or
        report['machineEligible'] is not False or
        report['sourceBinding']['foregroundIndependentlyVerified'] is not True):
        raise RuntimeError('Genuine machine files or source-colour audit failed')
    import numpy as np
    from hashlib import sha256
    rgba=np.fromfile(folder/'ghost-source-pixels.rgba',np.uint8).reshape((192,192,4))
    Image.fromarray(rgba,'RGBA').save(folder/'simple-ghost-original.png')
    # Render only actual decoded PES needle segments, not a fake textile image.
    width,height=preview['widthMm'],preview['heightMm']
    scale=6
    img=Image.new('RGB',(int(width*scale)+2,int(height*scale)+2),'white')
    draw=ImageDraw.Draw(img)
    if not 1<=len(preview['segments'])<=125000:raise RuntimeError('No actual needle preview')
    for ax,ay,bx,by,index in preview['segments']:
        draw.line((round(ax*scale),round(ay*scale),round(bx*scale),round(by*scale)),
            fill=preview['palette'][index],width=1)
    img.save(folder/'simple-ghost-actual-decoded-PES-preview-not-sewout.png')
    evidence={
      'status':'ACTUAL_UPLOADED_SIMPLE_MOTIF_PACKET_TO_GENUINE_NATIVE_PES6_DST',
      'sourceFingerprint':plan['source']['sha256'],
      'originalSourcePixelsVerified':plan['summary']['sourcePixels'],
      'originalPalette':sorted(r['color'] for r in plan['regions']),
      'nativeSvgSha256':sha256(svg).hexdigest(),
      'nativeZipSha256':sha256(second).hexdigest(),
      'pesNeedleStitches':rows['pes']['needleStitches'],
      'dstNeedleStitches':rows['dst']['needleStitches'],
      'pesJumps':rows['pes']['jumps'],'pesTrims':rows['pes']['trims'],
      'sourceColourBoundaryBreaches':0,
      'machineApproved':False,'fabricSewoutVerified':False,
      'fullComplexArtworkSolved':False,
      'generatedByExistingWorkerNotBrowserApproximation':True,
      'nativeRepairPasses':report.get('nativePasses'),
    }
    (folder/'simple-motif-native-test-not-sewout.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence,indent=2))
    return evidence


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--engine',required=True,type=Path)
    parser.add_argument('--out',required=True,type=Path)
    args=parser.parse_args()
    run(args.engine,args.out)
