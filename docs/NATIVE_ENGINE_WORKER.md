# Native Ink/Stitch worker — development integration, NOT deployed

**Status (2026-10-28):** GitHub CI successfully executed an actual two-colour
project transaction with upstream Ink/Stitch 3.3.0 + pyembroidery 1.5.1.
No dedicated worker service has been provisioned, deployed, security-reviewed
or authorised for public use. The Netlify proxy defaults to HTTP 503.

## Automatic call chain

1. The owner's click on **Reconstruct embroidery automatically** sends the
   original downsampled image only to the private OpenAI analysis endpoint.
2. The browser validates the model geometry against the actual original pixels
   and atomically rebuilds editable paths. Only after success, it calls
   `/api/machine-embroidery` with **paths, pathStyles, pathColors, width, hoop**.
   Neither the original image nor any embedded SVG/text/source reference leaves
   for the machine worker.
3. The Netlify function requires `STITCH_FORGE_ANALYSIS_TOKEN` and, only when
   both required worker settings exist, authenticates server-to-server over
   HTTPS. It checks the returned ZIP length, PNG? **No**: binary ZIP signature,
   audit marker and SHA-256 digest before relaying an attachment.
4. The optional Python WSGI worker requires its own private token. It rejects
   unsupported JSON keys and oversized bodies, refuses concurrent requests,
   generates trusted numeric SVG with Ink/Stitch schema marker 4, runs the
   pinned executable and independently audits PES/DST stitch counts, extents
   and colour changes. No archive is returned before all checks pass.
5. The browser downloads the ZIP automatically only for a successfully audited
   response; all files remain explicitly labelled **UNTESTED on physical fabric**.
   Failure leaves SVG/Undo available without browser-made multicolour PES/DST.

## Deployment requirements — outstanding

A **separate, sandboxed persistent Linux worker** must be provisioned and
independently security-reviewed. Netlify Functions do not bundle or execute
the native Ink/Stitch release in this architecture. A free/static Netlify
deployment alone cannot make machine export work.

- Pin the actual Ink/Stitch **v3.3.0** official release archive, verify SHA-256
  against upstream metadata and safely extract internal-only symbolic links.
- Install `pyembroidery==1.5.1`, compatible native graphical libraries and
  dedicated `Xvfb` headless display, verified on Ubuntu 24.04 by GitHub CI.
- Use a **dedicated isolated process/container** with restricted filesystem,
  no customer-file persistence, no arbitrary XML/image input, memory/CPU/pid
  limits, non-root runtime, request caps, upstream TLS and observability that
  excludes secrets/artwork. The WSGI module is a **contract prototype**, not
  a fully secured container deployment manifest.
- Run exactly **one** synchronous WSGI worker per service instance until
  load/abuse tests are complete. The in-process lock alone does not enforce
  global concurrency across multiple container instances.
- Worker environment: `STITCH_FORGE_INKSTITCH_PATH` absolute path to pinned
  actual binary, `STITCH_FORGE_WORKER_TOKEN` long secret not known to browsers,
  `DISPLAY`/compatible Xvfb configuration. Worker endpoint
  `POST /v1/digitise`. Engine deadline: **45 seconds**.
- Netlify environment: existing `STITCH_FORGE_ANALYSIS_TOKEN`, private
  `STITCH_FORGE_WORKER_TOKEN` (same as worker), plus
  `STITCH_FORGE_ENGINE_URL=https://<your-dedicated-worker-host>/v1/digitise`.
  No URL or token should be set until the dedicated service has been tested.
  Netlify proxy deadline: **55 seconds**, maximum source geometry 250 KB and
  response machine ZIP 3 MB.
- No commercial machine compatibility, stitch density, satin, trim, or fabric
  safety has been established. **No production merge or live API enabling** is
  authorised without a separate release gate.

## Reproducible evidence

- [Real JSON-to-machine run 40736329733](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736329733):
  two-colour synthetic project, independent PES/DST audit, one colour change.
- [AI security/mobile 40736379812](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736379812):
  27 Node tests green; mocked Android-sized browser reconstruction passed.
- [Python regression 40736463799](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736463799):
  56 tests passed, 3 skipped (optional dependencies).
- [Real engine + new job assertions 40736463798](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736463798):
  passed.
- Another mocked browser test checks successful automatic ZIP handling; check
  its post-commit GitHub workflow before treating that interaction as verified.

## Next acceptance gates

Real owner-only image semantic benchmark, staging HTTPS worker end-to-end,
single-click audited ZIP download through the actual deployed service,
resource-limited handling of malformed geometry, multi-design QA and physical
embroidery test. The UI must never silently fall back to unverified multicolour
browser exporters.
