# Sapiver Stitch Forge — MD-2.36 engineering handover

Date: 2026-10-29 (UTC)

## Repository and safety state

- Repository: `sapiverpress-studio/Stitch-Forge`.
- Active branch: `feature/detailed-embroidery-analysis-no-deploy`.
- Starting local HEAD: `9551e7f73f3a017decc194b087d36b0ed8d2e7ee` (MD-2.35); remote feature head was `e47dfddc6656cc4efde2346588af2c98dc7e947d`. The worktree was checked; no reset performed.
- This milestone is local only. No Netlify deploy, hosted Cloud Run worker call, infrastructure operation, charge, GitHub Actions run, PR edit, merge, push or production change occurred.
- A push remains blocked by uncertainty about whether this connected Netlify project deploys arbitrary feature branches. The project listing did not expose that configuration. Keep changes local until independently verified.
- Any future commit must include `[skip netlify]`. Never deploy, push with deployment risk, modify PR #1 or merge to `main` or `develop/stitch-engine-foundation` without the user's explicit direction.

## MD-2.36 result

MD-2.35 had a real native satin adapter and standalone engine tests, but the project bridge and machine-job transaction did not accept satin geometry. MD-2.36 adds a **separate local-only acceptance route** through those two boundaries. It does not change browser export, `worker_wsgi.py`, its request allowlist, or the normal `convert_project` / `run_machine_job` behavior.

### Local schema and conversion

`services/digitiser/project_bridge.py` now has `convert_local_satin_project(data)`. It requires `schemaVersion: 1`, retains existing geometry-only `paths`, and accepts `satinColumns` containing the existing validator envelope (`accepted: true`, `machineApproved: false`, `geometryOnly: true`, paired `rungs`) plus bounded thread/stitch controls. The pixel geometry is transformed under the same scale and origin as fill/running paths. Satin is revalidated by `column_from_validated_pixel_rungs` and the native satin builder.

When satin is present, `regionOrder` must contain every path and satin index exactly once. Duplicate, missing, out-of-range and malformed references fail closed. Total regions are capped at 128. The ordinary `convert_project` explicitly rejects the local schema; worker code still imports and calls the ordinary conversion/job path.

`services/digitiser/machine_job.py` adds `run_local_satin_machine_job`, which shares the existing fail-closed engine transaction, fill-area gate, ZIP/PES/DST independent decoding, stitch-count/color-change agreement, and overall physical-extent comparison. The stitch planner recognizes the generated native satin path, validates its satin method and geometry presence, and includes it in ordered region/color-change and bounds diagnostics. `format_audit.py` now exposes decoded thread palette entries when that file format carries them; DST entries are empty because this test's DST carries no palette.

This is **not connected to UI input or the hosted worker**. It is a local project-to-engine acceptance harness. It does not accept or store original artwork.

## Actual local engine result

Fixture: hand-authored 80 × 60 pixel synthetic geometry, requested width 20 mm, 80 mm hoop. It has nine paired satin rungs (3 mm physical width at 0.25 mm/pixel) followed by a closed tatami rectangle, in declared satin-then-fill order. No original artwork or automatic reconstruction was used.

- Engine: pinned official Ink/Stitch 3.3.0 local binary.
- Independent reader: pyembroidery 1.5.1.
- PES: 664 needle stitches, 1 color change, 3 jumps, 1 trim, 0 stops, 20 × 15 mm extents, maximum decoded needle movement 4.0 mm. Decoded palette order starts `#ED171F` (satin input red resolved to Brother Red), then `#293133` (fill mapped to an engine palette entry).
- DST: 664 needle stitches, 1 color change, 1 jump, 0 trims, 0 stops, 20 × 15 mm extents, maximum decoded needle movement 4.0 mm. DST palette identity is unavailable from this file.
- These records prove engine generation and structural decode for this synthetic fixture. They do not prove the satin/fill design is appropriate for any real artwork, machine, thread, fabric, stabilizer or intended commercial use.

Inspect `docs/test-evidence/MD-2.36-local-satin-project/`:

