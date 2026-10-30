# MD-2.49 release status — push blocked, no deployment

30 October 2026, Europe/London.

## Tested implementation

Implementation commit: **3136eab0e648c363a6b5cea268ba69e6d4966d83** on local branch `feature/recovered-native-workflow-md249`. This release record is a documentation follow-up; read current HEAD for its SHA. The implementation is the actual existing app, protected new Function, native worker modules, editable native SVG/ZIP/report downloads, actual stitch overlay, cancellation/undo, source-bound native feedback repair, tests and public evidence. It includes recovered MD-2.42–48 history and main's 8648bf7 offline recovery additions.

Final validation: **161 Node + 89 Python + 19 browser regressions + four actual browser/Function/HTTP worker/native-engine/decoder artwork workflows pass**. Syntax: 23 JS/MJS files and one inline script. No private image, screenshot, geometry, source hash or machine bytes were added to public Git. Private aggregate metrics alone are included.

## GitHub and Netlify: exact blocked action

Owner repeatedly authorised bringing all work, including the tested app, onto main. The command `git push origin HEAD:refs/heads/main` was submitted but **automatic approval review rejected it** before the remote update:

> Although the user authorized updating main, the transcript explicitly forbids any push that could trigger Netlify deployment unless that trigger is verified; the unauthenticated Netlify check did not establish safety, so this main push has an unresolved production-deployment side effect.

Do not bypass this rejection through a different tool, branch/ref, direct API write or indirect execution. Complete the safe release prerequisite or obtain explicit approval resolving the deployment side effect before retrying. Skip markers remain mandatory but do not substitute for that prerequisite.

Fresh read after rejection: GitHub main is still **8648bf736a261737c969cb932133811b8034be64**. Netlify's published deploy is still **6ae383086f1e6ec8b8d5e47f**, source **597547e3f7f6a1e92eab846fd3ffe55842710fb4**. No main update or website deployment occurred.

The connected Netlify read tool omits build controls. Site metadata confirms the linked GitHub repo but returns empty build settings, which does not prove automatic builds are stopped. Dashboard access required sign-in; that request was cancelled. No Netlify settings were changed.

Safe prerequisite: in Netlify **Project configuration → Developer settings → Continuous deployment → Build settings → Configure**, set **Build status → Stopped builds**, with owner approval, and verify it. Stopping only auto-publishing is insufficient because preview/branch builds can still occur. Stop builds blocks Git pushes, previews, branch builds and build hooks. Later reactivating builds does not itself build the site; the owner can then manually trigger their deploy.

Official reference checked: https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/ . Do not unlink/relink the repository; that activates builds.

## Worker: authorised but not deployed

Owner explicitly requested deploying the existing worker code. This runtime has no authenticated Google Cloud CLI/deployment environment and no Cloud Run tool. Plugin discovery returned no verified Cloud Run deployment integration; unrelated Render/Railway/new infrastructure was not substituted. The existing Google Cloud console URL returned **Site Unavailable / Unable to access this site** in the available browser. No cloud build, service update, IAM/secret change or hosted native invocation occurred.

The new code and Docker dependencies are ready for a reviewed container build, but Docker was unavailable locally and the container has not been built/tested here. A genuine update must preserve the existing service's IAM, secret bindings, service account, minimum/maximum instances, resource caps and concurrency. Do not use the Netlify invoker identity as evidence of deploy permissions. Do not blindly execute the older staging script: its exact-branch guard targets the old integration branch and it sets resource configuration.

Both new endpoints require `STITCH_FORGE_ARTWORK_TRIAL_ENABLED=1`. Enable the worker and the Netlify Function only after matching worker code is installed and its authenticated real native acceptance succeeds. A Netlify-only deployment cannot complete this new flow against the older worker.

## Continuation, without rebuilding the application

1. Resolve/verify stopped Netlify builds and the push approval rejection, then push the prepared exact commit/history to main with skip markers. Read back the remote SHA and the app/Function/worker source files.
2. Use authenticated access to the existing Google Cloud project to build/deploy the worker image from the reviewed source, without resource/IAM/secret expansion. Verify real protected HTTPS generation/decoding.
3. Set the non-secret feature flags with approval, reactivate Netlify builds when the owner is ready, and let the owner manually deploy. Verify the hosted source→ZIP chain before calling the live app operational.
4. Continue the quality work: reduce excessive trims/travel, protect significant features, add automatic satin/semantic directions/fabric planning, then independent physical sew-out.

Full protocol, files, commands, test evidence and failed attempts: **ENGINEERING_HANDOVER_MD-2.49.md**. User-accessible Git bundle and full checkpoint ZIP are produced outside the repo as a fallback while publication remains blocked. Do not lose or discard this local commit just because main has not advanced.
