"""Restricted wrapper around Ink/Stitch CLI ZIP export.

Only pass SVGs created by our trusted, sanitised SVG builder. Never send
untrusted user-provided SVG directly to this command-line process. The actual
Ink/Stitch runtime is not bundled, configured or machine-validated here.
"""
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath
import os
import stat
import signal
import subprocess
import zipfile

MAX_SVG = 2_000_000
MAX_ZIP = 20_000_000
MAX_FILES = 64


class DigitiserError(RuntimeError):
    """A controlled failure, never a partially approved embroidery export."""


@dataclass(frozen=True)
class EngineResult:
    zip_bytes: bytes
    filenames: tuple[str, ...]
    stderr: str


def _inspect_zip(payload: bytes) -> tuple[str, ...]:
    if not payload.startswith(b'PK\x03\x04') or len(payload) > MAX_ZIP:
        raise DigitiserError('Ink/Stitch returned an invalid or oversized ZIP')
    try:
        with zipfile.ZipFile(BytesIO(payload)) as z:
            infos = z.infolist()
            if not infos or len(infos) > MAX_FILES:
                raise DigitiserError('Ink/Stitch ZIP file-count check failed')
            if sum(info.file_size for info in infos) > MAX_ZIP:
                raise DigitiserError('Ink/Stitch ZIP exceeds uncompressed size limit')
            if z.testzip() is not None:
                raise DigitiserError('Ink/Stitch ZIP failed integrity check')
            names = []
            types = set()
            for entry in infos:
                p = PurePosixPath(entry.filename)
                if (entry.filename.startswith('/') or '..' in p.parts
                        or '\\' in entry.filename or entry.file_size > MAX_ZIP
                        or entry.flag_bits & 1):
                    raise DigitiserError('Ink/Stitch ZIP has unsafe filenames or encrypted entries')
                if stat.S_IFMT(entry.external_attr >> 16) == stat.S_IFLNK:
                    raise DigitiserError('Ink/Stitch ZIP contains a symlink')
                if entry.is_dir():
                    continue
                ext = p.suffix.lower()
                if ext not in {'.dst', '.pes', '.txt'}:
                    raise DigitiserError(f'Unexpected Ink/Stitch output: {ext}')
                names.append(entry.filename)
                types.add(ext)
            if not {'.dst', '.pes'}.issubset(types):
                raise DigitiserError('Ink/Stitch ZIP is missing PES or DST')
            return tuple(names)
    except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
        if isinstance(exc, DigitiserError):
            raise
        raise DigitiserError('Could not inspect Ink/Stitch ZIP') from exc


def _run_engine(argv, *, timeout_seconds):
    """Bound output on disk and reap the entire engine session on every exit.

    A child retaining stdout must not keep a timed-out request alive. Temporary
    files avoid unbounded PIPE accumulation; deployment also caps /tmp via tmpfs.
    """
    from tempfile import TemporaryFile
    import time
    with TemporaryFile() as out, TemporaryFile() as err:
        process = subprocess.Popen(argv, shell=False, stdout=out, stderr=err,
                                   start_new_session=True)
        deadline = time.monotonic() + timeout_seconds
        try:
            while process.poll() is None:
                if out.tell() > MAX_ZIP or err.tell() > 1_000_000:
                    raise DigitiserError('Ink/Stitch exceeded output budget')
                if time.monotonic() >= deadline:
                    err.seek(max(0, err.tell() - 3000))
                    raise subprocess.TimeoutExpired(argv, timeout_seconds, stderr=err.read(3000))
                time.sleep(.02)
        finally:
            # Kill lingering descendants even if the immediate process exited.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
        if out.tell() > MAX_ZIP or err.tell() > 1_000_000:
            raise DigitiserError('Ink/Stitch exceeded output budget')
        out.seek(0); err.seek(0)
        return subprocess.CompletedProcess(argv, process.returncode, out.read(MAX_ZIP + 1), err.read(1_000_001))


def export_trusted_svg(svg: Path, *, executable: Path, timeout_seconds: int = 60) -> EngineResult:
    """Export a *trusted generated* SVG using the official documented ZIP CLI.

    This is not an untrusted upload endpoint. Container isolation, SVG sanitiser
    and worker resource quotas must be built and tested separately.
    """
    svg = Path(svg)
    executable = Path(executable)
    if not svg.is_file() or svg.is_symlink() or svg.suffix.lower() != '.svg':
        raise DigitiserError('Expected a regular generated SVG file')
    if not 20 <= svg.stat().st_size <= MAX_SVG:
        raise DigitiserError('SVG size outside allowed range')
    if not executable.is_file() or executable.is_symlink():
        raise DigitiserError('Ink/Stitch executable not installed at configured path')
    if not 1 <= timeout_seconds <= 180:
        raise DigitiserError('Invalid Ink/Stitch timeout')
    argv = [str(executable), '--extension=zip', '--format-dst=True',
            '--format-pes=True', '--format-threadlist=True', str(svg)]
    try:
        run = _run_engine(argv, timeout_seconds=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        # The whole engine process group has been killed and reaped.
        diagnostic = ''
        if os.environ.get('STITCH_FORGE_CI_DIAGNOSTICS') == 'synthetic-only':
            raw = exc.stderr or b''
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8', errors='replace')
            diagnostic = ''.join(ch for ch in ' '.join(raw[-3000:].split())
                                 if ch.isprintable())[-1400:]
        raise DigitiserError('Ink/Stitch exceeded configured processing timeout'+
            (f' (synthetic CI stderr: {diagnostic})' if diagnostic else '')) from exc
    except OSError as exc:
        raise DigitiserError('Ink/Stitch could not start') from exc
    if run.returncode != 0:
        detail = ''
        # Only the synthetic public GitHub test may expose bounded upstream
        # diagnostics; never echo error text from uploaded customer artwork.
        if os.environ.get('STITCH_FORGE_CI_DIAGNOSTICS') == 'synthetic-only':
            detail = ' '.join(run.stderr.decode('utf-8', errors='replace')[-2400:].split())
            detail = ''.join(c for c in detail if c.isprintable())[-1800:]
        raise DigitiserError(f'Ink/Stitch failed with exit code {run.returncode}'+
                             (f' (synthetic CI diagnostic: {detail})' if detail else ''))
    filenames = _inspect_zip(run.stdout)
    return EngineResult(run.stdout, filenames,
                        run.stderr.decode('utf-8', errors='replace')[-2500:])
