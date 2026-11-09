#!/usr/bin/env python3
"""Smoke the ACTUAL Netlify MD-2.77 preview in Chromium at phone width.

Only a generated local synthetic PNG is uploaded. No private source, token,
AI billing, machine-job submission, or production traffic mutation.
"""
from io import BytesIO
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

URL="https://deploy-preview-2--sapiver-stitchforge.netlify.app/"
def synthetic_png():
    im=Image.new("RGBA",(192,192),(0,0,0,0))
    d=ImageDraw.Draw(im)
    d.ellipse((42,26,150,142),fill="white",outline="#131313",width=4)
    d.rectangle((43,82,149,148),fill="white")
    d.line([(43,143),(62,153),(82,143),(99,153),(120,143),(149,149)],fill="#131313",width=4)
    d.ellipse((73,76,85,90),fill="#131313")
    d.ellipse((110,76,122,90),fill="#131313")
    d.ellipse((92,105,101,118),fill="#131313")
    out=BytesIO();im.save(out,format="PNG");return out.getvalue()


def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
        page=browser.new_page(viewport={"width":390,"height":844},
            device_scale_factor=1,is_mobile=True,has_touch=True)
        external=[]
        page.on("request",lambda request:external.append(request.url)
                if "/api/artwork-job-submit" in request.url or
                   "/api/analyse-embroidery" in request.url else None)
        response=page.goto(URL,wait_until="domcontentloaded",timeout=40000)
        if response is None or response.status!=200:
            raise AssertionError("Preview did not serve HTTP 200")
        page.locator("#sfSimpleFlow").wait_for(state="visible",timeout=15000)
        assert page.locator("#sfQuickArtworkType").input_value()=="simple"
        assert page.locator("#sfAutoUseAI").is_checked() is False
        assert page.locator("#sfQuickGenerate").is_disabled()
        assert page.locator("#sfQuickZip").is_disabled()
        body_width=page.evaluate("document.documentElement.scrollWidth")
        if body_width>396:
            offenders=page.evaluate("""() => [...document.body.querySelectorAll('*')].map(
              e => ({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,80),
                right:Math.round(e.getBoundingClientRect().right),
                width:Math.round(e.getBoundingClientRect().width)}))
                .filter(x=>x.right>396 && x.width>5)
                .sort((a,b)=>b.right-a.right).slice(0,12)""")
            print({'mobileOverflow':body_width,'offenders':offenders},flush=True)
            raise AssertionError(f"Phone UI overflow: {body_width}px")
        page.locator("#importFile").set_input_files({
            "name":"synthetic-simple-ghost.png","mimeType":"image/png","buffer":synthetic_png()})
        page.wait_for_function("""() => {
          const x=document.querySelector('#sfQuickGenerate');
          return x && !x.disabled;
        }""",timeout=12000)
        assert page.locator("#sfQuickZip").is_disabled()
        assert page.locator("#sfQuickPES").is_disabled()
        assert page.locator("#sfQuickDST").is_disabled()
        page.locator("#sfQuickGenerate").click()
        page.locator("#sfQuickAuth").wait_for(state="visible",timeout=6000)
        assert page.locator("#sfQuickZip").is_disabled()
        assert not external,"Paid AI or real native job must not be invoked without token"
        print({"status":"READY_MOBILE_PREVIEW_SOURCE_UPLOAD_AND_SAFE_TOKEN_GATE",
          "viewport":"390x844","HTTP":response.status,
          "automaticProfile":"simple","paidAiChecked":False,
          "downloadUnsafe":False,"externalRequests":len(external),
          "machineFilesGenerated":False})
        browser.close()

if __name__=="__main__":run()
