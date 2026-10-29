# Stitch Forge handover — MD-2.30 (2026-10-29)
Branch: `feature/detailed-embroidery-analysis-no-deploy`. Previous MD-2.29 checkpoint: `5354a2957602ecadd1355dfe9a14626f2fd5d0ff`.
No deploys, PR changes, production/integration branch writes or paid APIs.

## Implemented
- In `site/auto-reconstruct.js`, source-pixel-backed extracted fill contours now accept 12px² minimum area (AI proposed polygons retain their 35px² guard; actual components still require 25 source pixels). This fixes the observed 5x5-pixel eye being dropped even though it had valid source colour evidence.
- Added deterministic coherent high-contrast missing-feature detection to the local whole-image reconstruction audit. A 2px wing/feather mark or a small dark eye not represented by a reconstructed region prevents automatic machine ZIP request. It does not generate a guessed stitch path or call AI again. When the small eye is explicitly in the AI plan, it survives as a separate editable coloured region and the omission alarm clears.
- All original reconstruction tests retained; five cases added.

## Testing/evidence
- 25 reconstruction test cases pass in local V8 harness executing fetched source/tests with a small CommonJS / assertion shim; historical Node/browser/Python suite NOT rerun.
- `docs/test-evidence/MD-2.30-fine-details.txt` explains the exact test and limits.
- No real wildlife image or model benchmark, native Ink/Stitch execution, true Android performance or fabric test.

## Professional-grade blockers
- Fine detail is not yet autonomously invented or recovered if AI fails to propose it: current behaviour blocks release of incomplete art.
- Colour reconstruction may fail on shade gradients, very tiny spots or texture. Thresholds are synthetic heuristics.
- No satin rail/rung generation, fabric profile, pull compensation, or independently proven stitch representation per reconstructed region.
- Compound holes from MD-2.29 remain non-integrated and machine output stays fail-closed.

## Next
1. Test a **licensed private** wildlife illustration with clear ground-truth regions (eye, feathers, layered colours) on-device and compare source pixels vs reconstructed semantic region inventory.
2. Add deterministic image-grounded *recovery* for small dark details, not merely detection; preserve single-call AI budget and fail closed on uncertain topology.
3. Add per-region machine stitch evidence and real native PES/DST regression in appropriate zero-cost local environment, then physical fabric stitch-out. No hosted worker calls without authorisation.
