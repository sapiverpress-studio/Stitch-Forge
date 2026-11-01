# MD-2.64 — visible design width, source-bound audit, and genuine-art acceptance criteria

Date: 1 November 2026. Branch:
`feature/visible-artwork-sizing-underlay-audit-md264`.
No Google Cloud build, traffic changes or Netlify deployment in this phase.

## Verified root cause: user poppy was sized against transparent canvas

The supplied original transparent 1200×1200 PNG has foreground alpha bounds
x=322..894 inclusive (573px wide, **47.75%** of canvas width).
Its previous stitched PES design measured **38.3×56.0mm**, even though the
old UI labelled a field 'Full artwork image width (mm)' and the requested
number was 80mm. 80×0.4775≈38.2mm, matching measured size.
The issue is physical-size semantics, **not a corrupt PES format**.

The UI now explicitly requests **visible embroidered design width**.
The client computes a foreground rectangle using its existing trusted
transparent/background classification. For a requested size N mm and a
foreground of b analysis pixels inside w source pixels, the signed request
uses a physical canvas width of **N×w/b**, leaving all original image
pixels, pixel ownership, holes, relative placement and alpha unchanged.
The app only uses this scale if the entire source frame remains within
the strict existing 250×296mm server constraints. Otherwise it
**refuses** with guidance to trim empty canvas or choose a smaller width.
The old source-bound packet schema and HMAC source-fingerprint checks
remain unchanged; only the numeric requested frame width is adapted.
The UI reports decoded stitched extents and warns when the actual
stitched width remains >8% or 2mm away from the requested visible size.
Manual/legacy artwork-canvas mode still exists in the JS API and
defaults to old behaviour unless explicitly selecting `sizeMode=visible`.

Expected poppy: 80×1200/573 = **167.54mm source-frame width**
to achieve approximately 80mm visible design width, **not** an 80mm
full-canvas frame. This is a geometric expectation; precise output
must pass fresh native PES/DST generation.

## Underlay — retain already existing selective policy, don't blindly enable

Official Ink/Stitch Tatami Fill documentation explains ordinary fill
stitches usually require an underlay, generally sparse stitching at
90° to the top fill: https://inkstitch.org/docs/stitches/fill-stitch/ .
The new MD-2.61 engine **already enables underlay selectively** on
eligible wide source-filled polygons (>=8mm² and >=1.4mm interior
thickness). Its repaired fill may intentionally disable underlay
to avoid unsafe native cross-colour travel; this still requires
physical fabric assessment.

The poppy ZIP has four genuine tatami fills yet all carry
`inkstitch:fill_underlay=false`, suggesting the worker serving that
request was older, which remains **unverified** during the 95/5 split.
The original worker lacks the new selective underlay logic. Rather
than bypass source containment, the new report records planned
underlay-enabled native fills and adds a blocker if there is no
underlay at all. A new validated `workerRevision` marker is included
when Cloud Run supplies `K_REVISION`, so subsequent tests show the
actual serving revision. No secret tokens or cloud credentials are
included in the report.

**Physical quality unverified:** A fill having underlay is not
proof of adequate fabric stabilisation, and 'source containment'
is not a visual or physical sewn-product approval. Pull compensation
must be calibrated for the fabric/thread/stabiliser and selected
machine, not assigned a universal number.

## What counts as a *real* detailed-artwork trial

The basic poppy fixture is retained **only as a simple functional
control**: correct input, physical dimensions, signed source,
working-colour areas, genuine native PES/DST, and zero out-of-colour
needle errors. It must NOT be represented as proof of target-2
complex artwork handling.

The primary acceptance standard requires:
1. Source-identical Kingfisher input, with high-resolution wing, eye,
   overlapping anatomy, feather textures and orientation preserved.
2. At least one OTHER detailed, licensed naturalistic artwork so
   no changes can be overfitted to the Kingfisher.
3. Compare actual PES/DST decoded stitch data, source feature
   continuity, stitch-direction and thread sequencing; quantify
   unresolved protected details, trims/jumps, geometry retention
   and visible stitch coverage. Fail closed on regressions.
4. Operator-controlled fabric testing including hoop, needle, thread,
   stabiliser, fabric and a real sewout. Only then approve for physical
   products or customer use.

The next build should be scheduled ONLY after branch CI passes and
a source-matched test can demonstrate the revised 80mm semantics.
A passing poppy CI test cannot approve a detailed-artwork digitiser.
