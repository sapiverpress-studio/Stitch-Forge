"""Opt-in bridge from Stitch Forge browser JSON to reviewed, bounded SVG regions.

Only explicit path geometry and stitch types are consumed. Embedded raster reference
artwork is never passed to Ink/Stitch, and photograph detail is not digitised.
"""
import json
from math import hypot, isfinite
from pathlib import Path
from trusted_svg import Region, build_svg

MAX_PROJECT_BYTES = 2_000_000
MAX_PATHS = 128
MAX_POINTS = 2048


def convert_project(data: bytes) -> bytes:
    if not isinstance(data, bytes) or not 5 <= len(data) <= MAX_PROJECT_BYTES:
        raise ValueError('Invalid or oversized project JSON')
    try:
        obj = json.loads(data, parse_constant=lambda c: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))
    except (ValueError, UnicodeError) as exc:
        raise ValueError('Invalid project JSON') from exc
    if not isinstance(obj, dict):
        raise ValueError('Project must be an object')
    paths = obj.get('paths')
    if not isinstance(paths, list) or not 1 <= len(paths) <= MAX_PATHS:
        raise ValueError('Project has no supported regions')
    styles = obj.get('pathStyles') or ['running'] * len(paths)
    if not isinstance(styles, list) or len(styles) != len(paths):
        raise ValueError('Region mode count mismatch')
    w, h = obj.get('design_width_mm'), obj.get('design_height_mm')
    if not all(isinstance(v, (int, float)) and isfinite(v) and 1 <= v <= 400 for v in (w, h)):
        raise ValueError('Physical width and height are required')
    points = []
    for path in paths:
        if not isinstance(path, list) or not 2 <= len(path) <= MAX_POINTS:
            raise ValueError('Invalid region point count')
        for xy in path:
            if (not isinstance(xy, list) or len(xy) != 2
                    or not all(isinstance(n, (int, float)) and isfinite(n) and 0 <= n <= 600 for n in xy)):
                raise ValueError('Invalid canvas coordinates')
            points.append(xy)
    min_x, max_x = min(p[0] for p in points), max(p[0] for p in points)
    min_y, max_y = min(p[1] for p in points), max(p[1] for p in points)
    if max_x - min_x <= 0.001 or max_y - min_y <= 0.001:
        raise ValueError('Degenerate physical dimensions')
    regions = []
    for path, mode in zip(paths, styles):
        if mode == 'bean':
            raise ValueError('Bean stitch requires explicit repeats; not supported by bridge yet')
        if mode not in {'running', 'tatami'}:
            raise ValueError('Unsupported stitch mode')
        if mode == 'tatami' and (len(path) < 3 or hypot(path[0][0] - path[-1][0], path[0][1] - path[-1][1]) > 1):
            raise ValueError('Fill region must be explicitly closed')
        mm_points = tuple((round((x - min_x) * w / (max_x - min_x), 3),
                           round((y - min_y) * h / (max_y - min_y), 3)) for x, y in path)
        regions.append(Region(mm_points, 'fill' if mode == 'tatami' else 'running'))
    return build_svg(w, h, tuple(regions))


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    svg = convert_project(args.input.read_bytes())
    with args.output.open('xb') as file:
        file.write(svg)
    print('Trusted SVG created from explicit paths. NOT stitch-tested.')


if __name__ == '__main__':
    main()
