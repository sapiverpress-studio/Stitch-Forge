# MD-2.64 controlled Cloud Run / Netlify deployment

1 November 2026. Owner approved beginning this deployment in standard
ChatGPT. **GitHub commit 0250f64** passed actual native/HTTP tests.
No production rollout or public Netlify publish is implied by GitHub updates.

## Production traffic before this task (user screenshot)
- Original service revision `stitch-forge-worker-staging-00001-pst` — 95%.
- Tagged `md261` revision `stitch-forge-worker-staging-00009-biz` — 5%.
- New `md264` does **not yet exist**.

## Guarded two-phase deployment

`tools/deploy_md264_tag.sh`:
- Prefight requires clean, fetched GitHub main with MD-2.64 ancestor,
  exact existing 95/5 split, known old worker revisions and the original
  Kingfisher source-matched MD-2.61 report saved in Cloud Shell.
- `--preflight` is read-only (no Cloud Build or routing update).
- `--execute` must explicitly receive
  `STITCH_FORGE_MD264_BILLING_APPROVED=yes-for-one-staging-build`.
  It executes **one billable** Google Cloud Build, installs tagged md264
  at **0%**, and verifies the 95/5 split is unchanged.
- Exercises the actual owner-supplied Kingfisher image via protected
  Google Cloud Run proxy, two real PES/DST phases, HMAC receipts,
  independent decoded-colour audits. Source match checked again vs md261.
- Inspects report for revision identity, fill-underlay audit, no added
  unresolved details, trims or local command density. Any fail is HOLD,
  not a traffic promotion. The native file remains a trial.
- New CLI helper **does not itself change live traffic**.
- `STITCH_FORGE_DETAIL_SAFE_ROUTING=0` protects existing working
  routing: MD-2.63 did not reduce actual PES trim count in a native A/B.

## Order after isolated worker test succeeds

1. Confirm all checks in Cloud Shell and preserve the resulting report.
2. Intentionally select new `md264` worker for a low-percentage
   rollout, with exact previous revisions and rollback command retained.
   Test live HTTPS website flow, packet identity, dimensions and
   explicit `workerRevision` metadata.
3. Publish the MD-2.64 static+Netlify functions website from GitHub
   `main` through the existing Netlify project after front-end CI passes,
   then confirm its actual deployed Git commit and URL.
4. Verify the actual target detailed Kingfisher + one other licensed
   complex illustration; keep digital files labelled NOT APPROVED.
5. Physical sewout and expert fabric review required before claiming
   production-quality products or general availability.

**Do not** infer approval from the synthetic poppy, a green CI run,
successful native PES/DST header check, or dimensional fit alone.

## Netlify capability limitation

Connected Netlify tools for this chat can read live deploy metadata,
but do not expose a deploy trigger action. The user may trigger the
site's existing Git-connected build from the Netlify Deploys dashboard.
Do not create a replacement site or upload unbuilt source manually.

Official Cloud Run no-traffic tagged deployments:
https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration

Netlify deployment docs:
https://docs.netlify.com/deploy/create-deploys/
