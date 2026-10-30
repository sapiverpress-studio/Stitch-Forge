# Stitch Forge — MD-2.47 bounded textured-art preview

Date: 2026-10-29 (Europe/London). The owner approved continued engineering and clarified the objective: **high-quality match/likeness, not perfection**. This continuation completed MD-2.45 source graph/colour selection, MD-2.46 boundary grouping/physical review, then addressed the realistic painted-art budget failure rather than leaving it hidden behind flat-illustration tests.

## Resume from this state

- Isolated local branch: `feature/reconstruction-root-cause-md242`. Parent MD-2.46 **`d491401da407f5b4cb6a8ade78816be177d78c82`**; MD-2.45 **`5944b9415979871542a20ad24220ea1aec5f2fda`**. This implementation/handover is committed locally; the exact HEAD is in Git and the checkpoint manifest.
- GitHub main last rechecked **`033234cde699644048598cee65bb166bdb3191ea`**. No new GitHub SHA contains these milestones because **nothing was pushed**. Do not describe local work as released.
- Last verified production source remains MD-2.40 `597547e3f7f6a1e92eab846fd3ffe55842710fb4`, deploy `6ae383086f1e6ec8b8d5e47f`. No Netlify/Actions/deployment, PR, merge, main update, paid AI, hosted worker, infrastructure, subscription or production-secret change occurred.
- Every commit contains `[skip netlify]`. Do not push until deployment-trigger risks are resolved or an exact safe release is explicitly authorised. The earlier anomaly means the commit tag alone is not sufficient evidence of safety.
- Read MD-2.46 for source graph/boundary/candidate contracts and MD-2.44 for the real local native runtime. Do not redo the initial diagnosis or repeat paid requests blindly.

## New: a realistic painted source now gets a usable local approximation

MD-2.46 found the private painted example exceeded the 30,000-node fine-reference graph budget at 768×660. Even a 512×440 experiment hit it; 384×330 produced 29,372 nodes but exceeded the 8MB project download limit. Those failures are retained. Lowering resolution or raising limits was not accepted as the fix.

The problem was constructing a component for every fine RGB bin **before** choosing practical working colours. `histogramPalette` in `site/source-region-graph.js` now offers a bounded alternative: use at most 512 histogram summaries to select up to **12** working colours, then build the pixel masks/components. No fine-reference graph is claimed on this route.

`site/source-region-project.js` adds:

- `createApproximationDraft`: numeric source-grounded 12-colour preview at unchanged analysis dimensions; all selected source pixels belong to exactly one working mask.
- `createInspectionDraft`: try the existing detailed graph; fall back **only** on its named node/run/adjacency resource-budget errors. Invalid dimensions, malformed pixels, uncertain/complex background or downstream mask budgets do not silently become a pass.
- Explicit schema `stitch-forge-source-region-approximation-v1` with graph-unavailable and small-feature/semantics-unverified status. Unknown approval/graph fields are not trusted. Full original colours/fine reference nodes are not encoded losslessly in this approximation; the original source and its SHA-bound pixel check are still required to reopen it.
- Same 8MB download, 200,000 total-run and other existing limits. No budget was increased.
- Save/reopen regenerates the same approximation from actual source pixels. Resize preserves its working geometry; native eligibility stays false.

The actual app's free inspection action and latest offline inspector use this entry point. They show an explicit preview fallback message, keep source SVG/project downloads available and disable the source stitch-candidate action when no fine graph exists. Playback/native exports remain blocked in source inspection mode. The earlier paid model-coordinate reconstruction button is still **unchanged and not proven fixed end-to-end**.

## Private painted-art evidence — not published

One existing owner-provided painted illustration was processed locally. Original **1353×1163**, analysis **768×660**, 80mm full-image width. No model/worker request or external image upload. Private SVG/PNG visual QA stayed outside the repository; **no private image, outline geometry or source project is in the public evidence or checkpoint**. Only deidentified measurements/logs are committed.

On the existing raw RGBA analysis:

