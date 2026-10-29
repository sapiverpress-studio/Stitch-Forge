#!/usr/bin/env python3
"""Generate and audit a synthetic native-satin PES/DST evidence package."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/digitiser"))
from satin_acceptance import run_acceptance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inkstitch", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    if not args.inkstitch.is_absolute() or not args.output_dir.is_absolute():
        parser.error("Engine and output directory paths must be absolute")
    report = run_acceptance(args.inkstitch, args.output_dir)
    print(f"Status: {report['status']}")
    print(f"Archive SHA-256: {report['archive_sha256']}")
    print(f"Output: {args.output_dir}")
    print("PHYSICAL STITCH-OUT: NOT PERFORMED")


if __name__ == "__main__":
    main()
