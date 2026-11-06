# MD-2.73 — legacy engine split into separate reviewable stitch passes

Date: 6 November 2026. Branch: `feature/md273-legacy-staged-passes-no-deploy`.
**No deployment, traffic switch, cloud build, paid AI call or storefront integration.**

## What was implemented

The owner requested a return to the earlier working native geometry, with separate processing stages instead of further attempts to solve the entire illustration in one step.

- Keep the established source-plan -> `artwork_trial.build_trial_svg(..., partition_fills=True)` path (pre-hybrid geometry). Do not invoke the MD-2.66 Home SLIC bridge or change the current worker.
- Independently inspect **Tatami**, **satin**, and **running** Ink/Stitch native objects in separate SVG files; retain original physical frame, metadata and object hashes. **Underlay stays attached to Tatami** because sewing it as an isolated late pass would be incorrect.
- Verify every object appears exactly once with its original ID and SHA. Missing, duplicated, misclassified or modified objects abort. The final native SVG is **byte-identical to the older plan**, in its original interleaved sew order; regrouping by stitch type would otherwise change colour order and routing.
- Optional locally installed Ink/Stitch 3.3.0 uses the existing `artwork_trial.run_trial` real PES6/DST generator and independent decoded colour-containment audit, and explicitly verifies the native input SVG matches the staged source byte-for-byte.
- No automatic satin inference beyond the conservative existing `--try-straight-satin` opt-in. A zero-satin result is honest and not a regression.

## Local offline use (private source remains private)

```bash
python tools/staged_legacy_trial.py \
  --plan-json /private/source-grounded-plan.json \
  --output /private/staged-output
```

This yields `combined-source-identical.svg`, `stages/tatami-review-only.svg`,
`stages/satin-review-only.svg`, `stages/running-review-only.svg`,
and `staged-pass-report.json`.

For native output, add `--native-executable /path/to/installed/inkstitch`;
this is **an offline trial only**, not a claim that the PES/DST is safe to sew.

The CLI starts from the prior **source-plan JSON**, not a direct phone PNG upload.
The website does not yet present individual steps or let a user correct an isolated stage.
These remain the next engineering milestones.

## Evidence and release gates

- Six isolated unit tests checked source identity, underlay, empty satin, tampering, missing objects, duplicate IDs and mixed stitch types locally before repository commit.
- GitHub CI PASS at [run 42176927471](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42176927471) for six stage-integrity unit tests plus a real **older source-plan generator -> offline CLI -> separated Tatami/running/satin review SVG** synthetic fixture test. It verifies byte-identical combined SVG, not PES/DST output.
- Actual original-Kingfisher source-identical improvement: **NOT TESTED**.
- Actual staged native PES/DST generation for Kingfisher: **NOT TESTED**.
- Fabric stitch-out: **NOT PERFORMED**.
- Commercial readiness: **HOLD**.

## Next steps

1. Add a persistent, source-bound **object inventory** that stores independent stage decisions and explicit review/correction without rewriting the original masks.
2. Implement genuine automatic source-supported curved/tapered satin object selection as an isolated module, with a safe fallback to existing Tatami.
3. Extend running-stitch detail pass only from proven source edges, not hallucinated eyes/feathers.
4. Run identical-source Kingfisher and licensed alternate comparisons with real PES/DST decoded acceptance and a documented real-fabric test.
5. Only after native and physical gates pass, consider a controlled opt-in UI; no production rollout by default.

This milestone **separates existing objects**; it does **not yet independently re-digitise three object types** and does not fix the missing naturalistic details.
