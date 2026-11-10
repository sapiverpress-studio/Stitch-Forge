"""Physical-size colour planning for source-verified artwork."""
from hashlib import sha256

import numpy as np
from scipy import ndimage as ndi
from skimage.color import lab2rgb, rgb2lab

from artwork_packet import regions_from_labels
from hybrid_home import deterministic_palette
from texture_structure import consolidate_texture


def _thread_lab(palette):
    rgb = np.array([list(bytes.fromhex(colour[1:])) for colour in palette], dtype=np.float32)
    return rgb2lab(rgb[None] / 255)[0]


def _component_count(labels, palette):
    return sum(ndi.label(labels == i)[1] for i in range(1, len(palette) + 1))


def _source_marks(labels, lab, foreground, scale, palette):
    """Protect supported small marks and narrow contrasting lines in every hue."""
    anchors = np.zeros_like(foreground)
    ring_pixels = max(1, round(.45 / scale))
    for index in range(1, len(palette) + 1):
        parts, count = ndi.label(labels == index)
        areas = np.bincount(parts.ravel(), minlength=count + 1) * scale**2
        for part, (rows, cols) in enumerate(ndi.find_objects(parts), 1):
            area = areas[part]
            length = max(rows.stop - rows.start, cols.stop - cols.start) * scale
            if not .12 <= area <= 24 or length < .85:
                continue
            if area > 5 and area / length > 1.4:
                continue
            frame = (slice(max(0, rows.start-ring_pixels), rows.stop+ring_pixels),
                     slice(max(0, cols.start-ring_pixels), cols.stop+ring_pixels))
            core = parts[frame] == part
            neighbours = ndi.binary_dilation(core, iterations=ring_pixels) & foreground[frame] & ~core
            if not neighbours.any():
                anchors[frame] |= core
                continue
            pixels = lab[frame]
            contrast = np.linalg.norm(np.median(pixels[core], axis=0) - np.median(pixels[neighbours], axis=0))
            if contrast >= (16 if length >= 3 and area / length <= 1.2 else 23):
                anchors[frame] |= core
    return anchors


def _absorb_flecks(labels, palette, foreground, anchors, scale):
    """Only absorb unprotected components near a substantial same-island fill."""
    seeds = anchors.copy()
    for index in range(1, len(palette) + 1):
        parts, count = ndi.label(labels == index)
        keep = np.bincount(parts.ravel(), minlength=count + 1) * scale**2 >= 3.
        keep[0] = False
        seeds |= keep[parts]
    if not seeds.any():
        return labels
    distances, coordinates = ndi.distance_transform_edt(~seeds, return_indices=True)
    nearest = tuple(coordinates)
    islands, _ = ndi.label(foreground)
    merge = foreground & ~seeds & (distances * scale <= 1.6) & (islands == islands[nearest])
    result = labels.copy()
    result[merge] = labels[nearest][merge]
    return result


