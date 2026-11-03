#!/usr/bin/env bash
# ONE Cloud Build + ONE Cloud Run revision; promotion is a traffic change only.
# MD-2.67 source-backed Home hybrid for the existing Netlify website.
# Run only in the owner's Google Cloud Shell after GitHub CI acceptance passes.
set -euo pipefail

PROJECT="gen-lang-client-0857863712"
REGION="europe-west2"
SERVICE="stitch-forge-worker-staging"
REGISTRY="stitch-forge-staging"
TESTED_SHA="98979de7384fa2ebdd25f0ccb9610a94fd43f3c1"

for tool in git gcloud python3; do
  command -v "$tool" >/dev/null || { echo "STOP: missing $tool"; exit 2; }
done
[[ "$(git branch --show-current)" == "main" ]] || { echo "STOP: must use GitHub main"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo "STOP: local changes present"; exit 2; }
SHA="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse refs/remotes/origin/main 2>/dev/null || true)"
[[ "$SHA" == "$REMOTE" ]] || { echo "STOP: local main not equal to fetched origin/main"; exit 2; }
[[ -n "${STITCH_FORGE_RELEASE_SHA:-}" && "$SHA" == "$STITCH_FORGE_RELEASE_SHA" ]] || {
  echo "STOP: exact release commit SHA was not supplied or does not match"; exit 2;
}
git merge-base --is-ancestor "$TESTED_SHA" "$SHA" || {
  echo "STOP: tested native integration is missing from this source"; exit 2;
}
echo "SOURCE COMMIT: $SHA"
echo "Only one Google Cloud Build is planned. No Netlify deploy."

BEFORE="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='json(status.traffic)')"
OLD_REVISION="$(printf '%s' "$BEFORE" | python3 -c '
import json,sys
t=json.load(sys.stdin)["status"]["traffic"]
active=[x for x in t if x.get("percent",0)>0]
if len(active)!=1 or active[0].get("percent")!=100 or not active[0].get("revisionName"):
    raise SystemExit("STOP: Unexpected production traffic distribution; do not change it")
print(active[0]["revisionName"])
')"
echo "CURRENT LIVE REVISION: $OLD_REVISION"

TAG="home-md267-${SHA:0:7}"
if printf '%s' "$BEFORE" | python3 -c '
import json,sys
tag=sys.argv[1]
sys.exit(0 if any(x.get("tag")==tag for x in json.load(sys.stdin)["status"]["traffic"]) else 1)
' "$TAG"; then
  echo "STOP: target deployment tag already exists. Inspect it; do not build a duplicate."
  exit 2
fi

BACKUP="$HOME/stitch-forge-md267-rollback-revision.txt"
printf '%s\n' "$OLD_REVISION" > "$BACKUP"
chmod 600 "$BACKUP"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REGISTRY/stitch-forge-worker:md267-${SHA:0:12}"
echo "NEW CONTAINER IMAGE: $IMAGE"

# If the exact image tag is already present after an interrupted run, resume
# without paying for an unnecessary second container build.
if gcloud artifacts docker images describe "$IMAGE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Existing exact-SHA image found; skipping duplicate Cloud Build."
else
  echo "Starting one Cloud Build."
  gcloud builds submit --project="$PROJECT" \
    --config=services/digitiser/cloudbuild.staging.yaml \
    --substitutions="_IMAGE=$IMAGE" .
fi

echo "Deploying one new revision at 0% before switching existing traffic."
gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --image="$IMAGE" --no-traffic --tag="$TAG" --timeout=300 \
  --update-env-vars="STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1,STITCH_FORGE_HOME_HYBRID_ENABLED=1,STITCH_FORGE_AUTO_SOURCE_REPAIR=1,STITCH_FORGE_ARTWORK_EXPORT_TIMEOUT_SECONDS=110"

NEW_REVISION="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.latestReadyRevisionName)')"
[[ "$NEW_REVISION" == stitch-forge-worker-staging-* ]] || {
  echo "STOP: Cannot verify new ready revision. Existing traffic was not promoted."; exit 3;
}
echo "New revision ready: $NEW_REVISION"

echo "Switching normal traffic to the ready Home hybrid worker; this is NOT a new build/deploy."
gcloud run services update-traffic "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --to-revisions="$NEW_REVISION=100"

AFTER="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='json(status.traffic)')"
printf '%s' "$AFTER" | python3 -c '
import json,sys
expected=sys.argv[1]
t=json.load(sys.stdin)["status"]["traffic"]
served=sum(x.get("percent",0) for x in t if x.get("revisionName")==expected)
other=sum(x.get("percent",0) for x in t if x.get("revisionName")!=expected)
if served!=100 or other:
    raise SystemExit("FAIL: production traffic has not reached the new revision fully")
print("PASS: 100% traffic on MD-2.67 Home hybrid worker",expected)
' "$NEW_REVISION"
echo
echo "ONE worker revision deployed; Netlify was NOT redeployed."
echo "Previous revision stored in: $BACKUP"
echo "IMMEDIATE ROLLBACK, IF THE WEBSITE ERRORS:"
echo "gcloud run services update-traffic $SERVICE --project=$PROJECT --region=$REGION --to-revisions=$OLD_REVISION=100"
echo "Machine files remain engineering trials, NOT physical stitch-out approved."
