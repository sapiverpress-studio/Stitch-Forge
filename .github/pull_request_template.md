# Stitch Forge — pull request checklist

## Scope
- Task IDs (from [master MD](../STITCH_FORGE_MASTER_DEVELOPMENT.md)):
- What changed and why:
- Affected files and possible regressions:
- Why this approach rather than simpler alternatives:

## Evidence
- [ ] Inspected existing behaviour first
- [ ] Browser tests run (command + result below)
- [ ] Independent format decoding run (command + result below), if applicable
- [ ] Actual physical stitch-out tested (record/sample ID) **or** clearly marked NOT TESTED
- [ ] Malformed/hostile SVG and oversized images considered, if relevant
- [ ] Upstream licence/compatibility implications documented

**Test commands and outcomes:**

**Known failures and tests not run:**

**Physical stitch-out status:** UNTESTED / PASS / FAIL, with evidence link.

## Master document
- [ ] Updated **STITCH_FORGE_MASTER_DEVELOPMENT.md** in this PR when changing code, dependencies, fixtures, engine, tests, release status or project scope
- [ ] Updated exact task statuses and acceptance evidence
- [ ] Added dated work log entry and affected decisions/risks
- [ ] No unsubstantiated "production-ready" claim

## Delivery
- Deployment state: **None** unless explicitly authorised, with approval:
- Etsy publishing state: **None** unless explicitly authorised, with approval:
- Rollback plan:
- Next task:
