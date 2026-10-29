"""Regression: restored artwork must stay available to the AI panel after reload.

Runs entirely offline, mocking the OpenAI-function response. No credentials or
customer images are used in this test.
"""
import base64
import json
import os
from pathlib import Path
import struct
import unittest
import zlib

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "site/index.html"
AI = ROOT / "site/ai-details.js"
ROUTING = ROOT / "site/travel-routing.js"


def image_data_url():
    width, height = 120, 80
    lines = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            grey = 100 if (20 < x < 100 and abs(y - 40) < 18) else 240
            row.extend((grey, grey, grey))
        lines.append(b"\x00" + bytes(row))
    def chunk(t, data):
        return struct.pack(">I",len(data))+t+data+struct.pack(">I",zlib.crc32(t+data)&0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"".join(lines)))+chunk(b"IEND",b"")
    return "data:image/png;base64,"+base64.b64encode(png).decode()


def page_fixture():
    source = HTML.read_text(encoding="utf-8")
    source = source.replace('<script src="/travel-routing.js"></script>',
                            '<script>'+ROUTING.read_text(encoding="utf-8")+'</script>')
    saved = {
        "paths": [[[120,180],[480,180],[480,400],[120,400],[120,180]]],
        "pathStyles": ["running"],
        "name":"Saved moth test",
        "width": "78", "hoop":"100", "stitch":"2",
        "reference":image_data_url(),
        "bounds": {"x": 120, "y":180, "w":360, "h":220},
        "trace":{"sourcePixels":"120x80"}
    }
    anchor="let saved=JSON.parse(localStorage.getItem('sapiver.stitch.v01')||'null');"
    assert source.count(anchor)==1, "Changed saved-project source location"
    return source.replace(anchor,"let saved="+json.dumps(saved, separators=(',', ':'))+";")


class AIReferenceRestoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        kwargs={"headless":True}
        if os.environ.get("STITCH_FORGE_CHROMIUM"):
            kwargs["executable_path"]=os.environ["STITCH_FORGE_CHROMIUM"]
        cls.browser=cls.playwright.chromium.launch(**kwargs)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_restored_image_available_and_edit_points_visible_in_tracing(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        try:
            errors=[]
            page.on("pageerror",lambda err:errors.append(str(err)))
            page.set_content(page_fixture(),wait_until="load")
            page.add_script_tag(content=AI.read_text())
            image=page.evaluate("window.StitchForgeAIContext.getImage()")
            self.assertTrue(image.startswith("data:image/png;base64,"))
            self.assertEqual(page.evaluate("window.StitchForgeAIContext.getSourceStatus()"),"restored-preview")
            self.assertTrue(page.locator("#editPointsNearArt").is_visible())
            self.assertFalse(page.locator("#showNodes").is_checked())
            self.assertFalse(page.locator("#editPointsNearArt").is_checked())
            self.assertIn("Saved moth reference restored",page.locator("#sfAiStatus").inner_text())
            self.assertEqual(page.locator("#nodes circle").count(),0)
            page.locator("#editPointsNearArt").check()
            self.assertTrue(page.locator("#showNodes").is_checked())
            self.assertGreater(page.locator("#nodes circle").count(),0)
            page.locator("#editPointsNearArt").uncheck()
            self.assertEqual(page.locator("#nodes circle").count(),0)
            self.assertEqual(errors,[])
        finally:page.close()

    def test_analysis_can_run_on_restored_reference_without_reupload(self):
        page=self.browser.new_page(viewport={"width":390,"height":844})
        try:
            page.set_content(page_fixture(),wait_until="load")
            page.add_script_tag(content=AI.read_text())
            page.evaluate("""() => {
                window.__capturedAnalysis=null;
                window.fetch=async (url,opts) => {
                    window.__capturedAnalysis={url,method:opts.method,image:JSON.parse(opts.body).image};
                    return {ok:true,json:async()=>({
                      status:'REGION_PROPOSAL_NOT_DIGITISED',requires_human_review:true,
                      regions:[{id:'wing-vein',label:'Wing vein',category:'wing_vein',
                        bbox:{x_min:80,y_min:100,x_max:540,y_max:850},
                        suggested_color:'#775544',suggested_stitch:'running',
                        confidence:'medium',notes:'Synthetic test'}],
                      overlooked_details:[],warnings:['Not embroidery stitches']
                    })};
                };
            }""")
            page.locator("#sfAiToken").fill("test-token-not-a-real-secret")
            page.locator("#sfAiAnalyse").click()
            page.wait_for_function("document.querySelector('#sfAiStatus').textContent.includes('AI found 1')")
            result=page.evaluate("window.__capturedAnalysis")
            self.assertEqual(result["url"],"/api/analyse-embroidery")
            self.assertTrue(result["image"].startswith("data:image/jpeg;base64,"))
            self.assertEqual(page.locator(".ai-detail-item").count(),1)
            self.assertFalse(page.locator("#sfAiBoxes").is_checked())
            self.assertEqual(page.locator("#sfAiOverlay rect").count(),0)
            page.locator("#sfAiBoxes").check()
            self.assertEqual(page.locator("#sfAiOverlay rect").count(),1)
            page.locator("#sfAiBoxes").uncheck()
            self.assertEqual(page.locator("#sfAiOverlay rect").count(),0)
            page.locator(".ai-detail-item").first.click()
            self.assertEqual(page.locator("#sfAiOverlay rect").count(),1)
        finally:page.close()


if __name__=="__main__":unittest.main()
