# MD-2.68 — Kingfisher quality gate: source texture / routing A/B

**3 November 2026 — experimental, NO DEPLOY, NO LIVE CODE CHANGE**

**Purpose:** Test whether source-driven fill-angle changes or existing route/compaction controls materially improve real, independently audited PES/DST embroidery from detailed artwork. Do not label a green format audit as professional-quality embroidery.

## Decision — no promotion based on this work

**All four fixture CI jobs passed real native safety checks. Neither strategy meaningfully improved the problem we are trying to solve.** The optional source-gradient angles changed three fill objects in macaw and three in butterfly, but did not lower trims or jumps. The existing routing+compaction options reduced no PES trims or jumps in any of the four controls. No source-verified fine detail was restored, and the butterfly still lost 39 subneedle objects. The recommendation is **DO NOT MERGE OR DEPLOY MD-2.68 experimental code** as a quality upgrade.

No Google Cloud Build, Cloud Run traffic modification, Netlify build/deploy, paid OpenAI request or public owner-art upload was made during this session. Main website/worker remain at their previous MD-2.67 state.

## Original live Kingfisher baseline from owner's private ZIP (verified)

Source: original **1312 × 1199 RGBA** Kingfisher on branch; the live browser's native worker packet contained only **326 × 298 source pixels** (original dimensions preserved as metadata, not high-resolution source bytes). Requested visible width approximately 80 mm, actual decoded stitch bounds **80.1 × 73.6 mm**.

| Machine/colour measurement | Result |
| --- | ---: |
| Hybrid thread colours | 9 |
| Browser-proposed working parts → hybrid parts | 1,056 → 178 |
| Independently represented working foreground | 47,415 of 47,415 pixels |
| PES and DST needle stitches (matching) | 22,465 |
| PES jumps / trims | 320 / 318 |
| DST jumps / trims | 372 / 10 |
| Peak needle positions in 1 mm square (point-count diagnostic) | 37 |
| Local unresolved source parts / pixels | 37 / 44 |
| Mean source-to-working RGB distance | 46.9787 |
| Source pixels above RGB distance 60 | 12,102 / 47,415 (~25.5%) |
| Out-of-colour native needle points / segments | 0 / 0 |
| Native engine | Ink/Stitch 3.3.0 |
| Physically sewn / machine approved | NO / NO |

**Limits:** PES/DST trim commands can be represented/interpreted differently; their raw counts must not be treated as an estimate of manual thread cutting. Density point counts are not a validated material/fabric failure threshold. Passing source-colour containment is necessary but does not establish feature likeness. The 44 omitted working pixels are small; the main visible photographic loss is from broad 9-colour segmentation and nonsemantic stitch planning, not simply the 37 omissions.

The private original and trial ZIP **were not committed or uploaded to public CI**.

## Actual source/test changes, isolated feature only

- `services/digitiser/source_stitch_orientation.py`: computes bounded, high-coherence *interior* source-luminance gradient tangents for each independently verified original working colour component; refuses flat, ambiguous, narrow or low-gradient areas. No extra colour, shape or stitch is created.
- `services/digitiser/home_live_bridge.py`: constructs source-backed optional candidate angles only if `STITCH_FORGE_OPTICAL_FILL_DIRECTION=1` on the private worker. Default production is unchanged.
- `services/digitiser/artwork_trial.py`: applies eligible direction angles only to existing native tatami paths and records the original geometric angle, source coherence and intended plan. Actual PES/DST and source masking are independently audited.
- `tests/test_source_stitch_orientation.py`: accepts coherent true diagonal stripes, rejects flat and too-small texture, and checks no source-mutation or malformed inputs.
- `tools/bench_md268_quality.py` and `.github/workflows/md268-real-native-ab-no-deploy.yml`: runs four native variants on identical licensed or synthetic input, with actual Ink/Stitch 3.3.0 PES/DST export, checksum-linked packet identity, decoded source mask safety and per-format metrics. Four parallel CI jobs; no private data and no deployment.
- CI result: **https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41601468488 — SUCCESS**, with JSON reports saved in four public-licensed report-only artifacts.

## Native A/B results: measured, not inferred

Every cell below was sourced from the named successful GitHub Actions job's decoded machine-report. The colour/source masks and total working parts were unchanged between baseline and variants. All exports reported zero out-of-colour stitch points and segments. `routing` means existing safe running reordering + bounded running compaction, not a novel automatic fill planner.

