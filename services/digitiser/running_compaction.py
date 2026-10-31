"""Opt-in, source-preserving grouping of nearby native running stitch SVG objects.

This changes only the SVG *container* for the same M/L paths; each disconnected
subpath retains its own M command. Ink/Stitch can jump between subpaths.
No stitch safety or physical sewout claims are implied.
"""
from math import hypot
import re

_PAIR = re.compile(r'(?<![0-9.])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)')

def _endpoints(d):
    if not isinstance(d, str) or not d or any(x in d.upper() for x in ('Z','C','Q','H','V','A','S','T')):
        return None
    points = _PAIR.findall(d)
    if len(points) < 2 or d.count('M') != 1:
        return None
    return tuple(map(float,points[0])),tuple(map(float,points[-1]))

def consolidate_running_elements(root, max_transfer_mm=1.5, max_subpaths=10):
    """Group neighbouring same-colour running paths; do not join with sewn line.

    Never change path order, fill object, source raster, stitch parameters or
    colour. Only paths with equal Ink/Stitch settings and a bounded geometric
    travel gap are grouped. Every constituent still starts with its own M.
    """
    if not (0 < max_transfer_mm <= 2 and 2 <= max_subpaths <= 12):
        raise ValueError('Running compaction trial outside its bounded settings')
    primary = end = None
    members = removed = grouped = 0
    for element in list(root):
        if (element.tag.rsplit('}',1)[-1] != 'path' or
                element.get('fill') != 'none' or not element.get('stroke')):
            primary=end=None;members=0
            continue
        endpoints=_endpoints(element.get('d'))
        if endpoints is None:
            primary=end=None;members=0
            continue
        start,last=endpoints
        attrs={k:v for k,v in element.attrib.items() if k not in ('id','d')}
        if (primary is not None and members < max_subpaths and
                attrs == {k:v for k,v in primary.attrib.items() if k not in ('id','d')} and
                hypot(end[0]-start[0],end[1]-start[1]) <= max_transfer_mm):
            primary.set('d',primary.get('d')+' '+element.get('d'))
            root.remove(element)
            if members==1:grouped+=1
            members+=1;removed+=1;end=last
        else:
            primary,end,members=element,last,1
    return {'sourceRunningCandidatesMerged':removed,
            'compoundRunningElements':grouped,
            'maxCompoundSubpaths':max_subpaths,
            'maxConsecutiveTransferMm':max_transfer_mm,
            'colourPixelsReassigned':0,
            'sourceGeometryChanged':False,
            'machineQualityVerified':False}
