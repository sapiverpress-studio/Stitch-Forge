# Stitch Forge — MD-2.48 actual artwork engine trials

Date: 2026-10-30, Europe/London. Owner instruction: proceed toward a working system this morning; a high-quality likeness is the target, not pixel perfection. This is the existing project and isolated branch, not a redesign.

## Start here

- Local branch: `feature/reconstruction-root-cause-md242`. Parent **`c05c86df6d17d0213c03aec6a35f2ab75c7f814f`** (MD-2.47). Read exact final HEAD from Git/checkpoint manifest. Do not reset an advanced checkout.
- GitHub main rechecked **`033234cde699644048598cee65bb166bdb3191ea`**. These new changes are committed **locally only**; no GitHub commit contains MD-2.48. Every commit includes `[skip netlify]`.
- **No push, PR update, merge, Netlify deployment, Actions trigger, hosted worker/model request, infrastructure/subscription, production credential or secret change.** Earlier deployment-trigger uncertainty remains unresolved; do not assume the skip tag makes a push safe.
- Production was not freshly queried in this continuation. Last verified production source remains MD-2.40 `597547e3f7f6a1e92eab846fd3ffe55842710fb4`, deploy `6ae383086f1e6ec8b8d5e47f`; do not present this historical check as today's observation.
- **The earlier paid AI reconstruction action and hosted export contract remain unchanged.** Source inspection can prepare artwork; only the separate local research runner currently performs these new native trials.

## New evidence that did not exist at MD-2.47

Three CC0 non-synthetic vector-origin illustrations were supplied as **PNG only** to actual app source/object extraction. No ideal vector geometry or hand-authored target regions were supplied. Real Ink/Stitch 3.3.0 created PES6/DST; pyembroidery 1.5.1 independently decoded the files.

| Input | Native paths | Needle stitches per format | Unresolved small objects / pixels | Outside-colour points / complete segments |
| --- | ---: | ---: | ---: | ---: |
| Butterfly | 240 | 15,343 | 1,451 / 1,812 | 0 / 0 |
| Macaw | 168 | 12,328 | 513 / 584 | 0 / 0 |
| Rose | 165 | 11,483 | 115 / 118 | 0 / 0 |

Containment uses **0.11mm** tolerance against independently reconstructed working-colour RLE masks. Every PES/DST needle coordinate agrees after translation; no scale fitting or invented movement is used. PES6 decoded RGB/order exactly equals the **working palette**, not the original unrestricted image colours or a calibrated physical thread choice. DST has no RGB palette; its evidence is coloured by the requested external order.

These are **local engineering trials, not professional/fabric approval**. Tiny/short parts are explicit unresolved objects. Source-colour containment does not prove full coverage, correct biological features, good layering, satin choice, efficient travel or physical results.

## Source-bound object preparation in the existing app

`site/source-object-plan.js` builds `stitch-forge-source-object-plan-v1` from a validated source draft. It binds the full canonical original draft, parameters and physical width with SHA256. Every original working component has a stable source-part ID and assignment.

- Small component threshold 0.35mm²; maximum fragment span/reach 1.2mm; maximum RGB change 90. These are artwork generalisation bounds, **not fabric presets**.
- Only adjacent short fragments may join original stable cores. Reach is accumulated conservatively through original component adjacency; no unbounded propagation. Protected source-graph candidates and numerically contrasting parts remain retained.
- No selected source pixel is omitted; union/holes remain unchanged. Colour changes, original assignments and reach are recorded. Numerical candidates do not establish eye/feather identity.
- App controls: prepare shapes, toggle original/prepared view, save unapproved JSON. Source/size changes invalidate results, including pending async work. Source inspection still blocks legacy playback/native export.
- SVG export accepts only the module's freshly built/verified objects, avoiding trust in forged loaded geometry. Native/legacy contracts refuse modern source/trial schemas even with valid legacy paths and a forged approval flag.

Actual working pieces: butterfly **2,786→1,687**, macaw **856→638**, rose **367→236**. Recoloured selected pixels **1,300 / 290 / 256**; protected parts recoloured **0**. These are useful preparation measurements, not a finished digitiser.

## Native compiler and actual defects fixed

New optional local module `services/digitiser/artwork_trial.py`, invoked by `tools/run_artwork_trial.py`; never imported by the hosted worker.

1. **Trust source masks:** check bounded numeric RLE, palette, dimensions, overlap and counts; reconstruct polygons independently from runs. Disconnected pieces stay separate.
2. **Fill versus running trials:** broad areas with a conservative interior-radius check become native tatami. Contour simplification is capped by measured 0.04mm Hausdorff distance. Thin pieces use actual image-mask skeletons, with branches/cycles traced. Tiny parts and paths shorter than 0.2mm remain explicit unresolved detail; no artificial dots or visual zigzags are substituted.
3. **Directions:** elongated component covariance axes quantised to 15°; isotropic shapes use horizontal control. These are geometric hypotheses, not semantic feather/petal direction. Actual long decoded segments are attributed to source components by midpoint and checked within 8° allowance; underpaths remain in the denominator. Direction dominance flags can still block review.
4. **Controlled settings:** 0.5mm fill row spacing, 3.5mm max fill length, underlay off, running length 1.5mm/tolerance 0.03mm, zero compensation/expansion. Not universal fabric settings. Input/path/vertex/command/density/length bounds remain active.
5. **PES1 palette failure:** the ZIP extension's default PES1 mapped adjacent shades to misleading fixed colours. Pinned `lib/extensions/output.py` accepts arbitrary output settings, including `--format=pes --version=6`. We call the **real engine again** for PES6, replace only the archive's PES entry with that native output, and independently cross-check every needle against DST. No preview writer creates stitches. Original native PES1 ZIP is retained for diagnosis on public controls.
6. **Outside-colour movements:** native defaults collapse jumps below 3mm; relative half-stitch locks use a straight lookahead direction that can leave curved regions. Explicit metadata `collapse_len_mm=0`, `min_stitch_len_mm=0.05` and native `back_forth` locks at 0.2mm resolved the observed failures. Source audit tolerance was not loosened. `lib/metadata.py`, `lib/stitch_plan/lock_stitch.py`, `lib/elements/element.py` were inspected.
7. **Incomplete files:** pyembroidery readers can synthesize END at EOF. Validate native DST triplet framing/real END and pinned PES6 PEC block, graphics, addendum length/footer before decoding. A new one-byte-truncation test exposed the missing addendum check; it is now fixed. This narrow native-output validator is not a general machine-file importer.

## Private painted artwork: genuine result, significant limits

Original **1353×1163**, analysis **768×660**, full image width **80mm**. The original owner file and every derived mask/geometry/machine/preview remain **outside Git**. Public evidence contains only deidentified summary measurements; no source hash, private coordinates, image or machine bytes.

The ordinary object plan has **17,861** parts and refuses the 1,500-path/150,000-vertex native budget. A separate optional `--texture-window-mm .21` experiment performs **one** physical colour-mode pass, at unchanged analysis resolution, with no chained iterations:

- Actual axis radius **2 pixels / 0.20833mm**, max target-colour sample distance **0.29463mm**. All votes read original working masks; original colour wins ties. Foreground union and transparent holes remain unchanged. This is not a fabric compensation or downsampling trick.
- **42,708** selected pixels change relative to the earlier object plan. **14,184** earlier working components, comprising **21,608** pixels, lose their previous colour entirely. The original source masks remain available; important-feature preservation is **not verified**. All such losses are recorded; a missing one-pixel eye regression demonstrates this must not silently grant approval.
- Working pieces become **2,683**. Emitting each connected thin branch separately still exceeded the native budget.
- `route_skeleton_branches` joins connected chains by following their existing edges, with at most **two passes per edge**; isolated cycles need one. No straight shortcuts across holes/other colours. This is currently used only in the optional texture trial; it needs further routing/density work.
- The routed case has **1,169 native paths**, generates actual PES6/DST and independently decodes to **50,035 needles each**, 11 colour changes, **78.2×66.5mm** stitched extents. Zero outside-colour points/segments at 0.11mm. Max needle move **3.585mm**; max observed needle commands in a 1mm square **79** (an engineering bound, not physical density approval).
- **1,514** tiny/short objects (**2,071** pixels) remain unresolved. PES: **1,170 jumps / 1,168 trims**; DST decoder: **2,168 jumps / 273 trims**. These encoding/decoder differences are recorded. The trim cost is excessive for a polished result. Some fill-direction dominance checks need review.

