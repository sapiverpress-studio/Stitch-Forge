"""Bounded polygon partition for native tatami fills. No machine approval.
No GPL/AGPL sources copied. Holes and all source geometry are preserved.
"""
from math import atan2, ceil, degrees, hypot, isfinite
from shapely.affinity import rotate
from shapely.geometry import box
from shapely.ops import unary_union

def _polys(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g] if g.area>1e-10 else []
    if hasattr(g,'geoms'):return [p for c in g.geoms for p in _polys(c)]
    return []

def _major_angle(poly):
    ring=list(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    edges=[(ring[(i+1)%4][0]-ring[i][0],
            ring[(i+1)%4][1]-ring[i][1]) for i in range(4)]
    dx,dy=max(edges,key=lambda e:hypot(*e))
    return round(degrees(atan2(dy,dx))%180,5)

def decompose_tatami(poly,scale,*,target_section_mm=3.5,
                     min_section_area_mm2=.35,max_sections=12):
    """Return source-exact complete tatami polygons, else reject.

    No output path is a running skeleton, no area is silently dropped, and
    no numerical tolerance is relaxed in the downstream stitch audit.
    """
    if (poly.geom_type!='Polygon' or poly.is_empty or not poly.is_valid or
            isinstance(scale,bool) or not isinstance(scale,(int,float)) or
            not isfinite(scale) or not .02<=scale<=3 or
            isinstance(target_section_mm,bool) or not isinstance(target_section_mm,(int,float)) or
            not isfinite(target_section_mm) or not 2<=target_section_mm<=8 or
            isinstance(min_section_area_mm2,bool) or not isinstance(min_section_area_mm2,(int,float)) or
            not isfinite(min_section_area_mm2) or not .2<=min_section_area_mm2<=1 or
            isinstance(max_sections,bool) or not isinstance(max_sections,int) or
            not 2<=max_sections<=24):
        raise ValueError('Invalid bounded tatami decomposition input')
    if poly.area*scale*scale<3:
        raise ValueError('Fill too small for bounded tatami decomposition')
    centre=(poly.centroid.x,poly.centroid.y)
    choices=[]
    for angle in dict.fromkeys((_major_angle(poly),0.,90.)):
        src=rotate(poly,-angle,origin=centre)
        x0,y0,x1,y1=src.bounds
        span=(x1-x0)*scale
        if span<2*target_section_mm*.85:continue
        wanted=max(2,ceil(span/target_section_mm))
        for count in range(min(wanted,max_sections),1,-1):
            if span/count>target_section_mm*1.8:continue
            width=(x1-x0)/count
            parts=[]
            for i in range(count):
                cut=src.intersection(box(x0+i*width,y0-width,
                                         x0+(i+1)*width,y1+width))
                parts.extend(_polys(cut))
            if not 2<=len(parts)<=max_sections:continue
            if any(p.area*scale*scale<min_section_area_mm2 or
                   p.buffer(-.15/scale).is_empty for p in parts):continue
            if (unary_union(parts).symmetric_difference(src).area*scale*scale>1e-6 or
                    sum(p.area for p in parts)-src.area>1e-8):continue
            seams=max(0.,(sum(p.boundary.length for p in parts)-src.boundary.length)/2*scale)
            rotated=[rotate(p,angle,origin=centre) for p in parts]
            if unary_union(rotated).symmetric_difference(poly).area*scale*scale>1e-6:continue
            choices.append((len(parts),round(seams,5),angle,rotated))
            break
    if not choices:
        raise ValueError('No safe bounded tatami subdivision; original fill retained')
    count,seams,angle,parts=min(choices,key=lambda x:x[:3])
    return {'sections':parts,'sectionCount':count,'directionDeg':angle,
            'interiorSeamLengthMm':seams,'sourceGeometryChanged':False,
            'preservedFill':True,'physicalQualityVerified':False}
