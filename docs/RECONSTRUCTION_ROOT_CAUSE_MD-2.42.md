# App-wide reconstruction diagnosis — MD-2.42

Date: 2026-10-29. Scope: the reconstruction pipeline for supported artwork, not a patch for one uploaded bird.

## Findings supported by executed code

The existing pipeline is `vision-model vertices → polygon/colour intersection → connected components → one outer boundary → editable paths → machine gate`. Several steps cannot represent ordinary detailed artwork reliably.

| Reproducible input | Existing behaviour | Consequence |
| --- | --- | --- |
| Large solid rectangle, no irregularities | One region, 100% coverage | Control works |
| Same 7,744-pixel rectangle plus one disconnected pixel | Rejects the entire proposal as `small_components_not_stitchable` | A tiny unresolved part removes the valid large region too |
| Same rectangle with a one-pixel transparent hole | Rejects the entire proposal as `fill_holes_not_supported` | The single-ring editor contract cannot preserve the hole |
| Colour distributed among many small marks | Rejects the entire proposal as `too_many_components` | Threshold colour masks fragment on texture and antialiasing |
| Closed triangle with three distinct vertices | Reported `degenerate_outline` after removing the repeated closing point | Valid polygons were incorrectly refused |

These are image-independent controls. The first three refusals remain intentional export blocks until the missing geometry contract is implemented; removing the blocks would silently lose or fill artwork. The correct repair is to retain the source geometry and mark unresolved stitch decisions separately.

The triangle defect has been corrected locally across endpoint validation, reconstruction, manual fill closure and provisional classification. Collinear, flattened and malformed shapes remain rejected. Python bridge tests confirm a three-corner closed fill already has a valid native SVG representation. No native engine run was made here.

The actual 17:44 owner response was not retained. We cannot replay its exact 14 client rejections or attribute them all to the AI. The screenshot proves incomplete output; the controls above independently prove that our client can discard substantial geometry even when source evidence exists.

## Source-mask prototype

`site/source-mask-ledger.js` stores every selected pixel in bounded row runs, including holes and disconnected components. Small parts are retained with review flags. It is **not loaded by the editor, not a segmentation model and not a stitch generator**.

- Six targeted tests cover exact retention of a large region plus tiny island, holes, 729 separate details, diagonal connectivity, corrupt/overlapping data and explicit complexity refusal.
- On 36 whole-frame colour-mask probes across the licensed butterfly, macaw and rose inputs, the existing contour pipeline returned a result for only 4 masks. The ledger round-tripped all **36/36 masks exactly**.
- These probes use automatic palette colours and whole-frame search areas to isolate mask handling. They are **not AI reconstruction acceptance**. Masks may overlap, and exact mask storage does not establish correct semantics, stitch suitability or complete image reconstruction.

This demonstrates a general way to prevent source-pixel loss during intermediate representation. Topology-aware contours and a safe project/engine contract still need implementation.

## Open-source candidate trial

Three existing CC0 illustrations are now reusable raster fixtures: a multicolour butterfly with veins/spots, a macaw with eye/face/feathers/perch, and a rose with overlapping petals/leaves. Attribution, licence, original dimensions and hashes are in `tests/fixtures/artwork-evaluation/manifest.json`. They are vector-origin illustrations rendered to PNG; source SVG geometry is never given to extraction. They do not establish acceptance on textured paintings or every artwork class.

Ran VTracer 1.0.0a4 with three fixed configurations across all three inputs, twice each: **9 cases / 18 conversions**, identical repeated outputs. A simple replacement of the current algorithm with this tracer is not sufficient.

Before this final reproducible benchmark, 30 exploratory conversions checked raw transparent input and preview-clipped measurements. Invisible RGB contaminated raw-alpha tracing, and preview clipping made some image metrics look better. Those numbers are not used below. The final benchmark composites the input on white and measures the unmodified SVG render before preview clipping.

| Source, same colour-cutout/16-colour settings | Source pixels within RGB distance 60 | Source edge recall within 2px | Paths | Paths with multiple rings | Largest path commands |
| --- | ---: | ---: | ---: | ---: | ---: |
| Butterfly | 93.9% | 92.5% | 101 | 2 | 2,270 |
| Macaw | 47.3% | 80.7% | 65 | 5 | 412 |
| Rose | 90.6% | 62.8% | 14 | 2 | 422 |

