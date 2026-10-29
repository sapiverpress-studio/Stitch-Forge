# STITCH FORGE — MASTER DEVELOPMENT DOCUMENT (MD)

> **Single source of truth for scope, progress, decisions, testing, risks and next actions.**
> This is a living document. Update it **in the same commit/PR as each material code, test, architecture or release change**. A feature is not complete until its test evidence and status here are current.

| Field | Current value |
| --- | --- |
| Project | Sapiver Stitch Forge |
| Repository | https://github.com/sapiverpress-studio/Stitch-Forge |
| Maintainer | Sapiver Press |
| Document version | MD-2.27 (isolated feature branch only) |
| Last updated | 2026-10-29 (Europe/London) |
| Last independently checked source | 2026-10-28: native Docker/moth-logo-line fixture CI SUCCESS (40748895024); regression CI 66 tests / 3 optional skipped SUCCESS incl Cloud Run safety guards (40767768413). Cloud Run staging package PREPARED only; no Google Cloud service or physical stitch-out |
| Default branch | `main` |
| Development branch | `develop/stitch-engine-foundation` (created and confirmed 2026-10-28) |
| Product stage | **Research and prototype — NOT production ready** |
| Intended audience | Internal designer initially; future embroidery creators only after market and safety validation |
| Deployment | **Static v0.3 experimental editor committed to `main` and Netlify reports deployment ready; direct HTTP/browser rendering not independently verified** |
| Authorised Etsy listing | **None** |
| Physical embroidery stitch-out passed | **NO — not performed** |
| External Ink/Stitch or pyembroidery integration | **Browser→private Netlify proxy→native WSGI worker job handoff implemented and regression-tested on development branch; actual Ink/Stitch 3.3.0 + pyembroidery 1.5.1 two-colour JSON transaction verified CI; worker NOT DEPLOYED, real browser→network→worker E2E NOT VERIFIED** |

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

### Current isolated-branch supplement (MD-2.27)

VTracer 1.0.0a4, OpenCV and scikit-image now have actual local comparison results: 48 candidate/fixture rows, three traces each, with topology, colour, boundary, timing and peak-RSS evidence. VTracer WASM executed in desktop Chromium; physical Android remains untested. No tracing library integrated into the application. See `docs/VECTORISATION_EVALUATION_2026-10-29.md`; historical unavailable-library statements below remain dated history.


### 2.0 Current session supplement (MD-2.19; supersedes historical baseline limitations)

The development code now has a deployable worker package, bounded whole-process-group
engine execution and genuine local HTTP/native export tests across three synthetic
subjects. The image pipeline no longer requires wings or two filled regions. It
accepts supported single-region and line-only drafts, blocks automatic machine
export after any rejected proposal, rejects unsupported holes/disconnected fills,
and rejects stale responses following source/design changes. No guarantee of
universal image fidelity follows: semantic omissions by AI, gradients, holes,
satin, detail loss at low resolution and physical quality remain unresolved.
No original moth was available in this checkout; all new fixtures are synthetic.

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
| SF-039 | P0 | Verify private API access, image privacy, budget safeguards and staged real moth analysis | IN-PROGRESS | Netlify secret variable names and deployment preview confirmed; real authorised AI call and accurate wing analysis not yet verified |
| SF-040 | P0 | Fix AI analysis after browser project reload and expose edit-point toggle beside artwork | IN-PROGRESS | Browser logic and test fixture committed; JS parsing passed, fresh Netlify preview/browser tests pending |
| SF-041 | P0 | Reduce unnecessary running-path travel and make AI box vs jump overlays unambiguous | PROTOTYPE-TESTED | Reversible routing option, actual travel-mm metric, travel visibility switch, AI boxes hidden by default; deployment ready, machine validation pending |
| SF-042 | P0 | Establish reliable multi-colour moth fill/satin digitising and stitching-quality gate | IN-PROGRESS | One-click OpenAI polygon/line proposals plus image-grounded reconstruction now staged; per-region colours and SVG implemented; semantic masks, actual satin and real machine QA remain missing |
| SF-043 | P1 | Add reviewable manual wing/body fill tracing with robust polygon QA and non-destructive source export | PROTOTYPE-TESTED | Legacy experimental geometry module kept for edits; manual tracing removed from primary published preview workflow |
| SF-044 | P0 | Automatic AI-guided reconstruction from source image to editable coloured fills/lines in one action | PROTOTYPE-TESTED | New protected coordinate-plan endpoint, pixel-clipped contour extractor, atomic editor replace, rollback by Undo, coloured SVG, synthetic tests; no genuine moth model/QA run |
| SF-045 | P0 | Verify real reconstruction quality against moth and deliver professionally stitched PES/DST | TODO | Require live model polygon output, semantic mask evaluation, proper satin/underlay, verified Ink/Stitch colours, third-party decoder and fabric stitch-out |

| SF-046 | P0 | Keep automatic reconstruction atomic and coherent on Android | **PROTOTYPE-TESTED; CI VERIFIED** | Source-replaced contours exclude obsolete silhouette; Undo, saved paths, editable colour SVG and blocked multi-colour machine export pass mocked-image mobile test; user moth not passed |
| SF-047 | P0 | Extract pale foreground and contrast-backed vein centrelines | **PROTOTYPE-TESTED; CI VERIFIED ON SYNTHETIC ART** | Adaptive foreground threshold and pixel-contrast-snapped AI line proposals; tests require a real dark vein and reject a fabricated line; no realistic moth-quality metric |
| SF-048 | P0 | Restore original source safely for future edits | **IN-PROGRESS** | Saved project has reduced preview only: auto reconstruction refuses it before a paid API call and requests original upload. Persist original securely with versioned project format before marking done |
| SF-049 | P0 | Execute actual licensed Ink/Stitch engine with independent file validation | **PROTOTYPE-TESTED; CI VERIFIED** | Pinned Ink/Stitch v3.3.0 exports real PES/DST from two trusted SVG fixtures and pyembroidery reads both. Does not demonstrate one-click moth, fabric compatibility or production service |
| SF-050 | P0 | Real moth semantic reconstruction acceptance | **BLOCKED/NOT VERIFIED** | Recognisable four wing panels, wing markings, veins, abdomen, antennae, appropriate thread-layer order; full source/reference comparison + stitch-out |
| SF-051 | P0 | Geometry-only automatic engine handoff and independent native two-colour audit | **DONE-VERIFIED ON SYNTHETIC CI / NOT DEPLOYED** | Browser automatically POSTs current region geometry to owner-authenticated Netlify proxy; standalone WSGI worker converts to safe SVG, Ink/Stitch exports PES/DST, independent audit rejects bad colours/bounds; synthetic real-engine CI and mocked download tests green |
| SF-052 | P0 | Host sandboxed, owner-only HTTPS Ink/Stitch worker | **CONFIGURATION IMPLEMENTED / HOST BLOCKED** | Dockerfile, loopback-only resource-limited Compose, pinned engine installer, Gunicorn + HTTP smoke supplied. Local real HTTP verified; Docker CI 40748116743 passed; no authorised host/credentials/free allocation established. |
| SF-053 | P0 | Machine-file source/revision consistency and fail-closed browser UX | **LOCAL REGRESSION VERIFIED** | Monotonic revision checks reject source/design changes during analysis and machine export, including edit/undo returning identical JSON. Incomplete proposals block machine request; lost machine-scale fills reject atomic replacement. |
| SF-054 | P0 | Subject-independent reconstruction and engine regression matrix | **LOCAL SYNTHETIC VERIFIED / REAL IMAGE QA OPEN** | Generic AI instructions, single fills, rectangular source contours, line-only drafts; moth/logo/line native HTTP matrix. Unsupported holes and disconnected components fail closed; model fidelity remains unverified. |

| SF-055 | P0 | Prepare non-Railway hosting alternative | **STAGING PACKAGE PREPARED / NOT DEPLOYED** | Cloud Run dry-run-by-default build/deploy scripts, explicit billing and exact-dev-SHA guard; private Artifact Registry, scale-zero, 2GiB/2vCPU. GCP billing/permissions and actual hosted HTTPS acceptance remain blocked |

| SF-056 | P1 | Measured local vectorisation/WASM comparison | DONE-VERIFIED ON SYNTHETIC FIXTURES | 48 rows × 3 traces, 8 fixtures, optional pinned dependencies; actual browser WASM; Android/real-wildlife acceptance still open |

**Historical next action order (MD-2.20; superseded by current supplement and latest handover):** verify container CI; obtain an approved existing Linux amd64 HTTPS host (or approved hosting account/cost); deploy private staging and configure only deploy-preview worker variables; prove the genuine preview chain; benchmark multiple original image types before physical stitch-out. No production promotion.

---

## 10. Test evidence register

