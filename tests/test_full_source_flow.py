"""MD-2.69 original PNG retention and physical directional evidence tests."""
import sys
import unittest
from io import BytesIO
from hashlib import sha256
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from full_source_flow import analyse_source_png


def sample(kind='stripes'):
    im=Image.new('RGBA',(240,220),(20,100,160,255))
    if kind=='stripes':
        d=ImageDraw.Draw(im)
        for x in range(0,260,15):
            d.line((x,0,x,220),fill=(240,240,240,255),width=5)
    elif kind=='diagonal':
        d=ImageDraw.Draw(im)
        for x in range(-160,260,18):
            d.line((x,0,x+220,220),fill=(230,230,230,255),width=6)
    out=BytesIO()
    im.save(out,format='PNG')
    return out.getvalue()


class FullSourceFlowTests(unittest.TestCase):
    def test_uses_the_exact_full_original_and_is_deterministic(self):
        original=sample('diagonal')
        a=analyse_source_png(original,image_width_mm=80)
        b=analyse_source_png(original,image_width_mm=80)
        self.assertEqual(a,b)
        self.assertEqual(a['sourceSha256'],sha256(original).hexdigest())
        self.assertEqual(a['originalPixels'],[240,220])
        self.assertGreater(a['guideCount'],50)
        self.assertEqual(a['analysisGridPx'],[667,611])
        self.assertFalse(a['sourcePixelsReducedBeforeAnalysis'])
        self.assertFalse(a['semanticObjectsIdentified'])
        self.assertFalse(a['nativePESDSTGenerated'])
        self.assertFalse(a['machineApproved'])
        self.assertFalse(a['physicalSewoutVerified'])

    def test_direction_tracks_actual_source_stripes(self):
        vertical=analyse_source_png(sample('stripes'))
        diagonal=analyse_source_png(sample('diagonal'))
        self.assertGreater(vertical['guideCount'],50)
        self.assertGreater(diagonal['guideCount'],50)
        def sample_angle(values):
            return [x['textureTangentDeg'] for x in values['candidateLocalGuides']]
        # Stripe direction is axial modulo 180.
        self.assertGreater(sum(70<a<110 for a in sample_angle(vertical))/vertical['guideCount'],.85)
        self.assertGreater(sum(25<a<70 for a in sample_angle(diagonal))/diagonal['guideCount'],.65)

    def test_flat_image_does_not_invent_guides(self):
        report=analyse_source_png(sample('flat'))
        self.assertEqual(report['guideCount'],0)

    def test_rejects_bad_source_and_unsewable_physical_size(self):
        with self.assertRaises(ValueError):
            analyse_source_png(b'NOT A PNG')
        with self.assertRaises(ValueError):
            analyse_source_png(sample('flat'),image_width_mm=500)
        with self.assertRaises(ValueError):
            analyse_source_png(sample('flat'),image_width_mm=250,
                               analysis_mm_per_pixel=.01)
        with self.assertRaises(ValueError):
            analyse_source_png(sample('flat'),image_width_mm=True)
        with self.assertRaises(ValueError):
            analyse_source_png(sample('flat'),image_width_mm=80,
                               analysis_mm_per_pixel=.3)

    def test_rejects_missing_foreground(self):
        im=Image.new('RGBA',(240,220),(0,0,0,0))
        data=BytesIO()
        im.save(data,format='PNG')
        with self.assertRaises(ValueError):
            analyse_source_png(data.getvalue())


if __name__=='__main__':
    unittest.main()
