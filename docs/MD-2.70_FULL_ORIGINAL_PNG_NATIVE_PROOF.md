# MD-2.70 — Full-original PNG transport and source-identity native acceptance

**3 November 2026 — isolated R&D, NOT deployed, NOT machine-approved.**
**Owner objective:** customer supplies PNG, receives genuinely source-faithful, high-quality PES/DST automatically. This checkpoint only solves a prerequisite, not the customer-quality standard.

## Verified engineering breakthrough

The currently live MD-2.67 app sends only 326 × 298 source pixels for the original 1312 × 1199 Kingfisher. The worker has source dimensions as metadata but not the high-resolution RGBA. This irreversibly prevents native source analysis of the full details.

MD-2.70 creates a **versioned original PNG packet V2** alongside unchanged V1 behavior:
- Browser `site/auto-reconstruct-ui.js` retains original uploaded PNG bytes (or losslessly encodes a full-resolution PNG from original non-PNG upload), without substituting its 320px analysis canvas.
- `site/artwork-pipeline.js` adds an exact `originalPng` SHA256/bytes record to the signed header; this is bound to the existing requestId via `SHA256(header + reduced RGBA + labels)`. Raw original bytes are carried inside `originalPngBase64` through the existing authenticated Netlify background job to the private Cloud Run worker.
- `netlify/functions/lib/artwork-jobs.mjs`, `netlify/functions/artwork-embroidery.mjs` and `services/digitiser/artwork_packet.py` accept that extra field **only for V2** and retain old V1 acceptance.
- `services/digitiser/original_png_contract.py` independently recomputes the original PNG SHA, confirms exact pixel dimensions/format, and rejects a substituted/edited original that no longer corresponds to the reduced source. Source foreground intersection-over-union must be at least 0.94, with bounded resampling colour differences. Validated source is not printed to public artifact logs.
- Input original PNG max 2,450,000 bytes / 12 megapixels; total private job JSON 4,000,000 bytes; oversize sources are refused clearly rather than silently resized. **These are limits of the existing job system, not a final commercial capability.**
- The existing Netlify job input is removed on completed/failed worker processing. MD-2.70 also removes the input blob if **background dispatch fails**, where previously an unstarted request could remain in storage. Retention for interrupted jobs still needs operational verification before customer use.

### Private Kingfisher packet budget

Original image 1312 × 1199 RGBA, file size **2,272,253 bytes**. Base64 original ~3,029,672 characters; estimated complete V2 JSON envelope at the existing 326 × 298 working size **about 3.27MB**, under 4MB. This is an offline approximation, **not a completed live browser upload**, and no private image was uploaded to public GitHub CI.

### Actual native tests

[MD-2.70 SHA-bound V2 and genuine Ink/Stitch PES/DST](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41610518508): **PASS** on licensed CC0 macaw and rose, plus V1/V2 Node/Python compatibility, tampered image, changed image and source-dimension tests. Both PES and DST were decoded and passed original working-mask source-colour containment and receipt checking.

The successful test proves **full-original source bytes survive both native phases** without changing the verified browser request identity. It does **not** establish improved embroidery appearance, high-quality stitch planning or any physical sew-out.

## Direct high-resolution native alternative — rejected

[MD-2.70 source-identical genuine native A/B](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41611188422) **PASS** native source safety; higher-resolution segmentation in `home_live_bridge.py` is **off by default** and should NOT be deployed.

| Metric | Macaw baseline → source640 | Rose baseline → source640 |
| --- | --- | --- |
| Mean RGB error | 41.56 → 40.13 | 13.15 → 11.81 |
| Working colour components | 52 → 111 | 38 → 49 |
| PES trims | 100 → 121 | 68 → 82 |
| Unresolved source objects | 1 → 35 | 0 → 6 |

**Decision:** Reject simple high-resolution SLIC scaling. It mildly improves colour matching but fragments stitch objects and worsens routing. Do not merge/deploy this alternative. A model that simply creates more colour fragments is not the missing embroidery planner.

