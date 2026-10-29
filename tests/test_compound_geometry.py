"""Synthetic-only topology gates; NO Ink/Stitch or machine validation."""
import math
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from compound_geometry import validate_compound, evenodd_path

OUTER = [(2, 2), (18, 2), (18, 18), (2, 18)]
HOLE = [(7, 7), (13, 7), (13, 13), (7, 13)]

class CompoundTopologyTests(unittest.TestCase):
    def test_donut_and_orientation_independence(self):
        outer, holes = validate_compound(OUTER + [OUTER[0]], [HOLE], 20, 20)
        self.assertEqual(len(outer), 4)
        self.assertEqual(len(holes), 1)
        self.assertEqual(len(validate_compound(OUTER[::-1], [HOLE[::-1]], 20, 20)[1]), 1)
        d = evenodd_path(OUTER, [HOLE], 20, 20)
        self.assertEqual(d.count('M '), 2)
        self.assertEqual(d.count(' Z'), 2)
        self.assertNotIn('<', d)
    def test_multiple_disjoint_holes(self):
        holes = [[(4, 4), (6, 4), (6, 6), (4, 6)],
                 [(14, 14), (16, 14), (16, 16), (14, 16)]]
        self.assertEqual(len(validate_compound(OUTER, holes, 20, 20)[1]), 2)
    def test_refuses_unsafe_hole_topology(self):
        cases = [
            [[(22, 7), (24, 7), (24, 12), (22, 12)]],
            [[(2, 7), (6, 7), (6, 12), (2, 12)]],
            [[(16, 7), (20, 7), (20, 12), (16, 12)]],
            [HOLE, [(9, 9), (10, 9), (10, 10), (9, 10)]],
            [HOLE, [(12, 12), (16, 12), (16, 16), (12, 16)]],
            [[(4, 4), (15, 15), (4, 15), (15, 4)]],
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_compound(OUTER, case, 30, 30)
    def test_refuses_malformed_rings_and_loss_at_export_precision(self):
        cases = [
            [(2, 2), (18, 2), (18, 18), (18, 2), (2, 18)],
            [(2, 2), (18, 18), (2, 18), (18, 2)],
            [(2, 2), (18, 2), (18, 2.0004), (18, 18), (2, 18)],
            [(2, 2), (math.nan, 2), (18, 18), (2, 18)],
            [(2, 2), (math.inf, 2), (18, 18), (2, 18)],
            [(2, 2), (18, True), (18, 18), (2, 18)],
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_compound(case, [], 30, 30)
    def test_rejects_holes_budget_and_invalid_design_size(self):
        with self.assertRaises(ValueError): validate_compound(OUTER, [HOLE] * 17, 30, 30)
        with self.assertRaises(ValueError): validate_compound(OUTER, [], True, 30)
        with self.assertRaises(ValueError): validate_compound(OUTER, [], 500, 30)
    def test_hole_not_reinterpreted_as_white_thread(self):
        d = evenodd_path(OUTER, [HOLE], 20, 20)
        self.assertNotIn('fill=', d)
        self.assertNotIn('stroke=', d)
        self.assertNotIn('#FFFFFF', d)

if __name__ == '__main__': unittest.main()
