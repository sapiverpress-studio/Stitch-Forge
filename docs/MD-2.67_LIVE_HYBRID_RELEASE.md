# MD-2.67 — ONE-RELEASE SERVER-SIDE HOME HYBRID ACTIVATION

**Date:** 3 November 2026  
**Release state:** GitHub engineering + native integration acceptance PASS; **Cloud Run MD-2.67 is NOT deployed until owner runs the approved helper**. Existing Netlify production site **does not require another Netlify code deploy**.

## Why this correction was necessary

On 3 November, the owner paid for/staged an MD-2.66 Cloud Run image (0% traffic) and published the MD-2.65/2.66 GitHub main website on Netlify. Those actions did **not** activate Home hybrid reconstruction: the old browser sent source RGB pixels and its own proposed labels, and the worker called `decode_packet` then `build_trial_svg`, bypassing the `hybrid_home.reconstruct` module. Promotion of the unchanged MD-2.66 image would not solve this. The prior assertion that simply deploying both services enabled the hybrid was incorrect.

## MD-2.67 code actually integrated

The **already published** browser workflow remains intact, and its original source-pixel byte binding, signed receipt, physical sizing, native ZIP byte checks and playback remain authoritative:

1. Browser `site/artwork-pipeline.js` sends its existing source-bound packet, **no schema change**.
2. Netlify existing `artwork-job-work.mjs` handles the long-running PES then DST workflow, forwarding through `artwork-embroidery.mjs`. All existing Netlify production tokens, IAM and Blob storage remain untouched.
3. The new private worker setting `STITCH_FORGE_HOME_HYBRID_ENABLED=1` causes `artwork_service.process_phase` to invoke `home_live_bridge.derive_hybrid_plan` **after** the existing independent original-packet decoder and **before** genuine Ink/Stitch native SVG construction.
4. The original independently verified source RGBA, foreground, source SHA, dimensions, physical frame and **browser requestId** remain intact. Only working colour labels/regions and the derived plan signature change; this is explicitly documented in the sourceBinding and `homeHybrid` report metadata.
5. `hybrid_home.reconstruct` uses bounded 9-colour SLIC/CIELAB segmentation, source-grounded edge guards and a 320px analysis long side. Working labels are reconciled to the original reduced browser pixel grid with **exact foreground preservation**. Missing downsampled source islands are assigned only to already-existing palette colours. Duplicate quantised palette colours are collapsed rather than inventing new threads.
6. The unchanged native backend generates **real PES6 and DST** in two phases. Independent actual stitch geometry, source-colour containment and receipt checks remain enforced. Result stays explicitly `machineEligible:false`, `physicalQualityVerified:false` and includes `home_hybrid_likeness_unverified`.
7. The existing website's audited ZIP/PES/DST downloads and actual decoded-stitch playback can consume the new result without additional Netlify code. The UI's pre-generation working-part count refers to the *browser draft*; inspect `machine-report.json > homeHybrid > hybridWorkingParts` for the actual backend hybrid result. This is a user-interface limitation, not a missing backend transformation.

**No new paid OpenAI service, public artwork upload or new Netlify endpoint was added.** The browser's existing optional OpenAI analysis checkbox remains advisory and may incur the pre-existing charge if enabled.

## Verified native tests

**[Four-artwork real worker end-to-end CI — PASS](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41590375479)** at implementation source SHA `98979de7384fa2ebdd25f0ccb9610a94fd43f3c1`:

| Test source | Working colours | Working parts | Actual PES trims | Unresolved small details | Real native PES/DST + original identity + colour containment |
| --- | ---: | ---: | ---: | ---: | --- |
| Synthetic bird | 7 | 8 | 83 | 0 | PASS |
| Licensed CC0 macaw | 9 | 52 | 100 | 1 | PASS |
| Licensed CC0 butterfly | 9 | 79 | 211 | 39 | PASS |
| Licensed CC0 rose | 6 | 38 | 68 | 0 | PASS |

The test uses source-bound *current browser packet schema*, exercises the actual private `artwork_service.process_phase` for both native phases using SHA-verified Ink/Stitch 3.3.0, decodes the final PES/DST, checks source, SVG receipt and source mask and refuses to label any file as sewn approved. It is not a remote production test or a literal Android-browser interaction.

Separate offline tests verify deterministic repeated phase preparation, transparent PNG, plain-white-background JPG-like masks, source tamper rejection, unchanged source/physical frame, distinct worker-only colour proposal, and enabled/disabled behaviour.

**Still NOT verified:** owner's private photorealistic Kingfisher native A/B and feature likeness, physical home-machine sew-outs, live Netlify-to-new-worker routing under current hidden production endpoint settings, fabric density/underlay for all machines and user demand. The butterfly's 39 unresolved small details remain a genuine product-quality risk.

## Single worker release, no second Netlify deploy

- **Owner instructions / supported helper:** `tools/deploy_md267_one_release.sh` on GitHub main. One Google Cloud Build unless the exact-SHA image is already present; one `gcloud run deploy --no-traffic` to create the revision; **one subsequent traffic allocation command** shifts the existing Cloud Run service root to that ready revision at 100%. Traffic adjustment is **not** another image build or worker deployment.
- Script checks clean GitHub main, exact release SHA, tested integration ancestor, existing **single 100% live revision** and conflicting target tag; stores old revision in `~/stitch-forge-md267-rollback-revision.txt` and prints exact rollback command.
- Explicit worker env flags on new revision only: `STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1`, `STITCH_FORGE_HOME_HYBRID_ENABLED=1`, `STITCH_FORGE_AUTO_SOURCE_REPAIR=1`, `STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110`.
- Project: `gen-lang-client-0857863712`; region `europe-west2`; existing service `stitch-forge-worker-staging`. Pinned cloud build `services/digitiser/cloudbuild.staging.yaml` and worker Dockerfile preserved.
- This is an **owner-authorised experiment**; machine files are not production-sewout approved. Cloud Build/Cloud Run and registry storage can cost money. No Work credits.
- Production Netlify already has `STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1`, a configured Cloud Run URL, required service-account caller identity and worker token keys. Those endpoint values are redacted by the connected app; a URL pinned to an *old traffic-tagged revision*, rather than the canonical service root, would prevent the traffic switch from affecting the website. **This routing detail remains a post-release verification blocker and must not be assumed.**

## Post-release owner acceptance and no-extra-deploy rule

1. The script prints **PASS 100% traffic** on the new MD-2.67 revision; screenshot proves only the Cloud Run traffic side.
2. On the **already published website**, upload a small transparent illustration (ideally the known synthetic/bird fixture), generate and download the ZIP once. In `machine-report.json`, check `homeHybrid.enabledForThisNativeJob=true` and `sourceBinding.clientObjectAlgorithmRecomputed=true`, plus real PES/DST and source-containment values. If not present or it fails, **do not do another Netlify deploy** reflexively.
3. Inspect the actual Netlify worker endpoint target securely, without disclosing credentials. If pinned to an old tag, solve routing first. If request fails, capture browser error and Cloud Run revision logs before spending on another build.
4. Rollback normal traffic to the previously captured revision using the printed `gcloud run services update-traffic --to-revisions=OLD=100`. This is an immediate routing rollback and **does not require a new build**.
5. Only after source-identical Kingfisher detailed-art trials and independent real fabric sew-outs may one discuss product-quality release; Professional Detail remains future work.

**Exact status:** MD-2.67 source implemented and real CI validated; public hybrid activation pending single owner-executed worker release + live application check. No claim of successful Cloud Run MD-2.67 release before that evidence exists.
