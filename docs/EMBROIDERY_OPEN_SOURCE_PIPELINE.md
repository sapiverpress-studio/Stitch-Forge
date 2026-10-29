# Stitch Forge — Free/Open Source Analysis Engineering Assessment

**Status:** 2026-10-29 isolated experimental branch. **Deployment prohibited without express owner approval**; no Netlify or Google Cloud rollout, no new subscriptions.

## Verified existing stack

- Native Ink/Stitch 3.3.0 in private Cloud Run: real PES/DST, synthetic hosted tests independently decoded; *not a physically stitch-tested production file*.
- pyembroidery: independent structural decoding and machine-format checks.
- Browser pixel extraction: local, free, with no extra API request.
- One OpenAI vision call for semantic parts/approximate boundaries, currently `gpt-4.1`; this is **billable**. There is no guarantee of a few pence for every complex artwork.

## Open source alternatives (checked 2026-10-29)

| Library | Licence | Role | Stage |
| --- | --- | --- | --- |
| VTracer (visioncortex/vtracer) | MIT OR Apache-2.0 | Multi-colour raster-to-vector contour/region baseline; available Python native library, Rust and JS/WASM. Do not equate vectorized pixels to professionally digitised stitches. | **Benchmark first** |
| OpenCV >=4.5 | Apache-2.0 | Colour spaces, Canny, connected components, GrabCut, contours and masking. Could run in a local worker or existing backend; mobile OpenCV.js size needs measuring. | Benchmark |
| scikit-image | BSD-compatible permissive (project licence) | SLIC/graph-based segmentation to separate regions that share outer silhouettes; watershed for overlaps. Additional Python dependencies and RAM, not zero compute. | Benchmark |
| Lilo (Kadwood) | GPL-3.0 | Reference for existing photo -> regions -> stitches, real thread palette and editing. **Do not copy GPL code into proprietary web client without licence review.** | Review techniques only |
| rembg | MIT code; independently check bundled model weights | Background removal on photographic sources; may need CPU-heavy model weights and cold-start memory. | Optional/conditional |
| SAM 2 (Meta) | Apache-2.0 | Semantic segmentation possible but model weights, GPU/CPU load and cost are unsuitable for minimum-cost v1. | Defer |
| Ink/Stitch | GPL-3.0 | Already integrated, real embroidery execution and stitch structures; independent process service. | Retain |
| pyembroidery | Open source | Structural validation of PES and DST, colour changes, stitch counts, jumps and trims. | Retain |

Primary documentation:
- https://github.com/visioncortex/vtracer (licence and colour vectorization)
- https://opencv.org/license/
- https://scikit-image.org/docs/stable/api/skimage.segmentation.html
- https://lilo.kadwood.com/manual/licence-and-credits/
- https://github.com/danielgatis/rembg
- https://github.com/facebookresearch/sam2
- https://inkstitch.org/features/
- https://github.com/EmbroidePy/pyembroidery

## Implemented in this isolated branch

- Deterministic, local, bounded `analyseArtwork(rgba,w,h)`: foreground determination, quantised colour bins, prominent palette, edge density and coarse hotspot coordinates. Browser-sized image processing; original RGB/alpha stay in browser. Not semantic object segmentation, and the palette is not a thread specification.
- `reconstruct()`: source-pixel-matched colour mask for non-marking areas when an explicit proposed colour is supported by a distinct, substantial fraction of the source region; retain previous foreground-only validation for monochrome and uncertain swatches.
- One *unchanged* OpenAI request per explicit user action; no further model calls. Local audit is shown in status and uses same decoded 512px pixel canvas as reconstruction.
- Structured AI prompt specifically asks for part inventory and overlap relationships rather than texture hallucination.
- On an isolated in-memory JavaScript test harness, **13/13** existing and new synthetic reconstruction unit cases passed, including connected/disconnected foreground, pale art, true coloured markings, unsupported running lines, holes, rectangles, local palette inspection and blue/orange overlapping proposal region separation. **Not a browser-integration, live model or physical sew-out acceptance test.**

## Low-cost next experiment, gated

1. Evaluate VTracer on a *fixed, licensed, synthetic* set: one two-colour logo, overlapping two-colour wing, flower/leaf shapes, fine-line/feathered wildlife, and a complex photo background that should be rejected. For each, compare masks against pixel-ground truth: missing key regions, false stitched areas, coverage, boundary deviation, preserved topology/holes, disconnected components, SVG node count, CPU seconds and peak memory. No paid model call.
2. Investigate whether VTracer can run acceptably **in a browser Web Worker** on Android, avoiding Cloud Run requests entirely; profile WASM download/initialization/memory. If not, evaluate a local Python utility or the existing private Cloud Run worker **without deploying it or changing billable configuration**.
3. Once the deterministic baseline is stable, pass AI *semantic* region names and layers to it. Avoid guessing stitch types from colour alone; add explicit size and fabric constraints, density, satin width, underlay, overlap, thread and needle-change planning with Ink/Stitch parameter validation.
4. Re-run no-cost unit tests, synthetic browser test and Ink/Stitch CI; only then ask owner before any preview/production deploy or paid test. Real image and fabric tests are separate gates.

## Budget and rollout contract

- **No new subscriptions or new chargeable managed infrastructure.** Local JS/WASM trials and existing GitHub tests only until authorised.
- The current model call is pay-per-use, not free; one call per button click and no automatic retries. Native Cloud Run may have request/compute/storage costs even with min instances zero, so a free library does not guarantee a zero hosting bill.
- No GitHub PR opened or updated to the Netlify-linked development branch; all commits confined to `feature/detailed-embroidery-analysis-no-deploy` and marked `[skip netlify]`.
- **Do not deploy, merge, invoke production Cloud Run, or enable automatic builds without explicit owner approval.**