- **E-070 (2026-10-29, MD-2.27):** Original VTracer benchmark ran successfully. Extended 48-row matrix completed without errors; three repetitions per row; `docs/test-evidence/MD-2.27-vectorisation.json`. Browser WASM evidence `MD-2.27-wasm.json`. Synthetic pixel fidelity only, not machine/fabric evidence.


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
| E-038 | 2026-10-28 | User screenshots at 10:57–11:01, GitHub `site/index.html` and `site/ai-details.js` | Root cause: localStorage restores `rasterReference` but leaves `rasterSource=null`; AI panel read `rasterSource` only, so visible saved image produced false "Upload image" error. Editing handles were controlled from settings below canvas and switched back on after reload | ROOT CAUSE CONFIRMED IN CODE | No OpenAI request had been initiated by this error, and token was not the failure |
| E-039 | 2026-10-28 | Dev commits `9ec9ba7` / `69ee2abe`, `tests/test_ai_reference_restore.py` `c59fa03`, workflow `e12cc8a` | AI uses original source or saved reference fallback; quick editing-points toggle beside artwork; restored reference defaults to handles hidden; synthetic browser regression asserts image recovery, toggle, and mocked detail analysis | SOURCE COMMITTED; JS SYNTAX PARSED SUCCESSFULLY; TEST SCRIPT COMMITTED, NOT YET EXECUTION-VERIFIED | Fallback reference is a reduced transparency-masked image: for most accurate detailed analysis re-import full original |
| E-040 | 2026-10-28 | Locally reconstructed v0.3 HTML with same reference restoration and quick-toggle patch; Chromium 390×844 | Synthetic saved PNG reference restored to AI getter after simulated page reload; edit nodes remain hidden, quick toggle shows/hides them, no page errors | **LOCAL MOBILE SMOKE PASS** | Based on reconstructed local baseline, NOT byte-for-byte rebuilt deploy. Full integrated AI request and GitHub CI still unverified |
| E-041 | 2026-10-28 | Netlify deployment `6ae1d76b72e0a6f82ce330ad` | Draft PR #1 at commit `52134cbb9f31e94799c07ef0cbfecbea51071264` confirmed `ready`, with 1 Netlify function deployed and no build error | **DEVELOPMENT PREVIEW READY** | This does not verify runtime access token, OpenAI result, image recognition, precise stitch conversion or physical embroidery |
| E-042 | 2026-10-28 | Netlify request logs and request detail for `01M613DCG01HA4Y1Z5YN261CX2` | User's 11:13 UTC request to `/api/analyse-embroidery` returned HTTP 502 after 13.05 sec, with one function invocation; no internal function log entries supplied. This is after authentication/input validation and **does not establish** which upstream/validation stage failed. | REQUEST FAILURE VERIFIED | Old catch collapsed incomplete output, JSON, region validation and network failure into the same generic message. No raw request image, bearer token, or API key accessed. |
| E-043 | 2026-10-28 | `netlify/functions/analyse-embroidery.mjs` and `tests/test_ai_analysis.mjs` | Added safe error codes, schema-bounded colour/coordinates, increased response budget from 3200 to 4800 output tokens, bounded 8–16 requested visible regions, five synthetic error cases, `site/ai-details.js` displays codes. | SOURCE COMMITTED; JS SYNTAX PARSED; SYNTHETIC TESTS NOT YET CONFIRMED BY CI | Error category requires next real request to determine root cause. This does not prove OpenAI response accuracy or embroidery quality. |
| E-044 | 2026-10-28 | `netlify.toml` dev commit `905671a` and Netlify preview deploy `6ae1da3793537e3cf0888ac4` | Configure zero-cost `node --test tests/test_ai_analysis.mjs` as the development build command. Netlify reports READY on matching commit and one Function deployed. | PREVIEW DEPLOY READY | Connector did not expose build log; do not claim the test command actually executed until its output is verified separately. |
| E-045 | 2026-10-28 | User's completed `Stitch-Forge-region-proposal-NOT-DIGITISED.json` + original detailed moth PNG in working environment | OpenAI structured response succeeded with 14 labelled areas: left/right fore- and hindwings, spots, veins, central body, antennae and legs. Tested pixel-based internal guide extraction locally against actual 447×262 RGB moth artwork with report boxes. | **LIVE AI REPORT CONFIRMED; IMAGE-BASED GUIDE EXPERIMENT EXECUTED LOCALLY** | Boxes are not shape contours; current draft candidates miss a substantial portion of fine markings and do not add fills or satin |
| E-046 | 2026-10-28 | Dev `site/ai-guides.js` `935f3f7`, editor bridge `site/index.html` `ee9f648`, AI UI `site/ai-details.js` `f376744`, synthetic tests `tests/test_ai_guides.cjs` `1d61ed1`, preview build config `4466503` | Pixel-based running-stitch guide candidates inside AI ROIs, review overlay, load previously saved report without API call, one-click add only after approval, undo/reversible preservation of existing paths. Unit tests assert no fabricated paths from empty image and no rectangles. | **3 SYNTHETIC EXTRACTOR TESTS PASSED IN LOCAL ENGINE MODEL; SOURCE AND CI COMMITTED; PREVIEW DEPLOY READY** | Full mobile end-to-end UI + physical machine compatibility still unverified. Exporter remains single-colour experimental, no filled/satin region conversion |
| E-047 | 2026-10-28 | User's actual prototype ZIP, current screenshot, local Python structural analysis | ZIP has 34 editable running paths, 260 control points, 323 needle stitch commands and 48 travel movement records = 371 movement records. DST is 1,628 bytes (512-byte header + 372 3-byte records including end); 1,913-byte PES starts with `#PES0001`. | ZIP FORMAT/COUNT CONSISTENCY AND USER SCREENSHOT VERIFIED | Independent third-party decoder and actual machine stitch-out not performed; output remains UNAPPROVED |
| E-048 | 2026-10-28 | Geometry-only route model of actual 34-path moth (private local analysis) | Existing sequential geometry incurs ~310.24 mm travel; nearest-endpoint running stitch routing with dominant closed outside edge last, rotated to nearest closed-contour point, projects ~115.78 mm (62.7% reduction). | MATHEMATICAL TRAVEL ESTIMATE | Not measured by a new deployed browser ZIP, no automatic thread trims, and reduces travel but does not create missing wing stitches |
| E-049 | 2026-10-28 | `site/travel-routing.js`, `tests/test_travel_routing.cjs`, updated `site/index.html`, `site/ai-details.js` | Single-colour running/bean optimization preserves source path points, skips mixed fill designs, adds travel mm metric, hides dashed travel by default without removing it from output. AI bounding boxes are separate overlay: hidden by default and reveal one selected region. | SOURCE COMMITTED; JS SYNTAX AND SYNTHETIC ROUTER RUNTIME PASSED | Full deployed UI interactions and actual third-party PES/DST verification remain unverified |
| E-050 | 2026-10-28 | Netlify connected deployment `6ae1e3ecaf5b536b0bca9d1f` | Preview deploy for `ff9c8f90ad533ef19e0348ac232a6da38632afbd` reached READY with one function; Netlify test command configured to execute AI and travel regression tests on build. | READY DEPLOY VERIFIED | Connector does not expose individual test runner logs; do not claim exact test output |
| E-051 | 2026-10-28 | Original 447×262 RGB moth + 14 AI region proposals (local analysis, not uploaded to repo) | Bounding rectangles cover 91% of left upper-wing crop and 99% of right upper-wing crop with foreground, body crop 100%; directly applying masks clipped to boxes would produce substantially rectangular fills, not wing contours. | ROOT CAUSE VERIFIED BY PIXEL COUNTS | Foreground threshold 37 on dark background. AI proposal coordinates are not segmentation masks. |
| E-052 | 2026-10-28 | `site/fill-geometry.js` `4be42a2`, `site/fill-boundary-ui.js` `f3f5402`, editor `site/index.html` commits `f7df2a0`, `9710a39`, `455f849` | Tap-traced actual wing/body boundary, close/preview before apply, strict finite points + noncrossing + size checks, undoable append as tatami; SVG ZIP preserves actual closed fill vs line objects and estimated physical mm. | GEOMETRY MODULE SYNTAX + VALID/INVALID TESTS PASSED IN ISOLATED JS; SOURCE COMMITTED | Real mobile tap-through test and actual Ink/Stitch SVG stitch generation still need independent confirmation |
| E-053 | 2026-10-28 | `tests/test_fill_geometry.cjs`, `tests/test_manual_fill_mobile.py`, `netlify.toml` `98f680d`, AI CI workflow `9b0cb66` | Node closed-region regression, Playwright mobile simulated taps/preview/add/Undo and SVG parse assertions; Netlify configured to fail build if Node checks fail | TESTS COMMITTED; NETLIFY GREEN PREVIEW FOR CODE COMMIT `b8b66fe`; individual CI log contents not independently retrieved | Browser/physical machine quality not certified |
| E-054 | 2026-10-28 | `netlify/functions/reconstruct-embroidery.mjs` (`8520d27`, `b7777be`), `site/auto-reconstruct.js` (`481f2c5`, `267d441`, `22b75ff`) | Dedicated owner-token OpenAI coordinate-plan endpoint with structured polygons and centreline proposals; browser intersects AI polygons with source image foreground, finds largest connected components and closed image-derived contours; complex backgrounds/unsupported fills fail closed | SOURCE COMMITTED; STATIC JS SYNTAX PASS | AI polygon accuracy on real moth is not yet tested; image clipping is not semantic segmentation |
| E-055 | 2026-10-28 | `site/index.html` `5e9ff76`, `4b1b799`, `0e7a024`, `5372cef`, `site/auto-reconstruct-ui.js` `05eb91e` | One button requests model geometry, auto-generates region paths, validates, atomically replaces old traces, preserves per-path colour+Undo, downloads physical-dimension colour SVG; legacy manual fill UI removed from primary workflow. Multi-colour browser PES/DST blocked to prevent false one-colour exports. | SOURCE COMMITTED; EDITOR JS SYNTAX PASS | Mobile end-to-end test committed but no independently confirmed CI/Android result; professional machine file still unavailable |
| E-056 | 2026-10-28 | Synthetic 240×160 two-wing fixture evaluated in isolated V8 with latest `auto-reconstruct.js` and `fill-geometry.js` | Both image-grounded fill regions reconstructed at 115 contour nodes each; 79% pixel support; after edit-space thinning each validated as a 57-point closed fill; source geometry remained synthetic | **2/2 SYNTHETIC FILLS VALIDATED AND SCRIPT EXECUTED** | No actual moth model prediction, independent PES/DST or fabric stitch test |
| E-057 | 2026-10-28 | `tests/test_auto_reconstruct.cjs`, `tests/test_auto_ai_endpoint.mjs`, `tests/test_auto_reconstruct_mobile.py`, Netlify build and PR workflows | Tests cover no-artwork hallucination rejection, complex background refusal, token/no-store, 390×844 mobile mocked AI reconstruction, colour SVG, blocked DST and Undo. Netlify PR deploy-preview status success for `22b75ff` head. | TESTS COMMITTED; NETLIFY PREVIEW CHECK SUCCESS | Individual `node --test`/Playwright execution logs not exposed, so test result not claimed; no actual owner API call |
| E-058 | 2026-10-28 | `netlify/functions/reconstruct-embroidery.mjs` commit `604fb46` + Netlify deploy `6ae1f91fab29f44ae9fd9a03` | Removed an invalid experimental default model identifier and incompatible speculative image parameter; restored documented `gpt-4.1` + image detail `high` default (environment override supported). Development Preview #1 confirmed `ready` at exact commit with **2 functions deployed**. | **SOURCE FIX + DEPLOY READY VERIFIED** | Actual authenticated API call using user's account, model entitlement, real moth reconstruction and final machine output still untested. |
| E-059 | 2026-10-28 | GitHub Actions [AI region safety run 40716378480](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378480), head `db47e431` | Node security, AI schema/geometry + 390×844 mocked-model mobile tests | **SUCCESS: 23 Node tests pass; browser AI reference, manual fill and one-click reconstruction steps pass** | Mock API image, not actual paid OpenAI moth call; browser simulated Android size |
| E-060 | 2026-10-28 | GitHub Actions [regression run 40716378496](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378496), head `db47e431` | Whole Python regression suite, including PES/DST read-back via pyembroidery 1.5.1 and browser simulated export/Undo | **SUCCESS: 44 tests run; 3 optional OpenCV tests skipped** | No real engine stitch generation and no fabric test |
| E-061 | 2026-10-28 | GitHub Actions [engine smoke run 40716378413](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378413) and diagnostic [run 40716769894](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716769894) | Download pinned official Ink/Stitch v3.3.0 Linux archive and fail-closed extraction | **FAILURE: linked file `inkstitch/bin/libscipy_openblas64_-56d6093b.so` (symlink type b'2') rejected; no engine executed** | Cannot infer actual engine incompatibility; archive extractor initially banned all symlinks |
| E-062 | 2026-10-28 | Dev commits `394c819a` / `6e91f79b`; [engine test workflow](https://github.com/sapiverpress-studio/Stitch-Forge/actions/workflows/real-engine-smoke.yml) | Harden official release extraction to permit internal-only symlinks; test valid link, outside/missing links, symlink-parent rejection and traversal | **VERIFIED AS DEPENDENCY IN LATER REAL-ENGINE CI** | Official release extraction succeeded before engine export; archive safety unit tests separate |
| E-063 | 2026-10-28 | [real engine 40736714807](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714807), head `f00914cb` | Pinned Ink/Stitch 3.3.0 actual process exports two-colour synthetic JSON via `machine_job.run_machine_job`, independently read back both PES/DST and check expected 1 colour change | **SUCCESS** | Synthetic bounded fixture, not original moth, real HTTP endpoint or stitch-out |
| E-064 | 2026-10-28 | [AI & mobile 40736714789](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714789), head `f00914cb` | 27 JS tests (proxy bearer/auth, private image rejection, ZIP hash/audit) and two mobile synthetic journeys (unavailable worker and mocked successful ZIP) | **SUCCESS** | No real API payment; mocked native download, not physical Android device |
| E-065 | 2026-10-28 | [Python regression 40736714904](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714904), head `f00914cb` | WSGI auth/input/busy/failure-sanitisation tests; job colour-change & stitch count checks; two mocked browser reconstruction pathways | **SUCCESS: 57 tests, 3 skipped** | Optional OpenCV coverage absent and actual owner artwork not evaluated |
| E-066 | 2026-10-28 | [preview handoff source](https://github.com/sapiverpress-studio/Stitch-Forge/blob/develop/stitch-engine-foundation/docs/NATIVE_ENGINE_WORKER.md), commit `6e405503` | Inspect HTTPS worker configuration, deployment prerequisites and default-off behaviour | **SOURCE VERIFIED / WORKER NOT DEPLOYED** | Never claim owner-hosted end-to-end ZIP generation until actual private worker passes network test |

| E-067 | 2026-10-28 | `docs/test-evidence/MD-2.19-*`, same PR commit | Local Node/browser/Python regression | **37 Node passed; 62 Python run, 3 skipped** | Playwright default download blocked; alternate Chrome for Testing 143.0.7499.4 used successfully; optional OpenCV skipped |
| E-068 | 2026-10-28 | `http_smoke.py`, three synthetic fixtures, captured HTTP matrix | Real Gunicorn → Ink/Stitch → independently decoded PES/DST over loopback HTTP | **PASS:** moth 3010 stitches/5 changes/90×60.6 mm; logo 2071/0/60×40; line art 96/1/60×28; 9 rejection checks | Both formats agree on stitches/changes/bounds; jump record counts differ by format. No HTTPS deployment, model call or fabric test |
| E-069 | 2026-10-28 | `test_engine_process.py` | Real child process timeout/descendant termination, bounded output, normal return | **3 PASS** | Container filesystem/CPU/RAM isolation needs CI/host verification |

| E-067 | 2026-10-28 | [CI 40767768413](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40767768413), head `70b0db6f` | Dry-run, rejected malicious identifiers, refused unapproved spend and wrong branch, full regression | **SUCCESS: 66 tests, 3 skipped; four Cloud Run guard tests passed** | Deployment not executed; no live GCP evidence |
| E-068 | 2026-10-28 | `services/digitiser/cloudbuild.staging.yaml`, `deploy-cloud-run-staging.sh`, [Cloud Run documentation](https://github.com/sapiverpress-studio/Stitch-Forge/blob/develop/stitch-engine-foundation/docs/CLOUD_RUN_STAGING.md) | Prepare alternative cloud container staging without Railway, preserve cost and privacy controls | **SOURCE COMMITTED / NO HOSTED WORKER** | Owner-controlled, billing-enabled GCP account is missing; public Cloud Run routing requires hardened authentication, rate controls and cost review |

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

| 2026-10-28 | D-006 | Rebuild full reconstructed design without retaining the old dominant silhouette | An extra border and unexpected colour were falsely appearing; Undo remains available. CI-verified in synthetic mobile fixture, physical QA absent. |
| 2026-10-28 | D-007 | Require original artwork for billed one-click reconstruction; disallow lossy saved trace reference | Current saved-project reference is not faithful enough for fine moth anatomy; fail before OpenAI charge, preserve editable project. |
| 2026-10-28 | D-008 | Reject non-image-backed AI running lines; preserve pale wing signal with adaptive threshold | Generic foreground proximity accepted invented markings; contrast-backed centrelines are better but remain incomplete; actual moth benchmark not passed. |
| 2026-10-28 | D-009 | Retain strict archive path protection while permitting only verified in-archive symbolic links | Pinned Ink/Stitch binary contains legitimate ELF symlinks; never remove traversal protections to make CI green. |
| 2026-10-28 | D-010 | Use a separate native Linux HTTPS worker, not native engine inside the Netlify static site | Official Ink/Stitch requires a native executable/headless X display. Netlify private proxy remains disabled (503) until a dedicated sandboxed worker and secrets are actually configured |
| 2026-10-28 | D-011 | After one-click AI rebuild, automatically attempt independently audited native machine ZIP, never fall back to browser-made multicolour files | Owner wants no manual intermediate step; preserve valid editable SVG and Undo if worker offline, malformed, unaudited or changed design; physical test not implied |

| 2026-10-28 | D-012 | Build portable private amd64 container; do not provision paid/public hosting | Connected Netlify has no worker URL/token. Render/Railway available but not connected; no approved host credentials or proven free allocation. No purchases or env changes. |
| 2026-10-28 | D-013 | Generalise every image path; never encode moth-specific feature requirements | User explicitly requires future-image applicability. No two-fill minimum or fixed wing/body prompt; diverse synthetic tests and incomplete-result blocking. |

| 2026-10-28 | D-012 | Replace Railway proposal with guarded Cloud Run staging option | Existing 2GiB/2vCPU worker can scale to zero. No Google Cloud account, billing activation or provisioning without explicit authorisation. Public invoker route with worker-token protection alone is insufficient for release, and may incur charges under abuse. |

- **2026-10-29 D-014:** Do not integrate a tracing library on availability alone. Retain current runtime; benchmark favours further investigation of quantised marching and tuned VTracer. WASM is technically feasible but real Android/worker profiling is still required. No cloud deployment or additional service.

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

### 2026-10-28 — Netlify AI analysis variables saved; preview redeployment requested

- **Scope/tasks:** SF-037, SF-039; operational configuration only, no API secrets included here.
- **Evidence:** Netlify site `sapiver-stitchforge` reports environment variable names `OPENAI_API_KEY` and `STITCH_FORGE_ANALYSIS_TOKEN`, with `functions` in their configured scopes. User's Netlify screenshot confirms both saved as secret variables with two configured deployment contexts. Actual hidden values were not inspected or exported.
- **Deployment baseline:** main Netlify deploy `6ae1cb96683a53fa3fae7429` is `ready` at `2026-10-28T10:17:02Z` and contains **zero functions**. Development PR #1 previously had a ready preview and included the protected AI endpoint.
- **Action:** This documentation-only commit synchronises draft PR #1 to request a fresh Netlify deploy preview after secret configuration; deployment and function invocation must be checked independently.
- **Tests NOT run:** live authenticated OpenAI request, cost/usage audit, true moth region proposal, machine-file conversion or stitch-out.
- **Security gate:** Do not place access tokens, API keys or customer artwork in public repository or URL parameters. Do not promote experimental image-analysis code to main or offer open public analysis until authenticated and budget-limited.
- **Next:** Confirm preview deploy ready and one function packaged. Test owner-only function using secret access token on the preview. Only then assess accuracy of moth region proposals.

### 2026-10-28 — Fix false missing-image AI error after reload

- **User report:** Moth visible faintly on canvas, with orange edit circles; after entering private analysis token and tapping the button, panel said "Upload PNG/JPG or an SVG containing the detailed image first." Checkbox to hide points was not near the visible artwork.
- **Root cause:** v0.3 persists `rasterReference` and `rasterBounds` to browser localStorage but does **not** restore `rasterSource`. The separate AI script called `StitchForgeAIContext.getImage()`, which returned only `rasterSource`. So an apparently imported design could be missing its image from the AI panel despite a drawable saved reference. In the restored project branch the controls defaulted to show orange editing handles.
- **Fix:** `site/index.html` commit `9ec9ba7` supplies original source when available, otherwise saved reference, adds `getSourceStatus`, moves a mirrored "Show orange edit points" switch beside the raster trace controls, resets edit handles to hidden when a reference is restored/imported and emits an import event for loaded JSON. `site/ai-details.js` `69ee2ab` shows reference readiness and accepts the fallback image.
- **Tests:** New Playwright mobile regression `tests/test_ai_reference_restore.py` `c59fa03` covers restore/handle toggling and a fake AI endpoint without OpenAI charges. `ai-region-tests.yml` `e12cc8a` runs this test. Both updated JavaScript sources **parsed successfully** using the JS compiler in a sandbox; full browser regression execution and deployed request still need verification.
- **Security and quality:** The private token and API key remain server-side for request validation; neither has been printed or logged. Saved reference is smaller than original and may omit some fine details; user can upload original for the most detailed analysis. No stitch-model change, no new production-ready machine output.
- **Next:** Confirm Netlify preview deploy, run mobile regression in CI, then make one authenticated request to OpenAI for original moth after owner action and assess true wing-detail result. Do not claim machine embroidery completion.
- **Release:** Development preview only; public main website unchanged.

### 2026-10-28 — Verify restored image UI correction in mobile browser

- **Fix committed:** AI getter now prefers full original source and falls back to the persisted reduced raster reference; nearby artwork toggle mirrors the hidden sidebar's edit point checkbox, and restored references default to handles hidden.
- **Tests performed:** Local reconstructed-source Chromium at 390×844 rendered a synthetic saved reference, returned a valid image from the getter, hid orange nodes by default, showed/hid them with near-art toggle, and emitted no JS errors. Both committed JavaScript files also passed syntax parse. Repository `tests/test_ai_reference_restore.py` is committed for future CI on the exact source.
- **Netlify:** Deploy Preview #1 `6ae1d76b72e0a6f82ce330ad` for head `52134cbb9f31e94799c07ef0cbfecbea51071264` returned READY with one deployed function. External browser runtime and authenticated AI response remain unverified.
- **Next:** User reloads [development preview](https://deploy-preview-1--sapiver-stitchforge.netlify.app/), sees restored image ready and orange-node switch beside raster tracing, then tests authorised OpenAI analysis; capture API errors and result quality (no secrets). Continue mask-to-editable stitch regions.
- **Production:** Existing main static editor unchanged. No retail-ready claim or machine test.

### 2026-10-28 — Diagnose live 502 from AI image analysis and improve fault isolation

- **Observed incident:** User reported `Analysis failed or timed out; artwork unchanged` while the moth and perimeter trace were visible in development preview. Netlify request log returned HTTP 502 on an authenticated POST to `/api/analyse-embroidery` at 11:13:05 UTC; function execution approximately 12.52 seconds. Netlify's request log contained no internal thrown-error text.
- **Diagnosis:** Request reached the function and produced the catch-all error. Code inspection confirmed that `extractOutput` and `verifyProposal` exceptions, network errors, invalid response JSON and provider noncompletion all collapsed to the same catch message. **Exact cause of the live 502 has not yet been established.** There is no evidence that changing the token, re-uploading artwork, or rebuilding the canvas will fix it.
- **Repair:** `analyse-embroidery.mjs` commit `b801864` adds safe machine-readable failure classes for provider HTTP status, response incomplete/empty/invalid, validation errors and network timeout, plus restrictive colour and bounded coordinate schema. Region request targeted to 8–16 visible regions, output token budget raised to 4800. Diagnostic codes are logged without secrets, image bytes or provider response bodies. `site/ai-details.js` commit `6bace8c` displays the code with an actionable message.
- **Regression:** `tests/test_ai_analysis.mjs` commit `cf3c374` added synthetic upstream/incomplete/invalid/429/network tests with no real OpenAI calls. Both modified JavaScript production sources and regression source passed static JavaScript syntax checks. GitHub-hosted integration execution not yet independently confirmed.
- **Next:** Confirm new Netlify development preview reaches READY. Run **one** owner-authorised image analysis and inspect returned safe code/log category if failure recurs. Fix based on that actual code; avoid repeated chargeable speculative attempts. Verify region map before integrating stitch geometry.
- **Release:** Draft PR development preview only. No changes to production website or approved embroidery exports.

### 2026-10-28 — AI error-gate preview published

- **Netlify configuration:** Development-branch `netlify.toml` now requests a Node zero-cost API test command before publishing the static editor (`905671a`). This is *not* an authenticated paid OpenAI request; tests simulate upstream HTTP errors and model output and assert errors redact keys/artwork.
- **Netlify result:** Deploy preview `6ae1da3793537e3cf0888ac4` at `905671aaca31e515524d45a054db9d483f082ee3` is READY and includes one function. The available connector does not expose build-step logs, so actual execution of `node --test` remains unverified. Syntax of production JavaScript and synthetic tests was separately parsed successfully.
- **Next:** One real request with the owner's existing token from the preview. If it errors, record the safe `[CODE]` displayed in the interface and investigate Netlify logs; then correct the precise failing stage. Avoid speculative retries/billing. Do not treat region bounding boxes as embroidery stitches.
- **Main site:** Unchanged static editor; only development preview includes the revised API.

### 2026-10-28 — Bridge AI regions to reviewable internal running-stitch draft

- **User expectation:** After a successful AI analysis of the moth, the visible embroidery should be rebuilt with internal details, rather than stopping at download of a `NOT-DIGITISED` JSON. AI gave 14 labelled areas but only approximate boxes, not polygons, centrelines, satin rails or needle commands.
- **Engineering choice:** DO NOT turn rectangles directly into machine stitches and DO NOT silently overwrite the old outline. Added a deterministic local image-detail extractor that searches actual image pixels within reviewed line-like AI regions, builds thinned approximate running-line paths, and overlays them in pink for explicit acceptance. Excludes wing/body fill and satin candidates pending proper contour/satin algorithms.
- **Files:** `site/ai-guides.js` (commit `935f3f7`), browser editor append/undo integration `site/index.html` (`ee9f648`), analysis UX incl. saved JSON report import, automatic draft after model success, preview and Apply buttons `site/ai-details.js` (`f376744`), regression `tests/test_ai_guides.cjs` (`1d61ed1`), Netlify build gate `netlify.toml` (`4466503`), design record `docs/AI_REGION_ANALYSIS.md` (`6f3a624`).
- **Actual moth checks:** Original 447×262 full-colour embedded moth and downloaded 14-region JSON inspected locally. Candidate line extraction detects some forewing markings, veins and antennae but misses other detail; no external OpenAI request or charge made during this coding work.
- **Tests:** 3 local Node tests passed with a synthetic image, verifying paths follow real image lines, blank image creates no paths and invalid limits are rejected. JS source syntax of editor + both external scripts verified. Netlify draft preview `6ae1dd6c90f1a03471d326e2` reached READY for commit `4466503`, with one protected Function included; build-step test output not independently captured.
- **Limitations:** Draft paths are approximate and must be visually reviewed. After approval they join the existing experimental single-colour browser stitch simulator and ZIP export; professional Ink/Stitch machine generation, actual thread colours, stitch quality, pull compensation, underlay, trims and fabric tests remain unverified.
- **Next:** Confirm mobile UI integration, editable-path insertion and Undo with real reference, then improve naturalistic details into high-quality region masks/satin rails. Verify real Ink/Stitch and independent PES/DST readback before sellable output.
- **Release:** Only development preview; production main static editor not updated.

### 2026-10-28 — Diagnose moth preview, reduce travel and clarify overlays

- **Actual input:** User supplied their experimental prototype ZIP and screenshot showing a moth with AI rectangle annotations, partial internal lines and 371/371 movement progress. Parsed ZIP structure: 34 paths, 260 editable points, 323 needle stitches, 48 jump records and one colour. DST is 1,628 bytes with a header and the expected count of movement records plus END; this is not an independent pyembroidery test.
- **Correction to earlier interpretation:** Large orange dashed rectangles numbered 1–14 represent **AI bounding-box search areas**; dashed straight lines in the stitch preview represent **travel jumps**. They are not identical. The interface previously showed both at once, obscuring the stitches.
- **Route analysis:** The original 34-path route traverses ~310.24 mm of non-sewing movement in a geometry calculation. Nearest-open-endpoint ordering and saving the dominant closed outline for last projects ~115.78 mm (62.7% less). This is not a tested fabric reduction and cannot substitute for real thread trims.
- **Committed files:** `site/travel-routing.js` (`2949adb`) adds deterministic non-destructive path sequencing; `site/index.html` (`b99e6ea`, `48587da`) exposes optional travel optimization, accurate travel distance, separate dashed travel visibility (off by default), and preserves routing preference in ZIP. `site/ai-details.js` (`10e4faf`) hides AI search boxes unless requested or an individual area is selected. `tests/test_travel_routing.cjs` (`7cedf55`) checks nonmutation, closed perimeter, synthetic travel reduction, mixed-fill unchanged and invalid inputs; `tests/test_ai_reference_restore.py` (`ff9c8f9`) checks new box display behaviour; `netlify.toml` (`969d0e0`) includes routing tests in the preview build command.
- **Local checks RUN:** JavaScript syntax compilation of routing module and updated editor succeeded; synthetic router executed in isolated JS with 34% travel improvement on a six-path case, source geometry preserved and fill order unchanged. Actual ZIP geometry route projection computed separately. No user artwork was committed.
- **Deployment:** Netlify PR preview `6ae1e3ecaf5b536b0bca9d1f` reached READY for `ff9c8f9`. Production main editor unchanged.
- **Not verified:** Netlify build-run test log output, direct Android UI smoke after these changes, pyembroidery readback, actual machine trim behaviour, physical stitched-out quality, and professional fill/satin rendering.
- **Next:** Independently check new ZIP generated by preview on actual moth with and without travel optimization. Then develop actual wing-region fill masks and satin details, colour sequencing, lock/trim planning and real Ink/Stitch/pyembroidery and physical-machine QA. Do not sell experimental output.

### 2026-10-28 — Moth wing/body fill boundary milestone; reject direct AI-box fills

- **Customer-facing target:** Move from the moth's sparse outline/veins toward editable separate wing and body areas. User requested next professional digitising stage; existing 14 AI regions are approximate *boxes*, not mask geometry.
- **Diagnosis from original source:** Among the full-colour RGB moth's region proposals, left upper-wing AI box is 91% foreground, right upper wing 99%, body box 100%. Converting box-cropped foreground directly into tatami would produce broad rectangular patches. Therefore do not infer closed fill boundaries from bounding boxes.
- **Implemented:** New `site/fill-geometry.js` validates manually traced 4–120 point closed polygons: finite coordinates within the imported image, point spacing, area/extent and no self-intersections. `site/fill-boundary-ui.js` offers mobile start/tap/undo point/close+preview/apply/cancel, with real canvas coordinate transformation. `site/index.html` appends explicitly reviewed `tatami` as one Undo operation without changing existing paths. New ZIP editable SVG now preserves fill-vs-stroke semantics and physical millimetre dimensions; still not a verified machine file.
- **Tests authored:** `tests/test_fill_geometry.cjs` covers successful wing and degenerate/self-crossing/duplicate/out-of-bounds rejections; `tests/test_manual_fill_mobile.py` exercises mobile Chromium tap-to-fill, SVG XML parsing, edit path presence and Undo. Netlify `netlify.toml` requires Node syntax and geometry tests. The AI-region GitHub workflow runs the mobile test when enabled.
- **Checks performed:** Isolated JS compiler accepted editor, UI and geometry scripts; valid test polygon closed and area measured 16,430.5 canvas units squared; three invalid cases rejected with correct errors. Netlify preview for code/test head `b8b66fe` returned READY. A later documentation-only deploy should also be checked. Full GitHub Actions mobile job result not returned by connector.
- **Honest limitations:** This is **guided manual tracing**, not automatic wing reconstruction. Still only one physical thread colour from the browser's experimental PES/DST; no reliable satin rail topology, palette sequencing, compensations, auto-underlay, trims, stitch-out, manufacturing validation or retail release.
- **Next:** Compare a hand-traced closed wing SVG from updated browser in Ink/Stitch, independently decode machine files and physically test fill density. Develop accurate image-based masks with user edits, then multi-colour and true satin rail geometries. Preserve successful prior editor functions.
- **Branch/release:** Development PR #1, no promotion of experimental source to production main.

### 2026-10-28 — Replace manual-first moth digitising with one-action AI reconstruction

- **User correction:** The previous "manually trace each wing" stage did not meet the requirement. The agreed workflow is **upload image → AI identifies accurate candidate shapes → reconstruct automatically → editable multi-colour design**. A model's rectangle-only semantic report is insufficient and should not be converted into fills.
- **Architecture:** New protected endpoint `/api/reconstruct-embroidery` (`netlify/functions/reconstruct-embroidery.mjs`) requests structured semantic fill polygons and vein centreline points using OpenAI vision with `store:false`. It defaults to `gpt-5.6-terra` with `original` image detail and low reasoning; separately billable, owner-token gated. **No genuine request to this new endpoint yet.**
- **Algorithm:** `site/auto-reconstruct.js` uses model polygons ONLY as spatial guidance; derives foreground from actual image pixels (transparent or uniform-background only), clips fills, chooses connected contours, simplifies them and validates proposed running lines on original image. Rejects complex backgrounds and insufficient or malformed fills. It cannot infer every subtle wing or semantic boundary reliably.
- **User workflow:** `site/auto-reconstruct-ui.js` adds **Reconstruct embroidery automatically** as one action. Full editor state is replaced only after validation, with old design in Undo. `site/index.html` persists per-region colours and exports coloured physically sized SVG. Single-colour browser PES/DST export explicitly blocks multi-colour reconstructions. Legacy manual fill script is no longer loaded in the main preview.
- **Test evidence:** Synthetic 240×160 two-wing mask, including independent fill shape validation, passed in isolated JavaScript: 2/2 fill contours reconstructed and simplified to 57 closed coordinates each. Static syntax parse passed for all changed JavaScript. Node and Chromium tests for private API, reconstruction/Undo, editable SVG and blocked misleading DST have been committed; actual GitHub Actions run/log not available to verify execution. Netlify PR deploy-preview check reports success on `22b75ff`. No moth specific accurate reconstruction result or real machine stitch-out yet.
- **Known limitation:** Closed fills are still basic experimental tatami, not machine-tested multi-colour. AI spatial coordinates can be inaccurate even with structured output. Professional standard requires semantic masks, artwork-level quality scoring, satin columns/rungs, proper density/underlay/trim order and real Ink/Stitch/pyembroidery and fabric verification.
- **Next concrete action:** owner runs one controlled OpenAI reconstruction on the original moth in private preview; collect safe error/result and compare wing/background boundaries against real artwork. Improve geometry based on actual failures before advancing to machine file export.
- **Release:** Development draft PR #1 only; no production engine promotion. See `docs/AUTOMATIC_AI_RECONSTRUCTION.md`.

### 2026-10-28 — Automatic AI preview build and model compatibility correction

- **User requirement confirmed:** fully automatic reconstruction from original artwork; no requirement to trace each wing manually. Preview offers a single `Reconstruct embroidery automatically` action, with private token needed for authenticated OpenAI usage.
- **Model compatibility fix:** `netlify/functions/reconstruct-embroidery.mjs` commit `604fb46` replaces an unverified model default and `detail:original` setting with `gpt-4.1` and `detail:high`. Model can be overridden by an explicitly configured `STITCH_FORGE_RECONSTRUCTION_MODEL` Netlify environment variable.
- **Deployment evidence:** Netlify deploy preview `6ae1f91fab29f44ae9fd9a03`, source commit `604fb466527ea24d35cc7fb4a2b8b15fbe7e06b8`, state `ready`, **2 protected functions**. No production promotion.
- **Local smoke checks:** Synthetic 240×160 two-wing image yields two distinct contour fills at 115 vertices with ~79% pixel support. Empty artwork and complex backgrounds fail without creating fake fills. Updated HTML inline editor JS parses. Tests remain synthetic, not full mobile or real OpenAI success.
- **Known limitations:** Image foreground clipping is not accurate semantic segmentation of pale wing layers, AI-proposed centreline geometry is unproven on the real moth, browser-generated PES/DST lacks verified multi-colour, satin, underlay, travel trims, pull compensation and machine QA. Colour SVG is editable only.
- **Next gate:** One authorised real-moth AI reconstruction in preview, inspect saved colour SVG versus image for each wing/body detail; then integrate verified Ink/Stitch engine, independent stitch-file reader and fabric tests. Do not market files as professional yet.

### 2026-10-28 — CI-stabilised one-click pipeline; pixel-supported veins; safe engine archive link handling

- **Scope / requirements:** SF-044 through SF-050; FR-001/005/006/010/012/016/019/020. Moth remains an explicit incomplete acceptance benchmark.
- **Branch / PR:** `develop/stitch-engine-foundation`, draft [PR #1](https://github.com/sapiverpress-studio/Stitch-Forge/pull/1). Experimental code **not merged** to `main`; no production promotion authorised.
- **Source patches:** `site/index.html` `528745e` removes duplicated prior silhouette during atomic auto-replace and emits a design-change event; `site/auto-reconstruct-ui.js` `1435bfa` invalidates stale overlays and requires original upload, not lossy restored preview; `site/auto-reconstruct.js` `061cbab` uses adaptive pale-foreground threshold and cross-line contrast along AI-guided centrelines. Input-region colour, SVG and old design Undo remain preserved.
- **Test fixes:** `tests/test_auto_reconstruct.cjs` `6f391fb` adds pale-wing, actual dark-vein and false-line tests; `tests/test_ai_reference_restore.py` `1ed05c5` / `db47e43` corrects final status assertion and mock `requires_human_review:true`; `tests/test_netlify_preview.py` `f42cdb1` correctly loads travel routing offline; `tests/test_auto_reconstruct_mobile.py` `408fdc5` supplies genuine source rather than reduced preview. Original failures diagnosed from GitHub job logs (timeouts and extra legacy outline).
- **Tests RUN (reproducible CI):** [AI safety](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378480), head `db47e431`: **SUCCESS**, 23/23 Node tests and three mobile-step classes. [Full regression](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378496), head `db47e431`: **SUCCESS**, Python 44 tests run; 3 optional OpenCV tests skipped. This is a synthetic/mock browser milestone, **not genuine moth success**.
- **Engine failure:** Real Ink/Stitch smoke [run 40716378413](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716378413) **FAILED**. Diagnostic `d2b04f2` from [run 40716769894](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40716769894) identified upstream internal `inkstitch/bin/libscipy_openblas64_-56d6093b.so` symbolic link. Extractor `services/digitiser/release_asset.py` `394c819` now permits only links resolving to safe listed archive entries; `tests/test_release_asset.py` `6e91f79` adds safety regression cases. At this record's creation the new real-engine workflow **was still running**; must inspect outcome before changing status.
- **Known limitations:** No true semantic masks for overlapping or translucent wings, disconnected markings may be discarded, exact branch vein paths may be missed, high-quality satin rails/rungs absent, tatami/underlay unproven, no multi-colour machine export, no genuine real-moth OpenAI reconstruction or physical stitch-out. Browser simulation renders experimental commands only; colour SVG is not machine embroidery.
- **Licence/security:** OpenAI request stays protected and separately billable; no API keys committed. Official Ink/Stitch GPL obligations and runtime redistribution licensing need review; pyembroidery only provides machine-format IO, not digitisation.
- **Next engineering gate:** 1) obtain green real-engine smoke or record exact new failure, 2) exercise original full-colour moth using approved private OpenAI request with manually countable region/vein fidelity and false-fill checks, 3) introduce semantic mask/refinement and per-region stitch structures, 4) verify round-trip multi-colour PES/DST, 5) physical test by machine/material/size. Acceptance: one-click builds all visually significant moth components as editable source-grounded regions without rectangular artefacts or false seams, source-preserving Undo and project re-open, and repeatable genuine engine readback. Production quality additionally requires physical evidence.
- **Deploy:** Development branch changes only. Existing production main application untouched; staging deploy status after these commits not yet independently verified.


