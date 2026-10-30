# Stitch Forge — MD-2.46 practical boundary grouping and physical candidates

Date: 2026-10-29 (Europe/London). The owner authorised the next phases and clarified: **a high-quality match/likeness is the goal, not perfection**. Retain recognisable shapes, convincing colours, important eyes/veins/markings and clean boundaries; simplify fine shading/texture when appropriate. Do not treat every source shade or antialiased pixel as a required thread colour/stitch object.

## Exact state

- Isolated local branch: `feature/reconstruction-root-cause-md242`. Parent MD-2.45: **`5944b9415979871542a20ad24220ea1aec5f2fda`**. This handover/implementation is committed locally; get its exact HEAD from Git or the supplied checkpoint manifest.
- GitHub main was rechecked: **`033234cde699644048598cee65bb166bdb3191ea`**. These local MD-2.45/46 commits are **not on GitHub**. No push, PR, merge, deployment or Actions trigger occurred. Every commit includes `[skip netlify]`.
- Last production verification remains MD-2.40 source `597547e3f7f6a1e92eab846fd3ffe55842710fb4`, deploy `6ae383086f1e6ec8b8d5e47f`. This continuation did not change production or inspect/change secrets/settings. No paid model, hosted worker, infrastructure or subscription call.
- Do not push until deployment-trigger risk is resolved or an exact safe release is explicitly authorised. Existing `[skip netlify]` observations did not establish safety. Preserve the local work.
- Read MD-2.45 for the source graph/palette implementation and MD-2.44 for the pinned local native runtime and its machine-file controls. Do not repeat the original investigation or spend another deployment guessing at the model's rejected polygons.

## What now works in the existing app

### Source reference and working approximation are distinct

MD-2.45 added source-hash-bound reference components, exact selected-pixel RLE, real adjacency, small contrast candidates and bounded 12-colour approximation. The free source inspection action in `site/source-region-ui.js` uses this graph; V1 saved projects still read, and V2 saved geometry/colour evidence is checked against the actual original analysis pixels on reopening.

**This phase does not change the earlier paid model-coordinate “Reconstruct embroidery automatically” route.** It still needs replacement/integration with source-ID intent and whole-art native planning. The current real app changes are in the free analysis/inspection path and its candidate download. Do not report the entire image-to-PES/DST product fixed.

### New: bounded one-step boundary grouping

`site/source-region-graph.js` now supports `bounded_reference_graph_MD-2.46`, retaining MD-2.45 parsing/replay. A possible boundary blend may change its **working colour** only when:

- Its reference node has at most four pixels, is a recorded interpolation candidate, and is not a protected contrasting core.
- Its parent is a directly adjacent stable source node with at least 16 pixels. Every changed pixel must be orthogonally adjacent to that exact parent. The parent cannot itself be an eligible tiny reassignment, so the algorithm does not propagate/iterate a chain.
- Mean colour error and additional error stay inside explicit RGB bounds; source-protected neighbour contrast is not newly weakened below the stated guard.

All decisions use the original assignment. Reference IDs, runs, source colour statistics, selected foreground and transparent voids stay unchanged. Each change is recorded with child/parent, before/after colour, pixel count and one-analysis-pixel spatial bound. Validation recomputes the permitted changes, not a supplied approval claim. At 80mm full image width, the bound is about 0.104mm butterfly/rose, 0.145mm macaw. At other sizes, the bound changes; it is not a universal fabric or machine guarantee.

The working approximation may have **worse pixel colour error** while having fewer tiny regions. That is an explicit trade-off for the owner's likeness target, not evidence those marks were certainly noise. No pixels or candidate objects are automatically omitted. Small-detail biology and human visual quality are still unverified.

### New: source-bound physical candidate report

`site/source-stitch-candidates.js` and the app's “Download stitch candidates · unverified” action produce `stitch-forge-source-stitch-candidates-v1`. Every source node appears exactly once in a working object. The report includes physical area, perimeter, bounds, protected source IDs, holes, contour count, a **thinness indicator** and a provisional geometry axis. Categories are possible fill, narrow-detail review, small-detail review and tiny-blend review.

- `2A/perimeter` and bounding dimensions are **not minimum local width**. A geometry axis is **not feather/fur/semantic stitch direction**.
- No running centreline, satin rails, row spacing, underlay/fabric preset, actual stitch plan or needle instruction is generated.
- Tiny blends remain in the report. Omission/simplification is a review suggestion, not an action or approval.
- A SHA256 binds source identity, graph algorithm, actual working assignments, palette and physical image width. Resizing/recolouring/stale objects invalidate bindings. The app checks for source/size changes while a download is pending.
- All objects and reports remain `machineEligible:false`; both local native control and legacy hosted conversion reject these inspection/candidate schemas, even with a forged true flag.

## Actual licensed-image measurements

