# Stitch Forge MD-2.59 — hybrid computational-geometry routing

Date: 1 November 2026. Branch: `feature/hybrid-geometry-routing-md259`.
Production and default worker remain unchanged; no hosting build or deployment.

## Source of technical methods

New work draws on **general computational geometry, medial-axis analysis,
pen-plotter pen-up routing and coverage planning**, not exclusively embroidery
libraries. No third-party source code is copied. Existing scikit-image,
Shapely and NumPy handle bounded geometric computation, avoiding new
dependencies. Existing Ink/Stitch/pyembroidery remain the native exporter and
independent stitch auditors. VTracer and OpenCV already exist in evaluation
tools and are not reinstalled. GPL/AGPL projects can inform methods without
improper copying.

## What was implemented

- `geometry_intelligence.py`: raster-bounded medial skeleton and weighted
  principal-axis estimate, with confidence proxy. No claim of feather, fur or
  petal semantic direction. Rejects thin/invalid geometry.
- Source-aware route optimisation: bounded nearest-endpoint two-way
  sequencing of *separate* fill tracks. Can reverse and reorder whole lines,
  but never move needle points, bridge a hole with sewn stitches or change a
  source colour mask. Fallback to the original order if pen-up distance
  does not decrease.
- `source_scanline_fill.py`: an optional `adaptive=True` mode compares the
  geometric axis direction with its original six angles. It accepts a new
  direction only when resulting section count does not exceed baseline and
  calculated area coverage falls by at most two percentage points.
- `artwork_trial.py`: server-side-only `STITCH_FORGE_HYBRID_PATH_PLANNER=1`
  enables the new planner **only** on source-scanline repair objects, without
  affecting production defaults or bypassing signed repair receipts, source
  containment or decoded PES/DST validation. Manifest records purely
  geometrical pen-up and axis estimates; `machineEligible` remains false.

## Offline real-artwork geometry comparison

From the user-supplied MD-2.56 ZIP, an engineering-only SVG derived from
their Kingfisher was inspected privately; original raster, private report
and any generated SVG are NOT committed publicly.

On 12 sampled source-fill polygons from the already generated SVG:
10 accepted planner constraints, two rejected. Compared to the original
source-aware scanline algorithm on those 10 shapes, the hybrid planner
maintained non-increasing numbers of distinct tracks and no more than 2
percentage points loss of a buffered-stroke geometric coverage proxy.
Estimated sum of distances between disconnected tracks decreased by
**349.291 mm**. This number is aggregate **pen-up geometry**, NOT decoded
PES/DST jump length, not trim count, and not proof of quality improvement.
Use `tools/bench_hybrid_fill.py` locally to reproduce with an existing
generated SVG; never upload private imagery to GitHub.

## Strict remaining release gates

1. Unit tests, new offline geometrical benchmark and actual native PES/DST
   independently audited tests must pass on feature branch CI.
2. Real original source-identical Kingfisher input must pass its entire
   protected two-phase transaction without relaxing the audit.
3. Evaluate direction relative to wing/feather anatomy, needle density,
   time, stitch quality, trims and expected fabric constraints.
4. Obtain actual sewn samples from an embroiderer before describing output
   as machine-approved or commercially ready.

This is **one verified modular improvement**, not a complete combined
open-source app or a final professional embroidery digitiser.
