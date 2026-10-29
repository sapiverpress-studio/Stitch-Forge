# Sapiver Stitch Forge — MD-2.37 engineering handover

Date: 2026-10-29 (Europe/London)

## Branch and safety state

- Repository: `sapiverpress-studio/Stitch-Forge`.
- Active branch: `feature/detailed-embroidery-analysis-no-deploy`.
- Starting HEAD: MD-2.36 local commit `8c2b856b15b7b700e5369b8b36b3244f51454fc5`; remote tracking head `e47dfddc6656cc4efde2346588af2c98dc7e947d`; branch was two local commits ahead at start.
- This milestone does not push or deploy. No Netlify operation, Cloud Run/hosted worker call, GitHub Actions workflow, PR edit, merge, paid AI/model call, or infrastructure change occurred.
- Do not push until feature-branch deploy-trigger behavior is independently verified. If a commit is made, include `[skip netlify]`. Do not touch PR #1, `main`, or `develop/stitch-engine-foundation`.
- The private real-art source and raw resized pixels were outside the repository. No source artwork or visual derivative was added to Git.

## Research conclusion: best next move

The next product blocker is automatic semantic region reconstruction on detailed art, not more satin SVG plumbing or edge-guide counts. The current deterministic `analyseArtwork` utility measures a foreground mask, coarse palette, edge density and hotspots. It does not create semantic bird/wing/eye/flower/branch regions. The existing paid AI plan route may be required to propose those geometries; one request was later authorized, but the route is absent from the current deployed site and could not be called.

The existing server function `netlify/functions/reconstruct-embroidery.mjs` uses `STITCH_FORGE_RECONSTRUCTION_MODEL` if configured, otherwise defaults to `gpt-4.1`; its request permits up to `max_output_tokens: 12000`. The deployed model override cannot be inferred from repository source and was not inspected. At the current official default gpt-4.1 rate of $8 per 1M output tokens, the output-token cap alone corresponds to $0.096, before prompt and image input. This is an upper bound only for the default model; it does not bound cost if the deployed model override differs. No request was made.

The owner subsequently approved one reconstruction request on the private kingfisher image. Attempted to access the existing production route without sending any image; the published site still serves Prototype 0.3 and `/api/reconstruct-embroidery` returned the site's 404 page. Therefore the approved model request **was not made**. No production/development deploy is authorized by that approval, and no local private analysis credential/runtime is available here. Do not try alternate routes or deploy without separate explicit authorization.

Two open-source candidates were reviewed against that gap:

- OpenCV GrabCut is an interactive foreground extractor. Its official sample begins with a user-drawn rectangle and supports foreground/background correction strokes. It is not the requested no-touch semantic multi-region path.
- Meta SAM 2 supports automatic masks for whole images, but its official repository currently lists Python 3.10+, PyTorch 2.5.1+, TorchVision 0.20.1+, and model checkpoint downloads; it describes a GPU machine and optional CUDA extension. Its output is masks, not stitch type, direction, thread mapping, layer semantics or a safe machine file. Adding the stack before an evaluation set would add substantial runtime and model complexity without proving the user need.

No new segmentation dependency was installed. The practical next step is to define and run a small realistic-art acceptance set against the existing reconstruction path; only then choose between improving the present geometry proposal flow and evaluating a local segmentation model. Do not incur AI/API cost without explicit authorization.

Official sources checked:

- Meta's [SAM 2 official repository](https://github.com/facebookresearch/sam2): installation requirements, checkpoint setup and automatic mask generator example.
- Meta's [SAM 2 project page](https://ai.meta.com/research/sam2/): promptable mask selection and image/video scope.
- OpenCV's [GrabCut tutorial](https://docs.opencv.org/4.12.0/d8/d83/tutorial_py_grabcut.html): initial rectangle, mask labels and manual correction workflow.
- OpenCV's [interactive GrabCut sample](https://github.com/opencv/opencv/blob/5.x/samples/python/grabcut.py): rectangle input and marked foreground/background strokes.

## Real-art run completed

