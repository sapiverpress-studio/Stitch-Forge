# Stitch Forge MD-2.48 recovery record — 30 October 2026

## Authoritative source/deployment distinction

GitHub main as checked before this recovery commit: MD-2.41 at `033234cde699644048598cee65bb166bdb3191ea`.
The Netlify production deploy checked before this recovery commit was MD-2.40 at
`597547e3f7f6a1e92eab846fd3ffe55842710fb4` (deploy `6ae383086f1e6ec8b8d5e47f`).
These are historical observations, not proof of future publication state.

Local sessions on 29–30 October reached an *unpublished* source commit labelled
`9d19230` (MD-2.48) with reported local application tests. GitHub returned
404/422 for both this commit and the preceding local `c05c86df` (MD-2.47).
The 2.47/2.48 application-source revisions are **not** present in any of the
three remote branches, and no source snapshot was recovered from available
user files. **No claim is made that GitHub contains the MD-2.48 app.**
Do not label a Netlify deploy MD-2.48 or sell its machine output.

## Recovered private local evidence (NOT committed to public GitHub)

A user-owned, private MD-2.48 engineering trial ZIP was inspected and its
PES/DST SHA-256 values cross-checked against its audit report. The archive
passes ZIP integrity. In a known kingfisher example, the report records:
- 50,035 needle stitches in each PES/DST file; 12 colours and 11 colour changes.
- PES: 1,170 jumps and 1,168 trims. DST: 2,168 jumps and 273 trims.
- 1,514 unresolved tiny/short objects (2,071 pixels).
- Machine eligibility: false. No physical stitch-out or likeness acceptance.

These demonstrate *one real-image engine experiment*, not automatic website
success, embroidery quality, or safe machine use. Source artwork, personal
images, machine trial binaries, decoded-image renders and full image-derived
machine reports stay outside this public repository.

## New recoverable offline asset

`tools/source_colour_audit.py` is a self-contained deterministic source-colour
audit, not native digitising. It quantises a bounded light-background raster,
produces source-pixel colour-run SVG + PNG + JSON, and **always** sets
`machine_eligible=false`. It rejects unsupported complex image borders.
No AI requests, Netlify functions, Cloud Run calls or new paid services.

The synthetic-only tests in `tests/test_source_colour_audit.py` were run in
the local Python environment: 4 passed, 0 failed. Required offline Python
packages: NumPy, OpenCV, Pillow; CairoSVG for the test's render comparison.

Run without touching the deployed website:

```sh
python -m unittest discover -s tests -p 'test_source_colour_audit.py' -v
python tools/source_colour_audit.py example.png /tmp/stitch-source-audit
```

In an earlier private kingfisher experiment at 768×660, 12-colour output
accounted for all 228,975 pixels *in the experiment's own foreground mask*
but yielded 14,626 contour rings, of which 12,017 were under 3 pixels area.
That 100% is tautological mask coverage, **not** 100% source fidelity or
semantic reconstruction. Pixel runs MUST NOT be directly turned into
embroidery machine objects.

## Release gates and next action

1. Recover the complete local MD-2.48 git checkout/bundle/patch from the
   originating runtime, or explicitly reimplement and test the missing
   app integration against remote main. Do not infer program source from PES.
2. Verify integrated browser → protected Netlify analysis → pixel-grounded
   semantic regions → true native Ink/Stitch → audited PES/DST using realistic
   source artwork. Include failures and single-call cost bound.
3. Reduce tiny stitch fragments and excessive trims before considering real
   fabric/machine validation.
4. Preserve fail-closed output blocking, local ownership of images, private
   cloud credentials and the existing MD-2.41 coverage gate.
5. No Netlify publish/preview/branch deployment, GitHub Actions invocation
   or paid OpenAI/Cloud Run call was authorised by this code-and-docs sync.

**This commit adds a recovery record and a non-deployed offline experiment. It
does not add the missing MD-2.48 web application code or fix automatic
detailed-artwork embroidery. Do not spend a Netlify deploy on this change.**
