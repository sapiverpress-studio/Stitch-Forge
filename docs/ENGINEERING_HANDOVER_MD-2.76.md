# MD-2.76 — Original PNG authenticated running-detail pass

**Date:** 6 November 2026 (London)  
**Branch:** `feature/md276-authenticated-original-detail-running-no-deploy`  
**Status:** EXPLICIT PRIVATE TRIAL, **NOT DEPLOYED, NOT MACHINE-APPROVED**

## Why

MD-2.74 separates existing Tatami/satin/running stitch objects. MD-2.75 diagnoses original-source detail loss before native stitch planning. The next test must answer whether a separately sourced *running-stitch contour* can be added to genuine PES6/DST while the original image, palette membership and physical source containment remain independently verifiable.

## Implementation

- `services/digitiser/authenticated_running_detail.py` binds a private original PNG (official MD-2.70 V2 SHA/foreground/colour correspondence), exact prepared RGBA SHA256 and independently reconstructed colour RLE ledgers. **Stronger local gate:** the original must reproduce the working pixels exactly under a deterministic PIL/LANCZOS resize. This can reject some browser canvas resizes; do not assert production compatibility.
- Up to six explicitly selected original-pixel windows (`id`, `rect`, `color`) can propose a real running contour from the ORIGINAL pigment inside that window. Proposal only if it is enclosed, physically sized, inside the prepared working colour mask, and sampled every <=0.06mm with at least 0.9mm clearance to other working colours. Undersupported features fail without extra stitch geometry; **no invented eye/feather semantics**.
- `artwork_trial.build_trial_svg(..., staged_running_source=...)` *recomputes* the original-to-working proof at the native conversion boundary, uses only selected original-verified geometries, inserts the new native running object next to existing objects of its same colour, retains previous Tatami/satin and underlay and exposes an unapproved running-detail audit.
- The native two-format `run_trial` uses unchanged official Ink/Stitch 3.3.0 PES6/DST exporter, decoded pyembroidery colour-path and structure audits.
- `tools/staged_legacy_trial.py`: `--original-png`, `--working-rgba`, `--running-detail-windows-json`; first output `running-original-candidates.json` with zero geometry change. Only `--select-running FEATURE_ID` explicitly enables a new native path. Original image pixels are not published to the repository or public artifacts.

## Negative findings retained

An initial real source-colour-native benchmark using a 10-colour automatically generated **synthetic** eye/source ledger showed 0 baseline breaches, but **three new decoded needle segments** outside the selected eye colour. The pass was correctly blocked. The strict 0.9mm physical source clearance may then reject this fragmented palette's contours entirely; **do not remove or weaken the guard** to make tests green.

A separate *controlled two-colour source-ledger* comparison uses the exact same synthetic original/reduced image, with all pixels retained and distinct true eye/body colours. It is a **test fixture with explicitly chosen colours**, not an algorithm proven to maintain a complex naturalistic palette. This test protects against colour-assignment arithmetic overflow and demonstrates that suitable initial colour preparation is a prerequisite for safe separate detail stitch passes.

## Verification

- First six baseline source-bound running pass tests **PASS**: [GitHub Actions 42185533677](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/42185533677).
- Controlled coherent two-colour source and native PES6/DST A/B: latest Actions must pass before evidence can be accepted. Treat as pending until independently checked.
- Actual Kingfisher source-to-working authenticated native detail recovery: **NOT TESTED**. The private Kingfisher artwork remains out of public CI/repository.
- Semantic feature recognition, thread simulation, user visual sign-off and physical fabric sew-out: **NOT VERIFIED**.

## Next release gates

1. A source-faithful protected-colour palette step for real illustrations, with a proof it does not erase important gradients/features or change true palette identity.
2. Source-authenticated full-size Kingfisher and at least one licensed detailed illustration trial; real PES/DST decoded needle geometry and protected-feature visual comparison at the same dimensions.
3. Restrict running path density, trims, overlap with fill, optional underlay and routing before fabric testing; compare against unchanged baseline on an actual home embroidery machine.
4. Mobile stepper integration only after tested native candidate choice, with no Work credits or live deployment without separate authorisation.

**Release decision:** HOLD. No main merge, no Netlify/Cloud Run update, no customer output approval.
