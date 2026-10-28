"""Mocked Ink/Stitch wrapper tests; these DO NOT invoke the real embroidery engine."""
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, mock
import subprocess
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from inkstitch_cli import DigitiserError, _inspect_zip, export_trusted_svg


def zip_bytes(*pairs):
    out = BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        for name, content in pairs:
            z.writestr(name, content)
    return out.getvalue()


class AdapterTests(TestCase):
    def test_rejects_invalid_zip_paths_and_missing_formats(self):
        with self.assertRaises(DigitiserError):
            _inspect_zip(zip_bytes(('../danger.pes', b'test'), ('ok.dst', b'test')))
        with self.assertRaises(DigitiserError):
            _inspect_zip(zip_bytes(('a.pes', b'test')))
        with self.assertRaises(DigitiserError):
            _inspect_zip(b'not-a-zip')
        self.assertEqual(
            _inspect_zip(zip_bytes(('a.dst', b'x'), ('a.pes', b'x'), ('threadlist.txt', b'1'))),
            ('a.dst', 'a.pes', 'threadlist.txt'))

    def test_safe_argv_and_successful_zip_return(self):
        with TemporaryDirectory() as d:
            root = Path(d)
            svg = root / 'no shell;touch hacked.svg'
            svg.write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>')
            exe = root / 'inkstitch'
            exe.write_text('placeholder')
            payload = zip_bytes(('sample.dst', b'x'), ('sample.pes', b'x'))
            with mock.patch('inkstitch_cli.subprocess.run',
                            return_value=subprocess.CompletedProcess([], 0, payload, b'')) as runner:
                result = export_trusted_svg(svg, executable=exe)
            argv = runner.call_args.args[0]
            self.assertEqual(argv[-1], str(svg))
            self.assertFalse(runner.call_args.kwargs['shell'])
            self.assertEqual(result.filenames, ('sample.dst', 'sample.pes'))

    def test_timeout_and_nonzero_exit_are_reported(self):
        with TemporaryDirectory() as d:
            root = Path(d)
            svg = root / 'test.svg'
            svg.write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>')
            exe = root / 'inkstitch'
            exe.write_text('placeholder')
            with mock.patch('inkstitch_cli.subprocess.run',
                            side_effect=subprocess.TimeoutExpired('inkstitch', 1)):
                with self.assertRaisesRegex(DigitiserError, 'timeout'):
                    export_trusted_svg(svg, executable=exe)
            with mock.patch('inkstitch_cli.subprocess.run',
                            return_value=subprocess.CompletedProcess([], 2, b'', b'oops')):
                with self.assertRaisesRegex(DigitiserError, 'exit code 2'):
                    export_trusted_svg(svg, executable=exe)
