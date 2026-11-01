# MD-2.62 source-detail-safe routing (development only)

Date: 1 November 2026. Branch:
`feature/source-detail-safe-running-router-md262`.

The original source-identical MD-2.56/MD-2.61 PES/DST archives are
unchanged. Original staging MD-2.61 stays **0% traffic**, main and
Netlify remain untouched by this branch.

## General-purpose routing integration

`native_detail_routing.py` uses independent travelling-plotter-style
nearest-endpoint sequencing (no external source copied) to reorder ONLY
the interior *whole objects* within one contiguous same-colour,
same-Ink/Stitch-settings, native running-stitch group.
No vector path, source pixel, protected detail, path-ID, colour, needle
point, hole, fill, underlay or fill/colour boundary is edited or dropped.
The first/last objects of the block remain fixed to protect the
boundary connections to surrounding fills. No path is reversed, and
none is sewn across a gap. It accepts an order only if geometric
non-stitch travel improves by at least 0.1 mm AND the number of
potential <=1.5mm adjacent paths does not decrease.

The server-only opt-in `STITCH_FORGE_DETAIL_SAFE_ROUTING=1` activates
this after source segmentation and before optional running-path
compaction. Default is unchanged. The native PES/DST decoder and
source-colour safety audit remain in control. This is not a
semantic feather detector or physical sewout approval.

## Measured local source-identical Kingfisher SVG baseline

The private MD-2.61 SVG has 1,162 native paths, 981 running,
181 filled. Among eligible contiguous running groups, a conservative
anchored nearest-endpoint planning analysis identifies potential
reductions in pen-up travel; metrics are **SVG geometry**, not
machine trims, and changes must pass actual native PES/DST tests.

Much more remains: 921 unresolved tiny detail objects (1,006 source
pixels), excessive machine trims and missing feather-aware
stitch-direction decisions. No automatic mask recolouring or
deleting micro-details is permitted just to lower counts.

## Required gates

- Run standalone offline routing unit tests plus existing real native
  Ink/Stitch PES/DST and isolated worker integration via GitHub Actions.
- Privately check the original Kingfisher candidate without a paid
  Cloud Run build, compare both decoded files and major protected
  feature fidelity. Do not count trim improvements unless measured
  on the decoded PES and DST files.
- Physical sewout with experienced machine operator is required
  before authorising product production.