- **236,887 selected pixels**, all retained in working masks; union independently equals the source foreground selection.
- **12 colours**, **23,355 working pieces**. This is still far too fragmented to treat as a finished stitch plan.
- Pixels >RGB distance 60: **74,623 old common-colour approximation → 18,619 palette-first preview**. Mean RGB distance **44.19 → 33.74**. These are colour measurements, not a likeness percentage or calibrated thread match.
- Private project **4,227,554 bytes**, below the unchanged 8MB limit. Save/reopen against the original analysis passed.
- The actual rendered preview visibly contains the eye, beak, wing markings and flowers. This is a visual observation, **not verified biological reconstruction, owner quality approval, PES/DST or physical stitching**.

The original PNG was also exercised through the **actual app in 390px mobile/touch Chromium emulation**:

- It produced the preview-fallback schema at 768×660; **236,772 selected pixels**, 12 colours, **22,855 working pieces**, **4,157,022-byte** downloaded project.
- Reopening matched its actual browser source pixels; stitch candidates were disabled; no page errors or unexpected/API requests occurred.
- Browser canvas and the earlier raw RGBA pipeline round partially transparent/resized pixels differently. Their counts/hashes are therefore recorded separately; no cross-browser bit-identity claim is made.

This closes the **preview/capture refusal** for the tested painted example. It does **not** close the missing fine-reference graph, semantic grouping, narrow-detail planning or whole-art machine-file gap. Some other artworks can still exceed a later bounded mask/contour/download budget and must be refused honestly.

## Safety change at the native boundary

`services/digitiser/project_bridge.py` now explicitly rejects a named `schema` in the legacy machine-project path. This prevents a source/preview/candidate packet being reinterpreted as legacy machine input merely by adding valid `paths` and a forged approval flag. Local satin uses its separate existing `schemaVersion` mechanism and remains supported.

The negative tests now include **otherwise valid legacy path geometry** alongside each modern source/candidate schema; the rejection is therefore a real schema boundary, not just a missing-path error. The trusted local compound-control builder also rejects them. The deployed worker code/settings were not changed.

Never feed the inspection SVG directly to Ink/Stitch and call it a native plan: a colour preview may contain thousands of disconnected subpaths, whereas the pinned engine's fill path treats the largest subpath as outer and other subpaths as holes. Components, stitch types, layering and routing must be planned through the trusted native builders.

## Exact verification in this continuation

- **148 native Node tests pass, 0 fail, 0 skipped.** Includes three new texture/fallback tests, all previous source graph/physical candidate/diagnostic tests and the exhaustive small topology matrix.
- **20 frontend/function JS/MJS files + one inline script** pass syntax; all referenced app scripts exist. Configured repository build already picks these up. No Netlify build/deploy was triggered.
- **63 Python tests pass, 0 fail, 0 skipped**, including **six real local Ink/Stitch controls** (three compound, three satin) and independent pyembroidery decoding. Modern source/approximation/candidate schema rejection now includes valid forged legacy paths. These remain synthetic machine controls, not machine evidence for the painted or licensed artwork.
- **13 automated Chromium tests pass, 0 fail, 0 skipped**, actual app desktop/mobile, public raster set, tiny eye, source reopening, diagnostics, physical signatures, stale async downloads, no-network offline tools and the new textured preview path.
- **One additional private original-art app check** passed as described above. It is an actual separately scripted check, not a 14th automated test or a physical Android-device test.
- Initial browser run: **12/13 pass**, one upload timeout. The synthetic noise fixture had only a one-pixel transparent margin and selected >97% of its image, so the existing raster-import safety guard correctly refused it. The browser fixture margin was increased to five pixels; the node-budget stress remains. No import guard was loosened. Initial failure log is preserved.
- MD-2.45: 137 Node/9 Chromium; MD-2.46: 145 Node/63 Python/11 Chromium, with their exact historical logs. Do not total repeated regressions as additional distinct feature tests or claim every historical run applies to current code.

## Evidence and immediate owner use

Open **`docs/test-evidence/MD-2.47-textured-preview/Working_Likeness_OFFLINE.html`**. It is self-contained, embeds the actual app modules and requires no token/network/AI credits.

