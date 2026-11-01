"""Source-first, bounded, multi-method native repair selection.

Uses the existing sectioned genuine tatami and original intact tatami tools,
not a colour-dropping or running-skeleton fallback. Independent native stitch
audits determine success. No image-specific thresholds, no machine approval.
"""
from artwork_trial import build_trial_svg

# These are expected geometric refusals only. Authentication, source-binding,
# identity, resource or unexpected errors MUST NOT be swallowed as "fallback".
SECTION_REFUSALS=(
    'No safe bounded tatami subdivision; original fill retained',
    'Fill too small for bounded tatami decomposition',
)

def choose_source_preserving_repair(plan, object_ids):
    """Select source-preserving repairs before a second native engine pass.

    Sectioned tatami is preferred only if every named object is compatible.
    Otherwise preserve original unsectioned tatami, with underlay/underpath off.
    No running-stitch degradation is selected automatically.
    """
    if not isinstance(object_ids,(tuple,list)) or not 1<=len(object_ids)<=12 or any(
        not isinstance(x,str) for x in object_ids):
        raise ValueError('Invalid source repair object selection')
    try:
        _,manifest,_=build_trial_svg(plan,partition_fills=True,
                                     section_overrides=object_ids)
        if ({o['id'] for o in manifest['nativeRepairObjects']} != set(object_ids)
                or any(o['repairStrategy']!='source_preserved_sectioned_tatami'
                       for o in manifest['nativeRepairObjects'])):
            raise ValueError('Sectioned repair identity differs')
        return 'sectioned_tatami'
    except ValueError as error:
        if not str(error).startswith(SECTION_REFUSALS):
            raise
    _,manifest,_=build_trial_svg(plan,partition_fills=True,
                                 fill_repair_overrides=object_ids)
    if ({o['id'] for o in manifest['nativeRepairObjects']} != set(object_ids)
            or any(o['repairStrategy']!='tatami_no_underlay_or_underpath'
                   for o in manifest['nativeRepairObjects'])):
        raise ValueError('Original fill-preserving repair identity differs')
    return 'fill_preserving'
