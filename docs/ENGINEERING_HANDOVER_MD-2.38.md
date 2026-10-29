# Sapiver Stitch Forge — MD-2.38 engineering handover

Date: 2026-10-29 (Europe/London)

## Current repository state

- Repository: `sapiverpress-studio/Stitch-Forge`.
- Active local branch: `main`.
- Starting commit: `c493cba207a6a75606b94b52cea0231f6fb196f2`, the merge the user deployed to Netlify. The source changes in this handover were made after that deployment and have **not** been deployed.
- User previously authorized using `main`; do not merge to `develop/stitch-engine-foundation`, edit PR #1, or create another PR.
- Every commit must include `[skip netlify]`. Never deploy Netlify, including previews, without explicit authorization. Do not call the hosted worker or incur model costs without authorization.
- No GitHub Actions run was triggered in this work. Existing push workflows target only `develop/stitch-engine-foundation`; main does not match. Their PR triggers do not run for a direct main update. No Netlify deploy was performed.
- No uploaded artwork or screenshot was copied into the repository.

## Triggering user-visible failure

The user supplied a phone screenshot from their own OpenAI-backed reconstruction attempt. The app displayed: “Some regions failed machine-scale validation; incomplete reconstruction rejected, old design unchanged. Existing design is unchanged.” This confirms the operation returned proposed geometry and local validation rejected at least one fill. The exact model response, failed region identities, and validator messages were not retained in the screenshot or local logs, so the failure cannot yet be diagnosed by region.

Code ordering was inspected in `site/auto-reconstruct-ui.js`: the app first calls `context.replaceWithAutomaticReconstruction(proposed)` and its quality gates; only after those succeed does it POST to `/api/machine-embroidery`. Therefore this rejected attempt did not invoke the embroidery worker and did not generate PES/DST. Token usage and cost from the user's one authorized AI attempt are unknown. No further AI request was made during MD-2.38.

## Changes in MD-2.38

- `site/index.html`: automatic replacement now retains one-based region index and a short source label (`label`, `semantic`, or `id`) for accepted and rejected proposed regions. Fill geometry errors are retained as short text. If any fill fails, replacement still aborts before `snapshot()` and before mutating the design; the prior drawing stays intact and the machine worker remains unreachable.
- `site/auto-reconstruct.js`: exports `formatFillValidationFailure`. It reports accepted region labels, at most four failed fill region labels/reasons, and a count for additional failures. Region labels are capped at 32 characters and stripped of markup/control characters; failure text is capped at 100 characters. It does not expose partial geometry or bypass any validator.
- `tests/test_auto_reconstruct.cjs`: tests accepted labels, rejected region/reason details, truncation count, and the unchanged-design/machine-export-blocked language.
- `STITCH_FORGE_MASTER_DEVELOPMENT.md`: current version, evidence register, work log, decision and task ledger updated. This standalone handover is the continuation record.

This is a diagnostics fix only. It makes the next rejection more actionable but does not correct invalid source polygons, improve semantic segmentation, or prove embroidery quality. Malformed top-level region/colour schemas continue to fail closed through existing generic validation.

## Tests actually run

Exact configured local build command (also recorded in `docs/test-evidence/MD-2.38-reconstruction-diagnostics/netlify-build-checks.txt`):

```sh
node --check site/auto-reconstruct.js && \
node --check site/auto-reconstruct-ui.js && \
node --check netlify/functions/reconstruct-embroidery.mjs && \
node --check netlify/functions/machine-embroidery.mjs && \
node --check netlify/functions/lib/cloud-run-auth.mjs && \
node --test tests/test_ai_analysis.mjs tests/test_ai_guides.cjs tests/test_travel_routing.cjs tests/test_fill_geometry.cjs tests/test_auto_reconstruct.cjs tests/test_auto_ai_endpoint.mjs tests/test_machine_endpoint.mjs tests/test_cloud_run_auth.mjs
```

Result: **5 syntax checks passed; 66 Node tests passed, 0 failed, 0 skipped.** The added formatter test passed. The first run caught an incorrect test expectation about the synthetic fixture's region-7 error; the assertion was corrected to the actual out-of-bounds error, then the whole command passed.

Browser attempt:

```sh
python -m unittest discover -s tests -p 'test_auto_reconstruct_mobile.py' -v
```

This could not import the test module because `playwright` is not installed (`ModuleNotFoundError`). No Chromium, mobile, or browser test ran. Exact limitation is recorded in `docs/test-evidence/MD-2.38-reconstruction-diagnostics/browser-test-unavailable.txt`.

No Ink/Stitch or pyembroidery test was needed for a formatter-only change, and none was run. Historical engine tests in earlier milestones are not a current run and do not establish anything about the user's artwork.

## What the app can and cannot claim

- The UI can now explain which proposed region labels passed the initial geometry check and which fill proposals failed, when a new attempt is made against this updated code.
- The only real artwork result available for this failure is the user's screenshot. It proves the reconstruction path was invoked and the local gate rejected an incomplete proposal; it does not reveal the actual region geometry.
- Existing deterministic reconstruction and source-pixel checks still have synthetic fixture coverage. A previous local pixel scan of a private kingfisher image produced zero semantic regions. Neither result demonstrates faithful detailed-art reconstruction.
- The diagnostic change has not been deployed or tested in a browser. The existing deployed app is still the prior MD-2.37 merge until the owner chooses to deploy an updated version.
- Real Ink/Stitch PES/DST exists in earlier local synthetic satin/fill acceptance evidence only. No real-art proposal reached the worker here. No machine file, decoded stitches, or physical sew-out exists for the user's screenshot artwork.
- The app cannot currently be represented as producing professional, detailed-artwork PES/DST. No realistic artwork reconstruction or physical embroidery quality has been verified.

## Next engineering task

After the updated source is intentionally deployed and the owner chooses to attempt another reconstruction, retain only the app's bounded diagnostics: accepted/rejected region IDs/labels and validator reasons. Use those exact failures to add a local regression fixture and improve the narrow failing geometry path while preserving atomic rejection. Avoid another paid AI call unless explicitly approved. Then run a realistic, rights-cleared multi-subject evaluation set through the actual automatic reconstruction. Do not send results to the worker unless the complete proposal passes every gate. Continue through independent PES/DST decode and physical sew-out before claiming detailed-art digitising quality.

## User-facing recommendation

A development preview is **not yet justified as proof of a fix**: local Node and syntax checks validate the diagnostic formatter and fail-closed code path, but no browser integration or real-image retry has been run. If a preview is later authorized, its useful purpose is limited to letting the owner inspect the newly detailed failure message, not to claim the artwork has been digitised successfully. This is a recommendation only; no deploy was made.
