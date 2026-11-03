"""Real native MD-2.67 worker two-phase acceptance; public synthetic art ONLY.

Tests the SAME packet and worker process_phase that the already-published
Netlify app uses. No private owner art, no Netlify/Cloud Run deployment.
"""
import argparse
import base64
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"services"/"digitiser"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"tests"))
from artwork_service import process_phase
from test_home_live_bridge import browser_packet, illustration
from verify_home_hybrid_native import licensed_fixture
from PIL import Image


def native_acceptance(engine, output, fixture=None):
    os.environ["STITCH_FORGE_HOME_HYBRID_ENABLED"] = "1"
    os.environ["STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS"] = "110"
    os.environ["STITCH_FORGE_AUTO_SOURCE_REPAIR"] = "1"
    original = licensed_fixture(fixture) if fixture else illustration()
    if max(original.size) > 320:
        ratio = 320 / max(original.size)
        original = original.convert('RGBA').resize(
            tuple(max(48, round(z*ratio)) for z in original.size),
            Image.Resampling.LANCZOS)
    packet = browser_packet(original)
    secret = "synthetic-offline-CI-key-never-used-live"
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    repair = None
    for attempt in range(2):
        shared = {**packet, **({"repairReceipt": repair} if repair else {})}
        first = process_phase(shared, executable=Path(engine), secret=secret)
        if first["requestId"] != packet["requestId"]:
            raise RuntimeError("Source-bound PES request identity changed")
        second = process_phase({**shared, "phase": "dst",
                                "receipt": first["receipt"],
                                "pesBase64": first["pesBase64"]},
                               executable=Path(engine), secret=secret)
        if isinstance(second, dict):
            if attempt > 0 or second.get("status") != "BOUNDED_NATIVE_REPAIR_REQUIRED":
                raise RuntimeError("Hybrid source repair exceeded its bounded native budget")
            repair = second["repairReceipt"]
            continue
        if not isinstance(second, bytes):
            raise RuntimeError("Real PES/DST was not returned")
        with zipfile.ZipFile(BytesIO(second)) as z:
            if z.testzip() is not None:
                raise RuntimeError("Real worker emitted corrupt ZIP")
            report = json.loads(z.read("machine-report.json"))
            preview = json.loads(z.read("decoded-preview.json"))
            svg = z.read("native-artwork-input.svg")
            pes = z.read("artwork-trial.pes")
            dst = z.read("artwork-trial.dst")
        if not pes.startswith(b"#PES0060") or len(dst) < 515 or not svg:
            raise RuntimeError("Missing real native PES6/DST/SVG")
        if report["requestId"] != packet["requestId"] or preview["requestId"] != packet["requestId"]:
            raise RuntimeError("Existing browser source identity would reject the hybrid")
        if report["nativeInputSha256"] != first["receipt"]["svgSha256"] or sha256(svg).hexdigest() != report["nativeInputSha256"]:
            raise RuntimeError("Original browser's native receipt/SVG binding failed")
        proof = report.get("homeHybrid")
        if not proof or proof.get("enabledForThisNativeJob") is not True or not proof.get("sourceForegroundPreserved"):
            raise RuntimeError("Native export did NOT actually use the hybrid plan")
        if report["sourceBinding"].get("clientObjectAlgorithmRecomputed") is not True:
            raise RuntimeError("Worker failed to mark transformed client object proposal")
        if report["machineEligible"] is not False or report["physicalQualityVerified"] is not False:
            raise RuntimeError("Worker falsely approved physical embroidery")
        if len(report["decoded"]) != 2 or {a["format"] for a in report["decoded"]} != {"pes", "dst"}:
            raise RuntimeError("Both independently decoded real formats required")
        if any(a["needlePointsOutsideWorkingColour"] or a["needleSegmentsOutsideWorkingColour"]
               for a in report["decoded"]):
            raise RuntimeError("Hybrid native stitches left their independently audited source colour")
        if any(a["needleStitches"] < 3 for a in report["decoded"]) or (
                report["decoded"][0]["needleStitches"] != report["decoded"][1]["needleStitches"]):
            raise RuntimeError("Inconsistent native PES/DST needle counts")
        # Confirm exact current browser app's source/dimension field checks.
        from artwork_packet import decode_packet
        browser_plan, meta, identity, binding = decode_packet(packet)
        if report["source"]["sha256"] != browser_plan["source"]["sha256"] or (
                report["source"]["width"] != browser_plan["source"]["width"]) or (
                report["source"]["height"] != browser_plan["source"]["height"]) or (
                report["imageWidthMm"] != browser_plan["physical"]["imageWidthMm"]):
            raise RuntimeError("Live website's independent original-source checks would fail")
        evidence = {
            "schema": "md267-full-browser-packet-to-real-native-pesdst-CI-v1",
            "result": "PASS_NATIVE_SOURCE_CONTAINED_NOT_SEWOUT_APPROVED",
            "fixture": fixture or "synthetic-bird",
            "clientSourceSha256": browser_plan["source"]["sha256"],
            "sourceRequestId": identity,
            "workerHybridProfile": proof,
            "actualNeedles": {a["format"]: a["needleStitches"] for a in report["decoded"]},
            "actualPEStrims": next(a["trims"] for a in report["decoded"] if a["format"] == "pes"),
            "unresolvedObjects": report["unresolvedObjects"],
            "nativeRepairPasses": attempt + 1,
            "machineApproved": False,
            "physicalSewoutVerified": False,
            "privateImagePublished": False
        }
        (output/"md267-worker-native-verification.json").write_text(
            json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
        (output/"md267-machine-report-NOT-APPROVED.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return evidence
    raise RuntimeError("Worker failed both source-preserving native attempts")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--engine", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--fixture", choices=["macaw", "butterfly", "rose"])
    arguments = p.parse_args()
    print(json.dumps(native_acceptance(arguments.engine, arguments.output, arguments.fixture), indent=2))
