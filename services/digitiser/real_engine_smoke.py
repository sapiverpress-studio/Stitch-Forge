"""Real upstream Ink/Stitch execution through trusted shapes, with independent audit.

Run:
  python services/digitiser/real_engine_smoke.py --inkstitch /absolute/inkstitch \
    --output /absolute/engine-smoke.zip
No output indicates compatibility or stitch-out success without physical tests.
"""
import argparse
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import sys

from trusted_svg import smoke_svg
from inkstitch_cli import export_trusted_svg, DigitiserError
from format_audit import audit_report_json


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inkstitch', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if not args.inkstitch.is_absolute() or not args.output.is_absolute():
        parser.error('Both paths must be absolute')
    try:
        with TemporaryDirectory(prefix='stitch-forge-engine-') as dirname:
            svg = Path(dirname) / 'trusted-petal.svg'
            svg.write_bytes(smoke_svg())
            exported = export_trusted_svg(svg, executable=args.inkstitch, timeout_seconds=120)
            report = audit_report_json(exported.zip_bytes)
            with args.output.open('xb') as f:
                f.write(exported.zip_bytes)
    except (OSError, DigitiserError, ValueError) as exc:
        print(f'ENGINE SMOKE FAILED: {exc}', file=sys.stderr)
        return 1
    print(report)
    print('SHA256:', sha256(exported.zip_bytes).hexdigest())
    print('SOURCE: synthetic vector-only test geometry')
    print('PHYSICAL STITCH-OUT: NOT TESTED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
