# Sapiver Stitch Forge

> **Current source integration, 3 November 2026 — MD-2.70 + MD-2.71:** Owner-authorised source and test integration into `main`; this is **not** a Netlify or Cloud Run deployment. The live site and worker must continue using the original **V1 artwork packet**. Full-original PNG V2 has a browser opt-in flag `window.STITCH_FORGE_V2_FULL_SOURCE_ENABLED===true`, which is absent/false by default. High-res analysis, source palette refit and auto satin are experimental and NOT enabled on the deployed worker. In offline genuine PES/DST tests a bounded straight satin source object changed actual stitches; natural macaw and rose selected zero eligible objects. **No improved Kingfisher likeness or fabric sew-out has been demonstrated.** [Source integration and engineering gates](docs/MD-2.71_MAIN_SOURCE_INTEGRATION.md).

> **Historical MD-2.67 release note:** Home hybrid reached GitHub and the owner subsequently confirmed deployment of the MD-2.67 Cloud Run revision to 100% traffic, with a live Kingfisher ZIP showing the `homeHybrid` report. The following original note is superseded by the MD-2.71 source-only status. [MD-2.67 evidence and rollback](docs/MD-2.67_LIVE_HYBRID_RELEASE.md).


**Current engineering status: MD-2.66 hybrid source is integrated into GitHub main, but Home embroidery is still experimental and NOT approved for customer use.** Latest status check: 2 November 2026.

Stitch Forge is a mobile-friendly image-to-embroidery digitiser. The practical target is a Home profile which preserves recognisable shapes and thread colours for real machine embroidery. Advanced Professional Detail is a separate later development target.

## Start here

- **[Complete verified progress, risks and next-action roadmap](docs/STITCH_FORGE_PROGRESS_AND_ROADMAP.md)** — read first in another AI engineering session; includes exact CI, rollout gates, costs, security and private-artwork restrictions.
- **[Master Development Document](STITCH_FORGE_MASTER_DEVELOPMENT.md)** — current engineering status and the complete historical ledger.
- **[MD-2.66 hybrid handover](docs/ENGINEERING_HANDOVER_MD-2.66.md)** — source segmentation, eye/edge recovery, native PES/DST validation, butterfly defect and remaining blockers.
- **[MD-2.64 dimensional/native acceptance](docs/ENGINEERING_HANDOVER_MD-2.64.md)**; **[MD-2.65 logo and named downloads](docs/ENGINEERING_HANDOVER_MD-2.65.md)**; **[Contributor rules](CONTRIBUTING.md)**.

## Actual implementation

The existing website has a mobile-friendly generation workflow, the supplied Sapiver Press logo, a separately editable product filename, named ZIP/PES/DST downloads, and visible-design-width sizing. Native file bytes retain their independent validation and signed source binding.

The repository also includes real Ink/Stitch 3.3.0 PES/DST generation and source-colour containment auditing, plus MD-2.66 experimental SLIC/CIELAB segmentation, source-grounded detail guards and precision-safe SVG fill repairs. **The MD-2.66 code is now on main, but there is no evidence that the current public website or Cloud Run entrypoints invoke this hybrid automatically. A GitHub merge alone does not activate it.**

### Genuine native test evidence — isolated engineering trials

| Licensed fixture | PES / DST stitches (matching per format) | PES trims | Unresolved detail | Colour containment |
| --- | ---: | ---: | ---: | --- |
| Macaw | 13,031 | 98 | 1 | 0 outside-colour points/segments |
| Butterfly | 14,348 | 205 | 39 | 0 outside-colour points/segments |
| Rose | 11,623 | 68 | 0 | 0 outside-colour points/segments |

Reports: [Macaw](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326236) · [Butterfly and Rose](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326194) · [Final offline regression](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439467534).

These are genuine machine files but **not approved as safe or satisfactory on fabric**. The Kingfisher source-identical MD-2.64/MD-2.66 native comparison and controlled physical stitch-outs remain unverified. No sale/free-public-release quality claim is supported.

## Main is not the same as live deployment

**GitHub main source has been updated at owner request. Neither Netlify nor Google Cloud was deployed as part of this merge.** The last independently observed Netlify production deploy on 2 November 2026 ran source commit `3cd91d895b864f034528c0ee8f119e629f7ea794` (07:30 UTC), predating the current code. Current Cloud Run traffic/revision must be checked in the owner's Google Cloud account; historic 95/5 traffic documentation is not proof of the present state.

The MD-2.66 feature branch remains available for provenance: [feature/md266-home-hybrid-segmentation-no-deploy](../../tree/feature/md266-home-hybrid-segmentation-no-deploy).

## Next hard gates before deploying the hybrid to users

1. Trusted local private original Kingfisher PES/DST on MD-2.64 and MD-2.66 at identical physical size, comparing actual decoded stitches, eyes, beak, feathers, greenery, colour matching and trim/density.
2. Address detail losses without creating fake source features or weakening independent audit; rerun macaw, butterfly and rose native CI.
3. Expert, documented fabric stitch-outs on specified home machines and materials.
4. Owner-approved 0%-traffic Cloud Run release candidate and confirmed Netlify site SHA, with rollback; then a small supervised Home beta. Professional Detail comes after Home quality is independently demonstrated.

**No automatic deploy, traffic promotion, experimental Home activation, paid cloud build, public customer release or publication of private source art is authorised by the GitHub merge.** All outputs remain engineering trials until the above quality gates.
