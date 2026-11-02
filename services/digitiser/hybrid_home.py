"""MD-2.66 isolated Home-mode colour-shape reconstruction (NOT stitches).

Hybrid: scikit-image SLIC for spatial coherence; deterministic CIELAB palette
clustering; scipy connected-component auditing; optional compact-mark protection;
existing Ink/Stitch worker remains the independent native stitch generator.

This is deliberately NOT called by the live 2-phase worker. It neither signs
nor changes an artwork packet and cannot claim physical embroidery quality.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import label as connected_label
from skimage.color import rgb2lab, lab2rgb, rgb2gray
from skimage.segmentation import slic
from skimage.filters import gaussian
from skimage.feature import blob_log
from skimage.measure import find_contours
from source_detail_guard import protect_candidates


def deterministic_palette(pixels, colours, iterations=20):
    """Bounded deterministic k-means initialised with farthest CIELAB points."""
    if len(pixels) < colours:
        raise ValueError('Not enough foreground pixels for requested palette')
    start = int(np.argmin(np.linalg.norm(pixels - pixels.mean(axis=0), axis=1)))
    chosen = [start]
    distances = np.sum((pixels - pixels[start])**2, axis=1)
    for _ in range(1, colours):
        index = int(np.argmax(distances))
        chosen.append(index)
        distances = np.minimum(distances, np.sum((pixels - pixels[index])**2, axis=1))
    centres = pixels[chosen].astype(float)
    for _ in range(iterations):
        labels = np.argmin(np.sum((pixels[:, None, :] - centres[None, :, :])**2, axis=2), axis=1)
        newer = np.array([pixels[labels == i].mean(axis=0) if np.any(labels == i) else centres[i] for i in range(colours)])
        if np.max(abs(newer - centres)) < .08:
            break
        centres = newer
    return centres


def count_components(labels, foreground, colour_count):
    return sum(connected_label((labels == i) & foreground)[1] for i in range(colour_count))


def proposal_svg(labels, palette):
    """Visual-only vector candidate. Even-odd paths retain detached islands/holes."""
    h, w = labels.shape
    paths = []
    for i, rgb in enumerate(palette, 1):
        rings = find_contours(np.pad((labels == i).astype(np.uint8), 1), .5)
        parts = []
        for ring in rings:
            if len(ring) < 4:
                continue
            coords = [(float(x) - 1, float(y) - 1) for y, x in ring]
            segments = [f'M {coords[0][0]:.2f} {coords[0][1]:.2f}']
            segments.extend(f'L {x:.2f} {y:.2f}' for x, y in coords[1:])
            parts.append(' '.join(segments) + ' Z')
        if parts:
            colour = '#' + ''.join(f'{int(n):02X}' for n in rgb)
            paths.append('<path fill="' + colour + '" fill-rule="evenodd" d="' + ' '.join(parts) + '"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="' + str(w) + '" height="' + str(h) +
            '" viewBox="0 0 ' + str(w) + ' ' + str(h) +
            '"><title>Home colour reconstruction proposal - NOT machine embroidery</title>' +
            ''.join(paths) + '</svg>')


def reconstruct(image, *, colours=9, max_side=320, superpixels=460,
                design_width_mm=80, min_area_mm2=.035):
    """Returns proposed colour labels/palette and evidence, not a machine-ready plan.

    Preserves exactly the foreground of the resized RGBA input; changes its
    *working* colour partition. Original RGB source remains separately required.
    """
    if not isinstance(colours, int) or not 4 <= colours <= 12:
        raise ValueError('Home palette must have 4-12 colours')
    if not 80 <= max_side <= 640 or not 80 <= superpixels <= 1500:
        raise ValueError('Hybrid working-resolution budget exceeded')
    if not 10 <= design_width_mm <= 250 or not .005 <= min_area_mm2 <= .1:
        raise ValueError('Invalid physical profile constraints')
    original = image.convert('RGBA')
    factor = min(1., max_side / max(original.size))
    size = tuple(max(48, int(round(d * factor))) for d in original.size)
    if size[0] * size[1] > 640 * 640:
        raise ValueError('Working image exceeds hybrid budget')
    reduced = original.resize(size, Image.Resampling.LANCZOS)
    rgba = np.asarray(reduced, dtype=np.uint8)
    h, w = rgba.shape[:2]
    foreground = rgba[:, :, 3] > 60
    if not foreground.any() or foreground.mean() > .98:
        raise ValueError('Expected isolated foreground PNG: no verified alpha/background mask')
    rgb = rgba[:, :, :3].astype(np.float32) / 255
    lab = rgb2lab(rgb)
    segments = slic(rgb, n_segments=superpixels, compactness=9, sigma=.55,
                    mask=foreground, convert2lab=True, start_label=1,
                    enforce_connectivity=True, channel_axis=-1)
    samples = lab[foreground]
    centres = deterministic_palette(samples[::max(1, len(samples)//16000)], colours)
    labels = np.full((h, w), 255, dtype=np.uint8)
    for region in np.unique(segments[foreground]):
        area = (segments == region) & foreground
        median = np.median(lab[area], axis=0)
        labels[area] = int(np.argmin(np.sum((centres - median)**2, axis=1)))
    width_pixels = max(1, int(np.ptp(np.where(foreground)[1]) + 1))
    mm_per_pixel = design_width_mm / width_pixels
    min_pixels = max(1, round(min_area_mm2 / (mm_per_pixel**2)))
    # One bounded merge pass, never smoothing through a strong palette edge.
    for colour in range(colours):
        ids, n = connected_label((labels == colour) & foreground)
        sizes = np.bincount(ids.ravel())
        for part in range(1, n + 1):
            if sizes[part] >= min_pixels:
                continue
            rows, cols = np.where(ids == part)
            if not len(rows):
                continue
            y0, y1 = max(0, int(rows.min())-1), min(h, int(rows.max())+2)
            x0, x1 = max(0, int(cols.min())-1), min(w, int(cols.max())+2)
            neighbours = labels[y0:y1, x0:x1]
            others = neighbours[(neighbours != colour) & (neighbours != 255)]
            if not len(others):
                continue
            choices, counts = np.unique(others, return_counts=True)
            target = int(choices[np.argmax(counts)])
            if np.linalg.norm(centres[colour] - centres[target]) <= 30:
                labels[ids == part] = target
    grey = rgb2gray(rgb)
    proposed = []
    for cy, cx, sigma in blob_log((1-grey)*foreground, min_sigma=3,
                                  max_sigma=6, num_sigma=5, threshold=.09, overlap=.4):
        y, x = int(round(cy)), int(round(cx))
        radius = int(round(sigma*2.2))
        y0, y1 = max(0,y-radius), min(h,y+radius+1)
        x0, x1 = max(0,x-radius), min(w,x+radius+1)
        yy, xx = np.ogrid[y0:y1,x0:x1]
        distance = np.hypot(yy-y,xx-x)
        subfg = foreground[y0:y1,x0:x1]
        core = (distance <= sigma*.7) & subfg
        ring = (distance >= sigma*1.4) & (distance < sigma*2.2) & subfg
        if core.sum() < 4 or ring.sum() < 8:
            continue
        subgray = grey[y0:y1,x0:x1]
        darkness = float(subgray[core].mean())
        contrast = float(subgray[ring].mean() - darkness)
        if contrast > .20 and darkness < .20 and sigma >= 3.5:
            proposed.append((contrast*(.3-darkness), y, x, sigma))
    proposed.sort(reverse=True)
    # Previous prototype painted dark circular disks into candidate locations.
    # This source-grounded guard instead reassigns individual *real source
    # pixels* only when an existing palette colour is objectively closer.
    labels, detail_evidence = protect_candidates(labels, lab, foreground, centres, proposed)
    # This comparison uses *the same nine-colour palette* without superpixels.
    raw = np.full((h,w),255,dtype=np.uint8)
    raw[foreground] = np.argmin(np.sum((lab[foreground,None,:]-centres[None,:,:])**2,axis=2),axis=1)
    used = np.unique(labels[foreground])
    image_labels = np.zeros((h,w),dtype=np.uint8)
    for index, colour in enumerate(used,1):
        image_labels[labels==colour]=index
    palette = np.clip(lab2rgb(centres[used].reshape(1,len(used),3))[0]*255,0,255).astype(np.uint8)
    delta = np.linalg.norm(lab[foreground]-centres[labels[foreground]],axis=1)
    baseline_count = count_components(raw,foreground,colours)
    new_count = count_components(labels,foreground,colours)
    evidence = {
        'schema':'stitch-forge-home-hybrid-candidate-v1',
        'workingWidth':w,'workingHeight':h,
        'originalForegroundPixels':int(foreground.sum()),
        'foregroundPreserved':bool(np.array_equal(image_labels>0,foreground)),
        'paletteColours':int(len(used)),'requestedColours':colours,
        'directPaletteComponents':int(baseline_count),
        'hybridComponents':int(new_count),
        'objectReductionFraction':float(1-new_count/max(1,baseline_count)),
        'meanLabColourError':float(delta.mean()),
        'p95LabColourError':float(np.percentile(delta,95)),
        'smallObjectThresholdPixels':int(min_pixels),
        'geometricDarkMarksProposed':len(proposed),
        'geometricDarkMarksPreserved':detail_evidence['sourceSupportedDetailRegions'],
        'detailRefinement':detail_evidence,
        'detailReleaseGate':'HOLD_LIKENESS_AND_NATIVE_EXPORT_NOT_VERIFIED',
        'semanticsVerified':False,
        'nativeFileGenerated':False,
        'physicallyStitched':False
    }
    return image_labels,palette,evidence


def save_candidate(image_file, destination, *, colours=9):
    destination = Path(destination)
    destination.mkdir(parents=True,exist_ok=True)
    labels,palette,evidence = reconstruct(Image.open(image_file),colours=colours)
    preview = np.zeros((*labels.shape,4),dtype=np.uint8)
    for i,colour in enumerate(palette,1):
        preview[labels==i,:3] = colour
    preview[labels>0,3] = 255
    Image.fromarray(preview,'RGBA').save(destination/'home-hybrid-colour-preview.png')
    (destination/'home-hybrid-proposal.svg').write_text(proposal_svg(labels,palette),encoding='utf-8')
    (destination/'home-hybrid-evidence.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    return evidence


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Offline shape candidate; NOT machine embroidery')
    parser.add_argument('source_image')
    parser.add_argument('output_directory')
    parser.add_argument('--colours',type=int,default=9)
    args=parser.parse_args()
    print(json.dumps(save_candidate(args.source_image,args.output_directory,colours=args.colours),indent=2))
