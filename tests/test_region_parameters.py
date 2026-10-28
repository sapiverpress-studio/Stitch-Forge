"""Per-region stitch settings must map to safe Ink/Stitch SVG attributes."""
import json
from pathlib import Path
import sys
import unittest
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from project_bridge import convert_project
from trusted_svg import smoke_svg

NS = '{http://inkstitch.org/namespace}'


def example():
    return {
        'width': '60', 'hoop': '100',
        'paths': [
            [[100,100],[230,100],[230,240],[100,240],[100,100]],
            [[125,190],[190,250]],
        ],
        'pathStyles': ['tatami', 'running'],
        'pathColors': ['#BD453A', '#257443'],
        'pathSettings': [
            {'fillAngleDeg': 30, 'rowSpacingMm': 0.55, 'fillUnderlay': True},
            {'runningLengthMm': 2.5},
        ],
        'reference': 'data:image/png;base64,PRIVATE_DATA',
    }


class RegionParametersTests(unittest.TestCase):
    def test_two_colors_and_stitch_parameters(self):
        svg = convert_project(json.dumps(example()).encode())
        root = ET.fromstring(svg)
        self.assertEqual(len(root), 2)
        self.assertEqual(root[0].attrib['fill'], '#BD453A')
        self.assertEqual(root[1].attrib['stroke'], '#257443')
        self.assertEqual(root[0].attrib[NS + 'angle'], '30.00')
        self.assertEqual(root[0].attrib[NS + 'row_spacing_mm'], '0.550')
        self.assertEqual(root[0].attrib[NS + 'fill_underlay'], 'true')
        self.assertEqual(root[1].attrib[NS + 'running_stitch_length_mm'], '2.500')
        self.assertNotIn(b'PRIVATE_DATA', svg)

    def test_existing_single_colour_projects_still_work(self):
        project = example()
        del project['pathColors'], project['pathSettings']
        self.assertIn(b'#153e46', convert_project(json.dumps(project).encode()))

    def test_bad_colours_or_parameters_are_rejected(self):
        changes = (
            lambda p: p.update(pathColors=['#123', '#000000']),
            lambda p: p.update(pathColors=['#112233']),
            lambda p: p.update(pathSettings=[{'unsupported': 'value'}, {}]),
            lambda p: p.update(pathSettings=[{'rowSpacingMm': 0.05}, {}]),
            lambda p: p.update(pathSettings=[{'fillAngleDeg': 'oops'}, {}]),
            lambda p: p.update(pathSettings=[{'fillUnderlay': 1}, {}]),
            lambda p: p.update(pathSettings=[{'runningLengthMm': 2.0}, {}]),
            lambda p: p.update(pathSettings=[{}, {'fillUnderlay': True}]),
        )
        for modify in changes:
            project = example()
            modify(project)
            with self.subTest(project=project), self.assertRaises(ValueError):
                convert_project(json.dumps(project).encode())

    def test_two_colour_synthetic_engine_fixture(self):
        root = ET.fromstring(smoke_svg())
        self.assertNotEqual(root[0].attrib['fill'], root[1].attrib['stroke'])
        self.assertEqual(root[0].attrib[NS + 'fill_underlay'], 'true')


if __name__ == '__main__':
    unittest.main()
