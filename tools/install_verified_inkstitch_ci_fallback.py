#!/usr/bin/env python3
"""CI-only mirror fallback for the EXACT pinned upstream Ink/Stitch 3.3.0 archive.

The SHA256 MUST match the official checked-in release digest. This is never
installed in the Netlify site or the production worker and never bypasses
the pinned archive extractor's path/symlink checks.
"""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services'/'digitiser'))
from install_engine import SHA256
from release_asset import extract_verified_release

MIRROR=('https://downloads.sourceforge.net/project/ink-stitch.mirror/'
        'v3.3.0/inkstitch-3.3.0-linux-x86_64.tar.xz')
MAX_BYTES=250_000_000


def install(destination):
    destination=Path(destination)
    with TemporaryDirectory(prefix='sf-ci-native-download-') as tmp:
        archive=Path(tmp)/'engine.tar.xz'
        request=urllib.request.Request(MIRROR,headers={'User-Agent':'StitchForge-verified-CI/1.0'})
        digest=sha256()
        total=0
        with urllib.request.urlopen(request,timeout=120) as incoming,archive.open('wb') as out:
            for part in iter(lambda:incoming.read(1024*1024),b''):
                total+=len(part)
                if total>MAX_BYTES:
                    raise ValueError('Mirror exceeded pinned archive budget')
                digest.update(part);out.write(part)
        if digest.hexdigest()!=SHA256:
            raise ValueError('Mirror bytes DO NOT match official pinned Ink/Stitch 3.3.0 SHA256')
        extract_verified_release(archive,destination)
    binaries=[p for p in destination.rglob('inkstitch')
              if p.is_file() and not p.is_symlink()]
    if len(binaries)!=1:
        raise ValueError('Verified archive must contain exactly one native executable')
    (destination/'engine-path').write_text(str(binaries[0].resolve()))
    print('Official v3.3.0 binary verified against pinned SHA256; mirror was transport only')


if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: installer <destination>')
    install(Path(sys.argv[1]))
