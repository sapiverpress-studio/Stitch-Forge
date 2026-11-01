"""Fast, offline numerical tests for source-aware scanline fill planning."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from shapely.geometry import box, Polygon, LineString
from source_scanline_fill import plan_scanline_fill


class SourceAwareScanlineTests(unittest.TestCase):
    def test_convex_fill_has_tracks_and_no_edge_crossing(self):
        region=box(0,0,40,16)
        candidate=plan_scanline_fill(region,.25)
        self.assertGreater(candidate['interiorProxyFraction'],.7)
        self.assertLessEqual(candidate['routeCount'],120)
        self.assertFalse(candidate['physicalQualityVerified'])
        for path in candidate['routes']:
            self.assertTrue(region.covers(LineString(path)))

    def test_holes_must_never_receive_sewn_connections(self):
        region=Polygon([(0,0),(40,0),(40,40),(0,40)],
            holes=[[(12,12),(28,12),(28,28),(12,28)]])
        candidate=plan_scanline_fill(region,.25)
        self.assertGreater(candidate['interiorProxyFraction'],.7)
        for path in candidate['routes']:
            self.assertTrue(region.covers(LineString(path)))
            self.assertFalse(LineString(path).intersects(box(12.1,12.1,27.9,27.9)))

    def test_organic_wing_like_polygon_and_determinism(self):
        region=Polygon([(0,0),(40,0),(60,2),(55,5),
            (35,6),(25,10),(10,12),(3,7)])
        a=plan_scanline_fill(region,.25)
        b=plan_scanline_fill(region,.25)
        self.assertEqual(a,b)
        self.assertGreater(a['interiorProxyFraction'],.7)

    def test_undersized_or_unsafe_configuration_rejected(self):
        for poly in [box(0,0,.5,.5),Polygon([(0,0),(10,10),(0,10),(10,0)])]:
            with self.assertRaises(ValueError):
                plan_scanline_fill(poly,.25)
        with self.assertRaises(ValueError):
            plan_scanline_fill(box(0,0,40,16),.25,row_spacing_mm=2)
        with self.assertRaises(ValueError):
            plan_scanline_fill(box(0,0,40,16),.25,max_routes=500)


if __name__=='__main__':
    unittest.main()
