# Sapiver Stitch Forge MD-2.49 — GitHub main source synchronisation

Date: 30 October 2026 (Europe/London).

## What this commit delivers

- Imports the recovered MD-2.49 source checkpoint into the existing `main` tree, preserving the previous GitHub main as its direct parent.
- Includes actual website source, Netlify Functions, private-worker source and Docker requirements, tests, artwork-evaluation fixtures, engineering handovers, and MD-2.49 test logs.
- 202 selected checkpoint files were independently matched to the prepared Git tree by exact Git blob SHA and byte size (198 text source/docs/tests plus four binary fixtures). The fourth binary is the original MD-2.48 trial PES required by two MD-2.49 protocol tests.
- Original MD-2.42–48 visual evidence files not needed to build or run the app have not all been republished here; the owner-provided MD-2.49 checkpoint remains the archive of those larger artifacts. Do not confuse code sync with a byte-for-byte import of the full archive.
- The imported source is a snapshot based on the recovered Work implementation, not a recreation of the original local Git commit ancestry.

## Independent release checks in this synchronisation session

- `node tools/check_frontend_syntax.cjs`: passed, 23 JS/MJS sources and one inline script.
- `node --test tests/*.cjs tests/*.mjs`: 161 passed, 0 failed and 0 skipped with a minimal repo subset that excluded large historic evidence, after adding the required real PES fixture.
- SHA and size equality: 202/202 release files match the recovered checkpoint.
- Full 89 Python tests, 19 Chromium regressions and four actual Ink/Stitch artwork workflows are recorded in the Work checkpoint logs but were **not rerun** in the synchronisation environment. Its Python artwork subset skipped 19 optional worker-dependency tests here. Do not confuse previously recorded passing tests with a new hosted result.

## Hosted release limitations

- The upgraded Google Cloud Run worker has **not** been deployed or reverified here.
- `STITCH_FORGE_ARTWORK_TRIAL_ENABLED` must remain off in the Netlify Function and Cloud Run worker until matching worker code is deployed, protected and tested.
- The app's new automatic source-native workflow cannot be claimed operational on Netlify without that worker, matching environment settings and an authenticated hosted end-to-end test.
- Structural PES/DST checks are not physical machine sew-out approval. Machine approval remains false.
- Owner authorised this main synchronisation even if it triggers a Netlify build/deploy, but a GitHub push is not evidence of a deployed Cloud Run image or running website.

See `docs/RELEASE_STATUS_MD-2.49.md` for the historical pre-sync block and `docs/ENGINEERING_HANDOVER_MD-2.49.md` for technical implementation and follow-on work. This document supersedes the **push-blocked** status after GitHub main is confirmed.

## Next engineering action

Deploy and authenticate the updated native worker on the existing Cloud Run service, without changing its IAM/service account/secrets/cost caps; independently verify native output; set the two non-secret feature flags only after that works; verify the website upload → PES/DST ZIP flow, and then tackle trims, fidelity and sewout.
