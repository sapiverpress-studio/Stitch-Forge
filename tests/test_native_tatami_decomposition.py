"""Offline polygon geometry constraints for native fill sectioning."""
import sys
import unittest
from pathlib import Path
from shapely.geometry import Polygon,Point,box
from shapely.ops import unary_union
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from native_tatami_decomposition import decompose_tatami

class TatamiSections(unittest.TestCase):
    def test_long_fill_preserved(self):
        p=box(0,0,56,20)
        a=decompose_tatami(p,.25)
        self.assertTrue(2<=a['sectionCount']<=12)
        self.assertTrue(a['preservedFill'])
        self.assertFalse(a['physicalQualityVerified'])
        self.assertLess(unary_union(a['sections']).symmetric_difference(p).area,1e-7)
    def test_hole_never_filled(self):
        p=Polygon([(0,0),(65,0),(65,40),(0,40)],
            holes=[[(22,12),(43,12),(43,30),(22,30)]])
        a=decompose_tatami(p,.25)
        u=unary_union(a['sections'])
        self.assertLess(u.symmetric_difference(p).area,1e-7)
        self.assertFalse(u.covers(Point(30,20)))
    def test_concave_deterministic(self):
        p=Polygon([(0,0),(52,0),(52,6),(30,6),(30,17),(18,17),(18,6),(0,6)])
        a=decompose_tatami(p,.25);b=decompose_tatami(p,.25)
        self.assertEqual((a['sectionCount'],a['directionDeg']),(b['sectionCount'],b['directionDeg']))
        self.assertLess(unary_union(a['sections']).symmetric_difference(p).area,1e-7)
    def test_unsafe_refused(self):
        for p in (box(0,0,2,2),Polygon([(0,0),(5,5),(0,5),(5,0)])):
            with self.assertRaises(ValueError):decompose_tatami(p,.25)
        with self.assertRaises(ValueError):decompose_tatami(box(0,0,50,20),.25,max_sections=0)
if __name__=='__main__':unittest.main()
