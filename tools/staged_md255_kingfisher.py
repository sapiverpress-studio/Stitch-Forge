#!/usr/bin/env python3
"""Run the actual uploaded Cloud Shell kingfisher against staged MD-2.55 only.

Reads one file_*.png from the Cloud Shell home directory. Uses the same
source-bound browser packet builder and protected two-phase worker protocol.
Does not invoke OpenAI, deploy, or modify production traffic.
Output is a NOT APPROVED engineering ZIP and JSON report in home.
"""
import base64
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path.home() / "stitch-forge-md255"
PROJECT = "gen-lang-client-0857863712"
SERVICE = "stitch-forge-worker-staging"
TAG = "md255"
WIDTH_MM = 80

PACK_JS = r"""
const fs=require('node:fs');
const api=require('./site/artwork-pipeline.js');
(async()=>{
  const [raw,w,h,ow,oh,output,meta]=process.argv.slice(1);
  const rgba=new Uint8ClampedArray(fs.readFileSync(raw));
  const result=await api.pack(rgba,Number(w),Number(h),{
    imageWidthMm:80,originalWidth:Number(ow),originalHeight:Number(oh),
    texturePolicy:'if_needed',maxWorkingParts:1500
  });
  fs.writeFileSync(output,JSON.stringify(result.packet),{mode:0o600});
  fs.writeFileSync(meta,JSON.stringify({
    source:result.draft.source,physical:result.draft.physical,
    workingParts:result.plan.summary.workingParts,
    sourcePixels:result.plan.summary.sourcePixels
  }),{mode:0o600});
})().catch(error=>{
  console.error('SOURCE_PREPARATION_ERROR '+(error.code||'OTHER')+' '+error.message);
  process.exitCode=error.code==='SOURCE_DETAIL_BUDGET'?14:15;
});
"""

def image_input():
    paths = sorted(Path.home().glob("file_*.png"),key=lambda p:p.stat().st_mtime,reverse=True)
    if len(paths)!=1:
        raise RuntimeError("Expected exactly one uploaded file_*.png; found "+str(len(paths))+
            ". Files: "+", ".join(p.name for p in paths[:8]))
    return paths[0]

def command(*args,**kwargs):
    return subprocess.check_output(list(args),text=True,**kwargs).strip()

def prepare(original,tmp):
    from PIL import Image, ImageOps
    with Image.open(original) as raw:
        image=ImageOps.exif_transpose(raw).convert("RGBA")
        ow,oh=image.size
        if not(48<=ow and 48<=oh and ow*oh<=45_000_000):
            raise RuntimeError("Original resolution outside safe analysis bounds")
        sizes=json.loads(command("node","-e",
            "console.log(JSON.stringify(require('./site/artwork-pipeline.js').analysisSizes(80,"+
            str(ow)+","+str(oh)+",'if_needed')))",cwd=ROOT))
        print("SOURCE:",original.name,"original",ow,"x",oh,flush=True)
        for size in sizes:
            scale=min(1,size/max(ow,oh))
            w,h=round(ow*scale),round(oh*scale)
            if min(w,h)<48:continue
            data=image.resize((w,h),Image.Resampling.LANCZOS).tobytes()
            rawpath=tmp/"analysis.rgba"
            rawpath.write_bytes(data)
            result=subprocess.run(["node","-e",PACK_JS,str(rawpath),str(w),str(h),
                str(ow),str(oh),str(tmp/"packet.json"),str(tmp/"meta.json")],
                cwd=ROOT,text=True,capture_output=True)
            if result.returncode==0:
                packet=json.loads((tmp/"packet.json").read_text())
                meta=json.loads((tmp/"meta.json").read_text())
                print("PREPARED:",w,"x",h,"working components:",meta["workingParts"],
                      "source pixels:",meta["sourcePixels"],flush=True)
                return packet,meta
            if result.returncode!=14:
                raise RuntimeError("Cannot prepare source: "+result.stderr[-600:])
            print("Detail budget at",w,"x",h,"— using next physically suitable analysis size",flush=True)
    raise RuntimeError("Detailed source exceeds every bounded analysis resolution; no paid test run")

