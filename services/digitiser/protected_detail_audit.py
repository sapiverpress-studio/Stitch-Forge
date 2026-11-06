"""MD-2.75: source-bound critical-detail loss audit, never stitch synthesis.

This independent review gate checks whether selected features survive a
resolution/palette preparation step. It cannot identify eyes/feathers or
approve machine density. Only explicit, user-chosen pixel rectangles are
examined. Original artwork never leaves the local trial.
"""
from __future__ import annotations

from hashlib import sha256
from math import isfinite
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, sobel, distance_transform_edt

SCHEMA = 'stitch-forge-protected-detail-audit-v1'
MAX_WINDOWS = 12
MAX_SOURCE_PIXELS = 45_000_000


def load_rgba(png_path):
    raw = Path(png_path).read_bytes()
    if not 50 <= len(raw) <= 45_000_000:
        raise ValueError('Source PNG byte budget exceeded')
    with Image.open(png_path) as file:
        if file.format != 'PNG' or file.width*file.height > MAX_SOURCE_PIXELS:
            raise ValueError('Expected a bounded original PNG')
        pixels = np.asarray(file.convert('RGBA'), dtype=np.uint8)
    return raw, pixels


def _edges(luma, visible):
    # Absolute contrast edge gate, not a self-normalised sharpness score.
    # A feature removed entirely from a prepared raster therefore scores zero.
    values = gaussian_filter(luma.astype(np.float32), sigma=0.65)
    dx = sobel(values, axis=1)/8
    dy = sobel(values, axis=0)/8
    strength = np.hypot(dx,dy)
    return (strength >= 22) & visible


def _luma(rgba):
    return (0.2126*rgba[...,0] + 0.7152*rgba[...,1]
            + 0.0722*rgba[...,2]).astype(np.float32)


def _validate_windows(windows,width,height):
    if not isinstance(windows,list) or not 1<=len(windows)<=MAX_WINDOWS:
        raise ValueError('Invalid protected-detail window count')
    seen=set()
    for item in windows:
        if not isinstance(item,dict) or set(item)!={'id','rect'}:
            raise ValueError('Only bounded source pixel rectangles are accepted')
        name=item['id']
        rect=item['rect']
        if (not isinstance(name,str) or not 1<=len(name)<=32
                or not all(c.isascii() and (c.isalnum() or c in '-_') for c in name)
                or name in seen
                or not isinstance(rect,list) or len(rect)!=4
                or any(type(v)!=int for v in rect)):
            raise ValueError('Invalid protected-detail identifier or geometry')
        x0,y0,x1,y1=rect
        if not (0<=x0<x1<=width and 0<=y0<y1<=height
                and x1-x0>=8 and y1-y0>=8
                and (x1-x0)*(y1-y0)<=500_000):
            raise ValueError('Protected-detail rectangle outside source')
        seen.add(name)


def audit_protected_details(original_png, windows, *, width_mm=80.0,
                            comparison_png=None):
    """Bind original pixels and compare actual resized/palettised raster if supplied.

    Reporting edge coincidence is deliberately a *diagnostic proxy* only:
    neither semantic preservation nor machine-file stitches are established.
    The comparison image must have the same composition and aspect ratio.
    No bounding-box inference is made from source or comparison.
    """
    raw, original=load_rgba(original_png)
    height,width=original.shape[:2]
    if (isinstance(width_mm,bool) or not isinstance(width_mm,(int,float))
            or not isfinite(width_mm) or not 10<=width_mm<=250
            or width_mm*height/width>296):
        raise ValueError('Invalid source physical frame')
    _validate_windows(windows,width,height)
    compared=None
    comparison_sha=None
    if comparison_png is not None:
        cmp_raw, cmp_rgba=load_rgba(comparison_png)
        ch,cw=cmp_rgba.shape[:2]
        if cw>width or ch>height or abs(cw/ch-width/height)>0.012:
            raise ValueError('Comparison raster has incompatible geometry')
        # Nearest resampling keeps already quantised colours unmodified.
        compared=np.asarray(
            Image.fromarray(cmp_rgba, mode='RGBA').resize(
                (width,height),resample=Image.Resampling.NEAREST))
        comparison_sha=sha256(cmp_raw).hexdigest()
    mm_per_pixel=width_mm/width
    measured=[]
    for window in windows:
        x0,y0,x1,y1=window['rect']
        roi=original[y0:y1,x0:x1]
        vis=roi[...,3]>=200
        src=_edges(_luma(roi), vis)
        source_edges=int(src.sum())
        # Avoid claiming that an all-transparent patch contains an eye.
        if not int(vis.sum()) or not source_edges:
            measured.append({'id':window['id'],'rect':window['rect'],
                'sourceEdges':source_edges,'comparisonEdgeRecallAt015Mm':None,
                'status':'NO_MEASURABLE_SOURCE_EDGES'})
            continue
        entry={'id':window['id'],'rect':window['rect'],
            'widthMm':round((x1-x0)*mm_per_pixel,3),
            'heightMm':round((y1-y0)*mm_per_pixel,3),
            'sourceEdges':source_edges,
            'sourceVisiblePixels':int(vis.sum()),
            'comparisonEdgeRecallAt015Mm':None,
            'semanticIdentityVerified':False}
        if compared is not None:
            prepared=compared[y0:y1,x0:x1]
            prepared_edges=_edges(_luma(prepared), (prepared[...,3]>=200)&vis)
            # At 80 mm across 1312px, 0.15mm ~ 2.46 original pixels.
            distance=distance_transform_edt(~prepared_edges)*mm_per_pixel
            matched=int((src & (distance<=.15)).sum())
            entry.update(comparisonEdges=int(prepared_edges.sum()),
                         matchedSourceEdges=matched,
                         comparisonEdgeRecallAt015Mm=round(matched/source_edges,4),
                         contrastLossPossible=matched/source_edges<.5)
        measured.append(entry)
    return {'schema':SCHEMA,'status':'SOURCE_DETAIL_DIAGNOSTIC_NOT_MACHINE_APPROVED',
            'sourcePngSha256':sha256(raw).hexdigest(),
            'comparisonPngSha256':comparison_sha,
            'imageSize':[width,height],
            'requestedWidthMm':width_mm,
            'featureWindows':measured,
            'featureNamesUserSuppliedNotModelInferred':True,
            'sourceOriginalImageIncluded':False,
            'nativePESDSTCompared':False,
            'realFabricSewoutVerified':False,
            'releaseApproval':False,
            'limitations':['Source edges are contrast proxies, not recognised eyes or feathers.',
                'An already reduced image can lose anatomy before stitch selection.',
                'A positive edge score does not demonstrate native needle coverage or appearance.',
                'Comparison must refer to the same uncropped artwork and physical frame.']}
