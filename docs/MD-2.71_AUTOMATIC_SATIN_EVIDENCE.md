# MD-2.71 — Automatic physically validated satin object (real native A/B)

**3 November 2026 | Source: MD-2.70 isolated branch | NO DEPLOY | No physical sew-out | Do not merge into main as a professional-quality fix.**

## Objective and outcome

The owner wants one PNG in, one professionally faithful embroidery file out with no manual digitising. MD-2.70 carried SHA-bound original PNG to the private worker; it did not deliver semantic stitch objects. MD-2.71 tests whether we can automatically replace an existing native Tatami object with a source-derived **real Ink/Stitch satin column** under strict physical constraints, rather than simply relabelling a fill.

**Actual result:** a small but legitimate working stitch-family capability on a controlled straight source colour component. **It does not select curved feather/petal/leaf features on complex artworks**, so it is NOT a verified Kingfisher quality improvement.

## What was implemented

- `services/digitiser/auto_satin_object.py`: automatically detects one near-rectangular straight source colour component without any semantic/model guess; requires source rectangularity ≥92%, physical length ≥6 mm, source width ~2.15–3.95 mm, aspect ratio ≥3.8, and area ≥12 mm². Builds two inset physical rails + multiple rungs, validates every resulting satin strip against a **negatively buffered original pixel geometry**, and rechecks geometry using existing `satin_native.validate_column`. If any geometric/physical gate fails, it returns no satin candidate (existing method retained). It never creates colour pixels, contour expansions, bogus highlights or off-source proposals.
- `services/digitiser/artwork_trial.py`: opt-in `STITCH_FORGE_AUTO_SATIN_TRIAL=1` inserts a genuine Ink/Stitch satin-column SVG object (two rails and stitched rungs), **replacing** that source component's Tatami fill rather than adding density on top. The default flag remains off. Trial objects and source evidence are included in native source manifest and machine report with explicit no sew-out approval.
- `tests/test_auto_satin_object.py`: passes basic horizontal/vertical stripe acceptance, refuses narrow shapes, broad fills, crossing branches, malformed numeric data or colours.
- `tools/bench_md271_source_satin.py`: real, independent PES6/DST A/B on the exact same two-colour synthetic design (elongated bar + ellipse); checks the original source SHA, native source-colour needle points/segments, independent PES/DST decoding and **actual direction of decoded source-object needle movements**. It does not merely accept SVG labels or a green export.
- `tools/bench_md271_licensed_satin.py`: complete existing private-worker two-phase PES/DST flow for **licensed CC0 macaw and rose**, baseline vs satin mode; no private Kingfisher source on GitHub.

## Results verified in GitHub CI

[Controlled physically bounded true satin test](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41620357275) **PASS**.

| Actual decoded two-colour synthetic control | Tatami | Automatic satin |
| --- | ---: | ---: |
| Physical candidate selected | 0 | 1 |
| Stitches | 680 | 680 |
| PES trims | 3 | 2 |
| PES jumps | 5 | 4 |
| Physically cross-width needle movements in designated bar | 24.49% | 92.31% |
| Needle paths differ (actual decoded coordinates, not SVG metadata) | — | YES |
| Independently audited outside-colour needle points/segments | 0/0 | 0/0 |
| Machine stitched on fabric | NO | NO |

Changing the real decoded cross-width needle fraction from 24.5% to 92.3% establishes actual native satin-family construction under those *controlled* conditions. Equal total stitch counts are not evidence of identical trajectories; decoded cross-width moves were independently checked.

[Licensed macaw and rose native two-phase trial](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41620570692) **PASS native safety but no improvement**.

| Licensed real illustration | Baseline actual PES | Source satin trial | Accepted satin objects |
| --- | --- | --- | ---: |
| Macaw | 12,438 stitches / 100 trims / 102 jumps | **Identical** | 0 |
| Rose | 11,217 stitches / 68 trims / 70 jumps | **Identical** | 0 |

This is an explicit negative generalisation result: the conservative geometry selector found no naturally eligible straight rectangle in either complex artwork. A private local **approximate quantized Kingfisher raster proxy** (not the authenticated V2 worker packet) also had **zero axis-aligned** source components meeting the simple high-confidence straight-rectangle test. That proxy is not a licensed native test or proof that the full planner cannot find any curved eligible feature.

## Critical limitations and decision

1. **No Kingfisher improvement has been demonstrated.** This experiment changes a straight test bar; the owner's eye, feather texture, beak details, branch and leaf contours remain unresolved.
2. Strong geometry gates are intentional: weakening them merely to force more satin paths into a Kingfisher risks off-source stitches, distorted satin rails and high local density.
3. Native PES/DST consistency, source containment and sub-3.65mm decoded needle movement **are necessary, not quality guarantees**.
4. **Next real object class** requires automatic semantic / geometric source-layer partitioning for **curved and tapered features**, with physical-width evaluation along a local centerline, source-grounded rail/rung or guided-fill geometry, and independent per-object audit of meaningful feature visibility.
5. "Feature visibility" must be measured against *full source* and decoded real needle paths. The current reduction to nine broad colour masks erases important image detail; zero outside-colour stitches and colour-only error reduction must not be substituted as an aesthetic score.
6. Any artistically meaningful change must be tested against the owner's original Kingfisher in private (never placed in public CI), another licensed bird, rose and at least one non-animal illustration, then sewn on actual intended fabric by an independent machine user.

**Engineering decision: HOLD, NO DEPLOY.** Preserve this isolated automatic satin module as the first proven physically bounded stitch-family selector. Do not merge it as a solution to Target 2; do not spend another Cloud Build on straight satin selection alone. The only supported product claim remains source-bound **experimental home embroidery**, not arbitrary-PNG professional-quality digitising.

**Repository:** `feature/md271-physical-satin-object-trial-no-deploy` based on `feature/md270-original-png-packet-no-deploy`. GitHub `main` unchanged. No Netlify deploy, Google Cloud Run build, traffic switch, Work credits, paid AI requests or publication of the owner's Kingfisher source.

## Actual next decisive gate, not another cosmetic optimisation

Create a **source-bound layered object plan**: independently identify eye/beak/feather/petal/vein regions and their physically stitchable size; split major visual objects without exploding disconnected colour components; generate distinct guided-fill / satin / running detail where the source justifies it. Run real side-by-side Kingfisher native PES/DST and require **recognisable feature improvement** without worsening density, trips and unresolved detail. If this semantic object gate cannot be met with existing free/local tools plus the already available optional AI region proposal, stop promising professional-like automatic embroidery quality.

This is not a recommendation for a speculative MD-2.72 Cloud Build. No product deployment is justified until native feature visibility improves.
