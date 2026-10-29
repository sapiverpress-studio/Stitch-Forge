# Stitch Forge — AI detail analysis and embroidery region workflow

**Status:** Development preview, not commercially usable digitising. Updated 2026-10-28.

## The actual moth failure

The source SVG `Tiles _20261028_062147_0000.svg` includes two embedded PNG images: one black-and-white silhouette mask and one full-colour moth (447 × 262 pixels). The full-colour image contains wing veins, individual markings, textured body, antennae and subtle colour boundaries. Previous v0.3 tracing reduces its foreground to an outer contour and loses the internal stitch structure. The problem is not an absent source detail or a DPI issue.

## Architecture, adapted from DRW

DRW implementation reference: `sapiverpress-studio/Sapiver-draw-dxf/tools/analyse_drawing.py` and DRW's server-side structured proposals. As in DRW, an image analysis model identifies potential structure but **cannot authorise the machine geometry**.

1. Preserve the original full-detail raster/SVG reference in the browser. The user explicitly initiates AI analysis.
2. Browser resizes and submits a small JPEG of the image to a protected Netlify Function `/api/analyse-embroidery`. The image is transmitted to OpenAI on this action.
3. Netlify Function authenticates a private access token, then uses `OPENAI_API_KEY` from server-side Netlify environment variables. No key appears in the JavaScript bundle or source repo.
4. OpenAI Responses API uses vision and strict JSON-schema output, with `store:false`. Returns visible parts, approximate bounding boxes, thread colours and suggested stitch treatment.
5. The editor draws annotated boxes and shows a review list; **it does not automatically add any geometry to the machine export**.
6. **Experimental local worker module now implemented, NOT integrated into the editor:** `services/digitiser/detail_guides.py` detects approximate internal edge contours with OpenCV, optionally restricted by an AI-proposed region box. Three local tests passed, including the full-detail user moth (source kept off GitHub). **Still needed:** accurate pixel masks/centrelines, scale-aware pruning, editable region review, merging/splitting, holes, satin rails, underlay, size warnings and human approval before generating Ink/Stitch commands.
7. Real Ink/Stitch execution, independent PES/DST readback, fabric stitch-out and evidence-based approval still required.

## Draft stitch generation from an approved AI report (2026-10-28)

The development preview now provides **Use saved AI report**, **Rebuild draft details** and **Apply draft to stitches**. This is a new, explicit draft-generation stage, not a professional-file exporter.

1. The AI report identifies possible regions (bounding boxes, category and visual colour). A downloaded `Stitch-Forge-region-proposal-NOT-DIGITISED.json` can be imported without another chargeable OpenAI call.
2. `site/ai-guides.js` decodes the original artwork locally, detects local dark-vs-surrounding contrast inside *line-like* regions (wing markings, veins, antennae and legs), thins candidate pixel lines and builds connected running-stitch **guides**. It does **not** stitch the AI rectangles.
3. Draft paths are shown as pink overlays separately from editable machine geometry. The old silhouette remains untouched until the owner selects **Apply draft to stitches**.
4. Apply appends draft running paths in a single undoable operation, enforcing path and node limits. The existing browser stitch simulator recalculates using these paths, but its DST/PES outputs are still experimental **single-colour** machine files.
5. `wing` and `body` fill candidates and `satin_candidate` antennae are intentionally not converted to fill/satin yet. True closed contours, accurate masks, thread-colour sequencing, underlay and fabric-tested stitches remain future work.

**Original moth result:** using the user-supplied original 447×262 image and the 14-area JSON report, the first internal extractor produced multiple short line candidates from the image, mainly some forewing markings/veins and antennae. It did **not** faithfully recover all decorative details. An automatic replacement of the original contour would therefore be misleading. Draft review is mandatory.

### Safety and acceptance

- [x] Candidate guides computed from image pixels, restricted to AI-proposed search areas.
- [x] Synthetic zero-line image returns zero draft paths (cannot turn rectangles into stitches).
- [x] Image-derived running paths only, no auto-produced fill or satin.
- [x] Explicit Apply action, with undo support and guarded insertion into editor paths.
- [x] A saved AI report can be loaded without another API request.
- [ ] Exact live mobile preview, append, undo and export re-readback tests.
- [ ] High-detail line recovery, scale-aware simplification, overlap/jump optimisation.
- [ ] Real Ink/Stitch PES/DST stitch sequence, colours and professional stitch-out.

Do **not** sell files produced by this draft generator or label the prototype a production-grade digitiser.

## Manual closed-region fill milestone (development preview, 2026-10-28)

**Engineering finding:** The user's 14 AI proposals are broad overlapping boxes, not wing boundaries. In the full-detail moth, the left and right upper-wing boxes contain about 91% and 99% foreground pixels, and the body box nearly 100%. Simply clipping the foreground to an AI box would yield nearly rectangular tatami fills covering other structures. This would be misleading and waste material.

