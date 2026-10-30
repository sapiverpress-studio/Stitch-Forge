"""Convert actual Stitch Forge 0.3 project JSON to bounded Ink/Stitch SVG geometry.

The browser's ZIP design_project.json and local saved-project structure differ.
Both are accepted, but artwork references are NEVER passed to the engine.
Generated SVG is an *input*, not a stitch-tested or approved embroidery file.
"""
import json
import re
from math import hypot, isfinite
from pathlib import Path
from trusted_svg import Region, build_svg
from satin_native import SatinColumn, build_satin_svg, column_from_validated_pixel_rungs
from xml.etree import ElementTree as ET

MAX_PROJECT_BYTES = 2_000_000
MAX_PATHS = 128
MAX_POINTS = 2048
MAX_TOTAL_POINTS = 5_000
MARGIN_MM = 2.0


def _number(value, label):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError(f'Invalid {label}')
    try:
        number = float(value)
    except (ValueError, TypeError) as exc:
        raise ValueError(f'Invalid {label}') from exc
    if not isfinite(number):
        raise ValueError(f'Invalid {label}')
    return number


def _settings(obj, geometry_width, geometry_height):
    settings = obj.get('settings') or obj
    if not isinstance(settings, dict):
        raise ValueError('Invalid project settings')
    # A ZIP report has measured design_width_mm too, but settings.width is
    # the user's requested width. Do not confuse exported extents with intent.
    requested = settings.get('width', obj.get('width'))
    legacy_width = obj.get('design_width_mm')
    if requested is None and legacy_width is not None:
        requested = legacy_width
    if requested is None:
        raise ValueError('Missing requested width (settings.width or width)')
    w = _number(requested, 'design width')
    if not (10 <= w <= 250):
        raise ValueError('Design width must be 10–250 mm')
    h = w * geometry_height / geometry_width
    # The editor stores square hoop size; do not infer machine profiles.
    hoop = _number(settings.get('hoop', obj.get('hoop', 300)), 'hoop size')
    if not (40 <= hoop <= 300):
        raise ValueError('Hoop size must be 40–300 mm')
    if max(w, h) > hoop - 2 * MARGIN_MM:
        raise ValueError('Artwork exceeds 2 mm-per-side hoop margin')
    return w, h, hoop


def convert_project(data: bytes) -> bytes:
    """Convert the legacy project schema. Satin input is intentionally excluded."""
    return _convert_project(data, local_satin=False)


def convert_local_satin_project(data: bytes) -> bytes:
    """Local-only acceptance schema; never called by the hosted worker."""
    return _convert_project(data, local_satin=True)


