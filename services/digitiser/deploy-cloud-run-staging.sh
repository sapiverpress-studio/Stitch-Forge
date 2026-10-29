#!/usr/bin/env bash
# Cloud Run staging, NEVER an automatic production deployment. Defaults to
# PLAN ONLY. No Google Cloud writes absent both --execute and charge approval.
set -euo pipefail
usage() {
  echo "Usage: GOOGLE_CLOUD_PROJECT=... CLOUD_RUN_REPOSITORY=... CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=... STITCH_FORGE_CLOUD_SECRET=... STITCH_FORGE_DEPLOY_COMMIT=<full 40-hex SHA> bash services/digitiser/deploy-cloud-run-staging.sh [--execute]" >&2
}
case "${1:-}" in "" ) execute=false;; --execute) execute=true;; *) usage; exit 2;; esac
project="${GOOGLE_CLOUD_PROJECT:-}"
region="${CLOUD_RUN_REGION:-europe-west2}"
repository="${CLOUD_RUN_REPOSITORY:-}"
secret="${STITCH_FORGE_CLOUD_SECRET:-}"
runtime_sa="${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:-}"
service=stitch-forge-worker-staging
valid='^[a-z][a-z0-9-]{2,62}$'
if ! [[ "$project" =~ $valid && "$region" =~ $valid && "$repository" =~ $valid && "$secret" =~ $valid ]]; then
  echo "ERROR: supply an existing project, Cloud Run region, private Artifact Registry repository and Secret Manager secret." >&2
  usage
  exit 2
fi
if ! [[ "$region" =~ ^[a-z]+-[a-z0-9]+[0-9]+$ ]]; then
  echo "ERROR: Cloud Run region malformed." >&2; exit 2
fi
if [[ "$runtime_sa" != *"@"*".iam.gserviceaccount.com" ]]; then
  echo "ERROR: a restricted existing CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT is required." >&2
  exit 2
fi
sha="${STITCH_FORGE_DEPLOY_COMMIT:-}"
if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: specify the full reviewed development SHA as STITCH_FORGE_DEPLOY_COMMIT." >&2
  exit 2
fi
if [[ ! -f services/digitiser/Dockerfile || ! -f services/digitiser/cloudbuild.staging.yaml ]]; then
  echo "ERROR: run from Stitch-Forge repository root." >&2; exit 2
fi
image="${region}-docker.pkg.dev/${project}/${repository}/stitch-forge-worker:${sha}"
build=(gcloud builds submit --project "$project" --config services/digitiser/cloudbuild.staging.yaml --substitutions "_IMAGE=$image" .)
deploy=(gcloud run deploy "$service" --project "$project" --region "$region"
 --image "$image" --platform managed --port 8080 --cpu 2 --memory 2Gi
 --concurrency 1 --min-instances 0 --max-instances 1 --timeout 60
 --cpu-throttling --execution-environment gen2 --ingress all
 --no-allow-unauthenticated --service-account "$runtime_sa"
 --set-secrets "STITCH_FORGE_WORKER_TOKEN=${secret}:latest"
 --labels "project=stitch-forge,stage=private-staging" --quiet)
printf '%s\n' 'STAGING: Google Cloud Run (NO Railway).'
printf '%s\n' 'Cloud Run IAM REQUIRED: no public invoker; Netlify later uses a Google-signed ID token PLUS the separate worker secret.'
printf '%s\n' 'Minimum instances = 0, maximum instances = 1. Cold starts may exceed the Netlify synchronous timeout.'
printf '%s\n' 'Cloud Build, Artifact Registry, Secret Manager, networking, CPU, logging and storage can incur charges.'
printf 'BUILD: '; printf '%q ' "${build[@]}"; echo
printf 'DEPLOY: '; printf '%q ' "${deploy[@]}"; echo
if [ "$execute" != true ]; then
  echo "DRY RUN ONLY: no Google Cloud access, deployment, secrets or charges."
  exit 0
fi
if [ "${STITCH_FORGE_CLOUD_BILLING_APPROVED:-}" != "yes-for-this-staging-deploy" ]; then
  echo "REFUSED: explicit charge authorisation STITCH_FORGE_CLOUD_BILLING_APPROVED=yes-for-this-staging-deploy is required." >&2
  exit 3
fi
# Prevent deploying production, another SHA, or an uncommitted working tree.
head="$(git rev-parse HEAD 2>/dev/null || true)"
branch="$(git branch --show-current 2>/dev/null || true)"
if [ "$head" != "$sha" ] || [ "$branch" != "develop/stitch-engine-foundation" ] ||
   [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "REFUSED: exact clean reviewed development branch/SHA required." >&2
  exit 3
fi
command -v gcloud >/dev/null || { echo 'gcloud CLI required (Cloud Shell is suitable).' >&2; exit 3; }
billing="$(gcloud beta billing projects describe "$project" --format='value(billingEnabled)' 2>/dev/null || true)"
if [[ "$billing" != "True" && "$billing" != "true" ]]; then
  echo "REFUSED: existing billing-enabled project could not be verified (no billing services will be enabled)." >&2
  exit 3
fi
apis="$(gcloud services list --enabled --project="$project" --format='value(config.name)')"
for api in run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com; do
  if ! grep -qx "$api" <<< "$apis"; then
    echo "REFUSED: required API not already enabled: $api" >&2
    exit 3
  fi
done
gcloud artifacts repositories describe "$repository" --project "$project" --location "$region" >/dev/null
gcloud secrets describe "$secret" --project "$project" >/dev/null
gcloud iam service-accounts describe "$runtime_sa" --project "$project" >/dev/null
echo "Preflight succeeded. Executing explicitly approved private staging build/deploy..."
"${build[@]}"
"${deploy[@]}"
url="$(gcloud run services describe "$service" --project "$project" --region "$region" --format='value(status.url)')"
if [[ "$url" != https://*.run.app ]]; then
 echo "No valid HTTPS run.app URL returned; do not configure Netlify." >&2
 exit 3
fi
echo "Deployed PRIVATE Cloud Run service: $url"
echo "NEXT GATE: configure restricted invoker IAM, verify real private HTTPS smoke,"
echo "and ONLY THEN add staging-only Netlify credentials. No production merge."
