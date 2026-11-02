"""Source-grounded detail guard: never invent synthetic eye or circle pixels."""
import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from source_detail_guard import protect_candidates


class DetailGuardTests(unittest.TestCase):
    def test_no_dark_circle_painted_over_uniform_source(self):
        labels=np.zeros((48,48),dtype=np.uint8)
        foreground=np.ones((48,48),dtype=bool)
        lab=np.full((48,48,3),(36.,0.,0.))
        centres=np.array([[36.,0.,0.],[8.,0.,0.]])
        actual,report=protect_candidates(labels,lab,foreground,centres,
             [(1.0,24,24,5.0)])
        self.assertTrue(np.array_equal(actual,labels))
        self.assertEqual(report['sourceSupportedPixelsChanged'],0)
        self.assertFalse(report['syntheticDarkDisksCreated'])
        self.assertFalse(report['featureLikenessVerified'])

    def test_dark_source_mark_can_be_recovered_without_painting_entire_disk(self):
        labels=np.zeros((64,64),dtype=np.uint8)
        foreground=np.ones((64,64),dtype=bool)
        lab=np.full((64,64,3),(75.,0.,0.))
        lab[29:35,30:34,0]=13
        centres=np.array([[75.,0.,0.],[13.,0.,0.]])
        result,report=protect_candidates(labels,lab,foreground,centres,
            [(1.0,32,32,5.0)])
        self.assertGreater(report['sourceSupportedPixelsChanged'],0)
        self.assertLess(report['sourceSupportedPixelsChanged'],80)
        self.assertEqual(int((result==1).sum()),report['sourceSupportedPixelsChanged'])
        self.assertEqual(result[32,32],1)
        self.assertEqual(result[24,32],0)
        self.assertEqual(result[32,24],0)
        self.assertFalse(report['featureLikenessVerified'])
        self.assertLess(report['changedPixelColourErrorAfter'],report['changedPixelColourErrorBefore'])

    def test_background_and_source_palette_never_change(self):
        labels=np.full((64,64),255,dtype=np.uint8)
        foreground=np.zeros((64,64),dtype=bool)
        foreground[10:50,10:50]=True
        labels[foreground]=0
        lab=np.full((64,64,3),(60.,0.,0.))
        lab[29:35,30:34,0]=8
        centres=np.array([[60.,0.,0.],[8.,0.,0.]])
        result,report=protect_candidates(labels,lab,foreground,centres,
            [(1.0,32,32,5.0)])
        self.assertTrue(np.array_equal(result==255,~foreground))
        self.assertTrue(set(np.unique(result)).issubset({0,1,255}))
        self.assertLessEqual(report['sourceSupportedPixelsChanged'],640)

    def test_rejects_invalid_features_and_source_label_contract(self):
        labels=np.zeros((48,48),dtype=np.uint8)
        lab=np.zeros((48,48,3),dtype=float)
        fg=np.ones((48,48),dtype=bool)
        centres=np.array([[20.,0.,0.],[80.,0.,0.]])
        with self.assertRaises(ValueError):
            protect_candidates(labels,lab,fg,centres,[(1.,-1,2,4)])
        bad=labels.copy()
        bad[8,8]=255
        with self.assertRaises(ValueError):
            protect_candidates(bad,lab,fg,centres,[])


if __name__=='__main__':
    unittest.main()
