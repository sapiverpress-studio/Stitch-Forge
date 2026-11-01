# Stitch Forge MD-2.60 — complete-area native tatami sectioning

Date: 1 November 2026. Branch: `feature/tatami-coverage-decomposition-md260`.
**Isolated, no Netlify/Cloud Run deployment, no merge to main.**

## Problem
MD-2.56's large orange source fill was replaced with sparse running
tracks, and MD-2.57's no-underlay tatami regeneration failed real
Kingfisher colour containment. MD-2.58's optional source scanline path
restored some geometric area coverage but still used running stitch
tracks, not real tatami. A general alternative that *preserves the fill
family* is needed; no one-off Kingfisher coordinate fix is allowed.

## Implemented cross-domain solution
The new `native_tatami_decomposition.py` adapts polygon coverage
sectioning concepts from CNC/slicers/field coverage planning, using the
existing Shapely dependency. It calculates source-exact, nonoverlapping
sections of a difficult fill, preserves holes and all input area,
refuses slivers and too many pieces, and records internal seam length.

`build_trial_svg()` optionally emits each section as a genuine
`inkstitch:fill_method=tatami_fill` path with the original thread colour.
Automatic underpath and underlay are off on these sections because
the original repair still failed with underpath enabled. This is not
yet a good fabric stabilisation strategy; seam and fabric review are
mandatory. The candidate is NEVER silently replaced with running paths.

`artwork_service.py` requires an HMAC-bound, short-lived repair receipt
in exact `mode=sectioned_tatami`. This mode is selected only by the
**server-side** `STITCH_FORGE_SECTIONED_TATAMI_REPAIR=1` flag, disabled
by default. Original source hashes, 12-object repair cap, 2%-foreground
area cap, native PES/DST decoding, density, stitch-length and containment
rejections are unchanged. Every returned trial remains
`machineEligible=false`, even with all native tests passing.

## Evidence and limitations
The offline geometric check examined 128 valid, >=4 mm² native fill
polygons from the supplied MD-2.56 Kingfisher output: 86 could be
partitioned without losing any area, and 42 were conservatively
rejected. This is only a **geometry benchmark**, not native
Kingfisher acceptance or a sewout. The specific orange fill polygon
is unavailable in MD-2.56's SVG because that file already contains
its replacement running path.

Before release, require passing native Ink/Stitch 3.3.0 PES6/DST
independent-decoding CI and a true source-identical Kingfisher A/B,
then physical fabric sewouts to assess density, seam lines, travel,
pull compensation, underlay, trims and anatomical likeness.

No third-party source code was copied or embedded, and no new billable
services or dependencies were added.

## Verified engineering result — 1 November 2026

Feature code and test commit: `e497a74572ba7619dc098d90b8a056b7f13937ab`.
GitHub Actions run **41315319265 COMPLETED SUCCESS**, verified against
that SHA: https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41315319265

The first two CI attempts **failed** on tests that requested a subdivision
of a fill too narrow to partition and then one larger than the established
2%-foreground repair limit. Neither safety constraint was weakened.
The final regression instead builds a real 128×128 source-object packet with
an isolated 7×18-pixel contrasting region, fits inside the existing repair
cap and passes actual Ink/Stitch 3.3.0 PES6/DST generation and independent
source-containment checks. This also covers signed repair receipts,
source-colour mask preservation, section holes, fail-closed unsuitable
geometry and worker-container HTTP integration. Synthetic success does
not mean the original Kingfisher's rejected region has passed.

**Do not promote to main or deploy** until a bit-identical original
Kingfisher source tests successfully and the generated stitchout is
evaluated for visible section seams, travel, coverage and fabric behaviour.
