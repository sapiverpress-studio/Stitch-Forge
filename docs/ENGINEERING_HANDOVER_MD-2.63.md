# MD-2.63 — native PES/DST evidence gate for source-detail routing

Development branch `feature/native-routing-ab-release-gate-md263`.
This extends the actual MD-2.62 non-destructive running-detail router
without enabling the feature in the production worker.

**Reason**: 85.6 mm of reduced pen-up travel in private Kingfisher SVG
is NOT evidence of fewer machine PES trims. Any change made to machine
embroidery must be judged against actual independently decoded commands.

**New reusable benchmark**: `tools/bench_native_detail_routing_ab.py`
generates two source-identical genuine Ink/Stitch 3.3.0 PES/DST sets
from the **same licensed real source-object plan**. One uses the
current routing disabled, one enables the MD-2.62 method. The tool
runs the usual separate native decoder and source-colour containment
checks on each. It refuses any per-format increase in trims or local
needle density, any source detail omission, changes to colour order,
source/fragment accounting or path budget, a >5% needle increase
or any loss in source-colour stitch-proximity coverage.

The source image remains private in the corresponding source-bound
plan; only existing CC0 fixture is uploaded to GitHub. No source
recolouring, licensed third-party code or paid Cloud Run build.
The GitHub native-engine workflow stores both candidate machine
reports and `routing-ab/native-ab-results.json` for inspection.

**Gating rule**: When native A/B fails, keep MD-2.62 optional and
do not promote the new routing as a proven production improvement.
When passing, a fast-forward main merge is authorised by the user,
but **Netlify and Cloud Run deployments require a separate step
and actual source-identical Kingfisher sewout is still unverified**.
No metric is a substitute for physical fabric review.

## Actual source-matched CC0 rose native A/B — 1 November 2026

GitHub Actions run `41329987140`, code commit
`2e55d24d1bbcb1a4a9a8597cda54f3739aa67138`.
Two actual native PES/DST sets were generated at identical physical
dimensions, with the only change being the optional MD-2.62
source-detail router. Independent pyembroidery audits passed both.
Results are in `routing-ab/native-ab-results.json` of the native
GitHub artifact `13092404818`:

- 4 eligible contiguous running groups, 1 improved group, 19 reordered
  original objects. **16.5068mm estimated SVG pen-up saving**.
- PES actual trims **227 → 227**; PES jumps **229 → 229**;
  PES needles **18,096 → 18,096**.
- DST actual trims **8 → 8**; DST jumps **270 → 271**;
  DST needles **18,096 → 18,096**.
- Independently audited source-colour stitch proximity, source object
  accounting, working colours and max per-mm² needle density did not
  regress in this fixture.

**Conclusion**: native safety and data preservation verified, but
**NO actual machine-trim reduction demonstrated**. The extra DST jump
is recorded explicitly. Keep `STITCH_FORGE_DETAIL_SAFE_ROUTING=0`
in all existing live workers; do not make a physical or commercial
quality claim. This is suitable to retain as an optional engineering
module behind a feature flag, pending a real source-identical Kingfisher
native A/B and a supervised fabric sewout. A green CI result here does
not authorise a Cloud Run traffic switch or Netlify publication.