The existing tracked browser module `site/auto-reconstruct.js` exports `analyseArtwork(rgba, width, height)`. This function does not call a model and has an input ceiling of 750,000 pixels. One user-provided model-generated kingfisher illustration from the private Library was materialized to a scratch-only directory and resized proportionally using Pillow; no original image or mask was copied to the repository.

Input: 1353 × 1163 px RGBA (1,573,539 pixels), reduced to 768 × 660 px (506,880 pixels) to fit the existing scan budget. Native Node.js 24.22.1 returned:

- Foreground: 236,887 pixels (46.7% of scan canvas).
- Coarse quantized RGB bins: 277.
- Top 12 histogram bins: 35.2% of foreground pixels; they are not thread colors or semantic regions.
- Edge density: 0.292; local heuristic label `high` detail.
- Semantic reconstructed regions: **0**.
- Recovered fine details: none. Rejected geometry: none was proposed. Stitch types: none. Ink/Stitch/PES/DST result: none.

Manual visual inventory for evaluation only: bird body, eye and long beak; layered blue/turquoise head and wing; orange breast; cream patches; feet; brown branch; blossoms, leaves and twigs. No polygons or masks were drawn from this inventory. It is not an automatic-reconstruction pass.

Report: `docs/test-evidence/MD-2.37-local-artwork-scan/real-art-pixel-scan-report.md`.

## Offline inspection tool

Added `tools/build_artwork_scan_proof.py`, which embeds the current tracked scanner source byte-for-byte into `docs/test-evidence/MD-2.37-local-artwork-scan/Artwork_Scan_OFFLINE.html` and stores its SHA-256 in an HTML data attribute. This self-contained responsive page lets a user choose an image from the device, runs only the deterministic scan inside the browser, and reports the measured foreground/palette/edge metrics. It does not send the selected image over a network.

The page shows four panels based on evidence that exists: selected original artwork; local pixel scan measurements; an explicit statement that no region geometry was reconstructed; an explicit statement that no stitch plan or PES/DST files exist. It downscales proportionally to at most 700,000 canvas pixels and rejects dimensions the local scanner cannot process. It can save the scan metrics as JSON. It does not falsely display reconstructed regions or simulated/actual stitches.

This page is a developer inspection aid, not a digitiser and not a browser-tested product UI. The original image is selected by the user at runtime and is not embedded in the page or repository.

## Tests and limits

- `node --test tests/test_artwork_scan_proof.cjs`: **2 passed, 0 failed**. Checks byte-identical tracked scanner embedding, source hash, absence of external scripts/network API calls, honest absent-evidence labels, and JavaScript syntax.
- The actual real-art `analyseArtwork` invocation ran in native Node 24.22.1. Exact metrics are recorded above.
- `node --test tests/*.cjs tests/*.mjs`: **97 passed, 0 failed, 0 skipped**.
- Browser rendering, mobile/Android, Python, Ink/Stitch, machine-file decode and physical embroidery were **not run** in MD-2.37.
- No image-based reconstruction was produced. The scan's high-detail flag and histogram do not prove region segmentation quality.

## Next task for continuation

1. Prepare a small reusable acceptance set covering a detailed butterfly/moth, bird, and flower/overlapping illustration. Use artwork with clear rights; keep any private originals outside the public repository and record provenance/dimensions.
2. Run the **existing automatic geometry reconstruction** against each without hand-authoring target polygons. One paid request was approved but blocked because its production endpoint is not present. To continue, first make the endpoint available through an expressly authorized route; do not infer deployment permission from model-call approval. Respect the 12,000 output-token cap and unknown deployed model override.
3. For every image, record which expected visible features are represented, missing, merged, recovered, rejected or uncertain. Preserve source-pixel audit results and blocking reasons.
4. Only after the real region output passes those checks, send it through the MD-2.36 local-only satin project-to-engine path. Add decoded per-region movement/color/density evidence, then seek physical sew-outs from appropriately equipped testers.
5. Keep the standard app/export and worker satin schema blocked until the above evidence supports exposure. No development preview is justified by MD-2.37 alone.
