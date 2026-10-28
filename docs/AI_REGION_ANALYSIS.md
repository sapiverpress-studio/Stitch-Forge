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
