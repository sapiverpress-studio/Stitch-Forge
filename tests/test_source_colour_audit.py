"""Offline, synthetic-only regression tests for source-colour analysis."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import numpy as np
import cairosvg
from PIL import Image

spec = importlib.util.spec_from_file_location(
    'forge', str(Path(__file__).resolve().parents[1] / 'tools' / 'source_colour_audit.py'))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)


class SourceColourTrialTests(unittest.TestCase):
    def test_synthetic_foreground_and_render(self):
        pixels = np.full((96, 96, 3), 255, np.uint8)
        pixels[15:56, 10:44] = [210, 25, 36]
        pixels[40:80, 45:83] = [30, 60, 220]
        arr, fg, idx, pal, prev, _ = forge.prepare(
            Image.fromarray(pixels), max_dim=96, colors=2)
        self.assertEqual(int(fg.sum()), (41*34) + (40*38))
        self.assertTrue(np.all(idx[~fg] == -1))
        svg, _, _, _, _ = forge.paths_svg(idx, pal)
        self.assertIn('NOT_DIGITISED', svg)
        import io
        rendered = np.asarray(Image.open(io.BytesIO(
            cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA'))
        composite = (rendered[:, :, :3].astype(np.float32) *
                     (rendered[:, :, 3:4] / 255) +
                     255*(1 - rendered[:, :, 3:4]/255)).astype('uint8')
        self.assertTrue(np.array_equal(composite, prev))

    def test_empty_image_rejected(self):
        with self.assertRaisesRegex(ValueError, 'no_supported_foreground'):
            forge.prepare(Image.new('RGB', (96, 96), 'white'),
                          max_dim=96, colors=2)

    def test_complex_border_rejected(self):
        arr = np.full((96, 96, 3), 255, np.uint8)
        for y in range(96):
            for x in range(96):
                if x < 12 or x >= 84 or y < 12 or y >= 84:
                    arr[y, x] = 0 if ((x//6 + y//6) % 2) else 255
        with self.assertRaisesRegex(
                ValueError, 'complex_border_background_not_supported'):
            forge.prepare(Image.fromarray(arr), max_dim=96, colors=2)

    def test_audit_does_not_claim_machine_approval(self):
        pixels = np.full((96, 96, 3), 255, np.uint8)
        pixels[18:76, 20:74] = [35, 120, 205]
        with tempfile.TemporaryDirectory() as d:
            source = Path(d)/'synthetic.png'
            Image.fromarray(pixels).save(source)
            original = source.read_bytes()
            report = forge.run(str(source), str(Path(d)/'out'))
            self.assertFalse(report['machine_eligible'])
            self.assertFalse(report['machine_files_generated'])
            self.assertEqual(original, source.read_bytes())
            self.assertEqual(report['status'],
                             'SOURCE_GEOMETRY_EXPERIMENT_NOT_MACHINE_APPROVED')


if __name__ == '__main__':
    unittest.main(verbosity=2)
