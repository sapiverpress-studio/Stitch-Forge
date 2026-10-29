"""Trusted SVG builder safety tests; no external dependencies."""
from pathlib import Path
import math
import sys
import unittest
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from trusted_svg import Region, build_svg, smoke_svg


class TrustedSVGTests(unittest.TestCase):
    def test_synthetic_shapes_without_external_content(self):
        payload = smoke_svg()
        root = ET.fromstring(payload)
        tags = {el.tag.split('}')[-1] for el in root.iter()}
        self.assertEqual(tags, {'svg', 'metadata', 'inkstitch_svg_version', 'polygon', 'polyline'})
        ns = 'http://inkstitch.org/namespace'
        versions = root.findall(f'{{http://www.w3.org/2000/svg}}metadata/{{{ns}}}inkstitch_svg_version')
        self.assertEqual(len(versions), 1, 'exactly one engine schema marker')
        self.assertEqual(versions[0].text, '4', 'matches pinned Ink/Stitch 3.3.0 update.py')
        self.assertIn(b'width="80.000mm"', payload)
        self.assertNotIn(b'<image', payload)
        self.assertNotIn(b'href=', payload)

    def test_rejects_outside_geometry_and_unsupported_modes(self):
        samples = [
            (Region(((0, 0), (999, 2)), 'running'),),
            (Region(((0, 0), (10, 10)), 'fill'),),
            (Region(((0, 0), (10, 10)), 'satin'),),
            (Region(((0, 0), (10, 10)), 'running', '#123"><script'),),
            (Region(((0, 0), (math.nan, 10)), 'running'),),
        ]
        for sample in samples:
            with self.subTest(sample=sample), self.assertRaises(ValueError):
                build_svg(80, 80, sample)
        with self.assertRaises(ValueError):
            build_svg(0, 80, (Region(((0, 0), (5, 5)), 'running'),))
