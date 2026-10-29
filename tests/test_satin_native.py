import sys
from pathlib import Path
import json
import unittest
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/digitiser"))
from satin_native import (SatinColumn, build_satin_svg, column_from_validated_pixel_rungs,
                          validate_column)

NS = {"svg": "http://www.w3.org/2000/svg", "ink": "http://inkstitch.org/namespace"}


def straight_column():
    left = ((10, 20), (30, 20), (50, 20), (70, 20))
    right = ((10, 24), (30, 24), (50, 24), (70, 24))
    rungs = tuple(((x, 20), (x, 24)) for x in (10, 30, 50, 70))
    return SatinColumn(left, right, rungs, "#CC2233", 0.4, 7.0)


class SatinNativeSvgTests(unittest.TestCase):
    def test_serializes_native_rails_rungs_and_controls(self):
        root = ET.fromstring(build_satin_svg(80, 60, (straight_column(),)))
        path = root.find("svg:path", NS)
        self.assertEqual(path.get("{http://inkstitch.org/namespace}satin_column"), "true")
        self.assertEqual(path.get("{http://inkstitch.org/namespace}satin_method"), "satin_column")
        self.assertEqual(path.get("{http://inkstitch.org/namespace}zigzag_spacing_mm"), "0.400")
        self.assertEqual(path.get("{http://inkstitch.org/namespace}max_stitch_length_mm"), "7.000")
        self.assertEqual(path.get("stroke"), "#CC2233")
        self.assertEqual(path.get("d").count("M "), 6)

    def test_reversed_rung_endpoint_order_is_supported(self):
        c = straight_column()
        reversed_rungs = tuple((b, a) for a, b in c.rungs)
        validate_column(SatinColumn(c.left, c.right, reversed_rungs), 80, 60)

    def test_browser_validated_pixel_rungs_keep_physical_scale_and_colour(self):
        fixture = Path(__file__).resolve().parent / "fixtures/satin_rails_validated_synthetic.json"
        source = json.loads(fixture.read_text(encoding="utf-8"))
        self.assertEqual(source["candidate"], "satin_candidate")
        c = column_from_validated_pixel_rungs(source["geometry"], source["mmPerPixel"],
                                               thread_color="#CC2233")
        self.assertEqual(c.left[0], (3.5, 2.0))
        self.assertEqual(c.right[-1], (15.5, 5.0))
        self.assertEqual(c.thread_color, "#CC2233")
        validate_column(c, *source["designBoundsMm"])

    def test_smooth_curved_column_geometry_passes(self):
        left = ((10, 20), (25, 20), (40, 24), (55, 30), (70, 38))
        right = ((10, 24), (25, 24), (40, 28), (55, 34), (70, 42))
        rungs = tuple((a, b) for a, b in zip(left, right))
        c = SatinColumn(left, right, rungs)
        validate_column(c, 80, 60)

    def test_dangling_rung_fails_closed(self):
        c = straight_column()
        bad = SatinColumn(c.left, c.right, c.rungs[:-1] + (((60, 21), (60, 23)),))
        with self.assertRaisesRegex(ValueError, "meet both rails"):
            build_satin_svg(80, 60, (bad,))

    def test_reversed_rails_fail_closed(self):
        c = straight_column()
        with self.assertRaises(ValueError):
            validate_column(SatinColumn(c.left, tuple(reversed(c.right)), c.rungs), 80, 60)

    def test_crossed_rails_fail_closed(self):
        left = ((10, 20), (30, 20), (50, 20), (70, 20))
        right = ((10, 24), (50, 24), (30, 24), (70, 24))
        rungs = tuple(((x, 20), (x, 24)) for x in (10, 30, 50, 70))
        with self.assertRaises(ValueError):
            validate_column(SatinColumn(left, right, rungs), 80, 60)

    def test_width_turn_length_bounds_are_enforced(self):
        c = straight_column()
        too_wide = SatinColumn(c.left, tuple((x, 26) for x, _ in c.right), c.rungs)
        with self.assertRaisesRegex(ValueError, "width"):
            validate_column(too_wide, 80, 60)
        with self.assertRaisesRegex(ValueError, "Maximum satin"):
            validate_column(SatinColumn(c.left, c.right, c.rungs, max_stitch_length_mm=1), 80, 60)

    def test_nonfinite_out_of_bounds_and_bad_colour_rejected(self):
        c = straight_column()
        bad = SatinColumn(((10, 20), (float("nan"), 20), (50, 20), (70, 20)), c.right, c.rungs)
        with self.assertRaisesRegex(ValueError, "finite"):
            validate_column(bad, 80, 60)
        with self.assertRaisesRegex(ValueError, "design width"):
            validate_column(c, float("inf"), 60)
        with self.assertRaisesRegex(ValueError, "colour"):
            validate_column(SatinColumn(c.left, c.right, c.rungs, "red"), 80, 60)


if __name__ == "__main__":
    unittest.main()
