"""Compare real native PES/DST across ONE exact licensed input (MD-2.68).

No machine/purchase/deployment claim. Source SHA and source-colour containment
must match in every variant; the output is an evidence report, not sellable art.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from verify_live_home_hybrid import native_acceptance

VARIANTS = (
    ('baseline',False,False,False),
    ('optical',True,False,False),
    ('routing',False,True,True),
    ('optical_and_routing',True,True,True),
)

def compare(engine,destination,fixture):
    if fixture not in ('macaw','butterfly','rose','synthetic'):
        raise ValueError('Comparison requires known licensed/synthetic source')
    root=Path(destination);root.mkdir(parents=True,exist_ok=True)
    records=[]
    for name,optical,route,compact in VARIANTS:
        # Ensure same exact original artwork, palette, size and actual worker
        # even when the environment has other experimental flags.
        os.environ['STITCH_FORGE_OPTICAL_FILL_DIRECTION']='1' if optical else '0'
        os.environ['STITCH_FORGE_DETAIL_SAFE_ROUTING']='1' if route else '0'
        os.environ['STITCH_FORGE_BETA_COMPACT_RUNNING']='1' if compact else '0'
        folder=root/name
        evidence=native_acceptance(engine,folder,None if fixture=='synthetic' else fixture)
        report=json.loads((folder/'md267-machine-report-NOT-APPROVED.json').read_text())
        decoded={r['format']:r for r in report['decoded']}
        if set(decoded)!={'pes','dst'} or any(r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour'] for r in decoded.values()):
            raise RuntimeError('Native PES/DST source audit did not pass')
        optical_check=report['stitchPlanning']['sourceOpticalFillDirectionAudit']
        record={
            'variant':name,'fixture':fixture,
            'sourceSha256':report['source']['sha256'],
            'requestId':report['requestId'],
            'sourcePixels':report['objectSummary']['sourcePixels'],
            'workingParts':report['objectSummary']['workingParts'],
            'sourceMeanRgbDistance':report['sourceBinding']['sourceMeanRgbDistance'],
            'nativePaths':report['nativePaths'],
            'pesNeedles':decoded['pes']['needleStitches'],
            'dstNeedles':decoded['dst']['needleStitches'],
            'pesTrims':decoded['pes']['trims'],
            'dstTrims':decoded['dst']['trims'],
            'pesJumps':decoded['pes']['jumps'],
            'dstJumps':decoded['dst']['jumps'],
            'maxNeedlesInMmSquare':decoded['pes']['maxNeedlesInOneMmSquare'],
            'unresolvedObjects':report['unresolvedObjects'],
            'unresolvedPixels':report['unresolvedPixels'],
            'sourceOpticalCandidates':optical_check['proposals'],
            'sourceOpticalApplied':optical_check['appliedComponents'],
            'nativeSourceContainmentPassed':True,
            'machineApproved':report['machineEligible'],
        }
        records.append(record)
    baseline=records[0]
    for record in records[1:]:
        for k in ('sourceSha256','requestId','sourcePixels','workingParts',
                  'sourceMeanRgbDistance','unresolvedObjects','unresolvedPixels'):
            if record[k]!=baseline[k]:
                raise RuntimeError('Variant changes original source, palette or unresolved details: '+k)
        if record['pesNeedles']!=record['dstNeedles']:
            raise RuntimeError('Real PES and DST stitches diverged')
        if record['pesNeedles']>baseline['pesNeedles']*1.15:
            record['maxNeedleIncreaseGate']='FAIL_more_than_15_percent'
        else:
            record['maxNeedleIncreaseGate']='PASS'
        record['pesTrimReductionPercent']=round(100*(baseline['pesTrims']-record['pesTrims'])/max(1,baseline['pesTrims']),2)
        record['pesJumpReductionPercent']=round(100*(baseline['pesJumps']-record['pesJumps'])/max(1,baseline['pesJumps']),2)
        record['sourceDetailScore']='NOT_MEASURED_BY_MACHINE_TRIMS'
    result={
        'schema':'md268-real-native-A-B-quality-screen-v1',
        'fixture':fixture,
        'status':'ENGINEERING_A_B_ONLY_NOT_PHYSICALLY_STITCHED',
        'originalSourcePreserved':True,
        'originalSourceBytesPublished':False,
        'variants':records,
        'recommendedRelease':'HOLD_without_source_likeness_and_sewout',
    }
    (root/'MD268-COMPARE-NOT-APPROVED.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--engine',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--fixture',choices=['macaw','butterfly','rose','synthetic'],required=True)
    a=parser.parse_args()
    res=compare(a.engine,a.output,a.fixture)
    print(json.dumps(res,indent=2))
