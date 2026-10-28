# STITCH FORGE — MASTER DEVELOPMENT DOCUMENT (MD)

> **Single source of truth for scope, progress, decisions, testing, risks and next actions.**
> This is a living document. Update it **in the same commit/PR as each material code, test, architecture or release change**. A feature is not complete until its test evidence and status here are current.

| Field | Current value |
| --- | --- |
| Project | Sapiver Stitch Forge |
| Repository | https://github.com/sapiverpress-studio/Stitch-Forge |
| Maintainer | Sapiver Press |
| Document version | MD-1.2 |
| Last updated | 2026-10-28 (Europe/London) |
| Last independently checked source | Local standalone prototype v0.3 + test logs, 2026-10-28 |
| Default branch | `main` |
| Development branch | `develop/stitch-engine-foundation` (created and confirmed 2026-10-28) |
| Product stage | **Research and prototype — NOT production ready** |
| Intended audience | Internal designer initially; future embroidery creators only after market and safety validation |
| Authorised deployment | **None** |
| Authorised Etsy listing | **None** |
| Physical embroidery stitch-out passed | **NO — not performed** |
| External Ink/Stitch or pyembroidery integration | **NOT implemented** |

## 0. How to read and maintain this MD

**Status vocabulary is mandatory:**

- **DONE-VERIFIED**: code or asset exists in the repository and acceptance tests have been run with recorded evidence. This does *not* imply real-machine approval.
- **PROTOTYPE-TESTED**: experimental local prototype or browser test demonstrated the behaviour, but it is not integrated into the repo's release architecture.
- **IN-PROGRESS**: work exists but acceptance criteria not met.
- **TODO**: designed or specified, not implemented.
- **BLOCKED**: cannot responsibly progress without named decision, test, dependency or resource.
- **DEFERRED**: explicitly outside present release scope.

**Non-negotiable rules:**

1. Never change a task to DONE-VERIFIED based solely on visual inspection, a model assertion, screenshots, a simulated stitch-out or a plan.
2. Keep three independent checks: **browser/UI**, **machine-file structure**, **real fabric stitch-out**. State which actually passed.
3. State dates, commit SHAs, reproducible commands, output/sample IDs, failure conditions and unresolved issues where available. If unknown, use **UNKNOWN**.
4. Update Section 9 (task ledger), Section 10 (test evidence), Section 12 (decision log) and Section 13 (dated work log) as applicable **with every substantive code change**.
5. If a feature is reverted, regression fails or new risk is discovered, immediately demote its status and record the reason.
6. Do not modify existing Sapiver Press sites, Pattern Forge, live listings, Etsy SKUs, fulfilment integrations, automations or production deployments without separate authorisation.
7. Avoid claiming that design exports are safe to use in a machine or suitable to sell until Gate G5 (physical verification) has passed for the **specific design, size, settings and material**.
8. Keep this document on the active branch current and merge it into `main` with the feature; avoid parallel contradictory roadmaps.

---

## 1. Mission and definition of success

Build a professional-capable, **touch-first and desktop-friendly embroidery digitiser** that turns original artwork into editable embroidery regions and machine instructions, without presenting automated artwork tracing as a substitute for professional digitising. Prioritise high-quality physical embroidery over feature count and export-format badges.

### 1.1 User journey, in the intended order

1. On Android or desktop: open a real project with an accessible, uncluttered editor; controls visible adjacent to the live stitch preview.
2. Import **PNG, JPG, SVG**, including SVGs that contain raster images; securely identify raster versus vector content and retain a visual reference.
3. Set physical embroidery dimensions and **actual hoop/machine constraints** in millimetres.
4. Extract or draw/edit regions (silhouette, borders, details, lettering); explicitly inspect all automatically inferred shapes.
5. Choose region-specific **running, bean, satin, tatami/fill** and sequencing properties with sensible warnings rather than hidden choices.
6. Generate an actual stitch plan and simulate the real **STITCH/JUMP/TRIM/COLOR_CHANGE/STOP/END** commands (as supported), not an animation of the original picture.
7. Inspect density, short stitches, jumps, thread count, stitch count, long travel and overlapping regions; revise.
8. Export independently verifiable machine files and a truthful thread chart in a reproducible ZIP.
9. Test on fabric, record machine/material/stabiliser/thread/needle/hoop and defects; revise until physical test passed.
10. Only then consider a retail listing. The original project must remain editable, with source provenance and licence.

### 1.2 Not success

- A PNG renamed .PES; automatic contour tracing with no interior design; a plausible stitched-looking image; a binary file that merely decodes; a format claiming compatibility with every machine; or a ZIP produced without design-level quality control.
- Generating the same stitches at five different dimensions without re-digitising and reviewing densities, widths and underlay.
- Integrating an upstream open-source project without testing, licence compliance or secure processing.

### 1.3 Initial scope vs later scope

**First reliable deliverable:** one-colour linework, one design size, editable paths, simulation, valid PES and DST, independent decoder comparison, real stitch-out. This is the first release gate — not a commitment that all professional features are done.

**Professional scope:** multi-region and multi-colour artwork; stitch families and parameter editing; underlay/compensation; route optimisation; stitch-plan inspection; format-specific export; versioned project saves; machine profiles; real machine/fabric test records.

