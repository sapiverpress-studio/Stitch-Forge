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

[Netlify Node24 exact-build diagnostic](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42568888798): PASS after replacing a stale test that expected old paid-AI wording. [Actual Netlify PR Deploy Preview](https://deploy-preview-2--sapiver-stitchforge.netlify.app/) is `ready` as of Nov 9, commit 9827aed25e333e946c0f8eac533b643f96d98c8e. A phone-sized Chromium upload/token-gate smoke was also added; **confirm its GitHub Actions result before marking it passed**.

**Evidence artifact**: actual synthetic source PNG and decoded needle preview:
https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42568159913/artifacts/13651289761

## Release blocker — do not blindly merge PR #2

Netlify **production** currently runs Git SHA `792c37fddb3df77900b875e94a09e976cb7ff4b4` (3 Nov 2026). The GitHub `main` HEAD `a873ab5201e08df07de0f2f47af9fbe5151a60a4` has **58 unshipped commits** with changes to worker gateways, site protocol and other experiments. Directly merging PR #2 to main would deploy these unrelated changes also. This is a high-risk unreviewed production upgrade.

Before production: audit and safely reconcile all 58 commits or isolate a tested release against the actual production baseline, then confirm actual current Cloud Run worker compatibility, protected end-to-end browser generation, thread density/colour/hoop and a real sew-out. Retain older live site until this is verified. No Work credits.

**Status:** Real native ghost generation and preview build **VERIFIED**; actual phone smoke and current live Cloud Run compatibility **PENDING**; physical fabric and more varied motif tests **NOT DONE**; production **UNCHANGED**.
