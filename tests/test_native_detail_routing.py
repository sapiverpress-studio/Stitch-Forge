"""Deterministic non-destructive source-detail routing regression tests."""
import math
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from native_detail_routing import optimise_running_groups


INK='{http://inkstitch.org/namespace}'

def running(root,name,a,b,colour='#AA8822',extra=''):
    return ET.SubElement(root,'path',{
        'id':name,'fill':'none','stroke':colour,'stroke-width':'0.1',
        INK+'stroke_method':'running_stitch',
        'd':f'M {a},0 L {b},0','group':extra})

def fill(root,name='fill'):
    return ET.SubElement(root,'path',{
        'id':name,'fill':'#AA8822','stroke':'none',
        INK+'fill_method':'tatami_fill','d':'M 0,0 L 12,0 L 12,12 Z'})

class DetailRoutingTests(unittest.TestCase):
    def test_anchored_geometry_and_colour_fully_unchanged(self):
        root=ET.Element('svg')
        fill(root,'before')
        for i,(a,b) in enumerate([(0,1),(50,51),(2,3),(4,5),(6,7),(52,53)]):
            running(root,'r'+str(i),a,b)
        fill(root,'after')
        original={n.get('id'):(n.get('d'),dict(n.attrib)) for n in root}
        metric=optimise_running_groups(root)
        self.assertGreater(metric['estimatedPenUpSavingMm'],0)
        self.assertEqual(metric['acceptedGroups'],1)
        self.assertGreaterEqual(metric['nearConnectionsAfter'],metric['nearConnectionsBefore'])
        self.assertEqual([e.get('id') for e in root if e.get('fill')!='none'],
                         ['before','after'])
        self.assertEqual(root[0].get('id'),'before')
        self.assertEqual(root[1].get('id'),'r0')
        self.assertEqual(root[-2].get('id'),'r5')
        self.assertEqual(root[-1].get('id'),'after')
        self.assertEqual({n.get('id'):(n.get('d'),dict(n.attrib)) for n in root},original)
        self.assertTrue(metric['unchangedInternalStitchOrder'])
        self.assertFalse(metric['nativeStitchCountsVerified'])

    def test_barriers_do_not_cross_fill_colour_or_stitch_settings(self):
        root=ET.Element('svg')
        for i in range(3):running(root,'a'+str(i),i*3,i*3+1)
        fill(root)
        for i in range(3):running(root,'b'+str(i),i*3,i*3+1,colour='#333333')
        for i in range(3):running(root,'c'+str(i),i*3,i*3+1,extra='new-settings')
        old=[e.get('id') for e in root]
        metric=optimise_running_groups(root)
        self.assertEqual([e.get('id') for e in root],old)
        self.assertEqual(metric['acceptedGroups'],0)

    def test_missing_or_unsupported_svg_path_is_an_immutable_boundary(self):
        root=ET.Element('svg')
        for i in range(4):running(root,'x'+str(i),i,i+1)
        p=running(root,'curved',10,11);p.set('d','M 10,0 C 11,1 12,2 13,0')
        for i in range(4):running(root,'y'+str(i),20+i,21+i)
        before=[e.get('id') for e in root]
        optimise_running_groups(root)
        self.assertEqual([e.get('id') for e in root],before)

    def test_running_paths_never_reversed_or_combined(self):
        root=ET.Element('svg')
        for i,(a,b) in enumerate([(0,1),(20,22),(2,3),(4,5),(6,7),(24,25)]):
            running(root,'r'+str(i),a,b)
        before={n.get('id'):n.get('d') for n in root}
        optimise_running_groups(root)
        self.assertEqual(before,{n.get('id'):n.get('d') for n in root})
        self.assertEqual(len(root),6)

    def test_budgets_reject_invalid_configuration(self):
        for kw in ({'max_group':3},{'max_group':1000},
                   {'max_compound_gap_mm':0},{'min_gain_mm':float('nan')}):
            with self.assertRaises(ValueError):
                optimise_running_groups(ET.Element('svg'),**kw)

if __name__=='__main__':unittest.main()
