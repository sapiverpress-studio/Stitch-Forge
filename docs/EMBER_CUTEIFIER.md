# AI Cuteifier for Ember — 10 November 2026

## Purpose
Stitch Forge's /cuteifier.html is a distinct illustration-preparation product. The original pixel-reduction tool was not a cuteifier; it produced a source-like colour trace with hundreds of tiny regions. This release replaces that flow with actual AI illustration editing.

## User workflow
1. Choose PNG/JPEG/WebP (maximum 12 MB).
2. Choose cuteness, 4/6/8 target flat colours and outline weight.
3. Press **AI Cuteify image**. This is the only action that requests a paid image-generation edit.
4. Supply the existing Stitch Forge owner access token if not already stored.
5. Background job redraws and reinterprets the original, instructing smooth friendly shapes, a meaningful silhouette, limited colour regions, strong black outlines, anatomical fidelity and a transparent background.
6. Review original and image side by side. Download 2000×2000 transparent PNG. Import into Ember and verify stitch plans.

## Security, privacy and cost
- OpenAI API key remains in existing private Netlify runtime environment; it is never sent to the browser.
- Either the existing Stitch Forge analysis or worker owner token is required. No public anonymous paid requests.
- Real image editing calls go from a signed background function to the official OpenAI Image Edits API.
- Model: gpt-image-2.5-flare; 1024px input/output editor stage, medium quality and transparent WebP output; browser converts that into 2000px PNG.
- Artwork is kept in a private strongly consistent Netlify Blobs store during processing, and the source is deleted after the job. The output remains private and retrievable for up to 4 hours; a scheduled 6-hour cleanup removes expired records.
- Rate limit: 3 submissions per IP per minute, plus owner-token authentication. User-visible price is not fixed, because the Image API bills per image/edit tokens.
- The user's image is supplied to OpenAI only after pressing AI Cuteify.
- Images are never sent to the native Ink/Stitch worker by this page.

## Actual image quality
The result is generated artwork, not a deterministic recolour. The model is asked for 4–8 solid-colour regions, fewer curves and clear face features, but output exact colour counts, semantic fidelity and actual embroidery quality cannot be guaranteed.
The webpage adds a consistent black silhouette outline after reviewing alpha, and refuses to mislabel opaque output as transparent.
This page is not a digitiser; its PNG is a source for Ember's separate digitising step.

## Tests
- Node unit tests: auth, forbidden inputs, private signed background job, provider mock, retrieval, cleanup, exact image type, no secret leakage.
- Android-size Chromium smoke in GitHub CI: uploaded image, authenticated mocked AI request, preview visible, empty placeholder hidden, actual 2000×2000 RGBA PNG download.
- No paid OpenAI generation was executed by automated tests.
- The first live Kingfisher output still needs user review and a stitch test in Ember.

Source: https://developers.openai.com/api/reference/resources/images/methods/edit
Source: https://emberdesign.net/manual/editor/shape-settings
