# STITCH FORGE — MASTER DEVELOPMENT DOCUMENT (MD)

> **Single source of truth for scope, progress, decisions, testing, risks and next actions.**
> This is a living document. Update it **in the same commit/PR as each material code, test, architecture or release change**. A feature is not complete until its test evidence and status here are current.

| Field | Current value |
| --- | --- |
| Project | Sapiver Stitch Forge |
| Repository | https://github.com/sapiverpress-studio/Stitch-Forge |
| Maintainer | Sapiver Press |
| Document version | MD-2.3 |
| Last updated | 2026-10-28 (Europe/London) |
| Last independently checked source | Local 29-test regression pass, repo CI workflow placement, 2026-10-28 |
| Default branch | `main` |
| Development branch | `develop/stitch-engine-foundation` (created and confirmed 2026-10-28) |
| Product stage | **Research and prototype — NOT production ready** |
| Intended audience | Internal designer initially; future embroidery creators only after market and safety validation |
| Deployment | **Static v0.3 experimental editor committed to `main` and Netlify reports deployment ready; direct HTTP/browser rendering not independently verified** |
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
| M2 — secure original-artwork import | PNG/JPG/SVG; separate editable regions | IN-PROGRESS | User moth importer safe; no silent loss; security tests |
| M3 — proper engine spike | working Ink/Stitch CLI for known SVG fixture | IN-PROGRESS | Pinned engine, command/output logs, reproducible CI/local recipe |
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
| SF-008 | P0 | Define versioned project schema | IN-PROGRESS | Schema, migrations and round-trip tests |
| SF-009 | P0 | Threat model uploaded SVG/raster and processing | IN-PROGRESS | Security tests + limits documented |
| SF-010 | P0 | Prototype user moth case as permanent regression | IN-PROGRESS | Embedded-raster SVG accepted; reference + truth-in-UI assertions |
| SF-011 | P1 | Multi-contour region extraction / holes | TODO | Region fixtures and manual corrections verified |
| SF-012 | P1 | Touch-friendly region layers and controls | TODO | Android portrait/landscape device test |
| SF-013 | P1 | Pin and install Ink/Stitch runtime in isolated engine | IN-PROGRESS | Reproducible runner and version output |
| SF-014 | P1 | Prove Ink/Stitch running stitch CLI | IN-PROGRESS | Known fixture, CLI log and output inspected |
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
| SF-031 | P1 | Prepare static Netlify mobile editor preview | DONE-VERIFIED | Site files committed and fetched; Netlify production deploy ready for static editor; direct page check still needed |
| SF-032 | P1 | Verify GitHub-connected Netlify deploy preview | IN-PROGRESS | User screenshot shows PR previews generated; browser rendering/interaction of preview remains unverified |
| SF-033 | P0 | Align the live v0.3 saved/ZIP project JSON with the trusted backend bridge | PROTOTYPE-TESTED | Updated source and seven tests committed to dev; local test on real moth ZIP passed; not yet engine-tested |
| SF-034 | P0 | Complete end-to-end source-project to independent-audit packaging pipeline | IN-PROGRESS | Browser-project smoke accepts v0.3 JSON, independent audit designed; real engine not run and complete packaging not committed |
| SF-035 | P0 | Register actual Ink/Stitch workflow on GitHub default branch and confirm CI run | IN-PROGRESS | Workflow present on `main` commit `b3fb43d`; PR synchronization checked, no engine Actions run returned |
| SF-036 | P1 | Specify secure per-region colour and Ink/Stitch fill/run parameters | PROTOTYPE-TESTED | `trusted_svg.py`, `project_bridge.py`, 4 regression tests committed on dev; real engine/fabric result still pending |
| SF-037 | P1 | DRW-style OpenAI image analysis: propose visible internal embroidery regions | IN-PROGRESS | Protected Netlify Function, UI overlay and synthetic tests committed on dev; not deployed live, no API invocation proven |
| SF-038 | P0 | Convert reviewed wing/vein/body proposals to precise pixel-derived editable region contours | IN-PROGRESS | Experimental OpenCV edge contour extraction staged with ROI support; proper pixel masks, editable precise paths and stitchability checks still absent |
| SF-039 | P0 | Verify private API access, image privacy, budget safeguards and staged real moth analysis | BLOCKED | Requires configured owner-only Netlify secrets, test budget and verified function run; no public unrestricted endpoint |

**Next action order:** confirm public editor opens in Android browser after Netlify ready deployment; verify PR previews and CI; then prove Ink/Stitch engine and independent PES/DST validation before expanding stitch tooling. SF-030 requires an actual PR run before status can be promoted. The order can change if evidence changes; record the decision.

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

