"""Source-bound real PES/DST native A/B for experimental contour fill.

Reuses the EXISTING worker, real Ink/Stitch and independent source colour audit.
No private images, no Netlify/Cloud Run deploy and no sew-out claims.
"""
import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_live_home_hybrid import native_acceptance


def compare(engine, out, fixture):
    folder=Path(out)
    folder.mkdir(parents=True,exist_ok=True)
    records=[]
    for name,enabled in [('baseline',False),('contour',True)]:
        os.environ['STITCH_FORGE_CONTOUR_FILL_TRIAL']='1' if enabled else '0'
        os.environ['STITCH_FORGE_OPTICAL_FILL_DIRECTION']='0'
        os.environ['STITCH_FORGE_DETAIL_SAFE_ROUTING']='0'
        os.environ['STITCH_FORGE_BETA_COMPACT_RUNNING']='0'
        dest=folder/name
        native_acceptance(engine,dest,None if fixture=='synthetic' else fixture)
        report=json.loads((dest/'md267-machine-report-NOT-APPROVED.json').read_text())
        decoded={a['format']:a for a in report['decoded']}
        if set(decoded)!={'pes','dst'} or (
                decoded['pes']['needleStitches']!=decoded['dst']['needleStitches']):
            raise RuntimeError('PES/DST native files failed independent agreement')
        if any(a['needlePointsOutsideWorkingColour'] or
               a['needleSegmentsOutsideWorkingColour'] for a in decoded.values()):
            raise RuntimeError('Native candidate left independently audited colour')
        trial=report['stitchPlanning']['sourceContourFillTrial']
        if trial['enabled'] is not enabled:
            raise RuntimeError('Contour flag was not propagated into real native SVG')
        row={'variant':name,'fixture':fixture,
             'sourceSha256':report['source']['sha256'],
             'sourceRequestId':report['requestId'],
             'workingParts':report['objectSummary']['workingParts'],
             'unresolvedObjects':report['unresolvedObjects'],
             'nativePaths':report['nativePaths'],
             'contourFillPaths':trial['selectedFillPaths'],
             'pesStitches':decoded['pes']['needleStitches'],
             'pesTrims':decoded['pes']['trims'],
             'pesJumps':decoded['pes']['jumps'],
             'peakNeedlesInMmSquare':decoded['pes']['maxNeedlesInOneMmSquare'],
             'machineApproved':report['machineEligible']}
        records.append(row)
    a,b=records
    for key in ['sourceSha256','sourceRequestId','workingParts','unresolvedObjects']:
        if a[key]!=b[key]:
            raise RuntimeError('Native comparison changed the source or small-detail ledger: '+key)
    summary={'schema':'MD-2.69-source-equivalent-contour-native-AB',
             'fixture':fixture,'nativePESDSTGeneratedAndSourceAudited':True,
             'sameSourceAndColourPlan':True,'results':records,
             'pesTrimReductionPercent':round(100*(a['pesTrims']-b['pesTrims'])/max(1,a['pesTrims']),2),
             'machineSewoutVerified':False,
             'recommendsDeployment':False}
    (folder/'contour-AB-NOT-APPROVED.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--engine',required=True)
    p.add_argument('--output',required=True)
    p.add_argument('--fixture',choices=['synthetic','macaw','rose','butterfly'],required=True)
    args=p.parse_args()
    print(json.dumps(compare(args.engine,args.output,args.fixture),indent=2))
