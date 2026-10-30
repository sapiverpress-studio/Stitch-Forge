"""Local-only compound fill acceptance input; NOT a hosted conversion path.

Ink/Stitch 3.3.0 treats the largest subpath as outer and all others as holes.
Each disconnected component therefore needs its own path, never one giant
multi-subpath colour object. Existing source drafts remain machine-ineligible.
"""
from math import isfinite
import re
from xml.etree import ElementTree as ET
from compound_geometry import validate_compound, evenodd_path

SCHEMA = 'stitch-forge-local-compound-control-v1'
INK = '{http://inkstitch.org/namespace}'
ET.register_namespace('inkstitch', INK[1:-1])


def number(value, low, high, label):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not isfinite(value) or not low <= value <= high):
        raise ValueError('Invalid ' + label)
    return value


def prepare_compound_control(project):
    """Validate explicit local geometry/settings, retaining a common pixel scale.

    Bounds are engineering test limits, not fabric recommendations. No SVG,
    raster, credentials, boolean approval claim or unrecognised parameter passes.
    """
    if not isinstance(project, dict) or set(project) != {
            'schema', 'source', 'imageWidthMm', 'regions', 'regionOrder', 'settings'} or project['schema'] != SCHEMA:
        raise ValueError('Expected explicit local compound control schema')
    source = project['source']
    if (not isinstance(source, dict) or set(source) != {'width', 'height', 'sha256'}
            or not isinstance(source.get('sha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', source['sha256'])):
        raise ValueError('Invalid source identity')
    width, height = source.get('width'), source.get('height')
    if (any(isinstance(n, bool) or not isinstance(n, int) or n < 48 for n in (width, height))
            or width * height > 750000):
        raise ValueError('Invalid source dimensions')
    physical_width = number(project['imageWidthMm'], 10, 250, 'full image width')
    scale = physical_width / width
    physical_height = height * scale
    if physical_height > 296:
        raise ValueError('Compound control exceeds physical height')
    settings = project['settings']
    if not isinstance(settings, dict) or set(settings) != {'angleDeg', 'rowSpacingMm', 'maxStitchMm', 'underlay'}:
        raise ValueError('Explicit fill settings required')
    angle = number(settings['angleDeg'], -180, 180, 'fill angle')
    spacing = number(settings['rowSpacingMm'], 0.35, 1.5, 'row spacing (density bound)')
    max_stitch = number(settings['maxStitchMm'], 1, 4, 'maximum stitch length')
    underlay = settings['underlay']
    if not isinstance(underlay, bool):
        raise ValueError('Explicit boolean underlay selection required')
    items, order = project['regions'], project['regionOrder']
    if not isinstance(items, list) or not 1 <= len(items) <= 128:
        raise ValueError('Invalid compound region count')
    regions, ids, total_vertices = [], set(), 0
    for item in items:
        if not isinstance(item, dict) or set(item) != {'id', 'color', 'outer', 'holes'}:
            raise ValueError('Invalid compound region fields')
        identity, color = item['id'], item['color']
        if not isinstance(identity, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', identity) or identity in ids:
            raise ValueError('Invalid or duplicate region identity')
        if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
            raise ValueError('Invalid source colour')
        ids.add(identity)
        def millimetres(points):
            if not isinstance(points, list) or not 3 <= len(points) <= 513:
                raise ValueError('Invalid source ring')
            result = []
            for xy in points:
                if not isinstance(xy, list) or len(xy) != 2:
                    raise ValueError('Invalid source vertex')
                x, y = number(xy[0], 0, width, 'pixel x'), number(xy[1], 0, height, 'pixel y')
                result.append((2 + x * scale, 2 + y * scale))
            return result
        if not isinstance(item['holes'], list) or len(item['holes']) > 16:
            raise ValueError('Invalid source hole count')
        outer, holes = validate_compound(millimetres(item['outer']),
                                         [millimetres(h) for h in item['holes']],
                                         physical_width + 4, physical_height + 4)
        total_vertices += len(outer) + sum(map(len, holes))
        if total_vertices > 5000:
            raise ValueError('Compound control exceeds total vertex budget')
        def area(ring):
            return abs(sum(a[0]*b[1]-a[1]*b[0] for a, b in zip(ring, ring[1:]+ring[:1]))) / 2
        filled_area = area(outer) - sum(map(area, holes))
        xs, ys = zip(*outer)
        if filled_area < 1 or min(max(xs)-min(xs), max(ys)-min(ys)) < 0.8:
            raise ValueError('Narrow/small source fill requires a different stitch plan')
        for hole in holes:
            hx, hy = zip(*hole)
            if min(max(hx)-min(hx), max(hy)-min(hy)) <= 0.44:
                raise ValueError('Hole is smaller than independent-audit resolution')
        regions.append({'id': identity, 'color': color.upper(), 'outer': outer, 'holes': holes,
                        'areaMm2': filled_area})
    if (not isinstance(order, list) or len(order) != len(ids) or
            any(not isinstance(i, str) for i in order) or len(set(order)) != len(order) or set(order) != ids):
        raise ValueError('Complete unique regionOrder required')
    indexed = {r['id']: r for r in regions}
    regions = [indexed[i] for i in order]
    # Conservative coarse planning proxy; actual decoding is a separate gate.
    estimate = sum(r['areaMm2'] for r in regions) / (spacing * max_stitch) * (2 if underlay else 1)
    if estimate > 100000:
        raise ValueError('Compound control exceeds stitch-density planning budget')
    return {'source': dict(source), 'widthMm': physical_width+4, 'heightMm': physical_height+4,
            'scaleMmPerPixel': scale, 'regions': regions,
            'originMm': (physical_width/2+2, physical_height/2+2),
            'settings': {'angleDeg': angle, 'rowSpacingMm': spacing, 'maxStitchMm': max_stitch, 'underlay': underlay}}


def build_compound_control_svg(project):
    """Create trusted native SVG only for the explicit local acceptance contract."""
    checked = prepare_compound_control(project)
    root = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg',
        'width': f"{checked['widthMm']:.3f}mm", 'height': f"{checked['heightMm']:.3f}mm",
        'viewBox': f"0 0 {checked['widthMm']:.3f} {checked['heightMm']:.3f}"})
    meta = ET.SubElement(root, 'metadata')
    ET.SubElement(meta, INK+'inkstitch_svg_version').text = '4'
    # commands.py StandaloneCommand.point + output.py get_origin: an explicit
    # global origin fixes DST coordinates to the full source frame. It is a
    # command marker, not a stitch path; no arbitrary SVG is accepted here.
    defs = ET.SubElement(root, 'defs')
    ET.SubElement(defs, 'symbol', {'id': 'inkstitch_origin'})
    ET.SubElement(root, 'use', {'id': 'source-frame-origin',
        '{http://www.w3.org/1999/xlink}href': '#inkstitch_origin',
        'x': f"{checked['originMm'][0]:.3f}", 'y': f"{checked['originMm'][1]:.3f}"})
    settings = checked['settings']
    for region in checked['regions']:
        attrs = {'id': region['id'], 'fill': region['color'], 'stroke': 'none', 'fill-rule': 'evenodd',
            'd': evenodd_path(region['outer'], region['holes'], checked['widthMm'], checked['heightMm']),
            INK+'fill_method': 'tatami_fill', INK+'angle': f"{settings['angleDeg']:.3f}",
            INK+'row_spacing_mm': f"{settings['rowSpacingMm']:.3f}",
            INK+'max_stitch_length_mm': f"{settings['maxStitchMm']:.3f}",
            INK+'fill_underlay': str(settings['underlay']).lower(),
            INK+'underpath': 'true', INK+'running_stitch_length_mm': '2.0',
            INK+'pull_compensation_mm': '0', INK+'pull_compensation_percent': '0', INK+'expand_mm': '0',
            INK+'random_seed': 'stitch-forge-compound-control'}
        if settings['underlay']:
            attrs.update({INK+'fill_underlay_angle': f"{settings['angleDeg']+90:.3f}",
                INK+'fill_underlay_row_spacing_mm': f"{settings['rowSpacingMm']*3:.3f}",
                INK+'fill_underlay_max_stitch_length_mm': f"{min(3,settings['maxStitchMm']):.3f}",
                INK+'fill_underlay_inset_mm': '0.3', INK+'underlay_underpath': 'true'})
        ET.SubElement(root, 'path', attrs)
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)
