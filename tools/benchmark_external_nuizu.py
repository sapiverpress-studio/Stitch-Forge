"""Benchmark the UNMODIFIED upstream Nuizu CLI on licensed images.

This is an external-engine evaluation, not another Stitch Forge digitiser.
Do not supply private artwork to public CI. Files are machine trials, not
approved or physically sewn embroidery. Nuizu is installed from its published
PyPI release; never copy its source into the project in this test.
"""
from __future__ import annotations

from collections import Counter
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any

from PIL import Image, ImageDraw
import pyembroidery

ROOT = Path(__file__).resolve().parents[1]


def licensed_fixture(name):
    # Avoid importing Stitch Forge's own segmentation/machine engine: this
    # benchmark must exercise ONLY the upstream Nuizu digitiser.
    manifest_path = ROOT / "tests" / "fixtures" / "artwork-evaluation" / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    record = next((r for r in manifest["samples"] if r["id"] == name), None)
    if not record or record["licence"] != "CC0-1.0":
        raise ValueError("Only independently verified CC0 images are allowed")
    target = manifest_path.parent / record["raster_file"]
    if sha256(target.read_bytes()).hexdigest() != record["raster_sha256"]:
        raise ValueError("CC0 artwork SHA mismatch")
    return Image.open(target).copy()


# Public, CC0 test art. No user or private Kingfisher assets ever uploaded.
FIXTURES = ("macaw", "rose", "butterfly")
# Same physical image width in the existing MD-2.67 native controls, approx 80 mm.
SIZE_MM = 80
MAX_OUTPUT_BYTES = 5000000
MAX_MACHINE_NEEDLES = 175000


def audit_native(filename: Path) -> dict[str, Any]:
    payload = filename.read_bytes()
    if not 520 <= len(payload) <= MAX_OUTPUT_BYTES:
        raise ValueError(f"Unexpected native payload size for {filename}")
    # Nuizu emits native machine formats. Decode independently instead of
    # accepting the CLI's success message or generated preview as proof.
    pattern = pyembroidery.read(str(filename))
    if not pattern or not pattern.stitches:
        raise ValueError("Nuizu generated no decodable stitches")
    stitches = Counter()
    coords = []
    segments = []
    block = 0
    prev = None
    pen_down = False
    square_density = Counter()
    for x, y, command in pattern.stitches:
        cmd = command & pyembroidery.COMMAND_MASK
        if cmd == pyembroidery.COLOR_CHANGE:
            block += 1
            stitches["colorChanges"] += 1
            pen_down = False
        elif cmd == pyembroidery.TRIM:
            stitches["trims"] += 1
            pen_down = False
        elif cmd == pyembroidery.JUMP:
            stitches["jumps"] += 1
            pen_down = False
        elif cmd == pyembroidery.STITCH:
            pt = (float(x) / 10, float(y) / 10)
            coords.append(pt)
            square_density[(int(pt[0]), int(pt[1]))] += 1
            stitches["needleStitches"] += 1
            if pen_down and prev is not None and pt != prev:
                segments.append((prev, pt, block))
            prev = pt
            pen_down = True
        elif cmd == pyembroidery.END:
            stitches["endCommands"] += 1
            pen_down = False
        if stitches["needleStitches"] > MAX_MACHINE_NEEDLES:
            raise ValueError("Machine needle budget exceeded")
    if len(coords) < 100 or not stitches["endCommands"]:
        raise ValueError("Missing machine stitches or END marker")
    xs, ys = zip(*coords)
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    if max(width, height) > SIZE_MM * 1.35 or min(width, height) < 5:
        raise ValueError("Suspicious machine physical dimensions")
    thread_colors = []
    for i, th in enumerate(pattern.threadlist):
        try:
            colour = "#" + th.hex_color().lstrip("#").upper()
            if len(colour) != 7:
                raise ValueError("Not a #RRGGBB thread")
        except Exception:
            colour = ["#1F596C", "#DB7835", "#325A40", "#976E52", "#A6B4C0"][i % 5]
        thread_colors.append(colour)
    if not thread_colors:
        thread_colors = ["#263D50", "#CE762D", "#4C7045", "#9A4B4B"]
    scale = min(1080 / max(width, .001), 1080 / max(height, .001))
    canvas = Image.new("RGB", (1160, 1160), "white")
    draw = ImageDraw.Draw(canvas)
    for (ax, ay), (bx, by), i in segments:
        c = thread_colors[i % len(thread_colors)]
        draw.line((40 + (ax - min(xs)) * scale,
                   40 + (ay - min(ys)) * scale,
                   40 + (bx - min(xs)) * scale,
                   40 + (by - min(ys)) * scale), fill=c, width=2)
    preview = filename.with_suffix(".decoded-needles.png")
    canvas.save(preview)
    return {
        "format": filename.suffix[1:].lower(),
        "sha256": sha256(payload).hexdigest(),
        "bytes": len(payload),
        **dict(stitches),
        "threadlistEntries": len(pattern.threadlist),
        "boundsMm": [round(width, 2), round(height, 2)],
        "peakNeedlePointsInOneMmSquare": max(square_density.values()),
        "decodedSegmentsPreview": preview.name,
        "previewIsPhysicalThreadSimulation": False,
        "physicalSewoutVerified": False,
    }


