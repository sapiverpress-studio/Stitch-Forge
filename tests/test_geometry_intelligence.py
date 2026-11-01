"""Offline tests for geometry-aware direction and safe pen-up routing."""
import sys
import unittest
from pathlib import Path
from shapely import affinity
from shapely.geometry import box, Polygon, LineString
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from geometry_intelligence import shape_axis, order_open_routes, jump_distance_mm
from source_scanline_fill import plan_scanline_fill


class GeometryIntelligenceTests(unittest.TestCase):
    def test_rotated_long_shape_axis(self):
        poly=affinity.rotate(box(-40,-4,40,4),37)
        direction=shape_axis(poly,.25)
        self.assertIsNotNone(direction)
        self.assertLess(abs(direction['majorAxisDeg']-37),12)
        self.assertGreater(direction['axisConfidenceProxy'],.45)
        self.assertFalse(direction['semanticDirectionVerified'])

    def test_round_shape_has_no_invented_direction(self):
        self.assertIsNone(shape_axis(box(-10,-10,10,10).buffer(2),.25))

    def test_hole_excluded_from_axis_sampling(self):
        poly=Polygon([(0,0),(100,0),(100,30),(0,30)],
            holes=[[(35,8),(65,8),(65,22),(35,22)]])
        result=shape_axis(poly,.25)
        self.assertIsNotNone(result)
        self.assertFalse(result['semanticDirectionVerified'])

    def test_plotter_route_optimisation_preserves_original_track_geometry(self):
        routes=[[(0.,0.),(4.,0.)],[(90.,0.),(94.,0.)],
                [(10.,0.),(14.,0.)],[(20.,0.),(24.,0.)]]
        result,stats=order_open_routes(routes,.25)
        self.assertLess(stats['plannedPenUpMm'],stats['baselinePenUpMm'])
        self.assertTrue(stats['pathOrderOptimised'])
        self.assertEqual(
            sorted(tuple(sorted(tuple(pt) for pt in path)) for path in result),
            sorted(tuple(sorted(tuple(pt) for pt in path)) for path in routes))
        self.assertAlmostEqual(jump_distance_mm(result,.25),stats['plannedPenUpMm'],places=3)

    def test_hybrid_scanline_rejects_sewn_hole_crossings(self):
        poly=Polygon([(0,0),(40,0),(40,40),(0,40)],
            holes=[[(12,12),(28,12),(28,28),(12,28)]])
        old=plan_scanline_fill(poly,.25)
        new=plan_scanline_fill(poly,.25,adaptive=True)
        self.assertTrue(new['hybridPlanning'])
        self.assertLessEqual(new['routeCount'],old['routeCount'])
        self.assertGreaterEqual(new['interiorProxyFraction'],
                                old['interiorProxyFraction']-.02)
        self.assertLessEqual(jump_distance_mm(new['routes'],.25),
                             jump_distance_mm(old['routes'],.25)+1e-7)
        self.assertTrue(all(poly.covers(LineString(path)) for path in new['routes']))
        self.assertFalse(new['semanticDirectionVerified'])

    def test_bounded_configuration_and_single_track(self):
        with self.assertRaises(ValueError):
            shape_axis(Polygon([(0,0),(5,5),(0,5),(5,0)]),.25)
        with self.assertRaises(ValueError):
            order_open_routes([[(0,0)]],.25)
        routes,stats=order_open_routes([[(0,0),(2,2)]],.25)
        self.assertFalse(stats['pathOrderOptimised'])
        self.assertEqual(len(routes),1)


if __name__=='__main__':unittest.main()
