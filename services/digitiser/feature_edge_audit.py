"""Conservative source-edge retention gate for compact artwork details.

Measures whether high-contrast source contours survive as *colour region*
boundaries, with one-pixel tolerance. It cannot recognise an eye, prove
semantic likeness, validate needle paths or substitute for physical sewing.
"""
import numpy as np
from scipy.ndimage import maximum_filter
from skimage.color import rgb2gray
from skimage.feature import canny


def audit_compact_edges(rgb, foreground, labels, candidates):
    if (not isinstance(labels,np.ndarray) or not isinstance(foreground,np.ndarray)
            or not isinstance(rgb,np.ndarray) or labels.shape != foreground.shape
            or rgb.shape != (*foreground.shape,3)
            or not np.all(labels[~foreground] == 255)):
        raise ValueError('Invalid compact feature audit source')
    edges=canny(rgb2gray(rgb),sigma=.9,mask=foreground)
    boundary=np.zeros(labels.shape,dtype=bool)
    horizontal=(labels[:,1:]!=labels[:,:-1])&foreground[:,1:]&foreground[:,:-1]
    vertical=(labels[1:,:]!=labels[:-1,:])&foreground[1:,:]&foreground[:-1,:]
    boundary[:,1:]|=horizontal
    boundary[1:,:]|=vertical
    nearby=maximum_filter(boundary,size=3)
    results=[]
    for _,cy,cx,sigma in candidates[:12]:
        if (not np.isfinite(cy) or not np.isfinite(cx) or not np.isfinite(sigma)
                or not 2<=sigma<=8 or not 0<=cy<labels.shape[0]
                or not 0<=cx<labels.shape[1]):
            raise ValueError('Invalid compact feature candidate')
        radius=int(np.ceil(sigma*1.5))
        y0=max(0,int(cy)-radius);y1=min(labels.shape[0],int(cy)+radius+1)
        x0=max(0,int(cx)-radius);x1=min(labels.shape[1],int(cx)+radius+1)
        yy,xx=np.ogrid[y0:y1,x0:x1]
        central=np.hypot(yy-cy,xx-cx)<=sigma*1.4
        source=central&edges[y0:y1,x0:x1]&foreground[y0:y1,x0:x1]
        count=int(source.sum())
        hit=int((source&nearby[y0:y1,x0:x1]).sum())
        if count<8:
            continue
        results.append({'sourceEdgePixels':count,'retainedNearColourBoundary':hit,
                        'recall':round(hit/count,3)})
    strongest=results[0]['recall'] if results else None
    return {'sourceSupportedCandidatesWithEdges':len(results),
            'strongestCompactMarkEdgeRecall':strongest,
            'compactMarkReviewRequired':strongest is None or strongest<.6,
            'featureSemanticsVerified':False,
            'physicalSewoutVerified':False}
