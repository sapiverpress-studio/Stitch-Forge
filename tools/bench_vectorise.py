#!/usr/bin/env python3
"""Stitch Forge: offline colour-vectorisation benchmark. No API/hosting calls.
Requires numpy, opencv-python, Pillow and cairosvg. Optional: vtracer==1.0.0a4.
Run: python tools/bench_vectorise.py --output /tmp/stitch-vector-results.json
The OpenCV baseline receives the exact *synthetic* fixture palette (an advantage
VTracer does not receive); do not generalise accuracy to arbitrary customer art.
"""
import argparse
import io
import json
import time
import xml.etree.ElementTree as ET
from pathlib import Path
import cv2
import numpy as np
import cairosvg
from PIL import Image

N=256
W=(255,255,255)
P={'navy':(31,55,100),'blue':(19,112,195),'teal':(20,168,168),
   'orange':(230,104,43),'green':(52,131,76),'dark':(33,44,51),
   'red':(210,64,87),'yellow':(245,187,47)}

def fixtures():
 def blank():return np.full((N,N,3),255,np.uint8)
 def ellipse(a,color,x,y,rx,ry,angle=0):
  cv2.ellipse(a,(x,y),(rx,ry),angle,0,360,color,-1,cv2.LINE_8)
 def poly(a,color,pts):cv2.fillPoly(a,[np.array(pts,np.int32)],color,cv2.LINE_8)
 def line(a,color,aa,bb,t):cv2.line(a,aa,bb,color,t,cv2.LINE_8)
 a=blank();poly(a,P['navy'],[(60,25),(196,25),(222,64),(222,194),(192,222),(60,222),(34,190),(34,64)]);ellipse(a,P['orange'],130,124,73,71);ellipse(a,P['blue'],130,124,38,38);poly(a,P['green'],[(117,86),(156,124),(117,164),(92,124)])
 yield 'logo',a,['navy','orange','blue','green'],True
 a=blank();line(a,P['green'],(132,239),(129,110),9)
 poly(a,P['green'],[(129,183),(90,145),(70,145),(92,189),(122,202)]);poly(a,P['green'],[(130,204),(177,157),(198,151),(185,191),(144,215)])
 for x,y,deg in [(129,59,0),(183,95,50),(160,154,112),(96,153,240),(74,89,315)]:ellipse(a,P['red'],x,y,29,40,deg)
 ellipse(a,P['yellow'],128,105,30,30);ellipse(a,P['navy'],129,106,9,9)
 yield 'botanical',a,['red','yellow','green','navy'],True
 a=blank();line(a,P['dark'],(28,224),(234,220),7);ellipse(a,P['orange'],139,151,74,56,-22);ellipse(a,P['blue'],124,96,48,48,18)
 poly(a,P['teal'],[(98,111),(133,120),(168,177),(127,170),(93,135)]);poly(a,P['dark'],[(82,91),(28,107),(85,104)]);ellipse(a,W,122,120,16,10);ellipse(a,P['dark'],115,86,6,6)
 poly(a,P['blue'],[(166,165),(221,184),(192,189)]);line(a,P['dark'],(142,191),(140,217),3);line(a,P['dark'],(166,198),(175,215),3)
 for y in [133,139,145,151,157]:line(a,P['navy'],(115,y),(140,y+9),1)
 yield 'bird',a,['orange','blue','teal','navy','dark'],True
 a=blank();poly(a,P['blue'],[(28,31),(229,31),(229,223),(28,223)])
 for y in range(42,216,12):line(a,P['yellow'] if (y//12)%2 else P['orange'],(40,y),(215,y),2)
 poly(a,P['green'],[(108,83),(146,83),(146,173),(108,173)]);ellipse(a,P['dark'],127,125,7,7)
 yield 'fine_detail',a,['blue','yellow','orange','green','dark'],True
 a=blank();yy,xx=np.indices((N,N));a[:,:,0]=(92+xx*.42+np.sin(yy*.13)*24).clip(0,255).astype(np.uint8);a[:,:,1]=(106+yy*.43+np.cos(xx*.17)*25).clip(0,255).astype(np.uint8);a[:,:,2]=(143+(xx+yy)*.24+np.sin(xx*.12+yy*.21)*28).clip(0,255).astype(np.uint8);ellipse(a,P['red'],135,125,70,45)
 yield 'complex_background',a,['red'],False

def border_guard(a):
 sample=np.concatenate((a[0],a[-1],a[:,0],a[:,-1])).astype(np.float32)
 mean=sample.mean(axis=0)
 return bool(np.max(np.linalg.norm(sample-mean,axis=1))>45)

def cv_trace(a,colours):
 palette=np.array([W]+[P[c] for c in colours],np.int32)
 dist=((a.astype(np.int32)[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3)
 labels=np.argmin(dist,axis=2)
 paths=[]
 for idx,c in enumerate(colours,1):
  contours,h=cv2.findContours(np.uint8(labels==idx),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
  if h is None:continue
  for j,outer in enumerate(contours):
   if h[0][j][3]!=-1:continue
   rings=[outer]+[contours[k] for k in range(len(contours)) if h[0][k][3]==j]
   d=[]
   for ring in rings:
    pts=cv2.approxPolyDP(ring,.8,True).reshape(-1,2)
    if len(pts)<3:continue
    d.append('M '+' L '.join(f'{int(x)} {int(y)}' for x,y in pts)+' Z')
   if d:paths.append(f'<path fill="#{"".join(f"{v:02x}" for v in P[c])}" fill-rule="evenodd" d="{" ".join(d)}"/>')
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{N}" height="{N}"><rect width="{N}" height="{N}" fill="white"/>{"".join(paths)}</svg>'

def vt_trace(a,colours):
 import vtracer
 rgba=np.concatenate((a,np.full((N,N,1),255,np.uint8)),axis=2)
 cfg=vtracer.Config(mode='polygon',hierarchical='cutout',max_colors=min(12,len(colours)+1),filter_speckle=4,path_precision=2)
 return cfg.convert_pixels(rgba.tobytes(),N,N)

def measure(a,svg,colours):
 image=np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=N,output_height=N))).convert('RGB'))
 palette=np.array([W]+[P[c] for c in colours],np.int32)
 def label(b):return np.argmin(((b.astype(np.int32)[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3),axis=2)
 x,y=label(a),label(image)
 ious=[]
 for i in range(1,len(palette)):
  union=np.count_nonzero((x==i)|(y==i))
  if union:ious.append(np.count_nonzero((x==i)&(y==i))/union)
 fga,fgb=x!=0,y!=0;union=np.count_nonzero(fga|fgb)
 paths=sum(1 for el in ET.fromstring(svg).iter() if el.tag.endswith('path'))
 return {'macro_colour_iou':round(float(np.mean(ious)),4) if ious else None,
  'foreground_iou':round(np.count_nonzero(fga&fgb)/union,4) if union else None,
  'rgb_mae':round(float(np.abs(a.astype(np.int16)-image.astype(np.int16)).mean()),2),
  'paths':paths,'svg_bytes':len(svg.encode())}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path('vectorisation-results.json'));args=parser.parse_args()
 try:import vtracer;available=True
 except ImportError:available=False
 results=[]
 for name,a,colours,safe in fixtures():
  guard=border_guard(a)
  for engine,fn in [('opencv_oracle',cv_trace)]+([('vtracer',vt_trace)] if available else []):
   start=time.perf_counter()
   try:svg=fn(a,colours);row=measure(a,svg,colours)
   except Exception as exc:row={'error':str(exc)}
   results.append({'fixture':name,'engine':engine,'expected_background_safe':safe,'preflight_rejects':guard,'elapsed_ms':round((time.perf_counter()-start)*1000,1),**row})
 report={'vtracer_benchmarked':available,'vtracer_version':'1.0.0a4' if available else None,
 'warning':'OpenCV baseline has oracle palette advantage; masks are not stitches. Background guard must reject complex images. Timing depends on hardware.', 'rows':results}
 args.output.parent.mkdir(parents=True,exist_ok=True)
 args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 return 0 if not any('error' in r for r in results) else 1
if __name__=='__main__':raise SystemExit(main())
