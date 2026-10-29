# MD-2.37 private real-art pixel-scan evaluation

## Input and privacy

- Source: a user-provided, model-generated kingfisher illustration in the user's private Library. It was materialized to a private scratch directory for this local analysis.
- Original dimensions: **1353 × 1163 px**, RGBA.
- The original and any source-derived images remain outside the Git repository. No artwork, screenshot, mask, or visual overlay is included here.
- No network request or model/API call was made during analysis.

## Method

Ran `analyseArtwork` from the tracked `site/auto-reconstruct.js` module using native Node.js 24.22.1. The original contains 1,573,539 pixels, above the local scanner's 750,000-pixel ceiling, so the source was proportionally resized to **768 × 660 px** (506,880 pixels). No regions or target polygons were manually authored.

## Observed output

- Scan source: `local_pixel_scan`.
- Foreground pixels: **236,887** (about **46.7%** of the scan canvas).
- Coarse quantized RGB bins: **277**.
- Highest 12 coarse palette bins cover **35.2%** of the detected foreground. They are frequency bins, not embroidery thread assignments.
- Edge density: **0.292**; existing heuristic reported `high` detail.
- Foreground scan completed. **Semantic regions detected: 0.**
- Fine details recovered: none. The scanner does not perform geometric detail recovery.
- Rejected or uncertain geometry: not applicable; this stage created no geometry.
- Proposed/verified stitch types: none.
- Ink/Stitch/PES/DST output: none.

Manual visual inventory of significant visible features (not machine geometry): the bird body, eye and long beak; layered blue/turquoise wing and head; orange breast; cream facial/body patches; feet; brown branch; pink/white blossom groups; green leaves and twigs. This list is an inspection note only and was not used to produce masks.

## Interpretation

The existing local scan correctly surfaces that this image is detailed and has a broad colour distribution. It does not separate the bird, wing, markings, flowers, leaves, or branch into usable regions. Therefore this run **does not pass automatic reconstruction acceptance** and does not exercise the MD-2.36 local satin machine route.

The offline page `Artwork_Scan_OFFLINE.html` embeds the tracked scanner source byte-for-byte. It allows a user to select a local image and inspect the existing scan on desktop or Android without uploading the artwork. Its later panels explicitly state that no reconstructed geometry, stitch plan, or machine output exists.

## Research decision

- OpenCV GrabCut is an interactive foreground-extraction technique initialized with a rectangle and optionally corrected with user-labelled foreground/background strokes. It is not a fit for the requested automatic, semantic colour-region reconstruction.
- Meta's official SAM 2 repository documents automatic mask generation for images, but also requires the PyTorch/TorchVision stack (the current README lists PyTorch 2.5.1+ and torchvision 0.20.1+) and model checkpoints; the setup describes a GPU machine and optional CUDA extension. Its masks would still need semantic assignment, stitch-family selection, colour/thread mapping, topology and independent machine-file validation.
- Neither tool is being installed or presented as a solution in this milestone. A heavyweight segmentation dependency is not justified before a reusable annotated acceptance set exists and demonstrates the current automatic-reconstruction bottleneck.

## Exact verification

- Native Node command: `node --test tests/test_artwork_scan_proof.cjs` — **2 pass, 0 fail**.
- Full native Node command: `node --test tests/*.cjs tests/*.mjs` — **97 pass, 0 fail, 0 skipped**.
- Browser rendering was not run. No machine-file test applies because this analysis created no geometry or machine file.
