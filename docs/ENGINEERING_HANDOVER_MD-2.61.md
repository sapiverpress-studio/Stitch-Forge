# MD-2.61 — automatic source-preserving repair and first downloadable sewout evaluation pack

Branch: `feature/automatic-multi-method-release-candidate-md261`
Date: 1 November 2026. **No production/cloud deploy and no automatic shop-ready claims.**

## Existing multi-disciplinary pipeline

Artwork analysis, semantic proposals, protected source-colour masks,
region topology and contour tracing remain in existing JS modules.
Existing NumPy, scikit-image, Shapely, VTracer experiments, medial-axis
shape direction and plotter-style pen-up routing stay in place.
Ink/Stitch 3.3.0 produces real PES6/DST and pyembroidery independently
validates decoded needles. No new package, paid API or incompatible
licensed source is added.

## Automatically choose a legitimate fill repair

With the explicitly server-side flag `STITCH_FORGE_AUTO_SOURCE_REPAIR=1`,
the worker now checks complete-area source-exact tatami sectioning first.
If source geometry is too small or too complicated to section safely,
it selects an unchanged tatami fill with underlay/underpath disabled,
instead of automatically converting the shape into a sparse running
skeleton. Only those named geometric refusals permit this fallback:
identity, budgets, HMAC, bad source and other errors must still stop.

All attempts are still limited to a second native pass, HMAC-bound to the
exact source and unmodified 2% area / 12 object caps. Independent
PES/DST source-stitch checks still reject outside-colour needle motion.
Selecting a plan does not prove that the native export will succeed.
The original worker is unchanged unless separately deployed and enabled.

## Real downloadable test work

The GitHub Actions native workflow now runs the existing local original
image -> source-bound plan -> genuine Ink/Stitch -> independent PES/DST
audit pipeline on the repo's CC0 Rose with leafs PNG. An Actions
artifact stores the actual generated native files, source image, decoded
preview, report and explicit operator evaluation instructions.
No Cloud Run, Work credits or Netlify changes.

**These are not commercial-machine-approved designs.** The sample
must undergo a supervised physical sewout with a machine operator,
correct format/hoop/thread/fabric/stabiliser, then quality evaluation.
The actual user Kingfisher input still requires a source-identical
end-to-end test and careful review before commercial release.

## Real release gates

1. CI must pass from actual native source image and worker container.
2. Reinspect source features and unresolved objects. No fake approval.
3. Approve and separately perform protected Google Cloud worker rollout
   and Netlify app integration to enable live one-click generation.
   Do not deploy through a source commit.
4. Conduct actual physical sewout: no digital-only evidence can
   establish that products can safely be produced.

## Actual CI native evidence — 1 November 2026

Commit `054768fc0b8d4a4e64f580cc0b0a368f451a84a8` verified by GitHub
Actions **run 41319198236**, status **completed/success**:
https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41319198236

All synthetic/native tests, independently decoded PES/DST, actual local
source-to-native licensed rose, artifact retention, and isolated
worker-container HTTP integration passed. Source and machine files are
downloadable as a short-retention GitHub Actions artifact
`stitch-forge-rose-native-sewout-EVALUATION-NOT-APPROVED`
(artifact id **13088657045**), not as a publicly hosted live app.

Downloaded ZIP independently inspected; contained valid separate PES and
DST, decoded SVG preview, machine report, original CC0 source PNG.
A handover-friendly ZIP was then prepared in the chat session:
`Stitch-Forge-Rose-80mm-SEWOUT-TRIAL-ONLY.zip`.

**Measured original rose result**: 15,454 needle stitches in both decoders;
PES 183 trims / 185 jumps; DST 7 trims / 231 jumps (different format
semantics); 12 proposed sRGB working colours; 115 unresolved small
source objects (118 pixels); decoded stitch bounds 76×75.5 mm for an
80mm source scale. Zero needle points or segments outside source-colour
mask with the existing 0.11mm tolerance. These are machine-file diagnostics,
NOT sewn-product approval or complete artwork fidelity.

The new automatic repair selection was unit-tested against real
client-bound source geometry; the resulting *selection policy on actual
Kingfisher* has **not** been exercised by this rose run. Do not confuse the
rose result with Kingfisher release readiness.

**Deployment status:** Main not updated. Production worker not updated.
Netlify not updated. Before a hosted release, the owner must authorise
the separate worker rollout and site deployment, acknowledging potential
Google Cloud charges and safe traffic/version matching.

## Source-identical Kingfisher staging outcome — 1 November 2026, 16:18 GMT

Evidence: owner-supplied Cloud Shell screenshot of successful protected
`tools/deploy_md261_tag.sh --execute`, followed by a source-identical
Kingfisher A/B. The isolated `md261` worker revision was deployed at 0%
traffic; the original worker stayed at 100%, and Netlify was unchanged.

- Source: original uploaded PNG, prepared at **320×384** pixels; prepared
  source fingerprint matched the MD-2.56 baseline exactly.
