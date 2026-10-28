"""Browser-project bridge requires explicit geometry and refuses unsupported modes."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services' / 'digitiser'))
from project_bridge import convert_project


class ProjectBridgeTests(unittest.TestCase):
    def baseline(self):
        return {
            'design_width_mm': 80, 'design_height_mm': 50,
            'paths': [[[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]]],
            'pathStyles': ['tatami'], 'reference': 'data:image/png;base64,UNTRUSTED',
        }

    def test_preserves_regions_without_raster_reference(self):
        svg = convert_project(json.dumps(self.baseline()).encode())
        self.assertIn(b'80.000mm', svg)
        self.assertIn(b'polygon', svg)
        self.assertNotIn(b'UNTRUSTED', svg)
        self.assertNotIn(b'<image', svg)

    def test_refuses_unclosed_fill(self):
        project = self.baseline()
        project['paths'][0].pop()
        with self.assertRaisesRegex(ValueError, 'explicitly closed'):
            convert_project(json.dumps(project).encode())

    def test_refuses_unsupported_bean_stitch(self):
        project = self.baseline()
        project['pathStyles'] = ['bean']
        with self.assertRaisesRegex(ValueError, 'not supported'):
            convert_project(json.dumps(project).encode())

    def test_rejects_nonfinite_and_out_of_range_geometry(self):
        for bad in [b'{"design_width_mm":NaN}', b'not json']:
            with self.assertRaises(ValueError):
                convert_project(bad)
        project = self.baseline()
        project['paths'][0][0] = [999, 0]
        with self.assertRaises(ValueError):
            convert_project(json.dumps(project).encode())
