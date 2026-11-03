"""Conservative automatic straight satin-object planner from verified source runs.

MD-2.71 offline R&D, opt-in only. Converts *whole, straight, nearly rectangular*
source-colour components into bounded native Ink/Stitch satin rails and rungs.
No AI anatomy guess, new pixels, palette changes or physically approved stitches.

Stronger geometry is deliberately refused rather than stretched around curved
feathers or leaves. Full decoded PES/DST source-containment audits still apply.
"""
from __future__ import annotations

from math import hypot, isfinite, ceil
from shapely import box, union_all, Polygon
from satin_native import SatinColumn, validate_column


def propose_straight_satin(component, scale, colour, *, origin=(2.,2.),
                           max_runs=2500, min_length_mm=6.,
                           min_rectangle_fraction=.92):
    """Return (SatinColumn, independent physical source evidence), or None.

    component is independently rebuilt from source RLE, not an AI proposal.
    Candidate strips and whole quad intersections must be strictly INSIDE
    the exact source polygon before real native Ink/Stitch export.
    """
    if (not isinstance(component,dict)
            or not isinstance(component.get('runs'),list)
            or isinstance(scale,bool) or not isinstance(scale,(int,float))
            or not isfinite(scale) or not .02<=scale<=2
            or not isinstance(colour,str) or len(colour)!=7
            or any(c not in '0123456789ABCDEF' for c in colour[1:])
            or not isinstance(origin,(tuple,list)) or len(origin)!=2
            or any(not isfinite(x) for x in origin)):
        raise ValueError('Invalid source satin proposal inputs')
    runs=component['runs']
    if not 4<=len(runs)<=max_runs:
        return None
    source=union_all([box(x0,y,x1,y+1) for y,x0,x1 in runs])
    if source.is_empty or source.geom_type!='Polygon' or source.interiors:
        return None
    if not source.is_valid:
        raise ValueError('Source colour component geometry invalid')
    outline=source.minimum_rotated_rectangle
    if outline.geom_type!='Polygon' or outline.area<=0:
        return None
    corners=list(outline.exterior.coords)[:4]
    edges=[(hypot(corners[(i+1)%4][0]-corners[i][0],
                  corners[(i+1)%4][1]-corners[i][1]),i) for i in range(4)]
    length,i=max(edges)
    side=edges[(i+1)%4][0]
    if side<=0:
        return None
    native_length=length*scale
    native_width=side*scale
    rectangle_ratio=source.area/outline.area
    if (rectangle_ratio<min_rectangle_fraction
            or native_length<min_length_mm or native_length>70
            or native_width<2.15 or native_width>3.95
            or native_length/max(native_width,.001)<3.8
            or source.area*scale*scale<12):
        return None
    start=corners[i]
    end=corners[(i+1)%4]
    ux=(end[0]-start[0])/length
    uy=(end[1]-start[1])/length
    nx,ny=-uy,ux
    cx,cy=outline.centroid.x,outline.centroid.y
    tip_inset=.48/scale
    side_inset=.33/scale
    half=(side/2-side_inset)
    if 2*half*scale<1.5 or tip_inset*2>length-3/scale:
        return None
    count=min(18,max(5,int(ceil(native_length/3.0))+1))
    left=[];right=[]
    for n in range(count):
        t=-length/2+tip_inset+(length-2*tip_inset)*n/(count-1)
        px,py=cx+ux*t,cy+uy*t
        l=(px+nx*half,py+ny*half)
        r=(px-nx*half,py-ny*half)
        left.append(l);right.append(r)
    # A source-space strip from BOTH rails must be contained in the exact
    # source mask; testing just the rungs is insufficient (corners matter).
    strip=Polygon([*left,*reversed(right)])
    if not strip.is_valid or strip.is_empty:
        return None
    interior=source.buffer(-.08/scale)
    if interior.is_empty or not interior.covers(strip):
        return None
    # Preserve both rails, not just a skeleton that would thin important art.
    def mm(points):
        return tuple((round(origin[0]+x*scale,4),
                      round(origin[1]+y*scale,4)) for x,y in points)
    l,r=mm(left),mm(right)
    column=SatinColumn(l,r,tuple(zip(l,r)),colour,
                       zigzag_spacing_mm=.4,max_stitch_length_mm=3.5)
    try:
        validate_column(column,source.bounds[2]*scale+origin[0]+2,
                       source.bounds[3]*scale+origin[1]+2)
    except ValueError:
        return None
    return column, {
        'method':'straight_source_rectangle_rails_rungs_v1',
        'sourceRectangularity':round(rectangle_ratio,4),
        'sourceLengthMm':round(native_length,3),
        'sourceWidthMm':round(native_width,3),
        'plannedSatinWidthMm':round(2*half*scale,3),
        'plannedRungs':count,
        'sourceStripStrictlyContained':True,
        'newSourceColoursOrPixels':False,
        'semanticFeatherIdentificationVerified':False,
        'physicalSewoutVerified':False,
        'machineApproved':False
    }
