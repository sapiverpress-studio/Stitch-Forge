"""Unit checks for real native A/B decision logic, no Ink/Stitch required."""
import copy
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from bench_native_detail_routing_ab import compare_native,ReleaseGateFailure


def report(trims=15,coverage=50):
    data={'source':{'sha256':'s'},'objectSummary':{'sourcePixels':70},
          'unresolvedObjects':1,'unresolvedPixels':1,'imageWidthMm':80,'nativePaths':6,
          'decoded':[]}
    for fmt in ('pes','dst'):
        data['decoded'].append({
            'format':fmt,'trims':trims,'jumps':17,'needleStitches':1000,
            'maxNeedleMoveMm':3,'maxNeedlesInOneMmSquare':40,
            'needlePointsOutsideWorkingColour':0,'needleSegmentsOutsideWorkingColour':0,
            'requestedColourOrder':['#005588'],
            'coverageProxy':{'#005588':{'pixelsNearDecodedPath':coverage}}})
    return data


class NativeABReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.base=report()
        self.next=report(trims=14)
        self.routing={'strategy':'anchored_original_running_detail_reordering',
                      'sourcePixelLedgerChanged':False,'sourceDetailOmitted':False,
                      'nearConnectionsBefore':3,'nearConnectionsAfter':4,
                      'baselinePenUpProxyMm':100,'plannedPenUpProxyMm':90}
    def test_accept_real_trim_reduction_without_false_sewout_claim(self):
        r=compare_native(self.base,self.next,self.routing)
        self.assertFalse(r['machineEligible'])
        self.assertFalse(r['physicalQualityVerified'])
        self.assertEqual(r['formats']['pes']['routedTrims'],14)
    def test_reject_trims_or_colour_coverage_regression(self):
        for modify in [lambda a:a['decoded'][0].update(trims=16),
                       lambda a:a['decoded'][0]['coverageProxy']['#005588'].update(pixelsNearDecodedPath=49),
                       lambda a:a['decoded'][0].update(needlePointsOutsideWorkingColour=1),
                       lambda a:a['decoded'][1].update(maxNeedlesInOneMmSquare=41),
                       lambda a:a['decoded'][0].update(requestedColourOrder=['#FFFFFF']),
                       lambda a:a.update(unresolvedObjects=2),
                       lambda a:a.update(nativePaths=5)]:
            bad=copy.deepcopy(self.next)
            modify(bad)
            with self.assertRaises(ReleaseGateFailure):
                compare_native(self.base,bad,self.routing)
    def test_refuse_modified_routing_evidence(self):
        bad=dict(self.routing,sourceDetailOmitted=True)
        with self.assertRaises(ReleaseGateFailure):
            compare_native(self.base,self.next,bad)
if __name__=='__main__':unittest.main()
