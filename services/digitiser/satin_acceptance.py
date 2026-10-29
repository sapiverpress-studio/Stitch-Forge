"""Real Ink/Stitch + independent-reader acceptance for a synthetic satin column."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import subprocess
import zipfile
from importlib.metadata import version as package_version

import pyembroidery
from satin_native import SatinColumn, build_satin_svg
from inkstitch_cli import export_trusted_svg
from format_audit import audit_zip

UPSTREAM_ENGINE = "Ink/Stitch v3.3.0"
ENGINE_SOURCE_COMMIT = "b0edd96311ece82ee48816dc93466274b12c2a9c"


def fixture_column():
    """Human-authored synthetic control: 60 x 4 mm, one thread colour."""
    left = ((10, 20), (30, 20), (50, 20), (70, 20))
    right = ((10, 24), (30, 24), (50, 24), (70, 24))
    rungs = tuple(((x, 20), (x, 24)) for x in (10, 30, 50, 70))
    return SatinColumn(left, right, rungs, "#CC2233", 0.4, 7.0)


def _read_pattern(payload, suffix):
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        name = next(n for n in archive.namelist() if n.lower().endswith("." + suffix))
        raw = archive.read(name)
    reader = pyembroidery.read_pes if suffix == "pes" else pyembroidery.read_dst
    return raw, reader(BytesIO(raw))


def _command_counts(pattern):
    mask = pyembroidery.COMMAND_MASK
    return {
        "needle_stitches": sum((s[2] & mask) == pyembroidery.STITCH for s in pattern.stitches),
        "jumps": sum((s[2] & mask) == pyembroidery.JUMP for s in pattern.stitches),
        "trims": sum((s[2] & mask) == pyembroidery.TRIM for s in pattern.stitches),
        "color_changes": sum((s[2] & mask) == pyembroidery.COLOR_CHANGE for s in pattern.stitches),
    }


def _decoded_threads(pattern):
    result = []
    for thread in getattr(pattern, "threadlist", []):
        value = getattr(thread, "hex_color", None)
        color = value() if callable(value) else value
        result.append({"color": str(color).lower() if color else None,
                       "brand": getattr(thread, "brand", None),
                       "catalog_number": getattr(thread, "catalog_number", None),
                       "description": getattr(thread, "description", None)})
    return result


def _stitch_path_svg(pattern):
    """Draw only actual decoded needle-stitch moves; jumps and trims break paths."""
    commands, current = [], []
    scale = 0.1  # pyembroidery stores 0.1 mm units for PES/DST.
    for x, y, flags in pattern.stitches:
        command = flags & pyembroidery.COMMAND_MASK
        if command == pyembroidery.STITCH:
            px, py = x * scale, y * scale
            if not current:
                current = [f"M {px:.2f},{py:.2f}"]
            else:
                current.append(f"L {px:.2f},{py:.2f}")
        elif current:
            commands.append(" ".join(current))
            current = []
    if current:
        commands.append(" ".join(current))
    paths = "".join(f'<path d="{d}"/>' for d in commands)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 64 8" '
            f'width="1280" height="160"><g fill="none" stroke="#CC2233" '
            f'stroke-width="0.08" stroke-linecap="round">{paths}</g></svg>')


def _comparison_svg(decoded_svg):
    # Re-map actual normalized PES coordinates and the source geometry to a
    # shared 60 x 4 mm display scale. This drawing is evidence from the machine
    # commands; it is not a stitch simulation or a realistic-artwork benchmark.
    actual_group = decoded_svg.split("><g fill=")[1].split("</g>")[0]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 300" width="1840" height="600">
<rect width="920" height="300" rx="20" fill="#f5f2ed"/>
<text x="48" y="42" font-family="sans-serif" font-size="20" font-weight="700">Input satin geometry</text>
<text x="510" y="42" font-family="sans-serif" font-size="20" font-weight="700">Decoded PES stitches</text>
<g transform="translate(48 112) scale(5.8 22)" fill="none" stroke-linecap="round">
<path d="M0,0 L20,0 L40,0 L60,0 M0,4 L20,4 L40,4 L60,4" stroke="#CC2233" stroke-width="0.10"/>
<path d="M0,0 L0,4 M20,0 L20,4 M40,0 L40,4 M60,0 L60,4" stroke="#263238" stroke-width="0.06" stroke-dasharray="0.35 0.22"/>
</g>
<g transform="translate(510 112) scale(5.8 22)"><g fill="none" stroke="#CC2233" stroke-width="0.08" stroke-linecap="round">{actual_group}</g></g>
<text x="48" y="252" font-family="sans-serif" font-size="15" fill="#35434a">Synthetic control • 60 × 4 mm • 0.4 mm spacing</text>
<text x="510" y="252" font-family="sans-serif" font-size="15" fill="#35434a">Ink/Stitch 3.3.0 • pyembroidery 1.5.1</text>
<text x="48" y="279" font-family="sans-serif" font-size="14" fill="#8b2f2f">Structural machine-file evidence only • no AI reconstruction, realistic artwork or fabric sew-out</text>
</svg>'''


def run_acceptance(executable: Path, output_directory: Path) -> dict:
    output_directory = Path(output_directory)
    output_directory.mkdir(parents=True, exist_ok=True)
    column = fixture_column()
    input_svg = build_satin_svg(80, 60, (column,))
    svg_path = output_directory / "native-satin-input.svg"
    svg_path.write_bytes(input_svg)
    engine = export_trusted_svg(svg_path, executable=Path(executable), timeout_seconds=120)
    archive_path = output_directory / "native-satin-pes-dst.zip"
    archive_path.write_bytes(engine.zip_bytes)

    audits = audit_zip(engine.zip_bytes)
    decoded = {}
    binaries = {}
    for fmt in ("pes", "dst"):
        binaries[fmt], decoded[fmt] = _read_pattern(engine.zip_bytes, fmt)
    pes, dst = decoded["pes"], decoded["dst"]
    if _command_counts(pes)["needle_stitches"] != _command_counts(dst)["needle_stitches"]:
        raise ValueError("PES and DST decoded stitch counts differ")
    pes_bounds = pes.bounds()
    dst_bounds = dst.bounds()
    if (abs((pes_bounds[2]-pes_bounds[0])-(dst_bounds[2]-dst_bounds[0])) > 1
            or abs((pes_bounds[3]-pes_bounds[1])-(dst_bounds[3]-dst_bounds[1])) > 1):
        raise ValueError("PES and DST decoded physical extents differ by more than 0.1 mm")
    xspan, yspan = (pes_bounds[2]-pes_bounds[0])/10, (pes_bounds[3]-pes_bounds[1])/10
    if abs(xspan-60.0) > 0.2 or abs(yspan-4.0) > 0.2:
        raise ValueError("Decoded PES extent differs from requested 60 x 4 mm satin column")
    points = [(s[0]/10, s[1]/10) for s in pes.stitches
              if (s[2] & pyembroidery.COMMAND_MASK) == pyembroidery.STITCH]
    if not points or any(x < -0.1 or x > 60.1 or y < -0.1 or y > 4.1 for x, y in points):
        raise ValueError("Decoded needle penetration falls outside requested satin bounds")
    cross_width_moves = sum(abs(b[1]-a[1]) >= 3.0 for a, b in zip(points, points[1:]))
    if cross_width_moves < 50:
        raise ValueError("Decoded output lacks repeated cross-column satin needle movements")
    max_move = max(a.max_needle_move_mm for a in audits)
    if max_move > 7.0:
        raise ValueError("Decoded needle movement exceeds requested maximum stitch length")

    stitch_svg = _stitch_path_svg(pes)
    decoded_svg_path = output_directory / "decoded-pes-stitches.svg"
    decoded_svg_path.write_text(stitch_svg, encoding="utf-8")
    comparison_svg = _comparison_svg(stitch_svg)
    comparison_svg_path = output_directory / "native-satin-comparison.svg"
    comparison_svg_path.write_text(comparison_svg, encoding="utf-8")
    comparison_png_path = output_directory / "native-satin-comparison.png"
    subprocess.run(["inkscape", str(comparison_svg_path), "--export-type=png",
                    f"--export-filename={comparison_png_path}", "--export-width=1840"],
                   check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
    html = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sapiver Stitch Forge — native satin engine evidence</title>
<style>body{{margin:0;background:#e8e5df;color:#17252b;font:16px/1.5 system-ui,sans-serif}}main{{max-width:1100px;margin:auto;padding:24px}}article{{background:#fff;border-radius:16px;padding:18px;margin:16px 0}}svg{{display:block;width:100%;height:auto}}code{{overflow-wrap:anywhere}}.flag{{color:#7d2727;font-weight:700}}</style>
<main><h1>Native satin engine evidence</h1><p class="flag">Synthetic control only. No AI reconstruction, detailed artwork acceptance or physical fabric sew-out is represented here.</p>
<article>{comparison_svg}</article><article><h2>What this verifies</h2><ul><li>Native Ink/Stitch 3.3.0 generated both PES and DST from the same SVG rails and rungs.</li><li>pyembroidery 1.5.1 independently decoded both files; needle counts and physical extents agree.</li><li>Decoded needle movements repeatedly cross the requested 4 mm column width and remain within the 60 × 4 mm bounds.</li><li>PES records a resolved palette thread; arbitrary source RGB is not preserved exactly. DST has no full thread-colour identity.</li></ul><p>It does not prove machine compatibility, thread handling, underlay quality, fabric compensation or embroidery quality.</p></article>
<article><h2>Machine-file report</h2><pre>__REPORT_JSON__</pre></article></main></html>'''
    # HTML body is filled after the metrics/report object below is complete.

    report = {
        "status": "STRUCTURALLY_VERIFIED_NOT_PHYSICALLY_STITCHED",
        "fixture": {"source": "Human-authored synthetic control geometry; not artwork or an AI reconstruction",
                    "physical_column_mm": [60.0, 4.0], "rungs": len(column.rungs),
                    "thread_color": column.thread_color, "requested_zigzag_spacing_mm": column.zigzag_spacing_mm,
                    "requested_max_stitch_length_mm": column.max_stitch_length_mm},
        "engine": {"name": UPSTREAM_ENGINE, "source_commit": ENGINE_SOURCE_COMMIT,
                   "trusted_svg_sha256": sha256(input_svg).hexdigest()},
        "reader": {"name": "pyembroidery", "version": package_version("pyembroidery")},
        "decoded": {"files": [
            {"name": audit.name, "format": audit.format, "needle_stitches": audit.needle_stitches,
             "jumps": audit.jumps, "trims": audit.trims, "color_changes": audit.changes,
             "bounds_mm": list(audit.bounds_mm), "max_needle_move_mm": audit.max_needle_move_mm,
             "sha256": sha256(binaries[audit.format]).hexdigest()} for audit in audits],
            "cross_column_needle_moves": cross_width_moves,
            "needle_points_inside_requested_bounds": True,
            "pes_thread_palette": _decoded_threads(pes),
            "color_mapping_note": "PES stores a resolved thread palette entry; it may differ from the source SVG hex. DST does not store full thread colour identity.",
            "pes_dst_decoded_physical_extents_agree_within_0_1_mm": True,
            "format_coordinate_origins": {"pes": [pes_bounds[0], pes_bounds[1]],
                                          "dst": [dst_bounds[0], dst_bounds[1]]}},
        "archive_sha256": sha256(engine.zip_bytes).hexdigest(),
        "visual_evidence": {"svg": comparison_svg_path.name,
                            "png": comparison_png_path.name,
                            "png_sha256": sha256(comparison_png_path.read_bytes()).hexdigest(),
                            "description": "Source rail/rung geometry compared with actual decoded PES stitches"},
        "physical_stitch_out": "NOT PERFORMED",
        "realistic_artwork_acceptance": "NOT TESTED",
    }
    html = html.replace("__REPORT_JSON__", json.dumps(report, indent=2))
    (output_directory / "native-satin-inspection.html").write_text(html, encoding="utf-8")
    (output_directory / "native-satin-report.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    return report
