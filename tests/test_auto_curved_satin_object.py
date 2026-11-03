"""MD-2.72 physically bounded curved/tapered native satin source proposals."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from auto_curved_satin_object import propose_curved_satin
from satin_native import validate_column


def from_mask(mask):
    runs=[]
    for y,row in enumerate(mask):
        x=0
        while x<len(row):
            if row[x]:
                left=x
                while x<len(row) and row[x]:x+=1
                runs.append([y,left,x])
            else:x+=1
    return {'runs':runs,'pixelArea':sum(b-a for y,a,b in runs)}


def smooth_strip(kind):
    mask=[[False]*170 for _ in range(120)]
    for x in range(18,145):
        t=(x-18)/127
        y=45+(5*math.sin(math.pi*t) if kind in ('curve','both') else 0)
        half=6+(2*t if kind in ('taper','both') else 0)
        for yy in range(int(round(y-half)),int(round(y+half))):
            mask[yy][x]=True
    return from_mask(mask)


class CurvedSourceSatinTests(unittest.TestCase):
    def test_real_curved_rungs_in_source_and_physically_gated(self):
        candidate=smooth_strip('curve')
        original=[run[:] for run in candidate['runs']]
        proposal=propose_curved_satin(candidate,.30,'#114488')
        self.assertIsNotNone(proposal)
        col,evidence=proposal
        validate_column(col,55,45)
        self.assertGreater(len(col.rungs),7)
        self.assertGreater(evidence['centerlineDriftMm'],.45)
        self.assertTrue(evidence['sourceStripStrictlyContained'])
        self.assertGreater(evidence['sourceAreaRetainedInsideSatinStrip'],.5)
        self.assertFalse(evidence['physicalSewoutVerified'])
        self.assertFalse(evidence['machineApproved'])
        self.assertFalse(evidence['semanticFeatherIdentificationVerified'])
        self.assertEqual(candidate['runs'],original)
        self.assertEqual(col.thread_color,'#114488')

    def test_taper_and_bent_taper_supported_without_thinning_to_unsafe_width(self):
        for kind in ('taper','both'):
            with self.subTest(kind=kind):
                result=propose_curved_satin(smooth_strip(kind),.30,'#114488')
                self.assertIsNotNone(result)
                col,evidence=result
                validate_column(col,55,45)
                self.assertGreater(evidence['widthMaxMm']/evidence['widthMinMm'],1.1)
                self.assertLessEqual(evidence['widthMaxMm']/evidence['widthMinMm'],1.8)

    def test_refuse_disconnected_and_crossing_regions(self):
        mask=[[False]*180 for _ in range(110)]
        for y in range(33,46):
            for x in range(15,75):mask[y][x]=True
            for x in range(110,165):mask[y][x]=True
        self.assertIsNone(propose_curved_satin(from_mask(mask),.30,'#114488'))
        mask=[[False]*180 for _ in range(110)]
        for y in range(10,90):
            for x in range(77,92):mask[y][x]=True
        for y in range(44,56):
            for x in range(18,155):mask[y][x]=True
        self.assertIsNone(propose_curved_satin(from_mask(mask),.30,'#114488'))

    def test_refuse_narrow_and_too_wide_shapes(self):
        thin=[[False]*170 for _ in range(120)]
        wide=[[False]*170 for _ in range(120)]
        for x in range(18,145):
            for y in range(45,49):thin[y][x]=True
            for y in range(25,65):wide[y][x]=True
        self.assertIsNone(propose_curved_satin(from_mask(thin),.30,'#114488'))
        self.assertIsNone(propose_curved_satin(from_mask(wide),.30,'#114488'))

    def test_reject_bad_colour_scale_and_malformed_source(self):
        source=smooth_strip('curve')
        with self.assertRaises(ValueError):
            propose_curved_satin(source,0,'#114488')
        with self.assertRaises(ValueError):
            propose_curved_satin(source,.30,'#114X88')
        with self.assertRaises(ValueError):
            propose_curved_satin({'runs':[[12,40,30]]},.30,'#114488')
        with self.assertRaises(ValueError):
            propose_curved_satin(source,.30,'#114488',origin=(float('nan'),2))

if __name__=='__main__':unittest.main()
