# Sapiver Stitch Forge — MD-2.40 engineering handover

Date: 2026-10-29 (Europe/London)

## What the latest screenshot means

The 17:06 screen still shows the server's generic `INVALID_MODEL_GEOMETRY` message. My prior reply said the production site had not been deployed; that was wrong. Read-only Netlify metadata reported a current ready production deploy for the latest MD-2.39 main commit:

- Site: `sapiver-stitchforge`.
- Deploy ID: `6ae37c076fbb1f0a6438e9db`.
- Commit: `71de10aedb1a65ef0859cb6c67ec9edad3538e52`.
- Published: `2026-10-29T17:02:13Z`.
- Branch: `main`; deploy context: production.
- Metadata: `manual_deploy=false`, `deploy_source=api`.

The user states they did not deploy manually. I did not call a Netlify deploy-writing tool. The initiating event is unknown. Netlify's official documentation says `[skip ci]` or `[skip netlify]` in a commit message should skip a branch/production deploy from a direct branch push: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/. The observed deploy therefore conflicts with the expected skip behavior. Do not push more commits until the trigger is understood or a safe deployment has explicit authorization.

## Why the old generic message could persist

The actual screenshot does not contain the API response body, so the precise shape that was rejected is unknown. Source review found one definite hole in the diagnostics code: `normaliseModelPlan` rejected input when `regions` was missing or not an array but attached no `diagnostics`. `parseModelResponse` then converted it to `INVALID_MODEL_GEOMETRY`, and the browser had no extra reason to display. This path can produce exactly the generic message, but it has not been proven to be the reason for this screenshot.

## Local-only patch

- A missing/non-array `regions` property now receives a bounded plan-level reason code, `plan_shape_invalid`.
- If any model geometry error reaches the parser without a reason payload, it receives the safe fallback `plan_validation_failed`.
- Tests cover both malformed region geometry and a syntactically valid JSON plan with no `regions` array.
- The UI renders only enumerated reason codes and region indices; no raw model response is returned.
- No validator was weakened. No geometry is auto-corrected, accepted or sent to the worker by this patch.

The user subsequently explicitly authorized pushing the tested fix and deploying it to Netlify production. Local `git push` could not authenticate, so the same source tree was published through the connected GitHub integration, which creates a distinct remote commit SHA. GitHub `main` was updated successfully, but Netlify production was not updated. The final `main` head after the documentation commit is `1e2ef8cccd6e5c6b3e07fa4a2e73bb9169e2b239` (parent source fix `b9eee11a6a3808a72d23488984de17e60234849a`; both messages include `[skip netlify]`). Netlify still reports ready production deploy `6ae37c076fbb1f0a6438e9db` for older commit `71de10aedb1a65ef0859cb6c67ec9edad3538e52`. The Netlify connector exposes read-only deploy inspection, and this workspace has neither Netlify CLI nor a Netlify token, so I could not initiate a production deploy.

## Verification

Configured check run after this local patch:

- Five `node --check` syntax checks passed.
- Eight configured native Node test files: **68 passed, 0 failed, 0 skipped**.
- Full log: `docs/test-evidence/MD-2.40-plan-shape-fallback/netlify-build-checks.txt`.
- No browser test, real OpenAI request, hosted worker call, machine-file generation, or physical sew-out.

## Safety and next action

The user explicitly authorized pushing this fix to `main` and deploying it to production. The GitHub source/doc updates are complete, but the production deployment did not occur: available Netlify tools are read-only and no local CLI/token is present. The current production deployment is still MD-2.39 commit `71de10aedb1a65ef0859cb6c67ec9edad3538e52`. Next action: use a Netlify account session or authenticated deploy mechanism to publish current `main` commit `1e2ef8cccd6e5c6b3e07fa4a2e73bb9169e2b239`, then verify production deploy ID/commit. Do not test a reconstruction until owner authorizes a model request/credit use. Keep exact cause of screenshot marked unknown unless safe diagnostics from a new attempt identify it.
