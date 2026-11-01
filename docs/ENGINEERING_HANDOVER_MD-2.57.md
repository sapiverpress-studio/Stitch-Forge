# Stitch Forge MD-2.57 — fill-preserving native repair (isolated trial)

Date: 1 November 2026. Branch: `feature/fill-preserving-native-repair-md257`.
No Netlify, Cloud Run, Google Cloud Build or production deployment is authorised by this change.

## Verified reason for this revision

The matched MD-2.55/MD-2.56 kingfisher native trial had 40,792 needle stitches, 1,348 PES trims, 921 unresolved objects and a 35.0625 mm² orange fill replaced with running skeleton (source object `EE8122-21-p0`). Grouping SVG objects reduced path elements but did **not** lower actual stitch/travel/trim counts.

## Experimental code change

- A new signed `mode=fill_preserving` native repair receipt requests a **fresh native export** with the original polygon, holes, thread colour, native tatami fill family, row spacing and angle unchanged. Only the selected object's underlay and automatic underpath are disabled to test whether internal travel caused the prior source-containment violation. This is a bounded, reversible hypothesis, **not proof** it fixes the kingfisher. No direct PES/DST stitch rewriting.
- At most twelve independently identified source-fill pieces and 2% of source foreground may be repaired; tampering with the HMAC-bound mode, IDs, source or expiry is rejected. Legacy already-issued receipts remain valid for their short lifetime.
- If independently decoded stitches still cross prepared colour regions, the repair fails closed; a large fill is not automatically silently replaced by running stitches in the new repair path.
- Real output stays `machineEligible=false`, with an explicit `fill_repair_without_underlay_or_underpath_requires_fabric_review` blocker if a repaired fill passes. No fabric compensation is invented. The removed underlay may itself degrade physical stability, which requires physical sewout review.

## Release gate — NOT YET MET

1. Run existing native synthetic tests in GitHub Actions and confirm repair attributes/geometry/source colour masks are unchanged, receipt integrity holds and actual Ink/Stitch PES6/DST remain independently decodable.
2. Run an **identical-source** isolated Kingfisher A/B on the private staging worker: real PES/DST, no outside-source stitches, originally 35 mm² orange area remains a genuine native fill, compare trim/jumps, density, image likeness, palette and resolved source features. No paid Cloud Run test without explicit authorisation.
3. If no-underlay repair is unsafe or not source-contained, stop and investigate source polygon routing/underpath or propose a second bounded repair method. Do not substitute a running-only patch to meet a numeric gate.
4. Obtain a physical sewout from an embroiderer on intended fabric/stabiliser before machine or commercial approval.

Existing production code, production traffic and Netlify have not been changed. This branch is deliberately not merged.
