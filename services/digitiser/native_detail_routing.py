"""Non-destructive, bounded routing for contiguous same-colour running details.

The native paths originate from the source pixel ledger. Each object's ID,
attributes, original points, order within its own path and source colour are
unchanged. Only interior objects of a contiguous compatible running-stitch
group may change position. The original first/last objects remain anchored,
so neighbouring fill/colour boundaries stay in exactly the same place.
No external code is copied. This is a geometric pen-up proxy, not a promise
about actual machine trims, tissue/fabric behaviour or semantic likeness.
"""
import math
import re

_NUM=r'[-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)'
_PAIR=re.compile(r'('+_NUM+r'),('+_NUM+r')')
_COMMAND=re.compile(r'\\s*M\\s+P(?:\\s+L\\s+P)+\\s*')


def _points(node):
    if (node.tag.rsplit('}',1)[-1]!='path' or
            node.get('fill')!='none' or
            not node.get('stroke') or
            node.get('{http://inkstitch.org/namespace}stroke_method')!='running_stitch'):
        return None
    d=node.get('d','')
    if len(d)>20000:return None
    pairs=_PAIR.findall(d)
    if not 2<=len(pairs)<=320:return None
    if not _COMMAND.fullmatch(_PAIR.sub('P',d)):return None
    pts=[(float(x),float(y)) for x,y in pairs]
    if not all(math.isfinite(c) for pt in pts for c in pt):return None
    return pts


def _style(node):
    return tuple(sorted((k,v) for k,v in node.attrib.items() if k not in ('id','d')))


def _distance(a,b):
    return math.hypot(a[0]-b[0],a[1]-b[1])


def _pen_up(points):
    return sum(_distance(a[-1],b[0]) for a,b in zip(points,points[1:]))


def _close_pairs(points,threshold):
    return sum(_distance(a[-1],b[0]) <= threshold+1e-9
               for a,b in zip(points,points[1:]))


def optimise_running_groups(root, *, max_group=120,
                            max_compound_gap_mm=1.5,
                            min_gain_mm=.1):
    """Only reorder whole running paths INSIDE one unbroken compatible group.

    The strict acceptance policy refuses a change unless geometrical pen-up
    decreases and the number of group-adjacent <=1.5mm connections does not
    fall. No path is reversed, trimmed, joined, suppressed or re-coloured.
    """
    if (not isinstance(max_group,int) or isinstance(max_group,bool) or
            not 4<=max_group<=120 or
            not isinstance(max_compound_gap_mm,(int,float)) or
            isinstance(max_compound_gap_mm,bool) or not math.isfinite(max_compound_gap_mm) or
            not 0<max_compound_gap_mm<=2 or
            not isinstance(min_gain_mm,(int,float)) or
            isinstance(min_gain_mm,bool) or not math.isfinite(min_gain_mm) or
            not 0<min_gain_mm<=1):
        raise ValueError('Running route plan outside bounded native limits')
    children=list(root)
    attempted=accepted=modified=0
    baseline=planned=0.
    close_before=close_after=0
    i=0
    while i<len(children):
        first=children[i];points=_points(first)
        if points is None:
            i+=1
            continue
        style=_style(first)
        j=i+1;group=[first];tracks=[points]
        while j<len(children) and len(group)<=max_group:
            other=children[j];pts=_points(other)
            if pts is None or _style(other)!=style:
                break
            group.append(other);tracks.append(pts);j+=1
        if 4<=len(group)<=max_group:
            attempted+=1
            old_cost=_pen_up(tracks)
            old_near=_close_pairs(tracks,max_compound_gap_mm)
            # Keep first and last anchored: avoid changing neighbouring
            # colour/fill transition entry/exit behaviour.
            pending=set(range(1,len(tracks)-1))
            order=[0]
            while pending:
                end=tracks[order[-1]][-1]
                chosen=min(pending,key=lambda k:(_distance(end,tracks[k][0]),k))
                order.append(chosen)
                pending.remove(chosen)
            order.append(len(tracks)-1)
            proposal=[tracks[k] for k in order]
            new_cost=_pen_up(proposal)
            new_near=_close_pairs(proposal,max_compound_gap_mm)
            if new_cost + min_gain_mm < old_cost and new_near>=old_near:
                children[i:j]=[group[k] for k in order]
                modified+=sum(k!=actual for actual,k in enumerate(order))
                accepted+=1
                planned+=new_cost
                close_after+=new_near
            else:
                planned+=old_cost
                close_after+=old_near
            baseline+=old_cost;close_before+=old_near
        i=max(j,i+1)
    root[:]=children
    return {
        'strategy':'anchored_original_running_detail_reordering',
        'evaluatedGroups':attempted,
        'acceptedGroups':accepted,
        'movedObjects':modified,
        'baselinePenUpProxyMm':round(baseline,4),
        'plannedPenUpProxyMm':round(planned,4),
        'estimatedPenUpSavingMm':round(max(0.,baseline-planned),4),
        'nearConnectionsBefore':close_before,
        'nearConnectionsAfter':close_after,
        'unchangedInternalStitchOrder':True,
        'unchangedFillOrColourBoundaries':True,
        'sourcePixelLedgerChanged':False,
        'sourceDetailOmitted':False,
        'nativeStitchCountsVerified':False,
        'machineSewoutVerified':False,
    }
