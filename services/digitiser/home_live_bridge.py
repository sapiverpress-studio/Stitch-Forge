"""Server-side Home hybrid integration for the EXISTING Netlify/Cloud Run workflow.

The live browser already supplies source-bound RGBA and proposed labels. Rebuild
the *working* 4-12-colour plan from the verified original pixels before either
native PES or DST phase, without changing the browser's source/request identity.

Only enable on a separately deployed private worker using
STITCH_FORGE_HOME_HYBRID_ENABLED=1. No paid AI call, new endpoint, front-end
deployment, source upload outside the existing private worker, or product approval.
"""
from __future__ import annotations

from hashlib import sha256
import json
import numpy as np
from PIL import Image

from artwork_packet import inflate, foreground, regions_from_labels
from hybrid_home import reconstruct


PROFILE = "MD-2.67_SERVER_HOME_HYBRID_TRIAL_NOT_APPROVED"


def derive_hybrid_plan(packet, original_plan, metadata, identity, original_binding):
    """Prepare original-source-faithful Home working masks from a verified packet.

    A complete decode_packet() MUST precede this call. Browser-proposed colours
    are not treated as trusted model inputs or as proof of hybrid success.
    The source SHA, physical frame, original foreground and request/receipt
    identity remain fixed; all substituted working colour masks are separately
    reconstructed and checked against the same original source pixels.
    """
    w = original_plan["source"]["width"]
    h = original_plan["source"]["height"]
    if w < 48 or h < 48 or w*h > 750000:
        raise ValueError("Hybrid input outside original worker geometry budget")
    original = np.frombuffer(inflate(packet["rgbaGzip"], w*h*4), np.uint8).reshape(h, w, 4)
    mask = foreground(original)
    if not np.any(mask) or int(mask.sum()) != original_plan["summary"]["sourcePixels"]:
        raise ValueError("Hybrid foreground differs from original independently verified mask")
    # Preserve original RGB for palette scoring, but give the SLIC proposer a
    # transparent mask exactly equal to the independent original worker mask.
    # This enables ordinary plain-background JPGs as well as alpha PNGs.
    prepared = original.copy()
    prepared[:, :, 3] = np.where(mask, 255, 0).astype(np.uint8)
    analysis = Image.fromarray(prepared, "RGBA")
    # <=320 px bounds CPU and preserves the experimentally tested MD-2.66
    # resolution. Working masks are then reconciled to *all* original pixels.
    reduced, palette, evidence = reconstruct(analysis, colours=9, max_side=320,
                                            design_width_mm=80)
    if not evidence["foregroundPreserved"]:
        raise ValueError("Hybrid candidate changed its analysis foreground")
    native_labels = np.asarray(Image.fromarray(reduced, "L").resize(
        (w, h), Image.Resampling.NEAREST), np.uint8).copy()
    native_labels[~mask] = 0
    missing = mask & (native_labels == 0)
    if np.any(missing):
        # The resized proposal can miss tiny disconnected source islands.
        # Fill only real source foreground pixels with their closest *existing*
        # candidate palette colour. No synthetic geometry or extra thread.
        samples = original[:, :, :3][missing].astype(np.int32)
        choices = np.asarray(palette, dtype=np.int32)
        distances = np.sum((samples[:, None, :] - choices[None, :, :])**2, axis=2)
        native_labels[missing] = np.argmin(distances, axis=1).astype(np.uint8) + 1
    if not np.array_equal(native_labels > 0, mask):
        raise ValueError("Hybrid reconstruction changed original source foreground")
    if np.any(native_labels[mask] > len(palette)):
        raise ValueError("Hybrid produced an unknown thread colour")
    # The browser and native code require sorted, unique, used palette colours.
    # A reduced palette cannot silently create a 13th machine colour.
    used = sorted(int(i) for i in np.unique(native_labels[mask]))
    if not 4 <= len(used) <= 12:
        raise ValueError("Hybrid lacks a usable Home thread palette")
    colours = ["#" + "".join(f"{int(x):02X}" for x in palette[i-1])
               for i in used]
    if len(set(colours)) != len(colours):
        raise ValueError("Hybrid output contains duplicate thread colours")
    sorted_colours = sorted(colours)
    remapped = np.zeros((h, w), dtype=np.uint8)
    for index, colour in zip(used, colours):
        remapped[native_labels == index] = sorted_colours.index(colour) + 1
    regions, components = regions_from_labels(remapped, sorted_colours)
    if not np.array_equal(remapped > 0, mask) or components <= 0:
        raise ValueError("Hybrid lost source pixels during colour ownership")
    new_plan = dict(original_plan)
    new_plan["regions"] = regions
    new_plan["summary"] = dict(original_plan["summary"])
    new_plan["summary"].update(sourceParts=components, workingParts=components,
                               representedPixels=int(mask.sum()), omittedPixels=0)
    new_plan["sourcePlanSignature"] = sha256(
        b"STITCH_FORGE_MD267_WORKING_PLAN_V1\\x00" + identity.encode("ascii")
        + bytes(remapped.ravel()) + "|".join(sorted_colours).encode("ascii")
    ).hexdigest()
    new_plan["machineEligible"] = False
    palette_rgb = np.asarray(
        [[int(c[k:k+2], 16) for k in (1, 3, 5)] for c in sorted_colours], dtype=float)
    original_rgb = original[:, :, :3][mask].astype(float)
    working_rgb = palette_rgb[remapped[mask]-1]
    distance = np.sqrt(np.sum((original_rgb-working_rgb)**2, axis=1))
    binding = dict(original_binding)
    binding.update(
        clientObjectAlgorithmRecomputed=True,
        clientProposedPaletteOverridden=True,
        homeHybridProfile=PROFILE,
        sourceMeanRgbDistance=float(np.mean(distance)),
        sourcePixelsBeyondRgb60=int(np.sum(distance > 60)),
    )
    info = {
        "profile": PROFILE,
        "enabledForThisNativeJob": True,
        "sourceImageSha256": original_plan["source"]["sha256"],
        "originalRequestIdPreserved": True,
        "sourceForegroundPreserved": True,
        "clientWorkingParts": original_plan["summary"]["workingParts"],
        "hybridWorkingParts": components,
        "hybridThreadColours": len(sorted_colours),
        "analysisLongestSide": max(reduced.shape),
        "nativeCanvasWidth": w,
        "nativeCanvasHeight": h,
        "sourceMeanRgbDistance": float(np.mean(distance)),
        "unresolvedSemanticDetail": True,
        "physicalSewoutVerified": False,
        "machineApproved": False,
    }
    return new_plan, binding, info
