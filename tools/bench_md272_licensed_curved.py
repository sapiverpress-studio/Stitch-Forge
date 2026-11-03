"""Licensed detailed-art two-phase native A/B for source-curved satin trial.

A pass with zero accepted objects is a correct negative, not quality success.
"""
import json
import os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_live_home_hybrid import native_acceptance


def compare(engine,output):
    root=Path(output);root.mkdir(parents=True,exist_ok=True)
    comparisons=[]
    for fixture in ('macaw','rose'):
        for mode,enabled in (('baseline',False),('curved_trial',True)):
            os.environ['STITCH_FORGE_CURVED_SATIN_TRIAL']='1' if enabled else '0'
            os.environ['STITCH_FORGE_AUTO_SATIN_TRIAL']='0'
            out=root/fixture/mode
            native_acceptance(engine,out,fixture,full_original=True)
            report=json.loads((out/'md267-machine-report-NOT-APPROVED.json').read_text())
            trial=report['stitchPlanning']['sourceCurvedSatinTrial']
            native={x['format']:x for x in report['decoded']}
            if (trial['enabled'] != enabled or set(native)!={'pes','dst'}
                    or native['pes']['needleStitches']!=native['dst']['needleStitches']
                    or any(x['needlePointsOutsideWorkingColour'] or
                           x['needleSegmentsOutsideWorkingColour'] for x in native.values())):
                raise RuntimeError('Real licensed artwork native acceptance failure')
            comparisons.append({
                'fixture':fixture,'variant':mode,
                'originalRequestId':report['requestId'],
                'originalSourceSha256':report['source']['sha256'],
                'originalSourcePngBound':report['sourceBinding']['originalSourceSha256Verified'],
                'acceptedCurvedSatinObjects':trial['acceptedObjects'],
                'nativePaths':report['nativePaths'],
                'pesStitches':native['pes']['needleStitches'],
                'pesTrims':native['pes']['trims'],
                'pesJumps':native['pes']['jumps'],
                'unresolvedObjects':report['unresolvedObjects'],
                'sourceContainmentPassed':True,
                'machineApproved':False
            })
    for index in (0,2):
        old,new=comparisons[index:index+2]
        for field in ('originalRequestId','originalSourceSha256'):
            if old[field]!=new[field]:
                raise RuntimeError('Source identity mutated: '+field)
    summary={'schema':'MD272-licensed-curved-satin-native-AB-v1',
             'sourceIdenticalAndRealPESDSTValidated':True,
             'results':comparisons,
             'professionalQualityDemonstrated':False,
             'physicalSewoutVerified':False,
             'recommendsDeployment':False}
    (root/'md272-licensed-curved-AB-NOT-APPROVED.json').write_text(
        json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
    return summary

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument('--engine',required=True)
    ap.add_argument('--output',required=True)
    x=ap.parse_args()
    compare(x.engine,x.output)
