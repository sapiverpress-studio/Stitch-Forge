# MD-2.65 — Sapiver logo and product-specific embroidery download names

This is a frontend-only change. It must not modify source artwork,
signed packets, native engine algorithms, PES/DST contents, receipts or
worker routing.

The site logo is a small WebP derivative of the *user-uploaded* 1536x1536
Sapiver Press image. Original pixels have not been AI-redrawn or invented.

A freely chosen product/design name, unrelated to the upload filename,
controls the downloaded ZIP basename and optional standalone PES and DST
names. Output still carries the TRIAL-NOT-APPROVED warning.
Names are ASCII-slugged and bounded (56 characters).

The ZIP itself remains byte-identical to the worker's independently
audited native output. Internal member filenames remain fixed, preserving
the native source binding. Individual PES/DST download buttons extract the
same files using the existing CRC-checked ZIP parser and save with the
selected product name. Machine reports are named using the same product
slug, but their native contents are unchanged.

Changing product name is local and does not regenerate stitches or trigger
AI calls. No automatic Netlify or Cloud Run deployment from this branch.
