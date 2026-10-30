# Sapiver Stitch Forge — MD-2.43 engineering handover

Date: 2026-10-29 (Europe/London). Owner instructed “Proceed” with the app-wide repair after MD-2.42. This is engineering in the existing app, not a redesign or deployment.

## State to resume

- Isolated local branch: `feature/reconstruction-root-cause-md242`, parent `7d9cddbf1f3a42e6e334e2f2c0a69535bd38a5a9` (MD-2.42).
- This milestone is committed locally with `[skip netlify]`; use `git rev-parse HEAD` for its exact commit. It has **not been pushed**.
- GitHub main was checked again using the connected GitHub API: still `033234cde699644048598cee65bb166bdb3191ea`. No remote file, PR, merge or workflow was changed.
- Last read-only production verification remains deploy `6ae383086f1e6ec8b8d5e47f` / source `597547e3f7f6a1e92eab846fd3ffe55842710fb4` (MD-2.40). No Netlify deployment operation occurred in MD-2.43. Do not confuse local results with the deployed app.
- A push remains unsafe until deployment triggers are resolved. Earlier `[skip netlify]` behaviour did not establish that a push cannot deploy. Preserve the local branch.
- No new paid AI call, hosted worker call, infrastructure, subscription or private-art upload occurred. Public evidence uses only the verified CC0 fixtures already added in MD-2.42.

## What actually changed

### Exact source topology now reaches the app

`site/source-topology.js` converts the existing RLE mask ledger into all oriented pixel-edge rings, retaining four-connected components, holes and nested islands. It removes only collinear points. Signed area must equal the source pixel count. A separate scanline rasteriser independently reconstructs the mask for acceptance tests. All **65,536 possible 4×4 binary masks** round-trip exactly. Touching corners/rings receive explicit review flags rather than being silently smoothed. Edge/vertex/rasterisation budgets bound work; resource refusals retain the authoritative ledger.

`site/source-region-project.js` provides the versioned `stitch-forge-source-region-project-v1` contract. Automatic nearest-palette partitioning assigns every *selected foreground* pixel to one colour group, with no overlaps. Palette centres come from the existing on-device scan; this is **not AI or semantic segmentation**. Every region has a stable ID bound to a SHA256 of the analysis RGBA8 pixels plus big-endian dimensions. RLE masks are authoritative; loading regenerates canonical contours and refuses malformed grouping or accounting. User-supplied eligibility/topology fields cannot approve an export.

The full source image width is explicitly in millimetres, with one common axis scale and a derived height. Size edits leave mask/ring geometry unchanged. JSON save/reload and even-odd SVG export preserve holes and islands. The project contains private artwork geometry, but no raster, access token or free model text. It is downloaded deliberately, not stored or uploaded automatically.

`site/source-region-ui.js` is loaded by the actual `site/index.html`. Its “Inspect source regions (free)” control works on the original raster, supports JSON reopen against the exact same pixels, size edits and geometry downloads. It is a **source inspection mode**, separate from legacy editable stitch paths. Legacy paths/nodes are hidden, canvas point edits are suppressed, playback/PES/DST/ZIP/native-project export are blocked during inspection. Returning to the stitch editor restores the earlier paths. A validated legacy AI replacement ends inspection atomically.

This is not yet a compound stitch editor. Ring control-point editing, semantic grouping, source-region stitch assignment and conversion of these thousands of fragments to a native stitch plan remain unimplemented. Do not relabel the draft as professionally digitised.

### Private diagnostics and replay prevent another blind attempt

`site/reconstruction-diagnostics.js` captures the received **validated geometry proposal**, safe server rejection codes, local rejection counters/reasons, source fingerprint, assessment and application stage. The UI exposes “Download private diagnostic” even after an all-regions rejection, plus local replay using the same original pixels.

- Images, headers, tokens, raw response bodies, arbitrary IDs, labels, notes and free model text are excluded by an allowlist. Proposal IDs are replaced with stable local aliases.
- Geometry is still private artwork-derived data: the UI says to keep the file private.
- Captures remain in memory until the owner downloads them; image import clears them. No automatic upload/storage is added.
- Replay verifies pixel dimensions/hash and algorithm revision, invokes the actual existing reconstruction/audit, compares the recorded assessment and **never applies a design or calls AI/worker**.
- A server rejection with no usable geometry is honestly marked non-replayable. The raw model response that failed server validation still cannot be reconstructed retrospectively.
- `auto-reconstruct.js` now attaches local rejection reasons when all regions fail. No fidelity gate is loosened. Images narrower than 48 analysis pixels are refused rather than stretched to an artificial aspect ratio.

## Actual licensed-raster results

These PNGs are existing vector-origin CC0 illustrations, not textured paintings. Original SVG paths were never supplied to extraction. The Python/Pillow → Node evidence run used the stored PNG RGBA8 directly; a browser canvas may round partially transparent RGB differently, so browser fingerprint/count reports are recorded separately.

| Raster | Selected pixels retained exactly | Pieces | Holes | Small pieces retained | Pixels >RGB distance 60 from palette |
|---|---:|---:|---:|---:|---:|
| Butterfly 768×680 | 193,187 | 5,983 | 100 | 5,843 | 1,973 |
| Macaw 550×768 | 157,119 | 1,470 | 28 | 1,355 | 27,581 |
| Rose 764×768 | 202,807 | 1,332 | 1 | 1,214 | 57 |

