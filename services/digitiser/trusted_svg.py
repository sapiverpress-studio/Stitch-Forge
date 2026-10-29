"""Safe, deterministic SVG builder from explicitly approved stitch regions.

No imported SVG, scripts, embedded image, arbitrary XML or external references pass
through this builder. The result is only an Ink/Stitch *input*, not finished stitches.
"""
from dataclasses import dataclass
from math import isfinite, hypot
from xml.etree import ElementTree as ET
import re

MAX_REGIONS = 128
MAX_VERTICES = 2048
MAX_SIZE_MM = 400
_COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")
_INKSTITCH_NS = "http://inkstitch.org/namespace"
ET.register_namespace("inkstitch", _INKSTITCH_NS)


def _bounded(value, label, minimum, maximum):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not isfinite(value) or not minimum <= value <= maximum):
        raise ValueError(f"Invalid {label}: expected {minimum} to {maximum}")
    return value


@dataclass(frozen=True)
class Region:
    points: tuple[tuple[float, float], ...]
    stitch_type: str  # running or fill; satin requires a separate rail model
    thread_color: str = '#153e46'
    fill_angle_deg: float | None = None
    row_spacing_mm: float | None = None
    fill_underlay: bool | None = None
    running_length_mm: float | None = None


def validate_fill(points):
    """Reject zero-area, repeated, touching and crossing rings before the engine."""
    pts=list(points)
    if pts[0]==pts[-1]:pts.pop()
    if len(pts)<3 or len(set(pts))!=len(pts):raise ValueError('Degenerate fill boundary')
    area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(pts,pts[1:]+pts[:1])))/2
    if area<0.01:raise ValueError('Degenerate fill area')
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def on(a,b,p):return abs(cross(a,b,p))<1e-9 and min(a[0],b[0])<=p[0]<=max(a[0],b[0]) and min(a[1],b[1])<=p[1]<=max(a[1],b[1])
    for i,a in enumerate(pts):
        b=pts[(i+1)%len(pts)]
        if hypot(b[0]-a[0],b[1]-a[1])<.001:raise ValueError('Degenerate fill edge')
        for j in range(i+2,len(pts)):
            if i==0 and j==len(pts)-1:continue
            c,d=pts[j],pts[(j+1)%len(pts)]
            if (cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0) or any((on(a,b,c),on(a,b,d),on(c,d,a),on(c,d,b))):
                raise ValueError('Fill boundary crosses or touches itself')


def build_svg(width_mm: float, height_mm: float, regions: tuple[Region, ...]) -> bytes:
    """Serialise bounded numeric geometry, not user-provided SVG markup."""
    _bounded(width_mm, 'design width', 1, MAX_SIZE_MM)
    _bounded(height_mm, 'design height', 1, MAX_SIZE_MM)
    if not regions or len(regions) > MAX_REGIONS:
        raise ValueError('Invalid region count')
    root = ET.Element('svg', {
        'xmlns': 'http://www.w3.org/2000/svg',
        'width': f'{width_mm:.3f}mm', 'height': f'{height_mm:.3f}mm',
        'viewBox': f'0 0 {width_mm:.3f} {height_mm:.3f}',
    })
    # Ink/Stitch v3.3.0 (lib/update.py) requires SVG schema version 4.
    # Its updater opens a blocking GUI confirmation when namespaced stitch
    # attributes appear on an unversioned SVG. These documents are freshly
    # generated with current attributes, not historical files to migrate.
    # This is explicit metadata, NOT a command to skip stitch validation.
    meta = ET.SubElement(root, 'metadata')
    ET.SubElement(meta, f'{{{_INKSTITCH_NS}}}inkstitch_svg_version').text = '4'
    for ix, region in enumerate(regions):
        if region.stitch_type not in {'running', 'fill'}:
            raise ValueError('Unsupported region type')
        if not isinstance(region.thread_color, str) or not _COLOR.fullmatch(region.thread_color):
            raise ValueError('Invalid thread colour')
        pts = region.points
        if not 2 <= len(pts) <= MAX_VERTICES or (region.stitch_type == 'fill' and len(pts) < 3):
            raise ValueError('Invalid region geometry')
        for pt in pts:
            if (len(pt) != 2 or not all(not isinstance(n, bool) and isinstance(n, (int, float)) and isfinite(n) for n in pt)
                    or not (0 <= pt[0] <= width_mm and 0 <= pt[1] <= height_mm)):
                raise ValueError('Vertex outside design bounds')
        coords = ' '.join(f'{x:.3f},{y:.3f}' for x, y in pts)
        if region.stitch_type == 'fill':
            validate_fill(pts)
            if region.running_length_mm is not None:
                raise ValueError('Running length not applicable to fill')
            attrs = {'id': f'region-{ix}', 'points': coords,
                     'fill': region.thread_color, 'stroke': 'none'}
            if region.fill_angle_deg is not None:
                attrs[f'{{{_INKSTITCH_NS}}}angle'] = f'{_bounded(region.fill_angle_deg, "fill angle", -180, 180):.2f}'
            if region.row_spacing_mm is not None:
                attrs[f'{{{_INKSTITCH_NS}}}row_spacing_mm'] = f'{_bounded(region.row_spacing_mm, "row spacing", 0.25, 2.0):.3f}'
            if region.fill_underlay is not None:
                if not isinstance(region.fill_underlay, bool):
                    raise ValueError('Underlay must be boolean')
                attrs[f'{{{_INKSTITCH_NS}}}fill_underlay'] = 'true' if region.fill_underlay else 'false'
            ET.SubElement(root, 'polygon', attrs)
        else:
            if any(v is not None for v in (region.fill_angle_deg, region.row_spacing_mm, region.fill_underlay)):
                raise ValueError('Fill parameters not applicable to running stitch')
            attrs = {'id': f'region-{ix}', 'points': coords,
                     'fill': 'none', 'stroke': region.thread_color, 'stroke-width': '0.4'}
            if region.running_length_mm is not None:
                attrs[f'{{{_INKSTITCH_NS}}}running_stitch_length_mm'] = f'{_bounded(region.running_length_mm, "running stitch length", 0.8, 4.0):.3f}'
            ET.SubElement(root, 'polyline', attrs)
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def smoke_svg() -> bytes:
    """Synthetic petal with stem; not a customer or copyrighted artwork."""
    return build_svg(80, 80, (
        Region(((40, 12), (53, 17), (60, 31), (56, 48), (40, 66),
                (24, 48), (20, 31), (27, 17)), 'fill', '#D05957',
               fill_angle_deg=30, row_spacing_mm=0.5, fill_underlay=True),
        Region(((40, 65), (40, 76)), 'running', '#27886a', running_length_mm=2.0),
    ))
