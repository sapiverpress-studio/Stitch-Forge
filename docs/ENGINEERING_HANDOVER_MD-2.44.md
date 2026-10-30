# Sapiver Stitch Forge — MD-2.44 engineering handover

Date: 2026-10-29 (Europe/London). Continuation of the owner's instruction to fix the app as a whole, without speculative paid attempts or repeated deployments.

## Resume here

- Local branch: `feature/reconstruction-root-cause-md242`. MD-2.43 parent commit: **`03097ca6d79b74d4dc994129dd8a98357a89d552`**. This milestone is committed on that local branch; obtain its exact HEAD with `git rev-parse HEAD` or the accompanying checkpoint manifest.
- GitHub main was checked again at completion: **`033234cde699644048598cee65bb166bdb3191ea`**. There is **no GitHub commit containing MD-2.43/44**: both are local, unpushed. Do not claim otherwise.
- Last verified production source is still MD-2.40 `597547e3f7f6a1e92eab846fd3ffe55842710fb4`, deploy `6ae383086f1e6ec8b8d5e47f`. No deployment action occurred in this continuation. The MD-2.41 guard on main and local MD-2.43/44 are not proven deployed.
- Do not push until deployment-trigger risk is resolved or an exact safe release is explicitly authorised. A prior push/deploy anomaly means `[skip netlify]` alone is not sufficient evidence of safety. Every local commit includes it nevertheless.
- No PR was opened or changed, no merge/main update, hosted worker, paid AI request, infrastructure, subscription, production setting, credential or secret change occurred. Repository build checks were updated locally; that does not execute a Netlify deployment.
- Read `docs/ENGINEERING_HANDOVER_MD-2.43.md` for the app-connected source inspection/diagnostic contracts and runtime preparation. Do not repeat the original root-cause investigation or deploy a prompt tweak.

## What works now

### App-wide source inspection and private replay (MD-2.43, executed again here)

The actual existing app loads exact source-mask topology, automatic palette partitions, private source-project save/reopen, physical size edits and even-odd geometry SVG downloads. All selected pixels survive holes/islands and source mask→ring→mask conversion. Unresolved geometry stays machine-ineligible; legacy paths are hidden and playback/PES/DST/ZIP/native-project export are blocked in source inspection mode. It is a source draft, not a compound stitch editor.

The three licensed PNG inputs have actual automatic geometry and browser evidence. Raw-PNG Node results: butterfly 193,187 selected pixels / 5,983 pieces / 100 holes; macaw 157,119 / 1,470 / 28; rose 202,807 / 1,332 / 1. **These are not semantic feature-accuracy results.** The macaw has 27,581 selected pixels beyond RGB distance 60 from its proposed 12-colour palette. Thousands of small pieces remain for review. Partial-alpha exclusions and browser-canvas rounding are disclosed in MD-2.43.

Validated AI proposals and rejection codes can be deliberately downloaded privately, then replayed against matching analysis pixels, with no additional AI or worker request and no editor mutation. Captures exclude image/header/token/raw/free model text; artwork geometry remains private. Server-rejected raw model geometry is still unavailable; such captures are honestly non-replayable.

### New: actual source-derived compound fill → PES/DST → independent audit

`services/digitiser/compound_native.py` implements the explicit **local-only** `stitch-forge-local-compound-control-v1` contract. It accepts numeric source pixel rings, full-image physical width, source identity, complete unique region order and explicit angle/spacing/stitch-length/underlay settings. It does not accept the browser source-draft schema, approval booleans, imported SVG, images, unknown parameters or credentials. The production project bridge, WSGI allowlist, machine job and Netlify machine endpoint remain unchanged.

Exact pinned source inspection found that Ink/Stitch 3.3.0's `FillStitch.original_shape` sorts subpaths by area, treating the largest as outer and all other subpaths as holes. Therefore **each disconnected component must be its own native path**. Nested islands are separate paths; they must not be added as another hole in a colour object's single path.

