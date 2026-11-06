"""True Ink/Stitch 3.3.0 original-provenance running-detail PES/DST A/B.

Synthetic source ONLY; this never asserts Kingfisher or fabric quality.
"""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'services'/'digitiser'),str(ROOT/'tests')]
from authenticated_running_detail import propose_authenticated_running_details
from artwork_trial import run_trial
from test_md276_authenticated_running import synthetic_source, explicit_two_colour_source_plan


def evaluate(engine,output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    fixture=output/'fixture';fixture.mkdir(parents=True,exist_ok=True)
    browser_plan,original,working,windows=synthetic_source(fixture)
    plan=explicit_two_colour_source_plan(browser_plan,working)
    windows[0]['color']='#122432'
    # This controlled A/B deliberately compares one coherent two-colour plan.
    # The separate unit test records that the existing ten-colour browser
    # proposal is too fragmented to accept the same contour safely.
    review=propose_authenticated_running_details(plan,original,working,windows)
    if review['candidateCount']!=1:
        raise RuntimeError('Exact original-source-supported running candidate missing')
    details={
        'originalPng':original,
        'workingRgba':working,
        'windows':windows,
        'selectedIds':[review['candidates'][0]['id']]
    }
    trials=[]
    for name,source in [('legacy',None),('verified_original_running',details)]:
        result=run_trial(plan,Path(engine),output/name,partition_fills=True,
                         timeout_seconds=110,staged_running_source=source)
        family=result['stitchPlanning']['sourceRunningDetailTrial']
        if family['enabled']!=(source is not None) or family['acceptedObjects']!=(1 if source else 0):
            raise RuntimeError('Native running family did not reflect original-source selection')
        formats={row['format']:row for row in result['decoded']}
        if set(formats)!={'pes','dst'}:
            raise RuntimeError('Missing native PES6/DST files')
        if formats['pes']['needleStitches']!=formats['dst']['needleStitches']:
            raise RuntimeError('Independent native PES and DST needle coordinates disagree')
        print(json.dumps({'phase':name,
            'native_colour_audit':{key:{
              'needlePointsOutsideWorkingColour':v['needlePointsOutsideWorkingColour'],
              'needleSegmentsOutsideWorkingColour':v['needleSegmentsOutsideWorkingColour'],
              'firstOutsideSegments':v.get('firstOutsideSegments',[])[:3]}
              for key,v in formats.items()}},indent=2),flush=True)
        if any(row['needlePointsOutsideWorkingColour'] or row['needleSegmentsOutsideWorkingColour']
               for row in formats.values()):
            raise RuntimeError(name+' genuine PES/DST violates original source-pixel colour containment')
        native=(output/name/'ENGINEERING-TRIAL-NOT-APPROVED.pes').read_bytes()
        trials.append({'mode':name,
                       'sourcePngSha256':plan['source']['sha256'],
                       'originalSourceSha256Verified':bool(source),
                       'authenticRunningObjects':family['acceptedObjects'],
                       'machinePES6Sha256':sha256(native).hexdigest(),
                       'pesNeedleStitches':formats['pes']['needleStitches'],
                       'pesTrims':formats['pes']['trims'],
                       'pesJumps':formats['pes']['jumps'],
                       'maxNeedlesPerMm2':formats['pes']['maxNeedlesInOneMmSquare'],
                       'outsideSourceColourPoints':formats['pes']['needlePointsOutsideWorkingColour'],
                       'outsideSourceColourSegments':formats['pes']['needleSegmentsOutsideWorkingColour'],
                       'machineApproved':False})
    a,b=trials
    if (a['sourcePngSha256']!=b['sourcePngSha256']
            or a['machinePES6Sha256']==b['machinePES6Sha256']
            or a['pesNeedleStitches']==b['pesNeedleStitches']):
        raise RuntimeError('Genuine native needle geometry did not change on the same source')
    report={'schema':'MD276-original-authenticated-running-native-AB-v1',
            'status':'SOURCE_AUDITED_GENUINE_PES6_DST_NOT_FABRIC_APPROVED',
            'sourceIdentical':True,
            'realNeedlePathsChanged':True,
            'originalPngBoundToExactWorkingPixels':True,
            'illustration':'synthetic-contrasting-eye-inside-colour-fill',
            'nativeStitchesValidForFabric':False,
            'kingfisherLikenessVerified':False,
            'sourceSemanticRecognitionVerified':False,
            'trials':trials}
    (output/'md276-native-running-AB-NOT-APPROVED.json').write_text(
        json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    evaluate(a.engine,a.output)
