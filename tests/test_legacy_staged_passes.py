"""No machine required; verifies that independent inspection passes do not alter source."""
import sys
import unittest
from dataclasses import replace
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "digitiser"))
from legacy_staged_passes import split_legacy_svg, verify_legacy_stages

INK = '{http://inkstitch.org/namespace}'


def example(satin=True):
    root = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'width': '80mm', 'height': '80mm'})
    ET.SubElement(root, 'metadata')
    ET.SubElement(root, 'defs')
    ET.SubElement(root, 'path', {'id': 'f1', 'd': 'M 1,1 L 10,1 L 10,10 Z',
                                'fill': '#112233', 'stroke': 'none', INK+'fill_underlay': 'true'})
    ET.SubElement(root, 'path', {'id': 'r1', 'd': 'M 1,1 L 10,10',
                                'fill': 'none', 'stroke': '#112233'})
    if satin:
        ET.SubElement(root, 'path', {'id': 's1', 'd': 'M 2,2 L 4,4', 'fill': 'none',
                                    'stroke': '#112233', INK+'satin_column': 'true',
                                    INK+'satin_method': 'satin_column'})
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


class LegacyStagedPassTests(unittest.TestCase):
    def test_preserves_original_and_underlay(self):
        source = example()
        staged = split_legacy_svg(source)
        self.assertEqual(source, staged.native_svg)
        self.assertEqual(staged.manifest['counts'], {'tatami': 1, 'satin': 1, 'running': 1})
        self.assertTrue(staged.manifest['objects'][0]['underlay'])
        self.assertFalse(staged.manifest['geometryChanged'])
        self.assertFalse(staged.manifest['stitchObjectOrderChanged'])
        for stage in ('tatami', 'satin', 'running'):
            self.assertEqual(sum(node.tag.endswith('path') for node in ET.fromstring(staged.stage_svgs[stage])), 1)

    def test_zero_satin_not_invented(self):
        staged = split_legacy_svg(example(satin=False))
        self.assertEqual(staged.manifest['counts']['satin'], 0)
        self.assertEqual(sum(node.tag.endswith('path') for node in ET.fromstring(staged.stage_svgs['satin'])), 0)

    def test_changed_stage_rejected(self):
        staged = split_legacy_svg(example())
        tampered = dict(staged.stage_svgs)
        tampered['tatami'] = tampered['tatami'].replace(b'#112233', b'#AA2233')
        with self.assertRaisesRegex(ValueError, 'differ'):
            verify_legacy_stages(replace(staged, stage_svgs=tampered))

    def test_missing_object_rejected(self):
        staged = split_legacy_svg(example())
        tampered = dict(staged.stage_svgs)
        root = ET.fromstring(tampered['running'])
        for node in list(root):
            if node.tag.endswith('path'):
                root.remove(node)
        tampered['running'] = ET.tostring(root, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'differ'):
            verify_legacy_stages(replace(staged, stage_svgs=tampered))

    def test_duplicate_native_ids_rejected(self):
        source = example().replace(b'id="r1"', b'id="f1"')
        with self.assertRaisesRegex(ValueError, 'duplicated'):
            split_legacy_svg(source)

    def test_mixed_fill_stroke_rejected(self):
        source = example().replace(b'fill="none" stroke="#112233"', b'fill="#112233" stroke="#112233"')
        with self.assertRaisesRegex(ValueError, 'Unsupported or mixed'):
            split_legacy_svg(source)


if __name__ == '__main__':
    unittest.main()
