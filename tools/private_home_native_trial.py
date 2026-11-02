"""Private-source MD-2.66 Home native candidate trial. NO network, NO deploy.

The caller supplies a local source image and an already installed verified
Ink/Stitch executable. This is an engineering audit, not a machine-approved
product. Unapproved outputs stay in the caller's local output directory.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_packet import decode_packet
from artwork_trial import run_trial
from hybrid_packet_bridge import prepare_verified_packet
from hybrid_home import reconstruct


def run(source,engine,output,*,colours=9,width_mm=80,timeout=165):
    requested_source=Path(source).expanduser()
    requested_engine=Path(engine).expanduser()
    if not requested_source.is_file():
        raise ValueError('Private source image does not exist locally')
    if not requested_engine.is_file():
        raise ValueError('Verified local Ink/Stitch executable is required')
    source=requested_source.resolve(strict=True)
    engine=requested_engine.resolve(strict=True)
    output=Path(output).expanduser().resolve()
    if not source.is_file() or source.suffix.lower() not in {'.png','.jpg','.jpeg','.webp'}:
        raise ValueError('Expected private local PNG/JPG/WebP source')
    if source.stat().st_size>25_000_000:
        raise ValueError('Source image exceeds private offline budget')
    if not engine.is_file() or engine.is_symlink():
        raise ValueError('Already-installed trusted Ink/Stitch binary required')
    if output==source.parent or source==output or source in output.parents:
        raise ValueError('Choose a dedicated private output directory, not source directory')
    with Image.open(source) as original:
        original.load()
        packet,proof=prepare_verified_packet(original,colours=colours,visible_width_mm=width_mm)
        _,_,candidate=reconstruct(original,colours=colours,design_width_mm=width_mm)
    plan,meta,identity,binding=decode_packet(packet)
    if not binding['sourcePixelsVerified'] or not binding['foregroundIndependentlyVerified']:
        raise ValueError('Worker source identity/foreground binding failed')
    if identity!=proof['requestId'] or plan['summary']['workingParts']!=candidate['hybridComponents']:
        raise ValueError('Private Home reconstruction is stale or inconsistent')
    evidence={
        'schema':'md266-private-home-native-test-v1',
        'sourceFileSha256':sha256(source.read_bytes()).hexdigest(),
        'workerPacketRequestId':identity,
        'workingColourCount':len(meta['palette']),
        'sourceWorkingParts':plan['summary']['workingParts'],
        'featureEdgeRetention':candidate.get('featureEdgeRetention',{}),
        'sourceEdgeRecovery':candidate.get('sourceEdgeRecovery',{}),
        'acceptance':'HOLD_UNTIL_SOURCE_LIKENESS_NATIVE_AUDIT_AND_SEWOUT',
        'cloudBuildOrDeployment':False,
        'imageUploadedToRemote':False
    }
    output.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(output,0o700)  # Keep source-derived artwork local to owner
    # Standard source-bound, independently decoded *real* Ink/Stitch execution.
    # Fail closed on source-colour containment violations. No trial is approved.
    report=run_trial(plan,engine,output,timeout_seconds=timeout,partition_fills=True)
    bad=any(d['needlePointsOutsideWorkingColour'] or d['needleSegmentsOutsideWorkingColour']
            for d in report['decoded'])
    if bad or report['machineEligible'] is not False or report['physicalQualityVerified'] is not False:
        raise RuntimeError('Real native candidate did not pass existing containment/audit safety gate')
    evidence.update({
        'nativePESDSTExportPassed':True,
        'needleStitches':{r['format']:r['needleStitches'] for r in report['decoded']},
        'PEStrims':next(r['trims'] for r in report['decoded'] if r['format']=='pes'),
        'nativePaths':report['nativePaths'],
        'unresolvedSmallDetails':report['unresolvedObjects'],
        'nativeBlockers':report['blockers'],
        'machineApproved':False,
        'physicalSewoutVerified':False
    })
    (output/'PRIVATE-KINGFISHER-HOME-TEST-NOT-APPROVED.json').write_text(
        json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
    os.chmod(output/'PRIVATE-KINGFISHER-HOME-TEST-NOT-APPROVED.json',0o600)
    return evidence


if __name__=='__main__':
    ap=argparse.ArgumentParser(description='Private Home native trial; NEVER machine approved')
    ap.add_argument('--source',required=True)
    ap.add_argument('--engine',required=True)
    ap.add_argument('--output',required=True)
    ap.add_argument('--colours',type=int,default=9)
    ap.add_argument('--width-mm',type=float,default=80)
    args=ap.parse_args()
    print(json.dumps(run(args.source,args.engine,args.output,
                         colours=args.colours,width_mm=args.width_mm),indent=2))
