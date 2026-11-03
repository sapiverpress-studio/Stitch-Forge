"""Source-provenance gate for opt-in full-resolution PNG packets (MD-2.70).

The existing v1 packet remains supported. V2 binds the original PNG SHA256
inside the signed browser request identity and separately checks that it
depicts the SAME artwork as the reduced pixels the native engine actually sees.

Does not infer semantics or generate stitches. Does not log/save user images.
"""
from __future__ import annotations

import base64
from hashlib import sha256
from io import BytesIO

import numpy as np
from PIL import Image, UnidentifiedImageError

MAX_ORIGINAL_PNG_BYTES = 2_450_000
MAX_ORIGINAL_PIXELS = 12_000_000
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def verify_original_png(original_png_b64: str, metadata: dict,
                        reduced_rgba: np.ndarray) -> dict:
    """Return non-private evidence. Reject swapped/edited/downsampled sources.

    The original bytes are never placed in sourceBinding, native reports,
    generated SVG, public artifacts or a Git commit.
    """
    if (not isinstance(original_png_b64, str)
            or len(original_png_b64) > ((MAX_ORIGINAL_PNG_BYTES + 2) // 3) * 4
            or not isinstance(metadata, dict)
            or set(metadata) != {"sha256", "bytes"}):
        raise ValueError("Unbounded original PNG evidence")
    try:
        raw = base64.b64decode(original_png_b64, validate=True)
    except Exception as exc:
        raise ValueError("Invalid original PNG encoding") from exc
    if (not 100 <= len(raw) <= MAX_ORIGINAL_PNG_BYTES
            or not raw.startswith(PNG_SIGNATURE)
            or type(metadata.get("bytes")) is not int
            or len(raw) != metadata["bytes"]
            or not isinstance(metadata.get("sha256"), str)
            or sha256(raw).hexdigest() != metadata["sha256"]):
        raise ValueError("Original PNG source binding mismatch")
    if (not isinstance(reduced_rgba, np.ndarray)
            or reduced_rgba.dtype != np.uint8 or reduced_rgba.ndim != 3
            or reduced_rgba.shape[2] != 4 or reduced_rgba.size > 3_000_000):
        raise ValueError("Invalid reduced RGBA evidence")
    try:
        with Image.open(BytesIO(raw)) as original:
            if original.format != "PNG":
                raise ValueError("Original file is not PNG")
            width, height = original.size
            if width < 48 or height < 48 or width * height > MAX_ORIGINAL_PIXELS:
                raise ValueError("Original PNG pixel limit exceeded")
            # Never silently apply orientation, cropping or RGB compositing.
            # Browser source is a decoded/canvas RGB(A) image.
            image = original.convert("RGBA")
            target_h, target_w = reduced_rgba.shape[:2]
            if (width < target_w or height < target_h
                    or abs(width / height - target_w / target_h) > 2 / target_h):
                raise ValueError("Full PNG dimensions differ from working source")
            shrunk = np.asarray(image.resize((target_w, target_h),
                Image.Resampling.LANCZOS), dtype=np.uint8)
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("Unreadable original PNG") from exc
    # Do not compare invisible RGB garbage inside transparent pixels.
    # Browser canvas resamplers can differ, particularly at alpha boundaries.
    common = (shrunk[:, :, 3] >= 220) & (reduced_rgba[:, :, 3] >= 220)
    ref_fg = shrunk[:, :, 3] > 60
    target_fg = reduced_rgba[:, :, 3] > 60
    union = int(np.count_nonzero(ref_fg | target_fg))
    overlap = int(np.count_nonzero(ref_fg & target_fg))
    foreground_iou = overlap / max(1, union)
    if int(np.count_nonzero(common)) < 100 or foreground_iou < .94:
        raise ValueError("Original PNG and reduced source foreground differ")
    difference = np.abs(
        shrunk[:, :, :3][common].astype(np.int16)
        - reduced_rgba[:, :, :3][common].astype(np.int16))
    mean_difference = float(difference.mean())
    p90_difference = float(np.percentile(difference.max(axis=1), 90))
    if mean_difference > 18 or p90_difference > 48:
        raise ValueError("Original PNG does not match reduced source colours")
    return {
        "originalSourceSha256Verified": True,
        "originalPixelDimensionsVerified": [width, height],
        "originalPngBytesVerified": len(raw),
        "foregroundIntersectionOverUnion": round(foreground_iou, 5),
        "sourceToReducedMeanAbsoluteRgb": round(mean_difference, 3),
        "sourceToReducedP90MaxChannel": round(p90_difference, 3),
        "fullResolutionBytesAvailableToPrivateWorker": True,
        "originalPixelsSentToPublicGitHub": False,
        "sourceSemanticFeaturesVerified": False,
        "machineSewoutVerified": False,
    }
