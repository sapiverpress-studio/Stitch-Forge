# Stitch Forge MD-2.49 — recovered source and actual app/native integration

30 October 2026, Europe/London. Existing application; no redesign.

**Latest release outcome:** the prepared main push was rejected by automatic approval review; main remains 8648bf7. Worker update is authorised but no deployment access is available. Read RELEASE_STATUS_MD-2.49.md first for exact evidence, stopped-build prerequisite, blocked command and continuation. Do not claim a remote update or bypass the rejection.

## Authoritative recovery and release position

The original MD-2.48 code was recovered, not recreated. Local commit **9d19230e9245aae86b47d9db37a0c62c8f004ede** and its preceding MD-2.42–47 history exist in the original checkout and Git bundles. The working tree also retained this session's unfinished integration. GitHub had only three branches: main at **8648bf736a261737c969cb932133811b8034be64**, feature/detailed-embroidery-analysis-no-deploy at **0373875ae215d571ca111aab4698728d3dc8adb7**, and develop/stitch-engine-foundation at **3e7bc6d164068618439cd3cf08130bd764f081fd**. PR #1 was already merged/closed on 29 October; this session did not modify it or create a PR.

8648bf7 adds recovery notes, tools/source_colour_audit.py and four synthetic tests. It does not contain MD-2.48's source-to-native implementation. Its three additions have been merged with the recovered history; they were not overwritten. The earlier statement that MD-2.48 was unrecoverable was specific to that other runtime. Read the current Git HEAD for the final release SHA rather than assuming the last historical checkpoint is current.

Owner subsequently explicitly requested all work on main several times, including the actual tested app, and authorised updating the existing worker. No website deployment is authorised: the owner will manually deploy Netlify. All commits carry [skip netlify] and the release commit also carries [skip ci]. GitHub workflows were inspected: push jobs target the older integration branch, not main. The Netlify connection exposes published-deploy metadata but omits automatic-build controls; the dashboard sign-in attempt was cancelled. The public site metadata confirms the repository URL but returns empty build settings. Do not infer that CD is stopped from that empty response. Owner reiterated the main push after this risk was explained. No Netlify deploy API, build hook or workflow dispatch is used by this release.

Last published Netlify deploy read during this recovery: **6ae383086f1e6ec8b8d5e47f**, source **597547e3f7f6a1e92eab846fd3ffe55842710fb4**, production ready. Source publication and live deployment are separate. Verify both again before claiming the hosted version changed.

## What now works locally in the actual app

The automatic artwork action defaults to a source-based native trial. Original reduced RGBA and the existing source/object algorithms prepare colour masks; no invented ideal polygons, OpenAI request or hand-authored region fixture is used for the artwork trials. The earlier paid AI geometry action remains an explicit alternative in the workflow selector.

Actual path: browser upload → source/object preparation → protected repository Netlify Function → loopback HTTP WSGI worker → real Ink/Stitch 3.3.0 PES6 and DST → independent pyembroidery 1.5.1 framing, palette, movement and source checks → validated ZIP → actual decoded stitch overlay and automatic download. The local runner executes the real Function and worker, not a mock engine or fake API response. External/paid APIs are blocked by the runner/test.

ZIP includes both native files, machine-report.json, numeric decoded-preview.json, the **actual editable native-artwork-input.svg**, and an unapproved-trial README. The SVG is phase-hash bound and downloadable separately. Actual decoded paths use a numeric-only renderer; server SVG is never injected into the browser. Original editable editor paths are preserved; legacy playback/writers are blocked while inspecting the native result. Source/size/mode changes invalidate pending work and old downloads; cancel prevents subsequent requests; undo closes the actual overlay.

## Contract, safety and privacy

