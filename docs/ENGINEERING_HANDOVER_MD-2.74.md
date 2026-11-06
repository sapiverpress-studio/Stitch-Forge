# MD-2.74 — Independent stitch-type object decisions atop the older engine

**Date:** 6 November 2026 (Europe/London)  
**Branch:** `feature/md274-independent-stitch-passes-no-deploy`  
**Release status:** experimental only, **NOT DEPLOYED**.

## Customer problem and design choice

A full-image conversion pass tends to confuse unrelated embroidery requirements. Instead of reverting the deployed website, keep the older trusted source-mask/PES-DST pipeline and let separate native object passes make independently reviewable choices. Existing fill underlay, source-colour ownership, physical sizing and machine audits must not be weakened.

This is a narrow step toward a real separated workflow, **not yet an automatic semantic digitiser**, and it is not yet a mobile site workflow.

## Implemented in this isolated branch

1. `legacy_staged_passes.py` from MD-2.73 preserves the old baseline, separates native Tatami, satin and running objects into review-only files, and rejects missing/altered/duplicated objects.
2. `staged_satin_review.py` independently rechecks the source RLE ledgers and proposes **straight** or **curved/tapered** satin where the existing bounded shape validators agree. It reports an inset strip footprint area fraction; this is NOT proof of embroidered coverage.
3. `auto_curved_satin_object.py` and its five tests reuse the already-tested MD-2.72 research implementation; the previous tests showed **zero accepted objects for licensed macaw/rose**. We have NOT claimed that it fixes the Kingfisher.
4. `artwork_trial.build_trial_svg(..., staged_satin_choices={SOURCE_ID: 'straight'|'curved'})` now accepts an **explicit local source-ID choice**. A selected object replaces its previous Tatami object with a native Ink/Stitch satin column. Other objects use the exact existing source-driven Tatami/running path. Missing/invalid selections or conflicts with global automatic satin/repair flags fail closed. The legacy default still produces exactly the original SVG.
5. `run_trial(..., staged_satin_choices=...)` forwards the same explicit choice to the existing PES6/DST native exporter and its independent decoded-needle source-colour audits.
6. The offline `tools/staged_legacy_trial.py` displays `satin-source-candidates.json` and accepts `--select-satin SOURCE_ID:METHOD`. It retains the original source plan, writes review-only SVGs and can optionally perform a pinned local Ink/Stitch native export.

## Offline mobile review handoff (data only)

- Candidate inspection has a bounded geometry-search budget: any unscanned fragments retain the original stitch family; the stage reviewer explicitly discloses truncation rather than failing the entire artwork or silently making decisions.
- `tools/staged_legacy_trial.py` now also writes `stage-review-bundle.json`, which includes the original source SHA, plan signature, Tatami/Satin/running counts and bounded candidate metadata. It intentionally contains **no original raster or image bytes**.
- `site/staged-review.html` + `site/staged-review.js` are a standalone mobile-first, **local file** stepper: load report → Tatami inventory → choose source-supported satin candidates → running inventory → download `stitch-forge-stage-decisions.json`.
- The offline CLI now accepts `--decisions-json` and verifies exact plan/source hashes, bounded unique candidate IDs and methods before rebuilding any native SVG. Wrong-source or tampered files fail closed. The app cannot independently generate machine files and is **not integrated with the live website**.
- Node contract tests, old source-plan → review bundle → source-bound user decisions → re-run offline CLI and actual **390px-wide mobile Chromium file upload/step navigation/download** passed in [GitHub Actions 42179237877](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42179237877). The latest full staged regression also passed [42179404713](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42179404713). These verify the local-only reviewer and handoff, **not** a hosted website or a browser-generated machine file.

## Test evidence

- Six original MD-2.73 stage tests + actual older planner integration: PASS in previous feature-branch CI.
- MD-2.74 geometric unit and source-mask/satin-selection/CLI acceptance tests: **PASS** in [GitHub Actions 42177933835](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42177933835) and [42177996281](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42177996281).
- True Ink/Stitch 3.3.0 PES6/DST stage-selection A/B **PASS**, [GitHub Actions 42178183566](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42178183566). Identical source identity/pixels and two native formats. Synthetic bent-strip control: baseline Tatami **842 PES stitches / 3 trims / 5 jumps / 17.58% transverse needle movements**; source-selected curved satin **647 / 2 / 4 / 97.01%**. Decoded needle paths differed and neither mode left verified working-colour pixels/segments (0/0). This proves a true stitch-family change and independent source audit **only on the controlled fixture**. Satin inset may leave unstitched visual edges; no Kingfisher or physical fabric approval.
- No real-fabric sew-out, no user-private artwork uploaded to public repository/CI, no deployed worker or Netlify changes.

## Local workflow

```sh
# Review old-source-plan outputs; report proposes geometrically suitable satin objects.
python tools/staged_legacy_trial.py --plan-json /private/source-object-plan.json --output /private/review

# If an exact source ID is suitable, rerun with a deliberate source-stage choice.
python tools/staged_legacy_trial.py --plan-json /private/source-object-plan.json \
  --output /private/selected --select-satin 114488-0:curved

# Add --native-executable /path/to/pinned/inkstitch ONLY in a safe local test.
```

The ID above is merely a placeholder demonstrating the required format: **read the real ID from your own candidate report**. The website cannot yet operate this CLI directly.

## Remaining release blockers

- Independent Tatami and running passes still use the proven original algorithms. A standalone local JSON-based mobile review stepper now exists, but **actual live-site integration, on-screen artwork overlays, manual geometry corrections/re-digitisation and semantic source-intent recognition remain TODO**.
- Prior curved-satin experiment inset the strip and may leave source edges underfilled despite native needle containment. Measure actual source coverage, decoded direction and design likeness before selecting it automatically.
- Source-identical private Kingfisher versus alternate detailed licensed artwork A/B, colour fidelity, eye/beak/feather visibility, physical density and trims remain unverified.
- Physical sew-out under target fabric, stabiliser, machine, and thread is a hard approval gate; no product or customer claims.

**Do not merge to main, deploy, switch traffic or offer customer trials until separate approval after verification.**
