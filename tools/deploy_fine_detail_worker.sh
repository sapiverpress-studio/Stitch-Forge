#!/usr/bin/env bash
# Run in the Sapiver Press owner's authenticated Google Cloud Shell.
set -euo pipefail

if [[ "${1:-}" != "--execute" || "$#" != 1 ]]; then
  echo "Run with --execute to build once and deploy a private, tagged Fine Detail revision."
  exit 2
fi

PROJECT=gen-lang-client-0857863712
REGION=europe-west2
SERVICE=stitch-forge-worker-staging
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SHA="$(git -C "$ROOT" rev-parse HEAD)"
EXPECTED_WORKER_TREE=44031c59f19948ccb818fd9bc668773e1e3e6cbc
if [[ "$(git -C "$ROOT" rev-parse "$SOURCE_SHA:services/digitiser")" != "$EXPECTED_WORKER_TREE" ]]; then
  echo "The worker source differs from the reviewed adaptive workflow." >&2
  exit 2
fi
TAG="fine-detail-${SOURCE_SHA:0:7}"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/stitch-forge-staging/stitch-forge-worker:$SOURCE_SHA"
FLAGS="STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1,STITCH_FORGE_HOME_HYBRID_ENABLED=1,STITCH_FORGE_PRESERVE_FINE_DETAIL=1,STITCH_FORGE_ADAPTIVE_ARTWORK=1,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=120,STITCH_FORGE_HIGH_RES_PLAN_TRIAL=0,STITCH_FORGE_SOURCE_PALETTE_REFIT_TRIAL=0"
RUN_ARGS=(--project="$PROJECT" --region="$REGION")
for cmd in gcloud git python3 curl; do
  command -v "$cmd" >/dev/null || { echo "Cloud Shell needs $cmd." >&2; exit 2; }
done
git -C "$ROOT" cat-file -e "$SOURCE_SHA^{commit}" || {
  echo "The reviewed worker source is missing. Clone the deployment branch with depth 2." >&2
  exit 2
}

work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
gcloud run services describe "$SERVICE" "${RUN_ARGS[@]}" --format=json > "$work/before.json"
service_url="$(python3 - "$work/before.json" <<'PY'
import json, sys
from urllib.parse import urlparse

service = json.load(open(sys.argv[1]))
url = urlparse(service["status"]["url"])
if url.scheme != "https" or not url.hostname or not url.hostname.endswith(".run.app"):
    raise SystemExit("Expected the existing HTTPS Cloud Run service.")
if sum(item.get("percent", 0) for item in service["status"]["traffic"]) != 100:
    raise SystemExit("Could not verify the existing service traffic allocation.")
containers = service["spec"]["template"]["spec"]["containers"]
if not any(env.get("name") == "STITCH_FORGE_WORKER_TOKEN" and env.get("valueFrom", {}).get("secretKeyRef")
           for env in containers[0].get("env", [])):
    raise SystemExit("The service has no configured worker secret. Check the existing revision.")
print(url.geturl())
PY
)"
status="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$service_url/")"
if [[ "$status" != "401" && "$status" != "403" ]]; then
  echo "Could not verify that the Cloud Run service requires authentication." >&2
  exit 3
fi

existing_tag=0
if python3 - "$work/before.json" "$TAG" <<'PY'
import json, sys
routes = json.load(open(sys.argv[1]))["status"]["traffic"]
sys.exit(0 if any(route.get("tag") == sys.argv[2] for route in routes) else 1)
PY
then
  existing_tag=1
fi
image_digest() {
  gcloud artifacts docker images describe "$IMAGE" --project="$PROJECT" \
    --format='value(image_summary.fully_qualified_digest)'
}
if ! pinned_image="$(image_digest 2>"$work/image-error")"; then
  if [[ "$existing_tag" == 1 ]] || ! grep -Eqi 'NOT_FOUND|not found|does not exist' "$work/image-error"; then
    cat "$work/image-error" >&2
    exit 3
  fi
  echo "Building the reviewed Fine Detail worker image."
  mkdir "$work/source"
  git -C "$ROOT" archive "$SOURCE_SHA" services/digitiser | tar -x -C "$work/source"
  gcloud builds submit "$work/source" --project="$PROJECT" \
    --config="$work/source/services/digitiser/cloudbuild.staging.yaml" \
    --substitutions="_IMAGE=$IMAGE" --quiet
  pinned_image="$(image_digest)"
fi
digest="${pinned_image##*@sha256:}"
if [[ ! "$digest" =~ ^[0-9a-f]{64}$ || "$pinned_image" != "${IMAGE%:*}@sha256:$digest" ]]; then
  echo "Artifact Registry did not return the reviewed image digest." >&2
  exit 3
fi
if [[ "$existing_tag" == 0 ]]; then
  gcloud run deploy "$SERVICE" "${RUN_ARGS[@]}" --image="$pinned_image" \
    --no-traffic --tag="$TAG" --timeout=300 --concurrency=1 \
    --min-instances=0 --max-instances=1 --update-env-vars="$FLAGS" --quiet
fi

gcloud run services describe "$SERVICE" "${RUN_ARGS[@]}" --format=json > "$work/after.json"
read -r revision tagged_url < <(python3 - "$work/before.json" "$work/after.json" "$TAG" <<'PY'
import json, sys
from collections import Counter
from urllib.parse import urlparse

def routes(path):
    return json.load(open(path))["status"]["traffic"]

def served(traffic):
    counts = Counter()
    for route in traffic:
        if route.get("percent", 0):
            counts[route["revisionName"]] += route["percent"]
    return counts

before, after = map(routes, sys.argv[1:3])
if served(before) != served(after):
    raise SystemExit("Existing service traffic changed. Inspect the traffic before connecting Fine Detail.")
tag = sys.argv[3]
matches = [route for route in after if route.get("tag") == tag]
if len(matches) != 1 or matches[0].get("percent", 0):
    raise SystemExit("Could not verify an isolated Fine Detail tag.")
route = matches[0]
url = urlparse(route["url"])
if url.scheme != "https" or not url.hostname or not url.hostname.startswith(tag + "---") or not url.hostname.endswith(".run.app"):
    raise SystemExit("Cloud Run did not return the expected tagged HTTPS URL.")
print(route["revisionName"], url.geturl().rstrip("/"))
PY
)
gcloud run revisions describe "$revision" "${RUN_ARGS[@]}" --format=json > "$work/revision.json"
python3 - "$work/revision.json" "$FLAGS" "$pinned_image" <<'PY'
import json, sys

revision = json.load(open(sys.argv[1]))
if not any(c.get("type") == "Ready" and c.get("status") == "True" for c in revision["status"]["conditions"]):
    raise SystemExit("Cloud Run has not marked the Fine Detail revision ready.")
container = revision["spec"]["containers"][0]
expected = sys.argv[3]
actual = container["image"]
if actual != expected:
    raise SystemExit("The tagged revision does not identify the reviewed worker image.")
flags = dict(flag.split("=", 1) for flag in sys.argv[2].split(","))
env = {item["name"]: item.get("value") for item in container.get("env", [])}
if any(env.get(name) != value for name, value in flags.items()):
    raise SystemExit("The Fine Detail revision has unexpected settings.")
PY
printf '\nFine Detail revision ready. Standard service traffic verified.\n'
printf 'FINE_DETAIL_WORKER_URL=%s/v1/digitise\n' "$tagged_url"
