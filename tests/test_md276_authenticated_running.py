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


def explicit_two_colour_source_plan(browser_plan,working):
    """Controlled synthetic alternative: all pixels retained, exactly 2 threads.

    This is NOT an algorithm for assigning the right colours on real artwork.
    Demonstrates the same-source distinction between a fragmented colour
    segmentation and an explicit stable eye/body source ledger.
    """
    import copy
    from artwork_packet import regions_from_labels, foreground
    w,h=browser_plan['source']['width'],browser_plan['source']['height']
    rgba=np.frombuffer(working,np.uint8).reshape((h,w,4))
    visible=foreground(rgba)
    palette=['#122432','#DC6428']
    rgb=np.array([[18,36,50],[220,100,40]],dtype=np.int16)
    delta=((rgba[...,:3].astype(np.int16)[...,None,:]-rgb)**2).sum(axis=3)
    labels=np.zeros((h,w),dtype=np.uint8)
    labels[visible]=np.argmin(delta[visible],axis=1).astype(np.uint8)+1
    regions,parts=regions_from_labels(labels,palette)
    planned=copy.deepcopy(browser_plan)
    planned['regions']=regions
    count=int(visible.sum())
    planned['summary'].update(sourcePixels=count,representedPixels=count,
        sourceParts=parts,workingParts=parts,omittedPixels=0)
    planned['sourcePlanSignature']=sha256(
        b'MD276-SYNTHETIC-TWO-COLOUR\x00'+working+labels.tobytes()).hexdigest()
    return planned


class OriginalBoundRunningDetailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=TemporaryDirectory(prefix='md276-')
        cls.folder=Path(cls.temp.name)
        cls.browser_plan,cls.original,cls.working,cls.windows=synthetic_source(cls.folder)
        cls.plan=explicit_two_colour_source_plan(cls.browser_plan,cls.working)
        cls.windows[0]['color']='#122432'

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_original_browser_palette_fragments_eye_and_safely_refuses_running(self):
        review=propose_authenticated_running_details(
            self.browser_plan,self.original,self.working,
            [{'id':'dark-eye-outline','rect':[158,108,222,171],'color':'#122432'}])
        self.assertEqual(review['candidateCount'],0)
        self.assertEqual(review['rejected'][0]['reason'],
                         'NO_COMPLETE_ORIGINAL_AND_WORKING_COLOUR_CONTOUR')

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
