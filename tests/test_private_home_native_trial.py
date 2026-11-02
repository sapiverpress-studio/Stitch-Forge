"""Private Home test wrapper must never send user art to GitHub or a server."""
import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image, ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import private_home_native_trial as private


def source():
    im=Image.new('RGBA',(200,180),(0,0,0,0))
    p=ImageDraw.Draw(im)
    p.ellipse((25,17,140,166),fill=(20,80,160,255))
    p.ellipse((75,28,144,144),fill=(234,112,17,255))
    p.ellipse((102,29,112,39),fill=(14,20,24,255))
    p.line([(4,166),(186,166)],fill=(102,75,43,255),width=7)
    return im


class PrivateWorkflowTests(unittest.TestCase):
    def test_source_stays_local_outputs_are_owner_only_and_holds(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root)
            art=base/'private-source.png'
            bin=base/'trusted-inkstitch'
            out=base/'output'
            source().save(art)
            bin.write_bytes(b'bounded-synthetic-stub')
            # The mock replaces native execution; real machine CI is separate.
            report={
                'decoded':[
                    {'format':'dst','needleStitches':50,'trims':0,
                     'needlePointsOutsideWorkingColour':0,'needleSegmentsOutsideWorkingColour':0},
                    {'format':'pes','needleStitches':50,'trims':3,
                     'needlePointsOutsideWorkingColour':0,'needleSegmentsOutsideWorkingColour':0}],
                'machineEligible':False,'physicalQualityVerified':False,
                'nativePaths':12,'unresolvedObjects':2,'blockers':['physical_quality_unverified']
            }
            with patch.object(private,'run_trial',return_value=report) as call:
                result=private.run(art,bin,out,colours=8)
            self.assertEqual(call.call_count,1)
            self.assertTrue(result['nativePESDSTExportPassed'])
            self.assertFalse(result['machineApproved'])
            self.assertFalse(result['imageUploadedToRemote'])
            self.assertEqual(result['PEStrims'],3)
            self.assertEqual(out.stat().st_mode & 0o777,0o700)
            receipt=out/'PRIVATE-KINGFISHER-HOME-TEST-NOT-APPROVED.json'
            self.assertEqual(receipt.stat().st_mode & 0o777,0o600)
            self.assertIn('HOLD',json.loads(receipt.read_text())['acceptance'])

    def test_invalid_art_or_missing_engine_fails_without_network(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)
            art=path/'source.png'
            source().save(art)
            with self.assertRaises(ValueError):
                private.run(art,path/'no-engine',path/'output')


if __name__=='__main__':
    unittest.main()
