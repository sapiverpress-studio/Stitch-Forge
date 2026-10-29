# Sapiver Stitch Forge — MD-2.35 engineering handover

Date: 2026-10-29 (Europe/London)

## Repository and safety state

- Repository: `sapiverpress-studio/Stitch-Forge`.
- Active isolated branch: `feature/detailed-embroidery-analysis-no-deploy`.
- At session start, remote branch head was `e47dfddc6656cc4efde2346588af2c98dc7e947d`, matching the supplied MD-2.34 checkpoint. It was inspected, not reset.
- This handover and code were prepared locally. No push, GitHub Actions run, PR edit, merge, deploy, hosted-worker call, production-service change, secret change, OpenAI request or charge occurred.
- The repository has a connected Netlify project. The available read-only Netlify project listing confirmed its main URL and current published deploy, but did not expose whether arbitrary feature-branch deploys are enabled. Treat a push as deployment-risky until that setting can be verified; preserve this work locally.
- All Git commits must include `[skip netlify]`. Do not push until the branch-deploy risk is confirmed safe. Do not touch draft PR #1.

## What changed

### Native satin input

`services/digitiser/satin_native.py` now accepts the browser validator's geometry-only paired-rung response, converts its pixel coordinates to physical millimetres, repeats finite-coordinate, width, taper, turn, rail-crossing, rung, bounds, color and stitch-setting checks, then creates native Ink/Stitch satin paths. The generated SVG uses two rail subpaths followed by direction-rung subpaths and explicit `inkstitch:satin_column=true`, `inkstitch:satin_method=satin_column`, `inkstitch:zigzag_spacing_mm`, and optional `inkstitch:max_stitch_length_mm`.

The adapter is deliberately **not connected** to `project_bridge.py`, `machine_job.py`, the WSGI worker or browser export. The existing app still cannot automatically export detailed-art satin through its normal workflow.

### Real engine acceptance

`services/digitiser/satin_acceptance.py`, `tools/accept_satin_engine.py`, and `tests/test_satin_engine_acceptance.py` supply a repeatable synthetic control check. The local official Ink/Stitch 3.3.0 binary was installed from the existing pinned release archive (SHA-256 checked by the existing installer); pyembroidery 1.5.1 independently decoded PES and DST.

Straight synthetic column result:

- Requested geometry: 60 × 4 mm; four rungs; one red region.
- PES: 310 needle stitches, 2 jump records, 0 trims, 0 color changes, 60 × 4 mm bounds, max needle movement 4.02 mm.
- DST: 310 needle stitches, 3 jump records, 0 trims, 0 color changes, 60 × 4 mm bounds, max needle movement 4.02 mm.
- 301 sequential needle movements crossed at least 3 mm of the expected 4 mm satin width. All decoded needle points remained within requested bounds.
- A second gently curved 60 × 22 mm synthetic satin column also generated both formats and decoded to the requested extents.
- PES/DST coordinate origins differ by format, while the physical extents agree. Jump records differ (2 vs 3); do not compare them as if encoded identically.
- Source SVG `#CC2233` was stored by PES as Brother thread 5 Red `#ED171F`. Exact arbitrary RGB preservation is **not** achieved. DST has no full thread-color identity.

This demonstrates real engine execution and structural read-back for synthetic satin geometry. It does **not** prove the geometry is right for artwork, that underlay/density is suitable, that a machine accepts the file, or that the design sews well.

## Tests actually run

- `node --test tests/*.cjs tests/*.mjs`: **95 passed, 0 failed, 0 skipped**.
- Focused Python satin suite with the actual local engine: **11 passed, 0 failed, 0 skipped**. It includes the straight and curved engine export/read-back tests.
- Python non-browser regression: **77 passed, 0 failed, 3 skipped**. Skips are optional vector-benchmark dependencies.
- Full Python suite was attempted. Five Playwright browser test classes failed during setup because Chromium could not start in this container (`socket() failed: Operation not permitted`; crashpad `/proc`/ptrace restrictions). Playwright's browser downloader also returned HTTP 400. Do not claim a new browser, desktop, mobile or Android pass.
- Inkscape rendered the actual decoded PES stitch path comparison to PNG. The generated standalone HTML is offline/self-contained. It was rendered as a PNG but not opened in a browser here.

