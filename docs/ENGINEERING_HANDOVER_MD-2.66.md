# MD-2.66 — Home hybrid reconstruction foundation (HOLD for native export)

## Purpose
A Home profile should preserve important **shape and colour** while reducing
fragmentation; Professional Detail will add underlays/texture overlays *on top
of* the same sound foundational geometry. Neither tier is allowed to claim
successful physical stitching without machine/fabric evidence.

## Actual work committed
- Added offline hybrid candidate using scikit-image SLIC spatial segmentation
  + deterministic CIELAB palette clustering + scipy connected components.
- Added a capped dark-mark preservation heuristic. It is geometric,
  **not semantic recognition of eyes or feather markings**.
- Produces a visual-only SVG (hole-preserving even-odd fill),
  colour raster preview and JSON metrics. No artificial PES/DST.
- Does NOT modify the signed browser source packet, source-pixel ledger,
  Cloud Run worker, Ink/Stitch algorithms, runtime dependencies or live traffic.
- Source foreground is checked as unchanged for the resized input image.
- CI test verifies bounded inputs, deterministic results, colour limits,
  unchanged foreground, explicit unapproved status and no native file claims.

## Private baseline evidence — user's actual Kingfisher
Source: user-supplied isolated RGBA Kingfisher, 1312 x 1199,
evaluated offline at 320 x 292, 80mm requested visible width.
- 9 colours, 45,286 working foreground pixels retained.
- Direct nine-palette, *per-pixel* connected regions: 3,668.
- Nine-palette SLIC hybrid candidate: 120 connected regions.
- Mean CIELAB deltaE76 16.1, 95th percentile 34.7.
- Eight candidate high-contrast dark marks detected/preserved as a
  bounded geometric heuristic.
- Recognisable silhouette, orange and blue panels, branch and ivy.
- **Failed detail acceptance**: pupil/eye contrast, beak and fine
  marking hierarchy remain inadequately represented in visual preview.
- These 120 colour regions are NOT 120 stitch objects. Do not infer
  improved PES trims, fill density or physical quality.
- This benchmark is NOT a comparison of native output against MD-2.64:
  the measured 3,668 baseline is an intentionally naive nine-colour
  pixel classifier using the *same* palette.

## Correct next integration gate
1. Add semantic-feature-aware protection (eye, beak, face, distinct wing
   edges, claws, leaf veins) using a conservative source-grounded
   mask. Evaluate optional SAM 2; its GPU/PyTorch dependency is not
   justified in the low-cost main Cloud Run worker until tested.
2. Reconstruct a working *Home* source-labelled plan with a distinct
   original-reference colour ledger. Recompute independent auditing so
   new colour simplification never masquerades as unchanged source
   colours. A candidate must include signed identity and evidence
   linking it to the original upload.
3. Feed that independently checked plan to actual Ink/Stitch, using the
   existing native two-phase PES/DST protocol. Audit both file formats,
   geometry containment, density, trims, objects and thread sequencing.
4. Compare source-identical Kingfisher plus at least two contrasting
   licensed source designs with MD-2.64. No regression on protected
   features, silhouette or physical dimensions.
5. Human scrutiny and physical home-machine sew-out are mandatory
   before enabling Home mode on the public website.
6. Only after Home passes, design experimental Professional Detail
   overlays with directional satin/tatami/texture scheduling.

## Open source and licences
- scikit-image BSD-3-Clause; already in pinned worker requirements.
- scipy/numpy/Pillow already in worker requirements.
- VTracer optional later as a swappable vectoriser (not falsely claimed
  to be integrated in this initial patch).
- SAM 2 Apache 2.0, optional semantic masks in a GPU-capable sidecar
  after cost and licensing assessment.
- Keep Ink/Stitch GPL-3.0 licence obligations under review before
  distributing any combined software binary.
