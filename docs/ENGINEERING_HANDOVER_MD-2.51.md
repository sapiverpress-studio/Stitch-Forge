# Stitch Forge MD-2.51 — truthful export routes and native-trial navigation

Date: 2026-10-30. Source: uploaded kingfisher prototype ZIP and mobile screenshot.

## Verified defect

The legacy manual Download all ZIP produced 6 editable paths and roughly 383 single-colour running stitches; the AI panel had identified more prospective visual regions but had not converted satin/colour fills. These are not the new source-bound, independently decoded native PES/DST outputs. The website previously labelled all routes with similar PES/DST and stitch terminology, allowing a user to mistake the manual export or simulated outline for the native multicolour workflow.

## UI implementation

- `site/index.html`: on raster upload, show an explicit route to the automatic native PES/DST trial. Identify the trace editor and simulator as manual provisional outlines. Relabel the existing DST, PES and ZIP exports as legacy outline-only. Ask for confirmation before generating those legacy files from a raster-upload session. Retain the manual workflow for users who deliberately want it.
- `site/auto-reconstruct-ui.js`: the raster route button selects native mode without making an API request, scrolls to the native panel and explains the correct native ZIP. No OpenAI call is triggered.
- `site/ai-details.js`: relabel the AI detail guide button as provisional running outlines, not completed embroidery. Fills, satin and multicolour are still not produced by that button.
- `tests/test_workflow_route_clarity.cjs`: three regression checks for these safety distinctions.

## Validation

Local source bundle reconstructed from the prior MD-2.49 source transfer (the three modified files matched the MD-2.50 repository content before editing, except that the MD-2.50 UI also contains newer physically sized preparation logic, retained intact in the GitHub patch).

- JavaScript syntax: source UI modules and inline main script checked successfully.
- 3 route/label regression checks passed.
- 157 tests excluding two earlier source-transfer tests which require binary/HTML fixtures absent from the local reconstructed bundle passed (0 failures). The unfiltered reconstructed suite had three fixture-not-found failures; do not count them as regressions or as passes.
- Mobile Chromium automation attempted but navigation was blocked by the execution environment (ERR_BLOCKED_BY_ADMINISTRATOR). No live browser acceptance claim.
- No paid OpenAI calls, Cloud Run traffic changes, worker image changes, or machine stitch-file tests conducted in this update.

## Remaining Target 2 gates

1. Use the source-based native workflow (not AI draft or legacy manual ZIP) on a detailed kingfisher at 80mm.
2. Retrieve its native machine ZIP, independently validate PES/DST, compare decoded stitches against source with reference hidden, and inspect dimensions, contours, thread count and trims.
3. Evaluate 120mm where 80mm loses essential fine details. Physical sew-out required before any machine-ready claim.
4. Keep legacy manual exports visible as explicitly separate experimental tools; do not suggest these exports have multicolour fidelity.

Rollback: restore GitHub parent commit for the three UI files only. No Cloud Run rollback needed.
