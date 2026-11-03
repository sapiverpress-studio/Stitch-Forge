"""Actual full browser->worker PES/DST on licensed macaw and rose.

A real illustration can have zero eligible straight satin shapes; that
is NOT an engine failure or evidence that satin works for feather/eyes.
"""
from pathlib import Path
import json
import os
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_live_home_hybrid import native_acceptance


def verify(engine, destination):
    root=Path(destination);root.mkdir(parents=True,exist_ok=True)
    rows=[]
    for fixture in ('macaw','rose'):
        for kind,enabled in [('baseline',False),('satin_trial',True)]:
            os.environ['STITCH_FORGE_AUTO_SATIN_TRIAL']='1' if enabled else '0'
            out=root/fixture/kind
            native_acceptance(engine,out,fixture,full_original=True)
            report=json.loads((out/'md267-machine-report-NOT-APPROVED.json').read_text())
            satin=report['stitchPlanning']['sourceSatinTrial']
            if satin['enabled']!=enabled:
                raise RuntimeError('Satin mode not reflected by native report')
            decoded={x['format']:x for x in report['decoded']}
            if set(decoded)!={'pes','dst'} or any(
                r['needlePointsOutsideWorkingColour'] or
                r['needleSegmentsOutsideWorkingColour'] for r in decoded.values()
            ):
                raise RuntimeError('Real PES/DST containment failed')
            rows.append({
                'fixture':fixture,'mode':kind,
                'sourceSha256':report['source']['sha256'],
                'workingParts':report['objectSummary']['workingParts'],
                'acceptedSatinObjects':satin['acceptedObjects'],
                'nativePaths':report['nativePaths'],
                'pesNeedles':decoded['pes']['needleStitches'],
                'pesTrims':decoded['pes']['trims'],
                'pesJumps':decoded['pes']['jumps'],
                'unresolvedObjects':report['unresolvedObjects'],
                'machineSewoutVerified':False
            })
    for i in (0,2):
        a,b=rows[i:i+2]
        if a['sourceSha256']!=b['sourceSha256'] or a['workingParts']!=b['workingParts']:
            raise RuntimeError('Comparison changed real illustration source or working mask')
    report={'schema':'MD271-licensed-natural-art-auto-satin-native-ab-v1',
            'results':rows,'sourceContainmentValidated':True,
            'satinNotGuaranteedForComplexArt':True,
            'professionalLikenessVerified':False,
            'deployDecision':'HOLD'}
    (root/'md271-licensed-satin-AB-NOT-APPROVED.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return report


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument('--engine',required=True)
    p.add_argument('--output',required=True)
    a=p.parse_args()
    verify(a.engine,a.output)
