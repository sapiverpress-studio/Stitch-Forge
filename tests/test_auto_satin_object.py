"""Source-only geometries must pass conservative physical satin gates."""
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from auto_satin_object import propose_straight_satin
from satin_native import validate_column


def shape(mask):
    rows=[]
    for y,row in enumerate(mask):
        x=0
        while x<len(row):
            if row[x]:
                start=x
                while x<len(row) and row[x]: x+=1
                rows.append([y,start,x])
            else:x+=1
    return {'id':'component-1','pixelArea':sum(b-a for y,a,b in rows),'runs':rows}


def grid(w=140,h=110):
    return [[False]*w for _ in range(h)]


class PhysicalSatinUnitTests(unittest.TestCase):
    def test_straight_horizontal_source_is_reconstructed_as_bounded_satin(self):
        mask=grid()
        for y in range(48,58):
            for x in range(16,112):mask[y][x]=True
        trial=propose_straight_satin(shape(mask),.30,'#114488')
        self.assertIsNotNone(trial)
        column,evidence=trial
        validate_column(column,45,40)
        self.assertTrue(evidence['sourceStripStrictlyContained'])
        self.assertTrue(1.5<=evidence['plannedSatinWidthMm']<=3.5)
        self.assertFalse(evidence['semanticFeatherIdentificationVerified'])
        self.assertFalse(evidence['machineApproved'])
        self.assertEqual(column.thread_color,'#114488')
        self.assertEqual(len(column.rungs),len(column.left))

    def test_straight_vertical_source_is_reconstructed(self):
        mask=grid()
        for y in range(16,95):
            for x in range(55,66):mask[y][x]=True
        self.assertIsNotNone(propose_straight_satin(shape(mask),.30,'#114488'))

    def test_cross_and_too_narrow_shapes_are_not_satin_columns(self):
        mask=grid()
        for y in range(13,88):
            for x in range(63,67):mask[y][x]=True
        self.assertIsNone(propose_straight_satin(shape(mask),.30,'#114488'))
        mask=grid()
        for y in range(12,91):
            for x in range(61,72):mask[y][x]=True
        for y in range(43,58):
            for x in range(15,120):mask[y][x]=True
        self.assertIsNone(propose_straight_satin(shape(mask),.30,'#114488'))

    def test_very_wide_fill_uses_existing_tatami(self):
        mask=grid()
        for y in range(10,100):
            for x in range(25,70):mask[y][x]=True
        self.assertIsNone(propose_straight_satin(shape(mask),.30,'#114488'))

    def test_invalid_untrusted_fields_fail_closed(self):
        mask=grid()
        for y in range(48,58):
            for x in range(16,112):mask[y][x]=True
        record=shape(mask)
        with self.assertRaises(ValueError):
            propose_straight_satin(record,0,'#114488')
        with self.assertRaises(ValueError):
            propose_straight_satin(record,.30,'#11GG88')
        with self.assertRaises(ValueError):
            propose_straight_satin(record,.30,'#114488',origin=(float('nan'),2))

if __name__=='__main__':unittest.main()
