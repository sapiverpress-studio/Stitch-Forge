"""Experimental, review-only edge contour extraction for internal image features.

This does not generate needle commands, fills, satin rails, or approved stitch paths.
Optionally constrain extraction by manually/AI-proposed normalized bounding boxes.
"""
from __future__ import annotations
from dataclasses import dataclass
import cv2
import numpy as np


@dataclass(frozen=True)
class Guide:
    region: str
    points: tuple[tuple[int,int], ...]
    approximate_length_mm: float


def _chains(edge: np.ndarray, minimum_pixels: float, max_nodes: int = 45000):
    """Return approximate edge contours; they are NOT professional centerlines."""
    if np.count_nonzero(edge) > max_nodes:
        raise ValueError('Edge map too complex for safe review extraction')
    contours, _ = cv2.findContours(edge.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for contour in contours:
        if len(contour) < 3:
            continue
        length = cv2.arcLength(contour, False)
        if length < minimum_pixels:
            continue
        compact = cv2.approxPolyDP(contour, epsilon=1.15, closed=False).reshape((-1,2))
        if len(compact) < 2:
            continue
        paths.append((float(length),tuple((int(x),int(y)) for x,y in compact)))
    return sorted(paths, key=lambda item: -item[0])


def extract_detail_guides(image_bgr: np.ndarray, *, design_width_mm: float,
                          regions: list[dict] | None = None, max_guides: int = 220) -> dict:
    """Trace candidate internal edge guides; does not mutate any embroidery design.

    Each optional region: {id, bbox:{x_min,y_min,x_max,y_max}} with bbox in 0..1000.
    Output point coordinates are image pixels and can be mapped into a reviewed
    vector layer by the editor. Nothing is sent to a machine automatically.
    """
    if (not isinstance(image_bgr,np.ndarray) or image_bgr.ndim!=3 or image_bgr.shape[2]!=3 or
            image_bgr.dtype!=np.uint8):raise ValueError('Expected a decoded 8-bit RGB/BGR image')
    height,width=image_bgr.shape[:2]
    if width<64 or height<64 or width*height>16000000:raise ValueError('Image dimensions unsupported')
    if not 10<=design_width_mm<=250:raise ValueError('Physical design width out of range')
    if not 1<=max_guides<=500:raise ValueError('Guide limit out of range')
    if regions is None:
        regions=[{'id':'whole-image','bbox':{'x_min':0,'y_min':0,'x_max':1000,'y_max':1000}}]
    if not 1<=len(regions)<=24:raise ValueError('Region count out of range')
    gray=cv2.cvtColor(image_bgr,cv2.COLOR_BGR2GRAY)
    blurred=cv2.GaussianBlur(cv2.createCLAHE(clipLimit=1.8,tileGridSize=(8,8)).apply(gray),(3,3),0)
    edges=cv2.Canny(blurred,70,140)
    # Ignore the edge of the foreground/background: we want *internal* feature guides.
    foreground=(gray>35).astype(np.uint8)
    interior=cv2.erode(foreground,np.ones((5,5),np.uint8),iterations=1)
    edges[interior==0]=0
    mm_per_pixel=design_width_mm/width
    result=[]
    per_region_limit=max(8,max_guides//len(regions))
    for region in regions:
        if not isinstance(region,dict) or not isinstance(region.get('id'),str) or len(region['id'])>60:
            raise ValueError('Invalid region id')
        bbox=region.get('bbox')
        if not isinstance(bbox,dict):raise ValueError('Invalid region bounds')
        vals=[bbox.get(k) for k in ('x_min','y_min','x_max','y_max')]
        if not all(isinstance(v,int) and not isinstance(v,bool) and 0<=v<=1000 for v in vals):
            raise ValueError('Region bounds must be normalized integers')
        x0,y0,x1,y1=vals
        if x1<=x0 or y1<=y0:raise ValueError('Empty region box')
        xa=max(0,int(x0*width/1000));xb=min(width,max(xa+1,int(x1*width/1000)))
        ya=max(0,int(y0*height/1000));yb=min(height,max(ya+1,int(y1*height/1000)))
        roi=np.zeros_like(edges,dtype=np.uint8)
        roi[ya:yb,xa:xb]=edges[ya:yb,xa:xb]
        # Extract candidate contours from internal edges; NOT satin rails.
        chains=_chains(roi>0,minimum_pixels=max(7,2.0/mm_per_pixel))
        for length,points in chains[:per_region_limit]:
            result.append(Guide(region['id'],points,round(length*mm_per_pixel,2)))
    result=sorted(result,key=lambda g:-g.approximate_length_mm)[:max_guides]
    return {'status':'REVIEW_GUIDES_NOT_EMBROIDERY','source_pixels':[width,height],
            'approximate_mm_per_pixel':round(mm_per_pixel,4),
            'guides':[{'region':g.region,'points':[list(p) for p in g.points],
                       'approximate_length_mm':g.approximate_length_mm} for g in result],
            'warnings':['Image edges are not satin rails, fill regions or verified stitches.',
                        'Many natural textures must be simplified and manually approved.',
                        'Do not export detected guides as production embroidery.']}