def restore_compact_marks(image, labels, palette, scale):
    """Recover small, uniform, high-contrast marks lost by coarse colour grouping."""
    foreground = labels > 0
    if len(palette) < 2 or not .065 <= scale <= .55:
        return labels, 0, 0
    lab = rgb2lab(image.astype(np.float32) / 255)
    threads = _thread_lab(palette)
    samples = lab[foreground]
    distances = np.column_stack([np.linalg.norm(samples - thread, axis=1) for thread in threads])
    nearest = np.zeros_like(labels)
    nearest[foreground] = distances.argmin(axis=1) + 1
    output = labels.copy()
    marks = changed = 0
    reach = max(1, round(.6 / scale))
    pixel_budget = max(1, int(foreground.sum() * .02))
    for colour in range(1, len(palette) + 1):
        parts, count = ndi.label(nearest == colour)
        sizes = np.bincount(parts.ravel(), minlength=count + 1)
        for part, (rows, cols) in enumerate(ndi.find_objects(parts), 1):
            area = sizes[part] * scale**2
            if not .35 <= area <= 5.5 or min(rows.stop-rows.start, cols.stop-cols.start) * scale < .7:
                continue
            frame = (slice(max(0, rows.start-reach), rows.stop+reach),
                     slice(max(0, cols.start-reach), cols.stop+reach))
            core = parts[frame] == part
            current = labels[frame][core]
            if np.count_nonzero(current == colour) > .15 * len(current):
                continue
            ring = ndi.binary_dilation(core, iterations=reach) & foreground[frame] & ~core
            if ring.sum() < len(current) * .4:
                continue
            ring_colours = np.bincount(labels[frame][ring], minlength=len(palette)+1)
            surrounding = int(ring_colours.argmax())
            if ring_colours[surrounding] < .85 * ring.sum() or np.count_nonzero(current == surrounding) < .85 * len(current):
                continue
            pixels = lab[frame][core]
            median = np.median(pixels, axis=0)
            surrounding_lab = np.median(lab[frame][ring], axis=0)
            if (np.linalg.norm(median - surrounding_lab) < 29
                    or np.percentile(np.linalg.norm(pixels - median, axis=1), 80) > 11
                    or np.linalg.norm(median - threads[colour - 1]) > 21
                    or np.linalg.norm(median - threads[surrounding - 1])
                       - np.linalg.norm(median - threads[colour - 1]) < 18):
                continue
            if marks >= 40 or changed + len(current) > pixel_budget:
                return output, marks, changed
            output[frame][core] = colour
            marks += 1
            changed += len(current)
    return output, marks, changed


