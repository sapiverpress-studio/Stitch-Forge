#!/usr/bin/env python3
"""Offline pre-hybrid stitch-pass trial. Never changes live worker or site.

Input: an already generated source-grounded local plan JSON (not a raw PNG).
Stage files are for inspection; only the unchanged combined SVG is eligible
for optional native Ink/Stitch export through the existing independent audit.
"""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "digitiser"))
from artwork_trial import build_trial_svg, run_trial
from legacy_staged_passes import STAGES, split_legacy_svg, verify_legacy_stages


def main():
    parser = argparse.ArgumentParser(description="Source-identical legacy stitching passes (NO DEPLOY)")
    parser.add_argument("--plan-json", required=True, type=Path,
                        help="Local, source-validated old-engine plan JSON; never upload private artwork to CI")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--native-executable", type=Path,
                        help="Optional locally installed Ink/Stitch 3.3.0 executable for audited PES/DST")
    parser.add_argument("--try-straight-satin", action="store_true",
                        help="Existing restrictive satin experiment; no automatic curved-feather recognition")
    args = parser.parse_args()
    # Reuse the established pre-hybrid plan and geometry, not the SLIC/AI Home bridge.
    # Prevent inherited experimental flags from silently changing the comparison.
    for flag in ("STITCH_FORGE_BETA_COMPACT_RUNNING",
                 "STITCH_FORGE_DETAIL_SAFE_ROUTING",
                 "STITCH_FORGE_HYBRID_PATH_PLANNER"):
        os.environ[flag] = "0"
    os.environ["STITCH_FORGE_AUTO_SATIN_TRIAL"] = "1" if args.try_straight_satin else "0"
    plan = json.loads(args.plan_json.read_text(encoding="utf-8"))
    original, old_manifest, _ = build_trial_svg(plan, partition_fills=True)
    staged = split_legacy_svg(original)
    verify_legacy_stages(staged)
    # No writing until every stage has passed path-identity checks.
    output = args.output
    (output / "stages").mkdir(parents=True, exist_ok=True)
    (output / "combined-source-identical.svg").write_bytes(staged.native_svg)
    for stage in STAGES:
        (output / "stages" / (stage + "-review-only.svg")).write_bytes(staged.stage_svgs[stage])
    status = {**staged.manifest,
              "legacySourcePlanSignature": plan["sourcePlanSignature"],
              "sourceSatinTrial": old_manifest["sourceSatinTrial"],
              "nativeExportPerformed": False}
    if args.native_executable:
        if not args.native_executable.is_file():
            raise ValueError("Ink/Stitch executable not found")
        audited = run_trial(plan, args.native_executable, output / "native",
                            partition_fills=True)
        if (output / "native" / "native-artwork-input.svg").read_bytes() != staged.native_svg:
            raise ValueError("Native exporter did not use the byte-identical combined SVG")
        if not audited.get("decoded") or any(
            d["needlePointsOutsideWorkingColour"] or
            d["needleSegmentsOutsideWorkingColour"] for d in audited["decoded"]
        ):
            raise ValueError("Audited PES/DST has unresolved source-containment errors")
        status["nativeExportPerformed"] = True
        status["nativeAudit"] = "PES6_DST_DECODED_SOURCE_CONTAINMENT_PASSED_NOT_SEWN"
    (output / "staged-pass-report.json").write_text(
        json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status["status"], "counts": status["counts"],
                      "nativeExportPerformed": status["nativeExportPerformed"],
                      "output": str(output)}, indent=2))


if __name__ == "__main__":
    main()
