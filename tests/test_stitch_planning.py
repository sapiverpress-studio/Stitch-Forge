import json,sys,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from trusted_svg import Region,build_svg
from project_bridge import convert_project
from stitch_planning import inspect_plan
from machine_job import run_machine_job
from inkstitch_cli import EngineResult,DigitiserError

class PlanningTests(unittest.TestCase):
 def test_geometry_diagnostics_preserve_order_and_do_not_invent_satin(self):
  svg=build_svg(90,90,(Region(((5,5),(65,5),(65,6),(5,6)), 'fill','#112233'),
       Region(((10,15),(30,45)), 'running','#ABCDEF'),
       Region(((10,50),(40,50),(40,70),(10,70)), 'fill','#112233',fill_angle_deg=45,row_spacing_mm=.5,fill_underlay=True)))
  p=inspect_plan(svg)
  self.assertEqual(p['expected_colour_changes'],2)
  self.assertEqual(p['source_bounds_mm'],[60,65])
  self.assertTrue(p['source_order_preserved'])
  self.assertIn('narrow_fill_candidate_requires_explicit_satin_rails_or_running_centreline',p['regions'][0]['warnings'])
  self.assertEqual(p['regions'][2]['requested_angle_deg'],'45.00')
  self.assertEqual(p['regions'][1]['kind'],'running')
 def test_bad_rings_fail_before_engine(self):
  bad=[((1,1),(8,8),(1,8),(8,1)),((1,1),(5,1),(8,1)),
       ((1,1),(8,1),(8,8),(4,1),(1,8)),((1,1),(8,1),(8,1),(1,8))]
  for points in bad:
   with self.subTest(points=points),self.assertRaises(ValueError):build_svg(20,20,(Region(points,'fill'),))
 def test_normal_concave_and_closed_rings_work(self):
  pts=((1,1),(8,1),(8,8),(5,4),(1,8),(1,1))
  self.assertIn(b'polygon',build_svg(20,20,(Region(pts,'fill'),)))
 def test_wrong_size_rejected_even_when_both_machine_formats_agree(self):
  p=dict(width=40,hoop=100,paths=[[[0,0],[100,0],[100,100],[0,100],[0,0]]],pathStyles=['tatami'],pathColors=['#112233'])
  reports=tuple(SimpleNamespace(format=f,needle_stitches=200,jumps=0,changes=0,bounds_mm=(20,20)) for f in ('pes','dst'))
  with patch('machine_job.export_trusted_svg',return_value=EngineResult(b'PK'+b'0'*150,('x.pes','x.dst'),'')),patch('machine_job.audit_zip',return_value=reports):
   with self.assertRaisesRegex(DigitiserError,'extents'):run_machine_job(json.dumps(p).encode(),executable=Path('/fake'))
 def test_case_only_colour_difference_is_not_a_thread_change(self):
  svg=build_svg(90,90,(Region(((5,5),(20,20)),'running','#aabbcc'),Region(((30,30),(40,40)),'running','#AABBCC')))
  self.assertEqual(inspect_plan(svg)['expected_colour_changes'],0)
if __name__=='__main__':unittest.main()

class SmallFillGateTests(unittest.TestCase):
 def test_submillimetre_fill_blocked_before_native_invocation(self):
  project=dict(width=40,hoop=100,paths=[[[0,0],[100,0],[100,100],[0,100],[0,0]],[[20,20],[21,20],[21,21],[20,21],[20,20]]],pathStyles=['tatami','tatami'],pathColors=['#112233','#445566'])
  with patch('machine_job.export_trusted_svg') as engine:
   with self.assertRaisesRegex(ValueError,'conservative'):run_machine_job(json.dumps(project).encode(),executable=Path('/fake'))
   engine.assert_not_called()
