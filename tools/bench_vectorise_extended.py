#!/usr/bin/env python3
"""Offline candidate comparison. Each engine/fixture runs in an isolated process.
No customer artwork or API calls. Oracle methods are controls, not segmentation.
"""
import hashlib
import argparse, importlib.metadata, io, json, platform, resource, statistics
import subprocess, sys, time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import cairosvg
from bench_vectorise import fixtures, P, W, cv_trace, vt_trace, border_guard


def cases():
    for name, a, colours, safe in fixtures():
        yield name, a, colours, safe
    a = np.full((256,256,3),255,np.uint8)
    cv2.circle(a,(90,120),65,P['blue'],-1)
    cv2.circle(a,(90,120),34,W,-1)
    for xy in [(190,50),(210,125),(185,210)]: cv2.circle(a,xy,12,P['orange'],-1)
    yield 'holes_islands',a,['blue','orange'],True
    rgba=np.dstack((a,np.uint8(np.any(a!=255,axis=2))*255))
    rgba[rgba[:,:,3]==0,:3]=[11,199,55] # invisible RGB must not become thread
    yield 'transparent_holes',rgba,['blue','orange'],True
    a=np.full((256,256,3),255,np.uint8)
    yy,xx=np.indices((256,256)); mask=((xx-128)/82)**2+((yy-130)/90)**2<1
    shade=(.65+.35*(xx/255))[:,:,None]
    colour=(np.array(P['blue'])*shade).astype(np.uint8)
    a[mask]=colour[mask]
    for y in range(65,205,10): cv2.line(a,(85,y),(165,y+18),P['navy'],1)
    cv2.circle(a,(150,85),5,P['dark'],-1)
    yield 'shaded_wildlife_proxy',a,['blue','navy','dark'],True


def composite(a):
    if a.shape[2]==3:return a
    alpha=a[:,:,3:4].astype(float)/255
    return np.rint(a[:,:,:3]*alpha+255*(1-alpha)).astype(np.uint8)


