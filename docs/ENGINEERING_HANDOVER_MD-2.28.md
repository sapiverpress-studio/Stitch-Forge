# Stitch Forge engineering handover — MD-2.28

Continue **only** `feature/detailed-embroidery-analysis-no-deploy`. No Netlify deploy/PR/main/integration changes, hosted engine/AI tests or paid infrastructure without explicit authorisation. Use `[skip netlify]` on every commit. PR #1 remains untouched. Current implementation has not been published.

## What changed

1. Full measured VTracer/OpenCV/scikit-image comparison and browser WASM test; see `VECTORISATION_EVALUATION_2026-10-29.md`. Benchmark commit `c158621`.
2. Disconnected source components retain separate editable IDs and parent IDs; a partially invalid component set is rejected atomically. Small holes no longer pass a percentage-based allowance. Compound holes remain unsupported.
3. Closed contours use bounded 0.75px simplification and independently rasterised missing/false pixel checks. No uniform vertex subsampling. Up to 512 vertices per automatic fill; shared 5,000-point project limit remains enforced. Legacy manual rules remain unchanged.
4. Removed editor's 4.5-canvas-unit thinning. Local reconstruction now uses up to 768px rather than 512; AI image/request count remains unchanged. This is bounded higher-resolution processing, **not adaptive tiling**.
5. Whole-image coverage and colour evidence gate catches omitted subjects/internal colours even if every AI proposal individually passed. Low-confidence/partial running paths also block automatic machine download. Draft remains editable with Undo. No source pixels sent to native worker.
6. Native preflight rejects malformed fill topology and tiny physical fills; actual machine extents must match source dimensions within 1mm. Colour changes derive from trusted SVG rather than unchecked JSON case differences. Independent decoder reports jumps, trims, stops and maximum needle movement and rejects internal non-finite coordinates.
7. New local planning CLI reports geometry, narrow-fill candidates, requested/default density/underlay, principal axis, retained colour order and travel proxy. It **does not choose satin, optimise overlapping layer order, apply fabric compensation or tune density**. Engine defaults remain unvalidated on fabric.
8. Baseline Cloud Run test failed because gcloud availability was checked before branch/SHA refusal. Reordered checks; no real deployment or Google access occurred.

## Exact validation

```sh
node --test tests/*.cjs tests/*.mjs
python -m unittest discover -s tests -v
node tools/bench_reconstruction.cjs
python tools/inspect_stitch_plan.py tests/fixtures/synthetic_four_panel_moth.json
```

- **55 JavaScript tests pass; 77 Python tests pass; zero skips/failures.** Logs in `docs/test-evidence/MD-2.28-*`.
- Includes Chromium mobile-sized integration, Undo, stale analysis/export, incomplete-source suppression; model and native HTTP are mocked. Independent pyembroidery 1.5.1 reads actual locally generated test formats, not new Ink/Stitch output.
- Native engine: exact official 3.3.0 archive downloaded and pinned SHA verified. Xvfb fails because this runtime denies AF_UNIX socket binding (EPERM). Three-fixture native rerun **did not execute**. Do not repeat download research: use `services/digitiser/install_engine.py` and the existing real-engine runner on a suitable local runner or separately authorised zero-cost CI.
- Synthetic 768px curve: 99.95% coverage, 96 missing / 67 false pixels over 194,553 foreground pixels, 444 vertices; 54–77ms desktop Node in recorded run. Not a real-image/mobile quality guarantee.
- No physical Android, realistic wildlife, original Kingfisher, real model or fabric acceptance performed.

## Next actions in order

1. **Run actual native regression before any promotion.** Existing synthetic logo/moth/line fixtures through updated `run_machine_job`, real Ink/Stitch and pyembroidery. Specifically investigate any new 1mm extent or tiny-fill gate rejection; do not weaken checks just to obtain green tests. Existing native source can be run locally without hosted cost.
2. **Implement a versioned compound-region representation end-to-end** (outer contour + holes + components + colour + parent/layer identity), including save/reload, Undo, edit rendering, SVG export, geometry-only proxy and trusted engine SVG. Currently holes fail closed; painting a white cover over a filled region is not a hole in embroidery. Benchmark rendered topology does not prove safe vector topology.
3. **Add accurate centreline/satin geometry and stitch planning.** Geometry thickness/axis are diagnostic hints only. Explicit rails/rungs and validated direction/underlay/spacing must precede automatic satin conversion. Preserve overlap dependencies before colour/travel optimisation. Trim decisions need actual engine command evidence.
4. **Test licensed real art and physical dimensions.** Known-mask synthetic data cannot demonstrate wildlife anatomy, feather patterns, painterly shading or semantic completeness. Use private owner artwork only locally with permission; never put it into this public repo. Calibrate omission/colour thresholds and reject uncertain results; no repeat paid calls by default.
5. **Evaluate quantised marching vs tuned VTracer for a safe compound importer.** Existing benchmark identifies strengths, not a universal winner. No runtime integration yet. If using WASM, create a real Web Worker build with cancellation, bounded memory and stress tests; test actual Android. The npm wrapper is Node-targeted and the disposable browser harness is not a release loader.
6. **Close professional acceptance gates:** settings persisted/editable per region, needle-command coverage per region/colour, overlap/density diagnostics, fabric/stabiliser profiles supported by physical stitch-outs, real one-click hosted acceptance only when specifically authorised.

## Limits that must stay explicit

Pixel gates are heuristics, not proof of semantic completeness; tiny details below the audit's significance thresholds can escape detection. Foreground isolation assumes transparent or near-uniform border/background. Masks do not distinguish intentional white thread from white background. Running-line corridor coverage is diagnostic, not sewn width. A high-resolution image may exceed region/vertex budgets and will reject rather than silently simplify. Device responsiveness under many complex regions is not yet established. Rendered SVG holes can conceal painted white paths, so no benchmark SVG should be directly sewn.

Netlify connector cannot expose branch-build settings or list every preview deploy. Verify current site deploy and commit statuses after pushing; do not infer an exhaustive deployment audit from a missing status. No open PR exists for this branch as checked before commit. Netlify's official skip rule covers direct branch pushes with `[skip netlify]`; PR previews require title-based skipping, so no PR is created.