| E-010 | 2026-10-28 | `services/digitiser/trusted_svg.py` + `tests/test_trusted_svg.py` | Bounded vector geometry; rejects unsupported modes, bad colours and out-of-hoop points | 2 LOCAL UNIT TESTS PASS | Does not produce stitches by itself; no real engine invoked |
| E-011 | 2026-10-28 | `services/digitiser/format_audit.py` + `tests/test_format_audit.py` | pyembroidery 1.5.1 reader, bounding-box and stitch-count comparison, corrupt-file rejection | SOURCE COMMITTED; REAL-LIBRARY TEST NOT RUN LOCALLY | Dependency unavailable locally; CI status not returned |
| E-012 | 2026-10-28 | `real_engine_smoke.py` + `.github/workflows/real-engine-smoke.yml` | Official pinned Ink/Stitch 3.3.0 Linux release → generated SVG → PES/DST ZIP → independent audit | CI WORKFLOW COMMITTED; NOT EXECUTION-VERIFIED | GitHub workflow runs and statuses not returned; no physical stitch-out |
| E-013 | 2026-10-28 | Local `python -m unittest discover -s tests -v` with `STITCH_FORGE_CHROMIUM=/usr/bin/chromium` | Existing 9 local regression tests + 2 SVG builder tests | 11 LOCAL TESTS PASS | Local suite does not include real pyembroidery or real Ink/Stitch; running without Chromium override fails due missing Playwright-bundled browser |

| E-014 | 2026-10-28 | `services/digitiser/project_bridge.py` + `tests/test_project_bridge.py` | JSON paths → bounded physical-mm SVG; rejects unclosed fill, unsupported bean mode and non-finite or oversized coordinates | 4 LOCAL UNIT TESTS PASS | This does not yet generate stitches or preserve image detail |
| E-015 | 2026-10-28 | Local v0.2 saved Stitch Forge project JSON (not committed as fixture) | Convert two actual existing browser paths into a trusted 78.0 × 75.6 mm vector document | LOCAL PASS | Browser JSON schema lacks versioning and explicit per-region colour / underlay parameters |
| E-016 | 2026-10-28 | Local `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -v` | Browser/export, mock adapter, trusted SVG and JSON bridge | 15 LOCAL TESTS PASS | Does not include pyembroidery tests or real engine (no local packages); no pull-request-triggered run returned by the available lookup |