Existing CC0 vector-origin illustrations were tested as PNGs. No original vector boundaries, AI-generated ideal regions or private owner artwork were used. These are **working likeness measurements, not semantic accuracy or embroidery quality scores**.

| Input | MD-2.45 working pieces → MD-2.46 | Pixels whose working colour changes | Reference nodes, all retained | >RGB60 pixels MD-2.45 → MD-2.46 |
|---|---:|---:|---:|---:|
| Butterfly | 6,208 → 2,786 | 4,174 | 7,985 | 839 → 3,003 |
| Macaw | 1,199 → 856 | 1,008 | 3,520 | 6,118 → 6,686 |
| Rose | 1,180 → 367 | 1,040 | 1,679 | 12 → 164 |

The earlier MD-2.44/common-colour baseline had 1,973 / 27,581 / 57 >RGB60 pixels respectively. Therefore **do not claim every final image has better pixel fidelity**. The bird retains a large colour improvement over the old path; butterfly/rose grouping trades fine colour fidelity for simpler boundaries. All 193,187 / 157,119 / 202,807 selected analysis pixels remain represented. Partial-alpha/background exclusions are unchanged; this does not prove every original high-resolution feature survives 768px analysis.

Protected core pixels reassigned: **zero**, measured from change records. All reference geometry/IDs compare unchanged against unsimplified MD-2.45 graphs. Working mask→ring→mask, save/reopen and physical resize roundtrips pass. Source contrast candidates still need semantic/visual review.

At 80mm full-image width, automatically generated **unverified** candidates are:

| Input | Possible fill | Narrow detail | Tiny blend review | Omitted |
|---|---:|---:|---:|---:|
| Butterfly | 46 | 550 | 2,190 | 0 |
| Macaw | 43 | 240 | 573 | 0 |
| Rose | 45 | 168 | 154 | 0 |

These counts expose the outstanding narrow-detail/planning work. They are not verified stitch families. Do not pass all narrow objects to generic fills or emit visual zigzags as native satin.

## Executed tests and failures

- **145 Node tests pass, 0 fail, 0 skipped.** Includes the full previous suite, source graph tests, four new boundary-grouping tests and four new physical-candidate tests. The earlier exhaustive 65,536 small-mask cases run inside one topology test.
- Syntax gate: **20 app/function JS/MJS files + one inline script** pass, and all app script references exist. The existing configured build automatically includes the new modules/tests; no Netlify build or deployment was triggered.
- **63 Python tests pass, 0 fail, 0 skipped**, using the exact focused module command from MD-2.44. **Six execute real local engines:** three compound controls and three existing satin controls, generating real synthetic PES/DST with independent decoding during this continuation. Source-graph/candidate schema rejection was expanded. This is a native regression, **not real-art export evidence**.
- **11 Chromium tests pass, 0 fail, 0 skipped.** Actual app controls at 390/1280px, all licensed images, same-pixel reopening, private diagnostics replay/export blocks, the tiny-eye palette control, candidate downloads, size-bound signatures, stale pending-download refusal, historical real machine evidence, and the new offline tool with a private synthetic image. No paid API/hosted worker request. Phone-sized/touch emulation is **not a test on the owner's physical Android device**.
- Initial new candidate test: 7/8 passed; one assertion expected one hole. The fixture actually has a transparent hole **and a separate eye-colour hole** in its base colour. Corrected expected count to two; the final suite passes. No geometry was changed to make the assertion pass. The failure log is preserved.
- MD-2.45's initial overflagging of antialiased candidates and later palette measurements are preserved in that earlier evidence folder. Do not hide colour trade-offs or present all candidates as proven eye/feather errors.

## Evidence the owner can use now, without deployment

`docs/test-evidence/MD-2.46-boundary-planning/Working_Likeness_OFFLINE.html` is self-contained:

- Actual original PNG | MD-2.45 working colours | MD-2.46 grouped boundaries for all three illustrations.
- Exact measured loss/trade-offs, fragment counts, one-pixel bound and candidate limits. No simulated needle or absent machine-file panel.
- **Private local uploader using the actual embedded app modules**. The owner can try their original PNG/JPEG/WebP, compare original/working geometry, toggle tiny-boundary simplification, set physical image width and download private source project/SVG/unverified candidates. No token, upload, AI charge, worker call, automatic persistence or cloud storage.
- Embedded module SHA256 manifest, actual generated PNG/SVGs and source/candidate JSON, changed-boundary pixel masks rendered to PNG, per-source report and aggregate report.
- Chromium desktop/mobile screenshots, exact final syntax/Node/Python/browser logs and the initial failed test.

This is an offline inspection tool, **not a deployed replacement application or embroidery exporter**. Physical Android opening behaviour remains owner-unverified; desktop/mobile Chromium file-page execution passed.

