# Sapiver Stitch Forge — MD-2.42 engineering handover

Date: 2026-10-29 (Europe/London). User asked for an app-wide diagnosis and explicitly rejected more guessing or a kingfisher-specific patch.

## Resume here

- Local branch: `feature/reconstruction-root-cause-md242`.
- Base GitHub main: `033234cde699644048598cee65bb166bdb3191ea` (MD-2.41 code is on main, not deployed).
- The implementation, fixtures and evidence are committed together on the local branch; obtain its exact SHA with `git rev-parse HEAD`.
- It has not been pushed. No PR was touched, no merge occurred and no deployment was triggered. Every commit includes `[skip netlify]`. Keep it local unless a push is verified not to deploy.
- Production read-only check: ready deploy `6ae383086f1e6ec8b8d5e47f`, source `597547e3f7f6a1e92eab846fd3ffe55842710fb4` (MD-2.40).

Read `docs/RECONSTRUCTION_ROOT_CAUSE_MD-2.42.md` for measured evidence and the source-based repair path. Do not start by changing the prompt or deploying MD-2.41 and hoping it improves geometry.

## Confirmed causes

1. Any selected component smaller than 25px makes `reconstruct` reject its entire parent proposal, including large valid source areas.
2. `boundaryPixels` retains one ring; holes therefore reject the entire fill. Compound geometry exists only as an unwired Python validator.
3. Colour thresholding fragments detailed/antialiased artwork. More than 128 fragments rejects the whole proposal; the public three-subject mask probes reproduce this.
4. The front end/endpoint required four unique vertices for fills. Removing a duplicated closing point turned valid triangles into a false `degenerate_outline`. This is locally fixed, including collinearity checks.
5. The exact earlier paid model plan was not retained. Do not claim that the causes of all 14 user rejections have been replayed, or that low coverage proves only an AI failure.

Current normalized whole-image coordinate conversions preserve aspect ratio; no demonstrated unit mismatch was found. Actual model coordinate accuracy is still unknown.

## Code changes

- Triangle support in `reconstruct-embroidery.mjs`, `auto-reconstruct.js`, `fill-geometry.js`, `fill-boundary-ui.js`, and `stitch-classifier.js`.
- New `site/source-mask-ledger.js`: lossless bounded run storage, four-connected components, tiny-component review flags, exact roundtrip and malformed-input refusal. Machine eligibility is always false. The module is **not loaded by the app**.
- `tools/probe_reconstruction_topology.cjs`: reproducible structural controls and optional raw-RGBA colour-mask probes. It exposes diagnostics in a scratch VM; geometry code is unchanged. Search rectangles are probes, not hand-authored reconstruction targets.
- `tools/bench_source_region_candidates.py`: VTracer raster-only trial with fixed configurations and raw-render metrics. Preview PNG alpha clips are display-only and explicitly labelled.
- New CC0 butterfly, macaw and rose raster fixtures plus licence/feature/hash manifest under `tests/fixtures/artwork-evaluation/`. None is private user artwork. SVG source paths are not fed into extraction.
- Fixed a pre-existing historical-proof test: MD-2.37 evidence is pinned to its real historical scanner hash, not required to equal mutable current code. The old HTML is untouched.

## Executed tests and evidence

- 10 syntax checks; full Node suite **113/113 pass**, zero skipped.
- Python project bridge / trusted SVG / compound geometry **19/19 pass**. No native Ink/Stitch run during MD-2.42.
- Six mask-ledger tests preserve holes, tiny islands, 729 isolated marks and bounded failures.
- 36 licensed-source colour-mask probes: old path returned 4; ledger roundtrips 36/36 exactly. These are structural probes, not full AI segmentation.
- VTracer: 3 sources × 3 fixed configurations × 2 repeats = 18 conversions. Each repeated pair identical; none passed whole embroidery acceptance. Basic tracing is not a verified drop-in repair.
- Thirty earlier exploratory conversions exposed hidden-RGB/alpha and preview-metric issues. They are not used as quality evidence. Final metrics use a white-composited input and the unmodified vector render; source-alpha clipping is display-only.
- Offline visual evidence: `docs/test-evidence/MD-2.42-reconstruction-root-cause/offline-comparison.html` and adjacent actual PNG/SVG candidates. Browser/mobile execution not verified; static JS and no-network checks passed.
- First full Node run failed 1/107 on the stale historical-source assertion; corrected as explained above. Final logs are in the evidence folder.

## Reproduction environment

Optional dependencies were installed only under `/tmp/stitchforge-md242-deps`, not into Netlify or the worker. Actual benchmark versions: VTracer 1.0.0a4, OpenCV headless 5.0.0.93, numpy 2.3.5, Pillow 13.0.0, CairoSVG 2.9.1. scikit-image 0.26.0 was downloaded but is not used by the reported benchmark. The environment may need re-preparing after a restart.

```sh
node --test tests/*.cjs tests/*.mjs
python -m unittest discover -s tests -p 'test_project_bridge.py'
python -m unittest discover -s tests -p 'test_trusted_svg.py'
python -m unittest discover -s tests -p 'test_compound_geometry.py'
node tools/probe_reconstruction_topology.cjs
PYTHONPATH=/tmp/stitchforge-md242-deps python tools/bench_source_region_candidates.py --output /tmp/stitchforge-region-candidates
```

## Exact next task

Implement the source-mask ledger → topology-aware outer/inner contours → compound project geometry contract. Preserve all components in the draft; unresolved tiny features remain explicit export blockers. The current ledger is storage, not a contour extractor. Add private downloadable proposal/rejection capture and local replay before another paid artwork attempt. Move AI toward labelling/grouping stable pixel-derived region IDs and stitch intent, instead of supplying all fine boundary coordinates.

Evaluate that implementation on the three licensed rasters and general logo/line/transparent/hole/fragment controls. Then verify compound-hole and layer behaviour with real local Ink/Stitch plus independent PES/DST decoding. Do not relax gates, just increase caps, or put VTracer SVG directly into machine files. Do not deploy again until this source-region path has measurable acceptance evidence.

No realistic-art PES/DST, physical embroidery quality or professional-grade automatic digitising has been verified in this milestone.
