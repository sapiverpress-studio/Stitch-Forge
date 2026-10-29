import os
from pathlib import Path
import sys
import tempfile
import unittest
import json
from io import BytesIO
import zipfile
import pyembroidery

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/digitiser"))
from satin_acceptance import run_acceptance
from satin_native import SatinColumn, build_satin_svg
from inkstitch_cli import export_trusted_svg
from format_audit import audit_zip
from machine_job import run_local_satin_machine_job
from stitch_planning import inspect_plan
from project_bridge import convert_local_satin_project


@unittest.skipUnless(os.environ.get("STITCH_FORGE_INKSTITCH"),
                     "set STITCH_FORGE_INKSTITCH to a local official engine binary")
class RealSatinEngineAcceptanceTests(unittest.TestCase):
    def test_local_mixed_project_order_to_real_machine_files(self):
        geometry = {'accepted': True, 'machineApproved': False, 'geometryOnly': True,
                    'rungs': [{'left': [x, 0], 'right': [x, 12]} for x in range(6, 55, 6)]}
        project = {'schemaVersion': 1, 'width': 20, 'hoop': 80,
            'paths': [[[0, 0], [80, 0], [80, 60], [0, 60], [0, 0]]],
            'pathStyles': ['tatami'], 'pathColors': ['#112233'],
            'satinColumns': [{'geometry': geometry, 'threadColor': '#ED171F'}],
            'regionOrder': [{'type': 'satin', 'index': 0}, {'type': 'path', 'index': 0}]}
        payload = json.dumps(project).encode()
        planning = inspect_plan(convert_local_satin_project(payload))
        self.assertEqual([r['kind'] for r in planning['regions']], ['satin', 'fill'])
        job = run_local_satin_machine_job(payload,
            executable=Path(os.environ['STITCH_FORGE_INKSTITCH']))
        self.assertEqual({f['format'] for f in job.summary}, {'pes', 'dst'})
        self.assertEqual({f['changes'] for f in job.summary}, {1})
        self.assertEqual({tuple(f['bounds_mm']) for f in job.summary}, {(20.0, 15.0)})
        pes = next(f for f in job.summary if f['format'] == 'pes')
        self.assertEqual(pes['decoded_thread_colors'][0], '#ed171f')
        self.assertGreater(pes['stitches'], 500)
        self.assertLessEqual(pes['max_needle_move_mm'], 4.1)
        dst = next(f for f in job.summary if f['format'] == 'dst')
        self.assertEqual(dst['decoded_thread_colors'], [])  # DST has no thread palette.

    def test_native_satin_export_and_independent_decode(self):
        with tempfile.TemporaryDirectory(prefix="stitch-forge-satin-acceptance-") as tmp:
            report = run_acceptance(Path(os.environ["STITCH_FORGE_INKSTITCH"]), Path(tmp))
            self.assertEqual(report["status"], "STRUCTURALLY_VERIFIED_NOT_PHYSICALLY_STITCHED")
            self.assertEqual({f["format"] for f in report["decoded"]["files"]}, {"pes", "dst"})
            self.assertTrue(report["decoded"]["needle_points_inside_requested_bounds"])
            self.assertTrue(report["decoded"]["pes_dst_decoded_physical_extents_agree_within_0_1_mm"])
            self.assertEqual(report["decoded"]["pes_thread_palette"][0]["color"], "#ed171f")
            self.assertGreater(report["decoded"]["cross_column_needle_moves"], 50)
            self.assertTrue((Path(tmp) / "native-satin-inspection.html").is_file())
            self.assertTrue((Path(tmp) / "native-satin-comparison.png").is_file())

    def test_curved_rails_generate_real_pes_and_dst(self):
        left = ((10, 20), (25, 20), (40, 24), (55, 30), (70, 38))
        right = ((10, 24), (25, 24), (40, 28), (55, 34), (70, 42))
        column = SatinColumn(left, right, tuple(zip(left, right)), "#ED171F", 0.4, 7.0)
        with tempfile.TemporaryDirectory(prefix="stitch-forge-curved-satin-") as tmp:
            svg = Path(tmp) / "curved.svg"
            svg.write_bytes(build_satin_svg(80, 60, (column,)))
            engine = export_trusted_svg(svg, executable=Path(os.environ["STITCH_FORGE_INKSTITCH"]))
            audits = audit_zip(engine.zip_bytes)
            self.assertEqual({a.format for a in audits}, {"pes", "dst"})
            self.assertEqual({a.needle_stitches for a in audits}, {audits[0].needle_stitches})
            for audit in audits:
                self.assertAlmostEqual(audit.bounds_mm[0], 60.0, delta=0.2)
                self.assertAlmostEqual(audit.bounds_mm[1], 22.0, delta=0.2)


if __name__ == "__main__":
    unittest.main()
