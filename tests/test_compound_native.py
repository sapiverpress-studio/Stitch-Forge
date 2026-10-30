"""Local source-extracted synthetic compound controls; not artwork/sew-out approval."""
from copy import deepcopy
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from xml.etree import ElementTree as ET
import pyembroidery

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'services/digitiser'))
from compound_native import prepare_compound_control, build_compound_control_svg, INK
from compound_acceptance import run_compound_acceptance, audit_pattern, segment_outside, allowed
from project_bridge import convert_project


def extracted(nested=False):
    command = ['node', str(ROOT/'tools/extract_compound_control.cjs')]
    if nested:
        command += ['', 'nested']
    return json.loads(subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True).stdout)


class CompoundNativeValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = extracted()

    def test_actual_source_extracted_hole_and_separate_piece_have_native_parameters(self):
        root = ET.fromstring(build_compound_control_svg(self.fixture))
        paths = [p for p in root if p.tag.endswith('path')]
        self.assertEqual(len(paths), 2)
        self.assertEqual([p.get('id') for p in paths], self.fixture['regionOrder'])
        self.assertEqual([p.get('d').count('M ') for p in paths], [2, 1])
        self.assertEqual(paths[0].get('fill-rule'), 'evenodd')
        self.assertEqual(paths[0].get(INK+'fill_method'), 'tatami_fill')
        self.assertEqual(paths[0].get(INK+'row_spacing_mm'), '0.600')
        self.assertEqual(paths[0].get(INK+'fill_underlay'), 'false')
        self.assertEqual(paths[0].get(INK+'pull_compensation_mm'), '0')
        self.assertIsNotNone(root.find('.//*[@id="source-frame-origin"]'))

    def test_nested_island_is_a_separate_object_not_an_extra_subpath_hole(self):
        root = ET.fromstring(build_compound_control_svg(extracted(nested=True)))
        paths = [p for p in root if p.tag.endswith('path')]
        self.assertEqual(len(paths), 2)
        self.assertEqual(sorted(p.get('d').count('M ') for p in paths), [1, 2])

    def test_explicit_settings_and_complete_unique_colour_layer_order_are_required(self):
        for order in [[], self.fixture['regionOrder'][:1], [self.fixture['regionOrder'][0]]*2,
                      ['missing', self.fixture['regionOrder'][1]], [True, False]]:
            project = deepcopy(self.fixture); project['regionOrder'] = order
            with self.subTest(order=order), self.assertRaises(ValueError):
                build_compound_control_svg(project)
        project = deepcopy(self.fixture); project['regionOrder'].reverse()
        root = ET.fromstring(build_compound_control_svg(project))
        self.assertEqual([p.get('fill') for p in root if p.tag.endswith('path')], ['#0A55A3', '#ED171F'])

    def test_invalid_physical_dimensions_and_excessive_density_are_refused(self):
        for width in [True, 0, 251, float('nan')]:
            project = deepcopy(self.fixture); project['imageWidthMm'] = width
            with self.subTest(width=width), self.assertRaises(ValueError):
                build_compound_control_svg(project)
        for key, value in [('angleDeg', 181), ('rowSpacingMm', .1), ('rowSpacingMm', 0),
                           ('maxStitchMm', 8), ('underlay', 1)]:
            project = deepcopy(self.fixture); project['settings'][key] = value
            with self.subTest(setting=(key, value)), self.assertRaises(ValueError):
                build_compound_control_svg(project)

    def test_self_intersection_outside_hole_narrow_and_quantisation_collapsed_geometry_block(self):
        red = next(i for i, r in enumerate(self.fixture['regions']) if r['holes'])
        bad_rings = [([[12,16],[124,112],[124,16],[12,112]], []),
                     ([[12,16],[124,16],[124,112],[12,112]], [[[0,0],[5,0],[5,5],[0,5]]]),
                     ([[12,16],[12.001,16],[12.001,112],[12,112]], []),
                     ([[12,16],[12.5,16],[12.5,112],[12,112]], [])]
        for outer, holes in bad_rings:
            project = deepcopy(self.fixture); project['regions'][red].update(outer=outer, holes=holes)
            with self.subTest(outer=outer), self.assertRaises(ValueError):
                build_compound_control_svg(project)

    def test_hole_crossing_is_detected_even_when_both_needle_endpoints_are_inside_fill(self):
        prepared = prepare_compound_control(self.fixture)
        red = next(r for r in prepared['regions'] if r['holes'])
        a, b = (15, 32), (55, 32)
        self.assertTrue(allowed(a, [red])); self.assertTrue(allowed(b, [red]))
        self.assertTrue(segment_outside(a, b, [red]))
        self.assertFalse(segment_outside((15,15), (55,15), [red]))

    def test_holes_below_decoding_resolution_are_refused_instead_of_filled(self):
        project = deepcopy(self.fixture)
        red = next(r for r in project['regions'] if r['holes'])
        red['holes'] = [[[50,50],[50.6,50],[50.6,50.6],[50,50.6]]]
        with self.assertRaisesRegex(ValueError, 'audit resolution'):
            build_compound_control_svg(project)

    def test_browser_draft_or_local_control_cannot_enter_legacy_hosted_bridge(self):
        with self.assertRaises(ValueError):
            convert_project(json.dumps(self.fixture).encode())
        for schema in ['stitch-forge-source-region-project-v1', 'stitch-forge-source-region-project-v2',
                       'stitch-forge-source-stitch-candidates-v1', 'stitch-forge-source-region-approximation-v1',
                       'stitch-forge-source-object-plan-v1','stitch-forge-local-texture-trial-v1']:
            legacy = {'paths':[[[10,10],[110,10],[110,110],[10,110],[10,10]]],
                      'pathStyles':['tatami'],'pathColors':['#ED171F'],'width':20,'hoop':100}
            self.assertIn(b'svg', convert_project(json.dumps(legacy).encode()))
            payload = {**legacy, 'schema':schema, 'machineEligible':True}
            with self.subTest(schema=schema), self.assertRaises(ValueError):
                build_compound_control_svg(payload)
            with self.subTest(legacy_schema=schema), self.assertRaisesRegex(ValueError, 'schemas are not legacy'):
                convert_project(json.dumps(payload).encode())

    def test_excessive_decoded_command_count_is_rejected_before_geometric_work(self):
        from types import SimpleNamespace
        pattern = SimpleNamespace(stitches=[[0,0,pyembroidery.STITCH]]*125001)
        with self.assertRaisesRegex(ValueError, 'command budget'):
            audit_pattern(pattern, prepare_compound_control(self.fixture), 'dst')


