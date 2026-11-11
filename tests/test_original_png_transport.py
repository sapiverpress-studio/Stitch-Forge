"""MD-2.70: no private art; source-bound full PNG V2 transport compatibility.

Ensures original bytes are SHA bound to the existing v1 per-pixel request
identity, correspond to the actual reduced artwork, and never appear in the
machine report. This DOES NOT prove better embroidery output.
"""
import base64
import gzip
from hashlib import sha256
from io import BytesIO
import json
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from artwork_packet import decode_packet
from test_home_live_bridge import browser_packet, illustration


def png_bytes(im):
    stream=BytesIO()
    im.save(stream,format='PNG')
    return stream.getvalue()


def v2_packet(original, *, working=None, full_image=False):
    w,h=original.size
    if working is None:
        working=original.resize((max(48,w//2),max(48,h//2)),Image.Resampling.LANCZOS)
    packet=browser_packet(working, full_image=full_image)
    meta=json.loads(packet['header'])
    meta['schema']='stitch-forge-artwork-request-v2'
    if full_image:
        meta['fullImage']=True
    meta['source']['originalWidth']=w
    meta['source']['originalHeight']=h
    original_bytes=png_bytes(original)
    meta['originalPng']={'sha256':sha256(original_bytes).hexdigest(),'bytes':len(original_bytes)}
    # Same browser requestId rule as V1: header+verified reduced RGBA+labels.
    # Header now SHA-binds the original unmodified PNG bytes.
    source=gzip.decompress(base64.b64decode(packet['rgbaGzip']))
    labels=gzip.decompress(base64.b64decode(packet['labelsGzip']))
    header=json.dumps(meta,separators=(',',':'))
    packet['header']=header
    packet['requestId']=sha256(header.encode()+source+labels).hexdigest()
    packet['originalPngBase64']=base64.b64encode(original_bytes).decode()
    return packet


class OriginalPngTransportTests(unittest.TestCase):
    def test_full_image_rebuild_preserves_opaque_edges_and_transparent_void(self):
        from home_live_bridge import derive_hybrid_plan

        image=Image.new('RGBA',(160,120),(238,216,177,255))
        d=ImageDraw.Draw(image)
        d.rectangle((81,0,159,119),fill=(68,108,45,255))
        d.ellipse((30,37,47,49),fill=(0,0,0,0))
        packet=v2_packet(image,working=image,full_image=True)
        plan,meta,identity,binding=decode_packet(packet)
        expected=np.asarray(image)[:,:,3]>60
        self.assertEqual(plan['summary']['sourcePixels'],int(expected.sum()))
        self.assertTrue(binding['fullImage'])
        self.assertTrue(binding['originalSourceSha256Verified'])
        with patch.dict('os.environ', {'STITCH_FORGE_PRESERVE_FINE_DETAIL':'1'}):
            hybrid,evidence,report=derive_hybrid_plan(packet,plan,meta,identity,binding)
        rebuilt=np.zeros(expected.shape,dtype=bool)
        for region in hybrid['regions']:
            for component in region['ledger']['components']:
                for y,x0,x1 in component['runs']:
                    rebuilt[y,x0:x1]=True
        np.testing.assert_array_equal(rebuilt,expected)
        self.assertEqual(hybrid['physical'],plan['physical'])
        self.assertTrue(evidence['fullImage'])
        self.assertIn('preserveFineDetail',report)

        meta.pop('fullImage')
        header=json.dumps(meta,separators=(',',':'))
        raw=gzip.decompress(base64.b64decode(packet['rgbaGzip']))
        labels=gzip.decompress(base64.b64decode(packet['labelsGzip']))
        with self.assertRaisesRegex(ValueError,'Complex background'):
            decode_packet({**packet,'header':header,
                           'requestId':sha256(header.encode()+raw+labels).hexdigest()})

    def test_legacy_v1_remains_identical(self):
        packet=browser_packet(illustration())
        plan,meta,identity,evidence=decode_packet(packet)
        self.assertEqual(meta['schema'],'stitch-forge-artwork-request-v1')
        self.assertEqual(identity,packet['requestId'])
        self.assertNotIn('originalSourceSha256Verified',evidence)

    def test_v2_opaque_and_transparent_png_binding(self):
        for mode in ('transparent','opaque'):
            with self.subTest(mode=mode):
                original=illustration(mode).resize((464,400),Image.Resampling.NEAREST)
                packet=v2_packet(original)
                plan,meta,identity,evidence=decode_packet(packet)
                self.assertEqual(identity,packet['requestId'])
                self.assertEqual(meta['originalPng']['sha256'],
                                 sha256(base64.b64decode(packet['originalPngBase64'])).hexdigest())
                self.assertEqual(evidence['originalPixelDimensionsVerified'],[464,400])
                self.assertTrue(evidence['originalSourceSha256Verified'])
                self.assertGreater(evidence['foregroundIntersectionOverUnion'],.94)
                self.assertLess(evidence['sourceToReducedMeanAbsoluteRgb'],18)
                self.assertFalse(evidence['sourceSemanticFeaturesVerified'])
                self.assertNotIn('originalPngBase64',json.dumps(evidence))
                self.assertEqual(plan['source']['originalWidth'],464)

    def test_full_artwork_is_same_artwork_not_different_png(self):
        original=illustration().resize((464,400),Image.Resampling.NEAREST)
        packet=v2_packet(original)
        changed=Image.new('RGBA',(464,400),(230,40,40,255))
        wrong=png_bytes(changed)
        metadata=json.loads(packet['header'])
        metadata['originalPng']={'sha256':sha256(wrong).hexdigest(),'bytes':len(wrong)}
        packet['header']=json.dumps(metadata,separators=(',',':'))
        raw=__import__('gzip').decompress(base64.b64decode(packet['rgbaGzip']))
        labels=__import__('gzip').decompress(base64.b64decode(packet['labelsGzip']))
        packet['requestId']=sha256(packet['header'].encode()+raw+labels).hexdigest()
        packet['originalPngBase64']=base64.b64encode(wrong).decode()
        with self.assertRaisesRegex(ValueError,'foreground|colours'):
            decode_packet(packet)

    def test_corruption_and_missing_field_are_rejected_before_svg(self):
        good=v2_packet(illustration().resize((464,400),Image.Resampling.NEAREST))
        for changed in (
            {**good,'originalPngBase64':'!corrupt'},
            {**good,'originalPngBase64':base64.b64encode(b'tampered').decode()},
            {k:v for k,v in good.items() if k!='originalPngBase64'},
            {**good,'requestId':'0'*64},
        ):
            with self.subTest(keys=changed.keys()):
                with self.assertRaises(ValueError):
                    decode_packet(changed)

    def test_source_size_and_original_dimensions_are_bound(self):
        packet=v2_packet(illustration().resize((464,400),Image.Resampling.NEAREST))
        meta=json.loads(packet['header'])
        meta['source']['originalWidth']=465
        raw=__import__('gzip').decompress(base64.b64decode(packet['rgbaGzip']))
        labels=__import__('gzip').decompress(base64.b64decode(packet['labelsGzip']))
        packet['header']=json.dumps(meta,separators=(',',':'))
        packet['requestId']=sha256(packet['header'].encode()+raw+labels).hexdigest()
        with self.assertRaisesRegex(ValueError,'dimensions'):
            decode_packet(packet)

    def test_fine_detail_trace_keeps_thin_mark_without_sewing_isolated_specks(self):
        from fine_detail_regions import preserve_fine_detail

        foreground = np.zeros((96, 128), dtype=bool)
        foreground[8:-8, 8:-8] = True
        foreground[36:44, 30:38] = False
        baseline = np.zeros_like(foreground, dtype=np.uint8)
        baseline[foreground] = 2
        baseline[22:70, 92:110] = 1
        source = np.zeros((*foreground.shape, 3), dtype=np.uint8)
        source[baseline == 2] = (43, 142, 172)
        source[baseline == 1] = (20, 32, 50)
        source[16:18, 17:34] = (20, 32, 50)
        source[49, 49] = (20, 32, 50)
        source[53:64, 57:72] = (20, 32, 50)

        labels, report = preserve_fine_detail(
            source, foreground, baseline, ['#142032', '#2B8EAC'], .2)
        self.assertTrue(report['selected'])
        np.testing.assert_array_equal(labels > 0, foreground)
        self.assertEqual(labels[16, 22], 1)
        self.assertEqual(labels[49, 49], 2)
        self.assertGreater(report['candidateEdgesNearColourBoundary'],
                           report['baselineEdgesNearColourBoundary'])

    def test_worker_fine_detail_only_uses_verified_original(self):
        from home_live_bridge import derive_hybrid_plan

        image = illustration('opaque').resize((464, 400), Image.Resampling.NEAREST)
        with patch.dict('os.environ', {'STITCH_FORGE_PRESERVE_FINE_DETAIL': '1'}):
            for packet, has_original in ((browser_packet(illustration()), False),
                                         (v2_packet(image), True)):
                with self.subTest(has_original=has_original):
                    plan, meta, identity, binding = decode_packet(packet)
                    first, evidence, report = derive_hybrid_plan(packet, plan, meta, identity, binding)
                    self.assertEqual(first['physical'], plan['physical'])
                    self.assertEqual(first['source'], plan['source'])
                    self.assertEqual(first['summary']['sourcePixels'], plan['summary']['sourcePixels'])
                    self.assertEqual('preserveFineDetail' in report, has_original)
                    self.assertEqual(derive_hybrid_plan(packet, plan, meta, identity, binding),
                                     (first, evidence, report))


if __name__=='__main__':
    unittest.main()
