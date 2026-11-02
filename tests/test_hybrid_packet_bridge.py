"""Only verifies compatibility with the existing signed-source packet parser."""
import base64
import json
import sys
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from hybrid_packet_bridge import prepare_verified_packet, prepare_native_input_candidate
from artwork_packet import decode_packet


def fixture():
    canvas=Image.new('RGBA',(232,200),(0,0,0,0))
    pen=ImageDraw.Draw(canvas)
    pen.ellipse((20,15,153,178), fill=(8,96,153,255))
    pen.ellipse((88,25,149,126),fill=(234,118,15,255))
    pen.ellipse((100,24,115,40), fill=(9,18,19,255))
    pen.line([(2,182),(222,170)],fill=(110,73,38,255),width=9)
    pen.ellipse((160,129,217,175),fill=(54,111,49,255))
    pen.ellipse((170,132,205,154),fill=(70,150,67,255))
    return canvas


class HybridPacketBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet,cls.proof=prepare_verified_packet(fixture(),colours=8)

    def test_existing_worker_contract_decodes_original_source(self):
        plan,meta,identity,binding=decode_packet(self.packet)
        self.assertEqual(identity,self.proof['requestId'])
        self.assertTrue(binding['foregroundIndependentlyVerified'])
        self.assertEqual(plan['summary']['workingParts'],self.proof['nativeConnectedParts'])
        self.assertEqual(plan['summary']['sourcePixels'],self.proof['sourceForegroundPixels'])
        self.assertEqual(plan['summary']['representedPixels'],self.proof['sourceForegroundPixels'])
        self.assertEqual(meta['palette'],sorted(meta['palette']))
        self.assertEqual(self.proof['requestedVisibleWidthMm'],80)
        self.assertEqual(plan['machineEligible'],False)
        self.assertFalse(self.proof['machineFileGenerated'])
        self.assertFalse(self.proof['physicalQualityVerified'])
        self.assertIn('HOLD',self.proof['approval'])

    def test_source_binding_cannot_be_reused_for_changed_colour_labels(self):
        broken=self.packet.copy()
        raw=bytearray(base64.b64decode(self.packet['labelsGzip']))
        raw[-1] ^= 1
        broken['labelsGzip']=base64.b64encode(raw).decode()
        with self.assertRaises(ValueError):
            decode_packet(broken)

    def test_does_not_send_any_worker_request_or_produce_machine_files(self):
        self.assertEqual(self.packet['phase'],'pes')
        self.assertEqual(set(self.packet),{'header','rgbaGzip','labelsGzip','requestId','phase'})
        self.assertNotIn('pesBase64',self.packet)
        self.assertNotIn('dstBase64',self.packet)
        self.assertEqual(self.proof['schema'],'stitch-forge-hybrid-worker-compatibility-v1')

    def test_hybrid_source_geometry_builds_real_native_input_without_fake_pes(self):
        svg, evidence=prepare_native_input_candidate(fixture(),colours=8)
        self.assertTrue(svg.startswith(b'<?xml'))
        self.assertIn(b'xmlns:inkstitch',svg)
        self.assertGreater(evidence['nativePaths'],0)
        self.assertTrue(evidence['nativeSvgInputGenerated'])
        self.assertTrue(evidence['foregroundIndependentlyVerified'])
        self.assertFalse(evidence['nativeFileGenerated'])
        self.assertFalse(evidence['physicalQualityVerified'])
        self.assertIn('HOLD',evidence['approval'])


if __name__=='__main__':
    unittest.main()
