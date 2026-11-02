"""Bounded and source-supported compact detail refinement for MD-2.66.

Never draw circles, strokes, eyes, pupils or other invented geometric objects.
A detected compact dark feature merely selects a small area in which existing
source pixels may vote for their *closest already-selected thread colour*.
This is not semantic identification or approval for embroidery machines.
"""
import numpy as np
from scipy.ndimage import gaussian_filter, median_filter


def protect_candidates(labels, lab, foreground, centres, proposals, *, max_changed=640):
    """Refine up to 12 compact regions using original CIELAB values only.

    Input labels: palette indices 0..K-1, 255 on background. Every changed pixel
    must become at least deltaE76 5.0 closer to the original source when
    measured against a bounded, lightly smoothed local reference. No new thread
    colour or foreground pixel is invented.
    """
    if (not isinstance(labels, np.ndarray) or not isinstance(lab, np.ndarray)
            or not isinstance(foreground, np.ndarray) or not isinstance(centres, np.ndarray)
            or labels.shape != foreground.shape or lab.shape != (*labels.shape, 3)
            or centres.ndim != 2 or centres.shape[1] != 3
            or not 1 <= len(centres) <= 12
            or not np.all(labels[~foreground] == 255)
            or not np.all(labels[foreground] < len(centres))
            or not isinstance(proposals, list) or len(proposals) > 100
            or not 0 <= max_changed <= 640):
        raise ValueError('Invalid source-grounded detail protection input')
    refined = labels.copy()
    smoothed = gaussian_filter(lab, sigma=(.65, .65, 0))
    before = after = 0.0
    modified = active = 0
    for item in sorted(proposals, reverse=True)[:12]:
        if len(item) != 4:
            raise ValueError('Invalid detail proposal')
        _, cy, cx, sigma = item
        if (not all(np.isfinite(v) for v in item)
                or not 0 <= cy < labels.shape[0] or not 0 <= cx < labels.shape[1]
                or not 2 <= sigma <= 8):
            raise ValueError('Invalid detail proposal geometry')
        radius = int(np.ceil(sigma * 1.35))
        y0, y1 = max(0, int(cy)-radius), min(labels.shape[0], int(cy)+radius+1)
        x0, x1 = max(0, int(cx)-radius), min(labels.shape[1], int(cx)+radius+1)
        yy, xx = np.ogrid[y0:y1, x0:x1]
        zone = (np.hypot(yy-cy, xx-cx) <= sigma * 1.2) & foreground[y0:y1, x0:x1]
        if zone.sum() < 4:
            continue
        block = refined[y0:y1, x0:x1]
        reference = smoothed[y0:y1, x0:x1]
        distance = np.linalg.norm(reference[:, :, None, :] - centres[None, None, :, :], axis=3)
        choice = median_filter(distance.argmin(axis=2).astype(np.uint8), size=3)
        rows = np.arange(y1-y0)[:, None]
        cols = np.arange(x1-x0)[None, :]
        old_error = distance[rows, cols, block.clip(0, len(centres)-1)]
        new_error = distance[rows, cols, choice]
        eligible = zone & (choice != block) & (old_error > new_error + 5.)
        count = int(eligible.sum())
        if count and count <= max_changed-modified:
            before += float(old_error[eligible].sum())
            after += float(new_error[eligible].sum())
            block[eligible] = choice[eligible]
            modified += count
            active += 1
    return refined, {
        'sourceSupportedDetailRegions': active,
        'sourceSupportedPixelsChanged': modified,
        'changedPixelColourErrorBefore': round(before, 3),
        'changedPixelColourErrorAfter': round(after, 3),
        'syntheticDarkDisksCreated': False,
        'featureLikenessVerified': False,
        'machineSewoutVerified': False
    }
