"""Opt-in source texture angle proposals for native tatami trials (MD-2.68).

Only rotates the fill direction of an existing, source-verified *working colour*
component when actual interior luminance gradients consistently support one
direction. It never introduces an extra object, path, colour or stitch. Weak
texture, outlines, small marks, leaves with crossing veins and ambiguous
source image regions retain the existing geometric-angle planner.

Optical gradient coherence is not semantic feather identification or evidence
of good physical embroidery. Independent decoded PES/DST audit still applies.
"""
from __future__ import annotations

from math import atan2, degrees, hypot
import numpy as np
from scipy.ndimage import binary_erosion, gaussian_filter, label, sobel
from skimage.color import rgb2lab


def texture_fill_candidates(source_rgba, colour_labels, palette, *, mm_per_pixel,
                            min_area_mm2=6., min_core_pixels=55,
                            min_coherence=.72, min_gradient_energy=6.):
    """Return {native_source_component_id: evidence} for opt-in fill angle.

    `colour_labels` uses 0 for the independently verified source background
    and 1..len(palette) for a sorted colour palette; connected components
    use the same scipy.ndimage.label scan order as artwork_packet.regions_from_labels.
    Angle is in the standard screen-to-SVG axis orientation (-image tangent).
    """
    if (not isinstance(source_rgba,np.ndarray) or source_rgba.dtype!=np.uint8
            or source_rgba.ndim!=3 or source_rgba.shape[2]!=4
            or not isinstance(colour_labels,np.ndarray)
            or colour_labels.dtype!=np.uint8
            or colour_labels.shape!=source_rgba.shape[:2]
            or not isinstance(palette,list) or not 1<=len(palette)<=12
            or any(not isinstance(c,str) or len(c)!=7 or not c.startswith('#')
                   or any(ch not in '0123456789ABCDEF' for ch in c[1:]) for c in palette)
            or any(palette[i]>=palette[i+1] for i in range(len(palette)-1))
            or np.any(colour_labels>len(palette))
            or not np.isfinite(mm_per_pixel) or not .02<=mm_per_pixel<=5.
            or not 1<=min_area_mm2<=30 or not 30<=min_core_pixels<=400
            or not .6<=min_coherence<=.95
            or not 2<=min_gradient_energy<=60):
        raise ValueError('Invalid bounded source-direction inputs')
    if len(colour_labels)>800 or colour_labels.size>750000:
        raise ValueError('Source-direction input exceeds worker geometry budget')

    lab_L = rgb2lab(source_rgba[:,:,:3].astype(np.float32)/255)[:,:,0]
    smoothed = gaussian_filter(lab_L,sigma=.8)
    dx = sobel(smoothed,axis=1)/8
    dy = sobel(smoothed,axis=0)/8
    out={}
    for i,colour in enumerate(palette,1):
        components,n = label(colour_labels==i)
        for j in range(1,n+1):
            region=(components==j)
            pixels=int(region.sum())
            if pixels * mm_per_pixel**2 < min_area_mm2:
                continue
            core=binary_erosion(region,iterations=2)
            core_count=int(core.sum())
            if core_count<min_core_pixels:
                continue
            gx=dx[core];gy=dy[core]
            energy=gx*gx+gy*gy
            # Suppress low-frequency fill tone gradients. Require genuine
            # coherent *interior* luminance structure, not silhouette edges.
            threshold=max(float(np.percentile(energy,50)),min_gradient_energy)
            active=energy>=threshold
            if int(active.sum())<min_core_pixels:
                continue
            gx=gx[active];gy=gy[active]
            ex=float(np.sum(gx*gx));ey=float(np.sum(gy*gy))
            cross=float(np.sum(gx*gy))
            total=ex+ey
            average=total/max(1,int(active.sum()))
            if average<min_gradient_energy:
                continue
            coherence=hypot(ex-ey,2*cross)/total if total else 0.
            if coherence<min_coherence:
                continue
            # Gradient is orthogonal to the local stripe/feather texture.
            # Reverse image y axis to follow native Ink/Stitch angle convention.
            tangent=(.5*degrees(atan2(2*cross,ex-ey))+90.)%180.
            native_angle=int(round((-tangent)/15.))*15%180
            key=colour[1:]+'-'+str(j-1)
            out[key]={'angleDeg':native_angle,
                      'gradientCoherence':round(coherence,4),
                      'interiorPixels':core_count,
                      'activeGradientPixels':int(active.sum()),
                      'sourceComponentPixels':pixels,
                      'meanGradientEnergy':round(average,4),
                      'method':'bounded_interior_source_luminance_texture'}
    return out
