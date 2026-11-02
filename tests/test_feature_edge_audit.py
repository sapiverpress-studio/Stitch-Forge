"""Conservative geometry checks: missing eye-sized feature boundaries stay HOLD."""
import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from feature_edge_audit import audit_compact_edges


class CompactFeatureEdgeAuditTests(unittest.TestCase):
    def setup_eye(self):
        yy,xx=np.ogrid[:64,:64]
        circle=(xx-32)**2+(yy-32)**2<=7**2
        rgb=np.full((64,64,3),.80,dtype=float)
        rgb[circle]=.04
        fg=np.ones((64,64),dtype=bool)
        return rgb,fg,circle

    def test_detects_a_lost_contrasting_circular_feature(self):
        rgb,fg,circle=self.setup_eye()
        lost=np.zeros((64,64),dtype=np.uint8)
        evidence=audit_compact_edges(rgb,fg,lost,[(1.,32,32,6.)])
        self.assertEqual(evidence['strongestCompactMarkEdgeRecall'],0)
        self.assertTrue(evidence['compactMarkReviewRequired'])
        self.assertFalse(evidence['featureSemanticsVerified'])

    def test_matching_source_edges_have_high_retention(self):
        rgb,fg,circle=self.setup_eye()
        labels=np.zeros((64,64),dtype=np.uint8)
        labels[circle]=1
        evidence=audit_compact_edges(rgb,fg,labels,[(1.,32,32,6.)])
        self.assertGreater(evidence['strongestCompactMarkEdgeRecall'],.65)
        self.assertFalse(evidence['compactMarkReviewRequired'])
        self.assertFalse(evidence['physicalSewoutVerified'])

    def test_without_detected_features_holds_instead_of_claiming_a_pass(self):
        rgb,fg,circle=self.setup_eye()
        labels=np.zeros((64,64),dtype=np.uint8)
        evidence=audit_compact_edges(rgb,fg,labels,[])
        self.assertIsNone(evidence['strongestCompactMarkEdgeRecall'])
        self.assertTrue(evidence['compactMarkReviewRequired'])

    def test_alpha_background_must_never_be_reassigned(self):
        rgb,fg,circle=self.setup_eye()
        fg[:5]=False
        invalid=np.zeros((64,64),dtype=np.uint8)
        with self.assertRaisesRegex(ValueError,'source'):
            audit_compact_edges(rgb,fg,invalid,[(1.,32,32,6.)])


if __name__=='__main__':
    unittest.main()
