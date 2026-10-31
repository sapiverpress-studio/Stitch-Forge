"""Deterministic, no-image and no-cloud tests for optional running-path grouping."""
import unittest
from xml.etree import ElementTree as ET
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from running_compaction import consolidate_running_elements

def running(root,d,id='r',colour='#1177AA',**extra):
    return ET.SubElement(root,'path',{'id':id,'d':d,'fill':'none','stroke':colour,
        'stroke-width':'0.1',**extra})

def fills(root):
    return ET.SubElement(root,'path',{'id':'fill','d':'M 0,0 L 10,0 L 10,10 Z',
        'fill':'#1177AA','stroke':'none'})

class RunningCompoundTests(unittest.TestCase):
    def test_small_bounded_hops_keep_two_explicit_move_commands(self):
        root=ET.Element('svg')
        a=running(root,'M 0,0 L 1,0','a')
        running(root,'M 1.7,0 L 2,0','b')
        before=[q.get('d') for q in root]
        record=consolidate_running_elements(root)
        self.assertEqual(record['sourceRunningCandidatesMerged'],1)
        self.assertEqual(record['compoundRunningElements'],1)
        self.assertEqual(len(root),1)
        self.assertEqual(root[0].get('d'),' '.join(before))
        self.assertEqual(root[0].get('d').count('M'),2)
        self.assertFalse(record['sourceGeometryChanged'])
        self.assertEqual(record['colourPixelsReassigned'],0)
        self.assertFalse(record['machineQualityVerified'])

    def test_never_group_across_colour_or_fill_or_large_jump(self):
        root=ET.Element('svg')
        running(root,'M 0,0 L 1,0','a')
        running(root,'M 3,0 L 3.5,0','too-far')
        running(root,'M 3.7,0 L 4,0','different-colour','#AA3311')
        fills(root)
        running(root,'M 4.1,0 L 4.5,0','after-fill')
        record=consolidate_running_elements(root)
        self.assertEqual(record['sourceRunningCandidatesMerged'],0)
        self.assertEqual(len(root),5)

    def test_changes_to_inkstitch_parameters_block_merges(self):
        root=ET.Element('svg')
        running(root,'M 0,0 L 1,0','a',special='one')
        running(root,'M 1,0 L 2,0','b',special='two')
        self.assertEqual(consolidate_running_elements(root)['sourceRunningCandidatesMerged'],0)

    def test_preserves_order_and_limits_compound_size(self):
        root=ET.Element('svg')
        for n in range(17):
            running(root,'M '+str(n)+',0 L '+str(n+.75)+',0','r'+str(n))
        record=consolidate_running_elements(root,max_subpaths=10)
        self.assertEqual(len(root),2)
        self.assertEqual([n.get('d').count('M') for n in root],[10,7])
        self.assertEqual(record['sourceRunningCandidatesMerged'],15)

    def test_rejects_compound_already_multi_m_and_unsupported_shapes(self):
        root=ET.Element('svg')
        running(root,'M 0,0 L 1,0 M 1,0 L 2,0','compound')
        running(root,'M 2,0 L 3,0','plain')
        running(root,'M 3,0 C 3.5,0 4,0 5,0','bezier')
        self.assertEqual(consolidate_running_elements(root)['sourceRunningCandidatesMerged'],0)

    def test_rejects_unbounded_configuration(self):
        for kw in [{'max_transfer_mm':3},{'max_subpaths':100},{'max_transfer_mm':0}]:
            with self.assertRaises(ValueError):
                consolidate_running_elements(ET.Element('svg'),**kw)

if __name__=='__main__':
    unittest.main()
