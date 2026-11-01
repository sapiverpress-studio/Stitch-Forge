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
