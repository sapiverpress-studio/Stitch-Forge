# Cuteifier — image-to-image character illustration
Latest build: 10 November 2026.

## What the feature does
This is NOT embroidery digitising, colour-quantisation, posterisation, or the legacy detailed motif tracer.
The capybara's “Prescan (tidied)” visual concept is the desired quality standard, not a previously proven working engine.
One explicit Make cute illustration click sends the uploaded original to the official OpenAI Images Edits API (model gpt-image-2.5-sunburst, high quality, 1024×1024, transparent WebP output). It prompts a genuine storybook-style redraw that preserves identity, pose, smile, muzzle, eye closure and whiskers.
After a result, the browser keeps the native image pixels. The optional black *outer silhouette* outline is **off** by default and toggles without another API call. Download PNG saves exactly the visible canvas in native resolution.

## Security and economics
Existing owner token STITCH_FORGE_ANALYSIS_TOKEN authenticates submitted images. The separate internal worker token signs background jobs. Existing OPENAI_API_KEY remains server side.
Private artwork is stored temporarily in Netlify Blobs, removed from the job after processing, and generated output expires in 4 hours. Scheduled cleanup purges expired jobs. One paid edit per click; no automatic provider retries, and a Recover previous generation button prevents duplicate charges on reload.
The OpenAI API incurs metered image-generation cost. No fixed per-image price is promised. Never expose the secret key or source imagery in errors.
No changes to existing PES/DST/Cloud Run embroidery systems.

## Verification
Automated tests mock the official provider; no paid image call in CI.
Mobile Chromium test must upload a source, receive a mocked illustration, show image rather than placeholder, download an alpha PNG with pixels identical to the preview, toggle the black outer outline on/off, and confirm no additional API requests.
A real user-supplied capybara/kingfisher edit and human visual evaluation remain necessary to certify quality. Unit tests cannot establish aesthetics, facial fidelity or production-worthiness.
