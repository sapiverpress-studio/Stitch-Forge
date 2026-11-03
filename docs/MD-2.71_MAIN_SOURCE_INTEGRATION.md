# Stitch Forge — MD-2.70 and MD-2.71 main source integration

**Date: 3 November 2026 | GitHub source merged at owner request | Not a live deployment.**

## What is included
- Full-resolution original PNG V2 request, authenticated SHA-bound source metadata, original/reduced source correspondence checks, bounded Netlify private job forwarding, failed-dispatch cleanup and V1 protocol compatibility tests.
- Offline high-resolution colour analysis and a source-original thread palette refit behind optional worker flags. High-res colour fragmentation was rejected as a default.
- Source mask-bound, physically gated straight satin rail/rung construction as `STITCH_FORGE_AUTO_SATIN_TRIAL=1`, replacing rather than overlaying eligible Tatami objects; independent native source mask and file audits remain enforced.
- Native SHA-verified Ink/Stitch 3.3.0 PES/DST evidence and tests, with no owner artwork committed.

## Compatibility and release boundary

**The public website must remain V1.** `site/auto-reconstruct-ui.js` only attaches the original PNG if `window.STITCH_FORGE_V2_FULL_SOURCE_ENABLED===true`; the app does not set this flag. Enabling it without a matching, tested Cloud Run worker would cause failed requests. Keep it disabled. All three experimental worker flags are off by default:
- `STITCH_FORGE_HIGH_RES_PLAN_TRIAL`
- `STITCH_FORGE_SOURCE_PALETTE_REFIT_TRIAL`
- `STITCH_FORGE_AUTO_SATIN_TRIAL`

The experimental tests are not customer quality certification. No Netlify or Google Cloud deployment or traffic switch has been made with this source merge. Later deployment needs an owner-approved separate operation and end-to-end live compatibility + rollback.

## Verified engineering data

- [MD-2.70 full PNG native source-binding](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41610518508): success.
- [MD-2.70 native three-way colour trial](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41612336667): source-colour refit on macaw improved RGB error 41.56→38.31 while retaining 52 working objects / 100 PES trims; rose remained unchanged. This is not visual likeness approval.
- [MD-2.71 real controlled satin A/B](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41620357275): 680 stitches both, 3→2 PES trims, 24.49%→92.31% genuine cross-width needle moves, zero colour-mask escape.
- [MD-2.71 CC0 macaw/rose native A/B](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41620570692): real PES/DST pass, **zero naturally eligible satin objects**, no likeness improvement.
- [MD-2.71 combined compatibility/native rerun](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41645882625): required PASS before merge.

## Next development gate

Extend automatic satin to **smoothly curved and tapered** actual source components, not arbitrary photo regions. Require physically bounded per-section width, continuous source-supported rail/rungs, source containment of every actual decoded PES/DST needle path, same PNG and physical size across baseline/trial, and a meaningful visual improvement in recognisable features without excessive stitches, trims or density. If unsupported, retain Tatami and report lack of evidence. Never weaken the source-colour audit to make the demo succeed.

**Private Kingfisher improvement: not demonstrated. Machine fabric sew-out: not performed. Home professional output claim: not supported.**
