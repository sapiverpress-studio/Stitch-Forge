# Stitch Forge — Automatic OpenAI-Assisted Embroidery Reconstruction

**Status:** 2026-10-28 development preview. **NOT professionally stitch-tested or approved for sale.**

## Product decision

The desired standard workflow is **Upload original artwork → Reconstruct embroidery automatically → Inspect new colour design and editable SVG**. No manual tap-around-the-wing tracing is required or presented as the primary workflow. An optional legacy drawing editor remains for corrections, not as a prerequisite.

The original 14-region OpenAI analysis produced only rectangles. These are insufficient to digitise the moth. The additional auto-reconstruction feature requests polygon and centreline **coordinates** from OpenAI; uses the real image pixels to refine each proposed fill; and replaces old fragmented outlines with the new editable geometry in an atomic, undoable action. This is experimental geometry processing, **not a completed professional machine stitch file**.

## Actual implementation

### 1 — One authorised AI call

`netlify/functions/reconstruct-embroidery.mjs` uses the existing **server-side** `OPENAI_API_KEY` and the separate `STITCH_FORGE_ANALYSIS_TOKEN`, and accepts one explicit user request from the browser. It asks for 4–12 useful semantic regions, including separate wing panels, body regions and visible veins. Each output has kind, thread colour swatch, layer, confidence and normalized image coordinates. Structured Outputs JSON schema, input size limits, duplicate-ID checks and bounding checks apply. `store:false` is set. The endpoint now defaults to `gpt-5.6-terra` for coordinate-sensitive analysis; `STITCH_FORGE_RECONSTRUCTION_MODEL` can override it. Its API usage is **separately billable**, and no free or included usage is assumed. Never put keys in the website bundle or repository.

### 2 — Automatic reconstruction using real source pixels

`site/auto-reconstruct.js` checks for a sufficiently uniform or genuinely transparent background, extracts an original foreground mask, intersects AI *polygon outlines* with actual image pixels, keeps the largest connected region and traces/simplifies closed boundaries. This prevents AI bounding boxes from turning into rectangular stitched patches. Running-centreline proposals are required to have image-supporting pixels nearby. Unsupported or fragmented regions are rejected. If fewer than two supported fills remain, **nothing is changed**. The current foreground test is **not semantic segmentation**: it can confirm visible subject pixels but cannot reliably distinguish two pale overlapping wing areas or all details. Complex backgrounds deliberately fail closed.

### 3 — Automatic, undoable editor rebuild

`site/auto-reconstruct-ui.js` adds **Reconstruct embroidery automatically**, gives request/validation status, then calls `StitchForgeAIContext.replaceWithAutomaticReconstruction`. The editor checks actual closed-fill polygons through `fill-geometry.js` after simplifying overly dense contours, removes previous fragments, retains a dominant original outline where appropriate, and saves the entire earlier design in Undo. It stores per-path colours alongside styles in browser persistence and JSON, and produces a coloured SVG with physical dimensions. The original detailed image remains the source reference.

**Machine-file safety:** the browser's experimental PES/DST generator currently supports only one colour. When the reconstructed regions have different colours, PES/DST/ZIP machine exports are **blocked** rather than silently generating a false one-colour file. The editable colour SVG is available for the real Ink/Stitch pipeline once that engine has independently passed tests. No automatic commercial machine files are claimed.

## Tests and evidence

- New `tests/test_auto_reconstruct.cjs` covers two synthetic wings, source-derived contours, retained colours, complex backgrounds and refusal to generate nonexistent fills.
- New `tests/test_auto_ai_endpoint.mjs` tests structured output, invalid geometry, private-token gate and a mocked `store:false` OpenAI request.
- New `tests/test_auto_reconstruct_mobile.py` exercises the complete 390×844 Chromium workflow on **synthetic artwork**, mocked model response, editable SVG, blocked misleading DST and Undo. This test is committed; passing execution in GitHub CI is **not yet confirmed**.
- Pure JS reconstruction of two synthetic wings has been executed in an isolated JS runtime: 2/2 produced 115-vertex closed image-grounded regions with ~79% source-image support; both passed `fill-geometry.js` after editor-scale thinning to 56 vertices plus closure.
- Production JavaScript sources syntax checked. Netlify PR preview status is reported successful; per-test build logs are not available through the current connector.
- **No actual OpenAI geometry response**, detailed moth region-reconstruction comparison, independently decoded PES/DST, actual Ink/Stitch execution or physical stitch-out has passed.

## Important next engineering gates

1. Test the genuine moth in the owner-only development preview, measuring how many wing, body and vein parts are reconstructed and what the model omits. This may consume OpenAI API credits.
2. Improve **semantic pixel masks** for overlapping, semi-transparent, low-contrast wing details. The current polygon/foreground intersection is insufficient for professional naturalistic embroidery.
3. Implement verified satin columns (two rails/rungs or valid stroke-to-satin geometry), fill density and angle by region, underlay, layer and colour order, and trim/lock handling.
4. Run upstream Ink/Stitch with independently decoded PES/DST, then a physical stitch-out on realistic fabrics and hoops.
5. Only then consider calling the tool a professional embroidery file maker or publishing retail machine files.

**Official implementation references:** [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI vision limitations](https://developers.openai.com/api/docs/guides/images-vision), [Ink/Stitch workflow](https://inkstitch.org/docs/workflow/), [Ink/Stitch satin](https://inkstitch.org/docs/stitches/satin-column/).

**Release boundary:** Development PR #1 only. Do not merge experimental engine into `main` or claim machine-tested outputs without results.