### 2026-10-28 — Marking-colour reconstruction and actual Ink/Stitch runtime diagnostics (MD-2.15)

- **Automatic source segmentation:** `site/auto-reconstruct.js` commits `df327747`, `93e9df56` now require source-image colour compatibility for `wing_marking` fill polygons instead of merely generic wing foreground. Unreal swatch/area combinations are rejected with `marking_colour_not_supported_by_pixels`, preserving source and original editor paths if major reconstruction fails. `tests/test_auto_reconstruct.cjs` commit `07754367` tests a dark wing spot and absence of a false spot, plus previous pale-wing, line-contrast and synthetic fill tests. **Model-proposed colour may be inaccurate and details may still be missed**; this is not multi-class semantic segmentation.
- **Latest reconstruction CI:** [AI safety run 40718207482](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718207482) **success** on `07754367`; [full regression run 40718207507](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718207507) **success** on `07754367`. A browser-sized mobile test is not a physical Android device test. Three optional OpenCV tests were skipped in the previous 44-test full run; do not imply those exercised.
- **Real-engine findings:** The initial Ink/Stitch v3.3.0 archive extraction failure was a legitimate in-archive ELF symlink. The hardened `release_asset.py` extractor `394c819a` and safety tests `6e91f79b` passed extraction in [GitHub run 40717042442](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40717042442). Next real CLI failure was a missing `libwayland-server.so.0` (bounded synthetic-only diagnostic `inkstitch_cli.py` `d38ff061`, `11c63100`, `88d0914`). Installed Ubuntu `libwayland-server0` `dd52e382`, revealing `Unable to access the X Display` in [run 40717981121](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40717981121). Workflow `260dbb2e` now runs the engine under `xvfb-run` with XCB and installed X11 test dependencies; as of entry creation, [run 40718290030](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718290030) **in progress**, **not a proven engine pass**.
- **Runtime and protection:** Independent PES/DST parsing through pinned `pyembroidery==1.5.1` has passed existing regression tests; this does not prove real-engine output. Upstream Linux binary SHA-256 was compared against release metadata, extraction refuses traversal/external symlinks, and non-synthetic customer jobs never display external stack traces.
- **Deployment:** Netlify production deploy `6ae215f14154a1d720bd1b35` confirmed ready for the **main-only docs commit** `ba519dab`; it did not merge or publish development application code. Developer PR remains draft, no retail or physical-stitch approval.
- **Current P0 priorities / acceptance:** Obtain real Ink/Stitch complete PES/DST ZIP with independent read-back on both trusted synthetic petal and browser-project fixtures; ensure no external-customer source artwork enters public tests. Next benchmark must compare all moth components (four wing panels, colour spots, veins, segmented abdomen, antennae), stitching angles, density, underlay, colour-change/tie-offs and real machine stitch-out. Reject false polygon fills. Persist high-resolution source safely or demand re-upload, preserving undo and edits. No machine-ready claims until fabric evidence exists.

