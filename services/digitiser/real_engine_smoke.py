"""Run a real Ink/Stitch CLI on trusted project geometry and audit PES/DST.

Use --project for a locally saved Stitch Forge JSON export. Without --project,
the source is a synthetic petal fixture. Outputs are UNTESTED on fabric.
"""
import argparse
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import sys

from trusted_svg import smoke_svg
from project_bridge import convert_project
from inkstitch_cli import export_trusted_svg, DigitiserError


def prepare_svg(project: Path | None) -> bytes:
    """Produce trusted SVG from an approved project or known-good fixture."""
    if project is None:
        return smoke_svg()
    if not project.is_file() or project.is_symlink():
        raise ValueError('Expected a regular saved-project JSON file')
    if project.stat().st_size > 2_000_000:
        raise ValueError('Project exceeds limit')
    return convert_project(project.read_bytes())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inkstitch', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--project', type=Path, help='Optional exported browser design_project.json')
    args = parser.parse_args(argv)
    if not args.inkstitch.is_absolute() or not args.output.is_absolute():
        parser.error('Engine and output paths must be absolute')
    try:
        svg_bytes = prepare_svg(args.project)
        with TemporaryDirectory(prefix='stitch-forge-engine-') as dirname:
            svg = Path(dirname) / 'trusted-regions.svg'
            svg.write_bytes(svg_bytes)
            exported = export_trusted_svg(svg, executable=args.inkstitch, timeout_seconds=120)
            # An actual installed third-party reader is mandatory, never optional.
            from format_audit import audit_report_json
            report = audit_report_json(exported.zip_bytes)
            with args.output.open('xb') as f:
                f.write(exported.zip_bytes)
    except (OSError, DigitiserError, ValueError, ImportError) as exc:
        print(f'ENGINE SMOKE FAILED: {exc}', file=sys.stderr)
        return 1
    print(report)
    print('ZIP SHA256:', sha256(exported.zip_bytes).hexdigest())
    print('TRUSTED SVG SHA256:', sha256(svg_bytes).hexdigest())
    print('PHYSICAL STITCH-OUT: NOT TESTED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
