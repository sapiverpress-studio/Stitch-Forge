"""Conservative opt-in directional fill must follow genuine source texture."""
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from source_stitch_orientation import texture_fill_candidates

def patterned_image(flat=False):
    h=w=180
    yy,xx=np.indices((h,w))
    rgba=np.zeros((h,w,4),np.uint8)
    rgba[20:160,20:160,3]=255
    if flat: gray=np.full((h,w),110,np.uint8)
    else:
        # Real coherent stripes; no inferred animal/feather anatomy.
        gray=np.where(((xx+yy)//7)%2,215,40).astype(np.uint8)
    rgba[:,:,:3]=gray[:,:,None]
    labels=np.where(rgba[:,:,3]>0,1,0).astype(np.uint8)
    return rgba,labels

class SourceOpticalAngleTests(unittest.TestCase):
    def test_clear_diagonal_source_stripes_generate_bounded_angle(self):
        rgba,labels=patterned_image()
        old=rgba.copy();previous=labels.copy()
        found=texture_fill_candidates(rgba,labels,['#123456'],mm_per_pixel=.25)
        self.assertIn('123456-0',found)
        candidate=found['123456-0']
        self.assertIn(candidate['angleDeg'],range(0,180,15))
        self.assertGreaterEqual(candidate['gradientCoherence'],.72)
        self.assertGreaterEqual(candidate['interiorPixels'],55)
        self.assertEqual(candidate['method'],'bounded_interior_source_luminance_texture')
        self.assertTrue(np.array_equal(rgba,old))
        self.assertTrue(np.array_equal(labels,previous))

    def test_uniform_colour_and_no_interior_texture_reject(self):
        rgba,labels=patterned_image(flat=True)
        self.assertEqual(texture_fill_candidates(rgba,labels,['#123456'],
                         mm_per_pixel=.25),{})

    def test_small_and_ambiguous_source_uses_existing_geometric_fill(self):
        rgba,labels=patterned_image()
        labels[:]=0
        labels[75:84,75:84]=1
        self.assertEqual(texture_fill_candidates(rgba,labels,['#123456'],
                         mm_per_pixel=.25),{})

    def test_invalid_palette_and_source_geometry_fail_closed(self):
        rgba,labels=patterned_image()
        with self.assertRaises(ValueError):
            texture_fill_candidates(rgba,labels,['#12345Z'],mm_per_pixel=.25)
        with self.assertRaises(ValueError):
            texture_fill_candidates(rgba,labels,['#123456'],mm_per_pixel=0)
        with self.assertRaises(ValueError):
            texture_fill_candidates(rgba,labels[:20],['#123456'],mm_per_pixel=.25)

if __name__=='__main__': unittest.main()
