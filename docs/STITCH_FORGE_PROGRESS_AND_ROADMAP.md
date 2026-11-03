# SAPIVER STITCH FORGE — VERIFIED PROGRESS, BLOCKERS AND ENGINEERING ROADMAP

> **LATEST MD-2.67 UPDATE (3 November 2026):** The existing browser source packet now invokes a source-grounded server Home hybrid in `artwork_service.process_phase` when `STITCH_FORGE_HOME_HYBRID_ENABLED=1`. Genuine native two-phase CI passed on synthetic, macaw, butterfly and rose (run [41590375479](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41590375479)). **Code-tested, not yet Cloud Run deployed/activated.** Owner needs ONE new Cloud Run worker build/deploy plus a traffic switch, not a Netlify redeploy. See [MD-2.67 actual integration, release helper and rollback](MD-2.67_LIVE_HYBRID_RELEASE.md). Older MD-2.66 branch-status statements below are historical snapshots, not current implementation status. Private Kingfisher likeness and fabric sew-out remain HOLD.

> **UPDATE — source merged into main, 2 November 2026:** By explicit owner instruction, MD-2.66 hybrid code/tests and all prior documentation were integrated into `main` in merge commit [26a87131](https://github.com/sapiverpress-studio/Stitch-Forge/commit/26a87131a0cc507ddb4d9a9314cd9e9c9d25b99f). This did **not** deploy or activate the hybrid: current Netlify production was independently observed on older source `3cd91d895b864f034528c0ee8f119e629f7ea794` (07:30 UTC), while Cloud Run active traffic remains unverified. The branch tables and "not merged" statements below describe the earlier **pre-merge snapshot** and should be interpreted historically. The original Kingfisher native A/B, fine detail quality and physical sew-out are STILL **HOLD**.

**Snapshot:** 2 November 2026 (UK)  
**Repository:** https://github.com/sapiverpress-studio/Stitch-Forge  
**Audience:** owner, future engineering sessions, embroidery testers and release reviewers  
**Status:** research/engineering prototype. **Not production-grade embroidery output; no commercial release approved.**  
**Document scope:** documentation and engineering plan only; no code promotion, Cloud Run traffic movement, Netlify deployment or machine approval is authorised by this document.

> **Read this first in any new ChatGPT engineering session.** The GitHub main branch is the current source-code/public-documentation baseline; the MD-2.66 Home hybrid is on a separate experimental feature branch. A passing native-file test is not a successful stitch-out. Verify current branches, recent CI and actual hosted deployment before acting; this snapshot is not a live status service.

## 1. Executive position

The project has reached a meaningful technical milestone: a private native digitising pipeline generates real **PES6 and DST** using the officially pinned **Ink/Stitch 3.3.0** runtime, then independently decodes and audits stitch-command geometry and file validity. A new **Home hybrid** candidate uses spatial/colour reconstruction and source-supported edge recovery to produce a more compact shape-and-colour plan for detailed illustrations. Native CI has passed on three different licensed illustrations.

**The commercial objective has not been met yet.** The key missing proof is that the user's original **Kingfisher** becomes visually recognisable, well-routed embroidery that can actually sew reliably on a home machine. Native format compliance, safety containment and a recognisable vector preview are necessary but insufficient. **Professional Detail** is a later tier, not something to launch alongside an unproven Home engine.

### Current checkpoints

| Dimension | Evidence-backed status | Why |
| --- | --- | --- |
| Genuine PES/DST generation | **VERIFIED in isolated native trials** | Official Ink/Stitch and independent decoding/audit on three CC0 illustrations |
| Source mask and colour containment | **VERIFIED for the three tested controls** | Zero reported out-of-colour stitch points/segments in their final PES/DST reports; same strict audit retained |
| Home hybrid segmentation/colour plan | **IMPLEMENTED, experimental** | Source-driven SLIC + CIELAB palette and bounded detail recovery; foreground, identity and fixed palette guards |
| General detailed-art likeness | **NOT VERIFIED** | Kingfisher eye, beak, wing/feather groups, greenery and source colour fidelity have not passed a source-identical native comparison |
| Fine-source-detail coverage | **BLOCKED on some examples** | Butterfly reports 39 unresolved small-detail objects; Macaw reports one |
| Trims/routing/underlay/density | **MEASURED in part; not machine-qualified** | PES trim counts and native settings exist, but no acceptable real-fabric range has been established |
| Real home-machine stitch-out | **NOT PERFORMED / NO APPROVAL** | No controlled documented sew-out of these hybrid files |
| Live Home hybrid deployment | **NOT DONE** | Experimental branch is isolated from main, and no MD-2.66 worker or site promotion was performed in this engineering sequence |
| Verified current live website/worker revision | **UNKNOWN in this snapshot** | Git repository and workflow history do not prove Netlify deployment ID or active Cloud Run traffic allocation |
| Home beta/commercial offering | **HOLD** | Needs expert physical and safety validation first |
| Professional Detail tier | **PLANNED ONLY** | Overlay/texture and professional stitch planning are not release-ready |

**Do not assign an invented completion percentage.** Readiness is gated by source fidelity, native audit, physical reliability and controlled release evidence, not the count of implemented features.

## 2. Authoritative branches and evidence

- **main** baseline as inspected for this report: commit **95dcb001f3f35d0b7c8704eeabe21be411bdfa14**. Main includes website features through MD-2.65 (user-supplied Sapiver branding, separate editable product name and safe named downloads). Main is not the new Home hybrid implementation.
- **feature/md266-home-hybrid-segmentation-no-deploy** as inspected: commit **389650a257835e9d7e38dee262ea5bb3470e6db7**. It contains the MD-2.66 hybrid and the final native SVG precision repair, plus its handover and tests. It must remain isolated until further gates pass.
- **Earlier MD-2.64 deployment preparations:** **docs/ENGINEERING_RELEASE_MD-2.64.md** and **docs/ENGINEERING_HANDOVER_MD-2.64.md**. Their documented 95/5 Cloud Run split is historic evidence, **not a claim about the currently live split**.
- **Main master:** **STITCH_FORGE_MASTER_DEVELOPMENT.md** (legacy engineering ledger; preserve history). The previous main header was stuck at MD-2.49 despite MD-2.65 work. Update the status header and link to this roadmap; don't erase its historical sections.
- **Experimental handover:** **docs/ENGINEERING_HANDOVER_MD-2.66.md**, on the experimental branch.
- **Provenance:** GitHub Actions execution evidence below. Intermediate red runs are development failures, not proof of release readiness; record why final checks passed.

**Source-of-truth precedence for engineering:** (1) exact source and tests at the checked branch SHA; (2) completed actions, decoded audit files and immutable trial evidence; (3) this dated roadmap and versioned handovers; (4) earlier narrative messages. Do not infer live status from a green GitHub check.

## 3. What is actually implemented

### 3.1 Main/front-end and native workflow

- Mobile-oriented simple workflow: upload artwork, request generation, display stitch animation/preview derived from independently audited native output and download a ZIP, with advanced controls elsewhere. These UI capabilities are in the repository; **the current live deployed site has not been retested here**.
- Independent design/product name in the UI, separate from the uploaded filename; bounded ASCII-safe output slug; named ZIP and optional individual PES/DST downloads; logo/favicons using the supplied Sapiver Press art. Internal native ZIP stitch bytes and machine receipt binding are deliberately not rewritten. See **MD-2.65**.
- Source image and requested physical dimensions are validated. MD-2.64 added **visible embroidered width** semantics to avoid transparent canvas padding shrinking the actual design. When a size would breach the trusted server frame constraints, it must be refused rather than silently distorted.
- Private native path uses source-bound packets/receipts, independent PES/DST validation and decoded stitch geometry tests. A background Netlify job/polling architecture was introduced for long native exports; use live revision checking before saying the hosted path works end-to-end.
- The native plan uses Tatami fills, running detail, conservative selective underlay on eligible wider fills and source-preserving routing experiments. None constitutes universal fabric-appropriate density or satin/feather semantics.

### 3.2 MD-2.66 Home hybrid, isolated feature branch only

- Offline SLIC (scikit-image) superpixel segmentation, deterministic CIELAB colour clustering, connected-region accounting and a limited nine-colour Home trial palette. This is an **engineering setting**, not a demonstrated optimum thread palette.
- Explicit original-foreground/source identity checks and independently reconstructed/validated source-colour packets through the existing worker contract; **no fabricated eyes/colours/shapes** are permitted.
- Source-supported compact-dark feature protection and bounded local edge recovery (Canny/source CIELAB checks); associated feature-edge retention audit. These are *geometric* controls, **not proven semantic detection** of pupils, individual feathers, leaves or animal anatomy.
- An opt-in private runner **tools/private_home_native_trial.py** requires a local source and a trusted already-installed Ink/Stitch executable; it keeps the source and output private. This is **not** a public upload or an automatic Cloud Run promotion.
- Native SVG hole/contour safety: the butterfly failure was traced to a sub-grid near-touching clipped hole becoming a self-intersecting fill path when serialized. Final **safe_native_svg_fill_path** corrects only eligible invalid formatted fill contours with a valid-single-polygon output and at most **0.001 mm²** symmetric-difference area from the original valid source geometry. Unsafe candidates retain the original unapproved trial geometry; unchanged decoder containment acceptance still rejects bad stitches.
- Exact source-mask, allowed colour, memory/time budgets and approval/HOLD rules must remain enforced. No "nearest colour" detail invention or hidden lowering of safety thresholds to produce a green test.

## 4. Reproducible measured results

**Real Ink/Stitch 3.3.0 native export and independent PES/DST audit — three licensed CC0 raster fixtures:**

| Fixture | Working colours | Working parts | Native paths | PES stitches | DST stitches | PES trims | Points/segments outside working colour | Unresolved detail objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Macaw | 9 | 52 | 51 | 13,031 | 13,031 | 98 | 0 / 0 | 1 |
| Butterfly | 9 | 79 | 139 | 14,348 | 14,348 | 205 | 0 / 0 | 39 |
| Rose | 6 | 38 | 38 | 11,623 | 11,623 | 68 | 0 / 0 | 0 |

These figures are output-specific and **not comparable as quality rankings** because source shapes and design complexity differ. No claim is made that 205 trims is acceptable on a user's home machine, that 39 unresolved details are visually unimportant, or that every native path translates into a well-sewn object.

- Macaw: https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326236 — **PASS** at engine commit **2a966a347b123e4f12c9d8110c9db5461ac71cf1**.
- Butterfly + Rose: https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326194 — **PASS** at the same engine commit.
- Offline preservation and precision regression: https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439467534 — **PASS** at **127a54eafef3d32289482037849aa7d6704d75ac**.
- Earlier butterfly failures: e.g. https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41429956616 and 41438923145. Those failed strict out-of-colour source containment; the final correction passed it. There were also temporary failing regression jobs during test development; the final green regression follows a corrected test coordinate-space expectation.
- All products are labelled **engineering trial, NOT APPROVED**. Passing PES/DST structural and geometrical checks must not be represented as a fabric-test pass.

### Kingfisher-specific findings

- Private original illustration: **1312 × 1199 RGBA**, held in the owner's ChatGPT file Library. **Do not upload, commit, embed in public issue/CI artifact, or publish this source** without explicit owner permission.
- Earlier offline hybrid trial at about 320 × 292 analysis pixels, nine colours, recorded **45,286 foreground pixels**, **3,668** direct per-pixel palette components versus **120** SLIC candidate regions. This compares against a naive nine-palette control, **not** against MD-2.64 native embroidery and not stitch counts.
- Source-guided compact-eye/edge recovery improved a local experimental edge-retention measure. The differing prior **28%, 44% and 87%** measurements refer to different candidate stages and **must not be misreported as one matched A/B**. The visible eye still had not passed likeness acceptance.
- A complete **source-identical, genuine Ink/Stitch PES/DST MD-2.64 versus MD-2.66** Kingfisher A/B, at identical visible design dimensions and with a controlled nine-colour palette comparison, remains **NOT VERIFIED**.
- Existing older MD-2.61/MD-2.62 private Kingfisher trials relate to previous routing approaches, **not** proof that the new hybrid has met its target.

## 5. High-priority unresolved problems and risks

1. **P0 — detailed-art source fidelity:** pupil/eye, beak separation, wing/feather-group boundaries, feet, dark accents and adjacent leaves can merge or disappear under a limited palette. A bird silhouette alone is insufficient. The design must not make unsupported semantic claims about detected parts.
2. **P0 — private native Kingfisher pass and A/B:** no verified full hybrid native Kingfisher PES/DST comparison with prior baseline. Failure must be diagnosed before changing release gates.
3. **P0 — fabric quality not tested:** pull compensation, local density, thread breakage, stabiliser compatibility, underlay, travel paths and registration are machine/material dependent. Native containment alone does not address these.
4. **P1 — unresolved small details:** Butterfly 39, Macaw one. Assess materiality by location/physical size, not just total count. Preserve explicit HOLD for missing critical features.
5. **P1 — travel and trim cost:** Butterfly 205 PES trims; measure time, travel lengths, jumps and unnecessarily split objects on source-identical tests. Don't select a change merely because it reduces trims if it damages source likeness or creates unsupported travel.
6. **P1 — source vs processed-palette accounting:** ensure simplification and thread approximations are logged against original RGBA evidence, not deceptively treated as unchanged colours. Independent source-identity and working-mask audits must remain separate.
7. **P1 — operational/live state unknown:** exact Netlify deployed SHA, Cloud Run revision and traffic, server feature flags, quotas and paid API side effects need direct confirmation before any rollout. Do not assume Git main = live.
8. **P1 — privacy, supply chain and costs:** private artwork retention and permissions; no secrets or tokens in CI; bounded file/pixel limits and untrusted inputs; pinned engine hashes, dependency licences and distribution implications. Open-source integration does **not** automatically mean a cost-free or legally unrestricted commercial product.
9. **P2 — business validation:** no verified demand, support cost, conversion rate, achievable export reliability or acceptable per-design hosting cost. A free tester programme is research, not proof of a sustainable business.
10. **P2 — documentation drift:** old main README and MD header historically described external native engines as merely proposals. This report supersedes that stale status while keeping dated engineering history intact.

## 6. Engineering roadmap: strict order, deliverables and exit gates

### Phase A — Lock a reproducible baseline (P0, no deploy)

**Action:** inspect clean exact main/feature SHAs, main UI/browser/worker tests, pinned dependencies, native CI and signed packet protocol; capture a known baseline from MD-2.64 plus MD-2.66 in separate local worktrees or isolated environments.

**Deliverables:** build manifest with SHA and version of all dependencies, CI run URLs, HMAC/packet schema compatibility matrix, no-secrets inventory, rollback reference; a Kingfisher source SHA stored **privately**, not in Git.

**Exit:** no unrecorded branch drift, no production changes, passing offline regressions, evidence that compares exact same source/dimensions/engine conditions.

### Phase B — Complete private Kingfisher full-native A/B (P0, no deploy)

**Action:** run the original Kingfisher through MD-2.64 and MD-2.66 using the **same image bytes, visible width (initially 80 mm), source alignment, and consistent documented output conditions**. Use a trusted locally installed Ink/Stitch 3.3.0 runtime. Keep source, generated SVGs, native files, reports and previews in a **private** workspace; never publish them in public GitHub Actions.

**Measure:** source hash; exact source-to-working-palette changes; visible size versus requested size; number and location of unresolved details; colour fidelity and feature-edge coverage; eye/beak/feather/foliage visibility; PES/DST stitch counts, native paths, thread changes, trims, jumps, decoded local density and long travel; independent source-colour containment. Include visual side-by-side original, palette working map and **actual decoded stitch geometry**, not a fake embroidery-texture render.

**Exit:** native files independently validate with zero out-of-colour points/segments; critical visible features survive and are visibly superior or at least not regressed versus the baseline; dimensions inside limits; no hidden colour additions; no unexplained structural errors. If it fails, record the smallest offending region and fix the **general algorithm**, not a Kingfisher-specific override.

**User action:** not necessary if the original remains privately accessible and a trusted local runtime is available. If neither can be accessed, request only the specific missing prerequisite.

### Phase C — Resolve detail preservation and stitch efficiency (P0/P1, no deploy)

**Action:** use failures from Phase B to improve source-grounded segmentation, component priority, thin features, hole/ring topology, source-aware layer separation and edge retention. Keep Home colour budget configurable and physically sensible. Avoid using a large AI/GPU dependency until a measured improvement justifies cost and operational complexity.

**Tests:** Kingfisher and at least macaw/butterfly/rose. Every change must pass independent source-mask, source-identity, no-invented-features, input limits and native two-format audits. Compare before/after actual decoded PES/DST, not simply candidate component counts.

**Exit:** critical feature checks pass with no native containment regression; no material new omitted features; trim/jump/density trade-offs quantified. Source detail must take precedence over cosmetic compression of object counts.

### Phase D — Controlled home-machine sew-out (P0, owner/tester coordination required)

**Action:** select a small, diverse set of **NOT APPROVED** design trials: simple control, bird/feather detail, contrasting flower or butterfly. Obtain an experienced embroidery operator; document machine model, format, hoop, physical width, needle, thread brand/weight, stabiliser, fabric, stitch time, trims, breaks, puckering, gaps, registration and photos. Observe source versus stitched likeness.

**Exit:** no unsafe/failed files; independent reviewer can identify defects and verify reliable completion across relevant fabrics. Fix repeatable issues, re-run the same controls and document change impact. A single pretty stitch-out is not a general production approval.

### Phase E — Controlled worker/site release candidate (P1, *owner approval required*)

**Action:** only after Phases A–D pass, prepare pinned worker build and exact rollback plan, test at 0% traffic if available/approved, verify signed source identity, Ink/Stitch binary hash, native receipts, limits and HTTP background job lifecycle. Then request explicit permission for any Cloud Build, traffic promotion or Netlify deployment. Revalidate visible sizing, named downloads, source metadata and the actual published SHA.

**Exit:** real hosted end-to-end trial on authenticated owner test input, signed identity and completed native export; traffic health and bounded costs verified; rollback rehearsed/documented; no unintended CI deploy. A GitHub push is **not** permission to deploy.

### Phase F — Closed Home beta and commercial evidence (P1/P2)

**Action:** recruit up to ten relevant home embroidery operators *after safety/quality evidence*, offer clearly labelled trial files free for testing and request source/stitch-out photos, machine/material notes and structured feedback. Obtain consent to use any photos. Track successful sew-outs, time, manual corrections needed, compatibility, failure types and support time.

**Exit:** define a realistic Home user promise (e.g. recognisable limited-colour embroidery, **not** photorealistic automation). Measure willingness to use/pay and total operational/support cost before selecting a paid, free or freemium model. No confident pricing or sales claim without evidence.

### Phase G — Professional Detail (P2, separate future work)

Only after Home is reliable: investigate explicit object-layer recognition, directional satin/tatami selection, source-grounded feather/vein detail overlays, controlled densities, underlay and fabric-specific compensation. Maintain original geometry binding and independent audits. This is a **new acceptance programme**, not a toggle that automatically makes existing Home outputs professional.

## 7. Acceptance checklist — every candidate and release

- [ ] Source SHA, full dimensions and privacy restrictions recorded.
- [ ] Working plan colours/alpha/feature changes explicitly reconciled against original source.
- [ ] Source-identical MD-2.64 / MD-2.66 Kingfisher native A/B with actual decoded PES **and** DST available privately.
- [ ] Critical Kingfisher features visibly retained and reviewed with source references; failures attributed to geometry.
- [ ] No unsupported colour/shape invention and no source-mask accounting drift.
- [ ] Zero independently audited out-of-colour needle points and stitched segments; no weakened source tolerance.
- [ ] Bounded native format/stitch-length/command-density checks pass; output dimensions correct.
- [ ] Stitch count, trims, jumps, thread sequence, underlay, unresolved details and operator interventions reported.
- [ ] At least two additional licensed contrasting designs retain passing native checks.
- [ ] Physical stitch-out evidence passes for intended fabric/machine/hoop context.
- [ ] Current live site SHA, actual Cloud Run revision/traffic and feature flag state are independently verified.
- [ ] Explicit owner approval recorded before any paid Cloud Build, Netlify deploy, traffic cutover, merge of experimental code or commercial claim.
- [ ] Rollback procedure, privacy/retention policy, external licence obligations and support/cost assumptions documented.

**Do not tick a box based on a preview, synthetic artwork alone, a valid PES header, green CI alone or a narrative assurance.**

## 8. Operating boundaries, spending and controls

- **Standard ChatGPT and existing GitHub connector** are enough for document updates, code inspection and much isolated coding. Do not consume Work credits without owner approval.
- Work on the experimental branch without merging it into main as a side effect of documentation. Keep code and deployment separated.
- Do **not** run Netlify deployments or Google Cloud Run deploy/traffic changes without explicit user approval. Documentation-only commits use **[skip netlify]** and no deploy workflows; independently confirm actual deploy behaviour whenever promotion is considered.
- No additional paid AI model, segmentation service, GPU server or commercial digitising library is approved by this document. Prefer pinned, auditable, free/open-source packages and small reversible trials.
- Keep private Kingfisher image and source-identifying artifacts **out of public GitHub**. Use consent-based test art and checksum-verified CC0 fixtures in public CI.
- Retain complete protected-worker/auth source checks, server-side secrets, file-size/pixel limits and bounded processing. No unsafe manual rewrite of PES/DST to circumvent the independent audit.
- Avoid a calendar-based promise. Engineering phase order is gated by evidence, not estimated completion dates.

## 9. Instructions for the next engineering session

1. Read **README.md**, **STITCH_FORGE_MASTER_DEVELOPMENT.md**, **this document**, **docs/ENGINEERING_HANDOVER_MD-2.64.md**, **docs/ENGINEERING_HANDOVER_MD-2.65.md**, **docs/ENGINEERING_HANDOVER_MD-2.66.md** on the hybrid branch, and current GitHub Actions/branch heads.
2. State exact source code baseline SHAs, verify Git working tree/CI, and distinguish in-code, CI-proven, live-deployed and physically tested behaviour.
3. Do **Phase A → Phase B** next. Prioritise a private authentic Kingfisher native comparison; do not add general UI features or a Professional tier before obtaining that evidence.
4. Update this plan's evidence table and blockers whenever tests change. Preserve dated history in master doc. Add exact commands, commit IDs, environment, artifacts, failures and rollback instructions; explicitly identify tests **not** run.
5. No live deployment, expensive cloud action, main code merge or user artwork publication unless separately authorised.

## 10. Direct evidence links

- [GitHub repository](https://github.com/sapiverpress-studio/Stitch-Forge)
- [Main source baseline](https://github.com/sapiverpress-studio/Stitch-Forge/tree/main)
- [MD-2.66 hybrid branch](https://github.com/sapiverpress-studio/Stitch-Forge/tree/feature/md266-home-hybrid-segmentation-no-deploy)
- [MD-2.66 engineering handover](https://github.com/sapiverpress-studio/Stitch-Forge/blob/feature/md266-home-hybrid-segmentation-no-deploy/docs/ENGINEERING_HANDOVER_MD-2.66.md)
- [MD-2.64 handover](https://github.com/sapiverpress-studio/Stitch-Forge/blob/main/docs/ENGINEERING_HANDOVER_MD-2.64.md)
- [MD-2.65 branding/named downloads](https://github.com/sapiverpress-studio/Stitch-Forge/blob/main/docs/ENGINEERING_HANDOVER_MD-2.65.md)
- [MD-2.64 controlled rollout plan](https://github.com/sapiverpress-studio/Stitch-Forge/blob/main/docs/ENGINEERING_RELEASE_MD-2.64.md)
- [Macaw genuine native audit CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326236)
- [Butterfly and rose genuine native audit CI](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439326194)
- [Final offline Home hybrid and precision regressions](https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41439467534)

**Final decision as at this snapshot:** continue isolated engineering; complete source-identical Kingfisher native A/B and controlled sew-out; **HOLD** Home release, Professional Detail, paid marketing claims, code merges and deployment until the necessary evidence and owner authorisation exist.
