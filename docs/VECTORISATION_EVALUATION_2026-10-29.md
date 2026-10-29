# Local vectorisation evaluation — 29 October 2026 (MD-2.27)

Branch: `feature/detailed-embroidery-analysis-no-deploy`. No deployment, paid API or hosted engine invocation.

## Measured results

Executed the original `tools/bench_vectorise.py` successfully with **VTracer 1.0.0a4 actually installed**, then ran the extended matrix: eight original synthetic fixtures × six candidates × three tracing repetitions (144 executions). Every row completed. The JSON records per-colour missing/false pixels, connected components/holes, silhouette overlap, boundary deviation, RGB error, output size, tracing times, process peak RSS and repeated output hashes. All three outputs within each row matched; cross-machine determinism is not established.

The extended renderer composites alpha on white consistently. Its scores therefore supersede the original harness's direct RGBA→RGB conversion for this comparison; do not splice the two result tables together. The shading fixture is a **procedural wildlife proxy, not realistic wildlife acceptance**. The complex background is rejected by preflight; its colour scores are not a safety approval.

Macro colour IoU (1.0 = perfect labelled pixel overlap):

| Fixture | OpenCV oracle | VTracer original | VTracer detail | scikit-image oracle | Quantised marching | Felzenszwalb |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| logo | 0.9265 | 0.9663 | 0.9663 | 1.0000 | 1.0000 | 1.0000 |
| botanical | 0.9105 | 0.7070 | 0.9600 | 1.0000 | 0.9746 | 0.9996 |
| bird | 0.6989 | 0.3458 | 0.7578 | 0.9074 | 0.9115 | 0.9074 |
| fine_detail | 0.7809 | 0.9728 | 0.9728 | 1.0000 | 1.0000 | 1.0000 |
| holes_islands | 0.9323 | 0.4348 | 0.9779 | 1.0000 | 1.0000 | 1.0000 |
| transparent_holes | 0.9323 | 0.4348 | 0.9785 | 1.0000 | 1.0000 | 1.0000 |
| shaded_wildlife_proxy | 0.7566 | 0.5554 | 0.4567 | 0.9494 | 0.9264 | 0.9436 |

OpenCV and scikit-image **oracle** methods receive exact fixture palettes. The other candidates do not. Quantised marching uses Pillow MAXCOVERAGE (16 colours) followed by scikit-image marching squares; Felzenszwalb uses scale=30, sigma=0, min_size=4 and region mean colours. Parameters are recorded in source. No broad real-image superiority follows from eight fixtures.

## Decisions

- **Retain existing local JS extraction and Ink/Stitch.** No additional runtime dependency was installed in the app or worker.
- **Do not ship the original VTracer settings.** Bird and small disconnected colour preservation are inadequate. Detail mode (32 colours, 8-bit precision, speckle filter off) improves the bird and islands, but loses shaded detail and still requires compound SVG geometry and stitch planning.
- **Keep quantised marching squares as the next integration candidate**, alongside VTracer detail as a measured alternative. It preserves topology and simple colours well, but the bird remains imperfect; fixed 16-colour quantisation is not semantic segmentation or a calibrated thread palette.
- **Do not add Felzenszwalb to the live worker.** Measured benefits do not yet justify its larger dependency/runtime cost. No model weights, SAM or rembg installed.
- **Native process memory:** OpenCV 71–80 MiB; VTracer original 67–72 MiB; VTracer detail 67–85 MiB; marching candidates 119–128 MiB; Felzenszwalb 141–145 MiB in this run. RSS includes interpreter/imports and is measured before SVG rasterisation. It is not incremental library RAM or Android RAM.

## WASM feasibility — executed, not assumed

Official npm `@visioncortex/vtracer@1.0.0-alpha.4` contains a **668,378-byte WASM** module. Its published bootstrap targets **Node**, so a browser build/loader is still needed. A disposable adapter loaded the same module in Chromium 141 with a 390×844 mobile viewport. Initialisation: 61.4 ms. A simple two-colour fixture ran at 256/512/768/1024 pixels; 768px runs took 102–110 ms and WASM linear memory reached 20,578,304 bytes; 1024px reached 28,246,016 bytes. These are desktop-host measurements, not physical Android, total tab memory or complex-art worst cases.

**Conclusion:** browser execution is technically demonstrated and may avoid cloud preprocessing, but do not integrate yet. Next: an actual Web Worker build with cancellation and resource caps, complex-image stress cases, and real low-memory Android profiling. Current synchronous test would occupy the main thread; it is not the shipping architecture. No native Ink/Stitch browser port is implied.

## Reproduction and provenance

```sh
python -m pip install -r tools/requirements-vectorise.txt
python tools/bench_vectorise.py --output /tmp/original.json
python tools/bench_vectorise_extended.py --output /tmp/extended.json
npm pack @visioncortex/vtracer@1.0.0-alpha.4 --pack-destination /tmp
# Extract that official package locally, then:
python tools/bench_vtracer_wasm.py --package /tmp/package/pkg
```

Machine-readable evidence: `docs/test-evidence/MD-2.27-vectorisation.json` and `MD-2.27-wasm.json`. Benchmark dependencies remain optional and pinned separately from hosted requirements. No upstream executable/source is vendored in this repository.

Primary sources checked during this session:
- https://github.com/visioncortex/vtracer (official Python and npm package references; MIT OR Apache-2.0 package metadata)
- https://pypi.org/project/vtracer/1.0.0a4/
- https://scikit-image.org/docs/stable/api/skimage.segmentation.html (Felzenszwalb API)
- https://opencv.org/license/ (licence reference; distribution review still separate)

No machine-file or physical embroidery quality claim follows from these scores.
