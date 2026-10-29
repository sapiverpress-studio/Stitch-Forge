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

## MD-2.19 staging package (2026-10-28)

`services/digitiser/Dockerfile` builds an amd64 Ubuntu 24.04 worker with
Gunicorn 23.0.0, pyembroidery 1.5.1 and a SHA-256-pinned official Ink/Stitch
3.3.0 archive. `install_engine.py` refuses a changed digest; upstream digest
observed from GitHub release metadata is
`162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79`.
Upstream files/notices remain in the image. Do not publish the image without
completing redistribution/licence review. Ubuntu packages remain repository
resolved, so this is not a fully bit-reproducible base image.

Use the supplied `compose.staging.yml` on an **approved existing Linux amd64
host**. It binds only to loopback, drops capabilities, runs UID 10001 with a
read-only root, limits RAM to 2 GiB / CPU to 2 / PIDs to 128 and uses a 256 MiB
volatile `/tmp`. Supply a dedicated random token (at least 32 characters) from
the host secret manager; do not commit a `.env` file. No source images enter
this service. Request contents and authorization headers are not access-logged.

Exactly one Gunicorn process with two threads allows the in-process lock to
reject overlap with 429 rather than queue another 45-second engine request.
This supersedes the earlier recommendation for a synchronous worker. Do not
scale replicas until shared concurrency/rate control is implemented.

Before setting Netlify variables, run `http_smoke.py --url
https://APPROVED-HOST/v1/digitise --project
tests/fixtures/synthetic_four_panel_moth.json` with the token in the environment.
This checks wrong credentials, source-data rejection, invalid geometry and
independently decodes the real multicolour archive. The fixture is entirely
synthetic: four panels, outlines/veins, two markings, segmented body and antennae.
It is not the user's moth and does not demonstrate source-image reconstruction.

Hosting blocker: connected Netlify has no `STITCH_FORGE_ENGINE_URL` or
`STITCH_FORGE_WORKER_TOKEN`; Render/Railway plugins are available but not
connected. No existing approved native host, credentials or verified free
allocation was established. A paid plan/trial has not been purchased or opened.
The simplest next step is an approved existing amd64 host with an HTTPS reverse
proxy, request-size/rate limits and the supplied private container. If none is
available, owner must choose/connect a host and approve its actual cost first.
Only then configure the two variables in **deploy-preview** functions context,
never `all` or production, and test the preview through that actual HTTPS route.
The exposed connector does not enforce context-scoped updates to existing keys;
verify context and scopes after any write. No secrets were changed this session.

Local Gunicorn/native tests do not prove the Docker image or hosted HTTPS path.
The real-engine CI now also builds/runs the container with the same isolation
flags and calls the HTTP smoke; inspect its result before marking it verified.

## Verified container acceptance

[CI run 40748116743](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40748116743)
passed at `bd7ba8a9a4c09656488cad89c466a7339e2e2b4c`, including the
resource-limited Docker runtime and real HTTP/independent PES/DST matrix for
all three synthetic subjects. Initial xvfb-run startup failed; explicit
Unix-only Xvfb with bounded socket readiness passed. The native display has
no TCP listener. Local logo/line-art fixtures avoid moth-only acceptance.
This is a tested container package, not a deployed persistent HTTPS service.

## MD-2.20 — Google Cloud Run private staging route (2026-10-29)

**Platform decision:** Google Cloud Run, not Railway. This is a staged integration
plan and checked-in implementation, NOT an existing Google Cloud deployment.
The Google Cloud account/project and an approved billing arrangement have not
been accessed from this session. Nothing billable has been provisioned.

### What is implemented

- `services/digitiser/cloudbuild.staging.yaml`: builds the already-tested
  `services/digitiser/Dockerfile` into a private amd64 Artifact Registry image,
  tagged with the exact reviewed commit SHA.
- `services/digitiser/deploy-cloud-run-staging.sh`: defaults to dry-run; a
  deployment requires `--execute`, `STITCH_FORGE_CLOUD_BILLING_APPROVED=yes-for-this-staging-deploy`,
  existing billing/API/registry/secret/service-account configuration and a
  clean, exact `develop/stitch-engine-foundation` source checkout.
