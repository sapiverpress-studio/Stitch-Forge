# External automatic digitiser comparison — private Kingfisher, 5 Nov 2026

**Experimental benchmarking only. No production release. No customer/private PNG has been pushed to GitHub.**

## Method
- Original Kingfisher PNG 1312×1199, identical physical embroidery target approximately 80 mm maximum dimension.
- Compared original MD-2.67 Stitch Forge native export with **published Nuizu 0.3.1** (verified PyPI wheel SHA256) and **Lilo 1.4.0** (pinned git tag).
- Native PES/DST independently decoded with pyembroidery 1.5.1; previews are diagnostic stitch paths, *not* fabric simulation or machine approval.
- All original privately owned art, generated machine files and visual outputs were kept out of the public repository. A separate local ZIP was prepared for the owner.
- Lilo background fix applied to private local benchmark copy **only**; neither distributed as integrated proprietary source nor committed to this repository.

## Direct private-image machine results

| Engine and candidate | PES needle positions | PES jumps | PES trims | Decoded stitch footprint | Conclusion |
| --- | ---: | ---: | ---: | --- | --- |
| Existing MD-2.67 Stitch Forge baseline | 22,465 | 320 | 318 | 80.1×73.6 mm | Technically valid but eye and feather detail lost |
| Upstream Nuizu 9 colours (default) | 51,718 | 16,960 | 8 | **82.6×156.2 mm PES**, versus 79×72 mm DST | Direct PES wrong dimensions; excessive jumps |
| Nuizu 9 colours at 0.40 mm fill spacing | 29,217 direct PES / 29,218 DST | 6,036 direct PES / 6,022 DST | 8 direct PES / 18 DST | **79.3×99.4 mm direct PES**, 78.4×72 DST | Direct PES writer defective for this art; 6,022 DST jumps |
| Nuizu DST re-encoded to PES by independent pyembroidery | 29,218 | Excess remains | Not improved | 78.4×72 mm | Machine-file scale corrected, not actual route or eye quality |
| Lilo 9-colour, 420px, standard, **local-only transparency correction** | 10,895 | 536 | 187 | 79.4×73.2 mm | Genuine PES/DST; visually simplified; no professional likeness |

Lilo patch diagnosis: vtracer rendered key-out fill `#FD01FD` although Lilo checks for exact `#FF00FF`, resulting in a giant false purple background. A **local-only tolerance-based marker comparison** removed that background. The patched output has 14 decoded colour changes, 7 internal concentration warnings and a reported narrow satin object; its decoded PES/DST have matching stitch count and footprint. Detailed wing/eye/foliage fidelity is still unsatisfactory.

Nuizu's visual preview retains more textured colouring, but its eye is inaccurate, 29,218+ stitches have excessive jumps and the direct PES output has inconsistent physical dimensions. Neither existing source release is an acceptable production replacement.

## Public licensed A/B controls

- [Upstream Lilo official v1.4.0 engine on CC0 macaw+rose: PASSED genuine PES/DST](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42005611277). Macaw 9,584 needles; Rose 6,912. Decoded PES/DST dimensions agree; no physical sew-out.
- [Upstream Nuizu official 0.3.1 evaluation](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42003363139): generated actual native PES/DST but cross-format physical-size sanity checks failed in several cases. This is independent negative evidence, not CI infrastructure failure.
- [Offline Lilo source package test](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42005950380) completed using the published tag. Source remains GPL-3.0-only; commercial reuse requires review.
- All benchmark scripts on `experiment/existing-engines-nuizu-benchmark-no-deploy-20261105` are benchmarks, not switched-on backend changes. **GitHub main remains untouched.**

## Firm decision

**Do not deploy Nuizu or Lilo yet. Do not extend custom Stitch Forge digitising algorithms speculatively.** Instead, benchmark an established third-party automatic art digitiser with independently verified original-source appearance, decoded machine paths and ideally a physical stitch-out. Next candidates: StitchFoundry's distinct photo-stitch and auto-digitise modes (MIT/Apache; immature machine testing) and, only after explicit budget approval, commercial Wilcom Embroidery API.

An engine passes the next gate only if it visually preserves the black eye/highlight, beak, wing features and readable foliage **and** independently produces physically plausible PES/DST with matching dimensions, controllable travel and no unacceptable density. Actual fabric test remains required.

**User objective unchanged:** completely automated high-quality PNG → PES/DST service. Current result: NOT ACHIEVED.
