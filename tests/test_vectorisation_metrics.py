"""The benchmark must penalise internal omissions, not just score silhouettes."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
try:
 from bench_vectorise_extended import metrics,labels_svg,composite,P
 import numpy as np
 AVAILABLE=True
except ImportError:
 AVAILABLE=False

@unittest.skipUnless(AVAILABLE,'Optional vector benchmark dependencies unavailable')
class VectorMetricTests(unittest.TestCase):
 def test_exact_pixel_cells_and_hole_topology(self):
  labels=np.zeros((64,64),np.uint8);labels[8:56,8:56]=1;labels[24:40,24:40]=0
  palette=np.array([(255,255,255),P['blue']],np.uint8)
  a=palette[labels];r=metrics(a,labels_svg(labels,palette),['blue'])
  self.assertGreater(r['macro_colour_iou'],.99)
  self.assertEqual(r['per_colour'][0]['source_topology'],[1,1])
  self.assertEqual(r['per_colour'][0]['output_topology'],[1,1])
 def test_complete_silhouette_cannot_hide_lost_internal_colour(self):
  labels=np.zeros((64,64),np.uint8);labels[8:56,8:56]=1;labels[24:40,24:40]=2
  palette=np.array([(255,255,255),P['blue'],P['orange']],np.uint8)
  a=palette[labels];bad=labels.copy();bad[bad==2]=1
  r=metrics(a,labels_svg(bad,palette),['blue','orange'])
  self.assertGreater(r['foreground_iou'],.99)
  self.assertLess(r['macro_colour_iou'],.5)
  self.assertEqual(r['per_colour'][1]['missing_pixels'],256)
 def test_hidden_rgb_has_no_foreground(self):
  a=np.full((64,64,4),120,np.uint8);a[:,:,3]=0
  self.assertTrue(np.all(composite(a)==255))
