"""Mobile browser test: manual wing boundary -> closed tatami region -> Undo.

No OpenAI API calls or real machine-file certification.
"""
import base64
import json
import os
from pathlib import Path
import struct
import unittest
import zlib
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"site/index.html"
ROUTING=ROOT/"site/travel-routing.js"
GEOMETRY=ROOT/"site/fill-geometry.js"
UI=ROOT/"site/fill-boundary-ui.js"

def image():
    w,h=120,80
    raw=b"".join(b"\x00"+bytes([230,218,192])*w for _ in range(h))
    def chunk(t,data):
        return struct.pack(">I",len(data))+t+data+struct.pack(">I",zlib.crc32(t+data)&0xffffffff)
    png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw))+chunk(b"IEND",b"")
    return "data:image/png;base64,"+base64.b64encode(png).decode()

def page_source():
    source=HTML.read_text(encoding="utf8")
    source=source.replace('<script src="/travel-routing.js"></script>',
                         '<script>'+ROUTING.read_text(encoding="utf8")+'</script>')
    original="let saved=JSON.parse(localStorage.getItem('sapiver.stitch.v01')||'null');"
    assert source.count(original)==1
    saved={"paths":[[[120,180],[480,180],[480,400],[120,400],[120,180]]],
           "pathStyles":["running"],"name":"Moth fixture","width":"78","stitch":"2","hoop":"100",
           "reference":image(),"bounds":{"x":120,"y":180,"w":360,"h":220}}
    return source.replace(original,"let saved="+json.dumps(saved,separators=(",",":"))+";")

class FillMobileTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright=sync_playwright().start()
        opts={"headless":True}
        if os.environ.get("STITCH_FORGE_CHROMIUM"):
            opts["executable_path"]=os.environ["STITCH_FORGE_CHROMIUM"]
        cls.browser=cls.playwright.chromium.launch(**opts)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_fill_boundary_is_closed_editable_undoable(self):
        page=self.browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        try:
            page.set_content(page_source(),wait_until="load")
            page.add_script_tag(content=GEOMETRY.read_text(encoding="utf8"))
            page.add_script_tag(content=UI.read_text(encoding="utf8"))
            self.assertEqual(len(page.evaluate("window.__stitchforge_test.paths")),1)
            self.assertTrue(page.locator("#sfFillStart").is_visible())
            page.locator("#sfFillStart").click()
            self.assertFalse(page.locator("#sfFillCancel").is_disabled())
            points=[[170,230],[265,215],[402,250],[340,345],[185,365]]
            page.evaluate("""points=>{
              const svg=document.querySelector('#design'),ctm=svg.getScreenCTM();
              for(const [x,y] of points){
                const p=svg.createSVGPoint();p.x=x;p.y=y;
                const v=p.matrixTransform(ctm);
                svg.dispatchEvent(new PointerEvent('pointerdown',{clientX:v.x,clientY:v.y,
                  bubbles:true,cancelable:true,pointerType:'touch'}));
              }
            }""",points)
            self.assertFalse(page.locator("#sfFillClose").is_disabled())
            self.assertEqual(page.locator("#sfFillGuide circle").count(),5)
            page.locator("#sfFillClose").click()
            self.assertFalse(page.locator("#sfFillApply").is_disabled())
            self.assertEqual(page.locator("#sfFillGuide path.closed").count(),1)
            page.locator("#sfFillApply").click()
            new_paths=page.evaluate("window.__stitchforge_test.paths")
            self.assertEqual(len(new_paths),2)
            self.assertEqual(new_paths[-1][0],new_paths[-1][-1])
            self.assertEqual(page.locator("#stitchMode").input_value(),"tatami")
            from xml.etree import ElementTree as ET
            xml=page.evaluate("window.__stitchforge_test.exportSvg()")
            root=ET.fromstring(xml)
            fill=[node for node in root if node.attrib.get("data-stitch-mode")=="tatami"]
            self.assertEqual(len(fill),1)
            self.assertEqual(fill[0].attrib["fill"],"#153e46")
            self.assertEqual(fill[0].attrib["stroke"],"none")
            self.assertTrue(root.attrib["width"].endswith("mm"))
            self.assertIn("single-colour",page.locator("#sfFillNotice").inner_text().lower()+
                              page.locator("#status").inner_text().lower())
            page.locator("#undoBtn").click()
            self.assertEqual(len(page.evaluate("window.__stitchforge_test.paths")),1)
            self.assertEqual(errors,[])
        finally:
            page.close()

if __name__=="__main__":
    unittest.main()
