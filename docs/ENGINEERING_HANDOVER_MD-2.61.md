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