## Conservatively bounded colour-only calibration

A separate, optional `source_palette_refit.py` uses original RGB only to recalibrate **existing** nine thread-colour proposals while holding every shape label constant. It rejects large or duplicate thread shifts and only applies a source error improvement over 0.75 RGB units. It is not a replacement for semantic feather/eye geometry.

A private **rasterised existing-SVG proxy** for the original Kingfisher suggests ~3.7% mean RGB error improvement from the original PNG; this is an analytic colour comparison, **not machine-rendered output or a real sew-out**. Actual PES/DST tests and exact source/object/trim counts must gate this change.

## 3 November 2026 — Final actual native palette-only A/B

**[MD-2.70 three-way original PNG real PES/DST CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41612336667): PASS.** This run covers baseline native, high-resolution segmentation and source-RGB-only colour refit on the same SHA-bound public artwork; no synthetic success replaces actual PES/DST auditing.

| Tested art | Mean RGB error baseline → refit | Native parts baseline → refit | PES trims | Unresolved details | Decision |
| --- | --- | --- | --- | --- | --- |
| Macaw | 41.561 → 38.309 (7.8% lower) | 52 → 52 | 100 → 100 | 1 → 1 | The source-only palette change was selected by conservative error guards; native geometry is not fragmented |
| Rose | 13.153 → 13.153 | 38 → 38 | 68 → 68 | 0 → 0 | The candidate was rejected by guard; original plan retained |

For macaw the PES stitch count changed **12,438 → 12,458**, but the source working regions, 51 native paths, trims and jumps remained unchanged. These are independently decoded **real** Ink/Stitch results. The modification is colour-only and **does not claim a fix for lost eyes, feather texture or physically sewn quality**.

A separate **private** rasterised-svg Kingfisher proxy estimated RGB error **49.967 → 48.116 (3.7% lower)** from original PNG pixels when using the same existing colour region masks. That was **not** a real native PES/DST A/B for the Kingfisher and no private PNG was uploaded to GitHub.

**Keep:** `services/digitiser/source_palette_refit.py` and its tests as a guarded, opt-in candidate for future controlled comparison.

**Reject:** deploying indiscriminate high-resolution segmentation: it adds excessive colour components, trims and omissions despite colour accuracy gains.

**Mandatory next development:** full-res segmentation of semantically coherent artwork layers and dynamic physically feasible stitch-family planning. Colour-only correction is not an alternative to the missing embroidery-object model. A fully automatic finished product remains **unverified**.

## What remains unsolved

1. Full-original bytes must feed a **semantic/source-layer object planner** (eye, beak, feather groups, overlapping leaf veins), not just a colour-partitioner. Source-bound regions and physically viable satin/running/tatami/contour decisions remain unproven for detailed photo-like work.
2. A safe, independently audited **intentional overlay** path is needed for critical details without arbitrary widening of the original colour-containment tolerance.
3. Native decoded-stitch likeness scoring and physical sew-outs across diverse designs need an explicit acceptance gate. Zero out-of-colour stitches alone does not prove attractive embroidery.
4. The v2 flow needs end-to-end Android browser/Netlify/Cloud Run integration testing and full privacy-retention review before any live release.
5. The private Kingfisher must receive an original-source exact native A/B, using a trusted private engine, with an observable, **substantial** improvement before more Cloud Builds.

**No** modifications were made to GitHub `main`, current Netlify production, existing Google Cloud worker traffic, paid APIs or user-private source assets. All work is confined to `feature/md270-original-png-packet-no-deploy`. GitHub Actions does consume runner minutes, but no new Cloud Build or Work credits were used.

**Release rule:** KEEP SOURCE TRANSPORT RESEARCH ISOLATED. Do not represent MD-2.70 as a finished fully automatic high-quality embroidery converter. No additional live deployment based on source-transfer success alone.
