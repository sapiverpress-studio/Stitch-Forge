#!/usr/bin/env python3
"""Real native output A/B for opt-in source-detail routing; not a sewout.

Reads a source-bound plan prepared from a licensed fixture and uses the same
Ink/Stitch/pyembroidery pipeline as the worker. No cloud or OpenAI calls.
A route improvement is NOT accepted merely because SVG pen-up math improves.
"""
import argparse
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/digitiser'))
from artwork_trial import run_trial, build_trial_svg, checked_masks


class ReleaseGateFailure(ValueError):
    pass


def compare_native(base, candidate, routing, *, minimum_coverage_retention=1.0):
    """Reject changes to source, native contour coverage or worsening trims."""
    if not isinstance(routing,dict) or routing.get('strategy')!='anchored_original_running_detail_reordering':
        raise ReleaseGateFailure('Routing policy not enabled')
    if routing.get('sourcePixelLedgerChanged') or routing.get('sourceDetailOmitted'):
        raise ReleaseGateFailure('Source detail was modified')
    if routing.get('nearConnectionsAfter',0)<routing.get('nearConnectionsBefore',0):
        raise ReleaseGateFailure('Close-path opportunities regressed')
    if routing.get('plannedPenUpProxyMm',float('inf'))>routing.get('baselinePenUpProxyMm',-1)+.0001:
        raise ReleaseGateFailure('Routing geometry regressed')
    for field in ('source','objectSummary','unresolvedObjects','unresolvedPixels','imageWidthMm'):
        if base.get(field)!=candidate.get(field):
            raise ReleaseGateFailure('Artwork source identity/detail changed: '+field)
    if base.get('nativePaths')!=candidate.get('nativePaths'):
        raise ReleaseGateFailure('Native path budget changed')
    a={r['format']:r for r in base['decoded']}
    z={r['format']:r for r in candidate['decoded']}
    if set(a)!=set(z) or set(a)!={'pes','dst'}:
        raise ReleaseGateFailure('Missing independently decoded native format')
    for fmt in sorted(a):
        old,new=a[fmt],z[fmt]
        for r in (old,new):
            if r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour']:
                raise ReleaseGateFailure(fmt+' source-colour containment failed')
        if new['requestedColourOrder']!=old['requestedColourOrder']:
            raise ReleaseGateFailure(fmt+' thread colour sequence changed')
        if new['trims']>old['trims']:
            raise ReleaseGateFailure(fmt+' actual decoded trims increased')
        if new['maxNeedlesInOneMmSquare']>old['maxNeedlesInOneMmSquare']:
            raise ReleaseGateFailure(fmt+' local needle density increased')
        if new['needleStitches']>old['needleStitches']*1.05:
            raise ReleaseGateFailure(fmt+' needle count increased over 5%')
        if new['maxNeedleMoveMm']>max(12,old['maxNeedleMoveMm']+.11):
            raise ReleaseGateFailure(fmt+' maximum needle move worsened')
        old_cover=old['coverageProxy']; new_cover=new['coverageProxy']
        if old_cover.keys()!=new_cover.keys():
            raise ReleaseGateFailure(fmt+' source-colour coverage keys changed')
        for colour,record in old_cover.items():
            oldnear=record['pixelsNearDecodedPath']
            newnear=new_cover[colour]['pixelsNearDecodedPath']
            if newnear+1e-8 < oldnear*minimum_coverage_retention:
                raise ReleaseGateFailure(fmt+' source proximity coverage decreased for '+colour)
    return {
        'status':'NATIVE_AB_STRUCTURAL_GATE_PASSED_NOT_SEWOUT_APPROVED',
        'machineEligible':False,'physicalQualityVerified':False,
        'routing':routing,
        'formats':{
            fmt:{'baselineTrims':a[fmt]['trims'],
                 'routedTrims':z[fmt]['trims'],
                 'baselineJumps':a[fmt]['jumps'],
                 'routedJumps':z[fmt]['jumps'],
                 'baselineNeedles':a[fmt]['needleStitches'],
                 'routedNeedles':z[fmt]['needleStitches']}
            for fmt in sorted(a)},
        'limitations':['No semantic feather/eye verification or sewn-texture evidence.',
                       'Release gate covers this fixture only, not the private Kingfisher.',
                       'Professional fabric sewout and owner approval are still required.']
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--plan',type=Path,required=True)
    p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args()
    plan=json.loads(args.plan.read_text())
    checked_masks(plan)
    args.out.mkdir(parents=True,exist_ok=True)
    baseline_dir=args.out/'baseline';routed_dir=args.out/'routed'
    # Prevent CI environment inheritance from invalidating the A/B.
    # Keep worker defaults and compaction identical in both branches.
    with patch.dict(os.environ,{'STITCH_FORGE_DETAIL_SAFE_ROUTING':'0',
                                 'STITCH_FORGE_BETA_COMPACT_RUNNING':'0'}):
        baseline=run_trial(plan,args.engine,baseline_dir,timeout_seconds=120,partition_fills=True)
    with patch.dict(os.environ,{'STITCH_FORGE_DETAIL_SAFE_ROUTING':'1',
                                 'STITCH_FORGE_BETA_COMPACT_RUNNING':'0'}):
        candidate=run_trial(plan,args.engine,routed_dir,timeout_seconds=120,partition_fills=True)
        _,manifest,_=build_trial_svg(plan,partition_fills=True)
    routing=manifest['regionConsolidation']['optionalSourceDetailRouting']
    try:
        result=compare_native(baseline,candidate,routing)
    except ReleaseGateFailure as error:
        result={'status':'NATIVE_AB_RELEASE_GATE_HOLD',
                'reason':str(error),'machineEligible':False,
                'routing':routing,'actualMetrics':{
                    fmt:{'baselineTrims':next(x for x in baseline['decoded'] if x['format']==fmt)['trims'],
                         'candidateTrims':next(x for x in candidate['decoded'] if x['format']==fmt)['trims']}
                    for fmt in ('pes','dst')}}
        (args.out/'native-ab-results.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
        raise SystemExit('HOLD: '+str(error))
    (args.out/'native-ab-results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