**Not an immediate goal:** a full alternative to Wilcom; all machines/legacy formats; cloud accounts, payments, Etsy publication or commercial subscription platform.

---

## 2. Current verified baseline (2026-10-28)

### 2.1 Repository state

- **Confirmed:** repository `sapiverpress-studio/Stitch-Forge` exists, was initially empty, and is publicly visible with default branch `main`.
- **Confirmed:** initial README committed as `7e3e9cc230acf0248f2808e36d131b984993aafa`.
- This document is being added as a **new project baseline**, not evidence of an implemented engine.
- **Confirmed:** experimental v0.3 is preserved on development branch at `prototypes/stitch-forge-v0.3.html` (commit `d7a319d565a43632299a5e476584bbdbe33a7e8e`). Its Git blob SHA `be29a022390194a3670fa0d29561b4bda78e20be` matches `git hash-object` of the original local file. It has **not been merged into main**.
- **Confirmed:** [draft PR #1](https://github.com/sapiverpress-studio/Stitch-Forge/pull/1) is open for this preserved prototype. It changes the experimental HTML and branch-specific MD only. No workflow runs or commit status checks were returned at the time inspected; therefore the documentation gate is implemented but **not yet execution-verified**.
- **CI infrastructure update (2026-10-28):** `.github/workflows/test-prototype.yml` is installed on `main` (commit `568711b8d1e4d818250ac8390838ef200f868ddc`) as well as the development branch, so subsequent pull-request synchronisations can discover it from the default branch. A verified completed GitHub Actions run is **still missing**; do not mark the project CI-green.

### 2.2 Experimental application: v0.1 → v0.3

| Capability | Demonstrated state | Evidence and qualification |
| --- | --- | --- |
| Responsive editor / mobile layout | PROTOTYPE-TESTED | Local Chromium mobile browser tests, October 28 |
| Drawing/moving path points and project saves | PROTOTYPE-TESTED | Local browser interaction tests in v0.1–v0.2 |
| Play/pause/next/restart/speed/seek beside canvas | PROTOTYPE-TESTED | v0.2 browser tests; addresses user's mobile feedback |
| Simple SVG vector outline import | PROTOTYPE-TESTED | v0.2 and v0.3 Chromium tests |
| PNG/JPG raster reference import | PROTOTYPE-TESTED | v0.3 test log; a silhouette is inferred, not interior detail |
| Embedded-raster SVG import | PROTOTYPE-TESTED | User's `Tiles _20261028_062147_0000.svg` imports in local v0.3 |
| Running and triple-bean paths | PROTOTYPE-TESTED | v0.3 local generator/decoder runs |
| Basic scanline/tatami-like fill | PROTOTYPE-TESTED | **EXPERIMENTAL**: routing, density and quality NOT approved |
| Region-specific stitch mode choice | PROTOTYPE-TESTED | Limited region model in v0.3; no proper satin support |
| Underlay option | PROTOTYPE-TESTED | Basic algorithm flag, NOT fabric-validated |
| PES / DST binary writing | PROTOTYPE-TESTED | Independent decoding against planned commands, local |
| ZIP with PES, DST, source SVG, project JSON, warnings | PROTOTYPE-TESTED | ZIP integrity and local test export |
| Ink/Stitch processing integration | IN-PROGRESS | Restricted CLI adapter and mocked tests committed; actual engine runtime NOT installed or executed |
| pyembroidery as integrated output validator | IN-PROGRESS | Pinned 1.5.1 and external reader tests staged; real library not available in local test environment; no GitHub CI run verified |
| Colour-separated artwork + correct colour change commands | TODO | Not present |
| Professional satin columns, densities, tie-ins/out, trims | TODO | Not present |
| Real-machine compatibility / physical stitch-out | BLOCKED | No stitch-out evidence or machine/service attached |
| Retail-ready embroidery designs | BLOCKED | Cannot approve until physical QA and licensing/policy checks |

**Measured examples (not product benchmarks):**
- Built-in fox v0.3 initial: **207 needle stitches**, **18 jumps**, decoded design extent **78.0 × 55.2 mm**.
- User moth embedded-raster SVG: silhouette traced from a **447 × 262 px** raster, **187** needle stitches and **3** jumps in outline mode; **2,082** needle stitches and **143** travel jump records in experimental tatami mode (settings vary).
- Raster reference imports **do not** preserve or digitise internal feather, wing and colour regions. The source moth SVG is an example of why full-artwork support remains incomplete.
- v0.3 sample ZIP held five files and passed `zipfile.testzip()` in the local test.
- v0.3 standalone file provenance (locally verified; matched against Git blob on development branch): SHA-256 `dd67aee3292ccc6ca770e79ecfb78738ca8965197c94301c24bc5f6a5d81d886`, 61,967 bytes. This is **not** a repository path/commit until separately imported.
- Independent binary decoding was reported in previous prototype testing. This is **not** equivalent to a successful physical machine test.

### 2.3 Confirmed limitations and defects

1. **Critical:** the moth becomes an external contour; detailed internal pattern and colours are lost. Requires raster segmentation, manually editable embroidery regions and independent colour plans.
2. **Critical:** scanline fill is a proof of concept; jump count, routing and stitch parameters require professional algorithms and physical testing.
3. **Critical:** no satin column construction, tie-ins, tie-offs, real trims, robust colour changes, pull compensation or material-specific settings.
4. **Critical:** no external engine is integrated; our prototype currently writes custom PES/DST directly. Need trusted read-back validation.
5. **Critical:** physical machine results, compatible hoop/machine combinations and retail quality are UNKNOWN.
6. **High:** one-file browser architecture is fragile; needs source modules and automated tests without changing behaviour.
7. **High:** limited SVG parsing; unsupported forms must fail safely without destroying an open project.
8. **High:** local HTML is awkward on Android. A test deployment may be useful, **only if authorised**; do not assume a production deployment.
9. **High:** licence/attribution, data handling and commercial distribution review for dependencies remains open.
10. **High:** drawing on the canvas, selecting regions and configuring stitches must remain practical on a small screen.

---

## 3. Detailed product requirements

Requirements here are contracts, **not claims of implementation**. Link each implementation/PR to its requirement ID and tests.

### 3.1 Import and project management

- **FR-001 — Input:** PNG, JPG, simple vector SVG, embedded-raster SVG. Validate MIME/magic bytes, pixel size, SVG size and allowed elements; sanitise external references, scripts and active content.
- **FR-002 — Reference layer:** keep source artwork in an immutable, toggleable layer with opacity/zoom; never silently discard source details.
- **FR-003 — Tracing:** adjustable threshold, background removal preview, multiple contours/holes, noise cleanup and a clear distinction between auto-detection and manually verified regions.
- **FR-004 — Region editor:** draw, split, merge, reorder, rename, lock/hide, duplicate and nudge each region; editing handles must not obscure work on Android.
- **FR-005 — Save:** explicit project schema/version, all geometry/settings/reference metadata, backwards-compatible migrations, import/export, integrity checks, user-readable errors.
- **FR-006 — Undo/redo:** safe history for drawing, changes and imports; failed imports never corrupt current project.
- **FR-007 — Scale:** physical millimetres, aspect lock, actual embroidery bounds and hoop margin; re-digitise from editable source when changed.
- **FR-008 — Device:** reliable Android Chrome touch handling, pinch zoom/pan, responsive portrait/landscape, keyboard and mouse support, accessible controls.
- **FR-009 — Recovery:** autosave only with clear local-storage limits/privacy notice and manual export; do not silently lose projects.

### 3.2 Stitch generation and editability

- **FR-010 — Running/bean:** adjustable stitch length and repeat count with corner handling and jump/travel control.
- **FR-011 — Satin:** genuine satin columns with rails/rungs, width-aware switching/splitting, travel and edge correction; not a decorative line effect.
- **FR-012 — Fill:** tatami/other appropriate fill algorithm with holes, row direction/angle, stitch density, offset and routing.
- **FR-013 — Underlay:** per-region options (centre walk, edge run, zigzag, etc. as suitable), adjustable order and density.
- **FR-014 — Fabric behaviour:** pull compensation and warnings, plus selectable fabric/stabiliser presets that are documented and physically validated.
- **FR-015 — Routing:** sequence regions, limit travel jumps, manage colour blocks, optional user overrides, avoid unintended stitches.
- **FR-016 — Thread handling:** explicit colour palette and ordered thread list; generate proper colour-change, trim, tie-in/tie-off commands where supported.
- **FR-017 — Manual stitch edits:** select/add/remove/re-route individual stitches or travel segments without silently converting the project to a flattened irreversible design.
- **FR-018 — Diagnostics:** detect suspiciously tiny/long stitches, excessive density/overlap, hoop collisions, unsupported commands and stitch counts; warnings must be specific and inspectable.
- **FR-019 — Simulation:** render *actual generated stitch commands*, with speed, pause, step, scrub, overlay, needle position, jump/trim/colour indicators and counts.

### 3.3 Exports and testing

- **FR-020 — Reliable PES/DST:** export from one canonical stitch plan, then re-import via a **different** decoder and compare coordinates, commands and extents within documented format tolerances.
- **FR-021 — Other formats:** evaluate JEF, EXP, VP3 and XXX via pyembroidery, per format version and target machine; do not label them verified merely because a writer exists.
- **FR-022 — Thread chart:** stitches, colour order, approximate thread lengths if correctly computed, hoop size, final bounding dimensions, trims/jumps and format warnings (e.g. DST colour limitations).
- **FR-023 — Export safety:** never silently rescale beyond selected hoop; check out-of-range moves, overflow, non-finite coordinates, empty designs and invalid colour sequences.
- **FR-024 — ZIP:** deterministic file naming, manifest/project version, supported machine files, instructions, preview, tests/warnings, licence; integrity check.
- **FR-025 — Approval gate:** classify each export as UNTESTED / STRUCTURALLY VERIFIED / STITCH-TESTED; restrict retail-ready label to the latter with sample-specific evidence.
- **FR-026 — Reliability:** progress/error feedback, resource limits, cancellation and no false success; CI tests, fixtures and regression coverage.
- **FR-027 — Provenance:** record origin and licensing of artwork, open-source dependencies, digitiser settings, software version and test evidence.

---

## 4. Proposed architecture (decision pending spike)

```text
Touch-first browser UI (React/Vite or lean TypeScript; choose after inspection)
  - project model and migration
  - source artwork / regions / reference layers
  - stitch controls, preview and editing
          |
          | validated versioned project and SVG region data
          v
Isolated digitising service (Python container; access controlled)
  - Ink/Stitch integration candidate (headless CLI / supported workflow)
  - stitch-plan generator, region parameter validation
  - task limits, timeouts, temporary workspace isolation
          |
          | canonical machine command plan
          v
Independent validation and format layer
  - pyembroidery reader/writer candidate
  - machine-format capability matrix and read-back validation
          |
          v
Export manifest + ZIP + QA state
          |
          v
Human machine/fabric test approval before sale
```

**Architecture principles:**
- Keep the browser app responsive; heavyweight digitising and image processing run in a controlled worker/service. No unsupported claim of a browser-native Ink/Stitch port.
- First refactor existing functional code under tests; do not replace the app stack simply because a new framework is fashionable.
- Project document must be versioned and portable. Original editable geometry is source of truth; embroidery format files are lossy derivatives.
- Avoid dependencies on Sapiver Press or Pattern Forge production systems. Reuse original artwork by import, not by sharing mutable application state.
- Prefer pinned upstream releases, a software bill of materials, licence inventory and automated dependency checks over blindly copying third-party repositories.
- Deploy via separate staging only with approval. Never put a public unauthenticated server-side digitising endpoint online without rate limits, file validation and isolation.
- Commercial distribution under mixed licences requires careful review: Ink/Stitch is GPL-family; pyembroidery is MIT. **Server-side separation does not automatically settle licence questions**; get legal/licence review before redistribution.

### Candidate stack — to evaluate, not yet installed

| Component | Candidate | Evidence to obtain |
| --- | --- | --- |
| Visual editor | existing HTML prototype → modular TS, SVG/Canvas | Interaction regression test on Android/desktop |
| Embroidery generator | https://github.com/inkstitch/inkstitch | Pin release; prove supported command-line API with known fixtures |
| Format support / verification | https://github.com/EmbroidePy/pyembroidery | Confirm package version, supported writers, independent round trips |
| Tests | pytest + Playwright / Chromium | CI and local parity, reproducible logs |
| Runtime | local-first dev + containerised Python service | Dockerfile, permissions, dependency lock, resource safeguards |
| Hosting | undecided | Need cost/security/latency decision and explicit deployment approval |

Reference: https://inkstitch.org/docs/command-line/ and https://github.com/EmbroidePy/pyembroidery .

---

## 5. Test strategy — evidence, not appearance

### G0 — Repository and provenance

- Reproducible source tree; pinned dependency manifest; README; master MD; licence notice; no secrets.
- CI knows exactly which tests it runs and records commit SHA. No status "verified" without output.

### G1 — Frontend / import (automatable)

- Mobile 360/393 px and desktop; portrait and landscape; touch drag/pinch; control visibility near canvas.
- Import ordinary vector SVG, PNG, JPG, **the user's embedded-PNG moth SVG**, malformed file, oversized raster and SVG with script/external URL.
- Assert failed imports preserve working project; original reference remains visible; auto-traced outlines do not masquerade as colour digitisation.
- Save/reload/export project; undo/redo correctness; size/hoop error messages; offline/local handling.

### G2 — Stitch planning (automatable)

- Canonical command types, counts, bounds, no NaN/Infinity, no accidental long stitches, hole/overlap and travel policies.
- Geometry fixtures: open line, closed polygon, donut/hole, acute corner, satin rails, multicolour shapes, thin strokes, nested contours, tiny features.
- Visual regression only as secondary evidence; primary checks assert generated needle commands and their geometry.

### G3 — File structure (automatable)

- Cross-decode generated files with an independent reader (prefer pyembroidery). Compare commands, extents, colours and travel.
- Check format-specific tolerances and known-lossy conversions; unsupported commands must produce explicit warnings.
- Test PES, DST initially; add JEF/EXP/VP3/XXX to a **separate** format-compatibility matrix with version and sample.

### G4 — Security/performance (automatable and reviewed)

- SVG sanitisation; reject scripts/foreignObject/external resources; image decompression bombs; path complexity limits; ZIP-slip protection.
- Uploads processed in isolation with size/time/memory quotas; no shell interpolation; no exposing source artwork without consent.
- Test adverse large images, huge path lists, malformed encoding, cancellation, parallel requests and private session isolation.

### G5 — Physical stitch-out (mandatory human validation)

For every release candidate *design+size+machine/material profile* capture:

| Field | Required record |
| --- | --- |
| Design/sample ID + source commit | exact immutable revision and exported file hash |
| Machine + firmware + hoop | brand, model, firmware if known, compatible hoop |
| Material/stabiliser | woven/knit, weight, backing/topping and hooping approach |
| Thread/needle | brand/type/size where relevant |
| Stitched dimensions | measured W × H, comparison to planned |
| Defects | pull, puckering, looping, density, thread breaks, gaps, misregistration, excess trims |
| Photo/evidence | real unedited photo and operator notes |
| Result | PASS / FAIL; corrections and re-test |
| Approver + date | named reviewer and date |

Do not claim all formats/machines work based on one sample. Publish a truthful tested-compatibility scope.

### G6 — Commercial/marketplace release (explicitly separate authorisation)

- Original artwork rights and upstream licences reviewed; Etsy current AI/craft-pattern and authentic-photo rules checked directly at time of listing.
- Test stitch photo, product instructions, formats, hoop and actual sizing disclosed.
- Retail ZIP checked on buyer-like clean device; refund/support obligations understood.
- No automatic Etsy publication or PrintShrimp connection.

---

## 6. Target project structure (proposal)

```text
/
  README.md
  STITCH_FORGE_MASTER_DEVELOPMENT.md
  CONTRIBUTING.md
  .github/
    pull_request_template.md
    workflows/ (tests and documentation compliance later)
  prototypes/
    stitch-forge-v0.3.html     # experimental baseline; NOT production
  apps/
    editor/                    # touch-first browser UI
  services/
    digitiser/                 # isolated Ink/Stitch integration
  packages/
    project-schema/            # canonical project + migrations
    stitch-model/              # canonical command and geometry contracts
    format-qa/                 # independent read-back / compatibility
  tests/
    fixtures/
      safe-vectors/
      raster/
      adversarial/
    e2e/
    embroidery/
  docs/
    licensing/
    architecture/
    test-evidence/
    release-checklists/
```

Do not create empty decorative folders or claim an implementation exists because its target directory is listed above.

---

## 7. Design decisions requiring evidence

| ID | Question | Working recommendation | Decision status |
| --- | --- | --- | --- |
| DEC-001 | Desktop backend versus browser-only | Hybrid browser + isolated Python processor for advanced digitising | PROPOSED |
| DEC-002 | Engine source | Evaluate pinned Ink/Stitch and prove CLI batch execution | PROPOSED |
| DEC-003 | File writer and independent validator | Evaluate pyembroidery; verify per-format output | PROPOSED |
| DEC-004 | UI framework | Retain prototype behaviour and introduce modules incrementally | PROPOSED |
| DEC-005 | Hosting | Local development; separate staging only with explicit approval | PROPOSED |
| DEC-006 | Licence/distribution strategy | Preserve upstream notices, perform GPL/MIT compliance review | OPEN |
| DEC-007 | Marketplace selling | No sale before physical tests and current Etsy-policy review | APPROVED SAFETY RULE |
| DEC-008 | Machine support | Start with tested PES/DST profiles; add formats based on test results | PROPOSED |
| DEC-009 | Background processing | Size/time-limited jobs; do not implement unrestricted anonymous compute | PROPOSED |

---

## 8. Milestones and release gates

| Milestone | Deliverable | Status | Exit conditions |
| --- | --- | --- | --- |
| M0 — repository and truth ledger | README + this MD + update discipline + dev branch | DONE-VERIFIED | All files readable in GitHub; branch exists; log updated |
| M1 — preserve prototype | Import v0.3 source and reproducible tests | IN-PROGRESS | Uploaded file hash matches local baseline; browser tests run from repo |
| M2 — secure original-artwork import | PNG/JPG/SVG; separate editable regions | TODO | User moth importer safe; no silent loss; security tests |
| M3 — proper engine spike | working Ink/Stitch CLI for known SVG fixture | TODO | Pinned engine, command/output logs, reproducible CI/local recipe |
| M4 — geometry and stitching | running, bean, satin and fill regions with routing | TODO | Unit fixtures, independent command plan; user-controlled stitch params |
| M5 — validated machine exports | PES/DST and selected others | TODO | Independent decoder verification + capability matrix |
| M6 — real stitch proof | at least one real machine/hoop/fabric setup | BLOCKED | Approved physical stitch-out + documented iterations |
| M7 — production packaging | tested ZIP, thread chart, descriptions, test notices | BLOCKED | Design/size/format-specific QA, zero false claims |
| M8 — possible retail software product | licensing, security, support, pricing, demand study | DEFERRED | Separate commercial decision after user tests |

---

## 9. Detailed task ledger (update status in every change)

**Priority key:** P0 blocks trustworthy foundation; P1 needed for quality digitising; P2 helps scale; P3 later.

| ID | Priority | Work item | Status | Definition of done / evidence |
| --- | --- | --- | --- | --- |
| SF-001 | P0 | Initialise GitHub repo with README | DONE-VERIFIED | README committed to main, SHA in Section 2 |
| SF-002 | P0 | Commit full living master MD and update policy | DONE-VERIFIED | GitHub file link fetch succeeds; document reviewed |
| SF-003 | P0 | Contributor rules and PR template | DONE-VERIFIED | Both committed; checklist points to this document |
| SF-004 | P0 | Create isolated development branch | DONE-VERIFIED | Branch appears in GitHub |
| SF-005 | P0 | Import exact v0.3 HTML prototype | DONE-VERIFIED | File exists on dev branch; SHA-256 equals reference |
| SF-006 | P0 | Recover/import browser tests and fixtures | IN-PROGRESS | Playwright test passing on source-controlled artifact |
| SF-007 | P0 | Establish CI for browser, source lint and test evidence | IN-PROGRESS | Branch checks show green on documented commits |
| SF-008 | P0 | Define versioned project schema | TODO | Schema, migrations and round-trip tests |
| SF-009 | P0 | Threat model uploaded SVG/raster and processing | TODO | Security tests + limits documented |
| SF-010 | P0 | Prototype user moth case as permanent regression | IN-PROGRESS | Embedded-raster SVG accepted; reference + truth-in-UI assertions |
| SF-011 | P1 | Multi-contour region extraction / holes | TODO | Region fixtures and manual corrections verified |
| SF-012 | P1 | Touch-friendly region layers and controls | TODO | Android portrait/landscape device test |
| SF-013 | P1 | Pin and install Ink/Stitch runtime in isolated engine | IN-PROGRESS | Reproducible runner and version output |
| SF-014 | P1 | Prove Ink/Stitch running stitch CLI | TODO | Known fixture, CLI log and output inspected |
| SF-015 | P1 | Add robust satin column editing | TODO | Rails/rungs, underlay and stitch-path fixtures |
| SF-016 | P1 | Replace naive scanline fill with professional region fill | TODO | Routing, holes, angle, density, underlay tests |
| SF-017 | P1 | Explicit trims, tie-in/out, thread colour changes | TODO | Command-level and format round-trip tests |
| SF-018 | P1 | Pull compensation, stitch diagnostics, hoop profiles | TODO | Parameter safeguards and human-checkable warnings |
| SF-019 | P1 | Independent PES/DST decoding via pinned pyembroidery | IN-PROGRESS | CI logs compare commands and extents |
| SF-020 | P1 | Build machine format capability matrix | TODO | PES/DST initially; specify machine versions and test status |
| SF-021 | P1 | External physical embroidery tester | BLOCKED | Written test plan, sample and returned test results |
| SF-022 | P1 | Versioned test report and genuine sample photos | BLOCKED | Physical test records linked to source hash |
| SF-023 | P2 | Add JEF/EXP/VP3/XXX export | TODO | Compatibility and read-back verified for each |
| SF-024 | P2 | Realistic thread chart, instruction and ZIP manifest | TODO | Reproducible checked bundle |
| SF-025 | P2 | Accessibility/reliability on Android | TODO | Responsive test matrix and user acceptance |
| SF-026 | P2 | Commercial/Etsy copyright and AI policy review | BLOCKED | Current verified policy and provenance decision |
| SF-027 | P2 | Licensing/SBOM/commercial distribution analysis | TODO | Explicit obligations and deployment approach reviewed |
| SF-028 | P3 | Upload presets and repeatable batch pipeline | DEFERRED | Only after design-level quality demonstrated |
| SF-029 | P3 | Optional hosted collaborative/cloud application | DEFERRED | Demand, privacy, authentication, budgets approved |
| SF-030 | P0 | Add automated "MD updated with code" PR check | IN-PROGRESS | Test PR cannot modify production source without MD update |

**Next action order:** SF-006 → SF-010 → SF-008/009 → SF-013/014 → SF-019 → SF-015–018 → SF-021. SF-030 requires an actual PR run before status can be promoted. The order can change if evidence changes; record the decision.

---

## 10. Test evidence register

| Evidence ID | Date | Source | Test performed | Result | Caveat |
| --- | --- | --- | --- | --- | --- |
| E-001 | 2026-10-28 | local v0.2 browser tests | Mobile playback placement, step/speed/restart; SVG and JSON imports; ZIP | REPORTED PASS | Not yet run in repository CI |
| E-002 | 2026-10-28 | local v0.3 `test_v03.py` | Embedded-PNG moth SVG, PNG, vector SVG, basic fill mode | REPORTED PASS | Outline only; interior not digitised |
| E-003 | 2026-10-28 | local v0.3 `v03_test_log.txt` | 2,082-stitch fill, 143 jumps; ZIP read-back | REPORTED PASS | No physically acceptable fill established |
| E-004 | 2026-10-28 | local v0.3 binary verification utilities | PES/DST independent command decoding | REPORTED PASS | Independent decoder is not a real embroidery machine |
| E-005 | 2026-10-28 | Local SHA-256 and Git blob comparison | Baseline v0.3 61,967-byte HTML; local Git hash equals remote blob `be29a022390194a3670fa0d29561b4bda78e20be` | VERIFIED | File is in development branch, not main |
| E-006 | 2026-10-28 | Local Playwright tests on v0.3 and mocked Ink/Stitch adapter; GitHub CI configured on development branch | 9 local tests (6 browser/export and 3 adapter) | LOCAL PASS; GITHUB CI UNVERIFIED | GitHub Actions run/check not yet returned; third-party pyembroidery test not run locally |
| E-007 | 2026-10-28 | tests/test_browser_exports.py (external decoder test) + tools/audit_embroidery.py | Reader API wired and dependency pinned to pyembroidery 1.5.1 | NOT RUN | Container cannot obtain PyPI package; cannot claim third-party read-back passed |
| E-008 | TBD | Physical embroidery machine | Fabric, density, registration and quality | NOT RUN | Required before product use |
| E-009 | 2026-10-28 | Isolated Ink/Stitch adapter `services/digitiser/inkstitch_cli.py` | Safe CLI argument construction, failure/timeout and ZIP structure validation | 3 MOCKED LOCAL TESTS PASS | No real Ink/Stitch executable, actual stitch plan or physical embroidery |

**Repeatable tests and actual captured logs must be committed in `tests/` or `docs/test-evidence/` before promotion to DONE-VERIFIED.** A local test report alone is not durable evidence in the repo.

---

## 11. Risk register and mitigations

| Risk | Impact | Current level | Mitigation and evidence needed |
| --- | --- | --- | --- |
| Attractive preview but failed stitch-out | Faulty customer product, reputational loss | CRITICAL | Physical G5 test; inspect density, fabric, thread and backing |
| Raster tracing presented as completed embroidery | Lost detail / misleading listing | CRITICAL | Reference layer, selectable regions, clear warnings |
| Incorrect PES/DST or wrong hoop | Machine problems, wasted material | CRITICAL | Independent readers, profiles, limits and tests |
| GPL obligations ignored | Legal/distribution exposure | HIGH | Licence inventory + review before shipping integrated code |
| Malicious SVG/image uploads | XSS, resource exhaustion, information leaks | HIGH | Sanitisation, time/memory caps, isolated processing |
| Overengineering too early | High cost, stalled development | HIGH | First one-colour verified design; incremental gates |
| Poor Android interaction | User cannot operate product | HIGH | First-class mobile acceptance tests and user review |
| Automation modifies existing Sapiver products | Production regression | HIGH | Separate repo and deployment, scoped permissions |
| Platform-policy mismatch | Listings removed, account risk | HIGH | Direct Etsy verification at listing date; genuine stitched photos |
| No machine-test access | Cannot market reliable output | HIGH | External stitch-out service first; consider own equipment only after tests |
| Unverified extra format badges | Customer incompatibility | HIGH | Per-format evidence and explicit supported profiles |

---

## 12. Decision and change-control log

| Date | ID | Decision / proposal | Reason / status |
| --- | --- | --- | --- |
| 2026-10-28 | D-001 | Use dedicated `sapiverpress-studio/Stitch-Forge` repository | User authorised; separates work from Pattern Forge and live sites |
| 2026-10-28 | D-002 | Keep v0.3 explicitly labelled experimental | Raster silhouette and naive fill are not professional digitising |
| 2026-10-28 | D-003 | Build on proven upstream stitching and format libraries where suitable | Reliability, maintainability and reduced custom binary-code burden; integration unverified |
| 2026-10-28 | D-004 | Keep a living MD updated alongside changes | User requested a detailed, regularly updated record |
| 2026-10-28 | D-005 | No production deployment or sale without explicit authorisation and physical testing | Minimise harm to buyer, equipment and brand trust |

### Decision-record template

```md
### DEC-XXX — concise title (YYYY-MM-DD)
- Context/problem:
- Options and trade-offs:
- Evidence/source:
- Decision and approver:
- Implementation/PR:
- Risks and fallback:
- Revisit trigger:
```

---

## 13. Dated work log / progress journal

### 2026-10-28 — Initial project foundation

**Done (verified):** GitHub repository identified and confirmed empty at project start; bootstrap README created on `main` (commit `7e3e9cc230acf0248f2808e36d131b984993aafa`). Examined available local v0.3 prototype source, sample files and test logs; recorded constraints and exact SHA-256 reference.

**Completed after initial commit:** Master MD committed (`4b58a386cc8a09440d086eb9916f62b84290b7e2`); contributor rules (`9e0d672efc4ed5f788ed6d81dc1a9cf15128669e`); PR template (`8d82e22f520cfba3609fa87089fba55d6eb0cbe6`); development branch created; MD-update workflow added (`98d37a538517378234753be6e866377977b00e85`, **its required-PR check has not yet run**).

**Existing experimental evidence:** UI and export tests from the standalone HTML v0.3, particularly user-supplied moth raster-in-SVG case. The prototype's raster output is a silhouette only. PES/DST decoding and ZIP checks are evidence of structure, *not* fabric/machine performance.

**Completed on development branch:** exact v0.3 prototype source imported and Git hash verified (commit `d7a319d565a43632299a5e476584bbdbe33a7e8e`). **Additional development in draft PR:** source-controlled browser/format tests; CI workflow; pinned Playwright/pyembroidery requirements; restricted, mocked Ink/Stitch CLI adapter; structural audit CLI. **Not done:** running GitHub-hosted CI; installing/running real Ink/Stitch; completing pyembroidery read-back; professional satin/fill controls; physical testing; deployment.

**Next:** Confirm GitHub CI executes against the development PR and investigate any failures; install/pin Ink/Stitch v3.3.0 in an isolated runtime, validate one known SVG through its real CLI, run third-party pyembroidery read-back, then safely implement editable region conversion.

**Files/PRs:** README `7e3e9cc`; master `4b58a386`; contributor `9e0d672`; PR template `8d82e22`; documentation gate `98d37a5`; prototype import `d7a319d`. No merges, deployments or listings.

### 2026-10-28 — Development branch prototype preservation (PR candidate)

- **Scope / task IDs:** SF-004 and SF-005; SF-006 remains TODO.
- **Branch:** `develop/stitch-engine-foundation`.
- **What changed:** added exact source `prototypes/stitch-forge-v0.3.html`. Source was preserved without changing experimental stitch algorithms.
- **Provenance check:** GitHub blob `be29a022390194a3670fa0d29561b4bda78e20be` matches local `git hash-object` of the original v0.3 file; source byte length 61,967.
- **Tests RUN this session:** baseline source/hash comparison; read-back of code file in connected GitHub.
- **Tests NOT run in repository:** browser E2E, independent file reader in CI, physical machine stitch-out; these remain explicitly TODO/BLOCKED.
- **Regression exposure:** None from refactoring (source unchanged). Existing quality and importer limitations remain.
- **Deployment:** None; no live services or Etsy changes.
- **Next:** commit synthetic browser tests and the user-moth-equivalent *non-copyright-sensitive* embedded-image fixture; run a development CI job; then integrate a pinned Ink/Stitch engine.

### 2026-10-28 — Repeatable tests and restricted engine adapter

- **Scope:** SF-006, SF-007, SF-010, SF-013, SF-019; preparation toward M1–M5.
- **Development branch:** `develop/stitch-engine-foundation`, draft PR #1. Changes include `tests/test_browser_exports.py`, `tests/test_inkstitch_adapter.py`, `tests/requirements.txt`, `.github/workflows/test-prototype.yml`, `tools/audit_embroidery.py`, `services/digitiser/inkstitch_cli.py`.
- **Verified local tests:** 9 tests passed on Linux Chromium using `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -v` (6 Playwright UI/import/export/handwritten-format-decoder checks; 3 mocked Ink/Stitch adapter checks). The local test source matched these scenarios; upstream pyembroidery assertion is **not** included in this local pass.
- **Embedded-raster safety fixture:** synthetic 64×48 PNG embedded into SVG, preserving the user's moth failure pattern without publishing the original image.
- **Binary checks:** handwritten independent DST/PEC decoders compared exported machine instructions to the prototype stitch plan. This proves limited binary consistency only.
- **Third-party reader status:** pinned `pyembroidery==1.5.1`, external-reader smoke test and `tools/audit_embroidery.py` added, but NOT EXECUTED against real module; local PyPI download failed due unavailable network.
- **Ink/Stitch status:** documented CLI ZIP command encapsulated in safe argument-vector adapter; 3 mocked tests cover no shell execution, nonzero/timeout and malformed ZIP rejection (including expanded-size check). **Real Ink/Stitch CLI has NOT run**; no supported embroidery plan has been generated from that engine.
- **GitHub CI:** workflow committed; workflow-run and commit-status queries returned no run/check at the time of inspection. Do not mark CI green until a real completed run is observed.
- **Known gaps/regressions:** no established physical stitching evidence; raster traced regions remain silhouette only; source project schema not modularised; actual worker sandbox/GUI connection not implemented.
- **Deployment:** none. **Next:** run GitHub CI and resolve failures; install Ink/Stitch in isolated test runner and validate a known simple fixture with independent reader; then implement proper region-specific fill/satin edit model.

### Entry template — REQUIRED on every meaningful development update

```md
### YYYY-MM-DD — short milestone title
- Scope / task IDs:
- Branch / commit / PR:
- What was changed (files, behaviour):
- Tests RUN (exact command/environment/result):
- Tests NOT run and why:
- Broken or regressed functionality:
- Architecture/licence/security impact:
- Current state changes in Section 9:
- Next concrete task and blockers:
- Deployment: none / staging approved / production approved (link to approval):
```

---

## 14. Update cadence and ownership

**At every development session:** before writing code read this MD and current repo; work on a branch; update the tasks/tests/log in the same change set; fetch the committed file and verify it matches.

**At every PR:** require an MD change (or an explicit justified "docs-only/no-status-change" exception); PR description links requirements, tests and evidence; do not merge while critical regressions or contradictory state remain.

**On each release candidate:** audit the entire ledger, known defects, external licences, test matrix and physical stitch-out evidence; tag release only after gates pass. Do not mark status DONE because a ZIP download appeared.

**Weekly review when development is active:** reconcile TODO, BLOCKED and shipped items against GitHub commits/issues. A calendar automation is not configured; this is a workflow rule, not a promise of background monitoring.

**Document owners:** project owner = Sapiver Press; implementation contributions must identify their own verified evidence and change author. No scheduled agent or unattended deployment has been authorised.

---

## 15. References, provenance and external dependencies

- Ink/Stitch: https://inkstitch.org/ ; CLI usage: https://inkstitch.org/docs/command-line/ ; upstream code: https://github.com/inkstitch/inkstitch
- pyembroidery: https://github.com/EmbroidePy/pyembroidery — format support and MIT licence; pin and verify selected version.
- Original local user test SVG: `Tiles _20261028_062147_0000.svg`, SHA-256 `d0eae50f9a9a6e389d527711523f0cabbb872d7f4ae94176a885f3c8e8235ff5`. User-supplied artwork is not to be published into a public repository without explicit permission; use sanitised synthetic fixtures instead.
- Local prototype v0.3: `Sapiver_Stitch_Forge_v0.3.html` (SHA-256 above). Its status is experimental and independently unverified on physical fabric.
- Etsy, licensing, standards and machine documentation may change. Link to the *current* source when making a compliance or compatibility claim; never rely solely on historic project notes.

**This document records reality, uncertainty and evidence. It is not a promotional feature list.**
