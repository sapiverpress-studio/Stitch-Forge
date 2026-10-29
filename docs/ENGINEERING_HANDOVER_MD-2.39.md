# Sapiver Stitch Forge — MD-2.39 engineering handover

Date: 2026-10-29 (Europe/London)

## Repository and release state

- Repository: `sapiverpress-studio/Stitch-Forge`.
- Branch: `main` (the user previously authorized main updates). Starting MD-2.38 head: `fc1243ca63662f14ad8a8c87a14751b36ad0d26c`.
- MD-2.39 code/evidence commit: `7ccc2fe2929774e9a56369a35fb3fb8d9e3f8b03`, message `fix: expose safe model geometry rejection reasons [skip netlify]`. A documentation-only follow-up records this SHA and updates the master document; it also includes the recorded Playwright import limitation.
- Every commit includes `[skip netlify]`. No Netlify production, branch, or deploy preview has been made in MD-2.39. The updated code is not live until the owner chooses to deploy it.
- Do not alter `develop/stitch-engine-foundation`, PR #1, credentials, secrets, or the hosted Cloud Run worker. No GitHub Actions workflow was triggered.
- No AI request was made in this milestone. Endpoint tests mocked OpenAI responses. No user artwork or screenshot is in the repository.

## New user evidence and diagnosis

The new owner screenshot shows `INVALID_MODEL_GEOMETRY` and the generic text “The model returned unsafe or incomplete shapes.” This is a server-side failure before browser source-pixel reconstruction or the local fill machine-scale validator. It is different from the previous screenshot's local machine-scale rejection.

Inspection of the actual code path found that `parseModelResponse` caught every error thrown by `normaliseModelPlan` and replaced it with `INVALID_MODEL_GEOMETRY`. `safeFailure` returned only a generic string and code; `site/auto-reconstruct-ui.js` displayed those fields. That made the failure non-actionable. The screenshot does not preserve the original model output or specific exception, so the cause of that already completed attempt remains unknown.

## MD-2.39 implementation

- `netlify/functions/reconstruct-embroidery.mjs` now tracks each rejected proposal's one-based array position and a static reason category. For an entirely rejected plan it sends at most eight entries plus an additional-count value. No raw model response or proposal ID is returned in the diagnostic payload.
- Expected region-level reason categories include `invalid_region`, `invalid_points`, `degenerate_outline`, and `duplicate_id`. Empty/oversized plans or final plan validation use a plan-level reason code.
- On partial valid plans, existing `model_rejected_count` and `model_rejected_reasons` remain intact; bounded `model_rejected_regions` and `model_rejected_additional` are added.
- Only the `INVALID_MODEL_GEOMETRY` API failure may include this bounded `diagnostics` object. The original geometry checks remain in force. The code does not repair, clamp, or accept unsafe geometry.
- `site/auto-reconstruct.js` formats only numeric region positions and lowercase underscore reason codes, with caps on displayed item count. `site/auto-reconstruct-ui.js` shows those details for a fully rejected response and keeps partial-rejection details in the status summary.
- `tests/test_auto_ai_endpoint.mjs` uses a mocked response to verify region/reason transmission and confirms raw model fields do not leak in the response. `tests/test_auto_reconstruct.cjs` exercises sanitized status formatting.

## Verification actually run

Configured local build command: five syntax checks (`site/auto-reconstruct.js`, `site/auto-reconstruct-ui.js`, reconstruction endpoint, machine endpoint, Cloud Run auth) and eight Node test files:

```sh
node --check site/auto-reconstruct.js && \
node --check site/auto-reconstruct-ui.js && \
node --check netlify/functions/reconstruct-embroidery.mjs && \
node --check netlify/functions/machine-embroidery.mjs && \
node --check netlify/functions/lib/cloud-run-auth.mjs && \
node --test tests/test_ai_analysis.mjs tests/test_ai_guides.cjs tests/test_travel_routing.cjs tests/test_fill_geometry.cjs tests/test_auto_reconstruct.cjs tests/test_auto_ai_endpoint.mjs tests/test_machine_endpoint.mjs tests/test_cloud_run_auth.mjs
```

Result: **5 syntax checks passed; 68 Node tests passed, 0 failed, 0 skipped.** Full output: `docs/test-evidence/MD-2.39-server-geometry-diagnostics/netlify-build-checks.txt`.

Browser test attempt:

```sh
python -m unittest discover -s tests -p 'test_auto_reconstruct_mobile.py' -v
```

The test module failed to import because `playwright` is unavailable (`ModuleNotFoundError`). No browser or Android test ran. Evidence: `docs/test-evidence/MD-2.39-server-geometry-diagnostics/browser-test-unavailable.txt`.

No live API call, real artwork retry, Ink/Stitch run, PES/DST generation/decode, or physical stitch-out occurred in MD-2.39. Historical engine checks are not evidence for this user's design.

## Current product claims and limits

This change only makes a later server-side rejection more informative. It cannot reveal the reason for the already rejected screenshot because the old server deliberately discarded the details. It does not prove that the model will return usable outlines or improve digitising quality.

No proposed geometry from the screenshot reached the local reconstruction or hosted engine. There is no corresponding PES/DST file or decoded machine-stitch evidence. There is no realistic artwork reconstruction or fabric sew-out verification. Sapiver Stitch Forge still cannot be described as a professional detailed-artwork PES/DST digitiser.

## Next step

After the updated source is intentionally deployed, obtain owner authorization before any further paid reconstruction attempt. If approved, use one attempt and retain only the bounded safe diagnostics. Add the exact reason code to a local fixture, then investigate that specific source (model plan, schema, or geometry check). Keep rejection fail-closed. Do not call the machine worker until the complete region plan passes every geometry and source fidelity gate; then independently decode the engine output and arrange a physical sew-out before making product-quality claims.

A development preview is not evidence that digitising works. It would only let the owner inspect the new diagnostic UI after a deployment is explicitly authorized.