| E-017 | 2026-10-28 | `services/digitiser/release_asset.py`, `tests/test_release_asset.py`, and revised `.github/workflows/real-engine-smoke.yml` | Official Ink/Stitch Linux v3.3.0 asset selection, wrong-architecture rejection, traversal/symlink safety and archive limit tests | 5 UNIT TESTS PASS LOCALLY; YAML parsed | Upstream release metadata and actual archive not downloaded here; GitHub's PR-run lookup returned no pull-request-triggered runs (push-triggered runs are not covered by that lookup) |
| E-018 | 2026-10-28 | Local `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -p 'test_*.py' -v` | Re-ran full locally available test suite including mobile UI, export, SVG path bridge, CLI adapter mock and asset selector | **20/20 LOCAL TESTS PASS** | Does not include independent pyembroidery tests or the real Ink/Stitch binary; those are NOT VERIFIED |
| E-019 | 2026-10-28 | Netlify project and deploy read through connected account | Site `cec158af-c6ae-4bec-ad1f-2f7c54f156fe` has ready deploy `6ae1aca2d9126e163f1feead` at 08:05 UTC, `main` commit `fee944cc`, API deploy; user screenshot shows Stopped builds | SITE EXISTS; CURRENT DEPLOY READY | The ready deploy is not the new browser app and no automatic Github build is confirmed |
| E-020 | 2026-10-28 | Local `site/index.html` adaptation of v0.3 with inline Playwright `page.set_content` | 390×844 and 1365×800: loaded 207-stitch fox, played stitches, exported ZIP; mobile imported user's embedded-raster moth SVG as one silhouette with warning | LOCAL PASS: mobile/desktop UI and ZIP | Browser navigation to file and localhost blocked by environment policy; static HTML injected for tests; new website not yet Netlify-deployed |
| E-021 | 2026-10-28 | `netlify.toml` parsed using Python `tomllib` | Static Netlify publish dir `site`, no build command; standard restrictive headers | CONFIG PARSE PASS | Netlify build log not available; actual publishing remains unverified |
| E-022 | 2026-10-28 | GitHub and connected Netlify site/deploy read-back | Published `site/index.html` commit `b7fa07e3` and `netlify.toml` commit `aba7495f` to `main`; Netlify production deployment `6ae1afd77358bb214f450d08` ready at 08:18:37 UTC for commit `aba7495f`, with 1 header rule processed | **NETLIFY DEPLOY READY** | No direct page fetch/render test was possible in this environment; user's previous 404 screenshot predates this corrected deploy |
| E-023 | 2026-10-28 | `services/digitiser/project_bridge.py` commit `22b0b4fd`; `tests/test_project_bridge.py` commit `b2a6d6d2` | Actual v0.3 storage JSON and ZIP export schema, requested design width, preserved aspect ratio, 2mm hoop margin, unsupported bean/unclosed-fill rejection | **7 TARGETED LOCAL TESTS PASS; 23 REPO-BASED LOCAL TESTS PASS** | Real Ink/Stitch and independent pyembroidery tests not run; bridge not yet exposed through live editor |
| E-024 | 2026-10-28 | Local uncommitted `project_pipeline.py` + `test_project_pipeline.py` | Mock end-to-end fail-closed packaging with independent audit gate; negative tests | **3 LOCAL CONTRACT TESTS PASS; 26/26 LOCAL TESTS PASS** | GitHub write of pipeline blocked, so NOT DELIVERED to repo; mocks are not actual machine formats or real engine validation |
| E-025 | 2026-10-28 | Previously generated user moth prototype ZIP (local only, not uploaded to public repo) | Read real `design_project.json` including settings.width=78 and 100mm hoop; convert image-referenced region geometry to safe SVG | **267,492-byte project JSON → 1,454-byte trusted SVG**, preserved 78 mm artwork width plus margins | This only converts the traced silhouette; original moth details not digitised; no stitch-out or file-format verification |
| E-026 | 2026-10-28 | `real_engine_smoke.py` commit `6dfa91d9`, `tests/test_real_engine_input.py` commit `39933d56`, synthetic `tests/fixtures/browser_project_v03.json` commit `8ac1690c`, CI `4b26c3a0` | Smoke command accepts optional `--project`, converts real browser JSON through safe bridge, invokes official engine and insists on independent PES/DST audit; CI configured to exercise both synthetic petal and browser-project fixture | 3 NEW INPUT UNIT TESTS PASS; **26 COMMITTED TESTS PASS LOCALLY** | Real engine binary and pyembroidery not available locally; GitHub-hosted execution not yet evidenced |
| E-027 | 2026-10-28 | Local end-to-end packaging proof-of-concept only | Mock exporter/auditor requires structural PES/DST verification before package; 3 local contract tests | **29/29 TOTAL LOCAL TESTS PASS** | Pipeline prototype remains UNCOMMITTED following connector write rejection, does not imply actual machine compatibility |
| E-028 | 2026-10-28 | GitHub default branch inspection and local runtime | Found `.github/workflows/real-engine-smoke.yml` absent on `main` although present on dev, explaining missing PR-workflow discovery as probable root cause | **ROOT CAUSE HYPOTHESIS + DEFAULT WORKFLOW COMMITTED** `b3fb43d63443328fce42e65a517f245372df36c1` | Execution NOT verified; Actions could also be disabled/restricted. No successful actual Ink/Stitch run claimed. |
| E-029 | 2026-10-28 | Local test run `PYTHONPATH=... STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s /mnt/data/stitchforge_repo/tests -p 'test_*.py' -v` | 29 tests: browser/ZIP, project bridge, project pipeline mocks, security/asset selector | **29 PASS** (2.917 seconds) | This suite excludes third-party pyembroidery tests because library is not installed; no physical stitch-out. |
| E-030 | 2026-10-28 | `trusted_svg.py` + `project_bridge.py` on development branch, `tests/test_region_parameters.py` | Safe two-colour input, fill-angle, row-spacing, fill-underlay and running-stitch-length Ink/Stitch metadata; rejects out-of-range and incompatible region settings; retains legacy single-colour input | **4 NEW PARAMETER TESTS PASS LOCALLY; 33 TOTAL LOCAL TESTS PASS** | This verifies SVG serialization only, not actual machine colour-change commands, stitch density or professional fabric quality |
| E-031 | 2026-10-28 | Connected GitHub workflow run and commit-status reads for dev PR synchronization | Default branch engine workflow is committed but PR commit only shows Netlify deploy-preview status | **No verified GitHub Actions engine job returned** | PR-only workflow lookup may not include push-triggered jobs; GitHub Actions could be disabled/restricted or undiscoverable by connector |
| E-032 | 2026-10-28 | Original user SVG `Tiles _20261028_062147_0000.svg`, examined locally without publishing source | Found TWO embedded 447×262 PNG images: a monochrome silhouette mask and a separate RGB moth with wing markings, veins, abdomen, antennae; importer currently uses a largest-image choice then flattens foreground to one contour | ROOT CAUSE CONFIRMED from source, not from model guess | Detailed stitching still requires segmentation and manual review |
| E-033 | 2026-10-28 | `netlify/functions/analyse-embroidery.mjs`, `site/ai-details.js`, development `site/index.html`, `tests/test_ai_analysis.mjs` and `docs/AI_REGION_ANALYSIS.md` | Server-only OpenAI vision with strict JSON schema, short image size limits, access token, no AI outputs directly in machine-file exporter; mobile displays proposed bounding boxes and reports omissions | SOURCE COMMITTED, TESTS STAGED, NOT REAL API-VERIFIED | Requires OPENAI_API_KEY and STITCH_FORGE_ANALYSIS_TOKEN in Netlify; no image-to-mask/stitch conversion |
| E-034 | 2026-10-28 | `.github/workflows/ai-region-tests.yml` | Node 22 zero-cost schema/auth syntax/synthetic-response test configured on PR and registered on main | WORKFLOW COMMITTED; EXECUTION STATUS UNVERIFIED | No real vision billing or actual moth results obtained |
| E-035 | 2026-10-28 | `services/digitiser/detail_guides.py` + `tests/test_detail_guides.py` | Optional OpenCV local extraction of internal raster edge contours, constrained by normalized AI-review boxes; three tests with synthetic and original moth detail image locally | **3 LOCAL TESTS PASS** (one using user moth source, kept off GitHub); engine module and synthetic tests committed | Contours are doubled/noisy and can overrepresent thread; not accurate centreline/satin rails; not joined to browser/Ink/Stitch and no stitch-out |
| E-036 | 2026-10-28 | `services/digitiser/requirements-detail.txt` and `.github/workflows/detail-guides-tests.yml` | Pinned optional NumPy/OpenCV dependencies, synthetic-only PR test runner | WORKFLOW COMMITTED on development and main; CI execution NOT VERIFIED | Local test success is not GitHub CI or machine compatibility |
| E-037 | 2026-10-28 | Netlify connected deploy readback | Deploy Preview #1 at commit `896511fb78ee9be123b09939797234abe6fb5c63` reached `ready`, with 1 protected Node function deployed | PREVIEW BUNDLE READY | Function invocation, secrets, actual OpenAI image analysis and region-to-stitch conversion remain unverified |
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