Detailed logs and samples:

- `docs/test-evidence/MD-2.35-python-tests-attempt.txt`
- `docs/test-evidence/MD-2.35-python-nonbrowser-tests.txt`
- `docs/test-evidence/MD-2.35-node-tests.txt`
- `docs/test-evidence/MD-2.35-native-satin/`
- `docs/test-evidence/MD-2.35-real-art-attempt.md`

## Realistic image attempt

One private Library kingfisher source (1353 × 1163 px) was used locally with the existing deterministic OpenCV edge-guide extractor. No model or hosted API was called. The full-size and 1000 × 860 px inputs were refused by the 45,000-edge complexity guard. At 768 × 660 px, the extractor returned its 220-guide cap: dense texture traces, not semantic reconstruction. The attempt failed acceptance and produced no machine file. The private image and overlay are outside the repository. See `docs/test-evidence/MD-2.35-real-art-attempt.md`.

## Still simulated, incomplete or unverified

- MD-2.34's butterfly comparison remains a synthetic, hand-authored geometry visualization.
- Satin geometry classification/rails still originate as proposals, not AI-validated artwork geometry.
- The new native satin input adapter is not integrated into the live project-to-machine path.
- No detailed-art automatic color segmentation has passed realistic source evaluation. No reusable three-subject licensed set exists.
- No directional fill sequence, underlay choice, overlap routing, thread-change optimization, tie-in/out, fabric compensation or density policy was validated in this milestone.
- The test uses Ink/Stitch defaults except explicit satin spacing/max stitch length; settings have no material-specific validation.
- PES remaps the tested arbitrary source red to a Brother catalog color. DST cannot preserve full thread palette metadata.
- No physical sewing, machine compatibility, fabric/stabilizer/thread combination, or commercial-quality verification.
- Full browser/mobile tests remain blocked by the local container browser restriction.

## Product conclusion

The code can now turn a **bounded synthetic satin rail/rung column** into actual Ink/Stitch-generated PES/DST and structurally decode those files. The overall Stitch Forge system still cannot be described as creating professional detailed-art PES/DST files. No realistic original artwork passed automatic reconstruction; no fabric quality was verified.

## Recommended next engineering task for standard ChatGPT

**Wire native satin geometry through a private, local-only machine-job acceptance branch without changing the deployed endpoint.** Extend the trusted project schema to carry validator-produced pixel/rung geometry plus source-scale metadata; convert it via `column_from_validated_pixel_rungs`, merge it with existing trusted running/fill regions, and update `inspect_plan`/machine audit to verify each satin region's decoded color, extent, stitch-length range and layer order. Add malformed, reversed, crossed, too-narrow/wide, curved, wrong-color and omitted-region rejection tests. Run the exact pinned local Ink/Stitch 3.3.0 engine and pyembroidery 1.5.1 on straight and curved fixtures. Keep live automatic export blocked until that path works and the resulting image-derived satin has been separately evaluated.

After that integration, build a private realistic-art evaluation harness around a licensed bird/moth and flower source. The current private kingfisher result shows the existing edge extractor caps out and emits noisy guides. Do not fake target regions, elevate those traces to stitch quality, or make a paid AI request without authorization.

## Repeatable local satin command

With the pinned engine already installed and its shared libraries available, run:

```bash
PYTHONPATH=services/digitiser \
STITCH_FORGE_INKSTITCH=/absolute/path/to/inkstitch \
python -m unittest tests/test_satin_native.py tests/test_satin_engine_acceptance.py -v
```

Or generate an evidence package:

```bash
PYTHONPATH=services/digitiser \
python tools/accept_satin_engine.py \
  --inkstitch /absolute/path/to/inkstitch \
  --output-dir /absolute/path/to/output
```

## Deployment recommendation

**Do not request a development-preview deployment yet.** The native satin path is not integrated with the application, the realistic image attempt failed, thread-color identity changes in PES, and browser/mobile checks were unavailable. Reconsider only after the integrated project-to-engine path and realistic source comparisons pass; deployment still requires Jim's explicit authorization.