| Fixture | Variants | Baseline PES stitches | Optical PES stitches | PES trims baseline→routing→optical | PES jumps baseline→routing→optical | Optical fill components changed | Unresolved source details |
| --- | --- | ---: | ---: | --- | --- | ---: | ---: |
| Synthetic bird | base, optical, routing, combined | 7,680 | 7,680 | 83→83→83 | 85→85→85 | 0 | 0 |
| Macaw (CC0) | same four | 12,438 | 12,330 | 100→100→100 | 102→102→102 | 3 | 1 |
| Butterfly (CC0) | same four | 13,756 | 13,673 | 211→211→211 | 213→213→213 | 3 | 39 |
| Rose (CC0) | same four | 11,217 | 11,217 | 68→68→68 | 70→70→70 | 0 | 0 |

The combined variant matched the optical stitch count and the same trim/jump counts. Butterfly routing reduced native SVG path elements 139→135, but did **not** reduce genuine decoded trims/jumps. Treat reduced path count as a cosmetic source-structure statistic, not evidence of improved embroidery performance.

**Important:** This is four test fixtures × four real native variants (=16 native export workflows; each exported and audited both PES/DST). The original private Kingfisher was not re-exported using the experimental branches; Kingfisher claims concern its MD-2.67 *baseline only*. CI success proves geometric integrity, not better appearance/fabric performance.

## Other exploratory diagnostic — do not deploy

A local visual-only reclassification probe used rasterized existing Kingfisher native SVG and independently resized original image as an approximate reference (not the exact browser RGBA packet). It explored assigning stronger source-edge pixels to closer existing thread colours. A moderate threshold increased 1-pixel source-edge recall only from roughly **41.1% to 44.7%** while increasing connected colour parts roughly **102 to 237** in that *approximate rasterized proxy*. That trade-off would likely increase trim opportunities and produce thin physically unstable fragments. The reprobe did **not** generate native PES/DST, so it was **rejected** as a quality upgrade and not committed as production logic. These proxy values must not be quoted as native source-object counts or proof of better stitch-out.

## Unsolved engineering barriers

1. **Image fidelity**: Full-resolution 1312 × 1199 source art is reduced by the existing browser to 326 × 298 before the native worker sees it; no extra server-only algorithm can reconstruct eye/feather detail removed by that transfer with reliable source identity. Changing this needs browser protocol + worker evidence and may incur a new Netlify build, so not done speculatively.
2. **Working palette and stitch families**: Nine broad colours, ordinary tatami fills and running skeletons do not preserve photorealistic feather iridescence, eye highlight or leaf veins. Changing angle alone does not recover missing geometry. Current engine has satin columns for *explicit validated rails*, not reliable fully automatic feather/eye satin extraction for photos.
3. **Route complexity**: Many disconnected colour/fill regions create trims and travel. Reordering or grouping only running details did not lower decoded trim/jump counts in controlled tests. Source-safe fill-object merging is nontrivial: sewn travel across different colour masks is prohibited by independent containment.
4. **Fabric performance**: No documented home-machine sew-out. Stitch density, underlay, push/pull compensation, thread library matching, fabric behaviour and machine compatibility cannot be approved from PDFs, SVGs or files alone.
5. **Economic viability**: These are genuinely complex embroidery digitising problems. Another paid Cloud Build without evidence of visual gain risks the user's time and money. No verified willingness to pay or cost of manual repair.

## Final business/engineering recommendation at this gate

**Do not spend money deploying the MD-2.68 candidate.** The honest current scope is an experimental source-faithful **limited-colour illustration digitiser**, not a general-purpose automatic high-detail professional embroidery converter. An unrestricted detailed-art product claim would mislead customers.

Choose a small measurable decision test before committing more code or costs: (a) an experienced embroidery operator physically stitch-out an existing simple control and this Kingfisher at intended fabric and size, with feedback/photos, or (b) test a **restricted input class** (bold flat artwork, high contrast, few colours) with 5–10 embroiderers; use real success/repair rates. If the user's goal specifically remains high-detail photorealistic conversion with no manual corrections, the current hybrid does not meet the evidence threshold; pause that scope rather than promise an unverified breakthrough.

**Deployment state:** Live Netlify MD-2.67 website and Cloud Run worker unchanged in this experiment. All opt-in MD-2.68 sources retained on `feature/md268-kingfisher-quality-gates-no-deploy`, not main. No extra cloud bill was initiated.
