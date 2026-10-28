"""Verify Linux upstream release lookup cannot select the wrong architecture."""
import json
from io import BytesIO
from pathlib import Path
import sys
import tarfile
from tempfile import TemporaryDirectory
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from release_asset import select_linux_x64_asset, extract_verified_release


def release(name='inkstitch-3.3.0-linux.tar.xz', **other):
    return json.dumps({'tag_name': 'v3.3.0', 'draft': False, 'prerelease': False, 'assets': [
        {'name': 'inkstitch-3.3.0-linux-arm64.tar.xz', 'browser_download_url': 'https://github.com/x'},
        {'name': name, 'browser_download_url': f'https://github.com/inkstitch/inkstitch/releases/download/v3.3.0/{name}'},
    ], **other}).encode()


class ReleaseAssetTests(unittest.TestCase):
    def test_official_generic_linux_asset_selected(self):
        name, url, digest = select_linux_x64_asset(release())
        self.assertEqual(name, 'inkstitch-3.3.0-linux.tar.xz')
        self.assertIsNone(digest)
        self.assertTrue(url.startswith('https://github.com/inkstitch/'))

    def test_wrong_arch_or_ambiguous_asset_refused(self):
        for name in ['inkstitch-3.3.0-linux-arm64.tar.xz', 'inkstitch-3.3.0-linux-i386.tar.xz']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                select_linux_x64_asset(release(name))
        metadata = json.loads(release())
        metadata['assets'].append(metadata['assets'][-1])
        with self.assertRaises(ValueError):
            select_linux_x64_asset(json.dumps(metadata).encode())

    def test_wrong_tag_or_host_refused(self):
        d = json.loads(release())
        d['tag_name'] = 'v0.0.0'
        with self.assertRaises(ValueError):
            select_linux_x64_asset(json.dumps(d).encode())
        d = json.loads(release())
        d['assets'][-1]['browser_download_url'] = 'https://attacker.example/malware.tar.xz'
        with self.assertRaises(ValueError):
            select_linux_x64_asset(json.dumps(d).encode())

    def test_archive_path_traversal_refused(self):
        with TemporaryDirectory() as tmp:
            archive, target = Path(tmp, 'bad.tar.xz'), Path(tmp, 'extracted')
            with tarfile.open(archive, 'w:xz') as out:
                payload = b'secret'
                t = tarfile.TarInfo('../secret'); t.size = len(payload)
                out.addfile(t, BytesIO(payload))
            with self.assertRaises(ValueError):
                extract_verified_release(archive, target)
            self.assertFalse(Path(tmp, 'secret').exists())

    def test_legitimate_simple_archive_extracts(self):
        with TemporaryDirectory() as tmp:
            archive, target = Path(tmp, 'good.tar.xz'), Path(tmp, 'extracted')
            with tarfile.open(archive, 'w:xz') as out:
                payload = b'#!/bin/sh\necho ok\n'
                t = tarfile.TarInfo('inkstitch/inkstitch'); t.size = len(payload); t.mode = 0o755
                out.addfile(t, BytesIO(payload))
            extract_verified_release(archive, target)
            self.assertEqual(Path(target, 'inkstitch/inkstitch').read_bytes(), payload)
