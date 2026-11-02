"""MD-2.66 regression: SVG precision must not turn clipped holes into self-intersections."""
from pathlib import Path
import sys
import unittest

from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import set_precision

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_trial import bounded_fill_parts


class NativeFillPrecisionTests(unittest.TestCase):
    def test_clipped_near_touching_hole_becomes_valid_notch(self):
        # A narrow legitimate strip (< SVG's 0.0001 mm output grid)
        # lies between this hole and the exterior. String formatting alone
        # closes the gap and emits invalid self-intersecting SVG contours.
        shape=Polygon([(0,0),(4,0),(4,4),(0,4)],
                      [[(3.5,1),(3.99999,1),(3.99999,2),(3.5,2)]])
        self.assertTrue(shape.is_valid)
        rounded_without_repair=Polygon(
            [(0,0),(4,0),(4,4),(0,4)],
            [[(3.5,1),(4,1),(4,2),(3.5,2)]])
        self.assertFalse(rounded_without_repair.is_valid)
        pieces=bounded_fill_parts(shape,scale=1)
        result=unary_union(pieces)
        self.assertTrue(result.is_valid)
        self.assertLess(result.symmetric_difference(shape).area,.001)
        self.assertAlmostEqual(result.area,15.5,places=3)
        self.assertTrue(all(p.is_valid for p in pieces))
        self.assertTrue(all(set_precision(p,.0001,mode='pointwise').is_valid for p in pieces))

    def test_unbounded_rounding_loss_is_rejected(self):
        # A sub-grid strip with substantial total coverage cannot be
        # silently discarded; it must produce HOLD, never a format pass.
        very_narrow=Polygon([(0,0),(200,0),(200,.00001),(0,.00001)])
        with self.assertRaisesRegex(ValueError,'rounding changed source'):
            bounded_fill_parts(very_narrow,scale=1)


if __name__=='__main__':
    unittest.main()
