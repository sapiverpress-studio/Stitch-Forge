"""Safe, deterministic SVG builder from explicitly approved stitch regions.

No imported SVG, scripts, embedded image, arbitrary XML or external references pass
through this builder. The result is only an Ink/Stitch *input*, not finished stitches.
"""
from dataclasses import dataclass
from math import isfinite
from xml.etree import ElementTree as ET
import re

MAX_REGIONS = 128
MAX_VERTICES = 2048
MAX_SIZE_MM = 400
_COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")


@dataclass(frozen=True)
class Region:
    points: tuple[tuple[float, float], ...]
    stitch_type: str  # running or fill; satin requires a separate rail model
    thread_color: str = '#153e46'


def build_svg(width_mm: float, height_mm: float, regions: tuple[Region, ...]) -> bytes:
    """Serialise bounded numeric geometry, not user-provided SVG markup."""
    if not all(isfinite(x) and 1 <= x <= MAX_SIZE_MM for x in (width_mm, height_mm)):
        raise ValueError('Invalid design dimensions')
    if not regions or len(regions) > MAX_REGIONS:
        raise ValueError('Invalid region count')
    root = ET.Element('svg', {
        'xmlns': 'http://www.w3.org/2000/svg',
        'width': f'{width_mm:.3f}mm', 'height': f'{height_mm:.3f}mm',
        'viewBox': f'0 0 {width_mm:.3f} {height_mm:.3f}',
    })
    for ix, region in enumerate(regions):
        if region.stitch_type not in {'running', 'fill'}:
            raise ValueError('Unsupported region type')
        if not isinstance(region.thread_color, str) or not _COLOR.fullmatch(region.thread_color):
            raise ValueError('Invalid thread colour')
        pts = region.points
        if not 2 <= len(pts) <= MAX_VERTICES or (region.stitch_type == 'fill' and len(pts) < 3):
            raise ValueError('Invalid region geometry')
        for pt in pts:
            if (len(pt) != 2 or not all(isinstance(n, (int, float)) and isfinite(n) for n in pt)
                    or not (0 <= pt[0] <= width_mm and 0 <= pt[1] <= height_mm)):
                raise ValueError('Vertex outside design bounds')
        coords = ' '.join(f'{x:.3f},{y:.3f}' for x, y in pts)
        if region.stitch_type == 'fill':
            ET.SubElement(root, 'polygon', {'id': f'region-{ix}', 'points': coords,
                                            'fill': region.thread_color, 'stroke': 'none'})
        else:
            ET.SubElement(root, 'polyline', {'id': f'region-{ix}', 'points': coords,
                                             'fill': 'none', 'stroke': region.thread_color,
                                             'stroke-width': '0.4'})
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def smoke_svg() -> bytes:
    """Synthetic petal with stem; not a customer or copyrighted artwork."""
    return build_svg(80, 80, (
        Region(((40, 12), (53, 17), (60, 31), (56, 48), (40, 66),
                (24, 48), (20, 31), (27, 17)), 'fill', '#27886a'),
        Region(((40, 65), (40, 76)), 'running', '#27886a'),
    ))
