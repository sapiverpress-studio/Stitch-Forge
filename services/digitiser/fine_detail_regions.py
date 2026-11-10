"""Refine a verified colour plan at the native stitch grid, in physical units."""
import numpy as np
from scipy import ndimage as ndi
from skimage.color import rgb2lab


def preserve_fine_detail(image, foreground, baseline, palette, mm_per_pixel):
    """Keep supported colour boundaries without promoting every texture fleck.

    The caller owns source validation. The foreground, thread palette, frame,
    and needle audit remain the same as for the standard Home plan.
    """
    lab = rgb2lab(image.astype(np.float32) / 255)
    thread_rgb = np.array([[int(c[k:k+2], 16) for k in (1, 3, 5)] for c in palette])
    threads = rgb2lab(thread_rgb[np.newaxis].astype(np.float32) / 255)[0]

    # Filter at a constant physical scale, excluding the plain/transparent
    # background from the average. The PNG still owns the source boundaries.
    sigma = .16 / mm_per_pixel
    weights = ndi.gaussian_filter(foreground.astype(np.float32), sigma)
    smooth = ndi.gaussian_filter(lab * foreground[:, :, None], (sigma, sigma, 0))
    samples = smooth[foreground] / weights[foreground, None]
    distances = np.column_stack([np.sum((samples - thread)**2, axis=1) for thread in threads])
    nearest = np.zeros_like(baseline)
    nearest[foreground] = np.argmin(distances, axis=1) + 1

    # Keep substantial regions and long thin marks such as feather edges.
    # The latter can survive at a much smaller area than isolated speckles.
    retained = np.zeros_like(foreground)
    for colour in range(1, len(threads) + 1):
        components, count = ndi.label(nearest == colour)
        areas = np.bincount(components.ravel(), minlength=count + 1) * mm_per_pixel**2
        lengths = np.array([0, *(max(s.stop - s.start for s in bounds)
                                  for bounds in ndi.find_objects(components))]) * mm_per_pixel
        keep = (areas >= 2.2) | ((areas >= .22) & (lengths >= 3.0))
        keep[0] = False
        retained |= keep[components]

    candidate = baseline.copy()
    if retained.any():
        islands, _ = ndi.label(foreground)
        coordinates = tuple(ndi.distance_transform_edt(~retained, return_distances=False,
                                                       return_indices=True))
        same_island = foreground & (islands[coordinates] == islands)
        candidate[same_island] = nearest[coordinates][same_island]

    # Measure strong internal source edges separately from the silhouette.
    gradients = [ndi.sobel(lab, axis=axis) for axis in (0, 1)]
    edges = (sum(np.sum(g**2, axis=2) for g in gradients) > 64**2)
    edges &= ndi.binary_erosion(foreground, iterations=3)
    edge_count = int(edges.sum())

    def measure(labels):
        difference = lab[foreground] - threads[labels[foreground] - 1]
        boundary = ndi.maximum_filter(labels, size=3) != ndi.minimum_filter(labels, size=3)
        return float(np.linalg.norm(difference, axis=1).mean()), int((boundary & edges).sum())

    before_error, before_edges = measure(baseline)
    after_error, after_edges = measure(candidate)
    parts = [ndi.label(candidate == i)[1] for i in range(1, len(threads) + 1)]
    use_candidate = (all(parts) and sum(parts) <= 450 and before_error - after_error >= .75
                     and after_edges - before_edges >= max(1, .05 * edge_count))
    return (candidate if use_candidate else baseline), {
        'selected': bool(use_candidate),
        'candidateParts': sum(parts),
        'strongInternalSourceEdges': edge_count,
        'baselineEdgesNearColourBoundary': before_edges,
        'candidateEdgesNearColourBoundary': after_edges,
        'baselineMeanLabError': round(before_error, 3),
        'candidateMeanLabError': round(after_error, 3),
    }
