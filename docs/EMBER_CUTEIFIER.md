# Ember Cuteifier PNG — independent image preparation
Date: 10 November 2026

## Aim
An isolated browser-only page at /cuteifier.html. It prepares a low-colour, black-outlined, alpha-transparent PNG for subsequent digitising using Ember. It does not connect to Ember, generate PES/DST or guarantee sewability.

## Existing source reused
- The experimental Detailed Motif illustration processor was copied without changing its engine code from feature/md277-automatic-simple-motifs-no-deploy.
- The new standalone pixel-outline layer is site/ember-prep-core.js.
- The controller and export UI are site/cuteifier.js and site/cuteifier.html.
- Existing native-workflow scripts and Cloud Run integration were not modified.

## Image output
PNG only, 2000x2000 square RGBA canvas, 9% design margin, centered on the isolated subject. Nearest-neighbour scaling deliberately preserves flat palette rather than creating JPEG-style gradient colours. Outline has thin/medium/bold settings. Major internal colour borders may be on or off. Dark marks are converted to pure black.

## Appropriate source artwork
A single recognisable subject with clean/transparent edges or an unambiguous flat contrasting background. Small eyes and interior marks should be inspected on the output. Detailed images with cluttered or photographic border backgrounds can fail explicitly rather than silently removing body parts. The algorithm simplifies colours and shapes but does NOT generatively redraw poses or change proportions.

## Basis
Ember's own user manual recommends working with closed shapes, a limited colour list, and fill/outline stitch settings. Ember accepts PNG. Ember has not published a universal required pixel count, so 2000 pixels is an engineering default, not an Ember certification. Actual stitch layout, size, trims, compensation and fabric sew-out must be reviewed in the digitising program.

Reference: https://emberdesign.net/manual/editor/shape-settings
Reference: https://emberdesign.net/manual/getting-started/basic-usage

## Release safeguards
- This page has no server calls or paid API requests.
- Source images are processed in-browser and not uploaded by this feature.
- No private credentials are required.
- The existing machine-generation path is unchanged.
- Static site build must pass all existing tests plus tests/test_ember_prep.cjs.
- Test a user-provided capybara or bird source on the deployed page before describing quality as approved.
