# MD-2.75 — Protected original-artwork detail gate (NO DEPLOY)

**Date:** 6 November 2026
**Branch:** `feature/md275-protected-source-detail-gate-no-deploy`
**Stage:** Experimental source-image diagnostics. No hosted deployment or machine approval.

## The problem

The MD-2.74 separate Tatami/satin/running stages are genuine but cannot replace a feature that vanished in the reduced working image. The objective now is to detect **loss before stitch planning**, not lower source-containment requirements or force decorative stitches.

## Implementation

- `services/digitiser/protected_detail_audit.py`: private original PNG (up to 45 million RGBA pixels) and up to 12 explicitly chosen pixel rectangles. It computes a physically scaled local contrast-edge inventory; optionally compares the same composition rendered through a lower-resolution/reduced-colour raster. Matching source edge pixels within 0.15mm are counted as a **diagnostic proxy**, not a machine stitch coverage or semantic likeness score.
- `tools/audit_protected_detail.py`: local-only command. Outputs JSON statistics and original PNG SHA256; does not publish raster bytes.
- `tools/staged_legacy_trial.py`: optional `--original-png`, `--protected-windows-json`, `--detail-comparison-png`. Validates original artwork dimensions against the previously prepared stage plan, and attaches a reduced, image-free critical-feature warning to the offline review bundle. The original combined native SVG and any optional PES/DST export are **unchanged**.
- `site/staged-review.html` and `site/staged-review.js`: in the running-stage review, disclose missing audits and possible contrast-loss windows without claiming semantic identification or native validation.

The older V1 source-object plan **does not authenticate the original PNG SHA against its original image field**. Dimension compatibility is not cryptographic identity. Therefore `boundToPreparedPlanByOriginalSha256=false` is mandatory for this experiment. Use authenticated V2 transport and matching raster before allowing new native geometry based on full original pixels. The review itself does not author, overlay or export any new running stitch.

## Tests

- [MD-2.75 source gate CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42181828989) initially passed synthetic: original source contains eye ring/bright glint, flattened raster loses the contrast, invalid ROIs are rejected.
- [Expanded CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42182192716) covers source review → old native stage runner, unchanged combined SVG, no source image copy, mismatched dimensions rejected, offline reviewer data contract, original stage generation. **PASS** — workflow completed successfully 6 November 2026; this is a source/planner/regression test, not actual full-resolution native detail restoration.
- The private original Kingfisher was examined locally using an **approximate 320px, nine-colour proxy**, which suggests substantial loss of wing-edge contrast. This proxy was **not produced by Stitch Forge**, so it is NOT source-identical native validation and its figures are deliberately excluded from public CI and this repository.
- **No private image bytes, ROI coordinates or private source SHA are committed here.**

## Next actual acceptance gate

Use a SHA-authenticated **full-resolution original PNG** and original-size-to-physical coordinates to create a source-verified detail-object layer. Only after that, test an explicit running-stitch feature candidate against a **baseline genuine Ink/Stitch PES/DST export** on the same image and physical size. Compare actual decoded path coverage in protected features, colour ownership, trims, stitch density, and no outside-source moves, then validate on real fabric. Reject if feature visibility is not materially improved.

**Release:** HOLD. No merge to main, Cloud Run traffic switch, Netlify deployment or user machine approval.
