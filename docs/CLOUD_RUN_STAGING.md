# Cloud Run staging alternative — Railway NOT required

**Status: configuration staged on development branch only. No cloud project,
billing account, hosted runtime, container registry, DNS or credentials were
created. No production service was changed.**

## Why Cloud Run

The existing non-root, Xvfb-enabled Ink/Stitch Docker container was verified in
GitHub Actions on Ubuntu amd64 with 2 CPUs and 2 GiB of RAM. Google Cloud Run
can deploy that container with the same initial resource limits, **scale to
zero**, and supply an HTTPS service endpoint without a persistent VPS.
Unlike persistent hosting, idle instance count can be zero.

**Not automatically free:** Cloud Run has a request-based free tier, but
requires a billing-enabled Google Cloud project. Cloud Build, private
Artifact Registry storage/traffic, compute beyond allowances and malicious
traffic can generate charges. The provider's free allocation does not equal
a guaranteed £0 bill. Review Google Cloud's live pricing before consent:
https://cloud.google.com/run/pricing

## What is prepared

- `services/digitiser/cloudbuild.staging.yaml`: build and push the **existing**
  trusted Dockerfile into the account owner's **private** Artifact Registry.
- `services/digitiser/deploy-cloud-run-staging.sh`: dry-run by default. An
  execution requires a reviewed 40-character development commit SHA,
  `--execute`, `STITCH_FORGE_CLOUD_BILLING_APPROVED=yes-for-this-staging-deploy`,
  actual gcloud credentials, existing private registry and Secret Manager secret.
  No execution was authorised in the current session.
- `tests/test_cloudrun_deploy.py`: fail-closed dry-run, unsafe identifier,
  branch/SHA mismatch and explicit billing-approval tests.

Initial configuration: `europe-west2` (London), `linux/amd64`, 2 vCPU,
2 GiB memory, request concurrency 1, min instances 0, max instances 1,
60-second request timeout. The container's existing `PORT=8080` support,
headless display, token requirement and independent PES/DST audit remain intact.

## Critical staging security distinction

Cloud Run defaults to **private IAM**. This particular *temporary staging*
script now uses `--no-allow-unauthenticated` so the existing Netlify function can
reach its Google HTTPS address, and the Python worker still rejects all
requests without the separate, long random worker Bearer secret.

**This is NOT a fully private network endpoint.** Public unauthenticated
requests will be refused by the app, but may still consume billable Cloud Run
requests and affect availability. Set a strict Google Cloud budget/alerts,
review ingress abuse and never enable it for public release without stronger
Google IAM identity-token access, controls and formal cost approval. Budget
alerts are not a hard spending cap. An external caller cannot obtain the
engine token or reconstructed user artwork through the client bundle.

The Netlify credentials **must not** be modified until a real owner-approved
staging service passes a live HTTPS authenticated smoke test. Restrict new
`STITCH_FORGE_WORKER_TOKEN` and `STITCH_FORGE_ENGINE_URL` to
**deploy-preview functions** context, not production, and confirm scopes.
Do not expose the worker token in local storage, an image, GitHub logs or the
browser.

## Preflight on owner-approved Google Cloud account

The Google Cloud project requires billing enabled, `run.admin`, Cloud Build,
private Artifact Registry repository and build permissions, Secret Manager
secret `STITCH_FORGE_WORKER_TOKEN` (at least 32 randomly generated
characters), and a runtime service account with only secret-access rights.

With the reviewed development branch checked out and *without deploying*:

```bash
export GOOGLE_CLOUD_PROJECT=your-billing-approved-project
export CLOUD_RUN_REGION=europe-west2
export CLOUD_RUN_REPOSITORY=your-existing-private-registry
export STITCH_FORGE_CLOUD_SECRET=your-existing-worker-token-secret-name
export STITCH_FORGE_DEPLOY_COMMIT=full-40-character-reviewed-development-commit
bash services/digitiser/deploy-cloud-run-staging.sh
```

The script prints an exact Cloud Build and Cloud Run command and then exits
**without running them**. Only after independently reviewing charges and
approving spending would a separately authorised operator run the
`--execute` form. Do not set the billable-deployment approval flag speculatively.

Following any approved staging deployment:
1. Run authenticated `http_smoke.py` against the Cloud Run HTTPS URL,
   measuring real 401/422 behavior and AES? **No**, the current independent
   PES/DST ZIP audit.
2. Confirm cold-start request latency fits the **Netlify 55-second** deadline.
   Scale-to-zero could make initial requests too slow; do not silently change
   the deadline or pretend this is an instant worker.
3. Only after that, add private Netlify function credentials to **preview only**
   and test image→AI→project→Cloud Run→PES/DST→browser ZIP with an authorised
   image. Avoid publishing the user moth to GitHub.
4. Keep release on HOLD until fabric stitch-outs demonstrate density, trims,
   satin geometry and correct machine behavior.

## Limitations

- **No Google Cloud account connection** is available to this conversation;
  there is no way to provision Cloud Run from the existing GitHub/Netlify
  connectors alone.
- No Google IAM private-invoker delegation from Netlify has been implemented.
  Before general use, prefer adding IAM service-to-service authentication
  rather than relying only on bearer token at a publicly routable endpoint.
- No active hosted service, cost commitment or OpenAI request has occurred.
- Physical embroidery testing remains absent; PES/DST are experimental.
