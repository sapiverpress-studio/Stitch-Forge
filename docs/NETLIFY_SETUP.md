# Netlify deployment plan — Stitch Forge engineering preview

**Updated:** 2026-10-28 · **Status:** Prepared in GitHub development branch, **not deployed from these files**.

## Verified site facts

- Netlify project: [sapiver-stitchforge](https://app.netlify.com/projects/sapiver-stitchforge)
- Public address: https://sapiver-stitchforge.netlify.app
- Site ID: `cec158af-c6ae-4bec-ad1f-2f7c54f156fe`
- As inspected, Netlify reports a ready production deployment at 08:05 UTC on 2026-10-28, based on `main` at `fee944cc3c3002ffa854a5384f0f606b52b69242`, with deployment source **API**. That is not evidence the v0.3 editor is published.
- The user's screenshot shows **Stopped builds** in Netlify Build settings. There is no repository-hosted editor entry point in the `main` branch at this baseline.
- Read access via connected Netlify tools confirmed these facts. The available connector currently does **not** expose an action to change Netlify build status or set Git integration build settings.

## Prepared development branch

Branch: `develop/stitch-engine-foundation`, draft PR #1.

- `site/index.html`: browser-based v0.3 editor, a lightly adapted copy of the preserved prototype, with `noindex,nofollow` and an honest engineering disclaimer.
- `netlify.toml`: static build `publish = "site"`; **no build command** and no server-side functions.
- `tests/test_netlify_preview.py`: mobile playback, ZIP and static configuration regression.
- No Python digitiser service is deployed here. Any PES/DST exports are browser-generated **experimental outputs**.

## Netlify settings — required account UI action

1. Open [Project configuration](https://app.netlify.com/projects/sapiver-stitchforge/configuration) for this exact project.
2. Under Build settings, select **Active builds** instead of **Stopped builds** and press **Save**.
3. Leave Base directory, Package directory and Build command empty for this static project.
4. The project's `netlify.toml` sets Publish directory to `site` **once the branch containing that file is built**. Do not publish repo root or `prototypes`.
5. Under **Branches and deploy contexts**, confirm Deploy Previews for pull requests are enabled. A new PR synchronisation or deployment trigger may be necessary; activating builds alone does not guarantee an immediate deploy.
6. Look for a draft [PR #1](https://github.com/sapiverpress-studio/Stitch-Forge/pull/1) deploy-preview URL and open it on Android. Do **not** mistake `sapiver-stitchforge.netlify.app` (production, `main`) for the PR preview.

## Acceptance checklist before promoting to main

- [ ] Netlify build actually runs and finishes with status ready for the exact PR commit.
- [ ] Deploy log shows the publishing directory is `site`.
- [ ] Real preview URL displays Stitch Forge, not the Netlify placeholder.
- [ ] Android: image-based SVG and PNG import work and show trace-only warnings.
- [ ] The playback buttons stay with the canvas; restart/step/play and slower speed work.
- [ ] ZIP downloads and contains the documented files.
- [ ] No browser-console exceptions.
- [ ] Engineering preview disclaimer visible; no misleading professional-grade claim.
- [ ] Link the Netlify deploy ID and exact Git SHA in the master development document.
- [ ] Confirm no backend service or publicly exposed digitising endpoint exists.

A preview passing these gates would validate the **static browser editor only**, not professional embroidery-machine compatibility, Ink/Stitch integration or physical stitch-out quality. Promotion to the public main URL requires a separate review/decision.

## Rollback

Leave the existing production deploy unchanged during preview work. If an experimental preview fails, fix/revert the development PR; no production rollback needed. If main is later published, use Netlify's previous known-good deploy as rollback after verifying it exists.
