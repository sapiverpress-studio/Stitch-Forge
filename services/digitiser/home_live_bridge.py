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
from io import BytesIO
import base64
import json
import os
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
    full_image = metadata.get('fullImage') is True
    mask = foreground(original, full_image=full_image)
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
    design_width_mm = original_plan['physical']['imageWidthMm'] if full_image else 80
    reduced, palette, evidence = reconstruct(analysis, colours=9, max_side=320,
                                            design_width_mm=design_width_mm, full_image=full_image)
    trial_source_dimensions=None
    if (os.environ.get('STITCH_FORGE_HIGH_RES_PLAN_TRIAL','0')=='1'
            and 'originalPngBase64' in packet
            and original_binding.get('originalSourceSha256Verified') is True):
        # Explicit offline A/B only. The original PNG was independently
        # verified by decode_packet before we use its source pixels here.
        raw=base64.b64decode(packet['originalPngBase64'],validate=True)
        with Image.open(BytesIO(raw)) as original_png:
            full=original_png.convert('RGBA')
            trial_source_dimensions=list(full.size)
        # This tests whether high-resolution source segmentation survives
        # quantisation to the existing *unchanged* native source frame.
        # It is NOT an assertion that the result looks better on fabric.
        reduced,palette,evidence=reconstruct(
            full,colours=9,max_side=640,superpixels=920,
            design_width_mm=float(original_plan['physical']['imageWidthMm']),full_image=full_image)
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
    palette_refit_evidence={'trialEnabled':False,'selectedByErrorAndPaletteGuard':False}
    if (os.environ.get('STITCH_FORGE_SOURCE_PALETTE_REFIT_TRIAL','0')=='1'
            and 'originalPngBase64' in packet
            and original_binding.get('originalSourceSha256Verified') is True):
        from source_palette_refit import refit_palette_from_original
        raw=base64.b64decode(packet['originalPngBase64'],validate=True)
        with Image.open(BytesIO(raw)) as source_png:
            rgba_full=np.asarray(source_png.convert('RGBA'),dtype=np.uint8)
        palette,palette_refit_evidence=refit_palette_from_original(
            rgba_full,original,native_labels,palette)
    # The browser and native code require sorted, unique, used palette colours.
    # A reduced palette cannot silently create a 13th machine colour.
    used = sorted(int(i) for i in np.unique(native_labels[mask]))
    if not 1 <= len(used) <= 12:
        raise ValueError("Hybrid has no usable thread colours")
    colours = ["#" + "".join(f"{int(x):02X}" for x in palette[i-1])
               for i in used]
    # Flat illustrations can legitimately have fewer than nine distinct
    # thread colours; merge identical quantised colours instead of inventing
    # different threads or failing the entire ordinary-image workflow.
    sorted_colours = sorted(set(colours))
    remapped = np.zeros((h, w), dtype=np.uint8)
    for index, colour in zip(used, colours):
        remapped[native_labels == index] = sorted_colours.index(colour) + 1
    detail_evidence = None
    if (os.environ.get('STITCH_FORGE_PRESERVE_FINE_DETAIL', '0') == '1'
            and original_binding.get('originalSourceSha256Verified') is True):
        from fine_detail_regions import preserve_fine_detail
        raw = base64.b64decode(packet['originalPngBase64'], validate=True)
        with Image.open(BytesIO(raw)) as source_png:
            source_pixels = np.asarray(source_png.convert('RGBA').resize((w, h), Image.Resampling.LANCZOS))
        remapped, detail_evidence = preserve_fine_detail(
            source_pixels[:, :, :3], mask, remapped, sorted_colours,
            original_plan['physical']['scaleMmPerPixel'])
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
        "highResolutionSourcePlanTrial": trial_source_dimensions is not None,
        "sourceFullResolutionDimensionsForPlan": trial_source_dimensions,
        "sourceOriginalWorkingMaskUnchanged": True,
        "sourcePaletteRefit": palette_refit_evidence,
        "nativeCanvasWidth": w,
        "nativeCanvasHeight": h,
        "sourceMeanRgbDistance": float(np.mean(distance)),
        "unresolvedSemanticDetail": True,
        "physicalSewoutVerified": False,
        "machineApproved": False,
    }
    if detail_evidence is not None:
        info['preserveFineDetail'] = detail_evidence
        if detail_evidence['selected']:
            info['analysisLongestSide'] = max(w, h)
            info['sourceFullResolutionDimensionsForPlan'] = original_binding['originalPixelDimensionsVerified']
    return new_plan, binding, info
