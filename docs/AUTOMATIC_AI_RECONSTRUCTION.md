# Stitch Forge — Automatic OpenAI-Assisted Embroidery Reconstruction

**Status:** 2026-10-28 development preview. **NOT professionally stitch-tested or approved for sale.**

## Product decision

The desired standard workflow is **Upload original artwork → Reconstruct embroidery automatically → Inspect new colour design and editable SVG**. No manual tap-around-the-wing tracing is required or presented as the primary workflow. An optional legacy drawing editor remains for corrections, not as a prerequisite.

The original 14-region OpenAI analysis produced only rectangles. These are insufficient to digitise the moth. The additional auto-reconstruction feature requests polygon and centreline **coordinates** from OpenAI; uses the real image pixels to refine each proposed fill; and replaces old fragmented outlines with the new editable geometry in an atomic, undoable action. This is experimental geometry processing, **not a completed professional machine stitch file**.

## Actual implementation

### 1 — One authorised AI call

`netlify/functions/reconstruct-embroidery.mjs` uses the existing **server-side** `OPENAI_API_KEY` and the separate `STITCH_FORGE_ANALYSIS_TOKEN`, and accepts one explicit user request from the browser. It asks for 4–12 useful semantic regions, including separate wing panels, body regions and visible veins. Each output has kind, thread colour swatch, layer, confidence and normalized image coordinates. Structured Outputs JSON schema, input size limits, duplicate-ID checks and bounding checks apply. `store:false` is set. The endpoint defaults to `gpt-4.1` (verified from source) for structured vision proposals; `STITCH_FORGE_RECONSTRUCTION_MODEL` can override it. Its API usage is **separately billable**, and no free or included usage is assumed. Never put keys in the website bundle or repository.

### 2 — Automatic reconstruction using real source pixels

`site/auto-reconstruct.js` checks for a sufficiently uniform or genuinely transparent background, extracts an original foreground mask, intersects AI *polygon outlines* with actual image pixels, keeps the largest connected region and traces/simplifies closed boundaries. This prevents AI bounding boxes from turning into rectangular stitched patches. Running-centreline proposals are snapped toward nearby pixel-derived cross-line contrast and rejected if the longest supported fragment is too short. This remains an approximation: branching fine lines and pale textures can be missed. Unsupported or fragmented regions are rejected. If fewer than two supported fills remain, **nothing is changed**. The current foreground test is **not semantic segmentation**: it can confirm visible subject pixels but cannot reliably distinguish two pale overlapping wing areas or all details. Complex backgrounds deliberately fail closed.

Restored projects may retain only a reduced tracing reference rather than the original full-colour source. Automatic reconstruction now **requires the originally uploaded artwork in the current session**; a restored preview is rejected before a paid request, preventing false detail reconstruction. Re-upload the source image when needed.

### 3 — Automatic, undoable editor rebuild

`site/auto-reconstruct-ui.js` adds **Reconstruct embroidery automatically**, gives request/validation status, then calls `StitchForgeAIContext.replaceWithAutomaticReconstruction`. The editor checks actual closed-fill polygons through `fill-geometry.js` after simplifying overly dense contours, replaces previous fragments without duplicating the old silhouette, and saves the entire earlier design in Undo. It stores per-path colours alongside styles in browser persistence and JSON, and produces a coloured SVG with physical dimensions. The original detailed image remains the source reference.

**Machine-file safety:** the browser's experimental PES/DST generator currently supports only one colour. When the reconstructed regions have different colours, PES/DST/ZIP machine exports are **blocked** rather than silently generating a false one-colour file. The editable colour SVG is currently an intermediate artifact. The separate trusted-server SVG builder now passes real Ink/Stitch engine smoke tests, but it is **not yet connected to the automatic browser workflow**. No automatic commercial machine files are claimed.

## Tests and evidence

- New `tests/test_auto_reconstruct.cjs` covers two synthetic wings, source-derived contours, retained colours, complex backgrounds and refusal to generate nonexistent fills.
- New `tests/test_auto_ai_endpoint.mjs` tests structured output, invalid geometry, private-token gate and a mocked `store:false` OpenAI request.
- New `tests/test_auto_reconstruct_mobile.py` exercises the complete 390×844 Chromium workflow on **synthetic artwork**, mocked model response, editable SVG, blocked misleading DST and Undo. A mocked-model Android-sized Chromium execution has **passed** in GitHub Actions (run 40718207507). This is not a physical Android device test.
- Pure JS reconstruction of two synthetic wings has been executed in an isolated JS runtime: 2/2 produced 115-vertex closed image-grounded regions with ~79% source-image support; both passed `fill-geometry.js` after editor-scale thinning to 56 vertices plus closure.
- Production JavaScript sources syntax checked. Netlify PR preview status is reported successful; per-test build logs are not available through the current connector.
- **No actual OpenAI polygon geometry response**, detailed moth reconstruction comparison, end-to-end browser-to-real-engine export or physical stitch-out has passed. However, the standalone real Ink/Stitch runner has now generated and independently decoded PES/DST for two bounded test designs (see below).

