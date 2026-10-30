"""Local trial tests; synthetic controls, never realistic-art quality approval."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/digitiser'))
try:
    import numpy as np
    from PIL import Image
    from artwork_trial import checked_masks, texture_trial, skeleton_paths, route_skeleton_branches, component_axis, bounded_fill_parts, without_collinear_steps, build_trial_svg, run_trial, audit_trial, validate_native_payload
    import pyembroidery
    AVAILABLE=True
except ImportError:
    AVAILABLE=False


@unittest.skipUnless(AVAILABLE,'Optional local artwork trial dependencies are not installed')
class ArtworkTrialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=TemporaryDirectory()
        folder=Path(cls.tmp.name)
        pixels=np.zeros((128,128,4),dtype=np.uint8)
        pixels[15:112,15:112]=[190,50,30,255]
        pixels[40:60,40:60]=0  # genuine transparent hole
        pixels[25:32,85:92]=[5,5,5,255]  # contrasting eye candidate
        pixels[20,20]=[5,5,5,255]  # a missing-eye regression at subneedle scale
        pixels[8:100,120]=[20,110,190,255]  # narrow separate feature
        pixels[5,5]=[20,110,190,255]  # explicitly unresolved subneedle detail
        raw=folder/'source.rgba';raw.write_bytes(pixels.tobytes())
        subprocess.run(['node',str(ROOT/'tools/prepare_artwork_trial.cjs'),str(raw),'128','128','80',str(folder)],cwd=ROOT,check=True,capture_output=True)
        cls.plan=json.loads((folder/'source-object-plan.json').read_text())
        small=folder/'small'
        subprocess.run(['node',str(ROOT/'tools/prepare_artwork_trial.cjs'),str(raw),'128','128','10',str(small)],cwd=ROOT,check=True,capture_output=True)
        cls.small_plan=json.loads((small/'source-object-plan.json').read_text())

    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()

    def test_source_geometry_binds_holes_colours_and_unresolved_parts(self):
        svg,manifest,masks=build_trial_svg(self.plan)
        self.assertIn(b'inkstitch:fill_method="tatami_fill"',svg)
        self.assertIn(b'inkstitch:stroke_method="running_stitch"',svg)
        self.assertFalse(manifest['machineEligible'])
        self.assertTrue(any(not o['nativePaths'] for o in manifest['objects']))
        self.assertFalse(any(mask[50,50] for mask in masks.values()))
        self.assertEqual(sum(int(m.sum()) for m in masks.values()),self.plan['summary']['sourcePixels'])

    def test_unsafe_masks_dimensions_and_approval_claims_are_rejected(self):
        for mutation in [lambda p:p.update(machineEligible=True),
                         lambda p:p['physical'].update(imageWidthMm=float('nan')),
                         lambda p:p['regions'][0]['ledger']['components'][0]['runs'].append([999,0,5]),
                         lambda p:p['regions'][0].update(color='<script>')]:
            bad=copy.deepcopy(self.plan);mutation(bad)
            with self.assertRaises(ValueError):checked_masks(bad)

    def test_skeleton_branches_cycles_and_isolated_pixels(self):
        mask=np.zeros((15,15),bool);mask[7,2:13]=True;mask[2:13,7]=True;mask[0,0]=True
        paths,count,dots=skeleton_paths(mask)
        self.assertEqual(count,22);self.assertEqual(dots,1)
        self.assertEqual(len(paths),4)
        self.assertEqual(sum(len(p)-1 for p in paths),20)
        loop=np.zeros((15,15),bool);loop[3,3:12]=True;loop[11,3:12]=True;loop[3:12,3]=True;loop[3:12,11]=True
        paths,_,_=skeleton_paths(loop)
        self.assertTrue(paths)
        for path in paths:
            for x,y in path:self.assertTrue(loop[int(y),int(x)])

    def test_shape_axis_is_physical_geometry_not_semantic_direction(self):
        horizontal={'pixelArea':600,'runs':[[y,5,65] for y in range(5,15)]}
        vertical={'pixelArea':600,'runs':[[y,5,15] for y in range(5,65)]}
        square={'pixelArea':400,'runs':[[y,5,25] for y in range(5,25)]}
        self.assertEqual(component_axis(horizontal),(0,True))
        self.assertEqual(abs(component_axis(vertical)[0]),90)
        self.assertEqual(component_axis(square),(0,False))

    def test_connected_branch_routing_uses_no_shortcuts_or_more_than_two_edge_passes(self):
        mask=np.zeros((15,15),bool);mask[7,2:13]=True;mask[2:13,7]=True
        paths,_,_=skeleton_paths(mask);routes=route_skeleton_branches(paths)
        self.assertEqual(len(paths),4);self.assertEqual(len(routes),1)
        from collections import Counter
        edge=lambda a,b:tuple(sorted((tuple(a),tuple(b))))
        original={edge(a,b) for p in paths for a,b in zip(p,p[1:])}
        travelled=Counter(edge(a,b) for p in routes for a,b in zip(p,p[1:]))
        self.assertEqual(set(travelled),original);self.assertLessEqual(max(travelled.values()),2)

    def test_collinear_compression_preserves_corners_reversals_and_exact_lines(self):
        from shapely import LineString
        points=[(0,0),(1,0),(2,0),(3,0),(2,0),(1,0),(1,1),(1,2),(2,3)]
        compressed=without_collinear_steps(points)
        self.assertEqual(compressed,[(0,0),(3,0),(1,0),(1,2),(2,3)])
        self.assertEqual(LineString(points).hausdorff_distance(LineString(compressed)),0)
        self.assertEqual(LineString(points).length,LineString(compressed).length)

    def test_complex_fill_partition_preserves_holes_union_and_physical_grid(self):
        from shapely import Polygon,Point,union_all
        from math import sin,cos,pi
        outer=[(50+40*cos(2*pi*i/800),50+40*sin(2*pi*i/800)) for i in range(800)]
        poly=Polygon(outer,[[(30,30),(40,30),(40,40),(30,40)],[(60,60),(70,60),(70,70),(60,70)]])
        parts=bounded_fill_parts(poly,.2)
        self.assertGreater(len(parts),1);self.assertLess(union_all(parts).symmetric_difference(poly).area,1e-7)
        self.assertTrue(all(max(p.bounds[2]-p.bounds[0],p.bounds[3]-p.bounds[1])*.2<=8.000001 for p in parts))
        self.assertFalse(union_all(parts).covers(Point(35,35)))

    def test_incomplete_machine_framing_is_not_a_decoder_end_pass(self):
        for fmt,payload in [('dst',b'LA:'+bytes(509)+b'\x00\x00\x03'),('dst',bytes(512)),
                            ('pes',b'#PES0060'+bytes(600)),('pes',b'broken'*100)]:
            with self.subTest(fmt=fmt),self.assertRaises(ValueError):validate_native_payload(fmt,payload)

    def test_texture_trial_preserves_foreground_reports_lost_eye_and_never_grants_approval(self):
        # A one-pixel eye in a 0.2mm-radius window is deliberately difficult.
        p=copy.deepcopy(self.small_plan)
        original,_=checked_masks(p)
        t=texture_trial(p,.2);masks,_=checked_masks(t)
        self.assertTrue(np.array_equal(np.logical_or.reduce(list(original.values())),np.logical_or.reduce(list(masks.values()))))
        self.assertFalse(t['machineEligible'])
        self.assertFalse(t['textureApproximation']['criticalFeaturePreservationVerified'])
        self.assertLessEqual(t['textureApproximation']['actualAxisRadiusMm'],.2)
        self.assertEqual(t['source'],p['source'])
        self.assertNotEqual(t['sourcePlanSignature'],p['sourcePlanSignature'])
        self.assertTrue(any(o['color']=='#050505' and o['pixels']==1 for o in t['textureApproximation']['lostWorkingComponents']))
        old_colors=list(original);old=np.array([original[c] for c in old_colors]).argmax(axis=0)
        radius=t['textureApproximation']['actualAxisRadiusPixels']
        for color,mask in masks.items():
            index=old_colors.index(color)
            for y,x in np.argwhere(mask & ~original[color]):
                self.assertTrue((old[max(0,y-radius):y+radius+1,max(0,x-radius):x+radius+1]==index).any())
        for invalid in [.3,float('inf'),True]:
            with self.assertRaises(ValueError):texture_trial(p,invalid)

    def test_independent_audit_detects_colour_order_and_hole_crossing(self):
        _,manifest,masks=build_trial_svg(self.plan)
        colors=sorted({o['color'] for o in manifest['objects'] if o['nativePaths']})
        pattern=pyembroidery.EmbPattern()
        for i,color in enumerate(colors):
            pattern.add_thread(color)
            if i:pattern.add_stitch_absolute(pyembroidery.COLOR_CHANGE,0,0)
            # The red interval crosses the known empty square at y=50.
            for x,y in [(30,50),(70,50)]:
                pattern.add_stitch_absolute(pyembroidery.JUMP,(2+x*80/128)*10,(2+y*80/128)*10)
                pattern.add_stitch_absolute(pyembroidery.STITCH,(2+x*80/128)*10,(2+y*80/128)*10)
            if color=='#BE321E':
                pattern.add_stitch_absolute(pyembroidery.JUMP,(2+30*80/128)*10,(2+50*80/128)*10)
                for x in range(30,71,4):pattern.add_stitch_absolute(pyembroidery.STITCH,(2+x*80/128)*10,(2+50*80/128)*10)
        pattern.add_stitch_absolute(pyembroidery.END,0,0)
        report,_,_=audit_trial(pattern,manifest,masks,'pes',[0,0])
        self.assertGreater(report['needleSegmentsOutsideWorkingColour'],0)
        pattern.threadlist.reverse()
        with self.assertRaisesRegex(ValueError,'colour order'):audit_trial(pattern,manifest,masks,'pes',[0,0])

    @unittest.skipUnless(os.environ.get('STITCH_FORGE_INKSTITCH'),'Real local engine not configured')
    def test_real_native_trial_preserves_pes6_rgb_and_cross_format_needles(self):
        with TemporaryDirectory() as output:
            report=run_trial(self.plan,os.environ['STITCH_FORGE_INKSTITCH'],output)
            self.assertEqual(report['pesVersion'],6)
            self.assertEqual(report['decoded'][0]['needleStitches'],report['decoded'][1]['needleStitches'])
            self.assertFalse(report['machineEligible'])
            self.assertFalse(report['physicalQualityVerified'])
            self.assertIn('unresolved_small_source_details',report['blockers'])
            for fmt in ['dst','pes']:
                data=(Path(output)/('ENGINEERING-TRIAL-NOT-APPROVED.'+fmt)).read_bytes()
                validate_native_payload(fmt,data)
                for cut in [1,len(data)//2]:
                    with self.subTest(fmt=fmt,cut=cut),self.assertRaises(ValueError):validate_native_payload(fmt,data[:-cut])
            for item in report['decoded']:
                self.assertEqual(item['needlePointsOutsideWorkingColour'],0)
                self.assertEqual(item['needleSegmentsOutsideWorkingColour'],0)
                for d in item['fillDirectionAudit'].values():
                    if d['attributedLongSegmentMm']>=3:self.assertGreater(d['alignedLongSegmentFraction'],.45)


if __name__=='__main__':unittest.main()
