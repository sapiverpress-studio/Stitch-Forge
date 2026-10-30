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
    return source.replace(anchor,"let saved="+json.dumps(saved,separators=(",",":"))+";").replace(
        "window.StitchForgeAIContext=Object.freeze(",
        "rasterSource="+json.dumps(synthetic_image())+";window.StitchForgeAIContext=Object.freeze(")
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
                if(url==='/api/machine-embroidery'){
                  const data=JSON.parse(init.body);
                  if(data.reference||data.image||data.svg||data.paths.length!==2)throw Error('private source or incorrect geometry sent to native engine');
                  if(!init.headers.Authorization.startsWith('Bearer '))throw Error('missing owner token');
                  return {ok:false,status:503,json:async()=>({error:'Native worker not configured'})};
                }
                if(url!=='/api/reconstruct-embroidery')throw Error('unexpected URL');
                if(!init.headers.Authorization.startsWith('Bearer '))throw Error('missing token');
                const body=JSON.parse(init.body);if(!body.image.startsWith('data:image/jpeg;base64,'))throw Error('missing image');
                return {ok:true,json:async()=>response};
              };
            }""",geometry())
            page.locator("#sfAutoToken").fill("synthetic-test-token")
            page.locator("#sfAutoWorkflow").select_option("ai")
            page.locator("#sfAutoRun").click()
            page.wait_for_function("document.querySelector('#sfAutoStatus').textContent.includes('Native worker not configured')",timeout=15000)
            self.assertIn("Editable SVG and Undo remain available",page.locator("#sfAutoStatus").inner_text())
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
    def test_one_click_downloads_only_audited_native_archive(self):
        page=self.browser.new_page(viewport={"width":390,"height":844},is_mobile=True,
                                   has_touch=True,accept_downloads=True)
        try:
            page.set_content(page_source(),wait_until="load")
            for script in ["fill-geometry.js","auto-reconstruct.js","auto-reconstruct-ui.js"]:
                page.add_script_tag(content=(ROOT/"site"/script).read_text(encoding="utf8"))
            page.evaluate("""response => {
              window.fetch=async (url,init) => {
                if(url==='/api/reconstruct-embroidery')return {ok:true,json:async()=>response};
                if(url==='/api/machine-embroidery'){
                  const p=JSON.parse(init.body);
                  if(p.reference||p.image||p.svg||p.paths.length!==2||
                    p.pathColors[0]!=='#AABBDD'||p.pathColors[1]!=='#EECCAA')
                    throw Error('unsafe worker request');
                  const bytes=new Uint8Array(128);bytes.set([80,75,3,4]);
                  return {ok:true,headers:{get:(key)=>({
                    'x-stitch-forge-audit':'STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED',
                    'content-type':'application/zip'
                  })[key]||null},blob:async()=>new Blob([bytes],{type:'application/zip'})};
                }
                throw Error('unexpected URL');
              };
            }""",geometry())
            page.locator("#sfAutoWorkflow").select_option("ai")
            page.locator("#sfAutoToken").fill("synthetic-test-token")
            with page.expect_download(timeout=20000) as item:
                page.locator("#sfAutoRun").click()
            download=item.value
            self.assertEqual(download.suggested_filename,"stitch-forge-machine-files-UNTESTED.zip")
            self.assertIn("ZIP downloaded automatically",page.locator("#sfAutoStatus").inner_text())
            self.assertIn("NOT physically stitch-tested",page.locator("#sfAutoStatus").inner_text())
            self.assertEqual(page.evaluate("window.__stitchforge_test.paths.length"),2)
        finally:
            page.close()
    def test_single_region_and_partial_plan_export_gate(self):
        for incomplete in (False,True):
            with self.subTest(incomplete=incomplete):
                page=self.browser.new_page(viewport={"width":390,"height":844})
                try:
                    page.set_content(page_source(),wait_until="load")
                    for script in ["fill-geometry.js","auto-reconstruct.js","auto-reconstruct-ui.js"]:
                        page.add_script_tag(content=(ROOT/"site"/script).read_text())
                    plan=geometry();plan['regions']=plan['regions'][:1]
                    if incomplete:
                        plan['regions'].append({'id':'absent','label':'Absent feature','kind':'running',
                            'semantic':'detail','color':'#333333','confidence':'high','layer':1,
                            'points':[{'x':725,'y':300},{'x':725,'y':600}]})
                    page.evaluate("""plan=>{
                     window.machineCalls=0;
                     window.fetch=async url=>{
                      if(url==='/api/reconstruct-embroidery')return {ok:true,json:async()=>plan};
                      window.machineCalls++;return {ok:false,status:503,json:async()=>({error:'synthetic unavailable'})};
                     };
                    }""",plan)
                    page.locator("#sfAutoWorkflow").select_option("ai")
                    page.locator('#sfAutoToken').fill('synthetic-test-token')
                    page.locator('#sfAutoRun').click()
                    page.wait_for_function("!document.querySelector('#sfAutoRun').disabled")
                    self.assertEqual(page.evaluate('window.__stitchforge_test.paths.length'),1)
                    self.assertEqual(page.evaluate('window.machineCalls'),0) # omitted second wing must block even without a rejected proposal
                    text=page.locator('#sfAutoStatus').inner_text()
                    self.assertIn('Source fidelity check blocked',text)
                finally:
                    page.close()

    def test_changed_design_discards_pending_analysis_and_machine_result(self):
        for stage in ('analysis','machine'):
            with self.subTest(stage=stage):
                page=self.browser.new_page(viewport={"width":390,"height":844},accept_downloads=True)
                downloads=[]
                page.on('download',lambda d:downloads.append(d))
                try:
                    page.set_content(page_source(),wait_until="load")
                    for script in ["fill-geometry.js","auto-reconstruct.js","auto-reconstruct-ui.js"]:
                        page.add_script_tag(content=(ROOT/"site"/script).read_text())
                    page.evaluate("""({plan,stage})=>{
                      window.fetch=async (url,init)=>{
                        if(url==='/api/reconstruct-embroidery'){
                          if(stage==='analysis')await new Promise(r=>window.releasePending=r);
                          return {ok:true,json:async()=>plan};
                        }
                        await new Promise(r=>window.releasePending=r);
                        const bytes=new Uint8Array(128);bytes.set([80,75,3,4]);
                        return {ok:true,headers:{get:k=>({'x-stitch-forge-audit':
                          'STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED','content-type':'application/zip'})[k]},
                          blob:async()=>new Blob([bytes])};
                      };
                    }""",{'plan':geometry(),'stage':stage})
                    page.locator("#sfAutoWorkflow").select_option("ai")
                    page.locator('#sfAutoToken').fill('synthetic-test-token')
                    page.locator('#sfAutoRun').click()
                    page.wait_for_function('typeof window.releasePending === "function"')
                    # Even an edit followed by undo (same JSON) invalidates the pending job.
                    page.evaluate("window.dispatchEvent(new Event('stitchforge:image-imported')); window.releasePending()")
                    page.wait_for_function("!document.querySelector('#sfAutoRun').disabled")
                    self.assertEqual(downloads,[])
                    self.assertIn('stale',page.locator('#sfAutoStatus').inner_text())
                    if stage=='analysis':
                        self.assertEqual(page.evaluate('window.__stitchforge_test.paths.length'),1)
                finally:
                    page.close()
if __name__=="__main__":unittest.main()