For genuine decoded machine-control evidence, retain MD-2.44's `Compound_Machine_Evidence_OFFLINE.html` and actual PES/DST/ZIP reports. No new realistic-art machine files were produced in MD-2.45/46. No physical embroidery was tested.

## Reproduction

```sh
node tools/check_frontend_syntax.cjs
node --test tests/*.cjs tests/*.mjs
python tools/build_region_graph_proof.py --output docs/test-evidence/MD-2.46-boundary-planning --version MD-2.46
LD_LIBRARY_PATH=/tmp/stitchforge-md243-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md243-deps:tests STITCH_FORGE_INKSTITCH=/tmp/stitchforge-md243-engine/inkstitch/bin/inkstitch python -m unittest test_compound_native test_project_bridge test_compound_geometry test_trusted_svg test_satin_engine_acceptance test_format_audit test_worker_wsgi test_stitch_planning test_region_parameters test_satin_native
```

Chromium setup is unchanged from MD-2.44/43: temporary serverless Chromium 153, SwiftShader alongside binary, fresh browser per test, package-default flags minus disabled web-security/site-isolation/insecure-content flags. `tests/browser/source_regions.cjs` uses `STITCH_FORGE_CHROMIUM`, JSON `STITCH_FORGE_CHROMIUM_ARGS` and optional `STITCH_FORGE_EVIDENCE`. No hosted browser needed. `/tmp` runtime locations may need restoring if the workspace is restarted; pinned native archive and dependency instructions are in MD-2.44.

## Additional realistic private-art acceptance attempt — blocked

After the licensed-raster tests, the existing private painted illustration was tested locally without any model/worker call. Original 1353×1163; existing 768×660 RGBA analysis. Both the normal evaluator and a direct graph call refuse at **30,000 reference nodes**. No geometry or machine file was produced. Source/artwork was not changed or published.

Private-only resolution probes: 512×440 still reaches the same node limit. At 384×330 the graph builds 29,372 nodes / 8,892 working pieces, but private project download exceeds the existing 8MB limit; 9,627 pixels are >RGB60 and source features are not verified. Downsampling is therefore **not an accepted fix**. Defaults and resource limits were not loosened to force this case through.

A scratch-only palette-first experiment at the original 768×660 analysis assigned all 236,887 selected pixels to 12 histogram-derived colours before connected-component construction. That probe yields 23,355 components / 67,770 runs and 18,619 >RGB60 pixels, but no production/app fallback or likeness acceptance is implemented in this milestone. It suggests the next efficient step: a clearly labelled bounded colour approximation when the full fine-reference graph cannot fit, retaining source verification and blocking stitch approval. Do not claim a graph/semantic or native pass from this experiment. No private image/derived geometry was added to the repository; only deidentified measurements/failure logs are retained.

## Ranked blockers and exact next task

1. **Resolve textured-art reference complexity without raising limits or silently dropping detail.** The private painted case exceeds node/download budgets. Test a bounded palette-first preview that still accounts for every selected pixel, explicitly lacks a full reference graph, and stays machine-ineligible. Measure and visually inspect the approximation before integrating it. Then **integrate the real automatic reconstruction workflow with source-ID stitch intent.** The paid model still proposes polygon vertices through the earlier route, while improved source geometry is in free inspection. Design a bounded manifest of significant source objects and residual texture groups; AI should label/group stable IDs and propose layer/stitch intent, not invent every fine boundary. Keep exact residual accounting and the owner's likeness target. Implement/mock-test the contract locally before requesting any paid test.
2. **Narrow detail planning.** The report identifies hundreds of narrow/review objects. Recover true source-supported running centrelines and paired satin rails/rungs, with physical minimum-width/turn/length checks. Preserve eyes/outlines/markings; treat tiny shading/texture as explicit approximation decisions. A box/area thinness proxy is insufficient for native approval.
3. **Whole-art native plan and independent acceptance.** Add bounded contour generalisation, intended layering, fill direction/density/underlay decisions, object-order attribution, routing/trims and file completeness. Reuse local compound/satin builders and independent readers; do not convert inspection colour masks blindly or loosen the old export gate.
4. **Human likeness, realistic artwork and fabric acceptance.** Licensed raster illustrations and synthetic controls are not painted-art or physical embroidery quality. One future authorised paid semantic test can be replayed privately; source IDs/candidates should first be sufficiently bounded to avoid another large, expensive failed response.
5. **Release controls.** Keep work local. No production deployment is justified as a finished Target 2 fix. The offline inspector is available immediately; an explicitly authorised isolated preview of these inspection tools could be useful after deployment-trigger risks are checked. Do not spend deployments on another prompt-only attempt.

Continue actual engineering from these files and evidence. Do not add a new app, chase exact pixel reproduction, delete reference evidence, publish private artwork, repeat paid attempts blindly or claim simulation proves quality.
