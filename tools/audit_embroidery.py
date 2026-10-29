"""Inspect candidate machine files with pyembroidery, independently of browser export.

Use locally with known test files only:
    python tools/audit_embroidery.py design.dst design.pes

Prints a JSON report and exits nonzero if files cannot be read or fail structural
checks. This is a structural audit, NOT machine compatibility or stitch quality.
"""
import argparse
import json
import math
from pathlib import Path
import sys


ALLOWED = {".dst", ".pes", ".jef", ".exp", ".vp3", ".xxx"}
MAX_BYTES = 15_000_000
MAX_RECORDS = 2_000_000


def inspect_file(path: Path):
    result = {"filename": path.name, "status": "FAIL", "physical_stitch_out": "NOT_TESTED"}
    try:
        if path.suffix.lower() not in ALLOWED:
            raise ValueError(f"Unsupported format: {path.suffix}")
        if not path.is_file() or path.is_symlink():
            raise ValueError("Input must be a regular file, not a symlink")
        nbytes = path.stat().st_size
        if nbytes < 10 or nbytes > MAX_BYTES:
            raise ValueError(f"File size outside permitted range: {nbytes}")
        try:
            import pyembroidery
        except ImportError as exc:
            raise RuntimeError("pyembroidery must be installed and version-pinned") from exc

        pattern = pyembroidery.read(str(path))
        if pattern is None:
            raise ValueError("Reader returned no embroidery pattern")
        records = pattern.stitches
        if not (1 <= len(records) <= MAX_RECORDS):
            raise ValueError(f"Unexpected command count: {len(records)}")
        coords = [(float(s[0]), float(s[1])) for s in records]
        if not all(math.isfinite(x) and math.isfinite(y) for x, y in coords):
            raise ValueError("Nonfinite embroidery coordinate")
        xs, ys = zip(*coords)
        result.update({
            "status": "STRUCTURALLY_READABLE",
            "format": path.suffix.lower().lstrip("."),
            "file_bytes": nbytes,
            "reader": "pyembroidery",
            "records": len(records),
            "thread_entries": len(pattern.threadlist),
            "bounds_0p1mm": [min(xs), min(ys), max(xs), max(ys)],
            "size_mm": [round((max(xs)-min(xs))/10, 2),
                        round((max(ys)-min(ys))/10, 2)],
        })
    except (OSError, ValueError, RuntimeError, TypeError, IndexError, OverflowError) as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="Embroidery files to audit")
    args = parser.parse_args(argv)
    results = [inspect_file(p) for p in args.paths]
    print(json.dumps({"engine": "pyembroidery", "tests": results,
                      "warning": "Binary readability is not machine/fabric approval"}, indent=2))
    return 0 if all(x["status"] == "STRUCTURALLY_READABLE" for x in results) else 1


if __name__ == "__main__":
    sys.exit(main())
