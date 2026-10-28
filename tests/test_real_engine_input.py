"""Ensure end-to-end engine smoke consumes live project geometry safely."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services' / 'digitiser'))
from real_engine_smoke import prepare_svg


class RealEngineProjectInputTests(unittest.TestCase):
    def test_no_project_uses_synthetic_fixture(self):
        svg = prepare_svg(None)
        self.assertIn(b'<polygon', svg)

    def test_actual_v03_browser_schema_can_reach_real_engine_input(self):
        payload = {'paths': [[[100,100],[200,100],[200,150],[100,150],[100,100]]],
                   'pathStyles': ['tatami'], 'settings': {'width': 78, 'sp': 2, 'hoop': 100},
                   'reference': 'data:image/png;base64,PRIVATE_ART'}
        with TemporaryDirectory() as temp:
            path = Path(temp, 'design_project.json')
            path.write_text(json.dumps(payload))
            svg = prepare_svg(path)
        self.assertIn(b'82.000mm', svg)
        self.assertNotIn(b'PRIVATE_ART', svg)

    def test_fails_closed_for_unsupported_bean_and_missing_file(self):
        with self.assertRaises(ValueError):
            prepare_svg(Path('/no/such/project.json'))
        with TemporaryDirectory() as temp:
            path = Path(temp, 'bad.json')
            path.write_text(json.dumps({'paths': [[[0,0],[90,90]]],
                                        'width': '78', 'pathStyles': ['bean']}))
            with self.assertRaises(ValueError):
                prepare_svg(path)


if __name__ == '__main__':
    unittest.main()
