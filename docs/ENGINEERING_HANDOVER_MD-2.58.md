# Stitch Forge MD-2.58 — source-aware alternative scanline fill

Date: 1 November 2026. Isolated branch: `feature/source-aware-scanline-engine-md258`.
**Not deployed, not merged, not approved for commercial embroidery use.**

## Direct code addition

`services/digitiser/source_scanline_fill.py` provides a new independently implemented
polygon-constrained scanline routing module. It is based on public scanline-fill
principles also used in the Apache-2.0 StitchFoundry Rust engine, not copied source.
It takes the actual prepared Shapely polygon and holes, uses 0.45 mm stitch rows,
insets tracks 0.09 mm, tries six candidate directions, and routes connected
sections only if the entire sewn connector lies within the inset polygon.
Separate sections remain separate paths so the native engine owns jump/trim.
It rejects too-thin or excessive geometry. Reports track count, planned
line length and a **geometric** coverage proxy; none is proof of physical sewout.

## Integration

- `build_trial_svg()` now accepts `scanline_overrides`. Requested source
  sub-fill IDs become source-contained track geometry rather than the old
  **single sparse skeleton**. Original selected colour masks/pixels and
  component IDs remain unchanged.
- Worker signed repair receipts can explicitly use
  `mode=source_scanline`, controlled by the server-only opt-in
  `STITCH_FORGE_SOURCE_SCANLINE_REPAIR=1`. Default remains the prior
  fill-preserving repair; **no production behaviour changes**.
- Source repair still allows only 12 pieces and 2% of foreground, never accepts
  new authority from the browser, never bypasses the independent decoded
  PES/DST source-containment audit or claims `machineEligible=true`.
- A scanline path remains native *running stitch tracks*, not genuine
  Ink/Stitch tatami or automatically validated fabric underlay. It may
  have very different thread appearance/trim behaviour and is expressly
  blocked from physical or commercial approval without sewout review.

## Existing components deliberately retained

- Ink/Stitch 3.3.0 remains the production exporter.
- Existing VTracer and OpenCV geometric candidates remain in
  `tools/bench_vectorise.py` and `tools/bench_source_region_candidates.py`.
  Re-adding those tools would waste work.
- Lilo's GPL-3.0 implementation is documented as a research reference **only**.
  None of its source is copied into Stitch Forge.
- StitchFoundry's scanline/section concept is a permissively licensed
  architectural reference; no third-party engine source is copied.
- SAM 2 remains an optional future evaluation, not a dependency or an
  unverified promise of preserved feathers.

## Release gates

1. Synthetic source-bound and repair-HMAC tests must pass on the isolated branch.
2. Ink/Stitch PES6/DST native generation, independent decoder and worker-container
   tests must pass in GitHub Actions without Cloud Run/Netlify activity.
3. The original real Kingfisher from Cloud Shell must be compared on a
   **source-identical** request, with clear coverage, source safety, trim,
   jumps, anatomy, thread appearance and machine-file checks.
   The user-uploaded 1280×1536 reference is a visual reference and NOT
   bit-identical to Cloud Shell's original 1145×1374 source.
4. A sewout from an experienced embroiderer on intended fabric is needed
   before claiming customer-ready files. No paid cloud trial is authorised.

This branch introduces a real alternative stitch-planning capability and
does not claim it has solved the Kingfisher or made a production service ready.