## Important next engineering gates

1. Test the genuine moth in the owner-only development preview, measuring how many wing, body and vein parts are reconstructed and what the model omits. This may consume OpenAI API credits.
2. Improve **semantic pixel masks** for overlapping, semi-transparent, low-contrast wing details. The current polygon/foreground intersection is insufficient for professional naturalistic embroidery.
3. Implement verified satin columns (two rails/rungs or valid stroke-to-satin geometry), fill density and angle by region, underlay, layer and colour order, and trim/lock handling.
4. Connect the verified upstream Ink/Stitch runner to the automated reconstructed project; independently decode outputs, enforce multi-colour ordering, then conduct physical stitch-outs on realistic fabrics and hoops.
5. Only then consider calling the tool a professional embroidery file maker or publishing retail machine files.

**Official implementation references:** [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI vision limitations](https://developers.openai.com/api/docs/guides/images-vision), [Ink/Stitch workflow](https://inkstitch.org/docs/workflow/), [Ink/Stitch satin](https://inkstitch.org/docs/stitches/satin-column/).

**Release boundary:** Development PR #1 only. Do not merge experimental engine into `main` or claim machine-tested outputs without results.

## 2026-10-28 — CI-verified stabilisation

- Rebuild no longer carries forward the extra legacy silhouette; editor design-change events invalidate the transient AI overlay.
- Pale foreground uses an adaptive rather than fixed RGB contrast threshold; centreline paths must be supported by image contrast instead of merely any foreground.
- Tests include low-contrast wings, a dark supported vein and an unsupported invented line; these tests are synthetic and are not evidence of full moth reconstruction.
- GitHub Actions head `db47e431`: AI region checks **success** (run 40716378480) and full digitiser regression **success** (run 40716378496). Real Ink/Stitch integration smoke still **fails**, at secure upstream archive extraction (run 40716378413).
- Physical stitch-out, real moth semantic masks, calibrated colour sequence, production-grade satin/tatami and final multi-colour PES/DST remain unverified. Never label exported machine files production-ready.

## 2026-10-28 — Real engine validation milestone

- **Confirmed cause of 120-second timeout:** Ink/Stitch opened a 423 × 142 modal window saying `Unversioned Ink/Stitch SVG file detected` and awaited an Update/Cancel selection. Captured from synthetic-only Xvfb in CI; no customer artwork involved. The genuine upstream `v3.3.0` `lib/update.py` expects `inkstitch_svg_version = 4`.
- **Permanent fix:** `services/digitiser/trusted_svg.py` now writes namespaced `inkstitch:inkstitch_svg_version` element text `4` inside `<metadata>`. This accurately marks newly built SVGs; no click automation or suppressed validation. The expected version is pinned to upstream Ink/Stitch 3.3.0 and must be reviewed when upgrading.
- **Real engine proof:** GitHub [Actions run 40733579763](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40733579763), code `109b9b82`, **SUCCESS**. Official signed-release metadata supplied an x86_64 archive SHA-256 checked before safe extraction. Real Ink/Stitch 3.3.0 exported PES and DST and `pyembroidery==1.5.1` independently decoded both.
- **Synthetic petal:** PES and DST each reported **1,278 needle stitches**, **3 jumps**, **1 colour change**, **40 × 64 mm** bounds; ZIP CRC passed.
- **Browser-project geometry fixture:** PES and DST each reported **3,840 stitches**, **0 colour changes**, **60 × 82.6 mm**; jumps 2 (PES) and 3 (DST), with ZIP CRC passed. Independent read-back is structural evidence, not physical machine compatibility.
- Previous 48-test Python CI exposed older tests counting metadata as a geometry region. They have been corrected to count only polygon/polyline elements; rerun outcomes are separately checked in GitHub Actions.
- **Not yet done:** automatic one-click image-to-native Ink/Stitch/PES/DST service integration, genuine moth semantic masks, tested satin rail geometry, physical stitching, production deployment, retail-readiness. Existing web browser still blocks unvalidated reconstructed multi-colour PES/DST; never bypass that restriction.
