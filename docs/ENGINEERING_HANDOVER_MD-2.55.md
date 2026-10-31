# Stitch Forge MD-2.55 — researched fill stabilisation and source-preserving region routing

Date: 31 October 2026. **Isolated experimental branch; no production Cloud Run worker changed.**

## User's acceptance target

A recognisable embroidery of the SAME source illustration: correct silhouette and important internal shapes, generalised thread colours, real PES/DST, acceptable physical stitch structure. This is *not* pixel-level photographic reproduction, nor is a decoded file proof of physical sew-out quality.

## Actual flying kingfisher baseline

Source: user's uploaded `stitch-forge-artwork-TRIAL-NOT-APPROVED.zip`, with true native machine report and independently decoded PES/DST.

- 1,097 Ink/Stitch SVG paths: 854 running paths, 243 tatami fills.
- 30,289 actual needle stitches, 12 colours, 11 colour changes.
- 1,055 PES trims; 1,751 DST jumps, 169 DST trims.
- 396 unresolved small objects, 534 unresolved selected pixels.
- 80 mm requested width; independently decoded extents 78.4 x 87.0 mm.
- All original native fills had `fill_underlay=false`.
- Physical sewout and thread routing quality unverified. **Do not approve for sale or direct machine use.**

## Research basis

- Ink/Stitch Tatami fill: https://inkstitch.org/docs/stitches/fill-stitch/ — supports guided row angle, four-row stagger, intra-shape underpath and underlay perpendicular to top fill, with coarser underlay row spacing and inset.
- Ink/Stitch attribute contract: https://inkstitch.org/de/developers/inkstitch/namespace/ — identifies `fill_underlay_angle`, `fill_underlay_row_spacing_mm`, `fill_underlay_inset_mm`, `staggers`.
- Ink/Stitch routing: https://inkstitch.org/tutorials/routing/ — organise start/end points and minimise jump/trim travel; arbitrary straight shortcuts can be unsafe.
- Kadwood Lilo architecture reference: https://lilo.kadwood.com/manual/auto-digitize/ — colour reduction, smallest region threshold, stitch family and ordering. **No GPL code has been copied.**

## Actual implementation on feature branch

1. `services/digitiser/artwork_trial.py`: connected running-skeleton branches are now joined into source-pixel-bound walks, never jumping between separate components. Each graph edge is walked no more than twice. The original source mask remains unchanged; branch retrace can increase some local stitches, so independently decoded density checks remain mandatory.
2. Same-colour source components are ordered by a deterministic nearest-centre heuristic to reduce travel candidates, without changing original component indices, repair receipts, colour, topology or area. Centre is independently derived from RLE pixel runs, not untrusted client bounds.
3. Native Tatami fill remains the Ink/Stitch 3.3 engine. For polygons >=8 mm² that contain an interior 1.4 mm across, selectively enable underlay: 0.35 mm inset, +90° angle, 1.5 mm row spacing and <=3.5 mm stitch length. Stagger top fill across four rows. Smaller/thinner regions retain no underlay. Zero pull-compensation remains until physical fabric tests.
4. Explicit manifest metadata accounts for consolidation, unchanged selected foreground and fill-underlay paths; status remains `machineEligible=false`.
5. Existing two-phase native PES/DST generation, audited source containment, repaired-part budget, file receipts, physical limits and the four-step website remain intact.

## Benchmark (local geometry only, **not native PES/DST**)

Using the same flying-kingfisher artwork resized to 144 x 173 analysis pixels at 80 mm, with a separately source-bound palette approximation:

- Baseline native input: 859 paths.
- Connected skeleton routing: 780 paths.
- 79 fewer paths (9.2% reduction), same 9,882 selected source-foreground pixels.
- This is NOT a direct comparison with the user's actual 256 x 307 baseline and cannot establish a PES trim reduction.

## Tests / rollout safeguards

New assertions in `tests/test_artwork_trial.py` cover underlay eligibility, exact source mask accounting, connected-edge conservation, deterministic closest-first ordering, native Ink/Stitch output and real two-phase service integration.

- Native tests run on the official Ink/Stitch 3.3.0 binary in GitHub Actions, independent pyembroidery decoder and real staged HTTP smoke test.
- No new OpenAI calls, no new server dependency, no changes to Netlify site or Cloud Run traffic.
- **Release gate:** all native tests green; actual 256 x 307 kingfisher PES/DST regenerated via updated *isolated staging worker*; zero outside-colour stitches; count trims, jumps, stitch density, missing features and shape resemblance against the actual previous ZIP. Only then consider the new engine image on live worker.
- If underlay produces holes crossed, unsafe stitch density, increased travel/trims or muted anatomical details, revert or adjust; do NOT move constraints merely to pass.
- A physical sewout on intended stabiliser/fabric remains necessary before commercial use.

## Clarification

The new technique consolidates **connected running-stitch paths and same-colour routing**, not neighbouring thread colours or original pixel masks. Colour simplification remains in the independently checked source preparation. This is deliberate to preserve the user's shape/likeness requirement.

## Final isolated test evidence (31 October 2026)

The official Ink/Stitch 3.3.0 engine, native PES/DST independent decoder, source-bound service tests and isolated worker container/HTTP transaction all passed in **GitHub Actions run [41181114736](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41181114736)**. Earlier two attempted runs failed on fixture assumptions and then on missing client-style bounds in the independently reconstructed worker plan; both were corrected in the actual source. This evidence covers synthetic fixture machine generation and worker integration, **not the new kingfisher stitch count, trim reduction or physical sewout**. Cloud Run has not been redeployed.
