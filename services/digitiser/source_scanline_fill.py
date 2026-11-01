"""Bounded, source-contained scanline filling for failed native tatami objects.

Independent implementation of a general scanline/section-routing technique.
Inspired by the documented approach of the Apache-2.0 StitchFoundry engine;
NO third-party source code has been copied or incorporated.

All tracks lie inside the original Shapely polygon, including holes. A jump is
preferred to a sewn shortcut across a hole. This generates geometry to pass
through the existing Ink/Stitch/pyembroidery independent audit; it does NOT
prove physical sewout quality, underlay or thread behaviour.
"""
from math import cos, sin, radians, isfinite
from shapely.affinity import rotate
from shapely.geometry import LineString
from shapely.ops import unary_union
from geometry_intelligence import shape_axis, order_open_routes


def _lines(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == 'LineString':
        return [geom]
    if hasattr(geom, 'geoms'):
        return [line for child in geom.geoms for line in _lines(child)]
    return []


def _rot(point, degrees, origin):
    a = radians(degrees)
    x, y = point
    ox, oy = origin
    return (ox + (x - ox) * cos(a) - (y - oy) * sin(a),
            oy + (x - ox) * sin(a) + (y - oy) * cos(a))


def plan_scanline_fill(poly, scale, *, row_spacing_mm=.45, inset_mm=.09,
                       angles=(0, 30, 60, 90, 120, 150), max_routes=120, adaptive=False):
    """Choose a contained back-and-forth row plan (not an embroidery approval).

    Returns paths in artwork-pixel coordinates. Each separate path is a
    separate running-stitch element: the native engine owns jumps and trims.
    Route joining is permitted ONLY when the straight connecting segment lies
    entirely inside the inset original polygon. Holes remain unstitched.
    """
    if (poly.geom_type != 'Polygon' or not poly.is_valid or poly.is_empty or
            not isfinite(scale) or not .02 <= scale <= 3 or
            not .35 <= row_spacing_mm <= .65 or
            not .04 <= inset_mm <= .15 or
            not isinstance(max_routes, int) or not 1 <= max_routes <= 120):
        raise ValueError('Invalid bounded scanline fill configuration/shape')
    if poly.area * scale * scale < .8:
        raise ValueError('Scanline fill needs at least 0.8 mm² of source area')
    active = poly.buffer(-inset_mm / scale)
    if active.is_empty:
        raise ValueError('Insetting removed too-narrow fill geometry')
    if not isinstance(adaptive, bool):
        raise ValueError('Hybrid planner flag must be boolean')
    if not angles:
        raise ValueError('At least one baseline fill angle is required')
    origin = (poly.centroid.x, poly.centroid.y)
    axis = shape_axis(poly, scale) if adaptive else None
    all_angles = list(angles)
    if axis is not None:
        proposed = axis['crossFillAngleDeg']
        if all(min(abs(proposed-a),180-abs(proposed-a))>7 for a in all_angles):
            all_angles.append(proposed)
    candidates = []
    for deg in all_angles:
        if not isinstance(deg, (int, float)) or not isfinite(deg) or not 0 <= deg < 180:
            raise ValueError('Invalid scanline direction')
        rotated = rotate(active, -deg, origin=origin)
        x0, y0, x1, y1 = rotated.bounds
        step = row_spacing_mm / scale
        rows = []
        y = y0 + step / 2
        for _ in range(600):
            if y > y1:
                break
            section = rotated.intersection(LineString([(x0 - step, y),
                                                        (x1 + step, y)]))
            segments = sorted(
                (_rot((line.coords[0][0], y), deg, origin),
                 _rot((line.coords[-1][0], y), deg, origin))
                for line in _lines(section) if line.length * scale >= .22)
            rows.append(segments)
            y += step
        else:
            raise ValueError('Scanline row budget exceeded')
        paths = []
        for index, row in enumerate(rows):
            for start, end in ([(b, a) for a, b in reversed(row)] if index % 2 else row):
                if (paths and len(paths[-1]) < 300 and
                        active.buffer(1e-8).covers(LineString([paths[-1][-1], start]))):
                    paths[-1].extend((start, end))
                else:
                    paths.append([start, end])
        if not paths or len(paths) > max_routes:
            continue
        if any(not active.buffer(1e-7).covers(LineString(path)) for path in paths):
            raise ValueError('Scanline routing crosses a source hole or edge')
        covered = unary_union([
            LineString(path).buffer(.24 / scale, cap_style=2) for path in paths
        ])
        fraction = covered.intersection(poly).area / poly.area
        if fraction < .70:
            continue
        length = sum(LineString(path).length * scale for path in paths)
        candidates.append((len(paths), -fraction, length, deg, paths, fraction))
    if not candidates:
        raise ValueError('No source-contained scanline candidate met coverage/path bounds')
    baseline = min((c for c in candidates if c[3] in angles),key=lambda c:c[:4])
    selected = baseline
    if adaptive:
        # Do not trade away source-region coverage or raise trim path count
        # merely to achieve a new geometric angle.
        permitted = [c for c in candidates
                     if c[0] <= baseline[0] and c[5] >= baseline[5]-.02]
        selected = min(permitted,key=lambda c:(c[0],-c[5],c[2],c[3]))
    _, _, length, angle, paths, fraction = selected
    stats = {}
    if adaptive:
        paths,stats = order_open_routes(paths,scale)
    result = {
        'angleDeg': angle, 'routes': paths,
        'interiorProxyFraction': round(fraction, 5),
        'routeCount': len(paths), 'trackLengthMm': round(length, 4),
        'underlayVerified': False, 'physicalQualityVerified': False,
        'sourceGeometryChanged': False,
    }
    if adaptive:
        result.update(stats)
        result.update({
            'geometryAxis':axis,'hybridPlanning':True,
            'derivedAngleUsed':bool(axis is not None and angle not in angles),
            'noWorseGeometricCoverage':fraction >= baseline[5]-.02,
            'semanticDirectionVerified':False,
        })
    return result
