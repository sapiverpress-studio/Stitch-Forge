# MD-2.77 — Fully automatic flat-colour embroidery motif generation (PREVIEW ONLY)

**Date:** 9 November 2026 (Europe/London)  
**Source branch:** `feature/md277-automatic-simple-motifs-no-deploy`  
**PR:** [#2](https://github.com/sapiverpress-studio/Stitch-Forge/pull/2) (DRAFT; deliberately not merged)  
**Netlify Deploy Preview:** https://deploy-preview-2--sapiver-stitchforge.netlify.app/

## Customer behaviour being implemented

One source image → no manual stitch tracing → actual native machine output that can be checked and downloaded. The intended first category is a **simple motif** (Halloween ghost, hat, star, basic flower etc.), not photorealistic Kingfisher conversion. A later separate **composition/import** stage (multiple PES/DST motifs arranged together) is NOT included in MD-2.77.

## What is implemented

- `site/motif-prep.js`: bounded six-colour extraction and exact original foreground ownership, no skipped source pixels, rejects images with too much texture, unsewable colour/pixel fragments or unsafe budgets.
- `site/artwork-pipeline.js`: `profile:'simple_motif'` puts the source plan through the existing signed V1 request and original private worker. The rest of the V1/V2 native packet path is unchanged.
- `site/simple-workflow.js`: first, default selection is **Simple motif — automatic**, with separate experimental detailed-art mode. Upload/Generate/decoded stitch video/ZIP & individual PES/DST remain the primary four-step UX.
- `site/auto-reconstruct-ui.js`: automatic motif source preparation, with optional AI explicitly OFF for simple mode. No manually supplied stitch geometry. A strict failure presents an error, no fabricated PES/DST.
- `site/index.html`: loads bounded motif preparation ahead of native packet creation.
- V1 original source hash, palette owner pixels, native two-phase Ink/Stitch exporter, pyembroidery decoded source containment, downloadable ZIP receipts, private token handling remain as before.
- Only source-level synthetic and native tests are public; no private Kingfisher image uploaded.

## Evidence

[Successful full browser and genuine native ghost test, run 42568159913](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42568159913). 192×192 synthetic black/white ghost with 12,831 retained foreground pixels; 2 palette colours; genuine Ink/Stitch PES6/DST each decoded to 9,501 stitches; 0 out-of-colour stitches/segments, 9 PES trims, 11 jumps; one bounded source repair. Actual PES stitch path preview was downloaded and visually inspected; outline and eyes/mouth recognisable. This is NOT an embroidered fabric photo and does NOT establish machine-safe thread density.

[Netlify Node24 exact-build diagnostic](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42568888798): PASS after replacing a stale test that expected old paid-AI wording. [Actual Netlify PR Deploy Preview](https://deploy-preview-2--sapiver-stitchforge.netlify.app/) is `ready` as of Nov 9, commit 9827aed25e333e946c0f8eac533b643f96d98c8e. [Hosted phone-width Playwright smoke](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42569313974) **PASS on rerun against updated preview**: 390×844, upload synthetic PNG, default simple mode, no paid AI ticked, no unintended /api/analyse-embroidery or native job without credentials, ZIP/PES/DST disabled until genuine native output. Initial run found a 421px-wide body from the existing not-machine-approved header pill; header now wraps at narrow widths without hiding the warning. Exact Netlify preview build for the fixed commit verified ready.

**Evidence artifact**: actual synthetic source PNG and decoded needle preview:
https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42568159913/artifacts/13651289761

## Release blocker — do not blindly merge PR #2

Netlify **production** currently runs Git SHA `792c37fddb3df77900b875e94a09e976cb7ff4b4` (3 Nov 2026). The GitHub `main` HEAD `a873ab5201e08df07de0f2f47af9fbe5151a60a4` has **58 unshipped commits** with changes to worker gateways, site protocol and other experiments. Directly merging PR #2 to main would deploy these unrelated changes also. This is a high-risk unreviewed production upgrade.

Before production: audit and safely reconcile all 58 commits or isolate a tested release against the actual production baseline, then confirm actual current Cloud Run worker compatibility, protected end-to-end browser generation, thread density/colour/hoop and a real sew-out. Retain older live site until this is verified. No Work credits.

**Status:** Real native ghost generation, preview build and phone-sized upload/no-token controls **VERIFIED**; current live Cloud Run compatibility with the preview and fabric output quality **UNVERIFIED**; physical sewout and more varied motifs **NOT DONE**; production **UNCHANGED**.

## MD-2.78 — requested conservative automated pre-scan (9 November 2026)

The user's actual test on a named capybara design reported: "Automatic motif has too many detached pixel fragments; use cleaner flat-colour artwork." **Only an Android screenshot of that failure was provided, not the uploaded capybara image bytes.** No claim of a working actual capybara is warranted.

- Added `site/motif-prescan.js`: connected-component analysis of the *source palette labels*. Only bounded micro-islands (up to 0.20 mm² and 0.85 mm span, <=2.5% foreground pixels globally) are eligible for reassignment **to an adjacent similar-colour region**. Rejects strong colour contrast, dark marks merging into brighter areas and image-colour disagreement. Never changes original source RGBA, alpha, source silhouette or cut-outs. No semantic eye/mouth recognition is claimed.
- `site/motif-prep.js` now runs this pre-scan automatically after palette assignment and **before** source masks, source SHA binding and native worker conversion. After cleanup it recomputes colour quantisation metrics against the unaltered original pixels and retains all existing native fail-closed tests.
- The main mobile workflow now displays a small temporary **colour-shape pre-scan thumbnail**, actual before stitches, with honest fragment counts. This does not enable machine-file downloads.
- A fixture with a ghost silhouette/eyes/mouth and **240 separate pale RGB flecks** previously overran the 160-component automatic motif guard. Verified post-scan evidence from actual CI: **245 components → 5**, 240 pixels reassigned (**1.8705%** of foreground), original source RGBA/foreground unchanged, contrasting eye/mouth marks retained.
- [TRUE signed browser → private Ink/Stitch two-phase PES6/DST CI run 42609091447](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42609091447): **PASS** on this intentionally speckled source; PES and DST both **9,501 needle stitches**, **0 out-of-colour needle points/segments**, 9 trims/11 jumps. Still **NOT** machine sewout/approved density.
- Latest Netlify exact-node build and step-two user-facing prescan-preview test must pass before release; production remains unchanged.
- The failure can legitimately recur when artwork contains too much colour texture, many genuinely disconnected high-contrast details or semantically essential regions smaller than a stitch. Do **not** silently remove eyes/mouth or relax safety budgets. Obtain the ACTUAL capybara original image for an honest before/after and native trial before promising to fix that screenshot's case.

**Release guard stays:** PR #2 draft only; verify the unresolved 58 unshipped main commits before production. No Work credits.


## MD-2.79 — first diagnostic with user's actual photographic capybara (9 Nov 2026)

This is a **quality hold**, not an implemented fix. Owner supplied private source PNG, 1254×1254 RGBA with transparent background. The source is photographically textured: dense fine fur, antialiased contour hairs, dark closed eye, prominent nostrils, long whiskers, smile curve, four groups of paws/toes. Do not commit the private PNG or derived raster outputs to this repository.

Local controlled diagnostics on a 320×320 working image, six or fewer approximate thread colours:
- Bilateral variants contained about 1,164–1,836 connected colour islands before a local label filter, and still 224–268 after.
- Nine-pixel median + palette reduced about 136 → 122 colour islands; fifteen-pixel median about 58 → 60.
- Original-RGB colour differences after these reductions are typically 23–27 mean Euclidean RGB; purely numerical colour error is NOT a face-preservation metric.
- Visual source comparison: outline, overall seated pose and some paws survive, BUT dark muzzle/cheek becomes a large wrong-colour patch; closed eye, smile and nostril interpretation drift. **All outputs FAIL source-feature likeness acceptance**. This is not embroidery, machine data, sewout or an actual native pass on this PNG.
- Prototype dark-line extraction within hand-selected local eye/smile/muzzle test windows recovers some high-contrast source strokes but produces false positive fur/whisker noise. The windows were hand-scoped for diagnosis, **not automatic facial feature detection**. Do not ship this as automatic preservation.

**Decision:** The current MD-2.78 adjacent low-contrast micro-fragment prescan (max 2.5% changed source ownership) is not a proper solution for this real image. Its purpose is only to clean near-flat anti-alias speckles. Escalating fragment budgets or stronger palette blur would generate misleading files. Do not auto-generate a PES/DST until the protected face feature pass is separately confirmed.

**Required end-to-end automatic pipeline for textured illustration:** 
1. Source-image classifier routes photoreal texture away from the flat-motif path automatically. No false claims of native eligibility.
2. Produce a genuinely *new* simple-source derivative with clear local colour masses and faithful source-verified facial expression; this is an illustrated interpretation, NOT pixel-identical original. Generative edits can hallucinate, so expose this draft before a paid/real native job.
3. Protect and review eye/nostrils/smile and silhouette as individual semantic regions/contrasting thin running lines, not just global flat colours. Use source-aligned proof where feasible, and disclose any intentionally redrawn features.
4. Native worker uses this approved derived-source as its signed pixel contract; independently decode PES/DST and assess contour, local stitch density, jumps, trims, faithful feature visibility at target 80mm.
5. At least one actual fabric sewout before customer-use claims.

A ChatGPT-generated app-style illustration of an embroidery result made in this conversation is a **mock-up only**. Its stitch totals, buttons and 'digitising complete' label were fabricated in the artwork and MUST NEVER be described as real machine evidence.

**Still outstanding:** implement and validate that automated source-preserving facial-detail workflow; capybara native PES/DST NOT generated. Production HOLD remains in place.
