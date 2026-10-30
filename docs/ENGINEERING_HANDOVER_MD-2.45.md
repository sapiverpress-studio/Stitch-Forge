# Stitch Forge — MD-2.45 source graph and working likeness

Date: 2026-10-29, Europe/London. Owner approved the next engineering phases in the existing Work session and clarified the target: **a high-quality likeness, not perfection**. Important shapes/colours/markings should survive; fine shading and texture may be simplified. Do not mistake exact reference storage for a requirement to embroider every pixel or shade.

## State

- Branch `feature/reconstruction-root-cause-md242`, parent `e9c680a20651121cab2f0febc57922e47e33531a` (MD-2.44). This milestone is committed locally; obtain the exact SHA from Git.
- No push, PR, merge, deployment, hosted worker, paid model, infrastructure or secret change. GitHub main last verified `033234cde699644048598cee65bb166bdb3191ea`; production last verified MD-2.40. The deployment-trigger restriction remains. Every commit contains `[skip netlify]`.
- Native source-derived compound/satin controls from MD-2.44 are still available. They were not rerun in MD-2.45 because this phase changes only source analysis/inspection; do not describe them as a new engine run here.

## Implemented in the actual app

`site/source-region-graph.js` builds a four-connected source-colour graph directly from original analysis RGBA. The 5-bit RGB bins are reference subdivisions, **not thread colours**. Efficient labelled RLE preserves every selected source pixel with 200,000-run, 30,000-node and 100,000-adjacency budgets. Refusals do not discard caller pixels. Nodes have stable source-hash/bin/first-pixel IDs, geometry, colour ranges, boundary evidence and explicit small-detail flags. Actual shared-edge adjacency is rederived on load.

Working colour selection is still capped at **12**. Weighted colour coverage replaces simple top-frequency selection, with up to four centres reserved for small contrasting candidates. Bounded colour refinements are evaluated against a baseline node palette. A tiny colour interpolating between adjacent contrasting colours is labelled a *possible boundary blend*, not definitively noise. Its node is retained. Generic source contrast does not identify an eye, vein or feather semantically.

`source-region-project.js` adds `stitch-forge-source-region-project-v2` with the graph and working masks. V1 create/read support remains for historical evidence and existing synthetic engine controls. The actual app's free inspection button now calls `createGraphDraft`. New and legacy saved projects are rechecked against the actual same source pixels when reopened, including rederived geometry/colour evidence, not merely a matching user-supplied hash. Source inspection still blocks legacy playback and machine export. The paid “Reconstruct embroidery automatically” button still uses the earlier model-coordinate workflow; it has **not** been replaced or proven fixed end-to-end by this phase.

`tests/test_source_region_graph.cjs` covers a genuinely automatically extracted one-pixel eye control, disconnected parts, holes, adjacency, deterministic IDs, physical resize, malicious metadata, stale/corrupt evidence, budget refusal and unchanged source input. The tiny eye's actual colour survives in the working palette without increasing the 12-slot budget.

## Measured licensed-PNG results

Same existing CC0 butterfly/macaw/rose PNGs, no source SVG boundaries, AI call or private image publication. Actual new source geometry, not hand-authored ideal polygons.

| Input | Previous pixels >RGB distance 60 | New | Mean RGB distance before → new | Reference nodes | Working pieces |
|---|---:|---:|---|---:|---:|
| Butterfly | 1,973 | 839 | 6.36 → 8.17 | 7,985 | 6,208 |
| Macaw | 27,581 | 6,118 | 29.13 → 25.44 | 3,520 | 1,199 |
| Rose | 57 | 12 | 5.75 → 7.11 | 1,679 | 1,180 |

These are colour-error measurements, **not likeness scores** or thread calibration. Some average shading fidelity worsens while large colour errors decline and small contrast candidates get attention. All 193,187 / 157,119 / 202,807 selected pixels remain in reference nodes and working geometry, with exact mask/ring roundtrip and save/load/resize checks. Foreground/partial-alpha exclusions are unchanged. Internal same-colour holes may disappear when shading regions share a working colour; transparent source voids remain preserved by exact selected-foreground accounting.

The initial rule overflagged antialiased colours as important tiny markings. A bounded interpolation check now records likely boundary blends separately. Still unresolved: butterfly 132 protected-colour and 102 contrast checks; macaw 105 and 53; rose 0 and 0. These are unverified candidates, **not confirmed missing biological features**. No human likeness rating, semantic reconstruction, realistic-art machine file or sew-out is verified.

## Executed evidence

- Native Node suite: **137 pass, 0 fail, 0 skipped**; includes six new graph tests and the existing exhaustive topology matrix.
- Chromium: **9 pass, 0 fail, 0 skipped**, desktop/mobile. Actual app graph inspection, same-image reopening, private diagnostics, export blocks, all three licensed rasters, a contrasting-eye control and actual old/new offline comparisons.
- `tools/evaluate_region_graph.cjs` / `tools/build_region_graph_proof.py` generated `docs/test-evidence/MD-2.45-working-likeness/Working_Likeness_OFFLINE.html`. It shows original | previous working approximation | new working approximation, with the same 12-colour ceiling and honest loss/uncertainty metrics. PNGs/SVGs, source graph projects and reports are adjacent. No fake stitch panel.
- Existing Netlify build command already includes the new tests and source syntax automatically. No Netlify operation was run.

## Exact next phase

Implement **bounded topology-aware grouping of tiny possible boundary blends**, keeping reference nodes unchanged. A one-step reassignment may simplify a tiny blend toward a directly adjacent stable colour; never propagate across a chain, remove selected source pixels or overwrite a protected contrasting feature. Report changed pixels, colour trade-offs, component reduction, source-size/physical displacement and unresolved checks. This is an explicit working approximation, not a claim of noise identification.

Do not remove the existing machine/AI fidelity guards to get a passing file. Follow with source-ID stitch-intent and physical narrow-region analysis; preserve the local native bridge and independent audit. Whole-art digitising remains incomplete. Continue from MD-2.44 for native setup and its exact tests, rather than reinstalling or repeating the full investigation.
