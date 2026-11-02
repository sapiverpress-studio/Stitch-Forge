"""Source-grounded compact feature recovery contract (never machine approval)."""
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from compact_edge_recovery import recover_compact_details


def sample(mark=True):
    labels=np.zeros((80,80),dtype=np.uint8)
    fg=np.ones((80,80),dtype=bool)
    lab=np.full((80,80,3),(76.,0.,0.))
    rgb=np.full((80,80,3),.8)
    yy,xx=np.ogrid[:80,:80]
    eye=((yy-40)**2+(xx-40)**2<=6**2)
    if mark:
        lab[eye,0]=9
        rgb[eye]=.03
    centres=np.array([[76.,0.,0.],[9.,0.,0.]])
    return labels,lab,rgb,fg,centres


class BoundedRecoveryTests(unittest.TestCase):
    def test_bounded_eye_detail_retains_original_edges(self):
        original,lab,rgb,fg,centres=sample()
        recovered,record=recover_compact_details(original,lab,rgb,fg,centres,
                                                  [(1.,40,40,5.)])
        self.assertEqual(recovered[40,40],1)
        self.assertEqual(int((recovered!=original).sum()),record['changedPixels'])
        self.assertLessEqual(record['changedPixels'],180)
        self.assertTrue(record['acceptedSourceFeatures'])
        self.assertGreater(record['acceptedSourceFeatures'][0]['edgeRecallAfter'],.8)
        self.assertTrue(np.array_equal(recovered[:20],original[:20]))
        self.assertTrue(record['preservedForeground'])
        self.assertFalse(record['newThreadColoursCreated'])
        self.assertFalse(record['semanticFeatureIdentityVerified'])

    def test_no_synthetic_mark_on_uniform_source(self):
        original,lab,rgb,fg,centres=sample(mark=False)
        recovered,record=recover_compact_details(original,lab,rgb,fg,centres,
                                                  [(1.,40,40,5.)])
        np.testing.assert_array_equal(recovered,original)
        self.assertEqual(record['changedPixels'],0)
        self.assertEqual(record['acceptedSourceFeatures'],[])

    def test_background_and_thread_count_never_change(self):
        original,lab,rgb,fg,centres=sample()
        fg[:10]=False
        original[:10]=255
        recovered,record=recover_compact_details(original,lab,rgb,fg,centres,
                                                  [(1.,40,40,5.)])
        self.assertTrue(np.all(recovered[:10]==255))
        self.assertTrue(set(np.unique(recovered)).issubset({0,1,255}))
        self.assertEqual(record['nativeStitchQualityVerified'],False)

    def test_rejects_invalid_untrusted_parameters(self):
        original,lab,rgb,fg,centres=sample()
        with self.assertRaises(ValueError):
            recover_compact_details(original,lab,rgb,fg,centres,
                                    [(1.,-50,40,5.)])
        with self.assertRaises(ValueError):
            recover_compact_details(original,lab,rgb,fg,centres,
                                    [(1.,40,40,5.)],max_added_components=200)
        bad=original.copy()
        bad[0,0]=255
        with self.assertRaises(ValueError):
            recover_compact_details(bad,lab,rgb,fg,centres,[])


if __name__=='__main__':
    unittest.main()
