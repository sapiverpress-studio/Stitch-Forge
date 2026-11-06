"""MD-2.76: authentic V2 original->working source before extra running pass.

Synthetic artwork only. No private Kingfisher or machine quality approval.
"""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from hashlib import sha256
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services'/'digitiser'))
from authenticated_running_detail import (
    bind_private_original,propose_authenticated_running_details)
from artwork_trial import build_trial_svg
from legacy_staged_passes import split_legacy_svg


def synthetic_source(folder):
    im=Image.new('RGBA',(320,320),(0,0,0,0))
    d=ImageDraw.Draw(im)
    d.ellipse((40,40,280,280),fill=(220,100,40,255))
    d.ellipse((172,122,208,158),fill=(18,36,50,255))
    original=folder/'original.png'
    im.save(original)
    reduced=im.resize((160,160),Image.Resampling.LANCZOS)
    working=folder/'working.rgba'
    working.write_bytes(np.asarray(reduced,dtype=np.uint8).tobytes())
    subprocess.run(['node',str(ROOT/'tools'/'prepare_artwork_trial.cjs'),
                    str(working),'160','160','80',str(folder),'320','320'],
                   cwd=ROOT,check=True,capture_output=True,timeout=90)
    plan=json.loads((folder/'source-object-plan.json').read_text())
    palette=[r['color'] for r in plan['regions']]
    # Pick the *actual source-ledger owner* of the centre eye pixel, not
    # the darkest palette swatch (which may describe an antialiased fringe).
    dark=next(r['color'] for r in plan['regions']
              if any(y==70 and x0<=95<x1
                     for component in r['ledger']['components']
                     for y,x0,x1 in component['runs']))
    windows=[{'id':'dark-eye-outline','rect':[158,108,222,171],'color':dark}]
    return plan,original.read_bytes(),working.read_bytes(),windows


class OriginalBoundRunningDetailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=TemporaryDirectory(prefix='md276-')
        cls.folder=Path(cls.temp.name)
        cls.plan,cls.original,cls.working,cls.windows=synthetic_source(cls.folder)

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_source_binding_proves_both_image_sha_and_ledger(self):
        original,reduced,masks,scale,proof=bind_private_original(
            self.plan,self.original,self.working)
        self.assertEqual(original.shape[:2],(320,320))
        self.assertEqual(reduced.shape[:2],(160,160))
        self.assertTrue(proof['originalSourceSha256Verified'])
        self.assertTrue(proof['preparedForegroundMatchesColourLedger'])
        self.assertEqual(proof['originalPngSha256'],sha256(self.original).hexdigest())
        self.assertEqual(sum(int(m.sum()) for m in masks.values()),
                         self.plan['summary']['sourcePixels'])

    def test_original_derived_eye_contour_is_bounded_and_source_verified(self):
        review=propose_authenticated_running_details(
            self.plan,self.original,self.working,self.windows)
        self.assertEqual(review['candidateCount'],1, {'rejected':review['rejected'], 'palette':[r['color'] for r in self.plan['regions']], 'regionPixelAreas':[r['ledger']['foregroundPixels'] for r in self.plan['regions']]})
        candidate=review['candidates'][0]
        self.assertEqual(candidate['id'],'dark-eye-outline')
        self.assertGreater(candidate['lengthMm'],2.5)
        self.assertLess(candidate['lengthMm'],45)
        self.assertFalse(candidate['semanticFeatureIdentified'])
        self.assertGreater(len(candidate['points']),5)

    def test_fresh_native_builder_has_one_additional_running_object(self):
        base,old,old_masks=build_trial_svg(self.plan,partition_fills=True)
        with_explicit={'originalPng':self.original,'workingRgba':self.working,
                       'windows':self.windows,'selectedIds':['dark-eye-outline']}
        trial,new,new_masks=build_trial_svg(self.plan,partition_fills=True,
            staged_running_source=with_explicit)
        self.assertNotEqual(base,trial)
        self.assertEqual(new['sourceRunningDetailTrial']['acceptedObjects'],1)
        self.assertTrue(new['sourceRunningDetailTrial']['sourceOriginalPngSha256Verified'])
        self.assertEqual(new['nativePaths'],old['nativePaths']+1)
        self.assertEqual(old['sourcePlanSignature'],new['sourcePlanSignature'])
        for color in old_masks:
            self.assertTrue(np.array_equal(old_masks[color],new_masks[color]))
        staged=split_legacy_svg(trial)
        self.assertEqual(staged.manifest['counts']['running'],
            split_legacy_svg(base).manifest['counts']['running']+1)

    def test_empty_optional_stage_preserves_original_svg_bytes(self):
        a,_,_=build_trial_svg(self.plan,partition_fills=True)
        b,_,_=build_trial_svg(self.plan,partition_fills=True,staged_running_source=None)
        self.assertEqual(a,b)

    def test_fail_closed_on_modified_original_or_working_pixels(self):
        changed=bytearray(self.working);changed[4500]^=1
        with self.assertRaisesRegex(ValueError,'SHA256'):
            bind_private_original(self.plan,self.original,bytes(changed))
        with Image.open(self.folder/'original.png') as im:
            altered=im.copy()
            altered.putpixel((190,140),(10,240,240,255))
            from io import BytesIO
            buffer=BytesIO();altered.save(buffer,format='PNG')
        with self.assertRaisesRegex(ValueError,'colours|match|reproduce exact'):
            bind_private_original(self.plan,buffer.getvalue(),self.working)

    def test_fail_closed_on_unsupported_selection_and_windows(self):
        source={'originalPng':self.original,'workingRgba':self.working,
                'windows':self.windows,'selectedIds':['unproven-shape']}
        with self.assertRaisesRegex(ValueError,'unsupported|Unsupported|source'):
            build_trial_svg(self.plan,partition_fills=True,
                staged_running_source=source)
        bad=[{'id':'unsafe','rect':[-1,0,100,100],'color':self.windows[0]['color']}]
        with self.assertRaises(ValueError):
            propose_authenticated_running_details(self.plan,self.original,self.working,bad)


if __name__=='__main__':
    unittest.main()
