"""Native Ink/Stitch CI acceptance smoke-test for SYNTHETIC Home artwork only.

This creates no deploy, no published product, no approved machine files.
The existing native engine + independent PES/DST audit must remain authoritative.
"""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import sys
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_packet import decode_packet
from artwork_trial import run_trial
from hybrid_packet_bridge import prepare_verified_packet


def synthetic_source():
    img=Image.new('RGBA',(232,200),(0,0,0,0))
    p=ImageDraw.Draw(img)
    p.ellipse((22,14,161,174), fill=(9,98,150,255))
    p.polygon([(40,117),(118,48),(111,165)],fill=(29,149,192,255))
    p.ellipse((80,54,158,145),fill=(238,121,19,255))
    p.ellipse((119,25,130,36),fill=(19,21,24,255))
    p.line([(5,185),(222,171)],fill=(103,71,37,255),width=9)
    p.ellipse((167,132,218,171),fill=(46,109,50,255))
    p.ellipse((176,138,215,158),fill=(75,143,67,255))
    return img


def verify(engine, destination):
    destination=Path(destination)
    destination.mkdir(parents=True,exist_ok=True)
    packet,proof=prepare_verified_packet(synthetic_source(),colours=8)
    plan,meta,identity,binding=decode_packet(packet)
    if identity!=proof['requestId'] or not binding['foregroundIndependentlyVerified']:
        raise RuntimeError('Hybrid source binding invalid')
    report=run_trial(plan,engine,destination,timeout_seconds=165,partition_fills=True)
    if (report['machineEligible'] is not False or report['physicalQualityVerified'] is not False
            or len(report['decoded']) != 2
            or {d['format'] for d in report['decoded']} != {'pes','dst'}
            or not report['nativePaths']
            or report['decoded'][0]['needleStitches'] < 3
            or any(d['needlePointsOutsideWorkingColour'] or
                   d['needleSegmentsOutsideWorkingColour'] for d in report['decoded'])):
        raise RuntimeError('Native output failed original worker source-containment acceptance')
    for extension in ('pes','dst'):
        path=destination/('ENGINEERING-TRIAL-NOT-APPROVED.'+extension)
        if not path.is_file() or path.stat().st_size < 515:
            raise RuntimeError('Missing independently audited native '+extension.upper())
    evidence={
        'schema':'md266-home-native-synthetic-ci-v1',
        'syntheticFixtureOnly':True,'inputPacketRequestId':identity,
        'sourceForegroundVerified':True,'homePaletteColours':proof['threadColourCount'],
        'sourceWorkingParts':plan['summary']['workingParts'],
        'nativePathCount':report['nativePaths'],
        'stitches':{d['format']:d['needleStitches'] for d in report['decoded']},
        'trims':{d['format']:d['trims'] for d in report['decoded']},
        'blockers':report['blockers'],
        'realPESDST':True,'physicalSewoutVerified':False,
        'kingfisherLikenessVerified':False,
        'approval':'SYNTHETIC_ENGINEERING_TRIAL_ONLY_NOT_MACHINE_APPROVED'
    }
    (destination/'hybrid-native-synthetic-evidence.json').write_text(
        json.dumps(evidence,indent=2)+'\n')
    return evidence


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--engine',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    print(json.dumps(verify(args.engine,args.output),indent=2))
