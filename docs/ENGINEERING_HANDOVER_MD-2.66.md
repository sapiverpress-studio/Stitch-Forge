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

## MD-2.66 continuation — native integration and source-grounded detail (2026-11-02)

### Implemented, tested, on isolated feature branch
- `source_detail_guard.py`: removes the earlier synthetic dark-disk painting;
  makes at most 640 bounded colour changes, each backed by a closer
  pre-existing palette colour at an actual source pixel. No synthetic
  feature geometry and no additional thread colours.
- `feature_edge_audit.py`: uses source Canny edges, working-colour
  boundaries and one-pixel tolerance to detect loss of compact
  contrasting features. A missing or low-recall candidate is **HOLD**;
  this is not semantic eye recognition.
- `hybrid_packet_bridge.py`: builds a deterministic hybrid source packet
  and rechecks it using the original worker's independent
  `artwork_packet.decode_packet` contract, including the complete original
  alpha foreground, RGBA SHA-256, colour labels and request identity.
- `prepare_native_input_candidate` invokes the existing
  `artwork_trial.build_trial_svg` with the independent source ledger;
  neither this offline operation nor its tests claims PES/DST.
- Real Ink/Stitch 3.3.0 **synthetic artwork** native smoke test passed in
  GitHub Actions run 41420850538, using the pinned official engine:
  7 working colours, 8 connected working parts, 54 native paths,
  8,297 independently decoded PES and DST stitches each,
  89 PES trims, zero reported source-containment exceptions.
  Machine file format checks pass; the files are not sewn-approved.
- Tests under `md266-home-hybrid-tests.yml` verify deterministic
  source binding, no synthetic dark circles, bounded source-supported
  colour improvement, native SVG construction and feature-edge HOLD.

### Actual supplied Kingfisher — still fails likeness gate
- Offline nine-colour SLIC candidate: 120 components in original
  prototype, strong overall shape silhouette and colour blocking.
- Source-supported detail refinement (separate local comparison): 411
  working pixels changed, ~149 colour components versus 126 in its
  local baseline. These values concern an earlier local prototype
  variant and **must not be represented as a matched build benchmark**.
- Original Kingfisher image's strongest compact-dark region near the
  eye had approximately 0.28 source-edge retention under the local
  colour-preview analysis. That correctly activates HOLD. The eye
  is visibly insufficiently distinct even though its source RGB values
  remain available. This remains a blocking defect.

### Next hard gates
1. Improve automatic semantic-protected details for eye, beak, feet,
   feather-group boundaries and foliage without inventing source shapes
   or exceeding the Home palette/density budget.
2. Run the real hybrid **Kingfisher** (not merely synthetic CI artwork)
   through the full native PES/DST pipeline. User source stays private.
3. Audit decoded stitch geometry, source colour similarity, trim count,
   underlay/fill directions, machine sizes, and per-feature likeness
   against source-identical MD-2.64.
4. Obtain third-party home-machine sew-outs before describing the output
   as commercially usable.
5. Do not merge this branch into main or deploy the Cloud Run worker
   until the above gates are met.

### Deployment/cost constraints
- No Google Cloud build, live traffic change, Netlify deploy, or Work
  credit was used in this development continuation.
- Only GitHub Actions isolated CI ran; it can consume GitHub Actions
  minutes according to account billing.
- The existing MD-2.64 worker at 100% and existing frontend are unchanged.
