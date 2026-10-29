"""Real subprocess regressions; synthetic scripts, never customer artwork."""
import os
import sys
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from inkstitch_cli import _run_engine, DigitiserError
import subprocess

class ProcessTests(unittest.TestCase):
    def test_timeout_kills_descendants(self):
        with TemporaryDirectory() as tmp:
            marker=Path(tmp)/'child-survived'
            child=f'import time; from pathlib import Path; time.sleep(1.4); Path({str(marker)!r}).write_text("bad")'
            parent=f'import subprocess,sys,time; subprocess.Popen([sys.executable,"-c",{child!r}]); time.sleep(10)'
            started=time.monotonic()
            with self.assertRaises(subprocess.TimeoutExpired):
                _run_engine([sys.executable,'-c',parent],timeout_seconds=.2)
            self.assertLess(time.monotonic()-started,1)
            time.sleep(1.5)
            self.assertFalse(marker.exists())

    def test_large_output_fails_closed(self):
        with self.assertRaises(DigitiserError):
            _run_engine([sys.executable,'-c','import sys; sys.stderr.write("x"*1100000)'],timeout_seconds=2)

    def test_success_returns_bytes(self):
        result=_run_engine([sys.executable,'-c','print("synthetic")'],timeout_seconds=2)
        self.assertEqual(result.returncode,0)
        self.assertEqual(result.stdout,b'synthetic\n')
