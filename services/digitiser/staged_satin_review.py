"""Independent satin pass: inspect source-ledger objects before native assembly.

This is NOT a semantic classifier. It offers strictly source-derived geometry
candidates, never guarantees visual coverage or fabric stitch quality. No
engine output is modified until an explicit local candidate is selected.
"""
from __future__ import annotations

from math import isfinite
from shapely import Polygon
from auto_satin_object import propose_straight_satin
from auto_curved_satin_object import propose_curved_satin


def inspect_source_satin_candidates(plan, *, include_curved=True):
    """Return bounded, review-only proposals keyed by original source object ID.

    Original working-palette labels and RLE source components are checked with
    the older independent source-mask validator, not trusted SVG content.
    """
    from artwork_trial import checked_masks  # avoid an import cycle
    _,scale=checked_masks(plan)
    results=[]
    total=0
    for region in sorted(plan['regions'],key=lambda item:item['color']):
        color=region['color']
        for index,component in enumerate(region['ledger']['components']):
            total+=1
            if total>1000:
                raise ValueError('Staged source object budget exceeded')
            identity=color[1:]+'-'+str(index)
            area=component['pixelArea']*scale*scale
            if area<12 or len(component['runs'])>2500:
                continue
            proposal=propose_straight_satin(component,scale,color)
            method='straight'
            if proposal is None and include_curved:
                proposal=propose_curved_satin(component,scale,color)
                method='curved'
            if proposal is None:
                continue
            column,evidence=proposal
            # This estimates proposed satin *area*, NOT actual thread coverage.
            # The path footprint is inset and can leave important edges blank.
            footprint=Polygon([*column.left,*reversed(column.right)])
            if not footprint.is_valid or footprint.is_empty:
                raise ValueError('Staged satin geometry is invalid')
            fraction=footprint.area/area
            if not isfinite(fraction) or fraction<=0 or fraction>1.001:
                raise ValueError('Staged satin footprint exceeds source')
            results.append({
                'sourceObjectId':identity,
                'method':method,
                'color':color,
                'physicalAreaMm2':round(area,3),
                'estimatedFootprintAreaFraction':round(fraction,4),
                'sourceGeometryStrictlyContained':True,
                'originalWorkingPixelsChanged':False,
                'semanticDetailIdentified':False,
                'nativePESDSTGenerated':False,
                'fabricSewoutVerified':False,
                'evidence':evidence
            })
            if len(results)>35:
                raise ValueError('Staged satin proposal budget exceeded')
    return {'status':'SOURCE_SATIN_PROPOSALS_REQUIRE_NATIVE_AUDIT',
            'sourcePlanSignature':plan['sourcePlanSignature'],
            'sourceSha256':plan['source']['sha256'],
            'scaleMmPerPixel':scale,
            'candidateCount':len(results),
            'candidates':results,
            'limitations':['Area fraction is a geometry proxy, not stitched coverage or likeness.',
                           'Source-detail semantics and real-fabric quality remain unverified.']}


def validate_stage_choices(review, selections):
    """Accept only explicit ID:method pairs from the same reviewed source."""
    if not isinstance(selections,dict) or len(selections)>35:
        raise ValueError('Invalid staged satin selections')
    allowed={c['sourceObjectId']:c['method'] for c in review['candidates']}
    if any(not isinstance(k,str) or k not in allowed or method!=allowed[k]
           for k,method in selections.items()):
        raise ValueError('Staged satin choice is not supported by this original source')
    return dict(sorted(selections.items()))
