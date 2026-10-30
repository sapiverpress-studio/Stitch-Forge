# Stitch Forge MD-2.53 — Four-step main screen

Date: 2026-10-30. User requirement: **upload image → Generate → stitch video → ZIP**. Upload alone must not spend AI credits. Everything after Generate should be automatic.

## Implementation

- Added `site/simple-workflow.js` after the existing native UI scripts. It promotes a 4-step main screen and moves the existing manual editor, diagnostics, AI-only proposals and old exports under collapsed **Advanced / manual tools**. Existing code and routes remain available and unchanged.
- **Upload image** uses the existing import handler; primary file-picker filters PNG/JPG/WebP. It does **not** trigger native generation or an OpenAI request.
- **Generate embroidery** calls the existing native two-phase workflow exactly once, using the remembered owner token (asking for it once if absent). The MD-2.52 default AI feature analysis still runs automatically before native processing; same-image in-session analysis reuse and the paid-call disclosure remain unchanged. This AI report is *advisory only* and does not yet direct stitch geometry.
- On success, the existing `artwork-pipeline.js` verifies genuine native PES/DST and independent machine audit. Only then does `site/auto-reconstruct-ui.js` send `stitchforge:native-ready` with its validated decoded-PES preview/report. The new view draws an animated **stitch playback** on an independent white canvas from those actual decoded needle segments, without source artwork underneath. Playback is **not a rendered MP4 recording of a physical sew-out**.
- The original audited native ZIP auto-download is retained. A prominent **Download ZIP** button lets users retrieve the same verified result again. It remains disabled on errors and never points to the old single-colour browser exporter.
- Event hand-off: `stitchforge:workflow-status`, `stitchforge:native-ready`, `stitchforge:native-error`, and `stitchforge:native-idle`. Import failures emit `stitchforge:upload-error`. New or changed artwork cancels stale preview state.
- The single primary screen uses simple status lines. The advanced editor is preserved, not deleted.

## Local checks

- V8 parse checks: new four-step module, patched native UI and main inline script passed.
- Focused in-memory UI test harness: **6/6 passed** (step visibility; upload has no paid side-effect; single Generate triggers underlying native workflow; decoded segment animation; ZIP not enabled before native-ready; one-time token; error fail-closed). This is a mocked event/DOM check; **not a real mobile-browser acceptance test**.
- Existing MD-2.52 owner-token storage tests: unaffected. No backend worker, Cloud Run traffic, Netlify secret or machine-file generator changed.
- Live mobile-browser/production request and physical detailed-artwork sew-out **not tested in this session**. Do not claim that the detailed kingfisher PES/DST is physically approved or that the AI currently improves source geometry.
- The browser may suppress a delayed automatic download: the manual verified **Download ZIP** button provides the same file.

## Acceptance testing needed

Open the latest Netlify release in Chrome on the user's Android device. With the saved token already configured, confirm only Upload, Generate, Stitch video and Download ZIP appear on the main screen. Upload kingfisher (no API call yet); press Generate (one advisory AI call, then native source-bound PES/DST phases); confirm real decoded-PES animation and ZIP button. Download the ZIP, independently inspect machine-report.json, PES and DST; review outline and major colours without source underlay. A physical sewout remains required.

Rollback: revert the new front-end module and its script include plus the native event notifications. The existing MD-2.52 workflow and Cloud Run engine remain intact.
