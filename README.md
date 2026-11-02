# Sapiver Stitch Forge

**Status as of 2 November 2026: experimental embroidery digitising system; machine-file format tests have passed, but physical stitch quality and detailed artwork likeness are NOT yet approved.**

Stitch Forge aims to turn original artwork into usable, source-faithful machine embroidery. The near-term target is a practical **Home** workflow with accurate shapes and a manageable palette. A higher-detail **Professional** workflow is a separate later research target, **not a current released capability**.

## Start here — current authoritative project status

1. **[Verified progress and engineering roadmap](docs/STITCH_FORGE_PROGRESS_AND_ROADMAP.md)** — current branch/CI evidence, real results, problems, privacy and spending limits, step-by-step work plan, acceptance criteria and release blockers. **Read this first in new development sessions.**
2. **[Master Development Document](STITCH_FORGE_MASTER_DEVELOPMENT.md)** — historical engineering ledger and updated branch-status header. Retain dated results rather than rewriting old milestones as though they were today's result.
3. **[MD-2.66 hybrid engineering handover](https://github.com/sapiverpress-studio/Stitch-Forge/blob/feature/md266-home-hybrid-segmentation-no-deploy/docs/ENGINEERING_HANDOVER_MD-2.66.md)** — experimental Home segmentation, detail recovery, exact CI evidence and native butterfly containment repair.
4. **[MD-2.64 sizing and native acceptance](docs/ENGINEERING_HANDOVER_MD-2.64.md)** and **[MD-2.65 branding and named output](docs/ENGINEERING_HANDOVER_MD-2.65.md)** — previous/main code milestones.
5. **[Contributor and documentation rules](CONTRIBUTING.md)** — repository change, regression and handover standards.

## What has been verified

- The pinned genuine **Ink/Stitch 3.3.0** runtime generates real **PES/DST** in isolated tests. An independent audit decodes stitch commands, verifies source-bound colour masks and checks output validity.
- A detailed-art **Home hybrid** candidate exists on a **separate feature branch**: source-grounded segmentation, limited CIELAB colour palette, guarded edge recovery, source-identity checks and a native path.
- Three CC0 illustrations passed real PES/DST native acceptance on that experimental branch: **macaw 13,031 stitches**, **butterfly 14,348**, **rose 11,623** (counts per file format, PES/DST matching). Source containment passed with **zero out-of-colour needle points and segments**. This says nothing by itself about sew-out quality.
- Butterfly's previously failing crossing stitch was fixed by repairing an eligible invalid rounded SVG fill contour *without relaxing* independent containment checks. **39** source-detail objects remain unresolved in the butterfly.
- The current **main** branch includes a mobile-first artwork workflow, visible embroidered-width semantics, the supplied Sapiver Press logo and a product/design name independent of the upload filename; named ZIP/PES/DST downloads retain original native stitch bytes.

**Independent evidence:** [macaw native CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326236) · [butterfly and rose native CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326194) · [offline regression](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439467534).

## Branch and release separation

| Code stream | Responsibility | Current position |
| --- | --- | --- |
| **main** | Existing website/native integration baseline, including MD-2.65 UI updates | Hybrid Home code **not merged**; live deployed revision not established by this README |
| **feature/md266-home-hybrid-segmentation-no-deploy** | Experimental Home image reconstruction and native tests | Three artwork controls PASS; Kingfisher source-identical native A/B and fabric sew-out **HOLD** |

**Do not infer that a GitHub commit or green CI workflow proves a Netlify deploy, Cloud Run traffic shift, safe sew-out, product release or paid-market readiness.**

## Next engineering move

Run the **owner's original private Kingfisher** through both MD-2.64 and MD-2.66 genuine native PES/DST at the same physical size. Compare actual decoded stitches and likeness of the eye, beak, feather groups, feet and foliage; measure trims, colour fidelity, unresolved details, density and source containment. Preserve the private source outside public GitHub. Then arrange controlled expert **physical sew-outs**. Only after those gates should a guarded worker/site rollout and a small Home beta be considered.

## Non-negotiable controls

- **No merge to main, Netlify deployment, Cloud Run build/traffic change, paid service, release or publication of private owner artwork without explicit authorisation.**
- Native files remain **ENGINEERING-TRIAL-NOT-APPROVED** until physical testing and appropriate review.
- Do not weaken source-containment, byte integrity, input limits, independent auditing or original-source privacy merely to pass CI.
- Prefer standard ChatGPT, pinned open-source tooling and small reversible experiments. Commercial pricing/claims and Professional Detail are deferred until Home quality and demand are measured.

**Full status, risks, test evidence and prioritized phase-by-phase acceptance gates: [Stitch Forge progress and roadmap](docs/STITCH_FORGE_PROGRESS_AND_ROADMAP.md).**
