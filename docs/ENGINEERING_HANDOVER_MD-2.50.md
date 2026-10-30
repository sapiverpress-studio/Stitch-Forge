# Stitch Forge MD-2.50: physically bounded colour preparation

Date: 2026-10-30. **Engineering trial only; detailed-artwork PES/DST and physical sew-out remain unverified.**

## Root cause

MD-2.49 created thousands of disconnected colour objects when preparing painterly artwork. Separately, its paid AI reconstruction produced an unusable six-path kingfisher approximation. The native worker already generates PES/DST on simple tests. The artwork preparation and stitch planning, not machine-file encoding, limit Target 2.

## Implementation

- `site/artwork-pipeline.js`: source-bound preflight with optional maximum working-part count. Where enabled, one bounded grouping pass (up to 2 mm spatial reach and RGB distance 180) reduces tiny colour fragments without changing selected foreground pixel coverage or recolouring explicitly protected source features. Oversized reference graphs fall back to a declared source-fingerprinted palette approximation; no source pixels are silently truncated.
- `site/auto-reconstruct-ui.js`: physically sized, sequential preparation attempts (4, 3.2, 2.4, 1.8 analysis pixels per mm of the longest physical side) before contacting the native worker. Keeps requested embroidery width and original editor image; stops if all attempts exceed 1,500 working colour components. Turning texture simplification off retains the original 768-pixel analysis workflow.
- `site/source-object-plan.js`: accepts the bounded extended RGB-distance option; its default remains unchanged.
- `site/source-region-project.js`: explicit graph-serialization-budget fallback provenance, still bound to independent analysis pixel fingerprints.
- New tests for physical candidate sizing, resource refusal, original pixel immutability, no omitted foreground and deterministic source bindings.

## Local proof, 80 mm artwork width

| Test illustration | MD-2.49 parts at 768 longest-side pixels | Selected MD-2.50 analysis size | MD-2.50 working parts | Native SVG paths | Native SVG bytes |
|---|---:|---|---:|---:|---:|
| Flying kingfisher (new generated art) | 6,976 | 256 x 307 | 1,342 | 1,048 | 844,892 |
| Earlier kingfisher on blossom branch | 12,192 | 144 x 124 | 1,297 | 803 | 455,130 |

Local test method: run `artwork-pipeline.pack` on the selected analysis RGBA pixels; independently decode the resulting header and compressed source/colour packet with `services/digitiser/artwork_packet.py`; run `artwork_trial.build_trial_svg` on that independently reconstructed plan. Both cases passed source fingerprint and foreground equality checks, with no omitted selected analysis pixels. The native input SVG rendered as a recognisable kingfisher without an underlying reference image, but the 144-pixel version is visibly coarse.

JavaScript regression suite: **164 passed, 0 failed** (`node --test tests/*.cjs tests/*.mjs`). Tests are not evidence that a PES/DST sew-out is adequate.

## Explicit outstanding acceptance gates

1. This only improves **source colour geometry**. It does not provide anatomical recognition, reliable satin/underlay/density planning, or proof that fine original pixels survive resampling.
2. Native SVG input has been generated and rendered locally. **No PES/DST was generated from these newly adapted detailed samples in this session**; the simple hosted MD-2.49 worker test is not a substitute.
3. Run the two detailed illustrations through the existing tagged Cloud Run worker, download and independently decode PES/DST, measure stitch count, jumps, trims, unsewn features and contour quality, compare original vs decoded stitches with the reference image hidden, then perform a physical sew-out.
4. Keep physical stitch quality unapproved. Do not remove safety budgets or direct new user traffic to the worker solely because preparation tests pass.
5. No new paid AI calls, dependencies, secrets or Cloud Run deployments were introduced by this commit.
