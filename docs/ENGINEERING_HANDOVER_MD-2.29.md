# Stitch Forge engineering handover — MD-2.29 (2026-10-29)

**Active branch:** feature/detailed-embroidery-analysis-no-deploy.
Parent branch checkpoint before this work: 7ad44960ae95420e28ea5be223f96fc91133d714.
This handover and source are in the same atomic feature-branch commit.
No Netlify deployment, branch merge, PR update, hosted request or paid infrastructure.

## New verified foundation
- Added services/digitiser/compound_geometry.py: pure Python, stdlib-only, 0.001mm-precision validation for a filled outer ring and up to 16 disjoint interior holes.
- Rejects malformed, degenerate, self-intersecting, out-of-bounds, intersecting, nesting or touching rings; caps 512 points/ring and 2048 points per compound; checks after export rounding.
- Produces deterministic *preview path data* using even-odd rings without converting a hole into white thread.
- Six local synthetic tests pass (tests/test_compound_geometry.py). The exact local result is captured in docs/test-evidence/MD-2.29-compound-topology.txt.

## Explicitly NOT integrated
This is a geometry/topology acceptance primitive, **not machine-ready compound embroidery**.
Do not feed generated preview path data into Ink/Stitch until the official engine has
been proven to generate unsewn openings by independent stitch-coordinate audit and a
physical test. No browser persistence/editing, undo, JSON schema, layer ordering,
colour handling or generated PES/DST logic has been changed. Current unsupported
holes still fail closed in the automatic reconstruction path.

## Next priorities
1. Run the previously blocked real Ink/Stitch regression on a suitable zero-cost runner
   using the pinned engine and existing synthetic fixtures. Do not weaken extent gates.
2. Implement versioned outer/holes/components/parent-layer JSON and full UI persistence,
   edit/undo and geometry-only proxy, reusing compound_geometry.py validation on the worker.
3. Verify native Ink/Stitch compound-path semantics and actual stitch gap against masked
   synthetic donut and letter test cases; only then permit machine-side holes.
4. Design independently validated satin rails, rungs, underlay and direction controls;
   finally physically stitch out on specified hoop/fabric/stabiliser.

## Evidence boundaries
MD-2.28 historical: 55 Node + 77 Python tests passed; not rerun here.
MD-2.29 new: six Python stdlib topology tests passed, no skips.
No direct Netlify call, PR change, native engine call, physical stitch-out or paid AI call.
Dependencies: Python standard library; no added licensing dependencies.
