"""Bounded conversion of validated satin rails/rungs to Ink/Stitch SVG input.

The module emits native Ink/Stitch satin geometry; it does not approve a design
for any fabric or claim physical embroidery quality. Coordinates are millimetres.
"""
from dataclasses import dataclass
from math import hypot, isfinite
from xml.etree import ElementTree as ET
import re

MAX_SIZE_MM = 400.0
MAX_NODES = 128
MIN_WIDTH_MM = 1.5  # conservative project gate; not a universal satin rule
MAX_WIDTH_MM = 5.0  # conservative project gate; not a universal satin rule
INKSTITCH_NS = "http://inkstitch.org/namespace"
_COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")
ET.register_namespace("inkstitch", INKSTITCH_NS)


@dataclass(frozen=True)
class SatinColumn:
    left: tuple[tuple[float, float], ...]
    right: tuple[tuple[float, float], ...]
    rungs: tuple[tuple[tuple[float, float], tuple[float, float]], ...]
    thread_color: str = "#153e46"
    zigzag_spacing_mm: float = 0.4
    max_stitch_length_mm: float | None = None


def column_from_validated_pixel_rungs(geometry: dict, mm_per_pixel: float, *,
                                      origin_mm: tuple[float, float] = (2.0, 2.0),
                                      thread_color: str = "#153e46",
                                      zigzag_spacing_mm: float = 0.4,
                                      max_stitch_length_mm: float | None = None) -> SatinColumn:
    """Convert the browser validator's paired-rung result from pixels to mm.

    The browser's ``validateRails`` response is still untrusted at the worker
    boundary. This helper checks its shape and ``validate_column`` repeats all
    safety geometry checks after physical scaling.
    """
    if (not isinstance(geometry, dict) or geometry.get("accepted") is not True
            or geometry.get("machineApproved") is not False
            or geometry.get("geometryOnly") is not True):
        raise ValueError("Expected an accepted geometry-only satin preview")
    if (isinstance(mm_per_pixel, bool) or not isinstance(mm_per_pixel, (int, float))
            or not isfinite(mm_per_pixel) or not 0 < mm_per_pixel <= 10):
        raise ValueError("Invalid physical pixel scale")
    if (not isinstance(origin_mm, (tuple, list)) or len(origin_mm) != 2
            or any(isinstance(v, bool) or not isinstance(v, (int, float))
                   or not isfinite(v) or abs(v) > MAX_SIZE_MM for v in origin_mm)):
        raise ValueError("Invalid physical design origin")
    rungs = geometry.get("rungs")
    if not isinstance(rungs, list) or not 3 <= len(rungs) <= MAX_NODES:
        raise ValueError("Validated satin preview has no bounded rung list")

    def to_mm(point):
        if (not isinstance(point, (tuple, list)) or len(point) != 2
                or any(isinstance(v, bool) or not isinstance(v, (int, float))
                       or not isfinite(v) or abs(v) > 10000 for v in point)):
            raise ValueError("Invalid pixel satin rung")
        return (round(origin_mm[0] + point[0] * mm_per_pixel, 4),
                round(origin_mm[1] + point[1] * mm_per_pixel, 4))

    left, right, native_rungs = [], [], []
    for rung in rungs:
        if not isinstance(rung, dict) or "left" not in rung or "right" not in rung:
            raise ValueError("Satin rung must contain paired rail points")
        l, r = to_mm(rung["left"]), to_mm(rung["right"])
        left.append(l); right.append(r); native_rungs.append((l, r))
    return SatinColumn(tuple(left), tuple(right), tuple(native_rungs), thread_color,
                       zigzag_spacing_mm, max_stitch_length_mm)


def _point(p, width, height):
    if (not isinstance(p, (tuple, list)) or len(p) != 2
            or any(isinstance(v, bool) or not isinstance(v, (int, float))
                   or not isfinite(v) for v in p)
            or not (0 <= p[0] <= width and 0 <= p[1] <= height)):
        raise ValueError("Satin point must be finite and inside physical bounds")
    return float(p[0]), float(p[1])


def _cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def _on_segment(a, b, p, tol=1e-8):
    return (abs(_cross(a, b, p)) <= tol
            and min(a[0], b[0])-tol <= p[0] <= max(a[0], b[0])+tol
            and min(a[1], b[1])-tol <= p[1] <= max(a[1], b[1])+tol)


def _intersects(a, b, c, d):
    p, q, r, s = _cross(a, b, c), _cross(a, b, d), _cross(c, d, a), _cross(c, d, b)
    if p*q < -1e-14 and r*s < -1e-14:
        return True
    return any((_on_segment(a, b, c), _on_segment(a, b, d),
                _on_segment(c, d, a), _on_segment(c, d, b)))


def _distance_to_polyline(point, line):
    best = float("inf")
    for a, b in zip(line, line[1:]):
        dx, dy = b[0]-a[0], b[1]-a[1]
        denom = dx*dx+dy*dy
        t = 0 if denom == 0 else max(0, min(1, ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/denom))
        best = min(best, hypot(point[0]-(a[0]+t*dx), point[1]-(a[1]+t*dy)))
    return best


