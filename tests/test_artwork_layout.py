"""Source-backed regression tests for the shared artwork planner."""
from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services' / 'digitiser'))
from artwork_layout import consolidate_colour, restore_compact_marks


class ArtworkLayoutTests(unittest.TestCase):
    def test_contrasting_bright_and_dark_marks_recovered_without_moving_foreground(self):
        palette = ['#131C24', '#327488', '#FFD250']
        rgb = np.array([[255, 255, 255], *[list(bytes.fromhex(c[1:])) for c in palette]], dtype=np.uint8)
        labels = np.zeros((96, 112), dtype=np.uint8)
        labels[8:88, 8:104] = 2
        labels[15:30, 15:30] = 1
        labels[65:80, 75:92] = 3
        source = labels.copy()
        source[30:35, 71:76] = 3
        source[58:63, 24:29] = 1
        source[21, 67] = 3
        recovered, marks, changed = restore_compact_marks(rgb[source], labels, palette, .25)
        self.assertEqual(marks, 2)
        self.assertEqual(changed, 50)
        self.assertEqual(recovered[21, 67], 2)
        self.assertEqual(recovered[32, 73], 3)
        self.assertEqual(recovered[60, 26], 1)
        self.assertTrue(np.array_equal(recovered > 0, labels > 0))

    def test_mixed_colour_texture_keeps_contrasting_thin_marks(self):
        colours = ['#14191C', '#4B7FA2', '#5489AD', '#6297BC',
                   '#A44E26', '#BA592A', '#D16533']
        rgb = np.array([[255, 255, 255], *[list(bytes.fromhex(c[1:])) for c in colours]], dtype=np.uint8)
        r, c = np.indices((96, 104))
        labels = (2 + ((r//4 + c//4) % 3) + (c >= 52) * 3).astype(np.uint8)
        labels[[0, -1], :] = 0
        labels[:, [0, -1]] = 0
        stripe = (r >= 34) & (r < 36) & (c >= 12) & (c < 34)
        labels[stripe] = 1
        from scipy.ndimage import label
        count = sum(label(labels == i)[1] for i in range(1, len(colours)+1))
        plan, palette, evidence = consolidate_colour(rgb[labels], labels, colours, .25, count)
        self.assertTrue(evidence['colourConsolidated'], evidence)
        self.assertLess(evidence['outputComponents'], count)
        self.assertTrue(np.array_equal(plan > 0, labels > 0))
        self.assertTrue(np.all(plan[stripe] == palette.index(colours[0]) + 1))
