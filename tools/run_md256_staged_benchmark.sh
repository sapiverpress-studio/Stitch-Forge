#!/usr/bin/env bash
# Protected MD-2.56 staging-only benchmark; never changes normal traffic.
# Run from a clone of feature/beta-running-compaction-md256.
set -euo pipefail

PROJECT="gen-lang-client-0857863712"
REGION="europe-west2"
SERVICE="stitch-forge-worker-staging"
EXPECTED_ORIGINAL="stitch-forge-worker-staging-00001-pst"
TAG="md256"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for tool in gcloud git python3 node; do
  command -v "$tool" >/dev/null || { echo "Missing required program: $tool"; exit 1; }
done
if [[ "$(git branch --show-current)" != "feature/beta-running-compaction-md256" ]]; then
  echo "REFUSED: only the isolated MD-2.56 experiment branch may be staged."
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "REFUSED: uncommitted local modifications would make the build unrepeatable."
  exit 1
fi
SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short=12 HEAD)"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "REFUSED: cannot identify immutable Git revision."
  exit 1
fi

# Verify identity and original traffic BEFORE any chargeable operation.
gcloud secrets versions access latest \
  --secret=stitch-forge-worker-token --project="$PROJECT" > /dev/null
gcloud run services describe "$SERVICE" \
  --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > /tmp/sf-md256-before-traffic.json
python3 - "$EXPECTED_ORIGINAL" /tmp/sf-md256-before-traffic.json <<'PY'
import json,sys
original,path=sys.argv[1:]
traffic=json.load(open(path))["status"]["traffic"]
original_percent=sum(t.get("percent",0) for t in traffic
                     if t.get("revisionName")==original)
other_percent=sum(t.get("percent",0) for t in traffic
                  if t.get("revisionName")!=original)
if original_percent!=100 or other_percent:
    raise SystemExit("REFUSED: normal traffic no longer belongs exclusively to original worker")
print("SAFETY CHECK: original worker has 100% traffic")
PY

# Previously generated exact-source baseline is required for numerical A/B.
if ! compgen -G "$HOME/md255-kingfisher-*-NOT-APPROVED.zip" >/dev/null; then
  echo "REFUSED: missing previously verified MD-2.55 kingfisher ZIP baseline."
  exit 1
fi
if ! compgen -G "$HOME/file_*.png" >/dev/null; then
  echo "REFUSED: uploaded kingfisher image not found."
  exit 1
fi

IMAGE="$REGION-docker.pkg.dev/$PROJECT/stitch-forge-staging/stitch-forge-worker:md256-$SHORT_SHA"
echo "BUILDING ISOLATED IMAGE: $SHORT_SHA"
echo "Cloud Build and Cloud Run usage may incur charges."
gcloud builds submit --project="$PROJECT" \
  --config=services/digitiser/cloudbuild.staging.yaml \
  --substitutions="_IMAGE=$IMAGE" .

echo "DEPLOYING PROTECTED REVISION: $TAG; no normal traffic shift"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" --project="$PROJECT" --region="$REGION" \
  --no-traffic --tag="$TAG" --timeout=300 \
  --update-env-vars="STITCH_FORGE_BETA_COMPACT_RUNNING=1,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110"

gcloud run services describe "$SERVICE" \
  --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > /tmp/sf-md256-after-traffic.json
python3 - "$EXPECTED_ORIGINAL" /tmp/sf-md256-after-traffic.json <<'PY'
import json,sys
original,path=sys.argv[1:]
traffic=json.load(open(path))["status"]["traffic"]
if sum(t.get("percent",0) for t in traffic if t.get("revisionName")==original)!=100:
    raise SystemExit("CRITICAL: original traffic changed; stop testing and inspect Cloud Run immediately")
tagged=[t for t in traffic if t.get("tag")=="md256"]
if len(tagged)!=1 or tagged[0].get("percent",0)!=0:
    raise SystemExit("REFUSED: MD-2.56 is not clearly tagged at 0% traffic")
print("SAFETY CHECK: original remains 100% live; md256 is tagged at 0%")
PY

PYTHON="$HOME/md255-test-venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  echo "No existing isolated Python environment found. Re-run using the existing venv; no native test run."
  exit 1
fi
echo "RUNNING EXACT-SOURCE KINGFISHER PES/DST A/B"
export STITCH_FORGE_BENCHMARK_SOURCE_ROOT="$ROOT"
export STITCH_FORGE_STAGED_TAG="$TAG"
"$PYTHON" "$ROOT/tools/staged_md255_kingfisher.py"
echo "Staging test finished; production traffic remains untouched."
