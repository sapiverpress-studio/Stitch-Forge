#!/usr/bin/env bash
# MD-2.57 protected Kingfisher A/B. Default is read-only preflight.
# Explicit --execute and an approval flag are BOTH required for cloud charges.
# Never shifts production Cloud Run traffic or deploys Netlify.
set -euo pipefail

PROJECT="gen-lang-client-0857863712"
REGION="europe-west2"
SERVICE="stitch-forge-worker-staging"
EXPECTED_ORIGINAL="stitch-forge-worker-staging-00001-pst"
BRANCH="feature/fill-preserving-native-repair-md257"
TAG="md257"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---preflight}"
if [[ "$MODE" != "--preflight" && "$MODE" != "--execute" ]]; then
  echo "Usage: bash tools/run_md257_staged_benchmark.sh [--preflight | --execute]"
  exit 2
fi
cd "$ROOT"
for tool in gcloud git python3 node; do
  command -v "$tool" >/dev/null || { echo "REFUSED: missing $tool"; exit 1; }
done
if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "REFUSED: checkout $BRANCH first"
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "REFUSED: uncommitted working tree changes"
  exit 1
fi
SHA="$(git rev-parse HEAD)"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "REFUSED: cannot verify immutable revision"
  exit 1
fi
SHORT_SHA="${SHA:0:12}"

# No Cloud Run writes here: refuse if other traffic has appeared.
TRAFFIC="$(mktemp)"
trap 'rm -f "$TRAFFIC"' EXIT
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > "$TRAFFIC"
python3 - "$EXPECTED_ORIGINAL" "$TRAFFIC" <<'PY'
import json,sys
original,path=sys.argv[1:]
traffic=json.load(open(path))['status']['traffic']
p=sum(x.get('percent',0) for x in traffic if x.get('revisionName')==original)
other=sum(x.get('percent',0) for x in traffic if x.get('revisionName')!=original)
if p!=100 or other:
    raise SystemExit("REFUSED: original production traffic is not exactly 100%")
print("SAFE: original revision has 100% traffic")
PY

# Require identical source input and existing same-source baseline before build.
BASELINES=( "$HOME"/md256-kingfisher-*-NOT-APPROVED.zip )
if [[ ! -f "${BASELINES[0]}" ]]; then
  echo "REFUSED: MD-2.56 baseline ZIP missing from Cloud Shell home"
  exit 1
fi
INPUTS=( "$HOME"/file_*.png )
if [[ ! -f "${INPUTS[0]}" ]]; then
  echo "REFUSED: original uploaded file_*.png is missing"
  exit 1
fi
PYTHON="$HOME/md255-test-venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  echo "REFUSED: existing test environment $PYTHON missing"
  exit 1
fi
"$PYTHON" - <<'PY'
from pathlib import Path
from tempfile import TemporaryDirectory
import json,zipfile,sys
sys.path.insert(0,str(Path.cwd()/'tools'))
from staged_md255_kingfisher import image_input,prepare
p=sorted(Path.home().glob('md256-kingfisher-*-NOT-APPROVED.zip'),
         key=lambda x:x.stat().st_mtime,reverse=True)[0]
with zipfile.ZipFile(p) as z:
    if z.testzip():raise SystemExit("REFUSED: corrupted MD-2.56 baseline")
    report=json.loads(z.read("machine-report.json"))
    if report.get('machineEligible') is not False:
        raise SystemExit("REFUSED: baseline approval flag unexpected")
    if not report.get('requestId') or not report.get('decoded'):
        raise SystemExit("REFUSED: invalid source evidence")
    expected=report['requestId']
    print("BASELINE:",p.name,"requestId:",expected)
with TemporaryDirectory(prefix='md257-source-preflight-') as work:
    packet,meta=prepare(image_input(),Path(work))
if packet['requestId']!=expected:
    raise SystemExit('REFUSED: prepared source is not the exact same MD-2.56 request; no billable build')
print("SAFE: prepared artwork requestId matches the MD-2.56 baseline EXACTLY")
PY
IMAGE="$REGION-docker.pkg.dev/$PROJECT/stitch-forge-staging/stitch-forge-worker:md257-$SHORT_SHA"
echo "REVIEWED BRANCH: $BRANCH"
echo "IMMUTABLE COMMIT: $SHA"
echo "PROPOSED IMAGE: $IMAGE"
echo "PROPOSED TAG: $TAG (0% traffic, original stays 100%)"
if [[ "$MODE" == "--preflight" ]]; then
  echo "PREFLIGHT PASSED. No Cloud Build or Cloud Run deployment executed."
  echo "A later --execute will use billable Google Cloud resources."
  exit 0
fi
if [[ "${STITCH_FORGE_MD257_BILLING_APPROVED:-}" != "yes-for-one-staging-build" ]]; then
  echo "REFUSED: charges not authorised for MD-2.57; run --preflight first."
  exit 3
fi

# The upload and baseline are independently checked above, but successful
# native result still requires a source-identical A/B and independent audit.
echo "BUILDING ISOLATED MD-2.57 IMAGE — GOOGLE CLOUD CHARGES POSSIBLE"
gcloud builds submit --project="$PROJECT" \
  --config=services/digitiser/cloudbuild.staging.yaml \
  --substitutions="_IMAGE=$IMAGE" .
echo "DEPLOYING 0% TRAFFIC TAG; DO NOT SHIFT PRODUCTION"
gcloud run deploy "$SERVICE" --image="$IMAGE" --project="$PROJECT" \
  --region="$REGION" --no-traffic --tag="$TAG" --timeout=300 \
  --update-env-vars="STITCH_FORGE_BETA_COMPACT_RUNNING=0,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110"

# Abort before making requests if the tag/traffic are not isolated.
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > "$TRAFFIC"
python3 - "$EXPECTED_ORIGINAL" "$TRAFFIC" <<'PY'
import json,sys
original,path=sys.argv[1:]
traffic=json.load(open(path))['status']['traffic']
original_p=sum(x.get('percent',0) for x in traffic if x.get('revisionName')==original)
tagged=[x for x in traffic if x.get('tag')=='md257']
if original_p!=100 or len(tagged)!=1 or tagged[0].get('percent',0)!=0:
    raise SystemExit("CRITICAL: staging traffic protection failed; STOP")
print("SAFE: original 100%, md257 tag 0%")
PY

export STITCH_FORGE_BENCHMARK_SOURCE_ROOT="$ROOT"
export STITCH_FORGE_STAGED_TAG="$TAG"
"$PYTHON" "$ROOT/tools/staged_md255_kingfisher.py"
echo "MD-2.57 isolated Kingfisher test complete. No Netlify deployment."
