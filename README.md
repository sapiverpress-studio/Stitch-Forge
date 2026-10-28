# Sapiver Stitch Forge

**Status: experimental engineering project — not a production-ready embroidery digitiser.**

Stitch Forge is a mobile-friendly embroidery digitising project intended to turn original artwork into editable stitch regions, generate machine embroidery formats, and provide a reliable validation process.

## Start here

- **[Master Development Document](STITCH_FORGE_MASTER_DEVELOPMENT.md)** — canonical status, verified progress, detailed backlog, acceptance criteria, risks, architecture, and dated development log.
- **[Contributor and documentation rules](CONTRIBUTING.md)** — progress reporting, testing standards, and mandatory document updates.
- **[Prototype branch](../../tree/develop/stitch-engine-foundation)** — isolated development work (created separately from the documentation baseline).

## Safety and status

The existing offline v0.3 browser prototype is an **engineering experiment**, not machine-certified software. It can import raster PNG/JPG and some SVGs including image-embedded SVGs, create a traced silhouette, offer basic running/bean/tatami stitch generation, simulate a stitch path, and write preliminary PES/DST exports. These outputs have **not** been stitch-tested on fabric. Detailed interior colours and artwork are **not automatically converted** into professional embroidery regions.

Do not advertise or sell its embroidery output as machine-ready until independent format inspection and physical test-stitch approval have passed.

## Architecture direction

Browser editor (touch-first) → separated digitising engine (evaluate [Ink/Stitch](https://inkstitch.org/)) → independent file inspection and conversion (evaluate [pyembroidery](https://github.com/EmbroidePy/pyembroidery)) → QA evidence → controlled exports.

External engines are proposed dependencies, **not yet integrated**. Licensing and deployment architecture require review before commercial distribution.

## Release principle

Nothing ships because it looks good in a simulator. Format validity, hoop limits, stitch behaviour, fabric testing and repeatable QA must all be established first.

Last documentation baseline: **2026-10-28**.
