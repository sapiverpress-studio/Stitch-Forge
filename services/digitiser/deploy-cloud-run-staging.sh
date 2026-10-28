#!/usr/bin/env bash
# Opt-in staging ONLY. Default mode shows exact commands; no cloud resources
# are created without BOTH --execute and explicit billing/cost approval.
set -euo pipefail
usage() {
  echo "Usage: GOOGLE_CLOUD_PROJECT=... CLOUD_RUN_REGION=europe-west2 CLOUD_RUN_REPOSITORY=... STITCH_FORGE_CLOUD_SECRET=... bash services/digitiser/deploy-cloud-run-staging.sh [--execute]" >&2
}
case "${1:-}" in "" ) execute=false;; --execute) execute=true;; *) usage; exit 2;; esac
project="${GOOGLE_CLOUD_PROJECT:-}"
region="${CLOUD_RUN_REGION:-europe-west2}"
repository="${CLOUD_RUN_REPOSITORY:-}"
secret="${STITCH_FORGE_CLOUD_SECRET:-}"
service=stitch-forge-worker-staging
# Accept only bounded, predictable identifiers. No arbitrary flag injection.
valid='^[a-z][a-z0-9-]{2,62}$'
if ! [[ "$project" =~ $valid && "$region" =~ $valid && "$repository" =~ $valid && "$secret" =~ $valid ]]; then
  echo "ERROR: project, region, private Artifact Registry repository and existing Secret Manager secret must be supplied as valid identifiers." >&2
  usage
  exit 2
fi
if ! [[ "$region" =~ ^[a-z]+-[a-z]+[0-9]+$ ]]; then
  echo "ERROR: Cloud Run region must be a real regional identifier." >&2; exit 2
fi
# Build from a branch-specific short SHA, never mutable latest.
sha="${STITCH_FORGE_DEPLOY_COMMIT:-}"
if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: specify the reviewed full dev-branch SHA as STITCH_FORGE_DEPLOY_COMMIT" >&2
  exit 2
fi
image="${region}-docker.pkg.dev/${project}/${repository}/stitch-forge-worker:${sha}"
build=(gcloud builds submit --project "$project" --config services/digitiser/cloudbuild.staging.yaml --substitutions "_IMAGE=$image" .)
deploy=(gcloud run deploy "$service" --project "$project" --region "$region" --image "$image" --platform managed --port 8080 --cpu 2 --memory 2Gi --concurrency 1 --min-instances 0 --max-instances 1 --timeout 60 --cpu-throttling --execution-environment gen2 --allow-unauthenticated --set-secrets "STITCH_FORGE_WORKER_TOKEN=${secret}:latest" --labels "project=stitch-forge,stage=private-staging")
printf '%s\n' 'ALTERNATIVE HOST: Google Cloud Run (NOT Railway).'
printf '%s\n' 'NOTE: --allow-unauthenticated means public HTTPS routing; the WSGI worker still requires a distinct 32+ character Bearer token. Never publish this URL or token to clients. Request attacks can generate billable use.'
printf '%s\n' 'Billing-enabled project, private Artifact Registry, Cloud Build permission and Secret Manager secret must already exist.'
printf '%s\n' 'Use preview-only Netlify variables AFTER a real HTTPS/worker-token acceptance test; production remains HOLD.'
printf 'BUILD: '; printf '%q ' "${build[@]}"; echo
printf 'DEPLOY: '; printf '%q ' "${deploy[@]}"; echo
if [ "$execute" != true ]; then
  echo "DRY RUN ONLY: no hosting fees or Google Cloud writes performed."
  exit 0
fi
if [ "${STITCH_FORGE_CLOUD_BILLING_APPROVED:-}" != "yes-for-this-staging-deploy" ]; then
  echo "REFUSED: explicitly approved billing account required; set STITCH_FORGE_CLOUD_BILLING_APPROVED only after reviewing potential Cloud Build, Artifact Registry, networking and compute charges." >&2
  exit 3
fi
command -v gcloud >/dev/null || { echo 'gcloud CLI unavailable' >&2; exit 3; }
# Keep repo immutable throughout the build. Prevent accidentally deploying main
# or a different checkout when project owner intended the development branch.
head="$(git rev-parse HEAD 2>/dev/null || true)"
branch="$(git branch --show-current 2>/dev/null || true)"
if [ "$head" != "$sha" ] || [ "$branch" != "develop/stitch-engine-foundation" ]; then
  echo "REFUSED: exact reviewed development SHA/branch must be checked out" >&2
  exit 3
fi
echo "Executing explicitly approved staging build and deploy..."
"${build[@]}"
"${deploy[@]}"
echo "Staging service deployed. Keep the Netlify preview disconnected until authenticated HTTP smoke passes."
