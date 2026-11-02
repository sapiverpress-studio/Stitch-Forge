"""Native Ink/Stitch CI acceptance smoke-test for SYNTHETIC Home artwork only.

This creates no deploy, no published product, no approved machine files.
The existing native engine + independent PES/DST audit must remain authoritative.
"""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import sys
from hashlib import sha256
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_packet import decode_packet
from artwork_trial import run_trial
from hybrid_packet_bridge import prepare_verified_packet
from artwork_service import source_repair_candidates
from repair_policy import choose_source_preserving_repair


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


def licensed_fixture(name):
    if name not in {'macaw','butterfly','rose'}:
        raise ValueError('Unsupported licensed fixture')
    root=Path(__file__).resolve().parents[1]/'tests'/'fixtures'/'artwork-evaluation'
    manifest=json.loads((root/'manifest.json').read_text())
    record=next((i for i in manifest['samples'] if i['id']==name),None)
    if not record or record['licence']!='CC0-1.0':
        raise ValueError('Fixture must have a known CC0 source')
    image_file=root/record['raster_file']
    if sha256(image_file.read_bytes()).hexdigest()!=record['raster_sha256']:
        raise ValueError('Licensed fixture source hash mismatch')
    return Image.open(image_file).copy()


def verify(engine, destination, *, fixture=None):
    destination=Path(destination)
    destination.mkdir(parents=True,exist_ok=True)
    original=licensed_fixture(fixture) if fixture else synthetic_source()
    packet,proof=prepare_verified_packet(original,colours=9 if fixture else 8)
    plan,meta,identity,binding=decode_packet(packet)
    if identity!=proof['requestId'] or not binding['foregroundIndependentlyVerified']:
        raise RuntimeError('Hybrid source binding invalid')
    report=run_trial(plan,engine,destination,timeout_seconds=165,partition_fills=True)
    repair={'nativePasses':1,'sourcePreservingRepair':False,'repairMode':None,'repairObjectIds':[]}
    if any(d['needlePointsOutsideWorkingColour'] or
           d['needleSegmentsOutsideWorkingColour'] for d in report['decoded']):
        # Exactly the same bounded attribution and repair selection already
        # used by the production worker. No mask, palette or segment edits.
        # An exception means HOLD; we must never weaken source containment.
        (destination/'native-first-pass-containment-report.json').write_text(
            json.dumps(report,indent=2)+'\n')
        ids=source_repair_candidates(plan,report)
        mode=choose_source_preserving_repair(plan,ids)
        if mode not in {'sectioned_tatami','fill_preserving'}:
            raise RuntimeError('Unsupported source repair method')
        report=run_trial(plan,engine,destination,timeout_seconds=165,
             partition_fills=True,section_overrides=ids if mode=='sectioned_tatami' else (),
             fill_repair_overrides=ids if mode=='fill_preserving' else ())
        repair={'nativePasses':2,'sourcePreservingRepair':True,
                'repairMode':mode,'repairObjectIds':ids}
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
        'schema':'md266-home-native-isolated-ci-v2',
        'fixture':fixture or 'synthetic-bird',
        'syntheticFixtureOnly':fixture is None,
        'sourceArtworkClass':'CC0-vector-origin-raster' if fixture else 'generated-synthetic','inputPacketRequestId':identity,
        'sourceForegroundVerified':True,'homePaletteColours':proof['threadColourCount'],
        'sourceWorkingParts':plan['summary']['workingParts'],
        'nativeRepair':repair,
        'nativePathCount':report['nativePaths'],
        'stitches':{d['format']:d['needleStitches'] for d in report['decoded']},
        'trims':{d['format']:d['trims'] for d in report['decoded']},
        'blockers':report['blockers'],
        'realPESDST':True,'physicalSewoutVerified':False,
        'kingfisherLikenessVerified':False,
        'approval':'ISOLATED_ENGINEERING_TRIAL_ONLY_NOT_MACHINE_APPROVED'
    }
    (destination/'hybrid-native-synthetic-evidence.json').write_text(
        json.dumps(evidence,indent=2)+'\n')
    return evidence


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--engine',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--fixture',choices=['macaw','butterfly','rose'])
    args=parser.parse_args()
    print(json.dumps(verify(args.engine,args.output,fixture=args.fixture),indent=2))
