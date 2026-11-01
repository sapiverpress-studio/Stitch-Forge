#!/usr/bin/env bash
# MD-2.61 isolated, source-matched Cloud Run acceptance from GitHub main.
# --preflight is read-only. --execute requires a one-build billing approval.
# NEVER shifts live traffic, updates Netlify or publishes a file for sale.
set -euo pipefail
MODE="${1:---preflight}"
if [[ "$MODE" != "--preflight" && "$MODE" != "--execute" ]]; then
  echo "Use: bash tools/deploy_md261_tag.sh [--preflight|--execute]" >&2; exit 2
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT="gen-lang-client-0857863712"
REGION="europe-west2"
SERVICE="stitch-forge-worker-staging"
REGISTRY="stitch-forge-staging"
TAG="md261"
ORIGINAL="stitch-forge-worker-staging-00001-pst"
for executable in git gcloud node python3; do
  command -v "$executable" >/dev/null || { echo "REFUSED: missing $executable"; exit 3; }
done
if [[ "$(git branch --show-current)" != "main" || -n "$(git status --porcelain)" ]]; then
  echo "REFUSED: use a clean checkout of GitHub main (never reset your changes)." >&2; exit 3
fi
SHA="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse refs/remotes/origin/main 2>/dev/null || true)"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ || "$SHA" != "$REMOTE" ]]; then
  echo "REFUSED: local main does not match fetched origin/main." >&2; exit 3
fi
# Verify that MD-2.61's audited implementation is an ancestor of the current main.
if ! git merge-base --is-ancestor "054768fc0b8d4a4e64f580cc0b0a368f451a84a8" "$SHA"; then
  echo "REFUSED: MD-2.61 validated implementation is absent." >&2; exit 3
fi
VENV="$HOME/md255-test-venv/bin/python"
[[ -x "$VENV" ]] || { echo "REFUSED: existing Python test environment absent"; exit 3; }
BASELINES=( "$HOME"/md256-kingfisher-*-NOT-APPROVED.zip )
[[ -f "${BASELINES[0]}" ]] || { echo "REFUSED: source-identical MD-2.56 baseline missing"; exit 3; }

TRAFFIC="$(mktemp)"
trap 'rm -f "$TRAFFIC"' EXIT
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > "$TRAFFIC"
"$VENV" - "$ORIGINAL" "$TRAFFIC" "$ROOT" <<'PY'
import json,sys,zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
original,traffic,root=sys.argv[1:]
distribution=json.loads(Path(traffic).read_text())['status']['traffic']
primary=sum(x.get('percent',0) for x in distribution if x.get('revisionName')==original)
other=sum(x.get('percent',0) for x in distribution if x.get('revisionName')!=original)
if primary!=100 or other:
    raise SystemExit('REFUSED: the existing worker is not on the protected original 100% revision')
sys.path.insert(0,str(Path(root)/'tools'))
from staged_md255_kingfisher import image_input,prepare
baselines=sorted(Path.home().glob('md256-kingfisher-*-NOT-APPROVED.zip'),
    key=lambda p:p.stat().st_mtime,reverse=True)
with zipfile.ZipFile(baselines[0]) as z:
    if z.testzip():raise SystemExit('REFUSED: corrupted original benchmark')
    old=json.loads(z.read('machine-report.json'))
with TemporaryDirectory(prefix='md261-source-preflight-') as work:
    packet,meta=prepare(image_input(),Path(work))
if packet['requestId']!=old.get('requestId'):
    raise SystemExit('REFUSED: Kingfisher source no longer matches MD-2.56 request ID')
print('PASS: old worker traffic 100%; source byte-identical to original benchmark')
print('PASS: source requestId',packet['requestId'])
PY

IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REGISTRY/stitch-forge-worker:md261-${SHA:0:12}"
echo "REVIEWED main: $SHA"
echo "Proposed private image: $IMAGE"
echo "Protected revision: $ORIGINAL (must remain 100%)"
echo "Target: tagged md261 revision, 0% traffic"
echo "One Google Cloud Build, Artifact Registry and private test requests can incur charges."
if [[ "$MODE" == "--preflight" ]]; then
  echo "PREFLIGHT ONLY: no builds, deployments or traffic changes were made."
  exit 0
fi
if [[ "${STITCH_FORGE_MD261_BILLING_APPROVED:-}" != "yes-for-one-staging-build" ]]; then
  echo "REFUSED: one-build billing consent flag absent." >&2; exit 3
fi
echo "BUILDING EXACT REVIEWED MAIN REVISION"
gcloud builds submit --project="$PROJECT" \
 --config=services/digitiser/cloudbuild.staging.yaml \
 --substitutions="_IMAGE=$IMAGE" .
echo "INSTALLING PRIVATE ZERO-TRAFFIC REVISION (NOT LIVE)"
gcloud run deploy "$SERVICE" --image="$IMAGE" --project="$PROJECT" \
 --region="$REGION" --no-traffic --tag="$TAG" --timeout=300 \
 --update-env-vars="STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1,STITCH_FORGE_AUTO_SOURCE_REPAIR=1,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110,STITCH_FORGE_BETA_COMPACT_RUNNING=0"
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
 --format='json(status.traffic)' > "$TRAFFIC"
"$VENV" - "$ORIGINAL" "$TRAFFIC" <<'PY'
import json,sys
from pathlib import Path
old,filename=sys.argv[1:]
traffic=json.loads(Path(filename).read_text())['status']['traffic']
primary=sum(x.get('percent',0) for x in traffic if x.get('revisionName')==old)
other=sum(x.get('percent',0) for x in traffic if x.get('revisionName')!=old)
tags=[x for x in traffic if x.get('tag')=='md261']
if primary!=100 or other!=0 or len(tags)!=1 or tags[0].get('percent',0)!=0:
    raise SystemExit('STOP: worker revision traffic isolation changed unexpectedly')
print('PASS: original 100%; md261 tagged 0%, user traffic unaffected')
PY
echo "RUNNING SOURCE-IDENTICAL KINGFISHER PES/DST WITH INDEPENDENT AUDIT"
export STITCH_FORGE_BENCHMARK_SOURCE_ROOT="$ROOT"
export STITCH_FORGE_STAGED_TAG="$TAG"
"$VENV" "$ROOT/tools/staged_md255_kingfisher.py"
echo "MD-2.61 ISOLATED BENCHMARK COMPLETE; LIVE TRAFFIC AND NETLIFY UNCHANGED."