### 2026-10-28 — Actual Ink/Stitch + Xvfb smoke timed out; keep release blocked (MD-2.16)

- **Evidence:** [GitHub Actions real-engine run 40718290030](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718290030), exact code head `260dbb2e`, **FAILURE**. Official Ink/Stitch v3.3.0 Linux download, upstream digest check, safe extraction, executable discovery, pinned pyembroidery audit unit tests and Xvfb setup completed. The first `export_trusted_svg()` invocation **timed out at 120 seconds** and generated no independently validated PES/DST ZIP. The log says `ENGINE SMOKE FAILED: Ink/Stitch exceeded configured processing timeout`.
- **Uncertain root cause:** A blocked GUI dialog, waiting child process, pathological stitching, display/runtime incompatibility or other engine issue are possibilities **not yet established**. Do not mark machine export working and do not increase the timeout blindly.
- **Next engineering action:** Instrument timeout path for bounded stderr and subprocess state in synthetic-only CI; test official CLI on minimal valid SVG, investigate any modal UI interaction, review headless Linux compatibility, enforce process-tree and resource limits. Retry both synthetic and browser-project fixtures, independently parse real PES/DST and record stitch counts/colour changes only after actual completion.
- **Latest successful non-engine checks:** [AI safety 40718207482](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718207482) and [Python regression 40718207507](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40718207507) both **SUCCESS** at `07754367`, covering colour-backed wing markings, reconstruction, mobile-sized browser smoke, undo and prototype format readback. **Not** a real moth/OpenAI end-to-end QA pass.
- **Release gate remains HOLD:** no model-verified complete moth, no trustworthy multicolour PES/DST generated by actual Ink/Stitch in this session and no fabric stitch-out. Production site still runs original main application; only master MD has been updated on main.


