"""Bounded project-to-machine-file transaction (never a retail stitch-out approval).

Accept JSON geometry only. No source images, SVG files or arbitrary commands enter
Ink/Stitch. Return bytes only after actual Ink/Stitch and independent PES/DST audit.
"""
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import json

from project_bridge import MAX_PROJECT_BYTES, convert_project
from inkstitch_cli import DigitiserError, export_trusted_svg
from format_audit import audit_zip
from stitch_planning import inspect_plan

MAX_RESULT_BYTES = 3_000_000

@dataclass(frozen=True)
class MachineJob:
    payload: bytes
    summary: tuple[dict, ...]
    digest: str

def run_machine_job(project: bytes, *, executable: Path, timeout_seconds: int = 90) -> MachineJob:
    """Process one geometry-only request and fail closed on engine/audit errors."""
    if not isinstance(project, bytes) or len(project) > MAX_PROJECT_BYTES:
        raise ValueError('Project JSON size invalid')
    svg = convert_project(project)  # bounded geometry; drops arbitrary/user reference data
    planning = inspect_plan(svg)
    if any('small_fill_requires_size_or_stitch_type_review' in region['warnings'] for region in planning['regions']):
        raise ValueError('Fill below conservative 0.8 mm extent / 1 square mm area gate; review size or stitch type')
    with TemporaryDirectory(prefix='stitch-forge-job-') as directory:
        trusted = Path(directory) / 'approved-generated.svg'
        trusted.write_bytes(svg)
        engine = export_trusted_svg(trusted, executable=executable, timeout_seconds=timeout_seconds)
    if len(engine.zip_bytes) > MAX_RESULT_BYTES:
        raise DigitiserError('Machine archive exceeds download budget')
    audits = audit_zip(engine.zip_bytes)  # real, independent parser; rejects mismatched bounds
    counts = {a.format: a.needle_stitches for a in audits}
    if abs(counts['pes'] - counts['dst']) > max(3, int(max(counts.values()) * .005)):
        raise DigitiserError('PES and DST disagree on stitch count')
    changes = {a.format: a.changes for a in audits}
    if changes['pes'] != changes['dst']:
        raise DigitiserError('PES and DST disagree on colour-change count')
    if changes['pes'] != planning['expected_colour_changes']:
        raise DigitiserError('Machine colour changes do not match ordered editable regions')
    for audit in audits:
        if any(abs(actual-expected)>1.0 for actual,expected in zip(audit.bounds_mm,planning['source_bounds_mm'])):
            raise DigitiserError('Machine extents do not match requested source geometry within 1 mm')
    return MachineJob(
        payload=engine.zip_bytes,
        summary=tuple({'format': a.format, 'stitches': a.needle_stitches,
                       'changes': a.changes, 'bounds_mm': list(a.bounds_mm),
                       'jumps': a.jumps, 'trims': getattr(a,'trims',0),
                       'stops': getattr(a,'stops',0),
                       'max_needle_move_mm': getattr(a,'max_needle_move_mm',0.0)} for a in audits),
        digest=sha256(engine.zip_bytes).hexdigest()
    )

def safe_summary(job: MachineJob) -> str:
    """ASCII-only bounded status suitable for a response header."""
    return json.dumps({'status': 'STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED',
                       'files': job.summary, 'sha256': job.digest}, separators=(',', ':'))