- site/artwork-pipeline.js packs original reduced pixels plus one-byte colour labels with bounded gzip/base64, source SHA256, physical dimensions, palette, preparation signature and exact packet digest.
- netlify/functions/artwork-embroidery.mjs adds /api/artwork-embroidery using the existing owner token, worker token and Cloud Run IAM caller flow. It calls only the configured /v1/artwork-trial endpoint. Worker credentials never reach the browser. No OpenAI or legacy-writer fallback.
- services/digitiser/artwork_packet.py independently verifies exact RGBA/label bytes, source fingerprint, original/analysis dimensions, source foreground selection, complete label accounting, palette, gzip termination and budgets. It recomputes 4-connected RLE; **it does not recompute the client's object generalisation or prove semantic likeness**.
- Source masks, holes and colour identities remain authoritative. Native geometry is compiled numerically. Complex fill polygons (>500 vertices) are partitioned on an 8mm source-frame grid, with exact union/holes invariants; this bounds native routing work without emitting stitches.
- Integrated contour tolerance is 0.02mm, running tolerance 0.01mm; the older standalone compiler defaults remain 0.04/0.03mm. Four-decimal millimetre serialization and exact collinear-step compression reduce representation size without moving the source path. Fill row spacing 0.5mm, max fill stitch 3.5mm, running length 1.5mm, underlay off, zero compensation: controlled trial values, **not fabric presets**.
- Two native phases keep each engine invocation below 40s and each Function upstream request below 55s. PES6 is returned internally with a worker-HMAC receipt binding source, SVG, exact PES bytes and a 15-minute lifetime. DST is directly generated by the engine, not converted from a preview writer. Both complete native files are independently decoded and cross-checked.
- Boundaries: 750,000 analysis pixels; 12 colours; 1,500 paths; 150,000 vertices; 2MB native SVG; 125,000 decoded commands; 3.65mm max observed needle move; 120 needle commands per 1mm square; 4MB request; 3MB ZIP. Existing source-containment tolerance **0.11mm** is unchanged. This tolerance and command-density bound are engineering checks, not fabric approval.
- Both the new Function and worker route are off unless STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1. Existing /v1/digitise and authentication remain available. Worker uses the existing shared engine lock; busy fails without an automatic retry storm.
- Native PES6 framing/footer and DST real END/triplets are checked before pyembroidery, whose readers can otherwise synthesize END on incomplete files. ZIP size/CRC/name/extraction, physical extent, colour, source/phase and editable-SVG hash checks precede browser download.

## Measured native feedback repair, not weakened validation

Browser-canvas resampling produces different masks from the older Pillow trial. The private input initially generated two whole stitch segments leaving their working colour, with no outside endpoints. Tightening contours/running tolerance and changing native underpath travel did not fix this. Whole-mask broad-core splitting exceeded budgets; retracing full core skeletons failed density; native skip-last and legacy-fill probes failed stitch-length checks. None of those failed approaches is shipped as the fix.

The accepted fix attributes every failed segment to one **native fill piece**, not the entire connected colour region. The worker signs a source-bound repair receipt; the browser may repeat PES/DST generation **once only**. At most 12 faults/pieces and **2% of selected source area** may change from fill to source-skeleton running. Unknown, ambiguous, large, stale or repeated repairs fail closed. Original masks/colours remain unchanged. Fresh engine execution and the same full independent audit are mandatory before ZIP download. This is a disclosed stitch-family approximation, not professional fill approval. No needle command is edited or manufactured.

Private result changes one **8.9193mm² / 823-equivalent-pixel** native piece, rather than its 6,988-pixel connected region. Four native requests occurred: PES 200, DST 202 repair, PES 200, DST 200. Times **17.011 / 36.857 / 21.533 / 37.849 seconds**; full browser case 117.442 seconds. This is not an instant workflow.

## Actual artwork results during MD-2.49

| Input supplied to actual app | Analysis dimensions | Needles per format | Unresolved objects / pixels | Native passes | Outside points / whole segments |
| --- | --- | ---: | ---: | ---: | --- |
| CC0 rose PNG | 764×768 | 13,328 | 115 / 118 | 1 | 0 / 0 |
| CC0 macaw PNG | 550×768 | 14,180 | 513 / 584 | 1 | 0 / 0 |
| CC0 butterfly PNG | 768×680 | 17,891 | 1,451 / 1,812 | 1 | 0 / 0 |
| Private painted original | 768×660 from 1353×1163 | 51,902 | 852 / 1,364 | 2 | 0 / 0 |

All at 80mm full image width. Private PES has **1,155 trims**, still excessive. Different browser pixels and compiler parameters mean the lower unresolved/trim counts are **not a controlled improvement over MD-2.48**. Do not present them as proof of better feather/eye preservation. Original MD-2.48 Library ZIP was byte-matched to the local artifact and freshly independently decoded: **50,035 needles each, 12 PES threads/11 changes, 1,170 PES jumps/1,168 PES trims, 2,168 DST jumps/273 DST trims**; hashes match. Its report records 1,514 unresolved objects/2,071 pixels, which cannot be inferred from machine bytes alone.

Private source/geometry/needles/reports/PNGs remain outside public Git. Only deidentified aggregate workflow metrics are committed. Public source fixture licences and expected visible features remain under tests/fixtures/artwork-evaluation/manifest.json. No ideal source SVG geometry was fed to digitising; actual inputs were PNGs.

## Test evidence and exact limits

