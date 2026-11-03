# MD-2.69 — Full-original-source texture direction foundation

**3 November 2026 | Isolated branch | No main merge or deployment | NOT machine embroidery**

## Precise status

The MD-2.67 live worker's input PNG is first resized by the browser, so native reconstruction sees **326 × 298** pixel artwork for the King's original **1312 × 1199** image. The browser metadata includes original dimensions but not the original image's full-resolution pixels. The native segmentation uses nine colours and broad tatami fill shapes. Its authentic Kingfisher ZIP generated 22,465 decoded matching PES/DST stitches, 9 colours, 37 omitted tiny parts, 318 PES trim commands and no source-colour containment failures. It retained shape but did not preserve fine eye, beak and feather textures to the owner's required standard.

Previous MD-2.68 native trials showed that merely changing geometric fill direction or grouping running paths did **not** reduce PES trims/jumps or restore meaningful texture. Those changes are not promoted.

## Implemented and tested now

New isolated source module: `services/digitiser/full_source_flow.py`, with tests `tests/test_full_source_flow.py` and a no-deploy CI workflow.

- Operates on bounded **original PNG file bytes**, verifies the raw byte SHA256, source pixel dimensions, alpha foreground and physical dimensions; uses only existing Pillow/scipy/scikit-image/numpy dependencies, no new image model or paid service.
- Reduces to a **physically fixed analysis scale** (default 0.12 mm per analysis pixel) *after* original-source reading, instead of using the existing 320px source for all geometry analysis. Limits input bytes/pixels, physical dimensions and output guide count.
- Computes local gradient structure-tensor coherence and physically scaled texture tangent directions on a ~3 mm grid, rejecting flat/ambiguous or near-boundary areas. This gives potential local Ink/Stitch guided-fill directions but does **not** guess whether an area is a feather, leaf, wing or eye.
- Requires the same source bytes to produce exactly the same observations; no source masks, images or colours are modified; no external request or persistent upload is made.
- Declares explicitly `nativePESDSTGenerated:false`, `semanticObjectsIdentified:false`, `machineApproved:false` and `physicalSewoutVerified:false`.
- Unit tests independently check source hash/determinism, diagonal and vertical texture orientation, zero invented directions on uniform artwork, invalid input/size rejection, transparent image rejection. All have passed in GitHub CI.

**CI evidence:** [MD-2.69 offline original-source tests](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41606882449) — PASS. This is geometry evidence, **not native PES/DST acceptance**.

### Private Kingfisher pilot, not published to GitHub

- Actual original image **1312 × 1199 RGBA**, full source processed locally.
- At 80mm design width, analysis grid **667 × 609** at **0.12 mm per pixel**, 201 accepted local source-direction observations. The directions visually track local source texture in feathers, breast and some ivy/branch areas. A private visual diagnostic was created; it is not native stitches or a fabric simulation.
- A source-edge accent pilot selected 12 physically bounded paths totalling 25.36 mm. Visual impact was negligible. It was **rejected** as a release improvement.
- A source-contrast compact mark pilot detected a ring-like eye feature, but high-contrast highlight fragments were mostly about **0.2–0.35mm** long at the 80mm design size. Forcing these as separate decorative stitches would not reliably reproduce the original source, so this was **rejected** as a release improvement.
- The original PNG, prior Kingfisher ZIP, source-specific previews and private SHA evidence were kept **outside GitHub**.

## Necessary next engineering stage before a real PES/DST quality claim

1. Securely convey or otherwise make the **same original PNG bytes** available to the private worker with a versioned source-bound transport and size/privacy controls. The existing Netlify/worker request budget is **4 MB**, so the payload must be measured with real PNGs, not assumed safe. Validate source hash *and* that full resolution corresponds to the reduced source packet. This may need a carefully staged browser + Netlify + Cloud Run protocol change, never a surprise live rollout.
2. Build a **semantic source-object plan** (layer hierarchy, priority marks, feather/leaf/eye/beak structures) from real image evidence, with model proposals independently clipped and checked against original pixels. Local structure tensors alone do not identify anatomy.
3. Convert accepted objects into **actual Ink/Stitch guided fills, source-driven directional stitches, running accents and selectively verified satin** where physical widths allow. The current source-indexed single-colour mask audit must be extended carefully for intentional layered stitches; never simply disable containment checks.
4. On exact same original Kingfisher and controlled CC0 art at matching sizes, generate both genuine PES/DST and compare *decoded* feature likeness, image visual coherence, trims, travel and per-mm local density against MD-2.67. A visibly better source-to-machine result is required.
5. Only then consider physical home-machine sew-out and any owner-approved deployment. No new Cloud Build or Netlify deploy just to show a new status flag.

## Release rule

This work proves a useful component of the alternative architecture, **not the target product**. It is intentionally isolated on `feature/md269-fullsource-feature-gates-no-deploy`. No main code, Netlify, Cloud Run worker/traffic, commercial pricing or machine-safety claim was changed. If the source-aware guides cannot be connected to real stitch planning and yield a verified aesthetic improvement, stop rather than continue promising a finished digitiser.

**Owner objective unchanged:** A user supplies one PNG and gets back machine-ready, visually faithful embroidery automatically, with no customer-side or human correction. That full outcome is still **unproven**.

## 3 November 2026 — Real native contour-fill selection experiment

**Evidence:** [MD-2.69 real Ink/Stitch contour-versus-Tatami A/B CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41607482002). Real two-format native exports were attempted on four synthetic or licensed examples with identical source bytes, dimensions, colour plans and independently audited decoded stitch paths.

An opt-in, source-mask-preserving contour family selector was added only on this isolated feature branch (flag `STITCH_FORGE_CONTOUR_FILL_TRIAL=1`), alongside `tools/bench_md269_contour.py` and its no-deploy CI workflow. The selector targets broad elongated components and otherwise retains existing Tatami fills. **Production's default remains Tatami.**

| Real native fixture | Baseline PES stitches | Contour PES stitches | Baseline→contour PES trims | Native verdict |
| --- | ---: | ---: | --- | --- |
| Synthetic bird | 7,680 | 8,938 | 83→83 | PASS source containment, no routing benefit |
| Rose | 11,217 | 16,725 | 68→68 | PASS source containment, excessive additional stitches |
| Macaw | Baseline generated | No final approved contour output | Not comparable | FAIL independent decoded source containment |
| Butterfly | Baseline generated | No final approved contour output | Not comparable | FAIL independent decoded source containment |

**Decision:** REJECT experimental contour conversion as a generic upgrade. The failures were correctly stopped by the original strict audit, and the successful examples did not reduce trims. We did not and will not weaken the source-colour tolerance to manufacture a passing result. This test does **not** validate the user's private Kingfisher: no private source was uploaded to GitHub.

**Actual new working capability:** The full-source analysis module reads and fingerprints the untouched original PNG and derives bounded local orientation observations (201 on the private Kingfisher at 80mm) without inventing semantic features. This is one prerequisite for real source-guided digitisation, but it is **not** connected to the browser, native stitch generator or any live service. Accurate model-based source-object segmentation, source-authenticated full-resolution transfer, controlled layered stitch planning and real sew-out quality remain unimplemented.

**Release position:** Keep `main` and all live Netlify/Cloud Run revisions unchanged. No more costs or deployments based on this experiment. Do not claim the user has received a visually better Kingfisher PES/DST.
