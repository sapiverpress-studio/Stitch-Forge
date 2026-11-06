"""Reversible, source-identical legacy Ink/Stitch object passes (offline trial).

Split ONLY an internally generated trusted SVG, not arbitrary uploaded SVG.
These passes are inspection artefacts. Native export still uses the original,
unchanged SVG and the existing independently audited export path.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from xml.etree import ElementTree as ET

STAGES = ("tatami", "satin", "running")
INK = "{http://inkstitch.org/namespace}"
MAX_OBJECTS = 1500


@dataclass(frozen=True)
class StagedLegacyPlan:
    native_svg: bytes
    stage_svgs: dict[str, bytes]
    manifest: dict


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _sha(data: bytes) -> str:
    return sha256(data).hexdigest()


def _kind(node: ET.Element) -> str:
    if _local(node.tag) != "path":
        raise ValueError("Only native artwork paths may be staged")
    satin = node.get(INK + "satin_column") == "true"
    fill = node.get("fill") not in (None, "none")
    stroke = node.get("stroke") not in (None, "none")
    if satin:
        if fill or not stroke or node.get(INK + "satin_method") != "satin_column":
            raise ValueError("Malformed native satin artwork path")
        return "satin"
    if fill == stroke:
        raise ValueError("Unsupported or mixed native stitch object")
    return "tatami" if fill else "running"


def _paths(svg: bytes) -> tuple[ET.Element, list[ET.Element]]:
    if not isinstance(svg, bytes) or len(svg) > 2_000_000:
        raise ValueError("Invalid trusted native SVG size")
    root = ET.fromstring(svg)
    if _local(root.tag) != "svg":
        raise ValueError("Expected trusted native SVG")
    children = list(root)
    if any(_local(child.tag) not in {"metadata", "defs", "use", "path"} for child in children):
        raise ValueError("Unexpected native root element")
    paths = [child for child in children if _local(child.tag) == "path"]
    if not 1 <= len(paths) <= MAX_OBJECTS:
        raise ValueError("Invalid staged native path count")
    ids = [node.get("id") for node in paths]
    if any(not x or len(x) > 80 for x in ids) or len(set(ids)) != len(ids):
        raise ValueError("Missing or duplicated native path ID")
    for node in paths:
        if list(node):
            raise ValueError("Nested native path content not supported")
        _kind(node)
    return root, paths


def _ids_and_hashes(svg: bytes) -> dict[str, str]:
    _, paths = _paths(svg)
    return {node.get("id"): _sha(ET.tostring(node, encoding="utf-8")) for node in paths}


def split_legacy_svg(native_svg: bytes) -> StagedLegacyPlan:
    """Create three independently inspectable object sets, preserving order.

    Underlay is part of its original fill object; extracting it as a separate
    shape would change its native order and risk stitching outside source.
    No stitch types are guessed or newly assigned at this stage.
    """
    _, original = _paths(native_svg)
    objects = [{"id": node.get("id"), "stage": _kind(node),
                "order": i, "objectSha256": _sha(ET.tostring(node, encoding="utf-8")),
                "underlay": node.get(INK + "fill_underlay") == "true"}
               for i, node in enumerate(original)]
    svgs = {}
    for stage in STAGES:
        # Re-parse to preserve original trusted metadata/defs/physical dimensions.
        root, _ = _paths(native_svg)
        for child in list(root):
            if _local(child.tag) == "path" and _kind(child) != stage:
                root.remove(child)
        svgs[stage] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    manifest = {
        "status": "EXPERIMENTAL_STAGES_NOT_MACHINE_APPROVED",
        "algorithm": "legacy_source_identical_native_pass_split_v1",
        "originalSvgSha256": _sha(native_svg),
        "combinedSvgSha256": _sha(native_svg),
        "geometryChanged": False,
        "stitchObjectOrderChanged": False,
        "sourceArtworkReanalysed": False,
        "nativeExportOrFabricTestPerformed": False,
        "counts": {stage: sum(o["stage"] == stage for o in objects) for stage in STAGES},
        "objects": objects,
        "limitations": [
            "This splits the previous native stitch plan; it does not infer feather, eye or leaf semantics.",
            "Satin may have zero objects; no false satin conversion is performed.",
            "Underlay stays inside its Tatami objects rather than becoming an independent sew order.",
            "Stage SVGs are for review only. Never export or sell individual passes as machine-ready files.",
            "Final PES/DST requires existing native source-containment audit and a physical sew-out."],
    }
    result = StagedLegacyPlan(native_svg, svgs, manifest)
    verify_legacy_stages(result)
    return result


def verify_legacy_stages(result: StagedLegacyPlan) -> None:
    """Reject dropped, duplicated or modified stage objects before native use."""
    if set(result.stage_svgs) != set(STAGES):
        raise ValueError("Incomplete stitch-stage set")
    original = _ids_and_hashes(result.native_svg)
    seen = {}
    for stage in STAGES:
        root = ET.fromstring(result.stage_svgs[stage])
        for node in root:
            if _local(node.tag) != "path":
                continue
            if _kind(node) != stage:
                raise ValueError("Native stitch path is in wrong stage")
            identifier = node.get("id")
            if identifier in seen:
                raise ValueError("Native stitch object duplicated across stages")
            seen[identifier] = _sha(ET.tostring(node, encoding="utf-8"))
    if seen != original or result.manifest["originalSvgSha256"] != _sha(result.native_svg):
        raise ValueError("Staged native objects differ from original source")
    if result.manifest["combinedSvgSha256"] != _sha(result.native_svg):
        raise ValueError("Combined native source hash changed")
