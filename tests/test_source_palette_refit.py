"""Original PNG palette refit can improve source RGB without creating objects."""
import sys
import unittest
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from source_palette_refit import refit_palette_from_original


def setup():
    hi=np.empty((160,160,4),dtype=np.uint8)
    hi[:,:80]=[40,120,180,255]
    hi[:,80:]=[228,108,35,255]
    lo=np.asarray(Image.fromarray(hi,'RGBA').resize((80,80),Image.Resampling.LANCZOS),
                  dtype=np.uint8)
    labels=np.ones((80,80),dtype=np.uint8)
    labels[:,40:]=2
    pal=np.array([[65,145,195],[205,90,58]],dtype=np.uint8)
    return hi,lo,labels,pal


class OriginalPaletteFitTests(unittest.TestCase):
    def test_refit_improves_color_with_exact_same_stitch_masks(self):
        hi,lo,labels,pal=setup()
        before=labels.copy();source=hi.copy()
        out,metrics=refit_palette_from_original(hi,lo,labels,pal)
        self.assertTrue(metrics['selectedByErrorAndPaletteGuard'])
        self.assertLess(metrics['meanRgbDistanceSelected'],
                        metrics['meanRgbDistanceBefore'])
        self.assertEqual(len(out),len(pal))
        self.assertTrue(np.array_equal(labels,before))
        self.assertTrue(np.array_equal(hi,source))
        self.assertFalse(metrics['workingShapeGeometryChanged'])
        self.assertFalse(metrics['physicalSewoutVerified'])

    def test_rejects_colour_shift_too_large(self):
        hi,lo,labels,pal=setup()
        out,proof=refit_palette_from_original(hi,lo,labels,pal,max_colour_shift=10)
        self.assertFalse(proof['selectedByErrorAndPaletteGuard'])
        self.assertTrue(np.array_equal(out,pal))

    def test_errors_for_unbounded_or_malformed_input(self):
        hi,lo,labels,pal=setup()
        with self.assertRaises(ValueError):
            refit_palette_from_original(hi,lo,labels.astype(np.int32),pal)
        with self.assertRaises(ValueError):
            refit_palette_from_original(hi,lo,labels,np.array([[1,2,3]]))
        with self.assertRaises(ValueError):
            refit_palette_from_original(hi,lo,labels,[[999,2,3],[4,5,6]])

if __name__=='__main__':
    unittest.main()
