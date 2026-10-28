"""Select a specific official Ink/Stitch Linux release archive without architecture ambiguity.

This validates release metadata, *not* authenticity of downloaded bytes. Pin a verified
SHA-256 in a future release-lock after the official asset has been fetched and audited.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import re
import tarfile

EXPECTED_TAG = 'v3.3.0'
_ALLOWED = frozenset({
    'inkstitch-3.3.0-linux.tar.xz',
    'inkstitch-3.3.0-linux-x86_64.tar.xz',
    'inkstitch-3.3.0-linux-amd64.tar.xz',
})


def select_linux_x64_asset(release_json: bytes) -> tuple[str, str, str | None]:
    """Return (filename, upstream URL, optional sha256 digest) or fail closed."""
    if len(release_json) > 4_000_000:
        raise ValueError('Release metadata oversized')
    try:
        info = json.loads(release_json)
    except (ValueError, UnicodeError) as exc:
        raise ValueError('Invalid JSON release metadata') from exc
    if (not isinstance(info, dict) or info.get('tag_name') != EXPECTED_TAG
            or info.get('draft') is True or info.get('prerelease') is True):
        raise ValueError('Wrong release tag or unstable upstream release')
    assets = info.get('assets', [])
    if not isinstance(assets, list) or len(assets) > 200:
        raise ValueError('Missing or implausible release assets')
    selected = [a for a in assets if isinstance(a, dict) and a.get('name') in _ALLOWED]
    if len(selected) != 1:
        raise ValueError('Expected exactly one Linux x86_64 archive; candidates: '
                         + repr(sorted(str(a.get('name', '')) for a in assets)[:30]))
    a = selected[0]
    name, url = a['name'], a.get('browser_download_url', '')
    parsed = urlparse(url)
    if (parsed.scheme != 'https' or parsed.netloc != 'github.com'
            or unquote(Path(parsed.path).name) != name
            or '/inkstitch/inkstitch/releases/download/v3.3.0/' not in parsed.path
            or parsed.query or parsed.fragment):
        raise ValueError('Unexpected upstream release asset URL')
    digest = a.get('digest')
    if digest is not None and not (isinstance(digest, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', digest)):
        raise ValueError('Unexpected release asset digest')
    return name, url, digest.split(':')[1] if digest else None


def extract_verified_release(archive: Path, destination: Path) -> None:
    """Extract a constrained official tarball; rejects nonregular entries and traversal."""
    archive, destination = Path(archive), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, 'r:xz') as tar:
        entries = tar.getmembers()
        if len(entries) > 25_000 or not entries:
            raise ValueError('Unexpected archive entry count')
        total = 0
        for member in entries:
            p = Path(member.name)
            if (p.is_absolute() or '..' in p.parts or member.issym() or member.islnk()
                    or not (member.isfile() or member.isdir())):
                raise ValueError('Unsafe archive path or entry type: '+repr(member.name[:160])+' type='+repr(member.type))
            total += member.size
            if member.size > 400_000_000 or total > 1_000_000_000:
                raise ValueError('Archive expands beyond limit')
        tar.extractall(path=destination, filter='data')