### 2026-10-28 — Resolved upstream Ink/Stitch GUI deadlock; genuine PES/DST test files pass independent read-back (MD-2.17)

- **Root cause established from synthetic CI X11 screenshot:** The official Ink/Stitch 3.3.0 engine opened a 423 × 142 window saying `Unversioned Ink/Stitch SVG file detected` and offering Cancel/Update. This blocked the supposedly headless `--extension=zip` command until its 120-second timeout. It was **not** an argument typo or slow fill routing. The expected SVG version is upstream `lib/update.py::INKSTITCH_SVG_VERSION = 4` at Ink/Stitch tag v3.3.0.
- **Permanent fix:** `services/digitiser/trusted_svg.py` commit `4c6d8c72` writes `<metadata><inkstitch:inkstitch_svg_version>4</inkstitch:inkstitch_svg_version></metadata>` to generated SVG input. It does **not** blindly dismiss the modal or turn off other engine validation. `tests/test_trusted_svg.py` `109b9b82` asserts exactly one schema marker and no external XML content. Legacy tests were amended to ignore metadata when counting regions (`tests/test_region_parameters.py` `aac4ef58`, `tests/test_project_bridge.py` `27fe487c`).
- **CI real engine pass:** [GitHub Actions 40733579763](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40733579763) (head `109b9b82`) **SUCCESS**. Actual official Ink/Stitch v3.3.0 Linux executable generated `embroidery.pes` and `embroidery.dst` within ZIPs for both the synthetic petal and browser-project fixture. The ZIP CRC tests passed, and pinned pyembroidery 1.5.1 independently read back both machine formats.
- **Measured petal test:** PES **1,278 needle stitches / 3 jumps / 1 colour change / 40 × 64 mm**; DST **same**. Source trusted SVG SHA-256 `614cdd9a397ba3485eb5c6c5d8e31caeaa94eecbb7bcf610a61f4fbfed4592a5`.
- **Measured browser-project fixture:** PES **3,840 stitches / 2 jumps / 0 changes / 60 × 82.6 mm**; DST **3,840 / 3 jumps / 0 changes / 60 × 82.6 mm**. The one-record jump-count difference is format-dependent and needs format-semantic analysis; no false same-command assertion. Source trusted SVG SHA-256 `197acfccd1337ef3c90f2ba922d99ff16e40247becfb605b987d0734fba03862`.
- **Final CI:** [GitHub Actions 40733861377](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40733861377), head `27fe487c`, **SUCCESS**: 48 tests executed, 3 optional OpenCV tests skipped. [Real engine 40733861443](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40733861443) **SUCCESS** on same head. The temporary GUI screenshot and ImageMagick/X11 diagnostic packages were then removed from workflow `c408eda9`; cleaned [real engine 40734063123](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40734063123) also **SUCCESS**.
- **Supporting changes:** `inkstitch_cli.py` `4cb28cd5` retains bounded timeout stderr only in synthetic-only CI, tested in `tests/test_inkstitch_adapter.py` `a4a496c2`. No raw customer file names or engine stderr are logged in the normal runtime. Xvfb and required Ubuntu libraries retained for headless execution. The exact SVG version and binary tag are upstream-specific; update together.
- **Important distinction:** This proves the **standalone trusted-SVG → real Ink/Stitch → PES/DST → independent reader** pipeline for two controlled fixtures. It does **NOT** join the browser's one-click AI reconstruction to an executable server-side service, test the genuine original moth, establish real satin rail geometry, demonstrate reliable stitch density, prove compatibility with any named physical machine, or verify stitch-out. The prototype browser's reconstructed multi-colour PES/DST remains safely blocked. No production merge or related Sapiver product change authorised.
- **Next engineering milestone:** define a bounded server-side job contract from atomic reconstructed JSON (full region geometry/colour/layer/stitch params) to the trusted SVG builder, then run Ink/Stitch and independent audit. First end-to-end one-click moth acceptance must reconstruct at least the actual wing shape panels, visible colour markings, veins, body segments and antennae with correct order and no artificial rectangles. Follow with physical stitch-out before any production/retail claim.

