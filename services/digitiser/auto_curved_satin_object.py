"""MD-2.72: conservative source-bound curved/tapered satin geometry candidate.

This is an automatic geometric *object* selector, not semantic feather or
leaf recognition. Source mask RLE is independently verified upstream.
The cross-section strip must be strictly INSIDE the original source-colour
polygon, and real PES/DST are independently decoded and audited afterward.

Opt-in engineering trial only; no general art-quality or physical sewout claim.
"""
from __future__ import annotations

from math import hypot, isfinite, ceil
from shapely import box, union_all, Polygon, LineString
from satin_native import SatinColumn, validate_column


def propose_curved_satin(component, scale, colour, *, origin=(2., 2.),
                         max_runs=2500):
    """Return (SatinColumn, source geometry evidence) or None.

    Accept only one smooth, moderately curved or tapered, physically stitchable
    elongated source region. Reject holes, branches, self-intersection, pinch,
    excessive width/taper and geometry outside the original source mask.
    """
    if (not isinstance(component, dict)
            or not isinstance(component.get('runs'), list)
            or isinstance(scale, bool) or not isinstance(scale, (int, float))
            or not isfinite(scale) or not .02 <= scale <= 2
            or not isinstance(colour, str) or len(colour) != 7
            or not colour.startswith('#')
            or any(c not in '0123456789ABCDEF' for c in colour[1:])
            or not isinstance(origin, (tuple, list)) or len(origin) != 2
            or any(isinstance(x, bool) or not isinstance(x, (int, float))
                   or not isfinite(x) or abs(x) > 400 for x in origin)):
        raise ValueError('Invalid source-bound curved satin inputs')

    runs = component['runs']
    if not 6 <= len(runs) <= max_runs:
        return None
    if any(not isinstance(r, (list, tuple)) or len(r) != 3
           or any(type(n) != int for n in r)
           or r[1] < 0 or r[0] < 0 or r[2] <= r[1]
           or r[2] > 2000 or r[0] > 2000 for r in runs):
        raise ValueError('Noncanonical source pixel runs')
    pixel_area = sum(x1-x0 for y, x0, x1 in runs)
    if pixel_area < 30 or pixel_area > 750000:
        return None
    source = union_all([box(x0,y,x1,y+1) for y,x0,x1 in runs])
    if (source.is_empty or source.geom_type != 'Polygon' or source.interiors
            or not source.is_valid or abs(source.area-pixel_area) > .001):
        return None

    rect = source.minimum_rotated_rectangle
    if rect.geom_type != 'Polygon' or rect.area <= 0:
        return None
    corners = list(rect.exterior.coords)[:4]
    sides = [(hypot(corners[(i+1)%4][0]-corners[i][0],
                    corners[(i+1)%4][1]-corners[i][1]), i)
             for i in range(4)]
    length, i = max(sides)
    nominal_width = rect.area / length
    physical_length = length*scale
    if (not 7 <= physical_length <= 70
            or not 2.4 <= nominal_width*scale <= 7
            or physical_length/max(nominal_width*scale, .001) < 2.9):
        return None
    rectangularity = source.area / rect.area
    # Straight nearly rectangular objects already use the verified MD-2.71
    # planner. This class specifically tests gentle curvature / taper.
    if rectangularity < .52 or rectangularity >= .96:
        return None

    start, end = corners[i], corners[(i+1)%4]
    ux = (end[0]-start[0])/length
    uy = (end[1]-start[1])/length
    nx,ny = -uy,ux
    center=(rect.centroid.x,rect.centroid.y)
    projections=[(x-center[0])*ux+(y-center[1])*uy
                 for x,y in source.exterior.coords]
    low,high=min(projections),max(projections)
    tip_inset=1.05/scale
    fitted_length_mm=(high-low-2*tip_inset)*scale
    if fitted_length_mm < 6:
        return None

    # A relatively large physical inset keeps chords around curved pixel edges
    # INSIDE the source. Narrow/tapered ends fail rather than stretching beyond.
    core_for_sections=source.buffer(-.55/scale)
    if core_for_sections.is_empty:
        return None
    span=max(source.bounds[2]-source.bounds[0],
             source.bounds[3]-source.bounds[1])*1.7+25
    steps=max(5,min(26,int(ceil(fitted_length_mm/2.3))+1))
    sections=[]
    for j in range(steps):
        t=low+tip_inset+(high-low-2*tip_inset)*j/(steps-1)
        mid=(center[0]+ux*t,center[1]+uy*t)
        cut=LineString([(mid[0]-nx*span,mid[1]-ny*span),
                        (mid[0]+nx*span,mid[1]+ny*span)])
        line=core_for_sections.intersection(cut)
        # Holes, branches or disconnected cross-sections are NOT satin rails.
        if line.is_empty or line.geom_type != 'LineString':
            return None
        a,b=list(line.coords)[0],list(line.coords)[-1]
        if ((a[0]-mid[0])*nx+(a[1]-mid[1])*ny
                > (b[0]-mid[0])*nx+(b[1]-mid[1])*ny):
            a,b=b,a
        width=hypot(b[0]-a[0],b[1]-a[1])*scale
        if not 1.58 <= width <= 4.9:
            return None
        sections.append((a,b,width))
    widths=[s[2] for s in sections]
    if max(widths)/min(widths) > 1.8:
        return None
    left=[s[0] for s in sections]
    right=[s[1] for s in sections]
    centers=[((a[0]+b[0])/2,(a[1]+b[1])/2)
             for a,b,_ in sections]
    offsets=[(p[0]-center[0])*nx+(p[1]-center[1])*ny for p in centers]
    drift_mm=(max(offsets)-min(offsets))*scale
    if drift_mm < .45 and max(widths)/min(widths) < 1.12:
        return None
    strip=Polygon([*left,*reversed(right)])
    if strip.is_empty or not strip.is_valid or strip.area <= 0:
        return None
    # Checking only rung endpoints would miss chord excursions on bends.
    # Strict polygon containment also resists 4-decimal SVG quantisation.
    core=source.buffer(-.07/scale)
    if not core.covers(strip) or strip.area/source.area < .50:
        return None

    def in_mm(points):
        return tuple((round(origin[0]+x*scale,4),
                      round(origin[1]+y*scale,4)) for x,y in points)
    l,r=in_mm(left),in_mm(right)
    column=SatinColumn(l,r,tuple(zip(l,r)),colour,
                       zigzag_spacing_mm=.4,max_stitch_length_mm=3.5)
    try:
        validate_column(column,source.bounds[2]*scale+origin[0]+2,
                        source.bounds[3]*scale+origin[1]+2)
    except ValueError:
        return None
    return column,{
        'method':'strict_source_cross_section_curved_tapered_satin_v1',
        'sourceLengthMm':round(fitted_length_mm,3),
        'widthMinMm':round(min(widths),3),
        'widthMaxMm':round(max(widths),3),
        'centerlineDriftMm':round(drift_mm,3),
        'sourceRectangularity':round(rectangularity,4),
        'sourceAreaRetainedInsideSatinStrip':round(strip.area/source.area,4),
        'sourceStripStrictlyContained':True,
        'sourceGeometryChanged':False,
        'sourcePaletteChanged':False,
        'semanticFeatherIdentificationVerified':False,
        'physicalSewoutVerified':False,
        'machineApproved':False
    }
