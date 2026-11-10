# Cuteifier — image-to-image character illustration
Latest build: 10 November 2026.

## What the feature does
This is NOT embroidery digitising, colour-quantisation, posterisation, or the legacy detailed motif tracer.
The capybara's “Prescan (tidied)” visual concept is the desired quality standard, not a previously proven working engine.
One explicit Make cute illustration click submits one OpenAI Images edit using the selected mode. The cutout is 1024×1024 with an alpha background. Full design redraws the composition and setting on an opaque canvas, with square, landscape or portrait output based on the uploaded image.
Both modes ask for simplified picture-book shapes and a faithful expression and pose. The browser checks the generated background before enabling PNG download. The optional black outer outline is off by default and applies to a cutout without another API call. Each PNG saves the visible canvas in its generated resolution.

## Security and economics
Existing owner token STITCH_FORGE_ANALYSIS_TOKEN authenticates submitted images. The separate internal worker token signs background jobs. Existing OPENAI_API_KEY remains server side.
Private artwork is stored temporarily in Netlify Blobs, removed from the job after processing, and generated output expires in 4 hours. Scheduled cleanup purges expired jobs. One paid edit per click; no automatic provider retries, and a Recover previous generation button prevents duplicate charges on reload.
The OpenAI API incurs metered image-generation cost. No fixed per-image price is promised. Never expose the secret key or source imagery in errors.
No changes to existing PES/DST/Cloud Run embroidery systems.

## Verification
Automated tests mock the official provider; no paid image call in CI.
The mobile Chromium check compares the PNG pixels with the preview for both modes, checks real alpha and the optional outline, and verifies one request per explicit generation with a mocked provider.
A real user-supplied capybara/kingfisher edit and human visual evaluation remain necessary to certify quality. Unit tests cannot establish aesthetics, facial fidelity or production-worthiness.
