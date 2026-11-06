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
from staged_satin_review import (inspect_source_satin_candidates, validate_stage_choices,
                                 accept_review_decisions, make_review_bundle)
from protected_detail_audit import audit_protected_details, load_rgba
from authenticated_running_detail import propose_authenticated_running_details


def main():
    parser = argparse.ArgumentParser(description="Source-identical legacy stitching passes (NO DEPLOY)")
    parser.add_argument("--plan-json", required=True, type=Path,
                        help="Local, source-validated old-engine plan JSON; never upload private artwork to CI")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--native-executable", type=Path,
                        help="Optional locally installed Ink/Stitch 3.3.0 executable for audited PES/DST")
    parser.add_argument("--try-straight-satin", action="store_true",
                        help="Existing restrictive satin experiment; no automatic curved-feather recognition")
    parser.add_argument("--select-satin", action="append", default=[], metavar="OBJECT_ID:METHOD",
                        help="Explicitly select a source-verified straight or curved satin object")
    parser.add_argument("--decisions-json", type=Path,
                        help="Offline phone reviewer choices, bound to the prepared source hash")
    parser.add_argument("--original-png", type=Path,
                        help="Optional private original PNG for protected-detail review only")
    parser.add_argument("--protected-windows-json", type=Path,
                        help="JSON array of user-chosen critical-feature rectangles in ORIGINAL pixels")
    parser.add_argument("--detail-comparison-png", type=Path,
                        help="Optional same-composition reduced/quantised raster for feature-loss diagnostics")
    parser.add_argument("--working-rgba", type=Path,
                        help="Exact private working RGBA byte file bound to the plan and original PNG")
    parser.add_argument("--running-detail-windows-json", type=Path,
                        help="Original-pixel source colour windows for a separate running-detail pass")
    parser.add_argument("--select-running", action="append", default=[], metavar="FEATURE_ID",
                        help="Activate only a verified running detail proposed for this exact original PNG")
    args = parser.parse_args()
    if sum(bool(a) for a in (args.select_satin,args.try_straight_satin,args.decisions_json))>1:
        parser.error("Use exactly one satin selection mechanism")
    if (args.protected_windows_json or args.running_detail_windows_json) and not args.original_png:
        parser.error("Detail windows require the original private PNG")
    if args.original_png and not (args.protected_windows_json or args.running_detail_windows_json):
        parser.error("Original PNG needs protected windows or verified running windows")
    if args.detail_comparison_png and not args.protected_windows_json:
        parser.error("Contrast comparison needs protected windows")
    if args.running_detail_windows_json and not args.working_rgba:
        parser.error("Running-detail proposals require the exact working RGBA bytes")
    if args.select_running and not args.running_detail_windows_json:
        parser.error("Select running details only after a source-bound candidate review")
    # Reuse the established pre-hybrid plan and geometry, not the SLIC/AI Home bridge.
    # Prevent inherited experimental flags from silently changing the comparison.
    for flag in ("STITCH_FORGE_BETA_COMPACT_RUNNING",
                 "STITCH_FORGE_DETAIL_SAFE_ROUTING",
                 "STITCH_FORGE_HYBRID_PATH_PLANNER",
                 "STITCH_FORGE_CURVED_SATIN_TRIAL"):
        os.environ[flag] = "0"
    os.environ["STITCH_FORGE_AUTO_SATIN_TRIAL"] = "1" if args.try_straight_satin else "0"
    plan = json.loads(args.plan_json.read_text(encoding="utf-8"))
    protected=None
    original_png_bytes=args.original_png.read_bytes() if args.original_png else None
    running_review=None
    staged_running=None
    if args.running_detail_windows_json:
        detail_raw=args.running_detail_windows_json.read_bytes()
        if len(detail_raw)>8192:
            raise ValueError("Running detail source window document exceeds bounded size")
        requested=json.loads(detail_raw)
        working=args.working_rgba.read_bytes()
        running_review=propose_authenticated_running_details(
            plan,original_png_bytes,working,requested)
        offered={item['id'] for item in running_review['candidates']}
        if not args.select_running and running_review['candidateCount']:
            # Candidate-only review stays completely source-identical.
            pass
        if len(args.select_running)!=len(set(args.select_running)) or any(
            key not in offered for key in args.select_running):
            raise ValueError("Unsupported or duplicate source running-detail choice")
        if args.select_running:
            staged_running={'originalPng':original_png_bytes,
                'workingRgba':working,'windows':requested,
                'selectedIds':args.select_running}
    if args.protected_windows_json:
        windows_raw=args.protected_windows_json.read_bytes()
        if len(windows_raw)>8192:
            raise ValueError('Protected detail window document exceeds bounded size')
        windows=json.loads(windows_raw)
        _,rgba=load_rgba(args.original_png)
        # The V1 signed plan does not carry the full original PNG SHA.
        # Matching source-frame dimensions is useful, but is NOT proof of
        # authenticated original-to-working-packet identity.
        if ([rgba.shape[1],rgba.shape[0]] !=
              [plan['source']['originalWidth'],plan['source']['originalHeight']]):
            raise ValueError('Original artwork dimensions do not match prepared source')
        protected=audit_protected_details(args.original_png,windows,
            width_mm=plan['physical']['imageWidthMm'],
            comparison_png=args.detail_comparison_png)
        protected['boundToPreparedPlanByOriginalSha256']=False
        protected['preparedSourcePlanSignature']=plan['sourcePlanSignature']
    review = inspect_source_satin_candidates(plan)
    selections = {}
    for choice in args.select_satin:
        if ":" not in choice:
            parser.error("Satin selection must be SOURCE_ID:straight or SOURCE_ID:curved")
        identity,method = choice.rsplit(":",1)
        if identity in selections:
            parser.error("Duplicate satin object selection")
        selections[identity] = method
    if args.decisions_json:
        raw=args.decisions_json.read_bytes()
        if len(raw)>25000:
            raise ValueError('Staged decisions file exceeds bounded size')
        document=json.loads(raw)
        selections=accept_review_decisions(review,document)
    else:
        selections=validate_stage_choices(review,selections)
    # No opt-in means the previous native input stays identical. An explicit
    # candidate choice replaces ONLY its existing source-owned stitch object.
    staged_override = selections if args.select_satin or args.decisions_json else None
    original, old_manifest, _ = build_trial_svg(
        plan, partition_fills=True, staged_satin_choices=staged_override,
        staged_running_source=staged_running)
    staged = split_legacy_svg(original)
    verify_legacy_stages(staged)
    # No writing until every stage has passed path-identity checks.
    output = args.output
    (output / "stages").mkdir(parents=True, exist_ok=True)
    (output / "combined-source-identical.svg").write_bytes(staged.native_svg)
    (output / "satin-source-candidates.json").write_text(
        json.dumps(review, indent=2) + "\n", encoding="utf-8")
    if running_review is not None:
        (output / "running-original-candidates.json").write_text(
            json.dumps(running_review,indent=2)+"\n",encoding="utf-8")
    bundle=make_review_bundle(review,staged.manifest["counts"])
    if running_review is not None:
        bundle['authenticatedRunningReview']={
            'sourceOriginalSha256Verified':True,
            'preparedSourceSha256Verified':True,
            'candidateIds':[item['id'] for item in running_review['candidates']],
            'selectedIds':list(args.select_running),
            'machineApproved':False,
            'sourceOriginalImageIncluded':False}
    if protected is not None:
        bundle['protectedDetailReview']={
            'windows':[{'id':r['id'], 'contrastLossPossible':r.get('contrastLossPossible')}
                       for r in protected['featureWindows']],
            'nativeFeatureRetentionVerified':False,
            'originalToPreparedPacketAuthenticated':False,
            'machineApproved':False,
            'sourceOriginalImageIncluded':False}
        (output / "protected-detail-audit.json").write_text(
            json.dumps(protected,indent=2)+"\n",encoding="utf-8")
    (output / "stage-review-bundle.json").write_text(
        json.dumps(bundle,indent=2) + "\n", encoding="utf-8")
    for stage in STAGES:
        (output / "stages" / (stage + "-review-only.svg")).write_bytes(staged.stage_svgs[stage])
    status = {**staged.manifest,
              "legacySourcePlanSignature": plan["sourcePlanSignature"],
              "sourceSatinTrial": old_manifest["sourceSatinTrial"],
              "chosenSatinObjects": selections,
              "reviewCandidateCount": review["candidateCount"],
              "protectedDetailReviewPerformed": protected is not None,
              "protectedDetailNativeLikenessVerified": False,
              "originalAuthenticatedRunningReviewPerformed": running_review is not None,
              "originalAuthenticatedRunningSelections":list(args.select_running),
              "nativeExportPerformed": False}
    if args.native_executable:
        if not args.native_executable.is_file():
            raise ValueError("Ink/Stitch executable not found")
        audited = run_trial(plan, args.native_executable, output / "native",
                            partition_fills=True, staged_satin_choices=staged_override,
                            staged_running_source=staged_running)
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
