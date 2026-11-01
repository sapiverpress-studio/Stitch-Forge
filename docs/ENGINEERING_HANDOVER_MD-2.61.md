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
