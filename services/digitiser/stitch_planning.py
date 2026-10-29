"""Geometry-derived planning diagnostics for trusted, generated SVG only.
Recommendations are experimental; no fabric compensation or satin rails are invented.
The engine remains responsible for stitches, underlay and travel inside each region.
"""
from math import atan2, degrees, hypot
from xml.etree import ElementTree as ET


def inspect_plan(svg: bytes) -> dict:
    root=ET.fromstring(svg)
    regions=[]; all_points=[]; previous=None; travel=0.0; changes=0
    ink='{http://inkstitch.org/namespace}'
    for node in root:
        tag=node.tag.rsplit('}',1)[-1]
        if tag not in ('polygon','polyline'):continue
        pts=[tuple(map(float,p.split(','))) for p in node.attrib['points'].split()]
        if len(pts)>1 and pts[0]==pts[-1]:pts=pts[:-1]
        all_points.extend(pts)
        fill=tag=='polygon';colour=node.get('fill') if fill else node.get('stroke')
        xs,ys=zip(*pts); width=max(xs)-min(xs);height=max(ys)-min(ys)
        perimeter=sum(hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(pts,pts[1:]))
        area=0.0
        if fill:
            perimeter+=hypot(pts[0][0]-pts[-1][0],pts[0][1]-pts[-1][1])
            area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(pts,pts[1:]+pts[:1])))/2
        mx=sum(xs)/len(xs);my=sum(ys)/len(ys)
        xx=sum((x-mx)**2 for x,y in pts);yy=sum((y-my)**2 for x,y in pts);xy=sum((x-mx)*(y-my) for x,y in pts)
        axis=.5*degrees(atan2(2*xy,xx-yy)) if xx!=yy or xy else None
        warnings=[]
        # 2A/P is only a thinness indicator, NEVER minimum satin-column width.
        thinness=2*area/perimeter if fill and perimeter else None
        if fill and (area<1 or min(width,height)<.8):warnings.append('small_fill_requires_size_or_stitch_type_review')
        if fill and thinness<1.5:warnings.append('narrow_fill_candidate_requires_explicit_satin_rails_or_running_centreline')
        if fill and node.get(ink+'row_spacing_mm') is None:warnings.append('fill_spacing_uses_engine_default_not_fabric_validated')
        if fill and node.get(ink+'fill_underlay') is None:warnings.append('underlay_uses_engine_default_not_fabric_validated')
        if previous:
            changes+=colour.lower()!=previous['colour'].lower()
            travel+=hypot(pts[0][0]-previous['end'][0],pts[0][1]-previous['end'][1])
        regions.append(dict(id=node.get('id'),kind='fill' if fill else 'running',colour=colour,
            width_mm=round(width,3),height_mm=round(height,3),area_mm2=round(area,3),
            thinness_indicator_mm=round(thinness,3) if thinness is not None else None,
            principal_axis_deg=round(axis,2) if axis is not None else None,
            requested_angle_deg=node.get(ink+'angle'),row_spacing_mm=node.get(ink+'row_spacing_mm'),
            underlay=node.get(ink+'fill_underlay'),warnings=warnings))
        previous=dict(colour=colour,end=pts[0] if fill else pts[-1])
    if not all_points:raise ValueError('Empty stitch plan')
    xs,ys=zip(*all_points)
    return dict(status='GEOMETRY_PLANNING_DIAGNOSTICS_NOT_STITCH_TESTED',regions=regions,
        source_bounds_mm=[round(max(xs)-min(xs),3),round(max(ys)-min(ys),3)],
        expected_colour_changes=changes,source_order_preserved=True,
        endpoint_travel_proxy_mm=round(travel,3),
        limitations=['Travel proxy is not Ink/Stitch routing or a trim count.',
            'Principal axis describes geometry, not an approved fill angle.',
            'No automatic satin conversion, fabric preset or pull compensation.',
            'Layer order is preserved; overlapping colours are never grouped blindly.'])
