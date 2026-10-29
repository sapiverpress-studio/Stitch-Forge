# Stitch Forge — offline vectorisation benchmark, 29 October 2026

**Code:** [`tools/bench_vectorise.py`](../tools/bench_vectorise.py), on isolated `feature/detailed-embroidery-analysis-no-deploy` only. **No Netlify deploy, Cloud Run worker, OpenAI request, new hosted service or chargeable benchmark.**

## Execution

- Executed with **Python 3.13.5, numpy 2.3.5, OpenCV 4.13.0, Pillow 12.3.0 and CairoSVG 2.8.2** in an isolated runtime.
- Five **original, deterministic, synthetic 256×256 RGB test images**: a four-colour logo, coloured botanical motif, stylised small bird, 2-pixel fine lines, and a textured photo-like background intentionally marked unsuitable for automatic digitising.
- Generated OpenCV **exact-palette ("oracle")** polygon contours, rasterised generated SVGs back to RGB, and evaluated per-colour intersection-over-union, foreground IoU, RGB reconstruction error, SVG path count and execution time.
- **VTracer 1.0.0a4 was not available to this runtime.** An attempted `pip download --no-deps vtracer==1.0.0a4` failed because the package index was unreachable (DNS); a direct PyPI wheel download also failed. **No VTracer quality or performance result is claimed.** The test harness runs VTracer automatically if installed from a trusted package source, without changing any Stitch Forge service.

## Measured OpenCV benchmark — single non-representative local run

| Fixture | Macro colour IoU | Foreground IoU | RGB MAE | SVG paths |
| --- | ---: | ---: | ---: | ---: |
| Four-colour logo | 0.9265 | 0.9694 | 3.02 | 6 |
| Botanical motif | 0.9105 | 0.9618 | 1.88 | 4 |
| Bird with thin feather marks | **0.6989** | 0.9413 | 3.34 | 7 |
| Fine-detail stripes (2px) | **0.7809** | **0.8606** | 10.99 | 25 |
| Complex textured background | 0.9665* | 0.9665* | 60.31 | 11 |

*The apparent high IoU for the complex background measures only the expected red foreground against white; **it does not indicate accurate background reconstruction or sewing safety**. The separate border-uniformity preflight correctly rejected this fixture, while passing the four clean-background fixtures.*

**Interpretation:** Even with an unrealistically perfect, pre-supplied palette, reconstruction becomes notably less reliable on fine markings and the bird. A high silhouette overlap can conceal missing internal details. Basic raster-to-SVG conversion cannot automatically choose satin/tatami/running stitches, density, underlay, thread order, fabric compensation or safe treatment of holes.

## How to reproduce, without any external API

```sh
python -m pip install numpy opencv-python Pillow cairosvg
# Optional, only when a trusted package source is reachable:
python -m pip install vtracer==1.0.0a4
python tools/bench_vectorise.py --output /tmp/stitchforge-vector-results.json
```

The program explicitly reports `vtracer_benchmarked: false` when the package is not available; it never invents a result. The OpenCV baseline is **favoured** by knowing the exact input palette, so a head-to-head VTracer comparison must either share that palette or score unsupervised methods separately. For comparable hardware timings, repeat runs on the *same machine* and report median plus memory use.

## Gates before integration

1. Install a verified VTracer wheel in a disposable test environment, run both candidates on identical synthetic assets, and measure *fine-line, hole and colour-region fidelity* instead of just aggregate IoU.
2. Add higher-resolution and naturally shaded artwork; verify off-image backgrounds are never mistaken for thread. Benchmark on a low-memory Android browser if exploring WASM; measure actual bundle size and cold-start time.
3. Keep **AI one-call-per-image** and free deterministic preprocessing by default. Do not add repeated model passes or a new cloud GPU as a shortcut.
4. Do not put vector output directly into PES/DST without independent geometric and stitch validation. Require an actual machine stitch-out before professional-use claims.
5. Do not merge to deploy-linked `develop/stitch-engine-foundation` or `main`, open PRs, or run Netlify deploys without owner approval. Commit messages use `[skip netlify]` as an extra safeguard.

## Cost

This run used existing local Python libraries. No new subscription or metered API requests were issued; it does not establish a hard upper bound for future Netlify/Cloud Run charges.