def consolidate_colour(image, labels, palette, scale, input_parts):
    """Pick a less fragmented plan only when it preserves coarse source colour."""
    evidence = {'inputComponents': input_parts, 'outputComponents': input_parts,
                'colourConsolidated': False, 'sourceForegroundPreserved': True}
    if input_parts < 55 or input_parts > 1800 or len(palette) < 3 or not .065 <= scale <= .55:
        return labels, palette, {**evidence, 'colourDecision': 'outside_consolidation_scope'}

    foreground = labels > 0
    lab = rgb2lab(image.astype(np.float32) / 255)
    anchors = _source_marks(labels, lab, foreground, scale, palette)
    anchored_colours = [palette[i - 1] for i in np.unique(labels[anchors])]
    baseline_threads = _thread_lab(palette)

    def smooth(pixels, radius_mm):
        sigma = radius_mm / scale
        weights = ndi.gaussian_filter(foreground.astype(np.float32), sigma)
        blurred = ndi.gaussian_filter(pixels * foreground[:, :, None], (sigma, sigma, 0))
        return blurred[foreground] / weights[foreground, None]

    samples = smooth(lab, .85)
    reference = smooth(lab, 1.2)
    baseline_pixels = np.zeros_like(lab)
    baseline_pixels[foreground] = baseline_threads[labels[foreground] - 1]
    before_error = np.linalg.norm(reference - smooth(baseline_pixels, 1.2), axis=1)
    evidence.update(protectedPixels=int(anchors.sum()), protectedColours=anchored_colours,
                    inputMeanMacroLabError=round(float(before_error.mean()), 3))

    # The existing palette is always a candidate. Tonal artwork can also use
    # a smaller palette fitted to physically smoothed source colours, while
    # protected marks retain the exact original thread.
    palettes = [palette]
    colour_count = min(max(3, round(len(palette) * .56)), 12 - len(anchored_colours))
    if colour_count >= 3 and colour_count < len(palette):
        centres = deterministic_palette(samples[::max(1, len(samples) // 8000)], colour_count)
        colours = np.rint(lab2rgb(centres[None])[0] * 255).astype(np.uint8)
        palettes.append(sorted({*anchored_colours, *('#' + bytes(rgb).hex().upper() for rgb in colours)}))

    best = (labels, palette, {**evidence, 'colourDecision': 'source_fidelity_or_fragmentation_guard'})
    best_parts = input_parts
    for candidate_palette in palettes:
        threads = _thread_lab(candidate_palette)
        distance = np.column_stack([np.sum((samples - thread)**2, axis=1) for thread in threads])
        proposed = np.zeros_like(labels)
        proposed[foreground] = distance.argmin(axis=1) + 1
        for colour in anchored_colours:
            proposed[anchors & (labels == palette.index(colour) + 1)] = candidate_palette.index(colour) + 1
        proposed = _absorb_flecks(proposed, candidate_palette, foreground, anchors, scale)
        parts = _component_count(proposed, candidate_palette)
        if parts >= best_parts or parts > .78 * input_parts:
            continue
        candidate_pixels = np.zeros_like(lab)
        candidate_pixels[foreground] = threads[proposed[foreground] - 1]
        after_error = np.linalg.norm(reference - smooth(candidate_pixels, 1.2), axis=1)
        if (after_error.mean() > before_error.mean() + 1.8
                or np.percentile(after_error - before_error, 95) > 5.5):
            continue
        used = np.unique(proposed[foreground])
        mapping = np.zeros(len(candidate_palette) + 1, dtype=np.uint8)
        mapping[used] = np.arange(1, len(used) + 1)
        best_parts = parts
        best = (mapping[proposed], [candidate_palette[i - 1] for i in used],
                {**evidence, 'colourDecision': 'consolidated', 'colourConsolidated': True,
                 'outputComponents': parts, 'outputMeanMacroLabError': round(float(after_error.mean()), 3)})
    return best


def prepare_layout(plan, masks, image, scale, *, allow_consolidation):
    """Attach server-owned layout evidence without changing the source identity."""
    baseline = np.zeros(image.shape[:2], dtype=np.uint8)
    palette = sorted(masks)
    for i, colour in enumerate(palette, 1):
        baseline[masks[colour]] = i
    parts = plan['summary']['workingParts']
    evidence = {'inputComponents': parts, 'outputComponents': parts,
                'colourDecision': 'user_kept_original_colours', 'colourConsolidated': False,
                'sourceForegroundPreserved': True}
    if allow_consolidation:
        labels, selected_palette, tonal = consolidate_texture(image, baseline > 0, baseline, palette, scale)
        if tonal['selected']:
            palette = selected_palette
            evidence = {**tonal, 'colourDecision': 'consolidated_tonal_texture',
                        'colourConsolidated': True}
        else:
            labels, palette, evidence = consolidate_colour(image, baseline, palette, scale, parts)
        labels, marks, changed = restore_compact_marks(image, labels, palette, scale)
        evidence.update(sourceMarksRestored=marks, sourceMarkPixelsRestored=changed)
    if evidence['colourConsolidated'] or evidence.get('sourceMarksRestored'):
        foreground = baseline > 0
        if not np.array_equal(labels > 0, foreground):
            raise ValueError('Adaptive artwork layout changed the source foreground')
        regions, count = regions_from_labels(labels, palette)
        evidence['outputComponents'] = count
        baseline_rgb = np.array([list(bytes.fromhex(colour[1:])) for colour in sorted(masks)])
        output_rgb = np.array([list(bytes.fromhex(colour[1:])) for colour in palette])[labels[foreground]-1]
        recoloured = np.any(baseline_rgb[baseline[foreground]-1] != output_rgb, axis=1)
        rgb_error = np.linalg.norm(image[foreground].astype(float) - output_rgb, axis=1)
        evidence.update(recolouredPixels=int(recoloured.sum()),
                        outputMeanRgbDistance=float(rgb_error.mean()),
                        outputPixelsBeyondRgb60=int((rgb_error > 60).sum()))
        plan = {**plan, 'regions': regions,
                'sourcePlanSignature': sha256(plan['sourcePlanSignature'].encode() + labels.tobytes()
                                             + '|'.join(palette).encode()).hexdigest(),
                'summary': {**plan['summary'], 'workingParts': count,
                            'recolouredPixels': evidence['recolouredPixels']}}
    return {**plan, 'adaptiveArtworkLayout': evidence}
