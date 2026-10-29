# Sapiver Stitch Forge — MD-2.41 engineering handover

Date: 2026-10-29 (Europe/London)

## Current finding

The 17:44:30Z request was made against the immutable Netlify production deploy `6ae383086f1e6ec8b8d5e47f`, running source commit `597547e3f7f6a1e92eab846fd3ffe55842710fb4`. Netlify request logs record `POST /api/reconstruct-embroidery`, HTTP 200, duration 12.54 seconds. The request metadata does not expose or retain its body or model response.

The submitted phone screenshot reports 4 retained regions (3 fills and 1 line), 14 local source-pixel rejections, 3 invalid model outlines (regions 6, 7 and 18), and 1% source coverage. Automatic PES/DST was blocked by unrepresented detail, low coverage, incomplete lines, missing source colours and locally recovered unverified detail. This proves the user-visible workflow reached client-side image reconstruction; it does not prove correct detailed-art reconstruction or machine output.

The source artwork and screenshots are private. They were not committed or copied into the public repository.

## MD-2.41 implementation

- `netlify/functions/reconstruct-embroidery.mjs` instructs the single model request to represent major foreground colour masses before small accents. This is an unverified prompt improvement; it has not yet been checked with another real-image request.
- `site/auto-reconstruct.js` adds `assertCompleteReconstruction`: require at least 97% source coverage and zero model/client region rejections before applying any reconstruction to the editor.
- `site/auto-reconstruct-ui.js` calls the guard before mutating the editor. A failed result reports measured coverage/rejection counts, leaves the previous design unchanged, and creates no machine file.
- `tests/test_auto_reconstruct.cjs` covers the observed 1% + 14 local + 3 model rejection case, a valid 97% draft where stitch approval is still blocked, and the 96.9% boundary.

The threshold reuses the existing image audit's 3% missing-pixel tolerance. The guard addresses unsafe partial application. It does not solve the model's poor segmentation coverage.

## Verification

Final local configured check:

- Five `node --check` syntax checks: passed.
- Eight native Node test files: **71 passed, 0 failed, 0 skipped**.
- Exact command and initial assertion correction: `docs/test-evidence/MD-2.41-incomplete-reconstruction-gate/netlify-build-checks.txt`.

Not run: browser/Android test, another OpenAI call, hosted worker, PES/DST export/decode, or physical sew-out. The private image is not a checked-in fixture. No PR or merge was touched.

## Release state

- Parent GitHub `main`: docs commit `7a96c8c0b54a53bdd9a73218fa956ea92c9141e3`.
- MD-2.40 production source: `597547e3f7f6a1e92eab846fd3ffe55842710fb4`; deploy `6ae383086f1e6ec8b8d5e47f`, published 17:32:07Z.
- MD-2.41 code is pushed to GitHub `main` as commit `4d87c9c4e38b0c0b8b1a2d022db6d07e36bedeb3` (commit message contains `[skip netlify]`). It has not been deployed; production remains MD-2.40 commit `597547e3f7f6a1e92eab846fd3ffe55842710fb4`. A deployment of this new commit requires authorization.
- All commits must include `[skip netlify]`. The owner previously authorized a specific MD-2.40 publication; a new deployment of MD-2.41 must be separately authorized. Do not push in a way that triggers Netlify; if no safe skip-marker route is available, keep it local.

## Next engineering step

Prepare one consolidated MD-2.41 release, then make only one owner-controlled reconstruction attempt if API credit is acceptable. Read the resulting coverage and rejection counts. If the prompt still yields low coverage, stop repeating prompt-only releases and build a locally testable source-color/connected-region proposal experiment against private or appropriately licensed realistic artwork. Keep the 97%/zero-rejection gate; never weaken validation to force a machine file.

Professional-quality detailed artwork, actual Ink/Stitch machine output for this artwork, decoded file quality, and physical embroidery remain unverified.
