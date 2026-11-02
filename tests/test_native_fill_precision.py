"""Regression: a rounded SVG fill notch must not produce off-colour stitches."""
from pathlib import Path
import re
import sys
import unittest
from shapely.geometry import Polygon

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from artwork_trial import safe_native_svg_fill_path


def parse_single_polygon(svg_d):
    rings=[]
    for segment in svg_d.split('Z'):
        values=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',segment)]
        if values:
            rings.append(list(zip(values[::2],values[1::2])))
    return Polygon(rings[0],rings[1:])


class NativeFillPrecisionTests(unittest.TestCase):
    def test_clipped_near_touching_hole_recovers_notch_without_fill_loss(self):
        border=[(0,0),(4,0),(4,4),(0,4)]
        holes=[[(3.5,1),(3.99999,1),(3.99999,2),(3.5,2)]]
        repaired=safe_native_svg_fill_path(border,holes,1,4)
        self.assertIsNotNone(repaired)
        polygon=parse_single_polygon(repaired)
        source=Polygon(border,holes)
        self.assertTrue(polygon.is_valid)
        self.assertLess(polygon.symmetric_difference(source).area,.001)
        self.assertAlmostEqual(polygon.area,15.5,places=3)

    def test_rounding_cannot_discard_visible_area(self):
        very_narrow=[(0,0),(200,0),(200,.00001),(0,.00001)]
        self.assertIsNone(safe_native_svg_fill_path(very_narrow,(),1,4))

    def test_valid_svg_contours_remain_unchanged(self):
        self.assertIsNone(safe_native_svg_fill_path(
            [(0,0),(4,0),(4,4),(0,4)],(),1,4))


if __name__=='__main__':
    unittest.main()