Native input has `fill-rule=evenodd`, `inkstitch:fill_method=tatami_fill`, explicit angle, row spacing, maximum stitch length, underlay boolean, underpath and travel stitch length. Underlay controls set a perpendicular angle, 3× row spacing, explicit length, 0.3mm inset and underpath. Compensation/expansion are explicitly zero. These are controlled test parameters, **not fabric presets**.

The existing compound validator checks ring self-intersection, quantised degeneracy, strict hole containment and non-touching/non-nested holes. The local builder also bounds source dimensions, total paths/vertices, small/narrow bounding boxes, planning density and holes below the decoder audit's 0.44mm resolution limit. The bounding-box check is not proof of minimum local feature width on arbitrary shapes.

`tools/extract_compound_control.cjs` authors declared synthetic raster controls, then feeds their RGBA pixels through the **same automatic source-region extractor used by the app**. It does not supply ideal polygons to that extractor. The fixtures are intentionally simple engineering controls, not AI reconstruction or detailed wildlife success.

`services/digitiser/compound_acceptance.py` runs the real local pinned engine and independently reads the PES/DST with pyembroidery 1.5.1. It checks:

- Every decoded needle point and every complete needle segment against its requested source-colour region, including holes. Segment/boundary intersections catch a long stitch crossing a void even when both endpoints are inside fill.
- Complete END, stitch count and command/work budgets, maximum actual needle move, colour-change sequence, PES palette order, physical needle extents, dominant fill direction and median decoded row gap.
- DST source-frame coordinates anchored by an explicit native global origin command. PES uses a single translation from the corresponding first DST needle; **every** later PES/DST needle is cross-checked. No rotation, rescaling or arbitrary geometry fitting is used.
- 0.11mm boundary tolerance covers the 0.1mm machine format grid. Regions/holes below that proof resolution are refused, not silently filled.
- Jumps/trims/stops are counted separately; jump moves are excluded from decoded needle visualisations. DST thread identity is not claimed.

The SVG-origin marker is generated numeric metadata using the native `inkstitch_origin` symbol/use mechanism (`commands.py` and `output.py`), not an additional embroidery path.

## Actual four-control machine results

All four generated real PES **and** DST locally, with equal needle counts and zero detected needle points/segments outside the intended colour regions/voids. Each has one colour change, PES palette `#ed171f` then `#0a55a3`, PES 3 jumps + 1 decoded trim, DST 4 jumps + 0 decoded trims, and no stops. Cross-format trim behaviour is not proven equivalent.

| Declared synthetic raster control | Needle stitches per format | Needle extents mm | Source boundary extents mm | Measured row gap mm | Long-stitch length following angle ±4° | Max needle move mm |
|---|---:|---|---|---:|---:|---:|
| 0° donut + detached colour, width 80mm | 1,537 | 70.0 × 47.4 | 70.0 × 48.0 | 0.6000 | 95.85% | 3.500 |
| 37° donut + detached colour | 1,655 | 70.0 × 48.0 | 70.0 × 48.0 | 0.5994 | 93.10% | 3.581 |
| 0° with perpendicular underlay | 2,177 | 70.0 × 47.8 | 70.0 × 48.0 | 0.6000 | 71.53% | 3.500 |
| 90°, nested island, underlay, resized width 64mm | 1,427 | 44.5 × 38.4 | 44.8 × 38.4 | 0.6000 | 72.21% | 3.500 |

Requested top row spacing is 0.6mm and nominal max stitch 3.5mm. Decoded diagonal rounding reaches 3.581mm; the audit permits 0.15mm rounding allowance. That is not a universal machine hard-limit guarantee.

**A real failure was investigated, not hidden:** the first audit demanded that fill needle extents equal the source polygon extrema within 0.11mm. Horizontal/underlay cases failed, while diagonal passed. Raw decoding showed 47.4/47.8mm height versus a 48mm outline. Inspection of native fill grating and default bbox-centred origin showed why an extent-based translation was also unsuitable. The repair uses an explicit full-source-frame origin and absolute source-colour point/segment checks. Fill-bound shortfalls are limited to one row at each edge (2× spacing + 0.11mm), with no expansion beyond 0.11mm. No fictitious outline stitches are added to force a bounding-box match. First failed and subsequent verified probe logs are retained.

