"""Build-time installer for the reviewed official Linux x86_64 archive."""
import hashlib
import sys
import urllib.request
from pathlib import Path
from tempfile import TemporaryDirectory
from release_asset import extract_verified_release

URL = 'https://github.com/inkstitch/inkstitch/releases/download/v3.3.0/inkstitch-3.3.0-linux-x86_64.tar.xz'
SHA256 = '162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79'

def install(destination):
    with TemporaryDirectory() as tmp:
        archive = Path(tmp) / 'engine.tar.xz'
        with urllib.request.urlopen(URL, timeout=120) as response, archive.open('wb') as output:
            total = 0
            while block := response.read(1024 * 1024):
                total += len(block)
                if total > 250_000_000:
                    raise ValueError('Engine download exceeds limit')
                output.write(block)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
            raise ValueError('Pinned engine digest mismatch')
        extract_verified_release(archive, destination)
    binaries = [p for p in destination.rglob('inkstitch') if p.is_file() and not p.is_symlink()]
    if len(binaries) != 1:
        raise ValueError('Expected one native engine')
    (destination / 'engine-path').write_text(str(binaries[0].resolve()))

if __name__ == '__main__':
    install(Path(sys.argv[1]))
