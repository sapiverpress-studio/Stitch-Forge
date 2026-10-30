"""Independent decoded needle/void/direction audit for local compound controls.

No production job or endpoint imports this module. Source attribution uses the
requested colour blocks and an explicit full-source-frame origin in DST. PES
is checked against every independently decoded DST needle after translation.
It never rescales, rotates, invents or substitutes stitch movements.
"""
from dataclasses import asdict
from hashlib import sha256
from io import BytesIO
import json
from math import atan2, cos, degrees, hypot, radians, sin
from pathlib import Path
from statistics import median
import zipfile
import pyembroidery
from compound_native import prepare_compound_control, build_compound_control_svg
from format_audit import audit_zip
from inkstitch_cli import export_trusted_svg


def edges(ring):
    return zip(ring, ring[1:]+ring[:1])


def inside(point, ring):
    x, y = point
    result = False
    for a, b in edges(ring):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            result = not result
    return result


def boundary_distance(point, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return hypot(point[0]-a[0]-t*dx, point[1]-a[1]-t*dy)


def allowed(point, regions, tolerance=0.11):
    for region in regions:
        if inside(point, region['outer']) and not any(inside(point, h) for h in region['holes']):
            return True
        if any(boundary_distance(point, a, b) <= tolerance
               for ring in (region['outer'], *region['holes']) for a, b in edges(ring)):
            return True
    return False


def segment_outside(a, b, regions):
    """Analytically split at every boundary crossing, then test open intervals.

    This detects a long stitch across a hole even if both needle endpoints are
    in the filled region. A 0.11mm boundary tolerance covers 0.1mm file rounding.
    """
    dx, dy = b[0]-a[0], b[1]-a[1]
    cuts = {0.0, 1.0}
    for region in regions:
        for ring in (region['outer'], *region['holes']):
            for c, d in edges(ring):
                ex, ey = d[0]-c[0], d[1]-c[1]
                denominator = dx*ey-dy*ex
                if abs(denominator) < 1e-12:
                    continue
                rx, ry = c[0]-a[0], c[1]-a[1]
                t, u = (rx*ey-ry*ex)/denominator, (rx*dy-ry*dx)/denominator
                if 0 < t < 1 and 0 <= u <= 1:
                    cuts.add(t)
    cuts = sorted(cuts)
    return any(not allowed((a[0]+dx*(t+u)/2, a[1]+dy*(t+u)/2), regions)
               for t, u in zip(cuts, cuts[1:]) if u-t > 1e-9)


def audit_pattern(pattern, prepared, fmt, pes_translation=None):
    regions = prepared['regions']
    if len(pattern.stitches) > 125000:
        raise ValueError('Decoded compound command budget exceeded')
    edge_count = sum(len(r['outer'])+sum(map(len,r['holes'])) for r in regions)
    if len(pattern.stitches)*edge_count > 20000000:
        raise ValueError('Decoded compound geometry-audit work budget exceeded')
    source_x = [x for r in regions for x, y in r['outer']]
    source_y = [y for r in regions for x, y in r['outer']]
    expected_bounds = (max(source_x)-min(source_x), max(source_y)-min(source_y))
    needles = [(s[0], s[1]) for s in pattern.stitches if s[2] & pyembroidery.COMMAND_MASK == pyembroidery.STITCH]
    if not needles:
        raise ValueError('No decoded needle instructions')
    left, top = min(p[0] for p in needles), min(p[1] for p in needles)
    right, bottom = max(p[0] for p in needles), max(p[1] for p in needles)
    actual_bounds = ((right-left)/10, (bottom-top)/10)
    # Tatami rows need not land on the outline's extrema. Allow at most one
    # missing row at each edge, never expansion beyond quantisation. The fixed
    # source-frame origin and every needle/segment are checked separately.
    extent_shortfall = 2*prepared['settings']['rowSpacingMm']+0.11
    if any(b > a+0.11 or a-b > extent_shortfall for a, b in zip(expected_bounds, actual_bounds)):
        raise ValueError('Decoded physical extents differ from source compound geometry')
    if fmt == 'dst':
        translation = prepared['originMm']
    elif pes_translation is not None:
        translation = pes_translation
    else:
        raise ValueError('PES alignment requires independently decoded DST coordinates')
    sequence = []
    for r in regions:
        if not sequence or sequence[-1] != r['color']:
            sequence.append(r['color'])
    blocks = [[r for r in regions if r['color'] == color] for color in sequence]
    previous = None
    block = 0
    failures, points_outside = [], 0
    needle_count = jumps = trims = changes = stops = 0
    max_move = total_length = aligned_length = 0.0
    projections = []
    moves = []
    angle = radians(prepared['settings']['angleDeg'])
    for x, y, flags in pattern.stitches:
        command = flags & pyembroidery.COMMAND_MASK
        point = (x/10+translation[0], y/10+translation[1])
        if command == pyembroidery.COLOR_CHANGE:
            changes += 1; block += 1
        elif command == pyembroidery.JUMP:
            jumps += 1
        elif command == pyembroidery.TRIM:
            trims += 1
        elif command == pyembroidery.STOP:
            stops += 1
        elif command == pyembroidery.STITCH:
            needle_count += 1
            if block >= len(blocks):
                raise ValueError('Unexpected decoded colour block')
            if not allowed(point, blocks[block]):
                points_outside += 1
            if previous is not None:
                length = hypot(point[0]-previous[0], point[1]-previous[1])
                max_move = max(max_move, length)
                if segment_outside(previous, point, blocks[block]):
                    failures.append({'from': previous, 'to': point, 'block': block})
                moves.append((previous, point, block))
                if length >= 1.0:
                    total_length += length
                    direction = degrees(atan2(-(point[1]-previous[1]), point[0]-previous[0]))
                    error = abs((direction-prepared['settings']['angleDeg']+90) % 180-90)
                    if error <= 4:
                        aligned_length += length
                        projections.append(((point[0]+previous[0])*sin(angle)+(point[1]+previous[1])*cos(angle))/2)
        previous = point
    if not pattern.stitches or (pattern.stitches[-1][2] & pyembroidery.COMMAND_MASK) != pyembroidery.END:
        raise ValueError('Decoded file has no complete END instruction')
    if changes != len(sequence)-1:
        raise ValueError('Decoded colour-change count differs from requested region order')
    if points_outside or failures:
        raise ValueError(f'Unsafe compound stitch path: {points_outside} needle points and {len(failures)} segments outside their source colour regions')
    if not 50 <= needle_count <= 100000 or max_move > prepared['settings']['maxStitchMm']+0.15:
        raise ValueError('Decoded compound stitch-count/length bound exceeded')
    alignment = aligned_length/max(total_length, 1e-9)
    if alignment < 0.5:
        raise ValueError('Decoded stitches do not predominantly follow requested fill direction')
    rows = []
    for value in sorted(projections):
        if not rows or value-rows[-1][-1] > 0.15:
            rows.append([value])
        else:
            rows[-1].append(value)
    centers = [sum(row)/len(row) for row in rows]
    gaps = [b-a for a, b in zip(centers, centers[1:])]
    row_gap = median(gaps) if gaps else None
    if row_gap is None or abs(row_gap-prepared['settings']['rowSpacingMm']) > 0.15:
        raise ValueError('Decoded row spacing differs from requested source fill spacing')
    palette = ['#'+thread.hex_color().lstrip('#').lower() for thread in pattern.threadlist] if fmt == 'pes' else []
    if fmt == 'pes':
        if len(palette) < len(sequence):
            raise ValueError('PES thread sequence incomplete')
        def rgb(color):
            return tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
        for actual, expected in zip(palette, sequence):
            nearest = min(sequence, key=lambda color:sum((a-b)**2 for a, b in zip(rgb(actual), rgb(color))))
            if nearest != expected:
                raise ValueError('PES decoded palette order differs from source colour intent')
    return {'format': fmt, 'needleStitches': needle_count, 'jumps': jumps, 'trims': trims, 'stops': stops,
            'colourChanges': changes, 'boundsMm': actual_bounds, 'expectedBoundsMm': expected_bounds,
            'translationToSourceMm': translation, 'extentShortfallBoundMm': extent_shortfall,
            'maxNeedleMoveMm': round(max_move, 3),
            'needlePointsOutsideSourceColour': points_outside, 'needleSegmentsOutsideSourceColour': len(failures),
            'longStitchLengthAlignedWithin4DegFraction': round(alignment, 4),
            'medianDecodedRowGapMm': round(row_gap, 4), 'decodedPalette': palette,
            'requestedColourOrder': sequence, 'requestedRegionOrder': [r['id'] for r in regions],
            'needleStitchesPerFilledMm2': round(needle_count/sum(r['areaMm2'] for r in regions), 4)}, moves


def decoded_svg(moves, prepared, palette):
    paths = []
    sequence = []
    for r in prepared['regions']:
        if not sequence or r['color'] != sequence[-1]:
            sequence.append(r['color'])
    for a, b, block in moves:
        color = palette[block] if block < len(palette) else sequence[block]
        paths.append(f'<path d="M{a[0]:.3f},{a[1]:.3f} L{b[0]:.3f},{b[1]:.3f}" stroke="{color}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {prepared["widthMm"]:.3f} {prepared["heightMm"]:.3f}" '
            f'width="1008" height="816"><g fill="none" stroke-width="0.09">'+''.join(paths)+'</g></svg>')


def run_compound_acceptance(project, executable, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    prepared = prepare_compound_control(project)
    source = build_compound_control_svg(project)
    (output/'native-compound-input.svg').write_bytes(source)
    engine = export_trusted_svg(output/'native-compound-input.svg', executable=Path(executable), timeout_seconds=60)
    structural = audit_zip(engine.zip_bytes)
    (output/'actual-pes-dst.zip').write_bytes(engine.zip_bytes)
    reports = []
    with zipfile.ZipFile(BytesIO(engine.zip_bytes)) as archive:
        decoded = {}
        binaries = {}
        for fmt in ('dst', 'pes'):
            name = next(n for n in archive.namelist() if n.lower().endswith('.'+fmt))
            raw = archive.read(name)
            pattern = (pyembroidery.read_pes if fmt == 'pes' else pyembroidery.read_dst)(BytesIO(raw))
            decoded[fmt], binaries[fmt] = pattern, raw
        needle_points = {fmt: [(s[0]/10, s[1]/10) for s in p.stitches
                        if s[2] & pyembroidery.COMMAND_MASK == pyembroidery.STITCH] for fmt, p in decoded.items()}
        if len(needle_points['dst']) != len(needle_points['pes']) or not needle_points['dst']:
            raise ValueError('PES/DST needle sequence lengths differ')
        first_dst, first_pes = needle_points['dst'][0], needle_points['pes'][0]
        pes_translation = tuple(prepared['originMm'][i]+first_dst[i]-first_pes[i] for i in (0, 1))
        for dst_point, pes_point in zip(needle_points['dst'], needle_points['pes']):
            if any(abs(dst_point[i]+prepared['originMm'][i]-pes_point[i]-pes_translation[i]) > 0.11 for i in (0, 1)):
                raise ValueError('PES/DST needle coordinates disagree after translation')
        for fmt in ('dst', 'pes'):
            raw, pattern = binaries[fmt], decoded[fmt]
            result, moves = audit_pattern(pattern, prepared, fmt, pes_translation)
            result['sha256'] = sha256(raw).hexdigest()
            reports.append(result)
            (output/('actual.'+fmt)).write_bytes(raw)
            (output/('decoded-'+fmt+'.svg')).write_text(decoded_svg(moves, prepared, result['decodedPalette']))
    if reports[0]['needleStitches'] != reports[1]['needleStitches']:
        raise ValueError('Decoded PES/DST needle counts differ')
    report = {'status': 'SOURCE_EXTRACTED_SYNTHETIC_CONTROL_VERIFIED_NOT_PHYSICALLY_STITCHED',
              'engine': 'Ink/Stitch 3.3.0', 'reader': 'pyembroidery 1.5.1',
              'engineSourceCommit': 'b0edd96311ece82ee48816dc93466274b12c2a9c',
              'settings': prepared['settings'], 'source': prepared['source'],
              'structuralAudit': [asdict(r) for r in structural], 'decoded': reports,
              'limitations': ['Synthetic raster control, not detailed-art acceptance or AI reconstruction.',
                             'Explicit native full-frame origin anchors DST; every PES needle is cross-checked after translation, without rescaling.',
                             'Fill rows may stop before an outline extremum; bounded shortfalls and absolute needle/segment locations are audited.',
                             '0.11mm boundary tolerance covers machine coordinate quantisation.',
                             'Minimum local feature width, routing efficiency and fabric suitability are not generally proven.',
                             'PES maps thread RGB to its palette. DST has no verified thread identity.',
                             'Density is an engineering measurement, not a fabric preset or physical approval.',
                             'Source-region browser projects and hosted exports remain machine-ineligible.']}
    (output/'machine-report.json').write_text(json.dumps(report, indent=2)+'\n')
    return report
