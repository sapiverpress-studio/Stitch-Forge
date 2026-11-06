"""Exercise the actual older native plan generator and offline CLI, no machine."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "digitiser"))
from artwork_trial import build_trial_svg
from legacy_staged_passes import split_legacy_svg, STAGES


class LegacyBuilderIntegrationTests(unittest.TestCase):
    def test_source_plan_to_three_review_passes_without_geometry_change(self):
        import numpy as np
        with TemporaryDirectory(prefix="staged-legacy-trial-") as folder:
            tmp = Path(folder)
            rgba = np.zeros((72, 72, 4), dtype=np.uint8)
            rgba[10:54, 12:60] = (180, 70, 30, 255)
            rgba[8:61, 65] = (15, 20, 25, 255)
            raw = tmp / "synthetic.rgba"
            raw.write_bytes(rgba.tobytes())
            subprocess.run(["node", str(ROOT / "tools" / "prepare_artwork_trial.cjs"),
                            str(raw), "72", "72", "64", str(tmp)],
                           check=True, cwd=ROOT, capture_output=True, timeout=90)
            plan_path = tmp / "source-object-plan.json"
            plan = json.loads(plan_path.read_text())
            native, manifest, _ = build_trial_svg(plan, partition_fills=True)
            staged = split_legacy_svg(native)
            self.assertEqual(sum(staged.manifest["counts"].values()), manifest["nativePaths"])
            self.assertEqual(staged.native_svg, native)
            self.assertGreater(staged.manifest["counts"]["tatami"], 0)
            self.assertGreater(staged.manifest["counts"]["running"], 0)
            self.assertEqual(staged.manifest["counts"]["satin"], 0)
            output = tmp / "stages-output"
            subprocess.run([sys.executable, str(ROOT / "tools" / "staged_legacy_trial.py"),
                            "--plan-json", str(plan_path), "--output", str(output)],
                           check=True, cwd=ROOT, capture_output=True, timeout=90)
            self.assertEqual((output / "combined-source-identical.svg").read_bytes(), native)
            for stage in STAGES:
                self.assertTrue((output / "stages" / (stage+"-review-only.svg")).exists())
            record = json.loads((output / "staged-pass-report.json").read_text())
            self.assertFalse(record["nativeExportPerformed"])
            self.assertFalse(record["geometryChanged"])
            self.assertEqual(record["counts"], staged.manifest["counts"])


if __name__ == "__main__":
    unittest.main()
