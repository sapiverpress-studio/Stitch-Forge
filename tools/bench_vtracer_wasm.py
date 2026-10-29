#!/usr/bin/env python3
"""Disposable browser WASM evaluation; no vendored code or production integration.
Download official npm @visioncortex/vtracer@1.0.0-alpha.4 with npm pack,
extract locally, then pass --package /path/to/package/pkg. No API requests.
"""
import argparse,base64,json,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);args=parser.parse_args()
pkg=args.package;wasm=(pkg/'vtracer_wasm_bg.wasm').read_bytes()
source=(pkg/'vtracer_wasm.js').read_text();source=source[:source.index('const wasmPath =')]
source='const exports={};\n'+source+'''\nconst start=performance.now();
const wasmModule=new WebAssembly.Module(Uint8Array.from(atob(DATA),c=>c.charCodeAt(0)));
const wasmInstance=new WebAssembly.Instance(wasmModule,__wbg_get_imports());
const wasm=wasmInstance.exports;wasm.__wbindgen_start();
window.vt=exports;window.vtMemory=()=>wasm.memory.buffer.byteLength;
window.vtInit=performance.now()-start;'''.replace('DATA',json.dumps(base64.b64encode(wasm).decode()))
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':390,'height':844},is_mobile=True)
 page.add_script_tag(content=source)
 rows=page.evaluate('''()=>[256,512,768,1024].map(n=>{
 const a=new Uint8Array(n*n*4);a.fill(255);
 for(let y=n/8;y<7*n/8;y++)for(let x=n/8;x<7*n/8;x++){
 const i=(y*n+x)*4;a[i]=x<n/2?19:230;a[i+1]=x<n/2?112:104;a[i+2]=x<n/2?195:43;
 }
 const times=[];let svg;
 for(let i=0;i<3;i++){const t=performance.now();svg=vt.vectorize_rgba(a,n,n,{mode:'polygon',hierarchical:'cutout',filter_speckle:0,color_precision:8,max_colors:32});times.push(performance.now()-t);}
 return {size:n,times_ms:times,wasm_memory_bytes:vtMemory(),svg_bytes:svg.length,has_svg:svg.includes('<svg')};
})''')
 print(json.dumps(dict(wasm_bytes=len(wasm),initialization_ms=page.evaluate('vtInit'),browser=b.version,rows=rows,limitations='Desktop Chromium with mobile viewport; not physical Android. Node package bootstrap adapted in disposable harness; no production wrapper shipped.'),indent=2));b.close()