**Implemented controlled alternative:** `site/fill-geometry.js` checks non-self-intersecting closed polygons, finite in-artwork coordinates, minimum area and extent, point spacing and vertex limits. `site/fill-boundary-ui.js` lets the owner tap 4–120 points along the *actual* visible wing/body boundary in the SVG canvas, close it, inspect a green semi-transparent shape, and explicitly add a `tatami` region with one Undo step. No AI bounding rectangle enters the stitch list.

The editor keeps its existing paths. The ZIP's editable `_source.svg` now carries physical `mm` dimensions and separate closed filled paths vs running strokes. **This is geometry for further editing in embroidery software, not evidence that Ink/Stitch or a machine will stitch it successfully.** Current PES/DST exports still produce only experimental single-colour basic fills and are not professional.

**Test gates:** JS geometry checks passed in isolation, including crossing/duplicate rejection; Node tests and mobile Chromium test were committed and made CI requirements. Netlify development deployment ready does not alone prove that a fabric stitch-out succeeded. Before an accurate automatic fill solution, implement segmentation masks with interior cuts/holes, overlap review, stitch direction, underlay, colour sequencing and a validated Ink/Stitch export.

- [x] Owner-controlled closed fill boundary and preview with protected undo
- [x] Refuse self-intersection, outside-artwork points and degenerate fill shapes
- [x] Editable SVG retains closed fill objects and physical design dimensions
- [ ] Confirm exact mobile automation and physical SVG import in upstream Ink/Stitch
- [ ] Create reliable *automatic* source-image wing/body masks rather than manual boundaries
- [ ] Build satin rails for antennae and narrow elements, validated fabric compensation and thread-change routing

## What the current feature does and does not do

**Does:** Identify likely separate wing surfaces, veins, spots, thorax, abdomen, antennae and other visible features; provide a list and location boxes for manual review; permit a JSON export of the proposal; preserve existing editable paths and exports.

**Does not:** Produce accurate masks, make satin rails, stitch colours into PES/DST, restore detail absent from source pixels, guarantee manufacturer thread matches or determine machine compatibility.

For fine naturalistic artwork, an embroidery version may require artistic simplification, different stitch angles, reduced colour palette and physically tested density. The model cannot infer the right result from appearance alone.

## Authentication and operational setup

In **Netlify > Project configuration > Environment variables**, set the following values for the *Stitch Forge* site, scoped to **Functions** and preferably only the development deploy context while testing:

- `OPENAI_API_KEY`: private API key with appropriate budget/limits, never committed or included in HTML.
- `STITCH_FORGE_ANALYSIS_TOKEN`: a separate, long, random private token for owner-only access to the analysis endpoint. **Do not use the OpenAI API key as this token.**
- `STITCH_FORGE_VISION_MODEL` (optional): defaults to `gpt-4.1-mini`. Model prices/availability should be reviewed before switching.

The mobile editor asks for **analysis access token** each session, held only in the password input, never persisted. The token is sent to the server in an Authorization header; the API key remains exclusively server-side. The backend requires both secrets, rejects missing token and limits submissions to a 1.6MB PNG/JPEG/WebP source, with an upstream timeout and 24 region cap.

**Operational risk:** A shared token is a minimum internal testing control, not a scalable login system. Before any public rollout: move to authenticated accounts, add server-side durable rate/budget quotas, abuse monitoring and concurrency limits. Disabling public access or leaving `OPENAI_API_KEY` unset prevents unexpected model charges. Users should understand their submitted image is transmitted to OpenAI. An API key in Netlify can incur separate usage costs beyond a ChatGPT subscription.

No OpenAI call was made or billed by these tests. No artwork uploaded to the GitHub repository.

## Test/acceptance criteria

- [x] Source code for authenticated vision analysis function and region-map UI staged on development branch.
- [x] Synthetic source-only tests validate model output structure, coordinate bounds, API access token requirements, and image magic numbers.
- [ ] Actual OpenAI Responses request with budget-controlled test image succeeds using configured secret, producing correct response schema and visible moth parts.
- [ ] Confirm real moth wing regions have useful boxes corresponding to original artwork; no invented/duplicated pieces.

- [x] Experimental, review-only internal edge contour extraction from raster with optional ROI, locally tested on synthetic and moth data. This is not integrated into the editor or verified on fabric.
- [ ] Implement actual pixel-derived internal segmentation masks (not AI bounding boxes alone).
- [ ] Connect reviewed mask/path regions to Ink/Stitch satin/fill/underlay and independent machine output audit.
- [ ] Perform physical stitch-out and refine.

**Release rule:** Do not describe AI analysis as 'professional embroidery file generation' until internal path/stitch conversion and physical quality gates pass.

## Primary references

- OpenAI Responses API image input: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Netlify secure function variables: https://docs.netlify.com/build/functions/environment-variables/
