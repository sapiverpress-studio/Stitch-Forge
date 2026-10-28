"""Test actual 0.3 saved and ZIP project structures, using synthetic artwork."""
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from project_bridge import convert_project


class ProjectBridgeTests(unittest.TestCase):
    @staticmethod
    def project():
        return {'paths': [[[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]]],
                'pathStyles': ['tatami'], 'width': '78', 'hoop': '100',
                'stitch': '2', 'reference': 'data:image/png;base64,UNTRUSTED'}

    def test_real_browser_storage_format_and_no_embedded_image(self):
        svg = convert_project(json.dumps(self.project()).encode())
        self.assertIn(b'82.000mm', svg)  # 78 mm artwork + 2 mm each side
        self.assertIn(b'<polygon', svg)
        self.assertNotIn(b'UNTRUSTED', svg)
        self.assertNotIn(b'<image', svg)

    def test_actual_export_report_settings_have_priority(self):
        p = self.project()
        p.pop('width')
        p.update(settings={'width': 65, 'hoop': 100, 'sp': 2},
                 design_width_mm=60.4, design_height_mm=60.4)
        svg = convert_project(json.dumps(p).encode())
        self.assertIn(b'69.000mm', svg)  # requested width, not exported measured extent

    def test_aspect_ratio_preserved_and_boundary(self):
        p = self.project()
        p['paths'] = [[[100, 100], [200, 100], [200, 150], [100, 150], [100, 100]]]
        svg = convert_project(json.dumps(p).encode())
        root = ET.fromstring(svg)
        self.assertEqual(root.attrib['width'], '82.000mm')
        self.assertEqual(root.attrib['height'], '43.000mm')  # 78 x 0.5 + margins

    def test_unclosed_fill_refused(self):
        p = self.project()
        p['paths'][0].pop()
        with self.assertRaisesRegex(ValueError, 'explicitly closed'):
            convert_project(json.dumps(p).encode())

    def test_bean_stitch_refused(self):
        p = self.project()
        p['pathStyles'] = ['bean']
        with self.assertRaisesRegex(ValueError, 'unsupported'):
            convert_project(json.dumps(p).encode())

    def test_rejects_invalid_geometry_and_hoop(self):
        for bad in [b'not json', b'{"width":NaN}']:
            with self.assertRaises(ValueError): convert_project(bad)
        p = self.project(); p['paths'][0][0] = [999, 0]
        with self.assertRaises(ValueError): convert_project(json.dumps(p).encode())
        p = self.project(); p['hoop'] = '40'
        with self.assertRaisesRegex(ValueError, 'hoop margin'):
            convert_project(json.dumps(p).encode())

    def test_compact_realistic_fox_geometry(self):
        p = {'paths': [[[132,288],[161,215],[340,157],[488,338],[296,409],[132,288]],
                        [[162,219],[182,267],[207,296]]],
             'pathStyles': ['running','running'], 'width': '78', 'hoop': '100'}
        svg = convert_project(json.dumps(p).encode())
        root = ET.fromstring(svg)
        self.assertEqual(len([el for el in root if el.tag.rsplit('}',1)[-1] in ('polygon', 'polyline')]), 2)
        self.assertEqual(root.attrib['width'], '82.000mm')
        self.assertNotIn(b'NaN', svg)


if __name__ == '__main__':
    unittest.main()
