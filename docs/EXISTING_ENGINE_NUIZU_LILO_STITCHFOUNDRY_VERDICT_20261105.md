# Existing engine decision — 2026-11-05

**Status: REAL PES/DST TESTED, SOURCE-FIDELITY HOLD; no main merge or deployment.**

## What we actually tested

We stopped adding new custom stitch algorithms and tested existing automatic digitising engines against the **same private Kingfisher PNG** (1312 × 1199) at about 80 mm finished width. No private PNG, PES or DST was uploaded to GitHub. All private native files and the owner-facing preview/report ZIP were generated locally.

### Public independent baseline

StitchFoundry **v0.14.0-rc.1**, MIT OR Apache-2.0, original unchanged published Linux headless CLI. Its upstream tarball verified against GitHub's SHA256: `a8f08d4d2c7b8752f2f1a13a34d06f1416597dbef49718eaca938ed8214d6cab`.

[GitHub Actions 42059563606](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42059563606): PASS genuine PES/DST on source-hashed public CC0 macaw (**9,036 stitches**, 57.4 × 79.4 mm) and rose (**12,328 stitches**, 80.0 × 79.8 mm); independent pyembroidery decoded matching needle counts and format dimensions. This proves native export, **not source likeness or sewability**.

### Private Kingfisher native A/B

The same signed upstream binary ran locally; full-resolution image conversion and 420px conversion exceeded bounded execution time. At 180/240/320px source analysis its PNG-to-PES/DST processing was successful.

| Engine trial | PES stitches | PES jumps | PES trims | PES width × height (mm) | Source-art verdict |
| --- | ---: | ---: | ---: | --- | --- |
| Stitch Forge MD-2.67 prior | 22,465 | 320 | 318 | 80.1 × 73.6 | eye + feather detail missing |
| Nuizu 0.3.1 default (9 colours) | 51,718 | 16,960 | 8 | 82.6 × 156.2 (**PES wrong**) | detailed feather shading, unsafe PES scale + jumping |
| Nuizu 9 colours / 0.40mm | 29,217 | 6,036 | 8 | 79.3 × 99.4 (**PES wrong**) | re-encoding DST repairs dimensions, not excessive jumping/eye |
| Lilo 1.4.0 with experimental background-marker fix | 10,895 | 536 | 187 | 79.4 × 73.2 | flat bird, eye absent; upstream exact marker missed transparent background |
| StitchFoundry 9 colours 180px | 18,224 | 225 | 134 | 80.0 × 73.8 | coarse |
| StitchFoundry 9 colours 240px | 20,837 | 325 | 191 | 80.0 × 73.6 | bird visible, eye unresolved |
| **StitchFoundry 9 colours 320px** | **22,754** | **395** | **254** | **80.0 × 73.2** | best format/routing balance, but **eye remains blotchy; feathers too simplified** |
| StitchFoundry 12 colours 320px | 25,825 | 531 | 378 | 80.0 × 73.0 | visually cluttered and additional routing |
| StitchFoundry Photo Stitch colour | 4,010 | 24 | 9 | 57.6 × 58.2 | failed visually; important bird parts missing |

Both StitchFoundry 9-colour / 320px PES and DST contain **22,754** stitches with **exactly the same needle coordinates after one constant format-origin shift**. No distortions of their actual needle paths or physical scaling. Its 17 **colour blocks** are not 17 distinct colours: the decoded PES contains eight distinct thread RGB values repeated in separate blocks. Local 1 mm² needle count peaks at 42 and there are 30 counting cells >25; this does **not** imply physical fabric quality approval. The native 9-colour 320px test took ~19 seconds; a 12-colour 320px test ~26 seconds in this isolated local environment.

A separate upstream `embroidery.photoStitch` colour test produced a coarse rendering that lost face/branch details and was rejected. StitchFoundry full-resolution image processing did **not** meet the bounded runtime; a 320px working analysis is currently required for the available test environment.

## Decision

**StitchFoundry is the best current open-source *engineering candidate*, but is NOT an acceptable automatic professional Kingfisher digitiser yet.** Its eye and important feather features are still missing. A technically valid machine file is not a visually faithful file. None of Nuizu/Lilo/StitchFoundry has passed the owner acceptance gate.

Do not put any of these into the live Stitch Forge worker or claim a released digitiser. Preserve the unchanged MD-2.67 live baseline and all private artwork. The next *distinct, existing-engine* evaluation should be an established commercial automatic digitiser on the same artwork/size (e.g. Wilcom Embroidery Web API trial), with explicit owner approval if an account, costs or uploaded artwork would be required. Then seek a physical sew-out before paid customers.

**Private evidence retained in this conversation:** `STITCH_FORGE_UPSTREAM_ENGINE_VERDICT_2026-11-05.md` and `Kingfisher_StitchFoundry_UPSTREAM_ENGINEERING_NOT_MACHINE_APPROVED.zip`, containing generated native files and decoded stitch previews, not the source PNG. Both must be clearly marked **NOT MACHINE-APPROVED**.

**No main merge, Netlify/Cloud Run deployment, Work credits, new third-party API subscription or customer artwork publication.**
