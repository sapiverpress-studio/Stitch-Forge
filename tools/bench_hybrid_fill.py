"""Offline polygon-only routing A/B; no cloud, AI, native output or sewout claims.

The input SVG is a trusted locally generated Stitch Forge SVG with basic M/L/Z
paths. Never copy the original artwork or personal source files to GitHub.
"""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import Polygon
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from source_scanline_fill import plan_scanline_fill
from geometry_intelligence import jump_distance_mm


def extract_polygons(svg, *, max_samples=12):
    root=ET.fromstring(svg)
    result=[]
    for node in root.iter():
        if node.tag.rsplit('}',1)[-1]!='path' or node.get('fill') in (None,'none'):
            continue
        d=node.get('d','')
        if re.search(r'[^MLZ0-9\s,\.\-+]',d):
            continue
        rings=[]
        for ring in d.split('Z'):
            nums=[float(n) for n in re.findall(r'-?(?:\d+\.\d*|\d+|\.\d+)',ring)]
            if len(nums)>=6 and len(nums)%2==0:
                rings.append(list(zip(nums[::2],nums[1::2])))
        if not rings:
            continue
        poly=Polygon(rings[0],rings[1:])
        if poly.is_valid and not poly.is_empty and 3<=poly.area<=600:
            result.append((poly.area,node.get('id'),poly))
    result.sort(key=lambda r:-r[0])
    pool=result[:50]
    step=max(1,len(pool)//max_samples)
    return pool[::step][:max_samples]


def benchmark(svg, *, max_samples=12):
    rows=[]
    for area,identity,poly in extract_polygons(svg,max_samples=max_samples):
        try:
            baseline=plan_scanline_fill(poly,1)
            hybrid=plan_scanline_fill(poly,1,adaptive=True)
            prior=jump_distance_mm(baseline['routes'],1)
            newer=jump_distance_mm(hybrid['routes'],1)
            rows.append({
                'id':identity,'polygonAreaMm2':round(area,3),
                'baselineRoutes':baseline['routeCount'],'hybridRoutes':hybrid['routeCount'],
                'baselineCoverageProxy':baseline['interiorProxyFraction'],
                'hybridCoverageProxy':hybrid['interiorProxyFraction'],
                'baselinePenUpMm':round(prior,3),'hybridPenUpMm':round(newer,3),
                'actualEmbroideryStitchCountVerified':False,
                'physicalQualityVerified':False,
            })
        except ValueError as error:
            rows.append({'id':identity,'polygonAreaMm2':round(area,3),
                         'rejected':str(error)})
    passed=[r for r in rows if 'rejected' not in r]
    report={
        'scope':'Existing locally generated SVG geometry, not new raster analysis or physical embroidery.',
        'samples':len(rows),'accepted':len(passed),
        'routeCountNonRegression':all(r['hybridRoutes']<=r['baselineRoutes'] for r in passed),
        'coverageNonRegression':all(r['hybridCoverageProxy']>=r['baselineCoverageProxy']-.0201 for r in passed),
        'penUpNonRegression':all(r['hybridPenUpMm']<=r['baselinePenUpMm']+.001 for r in passed),
        'penUpReductionProxyMm':round(sum(r['baselinePenUpMm']-r['hybridPenUpMm'] for r in passed),3),
        'machineApproved':False,'rows':rows}
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--svg',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--samples',type=int,default=12)
    opts=p.parse_args()
    result=benchmark(opts.svg.read_bytes(),max_samples=opts.samples)
    opts.out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='rows'},indent=2))
    if not all(result[k] for k in ('routeCountNonRegression','coverageNonRegression','penUpNonRegression')):
        raise SystemExit(1)