All approval flags stay false. This closes the **absence of a real painted-art engine trial**, not whole-product, important-feature or fabric acceptance.

Private files for the owner are saved separately: `Stitch_Forge_MD-2.48_ACTUAL_Decoded_Stitches_NOT_APPROVED.png`, `Stitch_Forge_MD-2.48_Private_Actual_Stitches_OFFLINE.html`, `Stitch_Forge_MD-2.48_PRIVATE_Engineering_Files_NOT_APPROVED.zip`. They contain actual decoded evidence and explicit blockers. Do not add them to Git. The four-panel comparison was checked at 390px and 1450px with no network/errors; no physical Android/device sewing test occurred.

## Exact tests and evidence

- **151 Node tests**, 0 fail, 0 skipped. Includes source accounting, physical bounds, source/size signatures, forged/stale plans and prior topology/satin/reconstruction tests.
- **72 focused Python tests**, 0 fail, 0 skipped. Includes **seven** real local engine-control tests (six existing compound/satin plus one new raster-derived mixed fill/running control). Nine new artwork-trial tests cover source masks, malformed inputs, missing tiny eye under texture approximation, skeleton branches/cycles, no-shortcut/two-pass routing, geometric axes, hole-crossing/colour-order audit, native truncation and actual native PES6 coordinates/RGB.
- **17 automated Chromium tests**, 0 fail, 0 skipped: app desktop/mobile, source preparation/toggle/save, pending size-change refusal, offline private uploader, actual licensed machine evidence and all prior app regressions.
- **One additional private evidence-page check**: original/prepared/decoded PES/decoded DST images all render; 390px/1450px no overflow; exact private report downloads; no network/page errors. Not an 18th automated test or physical Android validation.
- Syntax: **21 JS/MJS sources + one inline script**; app script references exist. New Python modules/tools executed/compiled.
- Three licensed real-art trials and one private painted trial are actual separate native executions, not synthetic tests or paid AI. Final public machine files were independently rechecked for original PNG RGBA fingerprint, source-plan bindings, framing, hashes and fresh decoded source containment.
- Historical MD-2.47 runs remain historical. Initial object fixture failures, missing runtime packages, PES1 palette rejection, source-crossing locks, butterfly 60s timeout, bad test setup and PES footer failure are documented under `investigation-failures.md` with retained logs. Final passes do not erase them.
- Not run: real AI request, hosted worker, complete paid one-click app flow, production/browser deployment, physical Android, actual embroidery machine/fabric, unrelated full historical Python browser/OpenCV suites. No broad claim that all repository tests ran.

Public evidence: `docs/test-evidence/MD-2.48-source-objects/` contains `Prepared_Artwork_OFFLINE.html`, `Native_Artwork_Evidence_OFFLINE.html`, PNG screenshots, actual CC0-derived PES6/DST/ZIP, source/object contracts and per-case reports. `private-painted-summary-NO-ARTWORK.json` contains measurements only. Source licence manifest remains `tests/fixtures/artwork-evaluation/manifest.json`.

## Reproduce without deployment or paid services

The overnight `/tmp` runtime was gone. It was restored using the same SHA-pinned official engine installer and free local dependencies. No system production service changed.