## Executed tests, exact counts

- Configured local build command: **18 JS/MJS files + one inline script** pass syntax/referenced-file checks; **131 Node tests pass, 0 fail, 0 skipped**. Includes exhaustive 65,536 4×4 mask cases, project roundtrips, malformed topology/dimensions, tiny-eye palette uncertainty, diagnostics privacy/replay and existing regressions.
- Focused Python suite: **63 pass, 0 fail, 0 skipped**. Modules: `test_compound_native`, `test_project_bridge`, `test_compound_geometry`, `test_trusted_svg`, `test_satin_engine_acceptance`, `test_format_audit`, `test_worker_wsgi`, `test_stitch_planning`, `test_region_parameters`, `test_satin_native`. This includes **3 actual new compound engine tests** and **3 rerun existing real satin engine tests**, not mocks. Wrong colour order and missing END are deliberately rejected.
- Actual Chromium: **7 pass, 0 fail, 0 skipped**, desktop 1280px/mobile 390px. Covers app source inspection, all three licensed rasters, save/reopen/physical edits, diagnostic capture/replay/wrong-source refusal, unchanged stitch plan on failure, blocked stale exports/playback, offline private-image inspection, and the four-control actual machine-proof page at both widths. HTTP API responses in these browser tests are explicitly synthetic mocks; no paid request or hosted worker call.
- Additional real evidence build: four compound controls, each exporting and independently decoding both formats. Underlay increased the same source's actual needle count from 1,537 to 2,177. These are evidence cases, not four extra automated unit-test passes.
- MD-2.43's earlier missing-library, browser-download and single-process harness failures remain in its evidence folder. The new initial extent-assumption failures are in MD-2.44. Do not relabel them passes or historical tests as new runs.

`netlify.toml` now uses `node tools/check_frontend_syntax.cjs && node --test tests/*.cjs tests/*.mjs`. This **local repository build gate** includes all new native Node tests, uses no model/engine/network, and was executed locally. Chromium and native Python tests are explicit separate local runs; this change does not install a browser/engine or deploy through Netlify. Netlify configuration guidance was used; no Netlify write tool was called.

## Owner-visible files

1. `docs/test-evidence/MD-2.43-source-region-drafts/Source_Regions_OFFLINE.html`: licensed original artwork versus actual automatic source geometry, measured palette uncertainty, and private on-device upload/inspection. Android/desktop verified. No simulated or absent stitch panels.
2. `docs/test-evidence/MD-2.44-compound-machine/Compound_Machine_Evidence_OFFLINE.html`: explicit synthetic original raster | automatically extracted native geometry | actual decoded PES | actual decoded DST. Android/desktop verified, no network.
3. Each MD-2.44 case folder contains actual `actual.pes`, `actual.dst`, `actual-pes-dst.zip`, native SVG, decoded SVG/PNG, source PNG, source-extracted local contract and `machine-report.json` with file hashes. These are genuine engine outputs for controls only.
4. Browser screenshots: `compound-proof-desktop.png`, `compound-proof-mobile.png`, plus fresh app/source-inspector regression screenshots. Final build/Node/Python/Chromium logs, initial failure log, origin probe and inspected upstream file SHA256s are adjacent.

No private owner artwork, uploads or screenshots were committed. All illustration fixtures are previously verified CC0; all new machine controls are authored synthetic pixels.

## Reproduce immediately

Use the temporary zero-cost local runtime prepared in MD-2.43:

```sh
node tools/check_frontend_syntax.cjs
node --test tests/*.cjs tests/*.mjs
LD_LIBRARY_PATH=/tmp/stitchforge-md243-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md243-deps:tests STITCH_FORGE_INKSTITCH=/tmp/stitchforge-md243-engine/inkstitch/bin/inkstitch python -m unittest test_compound_native test_project_bridge test_compound_geometry test_trusted_svg test_satin_engine_acceptance test_format_audit test_worker_wsgi test_stitch_planning test_region_parameters test_satin_native
LD_LIBRARY_PATH=/tmp/stitchforge-md243-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md243-deps python tools/build_compound_proof.py --engine /tmp/stitchforge-md243-engine/inkstitch/bin/inkstitch
```