These measure the unmodified vector render. PNG previews additionally clip alpha to the source for inspection; that display clip is **not** valid native geometry. The butterfly exceeds the current 512-point path limit. Every tested configuration produces compound paths, which the editor cannot preserve end to end. Some colours/internal details are lost even when the silhouette looks plausible. None is accepted as embroidery.

Inspect `test-evidence/MD-2.42-reconstruction-root-cause/offline-comparison.html`. It is self-contained, has a responsive layout, and shows real inputs versus actual vector candidates. It contains no stitch simulation or machine-file panel. The static JS/no-network check passed; browser/mobile execution was not run.

## What the app-wide fix requires

1. **Make masks the geometry source.** Derive candidate colour/edge regions from original pixels and preserve every component and hole. Carry explicit unresolved parts forward; never discard a whole mass because a small part needs review. The tested ledger is the first storage step, not the completed region extractor.
2. **Use AI for interpretation and stitch intent over stable region IDs.** The model can label/group source-derived candidates and suggest layer order or directions. Its text coordinates should not be the sole source of fine organic boundaries. The current default is `gpt-4.1`; the hosted model override was not inspected. OpenAI documents precise spatial-localisation limitations for vision models, so another prompt alone does not establish this capability.
3. **Extend the editor/project/native bridge for compound regions.** Preserve outer rings, holes, islands, colour identity and physical scale through save/edit/export. The existing Python `compound_geometry.py` validates holes but is explicitly not wired to the engine. Verify actual Ink/Stitch output leaves requested holes unsewn before enabling export. Do not just raise component/vertex caps or remove checks.
4. **Make failed requests replayable locally.** Retain the schema-checked model proposal and bounded rejection ledger in memory, with a user-downloadable private diagnostic file tied to the source hash/dimensions. Exclude the image and credentials by default. Re-run geometry locally while debugging instead of purchasing another model response and deploying for every change. This is still to implement.
5. **Pass a whole-pipeline acceptance matrix before a release.** Include the three licensed illustrations plus logo, line-only, transparent, tiny-detail, disconnected, hole and malformed cases. Require source detail/colour checks, then actual local engine output, independent decode, and later physical stitch-out. Pixel metrics alone cannot certify professional embroidery.

The next coding task is the topology-aware source-region contract and replay tooling. MD-2.41's new gate is a safety improvement; its prompt addition is unverified and is not evidence of a quality fix. A new deployment is not needed to continue this local work.

## Tests and limits

- Ten JavaScript syntax checks passed.
- Full native Node suite: **113 passed, 0 failed, 0 skipped**.
- Python project/secure-SVG/compound-geometry suite: **19 passed, 0 failed**.
- First full Node run: 106/107 passed. Its failure was a pre-existing comparison of the historical MD-2.37 embedded scanner with the mutable current module. The historical module still matched its declared SHA-256. The test now pins that historical digest instead of falsely expecting it to change with production. The historical HTML was not rewritten.
- No new OpenAI call, hosted worker, GitHub Action, Netlify deployment, PES/DST generation, machine compatibility check or fabric test.

All changes are on the isolated local branch `feature/reconstruction-root-cause-md242`, based on GitHub main `033234cde699644048598cee65bb166bdb3191ea`. No main or production update was made for this investigation. Production was read-only checked and still reports deploy `6ae383086f1e6ec8b8d5e47f` / source `597547e3f7f6a1e92eab846fd3ffe55842710fb4`.

## Primary references inspected

- [OpenAI images/vision limitations and sizing](https://developers.openai.com/api/docs/guides/images-vision): spatial localisation and image resizing limitations; GPT-4.1 high-detail behaviour.
- [OpenCV contour hierarchy](https://docs.opencv.org/4.13.0/d9/d8b/tutorial_py_contours_hierarchy.html): parent/child rings and `RETR_CCOMP` / `RETR_TREE`.
- [VTracer Python API](https://github.com/visioncortex/vtracer/blob/master/crates/vtracer-py/README.md): source-colour and watershed/cutout options tested locally.
- [scikit-image segmentation](https://scikit-image.org/docs/stable/api/skimage.segmentation.html): reviewed as another local candidate source; no scikit-image segmentation acceptance result is claimed.

The proposed architecture is an engineering recommendation supported by these failure reproductions and library capabilities. A complete replacement pipeline has not been validated yet.