@unittest.skipUnless(os.environ.get('STITCH_FORGE_INKSTITCH'), 'local pinned Ink/Stitch binary required')
class RealCompoundAcceptanceTests(unittest.TestCase):
    def run_case(self, *, angle, underlay, nested=False, width=80):
        project = extracted(nested=nested)
        project['settings'].update(angleDeg=angle, underlay=underlay)
        project['imageWidthMm'] = width
        with tempfile.TemporaryDirectory(prefix='stitch-forge-compound-test-') as temp:
            report = run_compound_acceptance(project, os.environ['STITCH_FORGE_INKSTITCH'], temp)
            for decoded in report['decoded']:
                self.assertEqual(decoded['needlePointsOutsideSourceColour'], 0)
                self.assertEqual(decoded['needleSegmentsOutsideSourceColour'], 0)
                self.assertEqual(decoded['colourChanges'], 1)
                self.assertGreater(decoded['longStitchLengthAlignedWithin4DegFraction'], .5)
                self.assertAlmostEqual(decoded['medianDecodedRowGapMm'], .6, delta=.15)
                self.assertLessEqual(decoded['maxNeedleMoveMm'], 3.65)
            pes = next(f for f in report['decoded'] if f['format']=='pes')
            self.assertEqual(pes['decodedPalette'][:2], ['#ed171f', '#0a55a3'])
            pattern = pyembroidery.read_dst(BytesIO((Path(temp)/'actual.dst').read_bytes()))
            wrong_order = prepare_compound_control(project); wrong_order['regions'].reverse()
            with self.assertRaisesRegex(ValueError, 'Unsafe compound|colour'):
                audit_pattern(pattern, wrong_order, 'dst')
            pattern.stitches.pop()
            with self.assertRaisesRegex(ValueError, 'complete END'):
                audit_pattern(pattern, prepare_compound_control(project), 'dst')
        return report

    def test_horizontal_hole_and_disconnected_colour_region_real_files(self):
        self.run_case(angle=0, underlay=False)

    def test_diagonal_fill_direction_and_row_spacing_real_files(self):
        self.run_case(angle=37, underlay=False)

    def test_nested_island_vertical_underlay_and_resized_full_image_real_files(self):
        self.run_case(angle=90, underlay=True, nested=True, width=64)


if __name__ == '__main__':
    unittest.main()