```sh
python services/digitiser/install_engine.py /tmp/stitchforge-md248-engine
python -m pip install --target /tmp/stitchforge-md248-deps -r services/digitiser/requirements-artwork-trial.txt
# libwayland-server0_1.22.0-2.1build1_amd64.deb from Ubuntu archive:
# extract with dpkg-deb -x into /tmp/stitchforge-md248-native-libs (do not install system-wide).
node tools/check_frontend_syntax.cjs
node --test tests/*.cjs tests/*.mjs
LD_LIBRARY_PATH=/tmp/stitchforge-md248-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md248-imaging:/tmp/stitchforge-md248-deps:tests STITCH_FORGE_INKSTITCH=/tmp/stitchforge-md248-engine/inkstitch/bin/inkstitch python -m unittest test_compound_native test_project_bridge test_compound_geometry test_trusted_svg test_satin_engine_acceptance test_format_audit test_worker_wsgi test_stitch_planning test_region_parameters test_satin_native test_artwork_trial
LD_LIBRARY_PATH=/tmp/stitchforge-md248-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md248-imaging:/tmp/stitchforge-md248-deps python tools/run_artwork_trial.py --image tests/fixtures/artwork-evaluation/rose.png --output /tmp/replayed-rose-trial --engine /tmp/stitchforge-md248-engine/inkstitch/bin/inkstitch --engine-timeout 180
```

Current session split dependencies between `/tmp/stitchforge-md248-deps` (pyembroidery/Shapely/NumPy) and `/tmp/stitchforge-md248-imaging` (scikit-image/companions), with existing runtime Pillow/SciPy. A clean single target using the optional requirements file also expresses the exact reviewed versions. Render tools additionally use local `cairosvg==2.8.2` in `/tmp/stitchforge-md248-render`.

Chromium: temporary npm `@sparticuz/chromium@153.0.0`, brotli-decompressed binary `/tmp/stitchforge-md248-browser/chromium-host`, SwiftShader archive extracted beside it with `--no-same-owner`. Module is `require(...).default || require(...)`; use default args **without** disabled-web-security/site-isolation/insecure-content flags. Args JSON `/tmp/stitchforge-md248-browser/args.json`; tests `tests/browser/source_regions.cjs`, env `STITCH_FORGE_CHROMIUM`, `STITCH_FORGE_CHROMIUM_ARGS`, optional `STITCH_FORGE_EVIDENCE`. See MD-2.43/44 for underlying setup, but their old `/tmp` paths are not current.

Official/source references inspected: https://inkstitch.org/docs/stitches/fill-stitch/ ; pinned v3.3.0 source commit `b0edd96311ece82ee48816dc93466274b12c2a9c` (`lib/extensions/output.py`, `zip.py`, `metadata.py`, `elements/stroke.py`, `element.py`, `stitch_plan/lock_stitch.py`). Engine archive pin remains `162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79`. pyembroidery reader/writer sources were inspected for native PES6 framing and synthesized END behaviour. No new production dependency or hosted configuration was added.

## Ranked blockers and exact next engineering task

1. **Important-feature and likeness acceptance after physical generalisation.** The private trial loses fine components and flags some directions. Build a source-bound significant-feature/texture hierarchy, report each critical eye/outline/vein/marking as retained/merged/unresolved, and compare actual decoded paths with original artwork. A good-looking PNG is not semantic acceptance. Do not raise resource limits or erase loss flags to pass.
2. **Routing, family selection and fabric planning.** Reduce 1,168 private PES trims and repeated small skeleton passes; add real source-supported satin rails where appropriate, feature-wise direction, layer order and explicitly reviewed underlay/density/compensation. Keep measured bounds and compare every resulting actual decoded path; no universal fabric preset.
3. **Integrate into the existing app/native contract.** The local runner now proves real artwork engine execution. Design/mock/test a bounded source/object/native request with hashes/physical dimensions/complete accounting; keep worker allowlist and approval semantics explicit. No paid request or Cloud Run invocation without authorisation. The deployed paid reconstruction button is still unchanged.
4. **Human/machine acceptance and release.** Owner judges the private actual-stitch likeness; embroiderers must review and sew appropriate trials. Offline inspection is justified now. A later explicitly authorised isolated preview may be useful after trigger review; production as a completed professional digitiser is not justified. Do not push/deploy/merge/modify PRs autonomously.

Start with item 1 using the actual private reports and source-mask/object contracts. Preserve the successful public source-contained native regressions. Do not repeat the old model-polygon diagnosis or spend another deployment on a guess.
