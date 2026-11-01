"""Bounded computational geometry for source-defined embroidery regions.

Independent implementation using general medial-axis sampling and pen-up
plotter routing principles. No other software project's source was copied.
Geometry metrics are NOT evidence of artwork semantics, sewouts or machine
approval. The native Ink/Stitch/pyembroidery audit remains authoritative.
"""
from math import atan2, degrees, hypot, isfinite

import numpy as np
from shapely import contains_xy
from skimage.morphology import medial_axis


def shape_axis(poly, scale, *, max_side=160):
    """Estimate geometric centreline axis and physical width of a source polygon.

    Raster sampling bounded by max_side independently of artwork size. A low
    anisotropy suppresses invented directions on round/branched regions.
    Returns only geometric evidence; never asserts feather/petal semantics.
    """
    if (poly.geom_type != 'Polygon' or not poly.is_valid or poly.is_empty or
            not isinstance(scale, (int, float)) or isinstance(scale, bool) or
            not isfinite(scale) or not .02 <= scale <= 3 or
            not isinstance(max_side, int) or not 48 <= max_side <= 256):
        raise ValueError('Invalid geometry-axis source or limits')
    x0, y0, x1, y1 = poly.bounds
    width, height = x1-x0, y1-y0
    if max(width, height)*scale < 1.8:
        return None
    step = max(.18/scale, max(width, height)/max_side)
    nx = int(np.ceil(width/step))
    ny = int(np.ceil(height/step))
    if nx < 3 or ny < 3:
        return None
    xs = x0 + (np.arange(nx)+.5)*step
    ys = y0 + (np.arange(ny)+.5)*step
    gx, gy = np.meshgrid(xs, ys)
    mask = contains_xy(poly, gx, gy)
    if mask.sum() < 18:
        return None
    skeleton, distance = medial_axis(mask, return_distance=True)
    yy, xx = np.nonzero(skeleton & (distance > 1))
    if len(xx) < 5:
        return None
    points = np.column_stack((xx.astype(float), yy.astype(float)))
    weights = distance[yy, xx].astype(float)**2
    weights /= weights.sum()
    centre = np.sum(points*weights[:, None], axis=0)
    delta = points-centre
    cov = (delta*weights[:, None]).T @ delta
    eigenvalues, vectors = np.linalg.eigh(cov)
    if eigenvalues[-1] < 1 or eigenvalues[-1]/max(eigenvalues[0], 1e-6) < 1.7:
        return None
    vector = vectors[:, -1]
    long_axis = degrees(atan2(vector[1], vector[0]))%180
    confidence = (eigenvalues[-1]-eigenvalues[0])/eigenvalues[-1]
    return {
        'majorAxisDeg':round(long_axis, 3),
        'crossFillAngleDeg':round((long_axis+90)%180, 3),
        'axisConfidenceProxy':round(float(confidence), 4),
        'medianHalfWidthMm':round(float(np.median(distance[yy, xx])*step*scale), 4),
        'skeletonSamplePoints':len(xx),
        'semanticDirectionVerified':False,
    }


def jump_distance_mm(routes, scale):
    """Pen-up geometry proxy between open routes; not decoded jumps or trims."""
    if not routes:
        return 0.
    return sum(hypot(first[-1][0]-second[0][0], first[-1][1]-second[0][1])*scale
               for first, second in zip(routes, routes[1:]))


def order_open_routes(routes, scale):
    """Conservative nearest-endpoint ordering of separate, reversible routes.

    Never adds sewn connectors. Never moves, deletes or changes any stitch
    track's vertices. Falls back to input order if greedy routing isn't better.
    """
    if (not isinstance(routes, list) or not 1 <= len(routes) <= 120 or
            not isinstance(scale, (int, float)) or isinstance(scale, bool) or
            not isfinite(scale) or not .02 <= scale <= 3 or
            any(not isinstance(path, list) or not 2 <= len(path) <= 300
                for path in routes)):
        raise ValueError('Invalid bounded route ordering input')
    before = jump_distance_mm(routes, scale)
    if len(routes) == 1:
        return routes, {'baselinePenUpMm':0., 'plannedPenUpMm':0.,
                        'penUpReductionMm':0., 'pathOrderOptimised':False}
    candidates = []
    for initial in (0, len(routes)-1):
        for reverse_first in (False, True):
            remaining = set(range(len(routes)))
            remaining.remove(initial)
            ordered = [list(reversed(routes[initial])) if reverse_first
                       else routes[initial][:]]
            while remaining:
                last = ordered[-1][-1]
                next_id, reverse, _ = min(
                    ((idx, rev,
                      hypot(routes[idx][-1 if rev else 0][0]-last[0],
                            routes[idx][-1 if rev else 0][1]-last[1]))
                     for idx in remaining for rev in (False, True)),
                    key=lambda row:(round(row[2],10), row[0], row[1]))
                ordered.append(list(reversed(routes[next_id])) if reverse
                               else routes[next_id][:])
                remaining.remove(next_id)
            candidates.append((jump_distance_mm(ordered,scale), ordered))
    best = min(candidates, key=lambda row:round(row[0],10))
    changed = best[0] < before-1e-8
    result = best[1] if changed else routes
    after = min(before,best[0])
    return result, {
        'baselinePenUpMm':round(before,4),
        'plannedPenUpMm':round(after,4),
        'penUpReductionMm':round(max(0.,before-after),4),
        'pathOrderOptimised':changed,
    }
