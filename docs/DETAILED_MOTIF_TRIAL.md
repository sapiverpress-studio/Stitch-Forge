# Detailed Motif development preview

Detailed Motif prepares a flat illustration on the device. It uses alpha or a
connected plain-border background estimate, an edge-aware texture filter, a
bounded palette and multiscale dark-mark recovery. Compare the source and
illustration, then approve the version you want embroidered. The retry button
selects another deterministic preparation. The primary scope is one connected
subject on transparency or a plain contrasting background, at 30–200 mm wide.

The native job receives the exact approved colours and pixel geometry through
the existing authenticated V1 route. The original upload stays in the browser.
The worker derives contours from run-length masks and renders genuine
Ink/Stitch PES6 and DST. The browser checks the signed export, file checksums,
colour order, decoded size, density, coverage and the unresolved-object count
before enabling downloads. The playback uses decoded PES needle segments.
The worker independently compares needle positions across both formats.

## Files and reopening

- The ZIP contains both machine files, the editable Ink/Stitch SVG, the native
  machine report, decoded segments, the approved PNG and editable colour-region
  masks.
- **Save editable motif** creates a `.sfmotif` project with the exact original
  file bytes, approved artwork, editable geometry, physical settings and the
  audited native archive. Its region masks have an image-local origin and a
  physical scale. The SVG in the archive is the compiled stitch geometry.
- **Open saved motif** checks image and archive integrity and rebuilds the
  colour geometry. The app requires approval and fresh native validation before
  enabling downloads from a reopened project. The project stores no token.

## Acceptance and release

Run the existing Node and Python test suites and the Android-sized Chromium
test in `tools/check_detailed_motif_browser.py`. For native acceptance, start
`tools/local_app_server.mjs` with the pinned Ink/Stitch binary and set a local
owner token. Run the browser check with `--native --out <directory>`. The
loopback runner calls the real Netlify job handlers and the real WSGI worker
with a temporary in-memory job store. The private acceptance artwork belongs
outside the public repository. CC0 generalisation fixtures and their source
credits are under `tests/fixtures/artwork-evaluation/`.

Detailed Motif uses no paid image API. A hosted preview needs the existing
private job and Cloud Run credentials. In the Deploy Preview Functions
environment, `STITCH_FORGE_DETAILED_MOTIF_WORKER_TAG` can select an existing
exact-palette revision of the configured private Cloud Run service. Both
native phases use this revision for Detailed Motif jobs. The normal worker
route remains in use for the other workflows. A worker that substitutes its
own palette for the approved illustration fails the existing download gate. Before production, verify the exact preview worker revision with
an authenticated job, review stitch routing and perform a fabric sew-out on a
supported home machine. Review the full diff against the deployed Netlify
revision and obtain a separate production release approval.
