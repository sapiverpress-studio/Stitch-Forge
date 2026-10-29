"""Synthetic image tests; user artwork is never committed to the public repo."""
import unittest
try:
    import cv2
    import numpy as np
    from services.digitiser.detail_guides import extract_detail_guides
    READY = True
except ImportError:
    READY = False

@unittest.skipUnless(READY, "Optional OpenCV/Numpy detail-guide dependencies are absent")
class InternalDetailGuidesTests(unittest.TestCase):
    def test_synthetic_wing_lines_detected(self):
        image=np.zeros((160,240,3),np.uint8)
        cv2.ellipse(image,(120,80),(100,60),0,0,360,(225,225,225),-1)
        cv2.line(image,(70,45),(155,105),(45,45,45),4)
        cv2.line(image,(85,115),(170,60),(70,70,70),4)
        result=extract_detail_guides(image,design_width_mm=78)
        self.assertEqual(result["status"],"REVIEW_GUIDES_NOT_EMBROIDERY")
        self.assertGreater(len(result["guides"]),0)
        self.assertTrue(all(g["approximate_length_mm"]>=2 for g in result["guides"]))
        self.assertTrue(all(len(g["points"])>=2 for g in result["guides"]))
    def test_invalid_ai_bbox_is_rejected(self):
        image=np.zeros((80,80,3),np.uint8)
        with self.assertRaises(ValueError):
            extract_detail_guides(image,design_width_mm=78,regions=[
                {"id":"wing","bbox":{"x_min":900,"y_min":0,"x_max":5,"y_max":900}}])
    def test_region_restriction_and_caps(self):
        image=np.zeros((160,240,3),np.uint8)
        cv2.rectangle(image,(30,30),(210,130),(240,240,240),-1)
        for y in (60,90,110):
            cv2.line(image,(40,y),(200,y),(60,60,60),3)
        result=extract_detail_guides(image,design_width_mm=78,max_guides=12,regions=[
            {"id":"left-wing","bbox":{"x_min":0,"y_min":0,"x_max":500,"y_max":1000}}])
        self.assertLessEqual(len(result["guides"]),12)
        self.assertTrue(all(g["region"]=="left-wing" for g in result["guides"]))
        self.assertNotIn("STITCH_TESTED",result["status"])

if __name__=="__main__":
    unittest.main()
