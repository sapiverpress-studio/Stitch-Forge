"""Read PES/DST with an independent open-source reader: pyembroidery 1.5.1.

Structure-only checks. No machine is claimed compatible and no design is stitch-tested.
"""
from dataclasses import dataclass, asdict
from io import BytesIO
from math import isfinite
from pathlib import PurePosixPath
import json
import zipfile
import pyembroidery

try:
    from .inkstitch_cli import _inspect_zip, DigitiserError
except ImportError:
    from inkstitch_cli import _inspect_zip, DigitiserError


@dataclass(frozen=True)
class FileAudit:
    name: str
    format: str
    needle_stitches: int
    jumps: int
    changes: int
    bounds_mm: tuple[float, float]


def audit_zip(payload: bytes) -> tuple[FileAudit, ...]:
    """Reject corrupt, duplicate, empty, extreme or mismatched machine-file exports."""
    _inspect_zip(payload)
    reports = []
    seen = set()
    with zipfile.ZipFile(BytesIO(payload)) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            ext = PurePosixPath(info.filename).suffix.lower()
            if ext not in {'.dst', '.pes'}:
                continue
            if ext in seen:
                raise DigitiserError(f'Duplicate {ext} prevents independent audit')
            seen.add(ext)
            raw = archive.read(info)
            if len(raw) < 32:
                raise DigitiserError(f'Invalid {ext} size')
            try:
                pattern = (pyembroidery.read_dst if ext == '.dst' else pyembroidery.read_pes)(BytesIO(raw))
                stitches = pattern.stitches
                needle = sum((s[2] & pyembroidery.COMMAND_MASK) == pyembroidery.STITCH for s in stitches)
                jumps = sum((s[2] & pyembroidery.COMMAND_MASK) == pyembroidery.JUMP for s in stitches)
                changes = sum((s[2] & pyembroidery.COMMAND_MASK) == pyembroidery.COLOR_CHANGE for s in stitches)
                if not 3 <= needle <= 3_000_000:
                    raise DigitiserError('Implausible stitch count')
                left, top, right, bottom = pattern.bounds()
                if not all(isfinite(v) for v in (left, top, right, bottom)) or right < left or bottom < top:
                    raise DigitiserError('Invalid stitched bounding box')
                bounds_mm = (round((right-left) / 10, 2), round((bottom-top) / 10, 2))
                if max(bounds_mm) > 400:
                    raise DigitiserError('Design exceeds maximum engineering extent')
                reports.append(FileAudit(info.filename, ext[1:], needle, jumps, changes, bounds_mm))
            except DigitiserError:
                raise
            except Exception as exc:
                raise DigitiserError(f'Independent {ext} reader rejected the file: {type(exc).__name__}') from exc
    if seen != {'.dst', '.pes'}:
        raise DigitiserError('Missing PES or DST')
    a, b = reports
    if any(abs(x - y) > 2.0 for x, y in zip(a.bounds_mm, b.bounds_mm)):
        raise DigitiserError('PES and DST decoded extents differ by more than 2 mm')
    return tuple(reports)


def audit_report_json(payload: bytes) -> str:
    return json.dumps({
        'status': 'STRUCTURALLY_INSPECTED_NOT_STITCH_TESTED',
        'files': [asdict(a) for a in audit_zip(payload)],
    }, indent=2)