Node Chromium tests: `tests/browser/source_regions.cjs`, with `STITCH_FORGE_CHROMIUM=/tmp/stitchforge-md243-browser/chromium-host`, JSON `STITCH_FORGE_CHROMIUM_ARGS` from temporary `@sparticuz/chromium` defaults, removing disabled web-security/site-isolation/insecure-content switches; `STITCH_FORGE_EVIDENCE` sets screenshot output. Launch a fresh single-process browser for each test. See MD-2.43 for exact decompression/library setup if `/tmp` was wiped. No hosted browser is needed.

Primary references inspected:

- [Official Tatami fill documentation](https://inkstitch.org/docs/stitches/fill-stitch/): closed coloured paths with holes, direction, row spacing, underlay and travel controls.
- Pinned v3.3.0 source commit `b0edd96311ece82ee48816dc93466274b12c2a9c`, local `/workspace/scratch/183197fe5ca2/inkstitch-source-v3.3.0`: `lib/elements/fill_stitch.py`, `lib/commands.py`, `lib/output.py`. Their actual read-file hashes are in MD-2.44 evidence.
- Engine release archive verified by the existing installer: SHA256 `162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79`; pyembroidery 1.5.1 independently reads the results.

## Remaining blockers, ranked

1. **Source-supported semantic grouping and colour fidelity.** The current 12-colour partition retains geometry but fragments artwork and can merge rare eye/feather colours. Stable source IDs exist; a verified region/feature graph and AI grouping/labels over them do not. No paid AI response was generated this session.
2. **Whole-art stitch planning and compound editing.** Choose running/satin/fill and layering from physical features, retain true outlines/holes, plan overlapping base areas and preserve source colours. The new native bridge only accepts explicit local control plans; it does not automatically plan the thousands of artwork fragments. The browser source draft has no ring-point/stitch-plan editor.
3. **Whole-project native acceptance and routing.** Per-component attribution inside repeated same-colour blocks, local bottleneck width, density concentration, trims/jumps and final relative layer coverage remain incomplete. The new two-colour control audit is not general automatic digitising approval.
4. **Realistic artwork/physical acceptance.** No detailed butterfly, bird, flower or kingfisher passed semantic reconstruction → stitch planning → real PES/DST here. No painted/textured artwork or physical embroidery quality is verified. Satin/rung/classifier previews for real-art features remain provisional, despite genuine synthetic satin and fill engine controls.
5. **Release controls.** Deployment triggers must be verified before any push; no production release is justified as a completed Target 2 fix. The owner can inspect the offline packages now. A later explicitly authorised isolated preview of inspection/diagnostic tools could be useful, but it should not prompt more paid reconstruction retries without acceptance evidence.

## Exact next task for standard ChatGPT

**Build and evaluate a topology-aware source-region graph before another paid model call.** Start in `site/source-region-project.js`, `source-topology.js` and the CC0 manifest. Preserve all ledgers, holes, physical scale and private replay. Add source-supported grouping/adjacency and explicit rare high-contrast feature preservation; do not merge a tiny eye/vein into a dominant palette merely because it is small. Keep changes inspectable and machine-ineligible until per-feature/source-colour checks pass. Use the same butterfly/macaw/rose plus synthetic missing-eye, detached feather, hole, transparent, narrow and malformed controls; measure any lost/merged features, not just retained pixel area.

Then define AI semantics/stitch intent over stable source IDs instead of asking the model for every boundary vertex. Implement/mock/test that contract locally; no paid request without authorisation. Only a complete, source-faithful plan should enter a later whole-art native acceptance path. Reuse the new compound native/independent auditor and existing satin code, rather than emitting visual guide zigzags into machine files. Keep production, main and PRs untouched.
