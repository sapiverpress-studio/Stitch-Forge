"""MD-2.75: original-image detail review cannot alter the existing native SVG."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]


class ProtectedDetailStageIntegration(unittest.TestCase):
    def test_critical_source_review_is_data_only_and_does_not_change_stitches(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            rgba=np.zeros((128,128,4),dtype=np.uint8)
            rgba[20:100,20:100]=[25,25,25,255]
            yy,xx=np.ogrid[:128,:128]
            ring=(xx-64)**2+(yy-65)**2
            rgba[(ring>=19**2)&(ring<=21**2)]=[230,230,230,255]
            rgba[55:62,58:65]=[255,255,255,255]
            original=root/'original.png';Image.fromarray(rgba,'RGBA').save(original)
            prepared=rgba.copy();prepared[20:100,20:100]=[25,25,25,255]
            comparison=root/'comparison.png';Image.fromarray(prepared,'RGBA').save(comparison)
            windows=root/'protected-windows.json'
            windows.write_text(json.dumps([{'id':'eye','rect':[36,37,92,91]}]))
            raw=root/'source.rgba';raw.write_bytes(rgba.tobytes())
            subprocess.run(['node',str(ROOT/'tools/prepare_artwork_trial.cjs'),
                            str(raw),'128','128','80',str(root)],
                           check=True,cwd=ROOT,capture_output=True,timeout=90)
            plan=root/'source-object-plan.json'
            out1=root/'baseline';out2=root/'protected'
            subprocess.run([sys.executable,str(ROOT/'tools/staged_legacy_trial.py'),
                            '--plan-json',str(plan),'--output',str(out1)],
                           check=True,cwd=ROOT,capture_output=True,timeout=90)
            subprocess.run([sys.executable,str(ROOT/'tools/staged_legacy_trial.py'),
                            '--plan-json',str(plan),'--output',str(out2),
                            '--original-png',str(original),
                            '--protected-windows-json',str(windows),
                            '--detail-comparison-png',str(comparison)],
                           check=True,cwd=ROOT,capture_output=True,timeout=90)
            self.assertEqual((out1/'combined-source-identical.svg').read_bytes(),
                             (out2/'combined-source-identical.svg').read_bytes())
            audit=json.loads((out2/'protected-detail-audit.json').read_text())
            self.assertFalse(audit['boundToPreparedPlanByOriginalSha256'])
            self.assertFalse(audit['releaseApproval'])
            self.assertEqual(audit['featureWindows'][0]['id'],'eye')
            self.assertTrue(audit['featureWindows'][0]['contrastLossPossible'])
            bundle=json.loads((out2/'stage-review-bundle.json').read_text())
            self.assertFalse(bundle['protectedDetailReview']['sourceOriginalImageIncluded'])
            self.assertFalse(bundle['protectedDetailReview']['nativeFeatureRetentionVerified'])
            self.assertFalse((out2/'original.png').exists())
            self.assertFalse((out2/'native').exists())
            bad=Image.fromarray(rgba[:110],'RGBA');wrong=root/'wrong.png';bad.save(wrong)
            failed=subprocess.run([sys.executable,str(ROOT/'tools/staged_legacy_trial.py'),
                            '--plan-json',str(plan),'--output',str(root/'invalid'),
                            '--original-png',str(wrong),
                            '--protected-windows-json',str(windows)],
                           cwd=ROOT,capture_output=True,timeout=90)
            self.assertNotEqual(failed.returncode,0)
            self.assertFalse((root/'invalid'/'combined-source-identical.svg').exists())


if __name__=='__main__':unittest.main()