def labels_svg(labels, palette):
    """Marching squares at pixel-cell boundaries, with compound evenodd rings."""
    from skimage.measure import find_contours, approximate_polygon
    h,w=labels.shape; paths=[]
    for i,c in enumerate(palette):
        if tuple(c)==W:continue
        rings=find_contours(np.pad(labels==i,1),.5,fully_connected='low')
        ds=[]
        for ring in rings:
            pts=approximate_polygon(ring,tolerance=.25)-.5
            if len(pts)<4:continue
            ds.append('M '+' L '.join(f'{x:.2f},{y:.2f}' for y,x in pts)+' Z')
        if ds:paths.append(f'<path fill="#{bytes(c).hex()}" fill-rule="evenodd" d="{" ".join(ds)}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="white"/>{"".join(paths)}</svg>'


def trace(engine,a,colours):
    rgb=composite(a)
    if engine=='opencv_oracle':return cv_trace(rgb,colours)
    if engine=='vtracer_baseline':return vt_trace(rgb,colours)
    if engine=='vtracer_detail':
        import vtracer
        rgba=a if a.shape[2]==4 else np.dstack((a,np.full(a.shape[:2],255,np.uint8)))
        return vtracer.Config(mode='polygon',hierarchical='cutout',max_colors=32,
            color_precision=8,filter_speckle=0,layer_difference=0,path_precision=3).convert_pixels(rgba.tobytes(),a.shape[1],a.shape[0])
    if engine=='skimage_oracle':
        palette=np.array([W]+[P[c] for c in colours],np.uint8)
        labels=np.argmin(((rgb.astype(np.int32)[:,:,None]-palette.astype(np.int32))**2).sum(3),axis=2)
    elif engine=='quantized_marching':
        im=Image.fromarray(rgb).quantize(colors=16,method=Image.Quantize.MAXCOVERAGE,dither=Image.Dither.NONE)
        labels=np.array(im);palette=np.array(im.getpalette(),np.uint8).reshape(-1,3)
    elif engine=='skimage_felzenszwalb':
        from skimage.segmentation import felzenszwalb
        labels=felzenszwalb(rgb,scale=30,sigma=0,min_size=4)
        palette=np.array([np.rint(rgb[labels==i].mean(0)) for i in range(labels.max()+1)],np.uint8)
    else:raise ValueError(engine)
    return labels_svg(labels,palette)


def metrics(a,svg,colours):
    truth=composite(a);h,w=truth.shape[:2]
    rendered=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=w,output_height=h))).convert('RGBA')
    bg=Image.new('RGBA',rendered.size,'white');bg.alpha_composite(rendered)
    result=np.array(bg.convert('RGB'))
    palette=np.array([W]+[P[c] for c in colours],np.int32)
    def lab(x):return np.argmin(((x.astype(np.int32)[:,:,None]-palette)**2).sum(3),axis=2)
    x,y=lab(truth),lab(result);per=[]
    def topology(mask):
        contours,hier=cv2.findContours(np.uint8(mask),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
        if hier is None:return [0,0]
        return [int(sum(v[3]<0 for v in hier[0])),int(sum(v[3]>=0 for v in hier[0]))]
    for i,c in enumerate(colours,1):
        p,q=x==i,y==i;union=np.count_nonzero(p|q)
        per.append(dict(colour=c,iou=round(np.count_nonzero(p&q)/max(1,union),5),
            missing_pixels=int(np.count_nonzero(p&~q)),false_pixels=int(np.count_nonzero(q&~p)),
            source_topology=topology(p),output_topology=topology(q)))
    p,q=x>0,y>0
    def boundary(mask):return mask & ~cv2.erode(np.uint8(mask),np.ones((3,3),np.uint8)).astype(bool)
    bp,bq=boundary(p),boundary(q)
    distances=np.concatenate((cv2.distanceTransform(np.uint8(~bp),cv2.DIST_L2,5)[bq],cv2.distanceTransform(np.uint8(~bq),cv2.DIST_L2,5)[bp]))
    return dict(boundary_mean_px=round(float(distances.mean()),4) if len(distances) else None,
        boundary_p95_px=round(float(np.percentile(distances,95)),4) if len(distances) else None,macro_colour_iou=round(statistics.mean(v['iou'] for v in per),5),
        foreground_iou=round(np.count_nonzero(p&q)/max(1,np.count_nonzero(p|q)),5),
        false_foreground_pixels=int(np.count_nonzero(q&~p)),missing_foreground_pixels=int(np.count_nonzero(p&~q)),
        rgb_mae=round(float(np.abs(truth.astype(float)-result).mean()),3),
        per_colour=per,svg_bytes=len(svg.encode()),paths=svg.count('<path'))

ENGINES=['opencv_oracle','vtracer_baseline','vtracer_detail','skimage_oracle','quantized_marching','skimage_felzenszwalb']
def main():
    p=argparse.ArgumentParser();p.add_argument('--worker',nargs=2);p.add_argument('--output',type=Path,default=Path('/tmp/vector-extended.json'));p.add_argument('--repeats',type=int,default=3);args=p.parse_args()
    if args.worker:
        engine,name=args.worker;a,colours,safe=next((a,c,s) for n,a,c,s in cases() if n==name)
        times=[];outputs=[]
        for _ in range(args.repeats):
            start=time.perf_counter();svg=trace(engine,a,colours);times.append((time.perf_counter()-start)*1000);outputs.append(svg)
        # RSS includes Python, imports and tracing; measured before rasterisation.
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024
        measured=[metrics(a,out,colours) for out in outputs]
        print(json.dumps(dict(output_sha256=[hashlib.sha256(out.encode()).hexdigest() for out in outputs],
            repeat_macro_iou_range=[min(m['macro_colour_iou'] for m in measured),max(m['macro_colour_iou'] for m in measured)],fixture=name,engine=engine,expected_background_safe=safe,
            preflight_rejects=border_guard(composite(a)),trace_ms=times,median_trace_ms=round(statistics.median(times),2),
            process_peak_rss_mib=round(peak,2),**measured[-1])))
        return
    rows=[]
    for name,*_ in cases():
        for engine in ENGINES:
            try:
                r=subprocess.run([sys.executable,__file__,'--worker',engine,name,'--repeats',str(args.repeats)],capture_output=True,text=True,timeout=90,check=True)
                rows.append(json.loads(r.stdout))
            except Exception as exc: rows.append(dict(fixture=name,engine=engine,error=str(exc)))
    result=dict(environment={m:importlib.metadata.version(m) for m in ['vtracer','scikit-image','opencv-python-headless','numpy','Pillow','CairoSVG']},python=platform.python_version(),
        warning='Synthetic 256px fixtures only. Oracle methods receive exact palette. RSS includes imports, not browser memory. Shaded wildlife is a procedural proxy, not realistic wildlife acceptance.',rows=rows)
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps([dict(fixture=r['fixture'],engine=r['engine'],iou=r.get('macro_colour_iou'),ms=r.get('median_trace_ms'),error=r.get('error')) for r in rows],indent=2))
    if any('error' in r for r in rows):raise SystemExit(1)
if __name__=='__main__':main()
