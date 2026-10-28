"""Test the native job approval boundary without external Ink/Stitch invocation."""
import json
from pathlib import Path
import sys
import unittest
from unittest import mock
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
from machine_job import run_machine_job
from inkstitch_cli import DigitiserError, EngineResult

PROJECT={'width':78,'hoop':150,
  'paths':[[[100,100],[200,100],[200,220],[100,220],[100,100]],
           [[120,170],[160,200]]],
  'pathStyles':['tatami','running'],
  'pathColors':['#AABBCC','#112233']}

def reports(changes=(1,1), stitches=(200,200)):
    return tuple(SimpleNamespace(format=fmt,needle_stitches=n,jumps=3,changes=c,
              bounds_mm=(30,35)) for fmt,n,c in zip(('pes','dst'),stitches,changes))

class MachineJobTests(unittest.TestCase):
    def test_no_archive_until_independent_reader_passes(self):
        project=json.dumps(PROJECT).encode()
        with mock.patch('machine_job.export_trusted_svg',
              return_value=EngineResult(b'PK\\x03\\x04'+b'A'*180,('embroidery.pes','embroidery.dst'),'')):
            with mock.patch('machine_job.audit_zip',return_value=reports()):
                job=run_machine_job(project,executable=Path('/fake/inkstitch'))
                self.assertEqual(job.summary[0]['changes'],1)
                self.assertEqual(len(job.digest),64)
            with mock.patch('machine_job.audit_zip',side_effect=DigitiserError('invalid PES')):
                with self.assertRaisesRegex(DigitiserError,'invalid PES'):
                    run_machine_job(project,executable=Path('/fake/inkstitch'))

    def test_mismatched_machine_colors_and_stitches_rejected(self):
        project=json.dumps(PROJECT).encode()
        with mock.patch('machine_job.export_trusted_svg',
             return_value=EngineResult(b'PK\\x03\\x04'+b'A'*180,('embroidery.pes','embroidery.dst'),'')):
            for report in [reports(changes=(0,0)),reports(changes=(1,2)),
                           reports(stitches=(200,270))]:
                with self.subTest(report=report),mock.patch('machine_job.audit_zip',return_value=report):
                    with self.assertRaises(DigitiserError):
                        run_machine_job(project,executable=Path('/fake/inkstitch'))

    def test_generated_svg_contains_no_embedded_original_reference(self):
        project=json.dumps({**PROJECT,'reference':'data:image/png;base64,PRIVATE-MOTH'}).encode()
        captured=[]
        def engine(svg,**kw):
            captured.append(svg.read_bytes())
            return EngineResult(b'PK\\x03\\x04'+b'A'*180,('embroidery.pes','embroidery.dst'),'')
        with mock.patch('machine_job.export_trusted_svg',side_effect=engine):
            with mock.patch('machine_job.audit_zip',return_value=reports()):
                run_machine_job(project,executable=Path('/fake/inkstitch'))
        self.assertNotIn(b'PRIVATE-MOTH',captured[0])
        self.assertIn(b'inkstitch_svg_version',captured[0])
