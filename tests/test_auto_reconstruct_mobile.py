"""One-action AI reconstruction test on Android-sized Chromium.

Synthetic moth only. Mocks the OpenAI endpoint to avoid credentials and charges.
Asserts two image-grounded fills, colour SVG and single-action Undo.
"""
import base64,json,os,struct,unittest,zlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def synthetic_image():
    w,h=240,160
    raw=[]
    for y in range(h):
        row=bytearray(b"\x00")
        for x in range(w):
            wing=((x-64)/51)**2+((y-70)/43)**2<1 or ((x-174)/51)**2+((y-70)/43)**2<1
            shade=193 if wing else 0
            row.extend((shade,shade,shade))
        raw.append(bytes(row))
    def chunk(tag,data):
        return struct.pack(">I",len(data))+tag+data+struct.pack(">I",zlib.crc32(tag+data)&0xffffffff)
    png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"".join(raw)))+chunk(b"IEND",b"")
    return "data:image/png;base64,"+base64.b64encode(png).decode()
def page_source():
    source=(ROOT/"site/index.html").read_text(encoding="utf8")
    routing=(ROOT/"site/travel-routing.js").read_text(encoding="utf8")
    source=source.replace('<script src="/travel-routing.js"></script>','<script>'+routing+'</script>')
    anchor="let saved=JSON.parse(localStorage.getItem('sapiver.stitch.v01')||'null');"
    assert source.count(anchor)==1
    saved={"paths":[[[120,180],[480,180],[480,400],[120,400],[120,180]]],
           "pathStyles":["running"],"pathColors":["#153e46"],
           "name":"Synthetic Moth","width":"78","stitch":"2","hoop":"150",
           "reference":synthetic_image(),
           "bounds":{"x":120,"y":180,"w":360,"h":220}}
    return source.replace(anchor,"let saved="+json.dumps(saved,separators=(",",":"))+";")
def geometry():
    def one(id,cx,color):
        vertices=[(-.95,-.2),(-.75,-.75),(0,-1),(.75,-.75),(.98,0),(.7,.85),(0,1),(-.8,.7)]
        return {"id":id,"label":id,"kind":"fill","semantic":"wing_panel","color":color,
                "layer":0,"confidence":"high",
                "points":[{"x":round((cx+dx*58)*1000/240),"y":round((70+dy*50)*1000/160)} for dx,dy in vertices],
                "notes":"synthetic test"}
    return {"status":"AI_GEOMETRY_PROPOSAL_NOT_STITCHED",
            "regions":[one("left",64,"#AABBDD"),one("right",174,"#EECCAA")],
            "warnings":[],"requires_machine_test":True}
class AutoMothMobileTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright=sync_playwright().start()
        kwargs={"headless":True}
        if os.environ.get("STITCH_FORGE_CHROMIUM"):
            kwargs["executable_path"]=os.environ["STITCH_FORGE_CHROMIUM"]
        cls.browser=cls.playwright.chromium.launch(**kwargs)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop()
    def test_one_click_rebuild_colours_and_undo(self):
        page=self.browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        try:
            page.set_content(page_source(),wait_until="load")
            for script in ["fill-geometry.js","auto-reconstruct.js","auto-reconstruct-ui.js"]:
                page.add_script_tag(content=(ROOT/"site"/script).read_text(encoding="utf8"))
            page.evaluate("""response => {
              window.fetch=async (url,init) => {
                if(url!=='/api/reconstruct-embroidery')throw Error('unexpected URL');
                if(!init.headers.Authorization.startsWith('Bearer '))throw Error('missing token');
                const body=JSON.parse(init.body);if(!body.image.startsWith('data:image/jpeg;base64,'))throw Error('missing image');
                return {ok:true,json:async()=>response};
              };
            }""",geometry())
            page.locator("#sfAutoToken").fill("synthetic-test-token")
            page.locator("#sfAutoRun").click()
            page.wait_for_function("document.querySelector('#sfAutoStatus').textContent.includes('Automatically rebuilt')",timeout=15000)
            self.assertEqual(page.evaluate("window.__stitchforge_test.paths.length"),2)
            colors=page.evaluate("window.__stitchforge_test.pathColors")
            self.assertEqual(colors,["#AABBDD","#EECCAA"])
            self.assertFalse(page.locator("#sfAutoDownload").is_disabled())
            self.assertEqual(page.locator("#sfAutoOverlay path").count(),2)
            xml=page.evaluate("window.StitchForgeAIContext.exportEditableSvg()")
            self.assertIn('fill="#AABBDD"',xml)
            self.assertIn('fill="#EECCAA"',xml)
            page.locator("#dstBtn").click()
            self.assertIn("Multi-colour embroidery",page.locator("#status").inner_text())
            page.locator("#sfAutoUndo").click()
            self.assertEqual(page.evaluate("window.__stitchforge_test.paths.length"),1)
            self.assertEqual(page.evaluate("window.__stitchforge_test.pathColors"),["#153e46"])
            self.assertEqual(errors,[])
        finally:
            page.close()
if __name__=="__main__":unittest.main()
