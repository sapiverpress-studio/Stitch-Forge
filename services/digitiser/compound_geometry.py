"""Validate compound fill topology before any engine integration.

This module is deliberately NOT wired into Ink/Stitch. A geometrically valid
SVG hole is not evidence that the embroidery engine will leave a sewn hole.
Inputs and outputs are geometry-only and cannot contain SVG or external URLs.
"""
from math import isfinite

MAX_RING_VERTICES = 512
MAX_HOLES = 16
MAX_COMPOUND_VERTICES = 2048
_PRECISION = 3  # trusted_svg serialises geometry to 0.001 mm
_EPS = 1e-9


def _orientation(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a, b, p):
    return (abs(_orientation(a, b, p)) <= _EPS
            and min(a[0], b[0]) - _EPS <= p[0] <= max(a[0], b[0]) + _EPS
            and min(a[1], b[1]) - _EPS <= p[1] <= max(a[1], b[1]) + _EPS)


def _edges(ring):
    return zip(ring, ring[1:] + ring[:1])


def _intersect(a, b, c, d):
    ab_c, ab_d = _orientation(a, b, c), _orientation(a, b, d)
    cd_a, cd_b = _orientation(c, d, a), _orientation(c, d, b)
    if ((ab_c > _EPS and ab_d < -_EPS or ab_c < -_EPS and ab_d > _EPS)
            and (cd_a > _EPS and cd_b < -_EPS or cd_a < -_EPS and cd_b > _EPS)):
        return True
    return any((_on_segment(a, b, c), _on_segment(a, b, d),
                _on_segment(c, d, a), _on_segment(c, d, b)))


def _ring(points, width_mm, height_mm):
    if not isinstance(points, (tuple, list)) or not 3 <= len(points) <= MAX_RING_VERTICES + 1:
        raise ValueError('Invalid compound ring vertex count')
    ring = []
    for point in points:
        if not isinstance(point, (tuple, list)) or len(point) != 2:
            raise ValueError('Invalid compound ring coordinates')
        x, y = point
        if (any(isinstance(n, bool) or not isinstance(n, (float, int))
                or not isfinite(n) for n in (x, y))
                or not (0 <= x <= width_mm and 0 <= y <= height_mm)):
            raise ValueError('Compound ring vertex outside design bounds')
        ring.append((round(x, _PRECISION), round(y, _PRECISION)))
    if ring[0] == ring[-1]:
        ring.pop()
    if len(ring) < 3 or len(ring) > MAX_RING_VERTICES or len(set(ring)) != len(ring):
        raise ValueError('Degenerate compound ring')
    area2 = sum(a[0] * b[1] - a[1] * b[0] for a, b in _edges(ring))
    if abs(area2) < 0.02:
        raise ValueError('Degenerate compound ring area')
    for i, (a, b) in enumerate(_edges(ring)):
        if a == b:
            raise ValueError('Degenerate compound ring edge')
        for j in range(i + 1, len(ring)):
            if j == i + 1 or (i == 0 and j == len(ring) - 1):
                continue
            c, d = ring[j], ring[(j + 1) % len(ring)]
            if _intersect(a, b, c, d):
                raise ValueError('Compound ring intersects or touches itself')
    return tuple(ring)


def _strictly_inside(point, ring):
    x, y = point
    inside = False
    for a, b in _edges(ring):
        if _on_segment(a, b, point):
            return False
        if (a[1] > y) != (b[1] > y):
            crossed_x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])
            if crossed_x > x:
                inside = not inside
    return inside


def _rings_touch(a, b):
    return any(_intersect(u, v, x, y) for u, v in _edges(a)
               for x, y in _edges(b))


def validate_compound(outer, holes, width_mm, height_mm):
    """Return quantised, topologically valid (outer, holes) or fail closed.

    Hole outlines must be strictly inside outer, pairwise non-touching and
    non-nested. Islands require separate parent regions; no hole is filled.
    """
    if (any(isinstance(n, bool) or not isinstance(n, (int, float))
            or not isfinite(n) or not 1 <= n <= 400 for n in (width_mm, height_mm))):
        raise ValueError('Invalid compound design dimensions')
    if not isinstance(holes, (tuple, list)) or len(holes) > MAX_HOLES:
        raise ValueError('Invalid compound hole count')
    outside = _ring(outer, width_mm, height_mm)
    inside = tuple(_ring(hole, width_mm, height_mm) for hole in holes)
    if len(outside) + sum(len(hole) for hole in inside) > MAX_COMPOUND_VERTICES:
        raise ValueError('Compound exceeds vertex budget')
    for hole in inside:
        if _rings_touch(outside, hole) or not all(_strictly_inside(p, outside) for p in hole):
            raise ValueError('Compound hole is outside or touches outer ring')
    for i, a in enumerate(inside):
        for b in inside[i + 1:]:
            if (_rings_touch(a, b) or _strictly_inside(a[0], b)
                    or _strictly_inside(b[0], a)):
                raise ValueError('Compound holes touch, overlap or nest')
    return outside, inside


def evenodd_path(outer, holes, width_mm, height_mm):
    """Build a safe SVG path *preview* from validated rings, not sewn output."""
    outside, inside = validate_compound(outer, holes, width_mm, height_mm)
    def commands(ring):
        return 'M ' + ' L '.join(f'{x:.3f},{y:.3f}' for x, y in ring) + ' Z'
    return ' '.join(commands(ring) for ring in (outside, *inside))
