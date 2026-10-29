# Stitch Forge engineering handover — MD-2.31 (2026-10-29)

Development branch: `feature/detailed-embroidery-analysis-no-deploy`.
Parent checkpoint: `c65473dd150931cf7e635b26a712adadfc51181f`. No deployments, PR updates, production/integration writes, paid model/host use.

## New behaviour
- After AI reconstruction, local image audit finds missing high-contrast islands. A second deterministic pass grows colour-consistent connected source pixels inside an existing filled region, extracts bounded contours, raster-audits the geometry, and adds **editable unclassified candidate** regions in source-layer order.
- Max 16 recovered source details, 1,600 pixels each and max 128 regions total. Coherent tiny eye and feather-like line cases recovered without additional AI calls.
- New candidate IDs, source parent linkage, mean RGB, low confidence, recovery status and explicit review flag. Browser UI marks candidate overlays with dashed strokes and states that machine export is blocked.
- The original omitted-detail audit survives reconstruction for traceability, while remaining omissions are also reported.
- Existing native PES/DST request remains **fail closed** for all locally recovered regions. Their polygon geometry is not automatically approved as tatami, satin or running stitch.

## Tested
- 30/30 targeted JavaScript test callbacks passed by local in-memory V8 harness (previous 25 + five additions); full details in `docs/test-evidence/MD-2.31-local-recovery.txt`.
- UI change not browser-tested; historical Node/browser/Python suites not rerun.
- No real artwork, paid AI inference, hosted engine, native Ink/Stitch regression, Android device or physical machine stitch-out.

## Technical gaps that matter for Target 2
1. Realistic nature artwork needs labelled ground truth to calibrate false positive recovery, colour gradients, true holes and very small features. Synthetic source does not establish that.
2. UI edit pathway's physical-size validation can reject small candidate regions; it correctly does not silently drop them. Do not weaken without proper sewing decisions.
3. Source geometry alone is not proper satin rails/direction, density/underlay or overlap-aware colour order. Add actual stitch-planning evidence and per-region machine-format audit.
4. Compound holes still fail closed; persistence of unverified candidate metadata across saved projects is not built.
5. Physical fabric stitch-out and full private engine acceptance remain unresolved.

## Next engineering move
Benchmark recovered candidate false positives on licensed realistic wildlife art, then build source-grounded stitch classification/rail validation and ensure native Ink/Stitch machine records match source feature geometry before considering end-to-end promotion.
