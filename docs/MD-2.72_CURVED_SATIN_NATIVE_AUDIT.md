# MD-2.72 — Source-contained curved/tapered satin objects

**3 November 2026 · Engineering only · Tested on isolated branch `feature/md272-curved-tapered-source-satin-no-deploy` · NO DEPLOY**

## Why this exists

The owner wants a PNG-in, accurate embroidery-out system without manual intervention. The MD-2.71 straight rectangle satin planner generated genuine, separately audited PES/DST but found **zero** naturally eligible features in complex macaw and rose illustrations. It did not improve the Kingfisher.

MD-2.72 tests an additional *geometric stitch family*: a gently curved or width-tapered, physically large, coherent original source colour object. This is **not semantic feather or eye recognition**.

## What was built

- `services/digitiser/auto_curved_satin_object.py`: reconstructs original RLE pixel colour geometry. Uses minimum rotated rectangle to choose main axis; intersects a conservatively inset source polygon with a series of cross-sections. A paired rail/rung satin path is accepted only when it is one continuous polygon with no holes/branches, within physical width/length/taper constraints, with controlled centerline variation, and when the *entire interpolated satin strip* remains inside a negatively buffered source-colour polygon. Uses unchanged `satin_native.validate_column` as a second geometry gate; malformed RLE fails closed.
- `services/digitiser/artwork_trial.py`: uses `STITCH_FORGE_CURVED_SATIN_TRIAL=1` only if explicitly enabled on a native trial. On an accepted **whole source colour component**, it replaces the Tatami object with a real Ink/Stitch satin-column path, rather than laying an extra satin pass over the original fill. Unmatched art still uses the unchanged Tatami/running plan. Default is OFF.
- `tests/test_auto_curved_satin_object.py`: positive gentle bend, taper and combined bend/taper; negative too narrow, too broad, crossed/disconnected components, noncanonical runs and invalid inputs. Source input unchanged.
- `tools/bench_md272_curved_satin.py`: same source pixel SHA and physical size A/B with actual Ink/Stitch 3.3.0 PES6/DST, independent decoded source-colour containment, and attributed needle-direction measurements.
- `tools/bench_md272_licensed_curved.py`: four complete browser-packet-to-private-worker native stages (baseline/trial on CC0 macaw and rose) with original PNG binding and independent format validation.
- `.github/workflows/md272-curved-satin-no-deploy.yml`: real native CI, no owner/private artwork in the repository and no live deployment hooks.

## Measured native results

**[MD-2.72 controlled + licensed real PES/DST CI — SUCCESS](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41647813632)**

| Controlled gently bent/tapered source strip + ellipse | Existing Tatami | MD-2.72 satin trial |
| --- | ---: | ---: |
| Accepted curved satin source objects | 0 | 1 |
| Genuine decoded PES needles | 842 | 647 |
| PES trims | 3 | 2 |
| PES jumps | 5 | 4 |
| Cross-width movements near source strip | 17.58% | 97.01% |
| Source pixels/colours and source identity | Same | Same |
| Outside-working-colour needle points / segments | 0 / 0 | 0 / 0 |
| Physical sew-out / source likeness approval | NO | NO |

Real cross-width needle movements establish that the native stitch geometry **actually changed**, not merely that an SVG contained a satin attribute. **A lower stitch count cannot be interpreted as a quality improvement:** the new satin strip is intentionally inset and could leave source edges aesthetically underfilled. The current decoded colour-source containment audit checks that stitches stay *within* source geometry, not that all visually important area is densely represented. Its controlled synthetic example does not establish sewn coverage on fabric.

**Licensed detailed artwork (real native two-phase A/B):**

| CC0 artwork | Baseline | Curved-satin trial | Accepted curved objects |
| --- | --- | --- | ---: |
| Macaw | 12,438 PES stitches; 100 trims | Identical | 0 |
| Rose | 11,217 PES stitches; 68 trims | Identical | 0 |

Both licensed cases passed independent PES/DST and source-colour containment. But they are also **negative results for customer value**: the new conservative selector did not find an eligible feature in either complex illustration, and there is still no superior Kingfisher output.

## Safety and release boundaries

- **Production untouched.** No Netlify or Cloud Run deployment, no paid cloud build, no Main merge for MD-2.72.
- Source-bound object only; no separate machine-unsafe small marks or fabricated eye/feather anatomy. No change to real ink-stitch format audits, source-colour mask tolerances, physical stitch-length caps or palette ownership.
- Entire source-based satin strip is physically narrower than the original shape. **Missing border coverage is a real possible failure**, despite 0 out-of-colour stitches. Before selecting this family on customer art, independent path-coverage and physical fabric sample need review.
- The selector is conservative by design: exact physical size and source geometry are hard gates. It will often return **no candidate** for dense photographic colour regions.
- No claim of higher visual fidelity, physical stitch-out, professional digitising, or arbitrary PNG acceptance.

## Engineering decision and next gate

**Keep MD-2.72 on isolated branch and do not deploy.** It demonstrates a second real automatic stitch family but still does not solve source-level feature recognition.

A meaningful next stage requires a **layered image-object plan** using the original full-resolution PNG: detect a recognisable feather/eye/beak/leaf part, retain its layer and source mask, choose an appropriate fill/direction/running/satin treatment, and validate source feature visibility *from the decoded native stitches* rather than from colour or path-count proxies. Evaluate the exact Kingfisher privately alongside a licensed detailed illustration at matched dimensions. If no visually material gain is demonstrated, do not spend more on production deployments.

**Reference source integration:** [MD-2.71 main source-only merge](MD-2.71_MAIN_SOURCE_INTEGRATION.md). Live MD-2.67 V1 upload and worker unchanged by this experiment.