def _convert_project(data: bytes, *, local_satin: bool) -> bytes:
    if not isinstance(data, bytes) or not 5 <= len(data) <= MAX_PROJECT_BYTES:
        raise ValueError('Invalid or oversized project JSON')
    try:
        obj = json.loads(data, parse_constant=lambda c: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))
    except (ValueError, UnicodeError) as exc:
        raise ValueError('Invalid project JSON') from exc
    if not isinstance(obj, dict):
        raise ValueError('Project must be an object')
    if 'schema' in obj:
        raise ValueError('Named source-inspection/control schemas are not legacy machine projects')
    satin_inputs = obj.get('satinColumns', []) if local_satin else []
    if not local_satin and ('satinColumns' in obj or 'regionOrder' in obj or 'schemaVersion' in obj):
        raise ValueError('Local satin schema is not accepted by this conversion path')
    if local_satin and (isinstance(obj.get('schemaVersion'), bool) or obj.get('schemaVersion') != 1 or
                        not isinstance(satin_inputs, list) or len(satin_inputs) > MAX_PATHS):
        raise ValueError('Invalid local satin project schema')
    paths = obj.get('paths')
    if not isinstance(paths, list) or not 1 <= len(paths) <= MAX_PATHS:
        raise ValueError('Project has no supported regions')
    if len(paths) + len(satin_inputs) > MAX_PATHS:
        raise ValueError('Project exceeds 128 total regions')
    styles = obj.get('pathStyles')
    if styles is None:
        styles = [obj.get('stitchMode', 'running')] * len(paths)
    if not isinstance(styles, list) or len(styles) != len(paths):
        raise ValueError('Region mode count mismatch')
    colours = obj.get('pathColors')
    if colours is None:
        colours = [obj.get('threadColor', '#153e46')] * len(paths)
    if not isinstance(colours, list) or len(colours) != len(paths):
        raise ValueError('Region colour count mismatch')
    properties = obj.get('pathSettings')
    if properties is None:
        properties = [{} for _ in paths]
    if not isinstance(properties, list) or len(properties) != len(paths):
        raise ValueError('Region parameter count mismatch')
    allowed = {'fillAngleDeg', 'rowSpacingMm', 'fillUnderlay', 'runningLengthMm'}
    for colour, props in zip(colours, properties):
        if not isinstance(colour, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', colour):
            raise ValueError('Invalid thread colour')
        if not isinstance(props, dict) or not set(props).issubset(allowed):
            raise ValueError('Unsupported region parameters')
    all_points = []
    for path in paths:
        if not isinstance(path, list) or not 2 <= len(path) <= MAX_POINTS:
            raise ValueError('Invalid region point count')
        for xy in path:
            if (not isinstance(xy, list) or len(xy) != 2 or
                any(isinstance(n, bool) or not isinstance(n, (int, float)) or
                    not isfinite(n) or not 0 <= n <= 600 for n in xy)):
                raise ValueError('Invalid canvas coordinates')
            all_points.append(xy)
    if satin_inputs:
        if any(not isinstance(item, dict) or set(item) - {
                'geometry', 'threadColor', 'zigzagSpacingMm', 'maxStitchLengthMm'}
               for item in satin_inputs):
            raise ValueError('Unsupported local satin parameters')
        for item in satin_inputs:
            geometry = item.get('geometry')
            rungs = geometry.get('rungs') if isinstance(geometry, dict) else None
            if not isinstance(rungs, list):
                raise ValueError('Invalid local satin geometry')
            for rung in rungs:
                if not isinstance(rung, dict):
                    raise ValueError('Invalid local satin rung')
                for side in ('left', 'right'):
                    xy = rung.get(side)
                    if (not isinstance(xy, list) or len(xy) != 2 or
                        any(isinstance(n, bool) or not isinstance(n, (int, float)) or
                            not isfinite(n) or not 0 <= n <= 600 for n in xy)):
                        raise ValueError('Invalid local satin coordinate')
                    all_points.append(xy)
    if len(all_points) > MAX_TOTAL_POINTS:
        raise ValueError('Project exceeds 5,000 control points')
    min_x, max_x = min(p[0] for p in all_points), max(p[0] for p in all_points)
    min_y, max_y = min(p[1] for p in all_points), max(p[1] for p in all_points)
    dw, dh = max_x - min_x, max_y - min_y
    if dw <= 0.1 or dh <= 0.1:
        raise ValueError('Degenerate design dimensions')
    w, h, hoop = _settings(obj, dw, dh)
    regions = []
    for path, mode, colour, props in zip(paths, styles, colours, properties):
        if mode == 'bean':
            raise ValueError('Bean mode unsupported by Ink/Stitch bridge: requires explicit repeats')
        if mode not in ('running', 'tatami'):
            raise ValueError('Unsupported region mode')
        if mode == 'tatami' and (len(path) < 4 or
                hypot(path[0][0] - path[-1][0], path[0][1] - path[-1][1]) > 0.01):
            raise ValueError('Fill region must be explicitly closed')
        # One common scale for both axes; no non-uniform stretching.
        scale = w / dw
        mm_points = tuple((round(MARGIN_MM + (x - min_x) * scale, 3),
                           round(MARGIN_MM + (y - min_y) * scale, 3)) for x, y in path)
        regions.append(Region(mm_points, 'fill' if mode == 'tatami' else 'running',
                              thread_color=colour,
                              fill_angle_deg=props.get('fillAngleDeg'),
                              row_spacing_mm=props.get('rowSpacingMm'),
                              fill_underlay=props.get('fillUnderlay'),
                              running_length_mm=props.get('runningLengthMm')))
    svg = build_svg(w + 2 * MARGIN_MM, h + 2 * MARGIN_MM, tuple(regions))
    if not satin_inputs:
        return svg

    order = obj.get('regionOrder')
    valid_refs = {('path', i) for i in range(len(paths))} | {
        ('satin', i) for i in range(len(satin_inputs))}
    if not isinstance(order, list) or len(order) != len(paths) + len(satin_inputs):
        raise ValueError('Local satin project requires complete regionOrder')
    normalized_order = []
    for entry in order:
        if (not isinstance(entry, dict) or set(entry) != {'type', 'index'} or
                entry['type'] not in ('path', 'satin') or isinstance(entry['index'], bool) or
                not isinstance(entry['index'], int)):
            raise ValueError('Invalid local regionOrder entry')
        ref = (entry['type'], entry['index'])
        if ref not in valid_refs or ref in normalized_order:
            raise ValueError('Duplicate or out-of-range local regionOrder entry')
        normalized_order.append(ref)
    columns = []
    for item in satin_inputs:
        columns.append(column_from_validated_pixel_rungs(
            item['geometry'], scale, origin_mm=(MARGIN_MM - min_x * scale,
                                                MARGIN_MM - min_y * scale),
            thread_color=item.get('threadColor', '#153e46'),
            zigzag_spacing_mm=item.get('zigzagSpacingMm', 0.4),
            max_stitch_length_mm=item.get('maxStitchLengthMm')))
    satin_svg = ET.fromstring(build_satin_svg(w + 2 * MARGIN_MM, h + 2 * MARGIN_MM,
                                               tuple(columns)))
    root = ET.fromstring(svg)
    path_nodes = {i: root.find(f".//*[@id='region-{i}']") for i in range(len(paths))}
    satin_nodes = {i: satin_svg.find(f".//*[@id='satin-{i}']") for i in range(len(columns))}
    if any(node is None for node in (*path_nodes.values(), *satin_nodes.values())):
        raise ValueError('Generated local region geometry is incomplete')
    for node in (*path_nodes.values(),):
        root.remove(node)
    for node in (*satin_nodes.values(),):
        root.append(node)
    ordered = []
    for kind, index in normalized_order:
        ordered.append(path_nodes[index] if kind == 'path' else satin_nodes[index])
    for node in (*satin_nodes.values(),):
        root.remove(node)
    root.extend(ordered)
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    payload = convert_project(args.input.read_bytes())
    with args.output.open('xb') as out:
        out.write(payload)
    print('Trusted geometry exported. Ink/Stitch execution and machine testing NOT implied.')


if __name__ == '__main__':
    main()
