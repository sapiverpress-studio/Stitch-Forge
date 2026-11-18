# Design Editor on Stitch Forge

The existing editor is served at `/design-editor/` within the password-protected Stitch Forge site. It shares `stitch-forge-private-motifs-v1` through the local `/api/design-editor/motifs` function. The standalone ChatGPT Site is retained unchanged.

All supplied font packs, frame PES files, historical motifs, catalogues and previews are kept in `private-assets/` as an authenticated AES-256-GCM archive split into transport parts. Only encrypted bytes and hashes are versioned in this public repository. `STITCH_FORGE_EDITOR_ASSET_KEY` is stored as a Netlify production **Builds** secret; never place it in source, browser code or build output. `tools/build-design-editor.mjs` authenticates and verifies every asset, builds and tests the editor, then copies it to `site/design-editor/`. The browser receives files only through the existing Netlify password gate, configured for all deploys and all paths. Keep that protection enabled. No second application sign-in is added.

The root lockfile supplies all pinned dependencies. From the repository root, configure the build secret in your local environment without logging it, then run `npm run build:design-editor`. No raw installed font/frame files or decrypted generated directory may be committed. `private-assets/manifest.json` inventories the original files by SHA-256. Preserve your original purchase and licence evidence separately; no additional redistribution rights are granted.

The API composes the existing motif handler in-process, keeping its existing service key, store, session signing and connected-browser capture. Client Authorization and ChatGPT identity headers are not trusted or forwarded. Cross-origin writes, unrecognised Netlify sites and non-production motif access are rejected. The existing history import uses content hashes and `onlyIfNew`, preserving prior records instead of replacing them.

PES/DST composition remains on-device. Existing hoop, stitch and colour checks remain in place. These software checks do not imply physical sew-out approval. No Cloud Run engine, market listing, scheduled task or original ChatGPT Site is changed by attaching this page.