- **161 Node tests pass**, 0 failures/skips: geometry/source regressions, Function auth/disabled/budget handling, bounded native transaction/repair/parser tests.
- **85 core focused Python tests pass**, including real local native control tests, packet/receipt/missing-eye/gzip/repair bounds and existing source/satin/compound/backend checks. Four additional recovered offline colour-audit tests pass after restoring CairoSVG/OpenCV dependencies; **89 distinct Python tests total**. Initial combined run had one module-import error, not an application/native failure; missing cairocffi, webencodings and cv2 were restored. Final clean combined run is retained in evidence.
- **19 Chromium app regressions pass**, 0 failures/skips: mobile controls/editor and source recovery, disabled route without AI fallback, source/size-change cancellation, historical fixtures.
- **4 additional actual app/native artwork cases pass**, 0 failures/skips, as three public cases plus the private case. Every phase was real local HTTP/engine/decoder; auto download, overlay, undo, unchanged legacy paths, no external calls or page errors, 390px no overflow checked.
- **23 JS/MJS source files plus one inline script** pass syntax; referenced app scripts exist. git diff --check is required before release.
- Not verified: deployed Cloud Run request, hosted Function/native chain, cold-start/memory behaviour, container build (Docker absent), physical Android, embroidery machine/fabric or owner likeness acceptance. Pure vector SVG keeps its older outline-only import behaviour; SVG-with-embedded-raster uses the raster path. This new native acceptance matrix used PNGs, not every input format.

Public evidence: docs/test-evidence/MD-2.49-app-native/Actual_App_Workflow_OFFLINE.html, separate decoded-only PNGs, actual app ZIPs, mobile screenshots, reports, workflow summaries and test logs. White-background needle panels contain no original image underneath. No simulated panel is labelled actual. Historical MD-2.48 results remain separately labelled.

## Run locally and continue without repeating recovery

Current runtime is deliberately outside Git in ../local-native-runtime (a /tmp runtime was removed during workspace maintenance). run.sh sets engine, Python dependency and Chromium paths; local diagnostics remain under ../private-stitch-eval/md249-app-debug. These absolute workspace paths are conveniences, not dependencies embedded in the app.

```sh
node tools/check_frontend_syntax.cjs
node --test tests/*.cjs tests/*.mjs
# Configure STITCH_FORGE_INKSTITCH, PYTHONPATH, LD_LIBRARY_PATH,
# STITCH_FORGE_CHROMIUM and STITCH_FORGE_CHROMIUM_ARGS for your runtime.
python -m unittest test_artwork_service test_artwork_trial test_worker_wsgi test_machine_job test_project_bridge test_compound_native test_compound_geometry test_trusted_svg test_satin_engine_acceptance test_format_audit test_stitch_planning test_region_parameters test_satin_native test_source_colour_audit -v
node --test tests/browser/source_regions.cjs
STITCH_FORGE_NATIVE_EVIDENCE=docs/test-evidence/MD-2.49-app-native node --test tests/browser/native_workflow.cjs
# Optional private test: set STITCH_FORGE_PRIVATE_ARTWORK and keep diagnostics outside Git.
STITCH_FORGE_LOCAL_OWNER_TOKEN=<local-only-token> node tools/local_app_server.mjs --engine <installed-inkstitch> --port 8080
```

Optional artwork engine dependencies are pinned in services/digitiser/requirements-artwork-trial.txt; real native binary installation remains services/digitiser/install_engine.py. Proof builder additionally needs CairoSVG; the separately recovered colour audit needs OpenCV. Native installer SHA pin and Ink/Stitch 3.3.0 source inspected in prior handover remain unchanged. New feedback repair was checked against exact local lib/stitches/tatami_fill.py, fill.py, lib/utils/clamp_path.py and lib/elements/fill_stitch.py.

## Hosted release and next task

**A Netlify-only deploy is insufficient for the new native workflow.** Existing private Cloud Run worker must also receive these modules/dependencies and STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1. The Netlify Function needs the same non-secret feature flag and its existing engine URL/worker secret/IAM caller credentials. Do not rotate secrets or expose the private service. Enable only after native worker health/auth/real generation checks succeed. The owner authorised updating the existing worker later in this session; no new infrastructure, paid AI or resource expansion is authorised.

No gcloud CLI, authenticated Google Cloud environment, Docker daemon or Cloud Run connector was available in the engineering runtime at the initial release inspection. Netlify's invoker credential is not evidence of deployment authority. Never claim deployment from this local acceptance. The older deploy-cloud-run-staging.sh also explicitly targets the old integration branch and resets resource settings; do not blindly run or bypass it for this main release. Inspect the existing service/revision, registry, secret bindings, IAM and resource configuration; update its image without weakening these controls. If deployment access is unavailable, record that exact blocker in the release record.

Ranked remaining work: (1) deploy/verify matching private worker and then the owner's manual Netlify release; (2) important-feature/likeness review and reduce travel/trims without deleting details; (3) source-supported automatic satin and semantic directions/layers, reviewed fabric/underlay planning; (4) real-machine sew-out. Automatic satin is **not** part of the source-native artwork pipeline, despite existing separate native satin control tests. All machineEligible/physicalQualityVerified flags remain false.

Next engineer: start at the final GitHub main SHA/release record, not MD-2.41 or the uncommitted checkpoint. Preserve both actual app and native service contracts. Do not rebuild MD-2.48, re-run paid polygon guessing or confuse 100% mask accounting with likeness. Use the four-case actual workflow as the regression gate for the next routing/feature improvement.
