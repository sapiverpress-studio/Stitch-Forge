"""Original-PNG colour calibration while holding ALL native geometry fixed.

This deliberately changes only thread RGB proposals, never source foreground,
component labels, mask ownership, stitch type, direction or physical size.
It cannot fix missing eyes/feathers; it is a bounded visual-colour experiment.
"""
from __future__ import annotations
import numpy as np
from PIL import Image


def refit_palette_from_original(original_rgba: np.ndarray, reduced_rgba: np.ndarray,
                                labels: np.ndarray, palette,
                                *, min_error_drop=.75, max_colour_shift=60):
    if (not isinstance(original_rgba,np.ndarray) or original_rgba.dtype!=np.uint8
            or original_rgba.ndim!=3 or original_rgba.shape[2]!=4
            or original_rgba.size>48000000
            or not isinstance(reduced_rgba,np.ndarray) or reduced_rgba.dtype!=np.uint8
            or reduced_rgba.ndim!=3 or reduced_rgba.shape[2]!=4
            or not isinstance(labels,np.ndarray) or labels.dtype!=np.uint8
            or labels.shape!=reduced_rgba.shape[:2]
            or not isinstance(palette,(list, np.ndarray))
            or not 1<=len(palette)<=12):
        raise ValueError('Invalid original-source palette evidence')
    colour=np.asarray(palette,dtype=np.float64)
    if colour.shape!=(len(palette),3) or np.any(colour<0) or np.any(colour>255):
        raise ValueError('Invalid source palette')
    if np.any(labels>len(colour)):
        raise ValueError('Palette labels out of bounds')
    used=labels>0
    if used.sum()<100 or np.unique(labels[used]).size!=len(colour):
        raise ValueError('Palette labels do not cover each source colour')
    # Map existing labels UP to the original's full pixel grid, preserving
    # the exact lower-resolution source/component ownership.
    oh,ow=original_rgba.shape[:2]
    large=np.asarray(Image.fromarray(labels,'L').resize((ow,oh),
                        Image.Resampling.NEAREST),dtype=np.uint8)
    original_rgb=original_rgba[:,:,:3]
    sampled=[]
    for index in range(len(colour)):
        region=(large==index+1)&(original_rgba[:,:,3]>220)
        pts=original_rgb[region].astype(np.float64)
        if len(pts)<40:
            sampled.append(colour[index]);continue
        pts=pts[::max(1,len(pts)//7000)]
        # Euclidean geometric median minimises mean RGB colour error rather
        # than mean-squared distance, avoiding wild thread hues in textured art.
        center=np.median(pts,axis=0)
        for _ in range(12):
            distances=np.maximum(np.linalg.norm(pts-center,axis=1),1.)
            weights=1/distances
            center=(pts*weights[:,None]).sum(axis=0)/weights.sum()
        sampled.append(np.clip(np.rint(center),0,255))
    candidate=np.asarray(sampled,dtype=np.float64)
    source=reduced_rgba[:,:,:3][used].astype(np.float64)
    old_colours=colour[labels[used]-1]
    new_colours=candidate[labels[used]-1]
    before=float(np.linalg.norm(source-old_colours,axis=1).mean())
    after=float(np.linalg.norm(source-new_colours,axis=1).mean())
    shifts=np.linalg.norm(candidate-colour,axis=1)
    distinct=min((float(np.linalg.norm(a-b)) for i,a in enumerate(candidate)
                  for b in candidate[i+1:]),default=255.)
    changed=bool(
        before-after>=min_error_drop
        and np.max(shifts)<=max_colour_shift
        and distinct>=16
        and all((large==i+1).any() for i in range(len(colour))))
    chosen=candidate.astype(np.uint8) if changed else colour.astype(np.uint8)
    return chosen, {
        'trialEnabled':True,'selectedByErrorAndPaletteGuard':changed,
        'sameOriginalWorkingColourComponents':True,
        'workingShapeGeometryChanged':False,'paletteEntriesChanged':int(
            np.count_nonzero(np.any(chosen!=colour.astype(np.uint8),axis=1))),
        'meanRgbDistanceBefore':round(before,4),
        'meanRgbDistanceCandidate':round(after,4),
        'meanRgbDistanceSelected':round(after if changed else before,4),
        'maxThreadRgbShiftCandidate':round(float(shifts.max()),3),
        'smallestCandidateColourSeparation':round(distinct,3),
        'physicalSewoutVerified':False,
        'machineApproved':False
    }
