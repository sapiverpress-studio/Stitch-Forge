# Stitch Forge MD-2.52 — one-button AI review + native trial, device token memory

Date: 2026-10-30. Engineering interface integration; detailed embroidery quality **not approved**.

## Requested behaviour
After uploading a PNG/JPG/WebP, enter the existing Stitch Forge **owner access token** once. The primary `Generate embroidery` button now first runs one **advisory** OpenAI vision analysis through the existing authenticated Netlify `/api/analyse-embroidery` function, then uses the existing source-grounded native two-phase Ink/Stitch PES/DST workflow. No OpenAI provider key is entered or stored in the browser: it remains in the configured Netlify environment.

**Honesty limitation:** The AI feature map is displayed for review in the AI details panel. AI bounding boxes do **not** yet control native stitch regions, stitch type, direction, density, or thread selection. The native output therefore has not been made more faithful merely by adding the API call. The acceptance test remains recognisable **decoded stitches without underlying artwork** and a physical sewout.

## Device token handling
`site/private-token-storage.js` stores **only the owner access token** in origin-scoped `localStorage` on explicit generation while `Remember token on this device` is checked (default checked per user request). The secret is restored to the password field on the same browser profile. `Forget saved token` deletes it and clears both access-token fields. Unticking remember removes the stored value. Browser private-mode or blocked storage fails safely and does not block generation. Nothing is saved in GitHub, machine reports or downloads.

**Security tradeoff:** localStorage is **not encrypted** and is accessible to JavaScript executing on this origin and others with access to the browser profile. Use the Forget button on a shared device; clearing site data or changing browser profiles loses the saved key. HTTPS and strict CSP/source review should be maintained. This is the private owner access token, **not** an OpenAI API key.

## API behaviour and costs
The main native mode now enables AI review by default; each **new image** can incur one billable OpenAI request. For the **same source image in the current page session**, successfully completed analysis is reused on repeated generations; no second API call is required. An AI failure is plainly reported and does not invent an analysis or block independently validated source-based native generation. Users can switch AI off in Advanced settings to avoid API cost. The existing AI-only experimental proposal remains under Advanced and must not be mistaken for machine output.

## Changed source
- `site/index.html`: load token storage before the native UI and rename the upload navigation button.
- `site/private-token-storage.js`: local token storage, restoration and deletion.
- `site/auto-reconstruct-ui.js`: single Generate action, automatic advisory analysis before native generation, same-page cache, cost disclosure, Advanced options and token controls. Existing source constraints and native audit remain intact.
- `site/ai-details.js`: display advisory analysis from the combined workflow without a second API call.
- Regression fixtures updated so offline native tests explicitly disable optional paid AI calls; AI-only tests open the Advanced panel.
- `tests/test_one_button_access.cjs`: new persistent-token and UI guardrail regression tests.
- `tests/test_workflow_route_clarity.cjs`: existing route labels updated.

## Verified vs unverified
- Source JavaScript parsed successfully during change preparation.
- 5 new and 3 updated regression checks passed in a **V8 in-process harness** with synthetic localStorage/fixture input. Browser storage normal/blocked/forget behaviour was exercised in the same harness.
- No live OpenAI API request, no detailed native PES/DST generation, no real browser test, and no physical sewout performed in this integration.
- No worker or Cloud Run traffic modifications. Existing Netlify Functions and production credentials are untouched.
- The output remains an engineering trial; a paid analysis must not be described as improved stitch fidelity until source-vs-decoded comparison proves it.

## Next engineering step
Validate a single live one-button flow with a detailed kingfisher, independently decode PES/DST, quantify preserved outline and major colour areas, inspect named feature coverage with no source underlay, and sew a real sample. Improve semantic-to-stitch binding only after these baselines are collected.
