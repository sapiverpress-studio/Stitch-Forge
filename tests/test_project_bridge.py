"""Test actual 0.3 saved and ZIP project structures, using synthetic artwork."""
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from project_bridge import convert_project, convert_local_satin_project


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

    def test_local_satin_project_preserves_explicit_mixed_layer_order(self):
        geometry = {'accepted': True, 'machineApproved': False, 'geometryOnly': True,
                    'rungs': [{'left': [x, 0], 'right': [x, 12]} for x in range(6, 55, 6)]}
        p = {'schemaVersion': 1, 'width': 20, 'hoop': 80,
             'paths': [[[0, 0], [80, 0], [80, 60], [0, 60], [0, 0]]],
             'pathStyles': ['tatami'], 'pathColors': ['#112233'],
             'satinColumns': [{'geometry': geometry, 'threadColor': '#ED171F'}],
             'regionOrder': [{'type': 'satin', 'index': 0}, {'type': 'path', 'index': 0}]}
        svg = convert_local_satin_project(json.dumps(p).encode())
        root = ET.fromstring(svg)
        regions = [n for n in root if n.tag.rsplit('}', 1)[-1] in ('polygon', 'polyline', 'path')]
        self.assertEqual([n.attrib['id'] for n in regions], ['satin-0', 'region-0'])
        self.assertEqual(root.attrib['width'], '24.000mm')
        self.assertEqual(root.attrib['height'], '19.000mm')
        self.assertEqual(regions[0].attrib['stroke'], '#ED171F')

    def test_legacy_conversion_refuses_local_satin_schema(self):
        geometry = {'accepted': True, 'machineApproved': False, 'geometryOnly': True,
                    'rungs': [{'left': [x, 0], 'right': [x, 12]} for x in range(6, 55, 6)]}
        p = {'schemaVersion': 1, 'width': 20, 'hoop': 80,
             'paths': [[[0, 0], [80, 0], [80, 60], [0, 60], [0, 0]]],
             'satinColumns': [{'geometry': geometry}],
             'regionOrder': [{'type': 'path', 'index': 0}, {'type': 'satin', 'index': 0}]}
        with self.assertRaisesRegex(ValueError, 'Local satin schema'):
            convert_project(json.dumps(p).encode())

    def test_local_satin_order_must_be_complete_and_unique(self):
        geometry = {'accepted': True, 'machineApproved': False, 'geometryOnly': True,
                    'rungs': [{'left': [x, 0], 'right': [x, 12]} for x in range(6, 55, 6)]}
        p = {'schemaVersion': 1, 'width': 20, 'hoop': 80,
             'paths': [[[0, 0], [80, 0], [80, 60], [0, 60], [0, 0]]],
             'satinColumns': [{'geometry': geometry}],
             'regionOrder': [{'type': 'path', 'index': 0}, {'type': 'satin', 'index': 0}]}
        p['regionOrder'][1] = {'type': 'path', 'index': 0}
        with self.assertRaisesRegex(ValueError, 'Duplicate or out-of-range'):
            convert_local_satin_project(json.dumps(p).encode())
        p['regionOrder'] = [{'type': 'path', 'index': 0}]
        with self.assertRaisesRegex(ValueError, 'complete regionOrder'):
            convert_local_satin_project(json.dumps(p).encode())


if __name__ == '__main__':
    unittest.main()
