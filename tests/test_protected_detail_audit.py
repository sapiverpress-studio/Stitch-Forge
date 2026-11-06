"""Offline contrast loss source gate, no real artwork in repository."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from protected_detail_audit import audit_protected_details


class ProtectedDetailAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp=TemporaryDirectory()
        root=Path(self.tmp.name)
        image=np.zeros((128,128,4),dtype=np.uint8)
        image[20:100,20:100]=[25,25,25,255]
        yy,xx=np.ogrid[:128,:128]
        ring=(xx-64)**2+(yy-65)**2
        image[(ring>=19**2)&(ring<=21**2)]=[220,220,220,255]
        image[55:62,58:65]=[255,255,255,255]
        self.original=root/'original.png'
        Image.fromarray(image,'RGBA').save(self.original)
        prepared=image.copy()
        prepared[20:100,20:100]=[25,25,25,255]
        self.flat=root/'flattened.png'
        Image.fromarray(prepared,'RGBA').save(self.flat)
        self.windows=[{'id':'protected-1','rect':[36,37,92,91]}]

    def tearDown(self):self.tmp.cleanup()

    def test_exact_source_preserves_measured_edges(self):
        result=audit_protected_details(self.original,self.windows,width_mm=80,
                                       comparison_png=self.original)
        entry=result['featureWindows'][0]
        self.assertGreater(entry['sourceEdges'],100)
        self.assertEqual(entry['comparisonEdgeRecallAt015Mm'],1.0)
        self.assertFalse(entry['semanticIdentityVerified'])
        self.assertFalse(result['releaseApproval'])

    def test_flattened_eye_reports_loss(self):
        result=audit_protected_details(self.original,self.windows,width_mm=80,
                                       comparison_png=self.flat)
        entry=result['featureWindows'][0]
        self.assertLess(entry['comparisonEdgeRecallAt015Mm'],.3)
        self.assertTrue(entry['contrastLossPossible'])
        self.assertNotEqual(result['sourcePngSha256'],result['comparisonPngSha256'])

    def test_invalid_bboxes_and_geometry_fail_closed(self):
        for windows in ([],[{'id':'a','rect':[-1,1,30,30]}],
                        [{'id':'a','rect':[1,1,5,5]}],
                        [{'id':'a','rect':[1,1,30,30]},
                         {'id':'a','rect':[10,10,40,40]}]):
            with self.assertRaises(ValueError):
                audit_protected_details(self.original,windows)
        with self.assertRaises(ValueError):
            audit_protected_details(self.original,self.windows,width_mm=900)

    def test_missing_or_unmeasurable_edges_not_falsely_approved(self):
        result=audit_protected_details(self.original,
             [{'id':'transparent','rect':[0,0,12,12]}])
        self.assertEqual(result['featureWindows'][0]['status'],
                         'NO_MEASURABLE_SOURCE_EDGES')
        self.assertIsNone(result['featureWindows'][0]['comparisonEdgeRecallAt015Mm'])


if __name__=='__main__':unittest.main()
