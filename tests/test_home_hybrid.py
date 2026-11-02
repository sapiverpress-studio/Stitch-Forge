"""MD-2.66 offline colour-shape candidate test: no Ink/Stitch, no Google Cloud."""
import sys
import tempfile
import unittest
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from hybrid_home import reconstruct, save_candidate, proposal_svg


def artwork():
    im=Image.new('RGBA',(244,208),(0,0,0,0))
    p=ImageDraw.Draw(im)
    p.ellipse((34,12,172,193),fill=(5,112,170,255))
    p.ellipse((90,40,155,163),fill=(246,122,25,255))
    p.ellipse((114,20,145,50),fill=(252,239,209,255))
    p.ellipse((124,27,136,39),fill=(15,19,24,255))
    p.line([(2,186),(232,186)],fill=(118,84,40,255),width=10)
    p.ellipse((165,155,218,195),fill=(50,108,50,255))
    p.ellipse((180,155,218,175),fill=(74,138,70,255))
    return im


class HomeHybridTests(unittest.TestCase):
    def test_source_foreground_is_exact_and_no_stitches_are_claimed(self):
        labels,palette,report=reconstruct(artwork())
        self.assertEqual(labels.shape,(208,244))
        self.assertEqual(int((labels>0).sum()),report['originalForegroundPixels'])
        self.assertTrue(report['foregroundPreserved'])
        self.assertGreaterEqual(report['paletteColours'],4)
        self.assertLessEqual(report['paletteColours'],12)
        self.assertFalse(report['nativeFileGenerated'])
        self.assertFalse(report['semanticsVerified'])
        self.assertFalse(report['physicallyStitched'])
        self.assertGreater(report['directPaletteComponents'],0)
        self.assertGreater(report['hybridComponents'],0)
        self.assertLess(report['hybridComponents'],report['directPaletteComponents'])
        self.assertIn('NOT machine embroidery',proposal_svg(labels,palette))

    def test_reconstruction_is_deterministic(self):
        image=artwork()
        a,b,report=reconstruct(image,colours=8)
        c,d,later=reconstruct(image,colours=8)
        self.assertTrue(np.array_equal(a,c))
        self.assertTrue(np.array_equal(b,d))
        self.assertEqual(report,later)

    def test_outputs_are_explicit_visual_proposals_not_machine_files(self):
        with tempfile.TemporaryDirectory() as scratch:
            original=Path(scratch)/'source.png'
            destination=Path(scratch)/'candidate'
            artwork().save(original)
            report=save_candidate(original,destination,colours=9)
            self.assertTrue((destination/'home-hybrid-colour-preview.png').is_file())
            self.assertTrue((destination/'home-hybrid-proposal.svg').is_file())
            self.assertTrue((destination/'home-hybrid-evidence.json').is_file())
            self.assertEqual(sorted(p.name for p in destination.iterdir()),
                ['home-hybrid-colour-preview.png','home-hybrid-evidence.json','home-hybrid-proposal.svg'])
            self.assertFalse(any(p.suffix in ('.pes','.dst') for p in destination.iterdir()))
            self.assertTrue(report['foregroundPreserved'])

    def test_rejects_opaque_background_or_invalid_profile(self):
        with self.assertRaisesRegex(ValueError,'isolated foreground'):
            reconstruct(Image.new('RGB',(240,200),'white'))
        with self.assertRaisesRegex(ValueError,'palette'):
            reconstruct(artwork(),colours=13)
        with self.assertRaisesRegex(ValueError,'budget'):
            reconstruct(artwork(),max_side=2048)

if __name__=='__main__':
    unittest.main()
