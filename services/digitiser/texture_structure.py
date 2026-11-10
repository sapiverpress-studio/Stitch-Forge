"""Opt-in colour consolidation for verified, highly fragmented artwork."""
import numpy as np
from scipy import ndimage as ndi
from skimage.color import lab2rgb, rgb2lab

from hybrid_home import deterministic_palette


def consolidate_texture(image, foreground, baseline, palette, scale):
    """Propose broad colour blocks and retain substantial dark source marks.

    The foreground, source grid and requested size are fixed. No geometry or
    stitch quality claim is made until the native files pass their own audit.
    """
    before = sum(ndi.label(baseline == i)[1] for i in range(1, len(palette) + 1))
    evidence = {'selected': False, 'inputComponents': before}
    if before < 80 or len(palette) < 7 or not .12 <= scale <= .42:
        return baseline, palette, {**evidence, 'reason': 'outside_trial_scope'}

    lab = rgb2lab(image.astype(np.float32) / 255)
    hues = lab[foreground][:, 1:]
    chroma = np.linalg.norm(hues, axis=1)
    vivid = chroma >= 25.
    vivid_fraction = float(vivid.mean())
    hue_coherence = (float(np.linalg.norm((hues[vivid] / chroma[vivid, None]).mean(axis=0)))
                     if vivid.any() else 0.)
    evidence.update(chromaticSourceFraction=round(vivid_fraction, 3),
                    dominantHueCoherence=round(hue_coherence, 3))
    # This tonal trial has evidence for a vivid, mostly single-hue subject.
    # Preserve the fine-detail plan for muted subjects and mixed hue families.
    if vivid_fraction < .55 or hue_coherence < .9:
        return baseline, palette, {**evidence, 'reason': 'colour_range_outside_trial_scope'}

    original_rgb = np.array([[int(c[k:k+2], 16) for k in (1, 3, 5)] for c in palette])
    dark_index = int(np.argmin(original_rgb.sum(axis=1))) + 1
    dark_objects, n_dark = ndi.label(baseline == dark_index)
    dark_sizes = np.bincount(dark_objects.ravel(), minlength=n_dark + 1) * scale**2
    significant_dark = dark_sizes >= .32
    significant_dark[0] = False
    anchors = significant_dark[dark_objects]

    def smooth(values, radius_mm):
        sigma = radius_mm / scale
        weights = ndi.gaussian_filter(foreground.astype(np.float32), sigma)
        blurred = ndi.gaussian_filter(values * foreground[:, :, None], (sigma, sigma, 0))
        return blurred / np.maximum(weights[:, :, None], 1e-6)

    # Separate the stable colour blocks from narrow tonal fluctuations before
    # fitting thread colours. The darkest supported shapes keep their thread.
    samples = smooth(lab, .9)[foreground]
    centres = deterministic_palette(samples[::max(1, len(samples) // 8000)], 5)
    colour_values = np.rint(lab2rgb(centres[np.newaxis])[0] * 255).astype(np.uint8)
    proposed_colours = ['#' + bytes(rgb).hex().upper() for rgb in colour_values]
    proposed_colours.append(palette[dark_index - 1])
    proposal = np.zeros_like(baseline)
    distances = np.sum((samples[:, None, :] - centres[None, :, :])**2, axis=2)
    proposal[foreground] = np.argmin(distances, axis=1) + 1
    proposal[anchors] = len(proposed_colours)

    # Only consolidate close to a supported region in the same source island.
    # Ownership of detached source marks and of the background stays bounded.
    seeds = anchors.copy()
    for i in range(1, len(proposed_colours) + 1):
        ids, count = ndi.label(proposal == i)
        sizes = np.bincount(ids.ravel(), minlength=count + 1) * scale**2
        keep = sizes >= 3.
        keep[0] = False
        seeds |= keep[ids]
    if not seeds.any():
        return baseline, palette, {**evidence, 'reason': 'no_supported_regions'}
    distance, nearest = ndi.distance_transform_edt(~seeds, return_indices=True)
    islands, _ = ndi.label(foreground)
    neighbour = tuple(nearest)
    merge = foreground & ~seeds & (distance * scale <= 1.75) & (islands == islands[neighbour])
    proposal[merge] = proposal[neighbour][merge]

    used = np.unique(proposal[foreground])
    candidate_palette = sorted({proposed_colours[i - 1] for i in used})
    mapping = np.zeros(len(proposed_colours) + 1, dtype=np.uint8)
    for i in used:
        mapping[i] = candidate_palette.index(proposed_colours[i - 1]) + 1
    candidate = mapping[proposal]
    after = sum(ndi.label(candidate == i)[1] for i in range(1, len(candidate_palette) + 1))

    # Compare the large-scale colour structure separately from micro-texture.
    reference = smooth(lab, 1.2)[foreground]

    def macro_error(labels, colours):
        threads = np.array([[int(c[k:k+2], 16) for k in (1, 3, 5)] for c in colours])
        thread_lab = rgb2lab(threads[np.newaxis].astype(np.float32) / 255)[0]
        assigned = np.zeros_like(lab)
        assigned[foreground] = thread_lab[labels[foreground] - 1]
        return float(np.linalg.norm(reference - smooth(assigned, 1.2)[foreground], axis=1).mean())

    before_error, after_error = macro_error(baseline, palette), macro_error(candidate, candidate_palette)
    foreground_preserved = np.array_equal(candidate > 0, foreground)
    selected = (after <= min(80, .45 * before) and after_error <= before_error + 2.
                and foreground_preserved)
    evidence.update(selected=bool(selected), outputComponents=after,
                    inputColours=len(palette), outputColours=len(candidate_palette),
                    protectedDarkComponents=int(significant_dark.sum()),
                    protectedDarkPixels=int(anchors.sum()),
                    inputMacroLabError=round(before_error, 3),
                    outputMacroLabError=round(after_error, 3),
                    sourceForegroundPreserved=bool(foreground_preserved))
    return (candidate, candidate_palette, evidence) if selected else (baseline, palette, evidence)
