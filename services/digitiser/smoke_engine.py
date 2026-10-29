"""Optional real Ink/Stitch CLI smoke check; requires upstream engine installed.

From repo root:
 python services/digitiser/smoke_engine.py --inkstitch /absolute/path/to/inkstitch \
   --output /tmp/stitch_forge_inkstitch_smoke.zip

An output ZIP is NOT a stitch-out, format certification or production approval.
"""
import argparse
from pathlib import Path
import sys
from inkstitch_cli import export_trusted_svg, DigitiserError

FIXTURE = Path(__file__).resolve().parents[2] / 'tests/fixtures/inkstitch_simple_fill.svg'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inkstitch', required=True, type=Path,
                        help='Absolute path to official installed Ink/Stitch executable')
    parser.add_argument('--output', required=True, type=Path,
                        help='New output ZIP path (refuses overwrite)')
    args = parser.parse_args(argv)
    if not args.inkstitch.is_absolute() or not args.output.is_absolute():
        parser.error('--inkstitch and --output must be absolute paths')
    try:
        result = export_trusted_svg(FIXTURE, executable=args.inkstitch)
        with args.output.open('xb') as f:
            f.write(result.zip_bytes)
    except (OSError, DigitiserError) as exc:
        print(f'ENGINE SMOKE FAILED: {exc}', file=sys.stderr)
        return 1
    print(f'ENGINE SMOKE: ZIP produced with {len(result.filenames)} files: {result.filenames}')
    print('PHYSICAL STITCH OUT: NOT TESTED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
