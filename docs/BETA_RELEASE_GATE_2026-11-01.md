# Stitch Forge — 1 November 2026 beta readiness gate

**Status (31 October 2026): ENGINEERING BETA ONLY; do not label machine-approved or sell generated machine files.**

## User's fixed product goal

Automatic workflow: **Upload image → Generate embroidery → stitch playback → ZIP download**. Recognisable source silhouette and key internal features with generalised thread colours. No clip-art-only substitution, and no manual token re-entry after an approved single-device save. Native PES and DST are essential. The business owner does not physically sew; a real embroiderer must conduct sew-outs before sales.

## Last verified full kingfisher evidence (MD-2.55)

Source 1145×1374, analysis 320×384 at 80 mm width. Protected staging output `md255-kingfisher-20261031-213617-NOT-APPROVED.zip` is NOT a commercial result.

- 40,792 actual needle stitches; 1,348 PES trims; 1,350 PES jumps.
- 1,156 native SVG elements: 982 running + 174 filled; 921 unresolved small objects.
- One bounded native repair converted a **35 mm² orange fill** to running, so a valid file does not prove acceptable anatomical likeness.
- Across two versions at differing analysis resolutions, prior report showed 30,289 stitches, 1,055 PES trims and 243 fills. These are NOT a fair matched-resolution A/B comparison.
- Machine colour-source boundary audit passed (no outside-colour needle segments); this does not prove physical sewout or likeness.

## MD-2.56 experimental advance

Branch: `feature/beta-running-compaction-md256`. Research grounded in Ink/Stitch documentation for running stitch subpaths and autorouting:
- https://inkstitch.org/docs/stitches/running-stitch/
- https://inkstitch.org/docs/stroke-tools/

Conservatively group up to 10 **consecutive, identically styled, same-colour** running paths if their end-to-next-start transfer is <=1.5 mm. Emit separate `M` commands; never join gaps with sewn `L` geometry, recolour image pixels, change closed fills or reorder stitch elements. Remains opt-in through `STITCH_FORGE_BETA_COMPACT_RUNNING=1` on an **isolated** worker revision; default behavior is unchanged. Reference SVG experiment grouped 198 existing running elements into 122 compound groups, reducing **1,156 to 958 SVG elements**. This is an XML-path measurement, **not a stitch/trim improvement claim**; decoded PES/DST comparison is required before promotion.

## Hard go/no-go by 1 November, ~21:30 GMT

1. **Native source-bound two-phase test:** Ink/Stitch 3.3.0 genuine PES6 and DST, independent decoded needle sequence, zero outside-source-colour needle points/segments, hard stitch-density/length/size bounds, no invalid or unapproved package presented as machine-safe.
2. **Same kingfisher, identical analysis/source settings**: compare original MD-2.55 vs proposed experimental engine on stitched appearance, beak/eye, open wing/tail contours, orange body areas, unresolved critical features, running/fill share, trims/jumps and stitch count. Stop if grouping moves needle stitches outside colour regions or increases unsafe travel. Structural SVG element reduction alone is insufficient.
3. **Repair quality**: avoid claiming a 35 mm² filled anatomy region is adequately preserved after conversion to running stitches. Add a source-bound fill-preserving correction or retain a visible hard quality blocker.
4. **Functional UX**: upload → one Generate tap → actual decoded stitch animation → complete ZIP. Token saving must not expose raw API key or claim cross-device storage. Test mobile browser and failure states.
5. **Real sewout on intended fabric/stabiliser** required before machine-quality or commercial approval; this cannot be inferred from a simulator. Without this, **closed beta only**.

No Cloud Run traffic shift, Netlify deploy or live API changes without explicit user instruction. Builds and staging invoke Google Cloud charges; no extra costs until opt-in evidence supports a controlled trial.

## Evidence and release discipline

GitHub Actions test validates synthetic native engine and container HTTP. A green CI run does not substitute for the actual uploaded kingfisher A/B. Keep this handover and all code in GitHub; do not rely on individual chat history. If release gate fails, report the failed check and preserve production instead of launching as professional digitising.
