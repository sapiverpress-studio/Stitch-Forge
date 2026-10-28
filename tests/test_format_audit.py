"""Real pyembroidery round-trip integration tests (independent of custom JS writer)."""
from io import BytesIO
from pathlib import Path
import sys
import unittest
import zipfile

import pyembroidery

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from format_audit import audit_zip, audit_report_json
from inkstitch_cli import DigitiserError


def build_machine_zip(*, damage=False):
    pattern = pyembroidery.EmbPattern()
    pattern.add_block([(0, 0), (0, 150), (150, 150), (150, 0), (0, 0)], 'red')
    dst = BytesIO()
    pes = BytesIO()
    pyembroidery.write_dst(pattern, dst)
    pyembroidery.write_pes(pattern, pes)
    out = BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr('petal.dst', dst.getvalue())
        z.writestr('petal.pes', b'invalid' if damage else pes.getvalue())
    return out.getvalue()


class IndependentFormatAuditTests(unittest.TestCase):
    def test_real_pes_dst_readback(self):
        reports = audit_zip(build_machine_zip())
        self.assertEqual({r.format for r in reports}, {'pes', 'dst'})
        self.assertTrue(all(r.needle_stitches >= 3 for r in reports))
        self.assertTrue(all(max(r.bounds_mm) <= 20 for r in reports))
        self.assertIn('STRUCTURALLY_INSPECTED_NOT_STITCH_TESTED', audit_report_json(build_machine_zip()))

    def test_malformed_machine_file_rejected(self):
        with self.assertRaises(DigitiserError):
            audit_zip(build_machine_zip(damage=True))

    def test_missing_or_duplicate_format_rejected(self):
        payload = BytesIO()
        with zipfile.ZipFile(payload, 'w') as z:
            z.writestr('a.dst', b'fake')
            z.writestr('b.dst', b'fake')
            z.writestr('a.pes', b'fake')
        with self.assertRaises(DigitiserError):
            audit_zip(payload.getvalue())