- Security and limits: **Google Cloud Run IAM required** (no anonymous Cloud Run
  Invoker), **a second application bearer secret**, 2 vCPU/2 GiB, concurrency 1,
  max instances 1, min instances 0, port 8080, CPU allocated on requests only.
  These are cost controls, not a guaranteed zero-cost arrangement; billing,
  Cloud Build, Artifact Registry, Secret Manager, egress and logging may incur
  charges. Cold starts can exceed the current synchronous Netlify 55-second
  limit, especially with the large native Ink/Stitch container.
- `netlify/functions/lib/cloud-run-auth.mjs`: Netlify (server only) can obtain
  an audience-bound Google-signed ID token from a restricted invoker service
  account. It sends `X-Serverless-Authorization: Bearer <GOOGLE_ID_TOKEN>`
  alongside the independent worker `Authorization: Bearer <WORKER_TOKEN>`.
  Caller credentials are only accepted for an exact HTTPS `*.run.app/v1/digitise`
  URL, never arbitrary hosts.
- Netlify defaults to **disabled** until all three deploy-preview-only variables
  exist, including `STITCH_FORGE_ENGINE_URL`,
  `STITCH_FORGE_WORKER_TOKEN` and
  `STITCH_FORGE_CLOUD_RUN_CALLER_JSON`. Do **not** use production/all contexts.

### Prerequisites (must be owner-approved, not automated here)

1. An existing billing-enabled Google Cloud project in a selected region
   (suggested `europe-west2`, London). Confirm the actual billing plan,
   budget alerts and account privileges. **Cloud Billing budgets are alerts,
   not hard spending caps.**
2. A private Docker Artifact Registry repository, Cloud Build and Cloud Run
   APIs enabled, and a Secret Manager entry for a random worker token at least
   32 characters long.
3. A restricted Cloud Run runtime service account with read access only to
   this worker secret; and a *separate* Netlify caller service account granted
   `roles/run.invoker` **on this exact Cloud Run staging service only**.
   A user-managed service-account JSON key is supported for initial staging
   but is security-sensitive and needs rotation/secure storage. Prefer
   short-lived workload identity federation when an appropriate issuer is
   available. Never store a JSON key in GitHub or share it in chat.
4. A reviewed exact development commit. Run the cloud deployment script with
   environment variables `GOOGLE_CLOUD_PROJECT`, `CLOUD_RUN_REGION`,
   `CLOUD_RUN_REPOSITORY`, `STITCH_FORGE_CLOUD_SECRET`,
   `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` and
   `STITCH_FORGE_DEPLOY_COMMIT`. Default invocation **prints the complete
   plan and changes nothing**. Execution is intentionally blocked unless
   the explicit billing-approval flag and `--execute` are supplied.
5. Run the existing `services/digitiser/http_smoke.py` **against the real
   private service** using an authorized Google ID token plus the worker bearer.
   The current smoke script authenticates only with the worker bearer; a
   Cloud Run IAM test harness or gcloud identity-token wrapper is still needed.
   Do not treat CI's local Docker HTTP smoke as proof of live IAM or HTTPS.

### Netlify preview coupling

After the private worker passes authenticated real HTTPS tests:
set the two worker connection variables and the **caller JSON credential**
in Netlify's **deploy-preview/functions** context only; verify scopes.
The existing `STITCH_FORGE_ANALYSIS_TOKEN` is not a Google Cloud credential,
and the worker token must not appear in the browser. Test a single real
preview request, malformed input, unauthorized request and automatic ZIP
download while keeping `main` and production configuration unchanged.

**Not achieved:** Google project connection, deployment, real HTTPS IAM smoke,
preview worker integration, real owner image accuracy, physical stitch-out or
universal supported-image coverage.

**Official references:** Cloud Run authentication
https://docs.cloud.google.com/run/docs/authenticating/service-to-service ,
deployment https://docs.cloud.google.com/run/docs/deploying ,
billing https://docs.cloud.google.com/run/docs/configuring/billing-settings .
