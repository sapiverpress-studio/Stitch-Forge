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
    examined=0
    truncated=False
    for region in sorted(plan['regions'],key=lambda item:item['color']):
        color=region['color']
        for index,component in enumerate(region['ledger']['components']):
            total+=1
            identity=color[1:]+'-'+str(index)
            area=component['pixelArea']*scale*scale
            if area<12 or len(component['runs'])>2500:
                continue
            # Complex illustrations may contain many fragments. Retain the
            # older engine rather than failing the entire image when a review
            # search budget is reached; never auto-select omitted components.
            if examined>=250 or len(results)>=35:
                truncated=True
                continue
            examined+=1
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
    return {'status':'SOURCE_SATIN_PROPOSALS_REQUIRE_NATIVE_AUDIT',
            'totalSourceComponents':total,
            'reviewedLargeSourceComponents':examined,
            'candidateScanTruncated':truncated,
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


DECISION_SCHEMA = 'stitch-forge-offline-stage-decisions-v1'
BUNDLE_SCHEMA = 'stitch-forge-offline-stage-review-v1'


def accept_review_decisions(review, document):
    """Fail closed unless choice document is bound to this precise source plan."""
    if (not isinstance(document,dict)
            or set(document) != {'schema','sourcePlanSignature','sourceSha256','choices'}
            or document['schema'] != DECISION_SCHEMA
            or document['sourcePlanSignature'] != review['sourcePlanSignature']
            or document['sourceSha256'] != review['sourceSha256']
            or not isinstance(document['choices'],list)
            or len(document['choices'])>35):
        raise ValueError('Staged decisions do not match the reviewed source')
    chosen={}
    for item in document['choices']:
        if (not isinstance(item,dict) or set(item) != {'sourceObjectId','method'}
                or not isinstance(item['sourceObjectId'],str)
                or not isinstance(item['method'],str)
                or item['sourceObjectId'] in chosen):
            raise ValueError('Invalid or duplicated staged object choice')
        chosen[item['sourceObjectId']] = item['method']
    return validate_stage_choices(review,chosen)


def make_review_bundle(review, stages):
    """One lightweight data-only handoff to a local-only mobile reviewer."""
    if (not isinstance(stages,dict) or set(stages) != {'tatami','satin','running'}
            or any(type(value)!=int or value<0 or value>1500 for value in stages.values())):
        raise ValueError('Invalid stage inventory')
    return {'schema':BUNDLE_SCHEMA,
            'sourcePlanSignature':review['sourcePlanSignature'],
            'sourceSha256':review['sourceSha256'],
            'counts':dict(stages),
            'candidates':review['candidates'],
            'candidateScanTruncated':review['candidateScanTruncated'],
            'dataOnly':True,
            'originalImageIncluded':False,
            'machineApproved':False,
            'notes':'Curved satin selection is geometry only. Real native and fabric validation still required.'}