def validate_column(column: SatinColumn, width_mm: float, height_mm: float) -> None:
    """Reject malformed, crossed, very narrow/wide, or unbounded satin geometry."""
    for value, label in ((width_mm, "design width"), (height_mm, "design height")):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or not 1 <= value <= MAX_SIZE_MM:
            raise ValueError(f"Invalid {label}")
    if not isinstance(column, SatinColumn):
        raise ValueError("Expected a SatinColumn")
    left, right = column.left, column.right
    if (not isinstance(left, (tuple, list)) or not isinstance(right, (tuple, list))
            or len(left) != len(right) or not 3 <= len(left) <= MAX_NODES):
        raise ValueError("Satin rails must be paired and contain 3 to 128 points")
    left = tuple(_point(p, width_mm, height_mm) for p in left)
    right = tuple(_point(p, width_mm, height_mm) for p in right)
    if not isinstance(column.rungs, (tuple, list)) or not 3 <= len(column.rungs) <= MAX_NODES:
        raise ValueError("Satin requires 3 to 128 direction rungs")
    rungs = tuple(tuple(_point(p, width_mm, height_mm) for p in rung) for rung in column.rungs)
    if any(len(rung) != 2 for rung in rungs):
        raise ValueError("Each satin rung must be a two-point line")
    for rail in (left, right):
        if any(hypot(b[0]-a[0], b[1]-a[1]) < 0.08 for a, b in zip(rail, rail[1:])):
            raise ValueError("Satin rail contains a collapsed segment")
        for i in range(len(rail)-1):
            for j in range(i+2, len(rail)-1):
                if _intersects(rail[i], rail[i+1], rail[j], rail[j+1]):
                    raise ValueError("Satin rail self-intersects")
    widths = [hypot(a[0]-b[0], a[1]-b[1]) for a, b in zip(left, right)]
    if any(w <= MIN_WIDTH_MM or w > MAX_WIDTH_MM for w in widths):
        raise ValueError("Satin width outside conservative project range (1.5 to 5 mm)")
    if max(widths)/min(widths) > 1.8:
        raise ValueError("Satin taper exceeds conservative project limit")
    for a, b in zip(left, left[1:]):
        for c, d in zip(right, right[1:]):
            if _intersects(a, b, c, d):
                raise ValueError("Satin rails cross")
    centers = [((a[0]+b[0])/2, (a[1]+b[1])/2) for a, b in zip(left, right)]
    length = sum(hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(centers, centers[1:]))
    if not 3 <= length <= 120:
        raise ValueError("Satin length outside conservative project range")
    for a, b, c in zip(centers, centers[1:], centers[2:]):
        u, v = (b[0]-a[0], b[1]-a[1]), (c[0]-b[0], c[1]-b[1])
        cosine = (u[0]*v[0]+u[1]*v[1])/(hypot(*u)*hypot(*v))
        if cosine < 0.55:
            raise ValueError("Abrupt satin centreline turn")
    for rung in rungs:
        # Require opposite rung endpoints to land on opposite rails.  This
        # avoids sending dangling or direction-reversed rungs to the engine.
        direct = _distance_to_polyline(rung[0], left)+_distance_to_polyline(rung[1], right)
        reverse = _distance_to_polyline(rung[0], right)+_distance_to_polyline(rung[1], left)
        if min(direct, reverse) > 0.10:
            raise ValueError("Each satin rung must meet both rails within 0.1 mm")
    if not isinstance(column.thread_color, str) or not _COLOR.fullmatch(column.thread_color):
        raise ValueError("Invalid satin thread colour")
    spacing = column.zigzag_spacing_mm
    if (isinstance(spacing, bool) or not isinstance(spacing, (int, float))
            or not isfinite(spacing) or not 0.2 <= spacing <= 1.0):
        raise ValueError("Zig-zag spacing must be 0.2 to 1.0 mm")
    maximum = column.max_stitch_length_mm
    if maximum is not None and (isinstance(maximum, bool) or not isinstance(maximum, (int, float))
                                or not isfinite(maximum) or not 2 <= maximum <= 12):
        raise ValueError("Maximum satin stitch length must be 2 to 12 mm")


def build_satin_svg(width_mm: float, height_mm: float,
                    columns: tuple[SatinColumn, ...]) -> bytes:
    """Emit one path per column: two same-direction rails followed by its rungs."""
    if not isinstance(columns, (tuple, list)) or not 1 <= len(columns) <= 128:
        raise ValueError("Invalid satin column count")
    root = ET.Element("svg", {
        "xmlns": "http://www.w3.org/2000/svg",
        "width": f"{width_mm:.3f}mm", "height": f"{height_mm:.3f}mm",
        "viewBox": f"0 0 {width_mm:.3f} {height_mm:.3f}",
    })
    metadata = ET.SubElement(root, "metadata")
    ET.SubElement(metadata, f"{{{INKSTITCH_NS}}}inkstitch_svg_version").text = "4"
    for index, column in enumerate(columns):
        validate_column(column, width_mm, height_mm)
        lines = [column.left, column.right, *column.rungs]
        d = " ".join("M " + " L ".join(f"{x:.4f},{y:.4f}" for x, y in line) for line in lines)
        attrs = {
            "id": f"satin-{index}", "d": d, "fill": "none",
            "stroke": column.thread_color, "stroke-width": "0.2",
            f"{{{INKSTITCH_NS}}}satin_column": "true",
            f"{{{INKSTITCH_NS}}}satin_method": "satin_column",
            f"{{{INKSTITCH_NS}}}zigzag_spacing_mm": f"{column.zigzag_spacing_mm:.3f}",
        }
        if column.max_stitch_length_mm is not None:
            attrs[f"{{{INKSTITCH_NS}}}max_stitch_length_mm"] = f"{column.max_stitch_length_mm:.3f}"
        ET.SubElement(root, "path", attrs)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)
