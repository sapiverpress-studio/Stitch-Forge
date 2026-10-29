# MD-2.34 — Reproducible visual proof (29 October 2026)

## Exact source provenance
- Branch: `feature/detailed-embroidery-analysis-no-deploy`
- Parent before milestone: `021e75ac99fe1eab631cbb05d4dab8487126e28c`
- Standalone, self-contained file: `Stitch_Forge_MD-2.34_Visual_Proof_OFFLINE.html`
- Exact HTML Git blob: `bb7e9582c795551815d6ac1e91d8ed734779e0f3`
- Inline satin validator is verbatim `site/satin-geometry.js`, Git blob `a869d6c1ab346d39b14f6610b9a6e00ce4a0f512`.
- Native test source: `tests/test_visual_proof.cjs`, Git blob `288b01846c9083e5d4b6347eb3f02bce0f345d97`.

## Tests actually performed
1. `node --test tests/test_visual_proof.cjs`, Node.js v22.16.0, five tests **PASS**:
   - Embedded validator is byte-identical to the tracked module.
   - Explicit original synthetic artwork / no AI segmentation claim.
   - Seven paired rungs and 68 zigzag guide points from actual satin validator, `machineApproved=false`.
   - Reversed rails fail.
   - No script/network source or machine-file output path.
2. Headless Chromium via Python Playwright `page.set_content`: desktop width 1450, mobile width 430.
   - Live browser globals reported 13 synthetic colour regions, accepted satin geometry, 68 guide points, machine approval false, machine outputs zero.
   - No JavaScript page errors, no 430px mobile horizontal overflow.
   - Preview spacing change 9px to 16px reduced SVG line count 2419→1363; satin toggle exercised.
   - PNG desktop/mobile screenshots generated locally for user inspection, not pushed to public repository.

## What this does NOT prove
The source image and closed colour contours were written together by a developer. **No AI recovered these contours** and no user artwork was transformed. Hatch marks are direction illustrations, not actual Ink/Stitch stitches. This demonstration does not run the native engine, decode PES/DST, certify stitch density, thread colours, fabric and pull compensation, or prove any physical sewing. Existing integration-branch native CI passes are from a **different commit**, not this feature branch. A successful visual demonstration cannot grant a machine-readiness badge.

## Restrictions
No Netlify deploy, PR edit, branch merge, hosted worker request, OpenAI inference or spend. Any claimed on-host or physical quality is unverified. Next zero-cost development gate: real native Ink/Stitch execution at the current feature branch SHA and independent stitched-command readback; then real licensed wildlife image evaluation and physical stitch-out.