### 2026-10-28 — Real-engine integration and independent-audit foundations

- **Scope / task IDs:** SF-009, SF-013, SF-014, SF-019; E-010 to E-013.
- **Branch / PR:** `develop/stitch-engine-foundation`, [draft PR #1](https://github.com/sapiverpress-studio/Stitch-Forge/pull/1).
- **Code committed:** `trusted_svg.py` (commit `e9d1af1`) builds only numeric, bounded, manually approved vector regions; `format_audit.py` (`8f74a21`) validates decoded PES/DST geometry with pyembroidery 1.5.1; `real_engine_smoke.py` (`050829e`) composes the trusted builder, Ink/Stitch adapter and decoder; `test_trusted_svg.py` (`3baf2ca`) and `test_format_audit.py` (`279e8fa`) add validation cases; CI workflow `real-engine-smoke.yml` (`d050781`) attempts a pinned official Ink/Stitch v3.3.0 engine test on Ubuntu.
- **Tests RUN:** `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -v` on the working local copy: **11 passed** (existing nine plus two builder tests). `python -m compileall` passed for new local source.
- **Tests NOT run:** real Ink/Stitch binary, full pyembroidery library tests and machine stitch-out. Local runtime has neither Ink/Stitch binary nor pyembroidery installed, and outbound package download is not available. A GitHub-hosted workflow has been written but **no workflow-run record has been returned yet**.
- **New safety boundary:** do not pass arbitrary uploaded SVG files to the engine. Source artwork is a reference; only region geometry validated into a fresh, trusted SVG may reach CLI execution. This is not yet connected to the browser editor.
- **Current limitations:** simple fill/running region only, no satin, colour routing or fabric validation. New CI could fail on Linux packaging/asset discovery or library interpretation; fix based on actual logs, not assumptions.
- **Next:** obtain passing GitHub Actions engine smoke and third-party reader tests, resolve any failures, add browser-region schema adapter and visual controls, and preserve all existing UI behaviour.
- **Deployment:** no release or user-facing web deployment.

### 2026-10-28 — Browser-to-digitiser project bridge

- **Scope / task IDs:** SF-008 (initial adaptation), SF-009, E-014–E-016.
- **Branch / PR:** `develop/stitch-engine-foundation`, draft PR #1.
- **Changed files:** `services/digitiser/project_bridge.py` (commit `e7cbca4`) and `tests/test_project_bridge.py` (commit `316df65`).
- **Behaviour:** Read existing browser project JSON, preserve manually defined paths, translate to physical millimetre region coordinates and reject unsupported bean-mode and unclosed tatami regions. Source reference images cannot become executable SVG markup through this bridge.
- **Tests RUN:** On local source copy, 15 total regression tests pass with `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -v`. Also converted a real previously saved browser project JSON with two paths into a 78.0 × 75.6 mm SVG (2,054 bytes).
- **Tests NOT run:** Full Ink/Stitch v3.3.0, pyembroidery independent readback in this environment, GitHub-hosted workflow status (not independently verified), real machine/fabric. These are pending and not promoted to verified.
- **Known limitations:** Browser project format is experimental and unversioned; no automatic multi-colour segmentation or satin/underlay; no machine-verified ZIP; source reference raster remains a reference rather than a stitch model.
- **Next:** Obtain a successful GitHub CI run (or fix CI based on logs); add actual canonical region schema, multi-colour planning and satin-rail representation before interface overhaul.
- **Deployment:** None; no public release.

### 2026-10-28 — Correct real-engine CI release asset selection

- **Scope / tasks:** SF-007, SF-013, SF-014, SF-019, SF-030; evidence E-017 and E-018.
- **Branch / PR:** `develop/stitch-engine-foundation`; draft [PR #1](https://github.com/sapiverpress-studio/Stitch-Forge/pull/1).
- **Root cause found:** Prior CI release selector required the name of a Linux `.tar.xz` release file to contain `x86_64` or `amd64`; the official installation documentation instead shows an `inkstitch-3.3.0-linux.tar.xz` x86_64 archive. The existing selector could reject a valid release before Ink/Stitch runs. This failure mode was confirmed from code inspection and official docs, **not from a failed CI log**.
- **Changes:** Add `release_asset.py` and `test_release_asset.py` to accept only documented versioned Linux x64 file names and official GitHub HTTPS download URLs. Reject wrong-architecture/draft/prerelease metadata, archive traversal, symlinks and excessive expansion. Revised `real-engine-smoke.yml` to invoke the selector, install pyembroidery 1.5.1, execute its actual independent test suite, and optionally verify a SHA256 digest published in upstream metadata before running the engine.
- **Commits:** selector `cd4638be`, tests `338c89ef`, workflow `8b6f0791`.
- **Tests RUN:** `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -p 'test_*.py' -v` — **20 PASS**, including five new release archive/security cases. CI YAML parsed locally.
- **Tests NOT run:** actual Ink/Stitch runtime, real GitHub-hosted workflow or third-party pyembroidery read-back, because this local environment cannot fetch the binaries and no pull-request-triggered workflow runs or commit statuses were returned for new commits (push-triggered runs are not included by the workflow lookup). No physical machine test.
- **Risk:** executable digest is not yet fixed to an independently verified SHA256; the workflow records observed digest and validates an upstream-provided digest when available. Upstream tar contents could contain legitimate symlinks, in which case strict extraction will fail closed; investigate from actual CI logs.
- **Next:** Confirm GitHub Actions is enabled and inspect run logs after the workflow triggers; fix any real runtime failures. Pin exact upstream SHA256 once measured. Only then integrate verified engine output into the editor.
- **Deployment:** none.

### 2026-10-28 — Prepare mobile editor for Netlify deploy previews

- **Scope / task IDs:** SF-031 (preview prepared), SF-032 (deployment verification blocked), evidence E-019–E-021.
- **Developer branch:** `develop/stitch-engine-foundation`, draft PR #1.
- **Site discovered:** Netlify project `sapiver-stitchforge` is public. Its existing deploy was published via Netlify API at 08:05 UTC against main at `fee944cc`; user screenshots show **Stopped builds**. No published preview from this change has been claimed.
- **Committed changes:** `site/index.html` (commit `47ed8a8`) reuses the experimental mobile editor with a noindex flag and accurate footer; `netlify.toml` (commit `0476f06`) sets a static `site` publish directory with no server-side service; `tests/test_netlify_preview.py` (commit `ff31ec7`) adds Playwright UI/ZIP regression; `docs/NETLIFY_SETUP.md` (commit `e4c7aff`) documents preview activation and acceptance tests.
- **Tests RUN:** JavaScript executed through Chromium Playwright `page.set_content` on 390×844 and 1365×800 viewports; fox counts and stitch playback progressed, ZIP generated and downloaded. User's actual embedded-PNG SVG imported as a raster and correctly warned the output is silhouette-only. No JS errors. Python `tomllib` parsed Netlify config.
- **Tests NOT run:** GitHub Actions for new preview test and real Netlify deploy; local direct `file://` and `http://127.0.0.1` browser navigations were denied by environment policy, so we tested the standalone HTML document via `page.set_content`. Real Ink/Stitch and physical embroidery validation remain unverified.
- **Blocker:** Available Netlify connector cannot change build status. Account owner must switch **Stopped builds → Active builds → Save**; then check Deploy Previews and trigger/observe a PR preview build. No assertion of production publication.
- **Next:** Validate the Netlify draft PR preview URL, document deploy SHA, confirm user can upload and download on Android, then work on the native Ink/Stitch engine integration and professional stitch types.
- **Deployment:** No build or deployment triggered by this implementation session.

### 2026-10-28 — Resolve public Netlify root 404

- **Observed failure:** User's Android screenshot showed the Netlify 404 page at `https://sapiver-stitchforge.netlify.app/`, while the Netlify Deploys screen showed working *deploy-preview records* and a ready production build.
- **Root cause, confirmed in GitHub:** production tracked `main` commit `fee944cc` which lacked `index.html`, `site/index.html` and `netlify.toml`. The static editor was only on `develop/stitch-engine-foundation`. A green deploy does not guarantee an HTTP 200 page.
- **Changes on main:** Copied the tested experimental browser editor to `site/index.html` (commit `b7fa07e3f78af1390c9c8041856e3c0d274c4604`) and static publish config to `netlify.toml` (commit `aba7495f272f0dca851c18c6dad72c929d3e2c82`). This is a **static editor** only. No unverified Python digitising engine was merged.
- **Netlify evidence:** Connected Netlify reports site `cec158af-c6ae-4bec-ad1f-2f7c54f156fe`, production deployment `6ae1afd77358bb214f450d08`, commit `aba7495f`, state `ready`, published at `2026-10-28T08:18:37.199Z`. One header rule processed; no functions deployed.
- **Tests RUN this session:** GitHub confirmed presence of source HTML and Netlify publish config; Netlify confirmed deploy commit/status and configuration-processing summary. Previous local browser tests are preserved as historic E-020 evidence, not rerun here.
- **Tests NOT run:** public-site HTTP response / Android rendered editor after new deployment; no verified real Ink/Stitch output or actual machine stitch-out.
- **State:** Production static browser prototype **deployed by Netlify**; **page content needs user/device confirmation**. Do not market machine files as professional. PR #1 remains draft for the unverified engine.
- **Next:** Test homepage and actual mobile SVG/PNG import and ZIP; investigate and fix if still 404. Then validate real engine via CI before advancing digitisation.
### 2026-10-28 — Fix browser/backend schema mismatch and establish export contract

- **Scope and tasks:** SF-033, SF-034, E-023–E-025; draft PR #1.
- **Root cause:** Existing project bridge required `design_width_mm` and `design_height_mm`, while v0.3 browser local saves use `width` and ZIP exports use `settings.width` as the *requested* design width. Earlier bridge could distort aspect ratio by independently mapping width and height.
- **Repository changes:** Updated `services/digitiser/project_bridge.py` (`22b0b4fd410a144d5adf220fa442e10a5c1a8a0c`) and seven tests in `tests/test_project_bridge.py` (`b2a6d6d2e51e6cdf6e8b0f5344ba0d41c6679e6f`). Now accepts the live project structures; uses uniform artwork scale, 2mm clearance around embroidery geometry, hoop constraints and strict checks for unsupported bean stitch/unfinished fill. Original embedded reference artwork is never passed to the engine.
- **Tests RUN:** `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -p 'test_*.py' -v` — **23 passing tests** across the committed-source-compatible local suite. Real previously generated moth ZIP `design_project.json` of 267,492 bytes produced a 1,454-byte safe SVG at 82.000 × 51.526 mm including margins.
- **Additional local work not committed:** A `project_pipeline.py` with three contract tests composes project conversion, a mocked Ink/Stitch export, mandatory independent audit, QA JSON, warnings and ZIP. 26 local tests passed; GitHub write was blocked, so this is *not* counted as delivered and not used by the website.
- **Tests NOT run:** Real Ink/Stitch binary, pyembroidery, physical stitch-out, GitHub Actions evidence of a passing real-engine run.
- **Risks:** Raster original detail is still not converted into separate stitch regions; the exporter must not silently substitute traced silhouette for finished embroidery. Open/no-color and experimental fill remain unsuited to professional claims.
- **Next:** Land and verify the fail-closed end-to-end pipeline; run upstream Ink/Stitch and independent PES/DST decode in CI; then add actual multi-colour region model and proper satin columns.
- **Deployment:** None for this change. Site still presents its existing experimental browser exporter.

### 2026-10-28 — Connect actual browser projects to real-engine smoke workflow

- **Scope:** SF-033 and SF-034, E-026/E-027. Draft PR #1, no production application change.
- **Committed:** `services/digitiser/real_engine_smoke.py` (`6dfa91d9`) now accepts optional `--project` with a saved v0.3 JSON project; `tests/test_real_engine_input.py` (`39933d56`) tests fallback petal, saved project and rejection of unsupported inputs; `tests/fixtures/browser_project_v03.json` (`8ac1690c`) supplies public synthetic shapes; GitHub Actions real-engine workflow (`4b26c3a0`) now tries both the original fixture and browser project.
- **Tests RUN locally:** **26 repo-covered tests passed** across UI, mocked engine adapter, converter, input security and release assets; separately three local uncommitted packaging tests passed (**29 total**).
- **Tests NOT RUN:** actual Ink/Stitch runtime, real pyembroidery reader, real machine/fabric. GitHub connector reports a successful Netlify deploy-preview check for the PR head, but no confirmed real-engine Actions run.
- **Design note:** This changes the *input and validation path* to the real engine; the live website remains its existing experimental single-colour browser exporter. It does not automatically provide satin, proper fills or colour changes.
- **Known issue:** The local packaging prototype is not in GitHub (blocked write). Only committed source counts towards shipped capability.
- **Next:** obtain real engine execution logs and validate both PES/DST formats; then implement editable embroidery region properties (colour, density, underlay) using the upstream engine's supported schema before changing the phone UI.
- **Deployment:** None of these engine changes published.

### 2026-10-28 — Promote engine smoke workflow into GitHub CI discovery

- **Problem identified:** `real-engine-smoke.yml` was present under `develop/stitch-engine-foundation` but **missing from `main`**, which is the default branch GitHub uses to discover many pull-request workflows. This is a plausible blocker for collecting independent Ink/Stitch/pyembroidery test evidence.
- **Change:** exact current engine workflow copied to `main`, commit `b3fb43d63443328fce42e65a517f245372df36c1`. This registers the test without merging unfinished editor/engine code into production.
- **Local tests RUN:** `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s /mnt/data/stitchforge_repo/tests -p 'test_*.py' -v` — 29/29 pass.
- **Tests NOT run:** Ink/Stitch executable is not installed in the local container; `pyembroidery` is not installed; runtime has no internet access for dependency downloads. GitHub Actions successful run not yet returned.
- **Risk and scope:** Netlify production static editor unchanged; Ink/Stitch packaging, machine compatibility and fabric quality remain **UNVERIFIED**.
- **Next:** Inspect a new PR synchronize run for actual engine execution; read failing job logs and fix based on observed failure, not assumptions. Confirm upstream release digest and compatibility. Only after this should additional satin/fill controls be promoted.
- **Tasks:** SF-035 IN-PROGRESS, SF-013/014/019 remain IN-PROGRESS. No release-gate promotion.
### 2026-10-28 — Per-region embroidery settings and colour control foundation

- **Tasks:** SF-036; engine-gate SF-013/014/019 and SF-035 remain IN-PROGRESS.
- **Code:** `services/digitiser/trusted_svg.py` (commits `3b462cd`, `7fc6afa`) now supports per-region hex thread colour, fill angle (−180 to 180°), row spacing (0.25–2.0 mm), optional fill underlay and running-stitch length (0.8–4.0 mm), using documented Ink/Stitch SVG namespace. `services/digitiser/project_bridge.py` (`bf807d9`) reads optional `pathColors` and `pathSettings` arrays; rejects unsupported or mismatched settings, retains original one-colour projects.
- **Tests:** `tests/test_region_parameters.py` (`f75edee`) adds four tests, including actual XML attribute inspection, colour ordering, backwards compatibility and invalid-data rejection. `STITCH_FORGE_CHROMIUM=/usr/bin/chromium python -m unittest discover -s tests -p 'test_*.py' -v` **33/33 locally passed**, using local source copy.
- **Independent upstream references:** https://inkstitch.org/de/developers/inkstitch/namespace/ and https://inkstitch.org/docs/workflow/ document parameters and colour changes. This implementation only serializes such inputs; it has not established physically reliable stitch results.
- **Unverified:** Actual Ink/Stitch ZIP export, PES/DST independent pyembroidery readback, per-colour stitch command round-trip, machine compatibility, stitch-out and colour accuracy. GitHub connector currently returns no real-engine Actions job for the PR head.
- **Next:** Diagnose GitHub Actions execution settings or obtain the first actual runner logs; fix engine/API integration based on real results. Then add front-end region selection and colour tools only after the saved-project schema is versioned and migration-tested.
- **Release:** Development branch only, no changes to the published experimental editor.

### 2026-10-28 — Diagnose lost moth details and stage DRW-style AI region analysis

- **User-observed defect:** Moth input yields only outer silhouette; wing patterns, veins and abdomen disappear from stitch paths. This is a critical failure for detailed embroidery.
- **Actual source inspected:** The uploaded SVG has two embedded PNG images at 447×262 pixels, one silhouette mask (grayscale), one RGB detailed moth. Wing/body detail exists in source, but v0.3 `traceImage` only creates a foreground mask and exterior contour. Raising DPI or simply tracing the outline again cannot restore the details.
- **Architecture adapted from DRW:** Use OpenAI Responses API vision with strict schema to identify **proposed** visible body/wing/marking/vein areas. Keep OpenAI inference separate from deterministic pixel-derived geometry and human-verified stitch selection.
- **Committed on dev:** `netlify/functions/analyse-embroidery.mjs` (`dc7ec53`), `tests/test_ai_analysis.mjs` (`a8b9534` and `cca0a0a`), `site/ai-details.js` (`5261abf`), editor integration `site/index.html` (`235f7d2`), `docs/AI_REGION_ANALYSIS.md` (`37849d9`), workflow `ai-region-tests.yml` (`cbdda39`). A workflow-only copy on main (`f72a953`) enables PR test discovery without promoting experimental site code.
- **Client behaviour:** Explicit analysis button and transient password field; original detailed image used for request; resulting annotations and downloadable JSON are **review proposals, not stitch paths**. Existing editor exports are unchanged.
- **Security:** Uses separate server-side OPENAI_API_KEY and STITCH_FORGE_ANALYSIS_TOKEN, same-origin Netlify Function, request limits, `store:false`, strict output checks and no direct untrusted SVG markup execution. No secrets are in the public repository. Missing keys on Netlify mean feature is unavailable, not silently open.
- **Tests/run status:** Source and synthetic tests committed; no confirmed GitHub-hosted AI test result, OpenAI API call, model billing, physical stitch test or full region mask pass. Not production-ready.
- **Blocker:** The site currently has no configured analysis secrets. Public deployment would require authentication/rate-budget controls and explicit acceptance of image transmission to OpenAI.
- **Next:** Demonstrate model boxes on an authorised reference; implement constrained image mask segmentation for internal wing/body regions, edit/delete controls and precise SVG contours. Only after that connect upstream Ink/Stitch fills and satin rails and test real machine output.
- **Deployment:** Development branch only; published prototype unchanged.

### 2026-10-28 — First pixel-derived internal wing detail candidates

- **Scope/tasks:** SF-038, evidence E-035/E-036. This is a controlled experimental worker, not a published feature.
- **Implementation:** `services/digitiser/detail_guides.py` (commit `7c0b195`) takes decoded BGR raster, optionally human/AI-approved normalized regions, applies contrast enhancement and Canny inside the visible foreground, extracts candidate contour guides longer than an approximate minimum physical size, and returns explicit `REVIEW_GUIDES_NOT_EMBROIDERY` output. Caps image size, region count, guide count and complexity. It does not output embroidery machine commands.
- **Quality evidence:** Three local tests passed in the development environment, including an inspection of internal edges from the **detailed RGB moth** embedded in the original SVG. The user artwork itself is intentionally **not committed** to the public repository. A synthetic-only version of the tests is committed to `tests/test_detail_guides.py` (`d27cb50`).
- **Dependencies:** `requirements-detail.txt` (`9e74a67`) pins optional OpenCV/NumPy used only by the separate Python digitiser; CI workflow `detail-guides-tests.yml` is committed on development (`c0686ce`) and main (`d074699`). CI outcome is still unknown.
- **Remaining defects:** Edge contours are noisy and often trace both sides of a visual marking; they are **not trustworthy stitch centrelines**. Need semantic region masks, manual approval and simplification, physical-size checks, satin rail construction and correct stitch sequencing. No API image-analysis call was made and no machine-file output was validated.
- **Next:** Review AI region boxes against source; develop image-derived masks/centerlines, show editable per-region overlays, validate with synthetic and original references, then integrate reviewed regions with actual Ink/Stitch and independent file auditing.
- **Deployment:** No new runtime or user artwork published.

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