### 2026-10-28 — Engine worker handoff, synthetic end-to-end audit, mobile ZIP UX (MD-2.18)

**Built on `develop/stitch-engine-foundation`:** `services/digitiser/machine_job.py` (`cabf88cf`, strengthened `646971b8`) accepts bounded JSON vector regions, generates trusted versioned Ink/Stitch SVG, calls the actual CLI and independently audits PES/DST. Fails closed on unexpected stitch-count or colour-change differences and caps ZIP at 3 MB. `services/digitiser/worker_wsgi.py` (`fcea4e24`, deadline `d41c42e3`) is an owner-token protected, geometry-only, single-process WSGI endpoint; **not a production-hardened deployment**. `netlify/functions/machine-embroidery.mjs` (`5e6b8231`) is a server-to-server authenticated HTTPS proxy **disabled unless a dedicated worker URL and token are configured**. It independently verifies ZIP magic, audit marker, length and SHA-256 before relay. The edit surface exposes only an allowlisted vector snapshot (`site/index.html` `f4efca59`) and the one-click flow automatically attempts ZIP after reconstruction (`site/auto-reconstruct-ui.js` `aecdb491`). No original customer image, reference preview or arbitrary SVG sent to the native engine.

**Real CI:** The initial new JSON fixture failed hoop-boundary validation (width 65 mm scaled to more than 100 mm height); it was corrected to 150 mm in `70549db1` without bypassing the real geometry check. Verified [real engine 40736714807](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714807): **SUCCESS**, true two-colour JSON project → Ink/Stitch v3.3.0 → PES/DST independently decoded with exactly **one colour change**. Earlier [40736329733](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736329733) also proved the same path. Full [Python regressions 40736714904](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714904): **57 tests, 3 skipped, all others passed**. [AI/Node/mobile 40736714789](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40736714789): **27/27 JS passed**, both Android-sized synthetic browser journeys passed (503 fallback and an automatically downloaded **mocked** audited ZIP).

**Not verified:** A separate worker deployment, genuine network-to-native browser request, real user moth model/image-reconstruction accuracy, professionally controlled satin routing, true thread brand matching, machine safety or fabric stitch-outs. No production merge, live worker token configuration, image publishing or charges authorised. `docs/NATIVE_ENGINE_WORKER.md` details required HTTPS isolation, per-job quotas, CI provenance and outstanding operational gates.

### 2026-10-28 — Portable native worker, generic reconstruction and real HTTP matrix (MD-2.19)

- **Scope:** SF-049, SF-051–054; FR-006/010/012/013/016/020/023/026. Existing development branch and draft PR #1, based on `b6b61660503eaba65880a3be767fe12931fcc375`. Commit containing this entry records the implementation; no experimental code merged into main.
- **Deployment work:** added Dockerfile, Compose staging config, checksum-pinned build installer, worker dependencies/start script and real HTTP smoke. Exactly one Gunicorn process/two threads retains global per-instance lock/429 rejection; non-root, read-only root, 256 MiB tmpfs, 2 GiB RAM, 2 CPUs, 128 PIDs, dropped capabilities, loopback-only host port. Native wrapper kills all child processes on timeout and caps output. Docker absent locally; container build/run added to existing real-engine CI, not yet claimed passed.
- **General functionality:** replaced moth-specific model instructions with subject-independent areas/lines; kept legacy semantics and added generic marking/outline/detail. Removed the two-fill requirement in reconstruction and editor. Legitimate rectangular contours now work. No fabricated borders or anatomy. Unsupported holes and significant disconnected components are rejected instead of silently filled/discarded. Any rejected proposal blocks automatic machine export; machine-scale region loss rejects the entire atomic editor replacement. Source/design revision counters prevent stale analysis and stale ZIPs even after edit/undo.
- **Tests:** 37 Node tests passed. `STITCH_FORGE_CHROMIUM=<Chrome-for-Testing-143.0.7499.4> python -m unittest discover -s tests -v`: 62 tests, 3 optional OpenCV skips, all remaining passed. Includes mocked one-click success/503, stale analysis/stale native result, one-region support and incomplete-export suppression. Real process timeout/descendant tests pass. Initial default Playwright download failed (gateway); alternate official Chrome archive worked. Initial disconnected fixture accidentally retained a top pixel bridge; corrected the synthetic cut across full height, then passed. No failing final local tests.
- **Real native evidence:** official archive SHA-256 `162bc16bfb80f18e2343050ab03ddb1c3b39c654fbc868a4a742a28d42ff1c79` verified against release metadata and hardcoded installer pin. Local petal produced 1278 stitches and 1 colour change in each format. Actual authenticated Gunicorn HTTP matrix: synthetic four-panel moth 3010 stitches/5 changes/90×60.6 mm; single logo 2071/0/60×40 mm; line art 96/1/60×28 mm. Both PES/DST independently decoded, ZIP digest/length checked, 401 bad token and 422 source-data/empty geometry checks passed for each. Exact output hashes and format-specific jump counts in `docs/test-evidence/MD-2.19-http-matrix.jsonl` (ZIP timestamps may change hashes across runs).
- **Host investigation:** Stitch Forge Netlify site `cec158af-c6ae-4bec-ad1f-2f7c54f156fe` has existing analysis credentials but no engine URL/worker token. Other products untouched. Render/Railway discovered but not connected. Native host credentials, approved host allocation and cost remain the precise blocker. No API purchase/call, paid host, public native service, production merge or credential mutation. Current website cannot complete native exports.
- **Not tested / remaining limitations:** hosted HTTPS, actual Netlify preview→worker transaction, real OpenAI image accuracy, owner-device Android, Docker isolation until CI passes, satin rails, compound holes/gradients, physical fabric. Real-image quality is not established by synthetic anatomy or valid machine files. General rules apply across images but do not guarantee all images are supported.
- **Next action:** verify container CI then deploy this package on an owner-approved private amd64 HTTPS host; set worker settings only in deploy-preview functions context, and exercise an authorised original-image request. Master document mirrored to main with documentation only and deployment-skip commit; application stays in draft PR.

### 2026-10-28 — Container startup follow-up (MD-2.19)

- Implementation is remote commit `08d78a8f42e17b29a80b1b3e1882cd828e0d1125`; docs-only main sync `eba102fac81a92ceffdc6d4d25d606183b741402`.
- Fresh [Python CI 40747481869](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40747481869) and [AI/browser CI 40747482204](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40747482204) **SUCCESS**. Netlify development preview ready; both reconstruction JS files fetched and byte-matched to committed source; unauthenticated deployed machine request correctly returns 401. No paid model call.
- [Native/container CI 40747481435](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40747481435): native fixture exports **PASS**, Docker image build **PASS**, container HTTP **FAIL** (connection reset after startup readiness retries). Existing xvfb-run redirected display diagnostics, so root cause was not yet established. Do not claim a deployable running container from build success.
- Follow-up replaces silent xvfb-run startup with explicit container-local Unix-only Xvfb, visible error output and a bounded 10-second readiness test. Worker remains non-root, read-only and resource limited. CI now asserts readiness and records container state before cleanup. Retry pending; no security isolation removed and no live host configured.

