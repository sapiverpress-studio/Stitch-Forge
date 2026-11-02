"""Source-edge-supported compact feature recovery for Home mode (not native stitches).

A feature proposal may activate local pixel-to-existing-palette reassignment.
No geometric object is painted: every changed colour must reduce error against
the original source, improve its measured edge representation and stay within
a component budget. Automatically HOLD features that do not meet every gate.
"""
import numpy as np
from scipy.ndimage import gaussian_filter, maximum_filter, label
from skimage.color import rgb2gray
from skimage.feature import canny


def recover_compact_details(labels, source_lab, source_rgb, foreground, centres,
                            proposals, *, max_added_components=48, max_changed=640):
    if (not isinstance(labels, np.ndarray) or labels.dtype!=np.uint8
            or labels.shape!=foreground.shape or
            source_lab.shape!=(*labels.shape,3) or source_rgb.shape!=(*labels.shape,3)
            or centres.ndim!=2 or centres.shape[1]!=3 or not 1<=len(centres)<=12
            or not np.all(labels[~foreground]==255)
            or not np.all(labels[foreground]<len(centres))
            or not isinstance(proposals,list) or len(proposals)>100
            or not 0<=max_changed<=2000 or not 0<=max_added_components<=150):
        raise ValueError('Invalid source-supported feature inputs')
    edges=canny(rgb2gray(source_rgb),sigma=.9,mask=foreground)
    def edge_recall(result,zone):
        boundary=np.zeros(result.shape,dtype=bool)
        boundary[:,1:]|=(result[:,1:]!=result[:,:-1])&foreground[:,1:]&foreground[:,:-1]
        boundary[1:,:]|=(result[1:,:]!=result[:-1,:])&foreground[1:,:]&foreground[:-1,:]
        near=maximum_filter(boundary,size=3)
        src=edges&zone
        total=int(src.sum())
        return int((src&near).sum())/total if total>=8 else None
    def component_count(result):
        return sum(label((result==c)&foreground)[1] for c in range(len(centres)))
    refined=labels.copy()
    smoothed=gaussian_filter(source_lab,sigma=(.38,.38,0))
    modified=0
    added_total=0
    accepted=[]
    rejected=[]
    for score,cy,cx,sigma in sorted(proposals,reverse=True)[:12]:
        if (not all(np.isfinite(v) for v in (score,cy,cx,sigma))
                or not 2<=sigma<=8 or not 0<=cy<labels.shape[0]
                or not 0<=cx<labels.shape[1]):
            raise ValueError('Invalid compact-source feature proposal')
        radius=int(np.ceil(sigma*2))
        y0,y1=max(0,int(cy)-radius),min(labels.shape[0],int(cy)+radius+1)
        x0,x1=max(0,int(cx)-radius),min(labels.shape[1],int(cx)+radius+1)
        ys,xs=np.ogrid[y0:y1,x0:x1]
        patch=(np.hypot(ys-cy,xs-cx)<=sigma*1.9)&foreground[y0:y1,x0:x1]
        if patch.sum()<8:continue
        zone=np.zeros_like(foreground)
        zone[y0:y1,x0:x1]=patch
        before_recall=edge_recall(refined,zone)
        if before_recall is None or before_recall>=.82:
            rejected.append('no_source_edges_or_already_retained')
            continue
        lab_error=((smoothed[y0:y1,x0:x1,None,:]-centres[None,None,:,:])**2).sum(axis=-1)
        nearest=lab_error.argmin(axis=2).astype(np.uint8)
        old=refined[y0:y1,x0:x1]
        rr=np.arange(y1-y0)[:,None]
        cc=np.arange(x1-x0)[None,:]
        old_error=lab_error[rr,cc,old.clip(0,len(centres)-1)]
        next_error=lab_error[rr,cc,nearest]
        eligible=patch&(old!=nearest)&(old_error>next_error+25)
        changes=int(eligible.sum())
        if changes<3 or changes>min(180,max_changed-modified):
            rejected.append('colour_pixel_budget')
            continue
        candidate=refined.copy()
        candidate[y0:y1,x0:x1][eligible]=nearest[eligible]
        improved=edge_recall(candidate,zone)
        if improved is None or improved-before_recall<.13 or improved<.66:
            rejected.append('source_edge_gain_insufficient')
            continue
        added=component_count(candidate)-component_count(refined)
        if added>38 or added_total+added>max_added_components:
            rejected.append('colour_component_budget')
            continue
        refined=candidate
        modified+=changes
        added_total+=added
        accepted.append({'sourceX':int(cx),'sourceY':int(cy),
                         'edgeRecallBefore':round(before_recall,3),
                         'edgeRecallAfter':round(improved,3),
                         'changedPixels':changes,'additionalComponents':added})
    return refined, {
        'algorithm':'source-anchored-compact-edge-refinement-v1',
        'changedPixels':modified,
        'addedConnectedComponents':added_total,
        'acceptedSourceFeatures':accepted,
        'rejectedCandidateCount':len(rejected),
        'rejectionReasons':rejected,
        'preservedForeground':bool(np.array_equal(refined!=255,foreground)),
        'newThreadColoursCreated':False,
        'semanticFeatureIdentityVerified':False,
        'nativeStitchQualityVerified':False
    }
