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

## Test evidence

- Six original MD-2.73 stage tests + actual older planner integration: PASS in previous feature-branch CI.
- MD-2.74 geometric unit and source-mask/satin-selection/CLI acceptance tests: **PASS** in [GitHub Actions 42177933835](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42177933835) and [42177996281](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42177996281).
- True Ink/Stitch 3.3.0 PES6/DST stage-selection A/B: [GitHub Actions 42178183566](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42178183566), **result must be checked**. This is controlled synthetic artwork, not the owner's Kingfisher.
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

- Independent Tatami and running passes still use the proven original algorithms; user-level manual corrections/re-digitisation, semantic object recognition, source-intent mapping and an integrated mobile step-by-step wizard are NOT implemented.
- Prior curved-satin experiment inset the strip and may leave source edges underfilled despite native needle containment. Measure actual source coverage, decoded direction and design likeness before selecting it automatically.
- Source-identical private Kingfisher versus alternate detailed licensed artwork A/B, colour fidelity, eye/beak/feather visibility, physical density and trims remain unverified.
- Physical sew-out under target fabric, stabiliser, machine, and thread is a hard approval gate; no product or customer claims.

**Do not merge to main, deploy, switch traffic or offer customer trials until separate approval after verification.**