### 2026-10-28 — Container acceptance passed; shared detail ceiling corrected (MD-2.19)

- **Container/native HTTP PASS:** [run 40748116743](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40748116743), commit `bd7ba8a9a4c09656488cad89c466a7339e2e2b4c`, job `123027211362`. Non-root, read-only, capability-dropped container with 2 GiB/2 CPU/128 PID/256 MiB tmpfs limits generated all three real machine archives over HTTP. Independent stitch/colour/bounds counts matched the local matrix. Container remained running, OOMKilled=false. The explicit Unix-only Xvfb startup resolves the tested startup failure; old launcher's precise internal cause remains unproven. Harmless XKB key-symbol warnings remain.
- **Generic detail capacity:** AI schema, validator, browser reconstruction and editor now consistently accept up to 32 regions (previously 16). This accommodates the 19-region synthetic benchmark without subject-specific rules. Existing 12,000 output-token ceiling unchanged; no paid model call. Node suite now **38 passed**, including a 19-region botanical plan and rejection at 33. Earlier full local Python suite: **62 run, 3 skipped, remainder passed**; CI Python/browser passed on 08d78a8. The final full local repeat after the constant change also **passed: 62 tests, 3 skips**, taking 176.488 seconds under local load. Captured log updated. Final CI should be checked at its own SHA.
- **Deployment status:** native container acceptance is verified; a persistent owner-approved HTTPS host and deploy-preview worker settings are still absent. No claim of hosted one-click success or universal image digitisation. Physical stitch-out remains NOT TESTED. Native runtime code is unchanged after the passing bd7ba8a container test.

Final application source for this session: `dbd9d46b7a0b3321cbbb9a1e1cc27b0adda6a3e9` (generic 32-region capacity; final local 38 Node / 62 Python with 3 skips). Native container code verified at `bd7ba8a9a4c09656488cad89c466a7339e2e2b4c`; final native/container CI 40748895024 on dbd9d46 has now passed. This final documentation sync does not alter application code.

### 2026-10-28 — Final native CI confirmed; hosting connection requested

- Rechecked [final native/container run 40748895024](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40748895024), job `123029941732`, application source `dbd9d46b7a0b3321cbbb9a1e1cc27b0adda6a3e9`: **SUCCESS**, including actual Ink/Stitch exports and constrained-container HTTP matrix. This resolves the previous pending CI note.
- User instructed to proceed with private staging. Rechecked plugin availability: Railway and Render remain unconnected. Requested Railway connection to inspect the account's actual resources/credits before provisioning; this is not a paid-plan approval or a claim that the account is connected.
- Hosting fit: current official Render FAQ reports roughly one-minute free-service cold starts, exceeding the existing 55-second proxy deadline; Railway trial documentation caps memory at 1 GB, below the 2 GiB limit used in the verified container test. Neither free route is established as reliable yet. No host purchase, trial signup, deployment or Netlify secret change occurred.
- Exact next dependency: connect an approved native-host account (Railway connection offered), inspect its capacity/cost, then deploy private staging only within the user's no-unapproved-spending constraint. Current hosted machine generation remains unavailable.

### 2026-10-28 — Railway-free Cloud Run staging option; no spending (MD-2.20)

- **Direction:** User rejected Railway and authorised progress via alternative. Google Cloud Run was selected as a *candidate*, not a deployed replacement, because it supports the already-tested amd64 Docker service, HTTPS and scale to zero. Official pricing and billing rules were reviewed; free allowances do NOT guarantee no charge.
- **Files on development branch:** `services/digitiser/cloudbuild.staging.yaml` (`b1f02604`), `services/digitiser/deploy-cloud-run-staging.sh` (`99dfb4e2`), `tests/test_cloudrun_deploy.py` (`70b0db6f`), `docs/CLOUD_RUN_STAGING.md` (`3066a089`). The deployment helper defaults to DRY RUN and refuses --execute without a reviewed exact dev SHA and specific cost approval. No Netlify secret was modified.
- **Configuration:** London `europe-west2`, `linux/amd64`, 2vCPU, 2GiB memory, concurrency 1, minimum instances 0, maximum 1, 60-second upstream request timeout; existing native worker `PORT=8080`, owner Bearer token and independent PES/DST audit remain unchanged.
- **Security/cost warning:** The updated development staging script now requires Google Cloud Run IAM plus a separate application worker token; earlier public-routing staging instructions have been superseded; arbitrary unauthenticated requests could still cause charges or denial of service. Server-side Google identity-token exchange has been added and tested, but a genuine invoker account, private hosting, abuse controls, cost approval and live HTTPS testing remain outstanding.
- **Tests:** [CI 40767768413](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40767768413) SUCCESS, 66 Python tests (3 optional skips), including all four new dry-run/approval/identifier guards. Native worker Docker CI had already passed [40748895024](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40748895024). No GCP Cloud Build, Cloud Run HTTPS, billing flow, Netlify preview integration, actual user moth or physical stitch-out was executed.
- **Blocker:** A billing-enabled, owner-controlled Google Cloud project and authority to provision are unavailable through this session's connector. Do not connect an unrelated Google Drive account and claim it can deploy Cloud Run. No cloud spend approved; development PR #1 remains open and unmerged.

### 2026-10-29 — Cloud Run IAM hardening and owner-approved staging gate (MD-2.21)

- **Platform:** Google Cloud Run is the chosen alternative. Railway is excluded. No connected Google Cloud account, project credentials or billing consent were present, so no Cloud Run/Artifact Registry/Secret Manager resources were created or charged.
- **Private-by-default implementation:** `services/digitiser/deploy-cloud-run-staging.sh` commit `434ac9fb` replaces `--allow-unauthenticated` with **`--no-allow-unauthenticated`** and requires a restricted runtime service account and an existing billed project/registry/secret. Dry-run remains the default; real deployment requires `--execute`, an exact clean development SHA and explicit charge approval. `cloudbuild.staging.yaml` avoids duplicate image push (`60b3e6b1`).
- **Netlify private caller:** `netlify/functions/lib/cloud-run-auth.mjs` (`0839e7d9`) signs a restricted, audience-locked assertion and exchanges it with Google for a short-lived service ID token; `netlify/functions/machine-embroidery.mjs` (`cd9a01dc`) passes that via `X-Serverless-Authorization` while retaining a second independent bearer secret, with fail-closed endpoint validation. Caller keys are not in source and not configured in Netlify. Longer-term workload identity federation is preferable.
- **Real-HTTPS acceptance preparation:** `services/digitiser/http_smoke.py` (`472c1c1d`) supports an IAM token only for a secure Cloud Run endpoint. `docs/NATIVE_ENGINE_WORKER.md` and `docs/CLOUD_RUN_STAGING.md` record the new private route.
- **Verified CI:** [AI 40820353546](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40820353546) **SUCCESS 35/35 Node tests**, including mocked Google ID-token and dual-auth flows. [Python 40820576385](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40820576385) **SUCCESS 66 tests, 3 optional skips**, including dry-run/IAM requirement tests. [Real container 40820446420](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/40820446420) **SUCCESS**, private deployment flags checked without GCP writes; earlier proven Ink/Stitch production-format synthetic HTTP matrix remains unchanged. Final changed source test at latest head to be checked independently.
- **Remaining blockers:** No Google Cloud Run deployment or real Cloud IAM/Netlify hosted transaction yet. Cloud Run scale-to-zero cold starts may exceed the current Netlify 55-second synchronous limit; keeping an instance warm incurs additional ongoing costs. Missing real owner-image, fabric stitch-out and explicit cost review remain release blockers. Production application code untouched; PR #1 draft.

### 2026-10-29 — Owner-managed private Cloud Run deployed and real synthetic PES/DST HTTP proven (MD-2.22)

- **Actual hosting (owner screenshots, not inferred from CI):** Existing billing-linked Google Cloud project `gen-lang-client-0857863712` (display name Sapiver Press) enabled Run/Build/Artifact Registry/Secret Manager APIs. Created private docker repository `stitch-forge-staging` in London `europe-west2`, distinct service accounts `stitch-forge-worker` and `stitch-forge-invoker`, and generated `stitch-forge-worker-token` in Secret Manager with worker-only secret accessor permission. Owner executed the documented, explicitly approved build/deploy script and screenshot showed **Cloud Build SUCCESS** and **Cloud Run revision serving 100% traffic** for `stitch-forge-worker-staging`. Deployed private Cloud Run URL supplied by owner: `https://stitch-forge-worker-staging-5se64mn5fq-nw.a.run.app`. Private service `roles/run.invoker` assigned only to the dedicated invoker identity. Cloud Shell owner account received token-creator permission on that service account and successfully printed the safe confirmation `IAM TOKEN OK`; tokens were not revealed in chat.
- **Real hosted engine verification (owner screenshot, not GitHub CI):** `services/digitiser/http_smoke.py` invoked the actual private HTTPS Cloud Run endpoint using short-lived Google IAM identity plus worker bearer and reported independent pyembroidery decoding for **single-colour logo: 2,071 PES/DST needle stitches, 0 colour changes**; **19-region synthetic moth: 3,010 PES/DST needle stitches, 5 colour changes**. Each completed 3 negative request security tests, confirmed ZIP SHA/audit. No physical stitch-out or owner-origin moth semantic benchmark.
- **Netlify preview configuration (read-back metadata only):** Owner manually saved `STITCH_FORGE_ENGINE_URL`, `STITCH_FORGE_WORKER_TOKEN` and `STITCH_FORGE_CLOUD_RUN_CALLER_JSON` in the `sapiver-stitchforge` Netlify deploy-preview context, with no configured values for production. Connector independently confirmed all three **exist and are secret-protected**; it returns redacted placeholders, so the actual values and Google private key contents **have not been independently checked**. Netlify connector write calls failed 403, leaving changes to owner UI. The local service-account JSON key download was deleted from the owner's Android phone according to owner confirmation; the Google-managed key and Netlify preview secret remain active.
- **Security and engineering status:** Private Cloud Run IAM plus distinct worker secret remain required, and the browser uses owner analysis token. The Netlify preview must be freshly built with the new environment variables before testing any one-click flow. A documentation-only dev commit may trigger Netlify PR preview build but is **not proof that preview was rebuilt or connected**. Do not merge experimental app code to `main`. Workload Identity Federation would reduce risk compared with long-lived JSON credentials.
- **Cost:** Owner explicitly authorised experimental deployment after discussing an approximate £5 testing **target**, not a guaranteed hard cap. Cloud Run, Cloud Build, Artifact Registry, Secret Manager and logging may bill independently; check actual charges in Google Cloud. Scale-to-zero cold starts and the current Netlify ~55-second endpoint timeout still need live integrated latency verification.
- **Next gate:** Verify new deploy-preview revision includes fresh environment context, perform a private, synthetic **browser → Netlify Function → Google IAM → real worker → audited PES/DST → automatic ZIP** test; verify failure cases without leaking any secret; then real owner-image quality review and physical stitch-out. Current production application status unchanged.