- `offline-inspection.html`: offline comparison and explanation. The input is explicitly labeled synthetic.
- `project-to-native-inkstitch.svg`: geometry passed into the real engine.
- `actual-decoded-pes-stitches.svg` and `.png`: PES needle movements independently decoded by pyembroidery.
- `actual-inkstitch-pes-dst.zip`: the actual local engine output for this synthetic fixture.
- `machine-file-report.json`: source fixture/order, plan details, SHA-256, decoded file metrics, palette limitations and status.

## Tests run during MD-2.36

- Native Node: `node --test tests/*.cjs tests/*.mjs` — **95 pass, 0 fail, 0 skipped**. Log: `docs/test-evidence/MD-2.36-node-tests.txt`.
- Python focused regression with real engine configured: **41 pass, 0 fail, 0 skipped** across project bridge, stitch planning, file audit, machine job, WSGI contract, satin native validation and engine acceptance. Log: `docs/test-evidence/MD-2.36-python-focused.txt`.
- New actual mixed-project acceptance is in `tests/test_satin_engine_acceptance.py::test_local_mixed_project_order_to_real_machine_files`.
- New order validation and hosted-path isolation tests are in `tests/test_project_bridge.py`.
- Browser-specific Python tests were **not rerun** in MD-2.36. The prior MD-2.35 attempt could not initialize five Playwright browser classes under container socket/process restrictions. No current browser/mobile/Android pass is claimed.
- No physical embroidery or machine compatibility test was run.

Reproduce focused Python tests (adapt local engine/library paths for your environment):

```bash
LD_LIBRARY_PATH=/tmp/stitchforge-runtime/root/usr/lib/x86_64-linux-gnu \
QT_QPA_PLATFORM=offscreen \
PYTHONPATH=services/digitiser \
STITCH_FORGE_INKSTITCH=/tmp/stitchforge-engine/inkstitch/bin/inkstitch \
/tmp/stitchforge-detailpy/bin/python -m unittest \
  tests.test_project_bridge tests.test_stitch_planning tests.test_format_audit \
  tests.test_machine_job tests.test_worker_wsgi tests.test_satin_native \
  tests.test_satin_engine_acceptance -v
```

## What still does not work / remains unverified

1. **Detailed-art reconstruction is still the top product blocker.** The prior private kingfisher attempt failed: the existing OpenCV edge-guide extractor refused source/1000-pixel inputs at its complexity limit and produced 220 noisy guides at 768 pixels. No three-subject original/licensed evaluation set exists yet.
2. No actual input artwork passed the automatic reconstruction pipeline and then this local machine route. This milestone's geometry was hand-authored synthetic.
3. The browser/app cannot export these satin project requests. The local schema is not accepted by the normal converter or WSGI allowlist.
4. PES changes arbitrary source RGB to an engine/thread-catalog palette. The test only checks the first palette entries for one known fixture. DST offers a color-change count but not useful color identity here. General source-color/order mapping is incomplete.
5. Region-level attribution of decoded needle moves, satin width-specific stitch safety, exact layer overlap consequences, trim/jump route quality and density diagnostics are not audited per region. The overall maximum movement is not a substitute for stitch-family quality review.
6. Existing fill angle/row-spacing/underlay parameters are not materially validated. There are no fabric presets, pull compensation values or universal density rules.
7. No physical sew-out, machine acceptance, Android browser test, realistic visual comparison or commercial-quality review occurred.

No deployment is justified yet. This version has a local synthetic project-to-engine pass but no genuine artwork reconstruction and no physical result. Deployment still requires separate explicit user authorization.

## Next engineering task

Build a small reusable, appropriately licensed detailed-art test set (butterfly/moth, bird, flower/overlap) and run the **existing automatic reconstruction pipeline unchanged** on each image. Record source dimensions/provenance, automatically detected regions, missing/merged/recovered features and rejection reasons. Do not manually author expected regions into the reconstruction path. Fix the real image edge/segmentation acceptance blocker before exposing satin through the UI or worker. Once actual reconstructed geometry survives source-pixel audits, run it through this local route and expand decoded color, per-region bounds/movement, density, overlap and safety audits. Continue to keep deploy/export blocked until that evidence and real fabric tests support it.

## Git status at handover creation

All MD-2.36 code, tests, evidence, master-document updates and this handover are intended to be committed locally on the isolated feature branch with a message containing `[skip netlify]`. Do not push until feature-branch deploy-trigger behavior is verified safe. Do not create or alter a PR.