All three verify mask→ring→mask equality, non-overlap, exact selected foreground union, save/reload and physical-size edit. This is **geometry preservation, not feature accuracy**. The existing foreground threshold excludes 1,211 / 894 / 813 partially visible alpha-edge pixels respectively; zero fully opaque pixels were excluded for these fixtures. White-on-white, complex backgrounds and palette-limited eye/feather colours remain risks. One explicit tiny-eye test records palette uncertainty instead of claiming that its colour survived.

Actual engine stitch types, layering and embroidery quality for these three images: **not generated or verified**. Thousands of fragments still require semantic grouping; colour approximation is significant on the macaw.

## Tests executed now

- Full native Node suite: **131 pass, 0 fail, 0 skipped**. Includes 18 new topology/project/diagnostic tests; the exhaustive 4×4 matrix is one test with 65,536 cases.
- Actual Chromium: **6 pass, 0 fail, 0 skipped**, using desktop 1280px and mobile 390px. Actual app upload/inspection, three licensed sources, save/reopen/size edit, safe diagnostic download/replay/wrong-source refusal, no additional mocked API request, export/playback blocks, no horizontal overflow, offline custom-image inspection and downloads. No real AI or worker request.
- Python project bridge **11**, compound validator **6**, trusted SVG **2**: **19 pass**.
- Restored the checksum-pinned official Ink/Stitch 3.3.0 and pyembroidery 1.5.1 locally, then reran **3/3 existing real satin acceptance tests**, including mixed satin/fill. They generated/decoded real synthetic PES/DST during this milestone. This is a regression of the earlier local satin path, **not machine evidence for source-region drafts**.
- Early engine attempt skipped 3 because no executable was set; first configured attempt errored 3 because `libwayland-server.so.0` was missing. Extracting Ubuntu's local dependency resolved this; final actual engine run passed 3. Keep those logs, do not count early skips/errors as passes.
- Default Playwright browser download was truncated. A temporary `@sparticuz/chromium` 153.0.0 package supplied the binary. Initial shared-browser test harness lost its browser after closing the last context; separate browser instances per test fixed the harness. Initial 1/5 pass and final 6/6 logs are retained. This did not require deployment.

Evidence folder: `docs/test-evidence/MD-2.43-source-region-drafts/`.

- `Source_Regions_OFFLINE.html`: Android/desktop standalone actual before/after comparisons, palette uncertainty overlays, and an on-device uploader running embedded byte-recorded app modules. No external fetch or fake stitch panel.
- Per-source actual source PNG, automatic SVG/PNG, uncertainty PNG, private-schema JSON from public CC0 inputs, report JSON.
- Actual browser screenshots: `offline-mobile.png`, `offline-desktop.png`, `app-mobile-source-controls.png`, `app-desktop-source-controls.png`, `app-desktop-macaw-source-geometry.png`.
- `browser-licensed-reports.json` records actual browser-canvas results, separate from the raw-PNG Node run.
- Final and initial test logs; embedded source-module SHA256 list.

## Reproduce without deployment

```sh
node --test tests/*.cjs tests/*.mjs
python tools/build_source_region_proof.py
python -m unittest discover -s tests -p 'test_project_bridge.py'
python -m unittest discover -s tests -p 'test_compound_geometry.py'
python -m unittest discover -s tests -p 'test_trusted_svg.py'
```

Local temporary runtime, not production dependencies:

- `/tmp/stitchforge-md243-deps`: pyembroidery 1.5.1 (`PYTHONPATH`).
- `/tmp/stitchforge-md243-engine/inkstitch/bin/inkstitch`: official pinned 3.3.0 installed with `services/digitiser/install_engine.py`; archive SHA256 remains `162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79`.
- `/tmp/stitchforge-md243-native-libs/usr/lib/x86_64-linux-gnu`: extracted `libwayland-server0` 1.22.0-2.1build1 from configured Ubuntu snapshot. Set `LD_LIBRARY_PATH` to it for engine tests. No system/production service or credential was changed.
- `/tmp/stitchforge-md243-browser/chromium-host`: decompressed serverless Chromium; SwiftShader libs extracted beside it. Package helper's `chown` fails in this environment, so archives were decompressed without owner changes. Browser test flags are the package defaults with `--disable-web-security`, `--allow-running-insecure-content`, `--disable-site-isolation-trials` removed. Use `STITCH_FORGE_CHROMIUM`, JSON `STITCH_FORGE_CHROMIUM_ARGS`, `STITCH_FORGE_EVIDENCE`, then `node --test tests/browser/source_regions.cjs`. Keep a fresh browser per test for this single-process binary. No hosted browser session is necessary.

## Exact next engineering task

**Verify bounded source-derived compound fill/hole geometry through the native local engine and independent decoding.** Inspect pinned Ink/Stitch fill source first. Start with a declared synthetic raster donut/disconnected-island control; feed its automatically extracted pixel rings through the existing bounded `compound_geometry.py` validator and a local trusted native SVG builder. Explicitly configure angle, row spacing, maximum fill length and underlay; no fabric preset. Decode every STITCH/JUMP/TRIM/colour change and test hole interiors/segments, physical scale, direction and extents. Flag or refuse stitched travel crossing a supposedly empty hole. Keep source draft schema and hosted allowlist machine-ineligible.

After that: source-pixel region grouping/semantics (especially eye/feather/vein colours), editable compound stitch plans, bounded routing/density and per-region actual-file attribution, then realistic artwork acceptance and eventual fabric sew-out. Do not deploy this inspection milestone as a completed automatic digitiser.