### 2026-10-29 — Preview environment isolation regression fixed; Netlify deploy-preview ready (MD-2.23)

- Owner confirms downloaded Google service-account JSON deleted from phone and clipboard cleared; managed Google IAM key and secret Netlify deploy-preview environment variable remain deliberately active (do not revoke without replacing).
- User-saved `STITCH_FORGE_CLOUD_RUN_CALLER_JSON` plus existing Cloud Run URL/worker token are available only as **redacted, non-empty, secret-protected** Netlify deploy-preview variables. Secret contents have not been inspected and should never be logged or shown.
- Pushing documentation-only source head `b472b3e34b5ad1ac8f71c3b2d5c8aa5dfa5889fa` triggered [Netlify preview build 6ae302e2536387331c63880d](https://app.netlify.com/projects/sapiver-stitchforge/deploys/6ae302e2536387331c63880d), **FAILED (build exit 2)**. Regression cause identified from code inspection: `tests/test_machine_endpoint.mjs`'s mocked `native.example.test` endpoint case retained the real preview Google caller credential, causing the production fail-closed host check to return 503 instead of expected 200. Build log itself was unavailable via connected tools; this is a source-backed diagnosis supported by the next passing build.
- **Fixed only development tests** in `1161e3be09475ad7337f0970158faec639d2a2d7` by deleting any inherited Cloud Run caller secret before each synthetic endpoint test. No credentials were sent to tests or any third-party host. [Netlify preview build 6ae30373ccc40afa0b1729d6](https://app.netlify.com/projects/sapiver-stitchforge/deploys/6ae30373ccc40afa0b1729d6) **READY**, verified via Netlify deploy metadata on the exact fix SHA. Production site/app unchanged.
- **Remaining acceptance:** A READY static preview is *not yet* real server-to-server Netlify → Google OAuth → IAM → Ink/Stitch evidence; must test from preview with authorised owner access, a synthetic image/geometry, real machine ZIP and independent decoding, without exposing any secrets. Google Cloud hosted engine real JSON/PES/DST tests already passed; avoid spending without necessity. Private Google credential long-lived; plan replacement with federation after end-to-end testing. No actual physical stitch-out performed.
 
### 2026-10-29 — AI plan invalid-model-geometry recovery for general artwork (MD-2.24)

- **Observed owner failure:** Stitch Forge development preview returned `INVALID_MODEL_GEOMETRY`, “model returned unsafe or incomplete shapes,” with no change to the design. Image-to-geometry plan was rejected before pixel reconstruction or the separate Cloud Run Ink/Stitch worker was contacted. The live model output itself was not exposed, so its exact failing field cannot be asserted from the screenshot alone.
- **Code-level input restrictions diagnosed:** `verifyGeometryPlan` and browser `checkedRegion` required **5 vertices for every fill**, wrongly rejecting valid rectangles with four corners. The backend also outright rejected a redundant closing vertex (even if the source polygon was otherwise correct). Both issues affect general logos, botanical artwork, animals and graphics, not just the owner's current design.
- **Development fixes** (no main app changes): `netlify/functions/reconstruct-embroidery.mjs` now accepts **4-corner fills**, removes **exact consecutive and terminal duplicate points** deterministically before strict region validation, always enforces `requires_machine_test`, retains strict 0–1000 integer coordinate bounds, and skips unfixable invalid individual regions with `model_rejected_count` plus non-sensitive reason codes. It does **not** invent/move geometry, fill holes or make bad coordinates valid; all-invalid plans still fail closed. `site/auto-reconstruct.js` accepts genuine four-corner polygons. `site/auto-reconstruct-ui.js` allows review of any partial image-grounded draft but **blocks automated PES/DST machine ZIP** if either the model stage or source-pixel stage rejected any regions.
- **Regression tests** in `tests/test_auto_ai_endpoint.mjs` cover exact duplicate/closed-loop repair, supported four-corner fills, invalid regions and out-of-bounds rejection, and duplicate region IDs. Development code head `c5240c25efae3409b7b9d1ad688427ea82d95f91`; Netlify deploy preview `6ae3076e24d498237aaf195f` independently verified **READY** with new configuration. GitHub AI region safety workflow `40844324853` **success**. Remaining workflows were in progress at time of note; recheck before full release.
- **Next gate:** Re-run the same original image in a fresh preview session (refresh page first), note whether the AI returns usable regions and how many are skipped, validate pixel shapes, then independently verify real Cloud Run PES/DST ZIP and physical stitch-out. No new public production deployment or physical quality approval.
 
### 2026-10-29 — Detailed embroidery analysis, free software research, strict no-deploy (MD-2.25, feature branch only)

- **Owner constraints:** Minimise further expenditure; some pence per genuinely necessary image analysis may be acceptable. Do **not** run Netlify deployments without express owner authorisation. Avoid new chargeable services, unnecessary OpenAI requests or Cloud Run invocations.
- **Engineering separation:** Created `feature/detailed-embroidery-analysis-no-deploy` from `develop/stitch-engine-foundation`. No PR, no main or development integration, no Netlify deployment requested. Commits include `[skip netlify]`. Netlify's documented skip convention also depends on whether a branch PR is opened; do not open one without approval. This master entry intentionally remains on the feature branch, not the Netlify-linked dev/main branches.
- **Code implemented:** `site/auto-reconstruct.js` adds a browser-side, deterministic `analyseArtwork` that reports prominent RGB colours, detail/edge density and local grid hotspots. Existing image-grounded region reconstruction now preserves distinct supported colour sub-areas instead of always treating a mixed-colour proposal as a single connected fill; old conservative fallback is retained for uncertain swatches and mono art. `site/auto-reconstruct-ui.js` reuses the same 512px source canvas, shows the local scan and **still makes only one AI request**. `netlify/functions/reconstruct-embroidery.mjs` gives the existing structured model more explicit part inventory/overlap instructions; no model/version/API call count change.
- **Tests executed:** All **13/13** `tests/test_auto_reconstruct.cjs` cases passed in an isolated V8 harness using actual fetched feature-branch source and assertion shims, including the new two-colour region reconstruction test. No GitHub Actions workflow or paid service invocation; future CI and browser integration still required before claiming robustness.
- **Open-source technology review:** Considered VTracer (MIT OR Apache-2.0), OpenCV >=4.5 (Apache-2.0), scikit-image (permissive), rembg (MIT source, model-dependent licensing/performance), Meta SAM 2 (Apache-2.0 but heavier inference), GPL-3.0 Lilo (reference architecture only), and existing Ink/Stitch / pyembroidery. Best next **benchmarked experiment** is VTracer colour vectorisation, preferably client-side WebAssembly if Android memory/CPU/bundle costs permit. Do not integrate GPL application code without licence review, or install packages into existing billable Cloud Run service prematurely.
- **Documentation:** `docs/EMBROIDERY_OPEN_SOURCE_PIPELINE.md` lists software, licences, fixed synthetic acceptance dataset, memory/performance/region fidelity tests, and no-deploy/no-new-cost gate.
- **Still incomplete:** Thorough high-resolution fine-detail reconstruction, semantic segmentation, stitch planning for satin/underlay/colour order/compensation, mobile performance testing, actual Kingfisher/detailed wildlife benchmark, end-to-end machine file validation, and physical sew-out. No claim of professional automatic digitisation readiness.

### 2026-10-29 — Offline VTracer baseline benchmark harness and execution, no deployment (MD-2.26, feature branch only)

- The owner authorised further engineering but explicitly prohibited all Netlify deployments without their authorisation, while requesting minimal costs.
- On **only** `feature/detailed-embroidery-analysis-no-deploy`, added `tools/bench_vectorise.py`, a deterministic offline synthetic-vectorisation harness and five test fixtures. Uses OpenCV (supplied exact fixture colours), CairoSVG/Pillow to decode generated SVG output, and measures per-region IoU, foreground IoU, RGB error, SVG path count and duration. The harness automatically includes VTracer `1.0.0a4` **only when available**, reporting `vtracer_benchmarked=false` otherwise.
- Executed the harness locally with Python 3.13.5, numpy 2.3.5, OpenCV 4.13.0, Pillow 12.3.0 and CairoSVG 2.8.2. **OpenCV oracle-palette macro colour IoU**: four-colour logo **0.9265**, botanical **0.9105**, stylised bird **0.6989**, thin 2px detail **0.7809**. Foreground IoU: 0.9694, 0.9618, 0.9413, 0.8606 respectively. Complex textured-background fixture intentionally rejected by border-uniformity preflight; false safety interpretation of high red-region IoU prevented. **The OpenCV baseline receives the ideal source palette and is not a fair unsupervised model comparison or stitch quality score.**
- **VTracer was not installed or benchmarked**: package index DNS failed and attempted direct download of the published `vtracer-1.0.0a4` wheel failed. Do not report actual VTracer performance from this run. VTracer API/availability/licence researched using PyPI/GitHub docs. Its benchmark branch is ready to run without a paid model or hosted change when a trusted wheel is obtainable.
- All results, limitations, reproducibility commands, safety and cost gates logged in `docs/VECTORISATION_BASELINE_2026-10-29.md`. No OpenAI/Cloud Run/Netlify chargeable requests made, no subscriptions, **no Netlify deployment or PR**, no modification to deploy-linked `develop/stitch-engine-foundation` or production `main`.
- **Next decisions:** Benchmark VTracer truly on same synthetic inputs, then evaluate memory/cold-start and fine detail on Android before considering local WASM use. Even if vectorization is excellent, professional stitch planning and physical validation remain separate gates.

### 2026-10-29 — Actual VTracer/scikit-image comparison and browser WASM (MD-2.27)

- Branch: only `feature/detailed-embroidery-analysis-no-deploy`, starting at `463851176b3dd9f5c8183380e6cc8e09e8a54989`; no PR change.
- Added extended benchmark, optional dependency pins, metric regression tests, reproducible WASM evaluation harness and raw JSON results. Original benchmark remains intact.
- Actual VTracer installed from package registry; official upstream package references verified. OpenCV oracle, VTracer baseline/detail, scikit-image oracle, quantised marching and Felzenszwalb executed on eight synthetic fixtures. All 48 rows completed, 144 traces. No invented real-wildlife result.
- Browser WASM module 668,378 bytes; desktop Chromium evaluation at four resolutions. Node-target loader adapted only inside test harness; not a production browser integration.
- See `docs/VECTORISATION_EVALUATION_2026-10-29.md` for exact results, parameters, limitations and commands.
- Deployment/charges: none. No hosted tests, new subscriptions or model calls. Feature branch has no open PR. Existing draft PR #1 still targets the integration branch and is not modified.

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
