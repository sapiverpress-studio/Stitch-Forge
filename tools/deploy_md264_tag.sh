#!/usr/bin/env bash
# MD-2.64: guarded single-build Cloud Run release candidate, never a live switch.
# Must be run from an authenticated owner's Google Cloud Shell. Source image stays private.
set -euo pipefail
MODE="${1:---preflight}"
if [[ "$MODE" != "--preflight" && "$MODE" != "--execute" ]]; then
  echo "Use: bash tools/deploy_md264_tag.sh [--preflight|--execute]" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT=gen-lang-client-0857863712
REGION=europe-west2
SERVICE=stitch-forge-worker-staging
REGISTRY=stitch-forge-staging
TAG=md264
PROTECTED=stitch-forge-worker-staging-00001-pst
PRIOR=stitch-forge-worker-staging-00009-biz
VENV="$HOME/md255-test-venv/bin/python"
for cmd in git gcloud node python3; do
  command -v "$cmd" >/dev/null || { echo "REFUSED: Missing $cmd" >&2; exit 3; }
done
if [[ "$(git branch --show-current)" != "main" || -n "$(git status --porcelain)" ]]; then
  echo "REFUSED: Use a CLEAN main checkout. No local edits are changed by this helper." >&2; exit 3
fi
SHA="$(git rev-parse HEAD)"
UPSTREAM="$(git rev-parse refs/remotes/origin/main 2>/dev/null || true)"
if [[ "$SHA" != "$UPSTREAM" || ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "REFUSED: Local HEAD is not the fetched GitHub origin/main" >&2; exit 3
fi
git merge-base --is-ancestor 0250f64f9bf10cbf94737e66489ee5c4aae9685a "$SHA" || {
  echo "REFUSED: Tested MD-2.64 code is not an ancestor" >&2; exit 3;
}
[[ -x "$VENV" ]] || { echo "REFUSED: Missing existing staged benchmark Python environment" >&2; exit 3; }
TEMPDIR="$(mktemp -d)"
trap 'rm -rf "$TEMPDIR"' EXIT
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > "$TEMPDIR/traffic-before.json"
"$VENV" - "$ROOT" "$TEMPDIR/traffic-before.json" "$PROTECTED" "$PRIOR" <<'PY'
import json,sys,zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
root,traffic_path,original,prior=sys.argv[1:]
sys.path.insert(0,str(Path(root)/'tools'))
from staged_md255_kingfisher import image_input,prepare
traffic=json.loads(Path(traffic_path).read_text())['status']['traffic']
original_percent=sum(x.get('percent',0) for x in traffic if x.get('revisionName')==original)
md261=[x for x in traffic if x.get('tag')=='md261']
prior_percent=sum(x.get('percent',0) for x in traffic if x.get('revisionName')==prior)
other=sum(x.get('percent',0) for x in traffic if x.get('revisionName') not in (original,prior))
if original_percent!=95 or prior_percent!=5 or other!=0 or len(md261)!=1 or md261[0].get('revisionName')!=prior:
    raise SystemExit('REFUSED: Current live 95/5 revision split changed; inspect traffic manually.')
if any(x.get('tag')=='md264' for x in traffic):
    raise SystemExit('REFUSED: md264 tag already exists. Do not start a second build.')
zipfiles=sorted(Path.home().glob('md261-kingfisher-*-NOT-APPROVED.zip'),
    key=lambda x:x.stat().st_mtime,reverse=True)
if not zipfiles:
    raise SystemExit('REFUSED: MD-2.61 source-identical baseline not found in Cloud Shell home.')
with zipfile.ZipFile(zipfiles[0]) as z:
    if z.testzip() is not None:raise SystemExit('REFUSED: invalid previous benchmark archive')
    original_report=json.loads(z.read('machine-report.json'))
with TemporaryDirectory(prefix='md264-source-check-') as directory:
    packet,meta=prepare(image_input(),Path(directory))
if original_report.get('requestId')!=packet['requestId']:
    raise SystemExit('REFUSED: Original Kingfisher source/request does not match MD-2.61.')
print('PASS: 95% original / 5% md261, no existing md264 tag')
print('PASS: exact original Kingfisher baseline request:',packet['requestId'])
print('PASS: baseline PES trims:',next(x for x in original_report['decoded'] if x['format']=='pes')['trims'])
PY
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REGISTRY/stitch-forge-worker:md264-${SHA:0:12}"
printf 'Reviewed commit: %s\nCandidate image: %s\n' "$SHA" "$IMAGE"
if [[ "$MODE" == "--preflight" ]]; then
  echo "PREFLIGHT ONLY. No billable build or deployment performed."
  echo "One Cloud Build, container storage and native test requests can incur charges."
  exit 0
fi
if [[ "${STITCH_FORGE_MD264_BILLING_APPROVED:-}" != "yes-for-one-staging-build" ]]; then
  echo "REFUSED: One-build billing consent flag required" >&2;exit 3
fi
echo "BUILDING ONE EXACT MAIN COMMIT IMAGE"
gcloud builds submit --project="$PROJECT" \
  --config=services/digitiser/cloudbuild.staging.yaml \
  --substitutions="_IMAGE=$IMAGE" .
echo "DEPLOYING NEW TAGGED REVISION AT 0% LIVE TRAFFIC"
gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --image="$IMAGE" --no-traffic --tag="$TAG" --timeout=300 \
  --update-env-vars="STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1,STITCH_FORGE_AUTO_SOURCE_REPAIR=1,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110,STITCH_FORGE_BETA_COMPACT_RUNNING=0,STITCH_FORGE_DETAIL_SAFE_ROUTING=0"
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' > "$TEMPDIR/traffic-after.json"
"$VENV" - "$TEMPDIR/traffic-after.json" "$PROTECTED" "$PRIOR" <<'PY'
import json,sys
from pathlib import Path
entries=json.loads(Path(sys.argv[1]).read_text())['status']['traffic']
protected,previous=sys.argv[2:]
old=sum(x.get('percent',0) for x in entries if x.get('revisionName')==protected)
prior=sum(x.get('percent',0) for x in entries if x.get('revisionName')==previous)
candidates=[x for x in entries if x.get('tag')=='md264']
other=sum(x.get('percent',0) for x in entries if x.get('revisionName') not in (protected,previous))
if old!=95 or prior!=5 or other or len(candidates)!=1 or candidates[0].get('percent',0)!=0:
    raise SystemExit('HOLD: Live traffic changed or isolated md264 revision invalid; do not promote.')
Path.home().joinpath('.stitch-forge-md264-staged-revision').write_text(candidates[0]['revisionName']+'\n')
print('PASS: 95% original / 5% md261 / 0% md264; new revision:',candidates[0]['revisionName'])
PY
echo "RUNNING SOURCE-IDENTICAL, REAL TWO-PHASE KINGFISHER PES/DST TEST"
export STITCH_FORGE_BENCHMARK_SOURCE_ROOT="$ROOT"
export STITCH_FORGE_STAGED_TAG="$TAG"
"$VENV" "$ROOT/tools/staged_md255_kingfisher.py"
"$VENV" - <<'PY'
import json,sys,zipfile
from pathlib import Path
home=Path.home()
revision=(home/'.stitch-forge-md264-staged-revision').read_text().strip()
new=sorted(home.glob('md264-kingfisher-*-NOT-APPROVED.zip'),
    key=lambda p:p.stat().st_mtime,reverse=True)
old=sorted(home.glob('md261-kingfisher-*-NOT-APPROVED.zip'),
    key=lambda p:p.stat().st_mtime,reverse=True)
if not new or not old:raise SystemExit('HOLD: Missing source-identical native result')
with zipfile.ZipFile(new[0]) as z,zipfile.ZipFile(old[0]) as prior:
    if z.testzip() or prior.testzip():raise SystemExit('HOLD: Corrupt evidence')
    a=json.loads(prior.read('machine-report.json'))
    b=json.loads(z.read('machine-report.json'))
if b.get('workerRevision')!=revision:
    raise SystemExit('HOLD: Worker revision in generated report does not match md264!')
if b.get('requestId')!=a.get('requestId'):
    raise SystemExit('HOLD: Source changed between releases')
if b.get('machineEligible') is not False or b.get('physicalQualityVerified') is not False:
    raise SystemExit('HOLD: Machine approval was incorrectly claimed')
if b.get('detailedArtworkBenchmarkVerified') is not False:
    raise SystemExit('HOLD: Complex artwork benchmark improperly approved')
audit=b.get('stitchPlanning',{}).get('nativeFillUnderlayAudit',{})
if not isinstance(audit.get('nativeTatamiPathsWithUnderlay'),int):
    raise SystemExit('HOLD: Missing physical underlay diagnostic')
if b.get('unresolvedObjects',99999)>a.get('unresolvedObjects',-1):
    raise SystemExit('HOLD: More unresolved source details')
for fmt in ('pes','dst'):
    prior_data=next(x for x in a['decoded'] if x['format']==fmt)
    new_data=next(x for x in b['decoded'] if x['format']==fmt)
    for field in ('needlePointsOutsideWorkingColour','needleSegmentsOutsideWorkingColour'):
        if new_data[field]:raise SystemExit('HOLD: Needle paths escaped source colours')
    if new_data['trims']>prior_data['trims']:
        raise SystemExit('HOLD: '+fmt+' trim regression')
    if new_data['maxNeedlesInOneMmSquare']>prior_data['maxNeedlesInOneMmSquare']:
        raise SystemExit('HOLD: Local stitch-density regression')
    print(fmt.upper(),'stitched:',new_data['needleStitches'],'trims:',new_data['trims'],'jumps:',new_data['jumps'])
print('PASS: MD-2.64 isolated native test. RETAIN 0% until separate release decision.')
print('NOT A SEWOUT OR PRODUCT APPROVAL. Reviewed revision:',revision)
PY
echo "COMPLETE: one Cloud Build and source-matched test. LIVE TRAFFIC LEFT UNCHANGED."