def start_proxy():
    with socket.socket() as s:
        s.bind(("127.0.0.1",0))
        port=s.getsockname()[1]
    log=open("/tmp/md255-kingfisher-proxy.log","w")
    process=subprocess.Popen(["gcloud","run","services","proxy",SERVICE,
        "--project="+PROJECT,"--region=europe-west2","--tag="+TAG,
        "--port="+str(port)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    for _ in range(45):
        if process.poll() is not None:
            raise RuntimeError("Google Cloud staging proxy stopped unexpectedly; see /tmp/md255-kingfisher-proxy.log")
        try:
            with socket.create_connection(("127.0.0.1",port),timeout=1):
                return process,log,port
        except OSError:time.sleep(1)
    process.terminate()
    raise RuntimeError("Cannot reach md255 proxy; see /tmp/md255-kingfisher-proxy.log")

def run_native(packet,port,token):
    def send(payload):
        url="http://127.0.0.1:"+str(port)+"/v1/artwork-trial"
        request=urllib.request.Request(url,data=json.dumps(payload,separators=(',',':')).encode(),
            headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(request,timeout=240) as response:
                return response.status,response.read(),response.headers
        except urllib.error.HTTPError as error:
            detail=error.read(500).decode(errors="replace")
            raise RuntimeError("Staged worker HTTP "+str(error.code)+": "+detail) from None

    repair=None
    for attempt in range(2):
        extra={"repairReceipt":repair} if repair else {}
        print("Running native PES generation"+(" with bounded repair" if repair else "")+"…",flush=True)
        status,body,_=send({**packet,"phase":"pes",**extra})
        if status!=200:raise RuntimeError("PES phase did not finish")
        pes=json.loads(body)
        receipt=pes.get("receipt",{})
        if pes.get("requestId")!=packet["requestId"] or receipt.get("requestId")!=packet["requestId"]:
            raise RuntimeError("PES request identity mismatch")
        raw=base64.b64decode(pes["pesBase64"],validate=True)
        if not raw.startswith(b"#PES0060") or hashlib.sha256(raw).hexdigest()!=receipt.get("pesSha256"):
            raise RuntimeError("PES native integrity verification failed")

        print("Running native DST and decoded-stitch audit…",flush=True)
        status,body,headers=send({**packet,"phase":"dst","receipt":receipt,
            "pesBase64":pes["pesBase64"],**extra})
        if status==202:
            response=json.loads(body)
            if attempt or response.get("status")!="BOUNDED_NATIVE_REPAIR_REQUIRED":
                raise RuntimeError("Native repair exceeded its one-pass limit")
            repair=response.get("repairReceipt")
            if not isinstance(repair,dict):raise RuntimeError("Missing bounded repair receipt")
            continue
        if status!=200:raise RuntimeError("DST phase failed")
        if headers.get("X-Stitch-Forge-Audit")!="SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED":
            raise RuntimeError("Native independent containment audit absent")
        if hashlib.sha256(body).hexdigest()!=headers.get("X-Stitch-Forge-SHA256"):
            raise RuntimeError("Native ZIP checksum mismatch")
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            if archive.testzip() is not None:raise RuntimeError("Corrupted ZIP entry")
            names=set(archive.namelist())
            required={"artwork-trial.pes","artwork-trial.dst","machine-report.json",
                "native-artwork-input.svg","decoded-preview.json"}
            if not required.issubset(names):raise RuntimeError("Incomplete audited ZIP")
            if archive.read("artwork-trial.pes")!=raw:
                raise RuntimeError("PES phase does not match delivered ZIP")
            report=json.loads(archive.read("machine-report.json"))
        if report.get("requestId")!=packet["requestId"] or report.get("machineEligible") is not False:
            raise RuntimeError("Native report does not match source or has invalid approval status")
        if any(d.get("needlePointsOutsideWorkingColour")!=0 or
               d.get("needleSegmentsOutsideWorkingColour")!=0 for d in report.get("decoded",[])):
            raise RuntimeError("Source colour containment failed")
        return body,report
    raise RuntimeError("Native repair did not complete; no ZIP saved")

def main():
    if not ROOT.is_dir():raise RuntimeError("Missing ~/stitch-forge-md255")
    image=image_input()
    with TemporaryDirectory(prefix="sf-md255-") as tmpdir:
        packet,meta=prepare(image,Path(tmpdir))
        print("Using protected MD-2.55 tag. Normal Cloud Run traffic unchanged.",flush=True)
        token=command("gcloud","secrets","versions","access","latest",
            "--secret=stitch-forge-worker-token","--project="+PROJECT)
        if not token:raise RuntimeError("Worker secret unavailable")
        proc=log=None
        try:
            proc,log,port=start_proxy()
            data,report=run_native(packet,port,token)
        finally:
            token=None
            if proc is not None:
                try:os.killpg(proc.pid,signal.SIGTERM)
                except ProcessLookupError:pass
            if log is not None:log.close()
        stamp=datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        out=Path.home()/("md255-kingfisher-"+stamp+"-NOT-APPROVED.zip")
        out.write_bytes(data)
        reportout=out.with_suffix(".json")
        reportout.write_text(json.dumps(report,indent=2)+"\n")
        print("\nSUCCESS: independent PES/DST archive validation PASSED",flush=True)
        print("SOURCE:",image.name,"analysis",meta["source"]["width"],"x",meta["source"]["height"])
        print("PATHS:",report.get("nativePaths"),"unresolved objects:",report.get("unresolvedObjects"),
              "underlay fills:",report.get("underlayFillPaths"))
        for item in report.get("decoded",[]):
            print(item.get("format"),"stitches:",item.get("needleStitches"),
                  "PES/DST trims:",item.get("trims"),"jumps:",item.get("jumps"),
                  "colour changes:",item.get("colourChanges"))
        print("PREVIOUS KINGFISHER BASELINE: 30,289 stitches, 1,055 PES trims")
        print("ZIP:",out)
        print("REPORT:",reportout)
        print("ENGINEERING TRIAL ONLY — physical stitch quality not approved",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as error:
        print("TEST FAILED: "+str(error),file=sys.stderr)
        sys.exit(1)