def main() -> None:
    dest = Path(sys.argv[1])
    dest.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "stitch-forge-existing-engine-native-nuizu-v1",
        "externalEngine": "Nuizu",
        "upstreamRelease": "0.3.1",
        "source": "PyPI published MIT OR Apache-2.0 CLI",
        "method": "Run the external Nuizu CLI unchanged, no custom stitch algorithms",
        "targetSizeLongestSideMm": SIZE_MM,
        "privateKingfisherUploaded": False,
        "physicallySewn": False,
        "customerQualityApproved": False,
        "runs": [],
    }
    for fixture in FIXTURES:
        image = licensed_fixture(fixture)
        path = dest / f"{fixture}.png"
        image.save(path)
        image_digest = sha256(path.read_bytes()).hexdigest()
        variants = [("9-colour", 9), ("12-colour", 12)]
        for variant, colors in variants:
            output = dest / f"{fixture}-{variant}"
            output.mkdir(parents=True, exist_ok=True)
            result = {
                "fixture": fixture, "variant": variant, "maxColors": colors,
                "sourceSha256": image_digest, "sourceDimensionsPx": list(image.size),
                "files": [], "success": False,
            }
            for fmt in ("pes", "dst"):
                target = output / f"{fixture}-{variant}-NUiZU-NOT-MACHINE-APPROVED.{fmt}"
                command = [
                    "nuizu", fmt, str(path), str(target),
                    "--max-colors", str(colors), "--size", str(SIZE_MM),
                    "--auto-angle", "--pull-comp", "0.3",
                    "--preview", "none",
                ]
                try:
                    finished = subprocess.run(command, check=False, cwd=ROOT,
                        capture_output=True, text=True, timeout=150,
                        env={**os.environ, "PYTHONUNBUFFERED": "1"})
                    if finished.returncode != 0:
                        result["files"].append({
                            "format": fmt, "success": False,
                            "failure": finished.stderr[-1100:] or finished.stdout[-1100:],
                        })
                    else:
                        result["files"].append({"success": True, **audit_native(target)})
                except Exception as exc:
                    result["files"].append({
                        "format": fmt, "success": False,
                        "failure": f"{type(exc).__name__}: {str(exc)[:500]}",
                    })
            result["success"] = len(result["files"]) == 2 and all(
                f.get("success") for f in result["files"])
            report["runs"].append(result)
            # Evaluate actual output; never mask errors with automatic success.
            print(json.dumps(result, sort_keys=True), flush=True)
    (dest / "NUiZU-EXTERNAL-ENGINE-REPORT.json").write_text(
        json.dumps(report, indent=2) + "\n")
    if not all(r["success"] for r in report["runs"]):
        raise RuntimeError("One or more external Nuizu native conversions failed")


if __name__ == "__main__":
    main()
