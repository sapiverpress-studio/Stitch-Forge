"""MD-2.74 source-identical separate-pass decision integration; no machine."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "services" / "digitiser"))
from artwork_trial import build_trial_svg,checked_masks
from staged_satin_review import inspect_source_satin_candidates,validate_stage_choices
from legacy_staged_passes import split_legacy_svg


class StageDecisionsIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import numpy as np
        cls.temp=TemporaryDirectory(prefix="stitch-stages-")
        root=Path(cls.temp.name)
        rgba=np.zeros((160,160,4),dtype=np.uint8)
        rgba[20:122,16:76]=[190,70,30,255]  # broad Tatami base
        rgba[18:141,109:119]=[20,40,90,255]  # independent narrow straight satin bar
        raw=root/"fixture.rgba";raw.write_bytes(rgba.tobytes())
        subprocess.run(["node",str(ROOT/"tools/prepare_artwork_trial.cjs"),
                        str(raw),"160","160","48",str(root)],
                       cwd=ROOT,check=True,capture_output=True,timeout=90)
        cls.plan=json.loads((root/"source-object-plan.json").read_text())
        cls.file=root/"source-object-plan.json"
        cls.review=inspect_source_satin_candidates(cls.plan)
        cls.eligible=next(item for item in cls.review["candidates"]
                          if item["method"]=="straight")

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_pass_selection_changes_only_verified_family(self):
        with patch.dict(os.environ,{"STITCH_FORGE_AUTO_SATIN_TRIAL":"0",
                                    "STITCH_FORGE_CURVED_SATIN_TRIAL":"0"}):
            base,base_manifest,base_masks=build_trial_svg(self.plan,partition_fills=True)
            chosen={self.eligible["sourceObjectId"]:"straight"}
            candidate,candidate_manifest,candidate_masks=build_trial_svg(
                self.plan,partition_fills=True,staged_satin_choices=chosen)
        self.assertNotEqual(base,candidate)
        self.assertEqual(base_manifest["sourcePlanSignature"],
                         candidate_manifest["sourcePlanSignature"])
        self.assertEqual(candidate_manifest["sourceSatinTrial"]["acceptedObjects"],1)
        self.assertEqual(candidate_manifest["sourceSatinTrial"]["stagedPerSourceSelection"],chosen)
        self.assertEqual(candidate_manifest["sourceSatinTrial"]["objects"][0]["sourceObjectId"],
                         self.eligible["sourceObjectId"])
        for color in base_masks:
            import numpy as np
            self.assertTrue(np.array_equal(base_masks[color],candidate_masks[color]))
        stages=split_legacy_svg(candidate)
        self.assertGreater(stages.manifest["counts"]["satin"],0)
        self.assertGreater(stages.manifest["counts"]["tatami"],0)
        self.assertFalse(stages.manifest["geometryChanged"])

    def test_empty_selection_keeps_original_svg_byte_identical(self):
        with patch.dict(os.environ,{"STITCH_FORGE_AUTO_SATIN_TRIAL":"0",
                                    "STITCH_FORGE_CURVED_SATIN_TRIAL":"0"}):
            old,_,_=build_trial_svg(self.plan,partition_fills=True)
            new,_,_=build_trial_svg(self.plan,partition_fills=True,staged_satin_choices={})
        self.assertEqual(old,new)

    def test_reject_unknown_or_wrong_method_before_native(self):
        self.assertEqual(validate_stage_choices(self.review,
            {self.eligible["sourceObjectId"]:"straight"}),
            {self.eligible["sourceObjectId"]:"straight"})
        for choices in ({"FFFFFF-99":"straight"},
                        {self.eligible["sourceObjectId"]:"curved"}):
            with self.assertRaisesRegex(ValueError,"not supported"):
                validate_stage_choices(self.review,choices)
        with self.assertRaisesRegex(ValueError,"do not match"):
            build_trial_svg(self.plan,partition_fills=True,
                            staged_satin_choices={"FFFFFF-99":"straight"})

    def test_stage_rejects_global_satin_and_repair_collision(self):
        selection={self.eligible["sourceObjectId"]:"straight"}
        with patch.dict(os.environ,{"STITCH_FORGE_AUTO_SATIN_TRIAL":"1"}):
            with self.assertRaisesRegex(ValueError,"conflicts"):
                build_trial_svg(self.plan,partition_fills=True,staged_satin_choices=selection)
        with self.assertRaisesRegex(ValueError,"Invalid staged"):
            build_trial_svg(self.plan,partition_fills=True,staged_satin_choices=selection,
                            fill_repair_overrides=["FAKE-0-p0"])

    def test_modified_source_not_accepted_as_same_review(self):
        bad=copy.deepcopy(self.plan)
        bad["regions"][0]["ledger"]["components"][0]["runs"].append([900,0,1])
        with self.assertRaises(ValueError):
            inspect_source_satin_candidates(bad)

    def test_local_cli_uses_selected_original_source_without_native(self):
        name=self.eligible["sourceObjectId"]
        with TemporaryDirectory(prefix="stages-cli-") as target:
            out=Path(target)/"selected"
            subprocess.run([sys.executable,str(ROOT/"tools/staged_legacy_trial.py"),
                            "--plan-json",str(self.file),"--output",str(out),
                            "--select-satin",name+":straight"],
                           cwd=ROOT,check=True,capture_output=True,timeout=120)
            report=json.loads((out/"staged-pass-report.json").read_text())
            self.assertEqual(report["chosenSatinObjects"],{name:"straight"})
            self.assertEqual(report["counts"]["satin"],1)
            self.assertFalse(report["nativeExportPerformed"])
            candidates=json.loads((out/"satin-source-candidates.json").read_text())
            self.assertGreaterEqual(candidates["candidateCount"],1)
            self.assertFalse(candidates["candidates"][0]["fabricSewoutVerified"])


if __name__=="__main__":
    unittest.main()
