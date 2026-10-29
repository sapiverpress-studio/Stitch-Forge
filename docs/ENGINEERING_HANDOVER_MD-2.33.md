# Stitch Forge handover — MD-2.33 (2026-10-29)

Branch: feature/detailed-embroidery-analysis-no-deploy
Source parent: 2ccc27ee564a2066def1498b676d80949ea31fc5

Target 2 visual reference: user-provided swan embroidery screenshot and a private 27.84-second butterfly/moth embroidery video show high colour separation, dark contours, layered filled details and fabric directional sheen. These media stay private: no derivative image, frame or file is committed.

New code: site/satin-geometry.js validates 3+ same-direction paired satin rails and rungs, rejecting <=1.5mm or >5mm width (conservative project preview band, not a universal material rule), extreme taper, crossing/mismatched rails and rungs, too sharp turns, invalid scale and over-budget preview density. Returns geometryOnly=true, machineApproved=false, and a zigzag visual GUIDE. These are not native PES/DST stitches.

UI/index loads and invokes validator only for source-recovered satin-category candidates and displays accepted/refused counts. The machine download is still blocked for all such regions; no change to native worker or exported paths.

Evidence: 13/13 new synthetic tests passed in V8 shim, but previous Node/Python suites not run in this milestone; no physical or real engine acceptance. docs/test-evidence/MD-2.33-satin-rails.txt. Authoritative Ink/Stitch guidance: https://inkstitch.org/docs/stitches/satin-column/ (two rails, same direction, three or more rungs recommended, underlay and compensation need separate configuration).

Next priority: trusted offline fixture converting approved two-rail/rung model into real Ink/Stitch satin path, execute pinned official engine, audit actual PES/DST stitch coordinates and colour/physical bounds and test on fabric. Also handle directionally guided broad fills and realistic gradient/shading artwork.

Restrictions: no deploys, PR updates, Cloud Run, paid AI, main/develop branch writes, licence changes or customer-ready claims.