- Independent **PES6/DST generation and decoded source-colour audit PASSED**.
- Needle stitches: **40,792 → 40,976 (+184)**.
- PES trims: **1,348 → 1,353 (+5)**.
- PES jumps: **1,350 → 1,355 (+5)**.
- Maximum needles in one mm²: **52 → 52**.
- Native SVG elements: **956 → 1,162 (+206)**.
- Unresolved small objects: **921 → 921**.
- Old repair blocker: `repaired_fill_changed_to_running_requires_likeness_review`.
- New repair blocker: `sectioned_tatami_seams_and_no_underlay_require_fabric_review`.
  Thus the once-skeletonised repair is now output as sectioned **native tatami**
  geometry. This is a genuine stitch-type change but **not** proof of sewout
  or visual quality.
- Release gate explicitly: **NOT MET — PES trims increased**.
- Local private files on user's authenticated Cloud Shell:
  `/home/callighanjames/md261-kingfisher-20261101-161846-NOT-APPROVED.zip`
  and corresponding `.json`. These reports contain the detailed diagnostics
  needed for deciding how to minimise travel without losing tatami anatomy.
  Do not add user's source artwork or machine payloads to public GitHub.

**Safety/release decision: HOLD live worker traffic and Netlify changes.**
The policy tradeoff is five additional PES trims for preserved fill anatomy;
trims alone are not an adequate physical quality score. Inspect actual
machine-report, decoded preview and retained orange fill region in the ZIP,
then assess travel, thread density and realistic sewout before considering
a gated rollout. Do not rerun or rebuild paid Cloud Run on the same evidence.

## Direct MD-2.56 versus MD-2.61 decoded machine-file comparison — 1 November 2026

Two source-identical owner-supplied private ZIPs inspected side-by-side,
including the full decoded segment arrays, source native SVG path families,
machine report and unchanged source/request fingerprint:
- MD-2.56 baseline `md256-kingfisher-20261101-065059-NOT-APPROVED.zip`
- MD-2.61 candidate `md261-kingfisher-20261101-161846-NOT-APPROVED.zip`

Both ZIP CRC checks passed. Same exact `requestId`
`f8f648c18cc5cd9c30dba3d4d0d77aeb59008490586ddfe785e9b0ba8335c391`.
The decoded path arrays show **329 newly present orange line segments and
151 removed orange line segments** in MD-2.61 relative to MD-2.56
(segments compared as value tuples and multisets); every added/removed
decoded line is colour-index 11, `#EE8122`, and lies within
SVG coordinates approximately `x=48.5–63.0 mm, y=62.8–67.5 mm`.
No other colour's decoded line segments changed.

The specific `EE8122-21-p0` source fill is **561 analysis pixels / 35.0625
mm²**, or **1.18% of foreground**. The old skeleton's complex running path
was replaced with seven genuine native tatami_fill input paths at an angle
of 0 degrees, row spacing 0.5 mm, underlay false, underpath false,
and total calculated internal seam length **10.75 mm**.
This segmentation preserves the source shape but may cause visible sewing
seams and fabric instability; the file has not been physically sewn.

MD-2.56 -> MD-2.61:
- Decoded stitches: **40,792 -> 40,976 (+184)**.
- Orange decoded source-path proximity at 0.25mm radius:
  **3,812 / 4,248 (89.74%) -> 3,966 / 4,248 (93.36%)**, +154 nearby
  selected orange pixels, +3.63 percentage points. The proximity metric
  is **not physical sewn-thread coverage**.
- Overall proximity: **42,105 / 47,687 (88.29%) ->
  42,259 / 47,687 (88.62%)**, +0.32 percentage points; all increase
  attributable to the orange repair.
- Unresolved: **921 components / 1,006 pixels** (about 2.11% of
  selected foreground) on both.
- PES trims: **1,348 -> 1,353**; PES jumps: **1,350 -> 1,355**.
  DST reports 18 trims in both and jumps 1,472 -> 1,473;
  PES/DST encoding of trim and travel differs.
- Original/source palette uses 12 colours. Six thousand ninety-six
  source foreground pixels have an RGB distance greater than 60 from
  the assigned working palette colour (12.8%). This is a palette
  reconstruction concern, not a machine safety fault.
- Max audited needles in any 1mm² is 52 for both versions.
- Both machine files pass source-colour stitch containment but remain
  `machineEligible=false` and `physicalQualityVerified=false`.

A private engineering image was generated in the original ChatGPT
workspace from **real decoded segments**, displaying full bird side by
side and a magnified orange underwing ROI. No uploaded bird artwork or
private machine-file bytes added to public GitHub.

### Release-critical engineering interpretation

**MD-2.61 produces genuine PES/DST, but this is a very local improvement.**
It did not materially improve the main wing, beak, eye, feather structures,
colour texture or routing, because decoded segments outside the small
orange patch are unchanged. Do not claim an end-to-end detailed-artwork
digitiser is finished or advise selling/sending these files for product
fulfilment without professionally supervised sewout review.

Prioritise **semantic feature protection and fragment consolidation
before native stitch generation**, plus a calibrated, fabric-aware
stitch-coverage/underlay/trim strategy. Preserve the source pixel ledger
and object identities. Separate stitch containment (audited) from
semantic feature likeness and actual sewn-thread coverage (unverified).
Benchmark at least varied licensed complex artwork and the source-identical
Kingfisher before another paid Cloud Run rebuild.

**Production decision: HOLD current 0%-traffic MD-2.61 tag; do not
promote live worker traffic or publish a new Netlify build on this evidence.**
