# Contributing to Sapiver Stitch Forge

This project builds **machine instructions**, not merely graphics. The working code must never claim machine safety or stitch quality from on-screen simulation alone.

## Before any work

1. Read [STITCH_FORGE_MASTER_DEVELOPMENT.md](STITCH_FORGE_MASTER_DEVELOPMENT.md) and inspect the current target branch before editing.
2. Identify task IDs, actual requirements, risks, relevant tests and affected files.
3. Work in a separate development branch and preserve known-good behaviour.
4. Avoid changes to external Sapiver Press products, marketplaces, automations or live sites unless independently authorised.

## Mandatory update rule

**Every substantive code, fixture, integration, dependency or test change MUST update the master MD in the same pull request:**

- Section 2: actual delivered capabilities and regressions.
- Section 8–9: affected milestones and task statuses, using the defined vocabulary.
- Section 10: real tests, commands, environment, evidence and limitations.
- Section 11–12: changed risks and architecture decisions.
- Section 13: dated entry with branch, commit/PR, changed files, tests run/not run, deployment state, next action.

A docs-only change may still need a dated entry if it revises scope or decisions. Do not change TODO to DONE-VERIFIED until evidence exists.

## Code review checklist

- [ ] Source files inspected before changing working behaviour.
- [ ] Scope matches task IDs; reversible if it fails.
- [ ] Inputs validated and malicious SVG/raster files handled without executing active content.
- [ ] Machine dimensions, physical units, formats and limitations clearly disclosed.
- [ ] Browser/mobile regression tests actually run.
- [ ] Generated file read-back tests actually run using an independent decoder.
- [ ] Real stitch-out evidence attached **if** making any production-quality claim.
- [ ] Upstream licence notices, dependency versions and security considerations updated.
- [ ] Master MD task ledger, test evidence and dated log updated.
- [ ] No deployment, public release or retail listing occurred without explicit authorisation.

## Suggested development and release workflow

- `main`: documented stable project baseline; not synonymous with retail-ready.
- `develop/stitch-engine-foundation`: initial prototype import and modular engine work.
- Feature branches for changes, reviewed via PR. No force push or branch deletion as routine workflow.
- CI required for modules when added. A green CI result alone does **not** approve physical machine use.
- Tag engineering previews explicitly as experimental. Only a verified design+size+material+machine combination can be called stitch-tested.

## Documentation quality

Write what happened, not what was intended. Link verifiable commit SHAs, report fail cases and distinguish structural file validity from fabric results. Never overstate a newly installed dependency as a working integration.

No scheduled monitoring/automatic daily document update is configured; this is an **update-on-development** policy, not a background agent.
