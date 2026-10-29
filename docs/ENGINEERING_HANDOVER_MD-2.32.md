# Stitch Forge engineering handover - MD-2.32 (2026-10-29)

Branch: feature/detailed-embroidery-analysis-no-deploy
Parent: cad34b388e211d90a1f25ed4e23c2f01c867a689
No Netlify deployment, PR updates, hosted worker, paid AI, main/develop changes or merge.

Implemented: a self-contained browser shape classifier (site/stitch-classifier.js) converts bounded closed source contours into geometry-only stitch CATEGORY proposals. It uses actual requested design width (mm), area-weighted polygon major axis and nine perpendicular cross-sections. Stable slender forms yield preview running centrelines or two satin rail point sequences; broad shapes are fill candidates; undersized, irregular and invalid shapes require review.

Browser integration: site/index.html loads the new classifier before auto-reconstruct-ui.js. UI attaches classification only to source-recovered details and reports running/satin/fill/review counts. No proposed rails are passed to the worker. Recovered details remain machine-ineligible even after classification; existing quality blockers persist. Editable path styles are unchanged.

Evidence: 12/12 targeted tests pass in direct V8 execution with CommonJS/assertion test shim; tests/test_stitch_classifier.cjs committed. Full existing Node/Python suites, browser integration, actual Android, realistic wildlife images, real engine and physical sew-out were NOT executed. See docs/test-evidence/MD-2.32-stitch-classifier.txt.

Outstanding Target 2: continuous satin rails/rungs with validation and physical dimensions, stitch angle/length limits, underlay, densities, direction and pull compensation, true hole support and independently inspected native PES/DST under physical embroidery tests. Realistic art false positives unmeasured. Production deployment remains prohibited.
