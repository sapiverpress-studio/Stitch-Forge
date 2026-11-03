"""Real source-identical PES/DST A/B: V2 verified PNG, coarse versus original-res plan.

Both variants use one verified source and original identity. Results are facts
about decoded source containment and preview-plan differences, NOT sew-out quality.
"""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_live_home_hybrid import native_acceptance


def compare(engine, folder, fixture):
    root=Path(folder);root.mkdir(parents=True,exist_ok=True)
    records=[]
    for label,hires,palette_refit in [('baseline',False,False),('fullres',True,False),('palette_only',False,True)]:
        result=native_acceptance(engine,root/label,fixture,
                                 full_original=True,high_res=hires,palette_refit=palette_refit)
        path=root/label/'md267-machine-report-NOT-APPROVED.json'
        report=json.loads(path.read_text())
        source=report['sourceBinding']
        native={x['format']:x for x in report['decoded']}
        if set(native)!={'pes','dst'}:
            raise RuntimeError('Missing independent native format')
        if any(x['needlePointsOutsideWorkingColour'] or
               x['needleSegmentsOutsideWorkingColour'] for x in native.values()):
            raise RuntimeError('Full-resolution plan failed independent native containment')
        if not source['originalSourceSha256Verified']:
            raise RuntimeError('Unbound original PNG')
        records.append({
            'variant':label,'fullHighResolutionTrial':hires,
            'originalPaletteRefitTrial':palette_refit,
            'paletteRefitSelected':bool(report['homeHybrid']['sourcePaletteRefit']['selectedByErrorAndPaletteGuard']),
            'sourceRequestId':result['sourceRequestId'],
            'sourceWorkingSha256':report['source']['sha256'],
            'sourceToReducedMeanAbsoluteRgb':source['sourceToReducedMeanAbsoluteRgb'],
            'sourcePixelDimensions':source['originalPixelDimensionsVerified'],
            'workingSourceDimensions':[report['source']['width'],report['source']['height']],
            'meanSourceToPaletteRGB':source['sourceMeanRgbDistance'],
            'workingPixelsBeyondRgb60':source['sourcePixelsBeyondRgb60'],
            'hybridWorkingParts':report['homeHybrid']['hybridWorkingParts'],
            'nativePaths':report['nativePaths'],
            'pesStitches':native['pes']['needleStitches'],
            'pesTrims':native['pes']['trims'],
            'pesJumps':native['pes']['jumps'],
            'maxNeedlesPerSquareMillimetre':native['pes']['maxNeedlesInOneMmSquare'],
            'unresolvedSmallDetailObjects':report['unresolvedObjects'],
            'machineApproved':False,
        })
    a,b,c=records
    for candidate in records[1:]:
        for k in ['sourceRequestId','sourceWorkingSha256','sourcePixelDimensions',
                  'workingSourceDimensions']:
            if a[k]!=candidate[k]:
                raise RuntimeError('Not a source-identical comparison: '+k)
    result={
        'schema':'stitch-forge-md270-original-source-segmentation-native-ab-v1',
        'fixture':fixture,'sourceIdentical':True,
        'realNativePESDSTAndIndependentContainmentPassed':True,
        'models':records,
        'highresMinusBaseline':{
            k:round(b[k]-a[k],3) for k in (
             'meanSourceToPaletteRGB','workingPixelsBeyondRgb60',
             'hybridWorkingParts','nativePaths','pesStitches','pesTrims',
             'pesJumps','unresolvedSmallDetailObjects')},
        'paletteOnlyMinusBaseline':{
            k:round(c[k]-a[k],3) for k in (
             'meanSourceToPaletteRGB','workingPixelsBeyondRgb60',
             'hybridWorkingParts','nativePaths','pesStitches','pesTrims',
             'pesJumps','unresolvedSmallDetailObjects')},
        'sourceStyleFidelityVisuallyValidated':False,
        'physicalSewoutVerified':False,
        'deployRecommendation':'HOLD'
    }
    (root/'md270-highres-native-ab-NOT-APPROVED.json').write_text(
        json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--engine',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--fixture',choices=['macaw','butterfly','rose'],required=True)
    a=parser.parse_args()
    compare(a.engine,a.output,a.fixture)