1. Choose the original PNG, JPEG or WebP.
2. Press **Inspect locally**.
3. Compare the original and actual computed working approximation. Fine-graph or fallback status is explicit. Private source JSON/SVG can be downloaded; candidate download stays disabled for fallback previews.

The file also shows the licensed butterfly/bird/flower comparisons and honest loss/uncertainty data. Those remain vector-origin illustrations tested as rasters, not painted-art quality proof. No source vectors were supplied to reconstruction. MD-2.46 has the boundary-reduction measurements and physical candidate JSON; MD-2.44 retains genuine decoded PES/DST control evidence. All public fixtures are verified CC0 or expressly synthetic. Private measurements in MD-2.47 contain no artwork geometry.

Phone-sized Chromium execution is verified; opening on the owner's physical Android device remains unverified. This is an inspection package for judging likeness, not a deployed app or embroidery exporter.

## Runtime/reproduction

```sh
node tools/check_frontend_syntax.cjs
node --test tests/*.cjs tests/*.mjs
python tools/build_region_graph_proof.py --output docs/test-evidence/MD-2.47-textured-preview --version MD-2.47
LD_LIBRARY_PATH=/tmp/stitchforge-md243-native-libs/usr/lib/x86_64-linux-gnu PYTHONPATH=/tmp/stitchforge-md243-deps:tests STITCH_FORGE_INKSTITCH=/tmp/stitchforge-md243-engine/inkstitch/bin/inkstitch python -m unittest test_compound_native test_project_bridge test_compound_geometry test_trusted_svg test_satin_engine_acceptance test_format_audit test_worker_wsgi test_stitch_planning test_region_parameters test_satin_native
```

Browser: `tests/browser/source_regions.cjs`; temporary Chromium `/tmp/stitchforge-md243-browser/chromium-host`, package-default serverless arguments with disabled web-security/site-isolation/insecure-content switches removed. Fresh browser per test. `STITCH_FORGE_CHROMIUM`, JSON `STITCH_FORGE_CHROMIUM_ARGS`, optional `STITCH_FORGE_EVIDENCE`. Native runtime/checksum/dependency setup is fully recorded in MD-2.44/43. No production dependencies or paid architecture were added.

## Ranked blockers and exact next engineering task

1. **Stitch-object generalisation and a bounded source-ID intent manifest.** A useful colour likeness now exists, but 23,355 painted-art working fragments are not 23,355 sensible embroidery objects. Construct a hierarchy of significant source regions plus explicitly accounted residual texture; retain the original/working masks and critical-feature uncertainty. Avoid constructing every fine RGB component before grouping, raising limits blindly or merely downsampling until a gate passes. The fallback currently has no full fine graph/candidate bindings.
2. **Integrate the actual automatic reconstruction action.** Replace model-invented fine polygon boundaries with source-ID grouping, feature/layer labels and stitch intent. Mock/test the full contract first; no new paid model request without authorisation. Do not treat the working approximation as verified AI semantics.
3. **Physical narrow-region and contour planning.** Recover source-supported running centrelines and true paired satin rails/rungs; generalise fill contours inside measured physical/source tolerances; preserve eyes/outlines and significant markings while explicitly simplifying fine shading/texture. The MD-2.46 thinness/axis report is a proxy, not a minimum-width or direction guarantee.
4. **Whole-art real native acceptance and physical quality.** Build a complete intended layer/routing/density/underlay plan, then use trusted compound/satin conversion, independent machine decoding and actual artwork attribution. No detailed butterfly/bird/flower/painted-source PES/DST or fabric sew-out has been verified yet.
5. **Release.** Offline owner inspection is now useful and costs no deployment. A later explicitly authorised isolated preview may be justified for inspection tools after trigger checks. Production deployment as a completed Target 2 digitiser is not justified. Keep main/PRs/production untouched.

Continue from these actual measured results. The user's target is a convincing, high-quality likeness, not perfect pixel/colour reproduction. Do not confuse a good preview, a passing synthetic machine file and physically good detailed embroidery.
