# MD-2.35 — realistic artwork attempt (not accepted)

Date: 2026-10-29 (Europe/London)

## Source and privacy

- One private kingfisher artwork from Jim's Library, 1353 × 1163 px.
- The original and overlay stayed outside the repository.
- No external AI, OpenAI request, hosted worker, or paid inference was used.

## Process and result

Ran the existing deterministic OpenCV `extract_detail_guides` on the complete source at a nominal 100 mm design width:

| Input | Result |
| --- | --- |
| 1353 × 1163 px | Refused: `Edge map too complex for safe review extraction` |
| 1000 × 860 px | Refused by the same 45,000-edge guard |
| 768 × 660 px | Returned the configured maximum of 220 edge guides |

The 768 px result totals about 5693 mm of guide length, with a 17.69 mm median and a 122.91 mm longest guide. Visual review shows dense traces across feather texture, body shading, blossoms, leaves and the branch.

## Acceptance assessment

**FAIL as detailed-art reconstruction.** The output consists of unlabelled edge traces, not separate colour regions, semantic features, stitch types, satin rails, fill boundaries, layer order, or a complete stitch plan. It has no art-preservation metric and was not sent to Ink/Stitch. No PES/DST was made from this art.

The private overlay is `kingfisher-guides-overlay.png` in the local `private-artwork/kingfisher-guide-evaluation/` directory. It is intentionally not tracked by Git.

## Engineering consequence

The current edge-guide extractor cannot handle this realistic high-detail source at its original resolution. Resizing below its complexity limit produces a capped, noisy set rather than a validated reconstruction. A proper color-region reconstruction and explicit detail-pruning/evaluation strategy is still required; do not raise the edge cap or feed this output directly to the machine engine.
