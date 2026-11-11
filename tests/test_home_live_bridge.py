"""Regression for the actual browser packet -> Home hybrid worker boundary.

Offline tests do not imply machine sew-out or a hosted deployment.
"""
import base64
import gzip
from hashlib import sha256
import json
import struct
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"services"/"digitiser"))
from artwork_packet import decode_packet, foreground, regions_from_labels
from home_live_bridge import derive_hybrid_plan, PROFILE


def illustration(background="transparent"):
    image = Image.new("RGBA", (232, 200),
                      (0, 0, 0, 0) if background == "transparent" else
                      (255, 255, 255, 255))
    d = ImageDraw.Draw(image)
    d.ellipse((22, 14, 161, 174), fill=(9, 98, 150, 255))
    d.polygon([(40, 117), (118, 48), (111, 165)], fill=(29, 149, 192, 255))
    d.ellipse((80, 54, 158, 145), fill=(238, 121, 19, 255))
    d.ellipse((119, 25, 130, 36), fill=(19, 21, 24, 255))
    d.line([(5, 185), (222, 171)], fill=(103, 71, 37, 255), width=9)
    d.ellipse((167, 132, 218, 171), fill=(46, 109, 50, 255))
    d.ellipse((176, 138, 215, 158), fill=(75, 143, 67, 255))
    return image


def browser_packet(image, *, full_image=False):
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    h, w = rgba.shape[:2]
    source = rgba.tobytes()
    mask = foreground(rgba, full_image=full_image)
    # A real original-pixel proposal from the current website can be crude;
    # the worker must reconstruct its own palette rather than trusting it.
    labels = mask.astype(np.uint8).tobytes()
    header = json.dumps({
        "schema": "stitch-forge-artwork-request-v1",
        "source": {
            "sha256": sha256(struct.pack(">II", w, h) + source).hexdigest(),
            "width": w, "height": h,
            "originalWidth": w, "originalHeight": h
        },
        "imageWidthMm": 80,
        "palette": ["#123456"],
        "foregroundPixels": int(mask.sum()),
        "preparationSignature": sha256(b"untrusted-visual-proposal").hexdigest(),
        "texturePolicy": "if_needed",
    }, separators=(",", ":"))
    rid = sha256(header.encode() + source + labels).hexdigest()
    return {
        "header": header,
        "rgbaGzip": base64.b64encode(gzip.compress(source, mtime=0)).decode(),
        "labelsGzip": base64.b64encode(gzip.compress(labels, mtime=0)).decode(),
        "requestId": rid,
        "phase": "pes",
    }


class LiveHybridBoundaryTests(unittest.TestCase):
    def test_current_browser_packet_is_preserved_but_working_plan_changes(self):
        packet = browser_packet(illustration())
        old, meta, identity, original_binding = decode_packet(packet)
        self.assertGreaterEqual(old["summary"]["workingParts"], 1)
        derived, bound, report = derive_hybrid_plan(
            packet, old, meta, identity, original_binding)
        self.assertEqual(derived["source"], old["source"])
        self.assertEqual(derived["physical"], old["physical"])
        self.assertNotEqual(derived["sourcePlanSignature"], identity)
        self.assertGreater(derived["summary"]["workingParts"], 1)
        self.assertEqual(derived["summary"]["sourcePixels"],
                         old["summary"]["sourcePixels"])
        self.assertTrue(bound["foregroundIndependentlyVerified"])
        self.assertTrue(bound["clientObjectAlgorithmRecomputed"])
        self.assertEqual(report["profile"], PROFILE)
        self.assertTrue(report["sourceForegroundPreserved"])
        self.assertFalse(report["machineApproved"])
        self.assertFalse(report["physicalSewoutVerified"])
        palette = sorted(x["color"] for x in derived["regions"])
        self.assertEqual(len(palette), len(set(palette)))
        self.assertTrue(1 <= len(palette) <= 12)
        self.assertEqual(derived["summary"]["sourcePixels"],
                         sum(x["ledger"]["foregroundPixels"] for x in derived["regions"]))
        second, binding2, report2 = derive_hybrid_plan(
            packet, old, meta, identity, original_binding)
        self.assertEqual(derived, second)
        self.assertEqual(bound, binding2)
        self.assertEqual(report, report2)

    def test_plain_background_jpg_like_source_preserves_original_foreground(self):
        image = illustration("opaque")
        packet = browser_packet(image)
        old, meta, identity, binding = decode_packet(packet)
        new, _, proof = derive_hybrid_plan(packet, old, meta, identity, binding)
        self.assertEqual(new["source"], old["source"])
        self.assertEqual(new["physical"], old["physical"])
        self.assertEqual(new["summary"]["sourcePixels"],
                         old["summary"]["sourcePixels"])
        self.assertTrue(proof["sourceForegroundPreserved"])

    def test_invalid_original_source_is_rejected_before_native_generation(self):
        packet = browser_packet(illustration())
        invalid = dict(packet)
        invalid["rgbaGzip"] = base64.b64encode(gzip.compress(b"tampered")).decode()
        with self.assertRaises(ValueError):
            decode_packet(invalid)

    def test_source_binding_is_enforced_before_worker_calls_hybrid(self):
        from artwork_service import process_phase
        packet = browser_packet(illustration())
        changed = dict(packet, requestId="0"*64)
        with patch("home_live_bridge.derive_hybrid_plan") as modified:
            with patch.dict("os.environ", {"STITCH_FORGE_HOME_HYBRID_ENABLED": "1"}):
                with self.assertRaises(ValueError):
                    process_phase(changed, executable=Path("/missing/engine"),
                                  secret="trial-secret")
        modified.assert_not_called()

    def test_live_phase_calls_hybrid_only_when_enabled(self):
        from artwork_service import process_phase
        packet = browser_packet(illustration())
        fake_svg = b"<svg>verified-native-stub</svg>"
        with patch("artwork_service.prepared", side_effect=lambda plan, _: (plan, fake_svg)):
            with patch("artwork_service.export_one", return_value=b"test-native-bytes"):
                with patch("home_live_bridge.derive_hybrid_plan", wraps=derive_hybrid_plan) as hybrid:
                    with patch.dict("os.environ", {"STITCH_FORGE_HOME_HYBRID_ENABLED": "1"}):
                        first = process_phase(packet, executable=Path("/missing/engine"),
                                              secret="trial-secret", epoch=1234)
                    self.assertEqual(hybrid.call_count, 1)
                    self.assertEqual(first["requestId"], packet["requestId"])
                    self.assertEqual(first["receipt"]["requestId"], packet["requestId"])
                with patch("home_live_bridge.derive_hybrid_plan") as hybrid:
                    with patch.dict("os.environ", {"STITCH_FORGE_HOME_HYBRID_ENABLED": "0"}):
                        first = process_phase(packet, executable=Path("/missing/engine"),
                                              secret="trial-secret", epoch=1234)
                    hybrid.assert_not_called()
                    self.assertEqual(first["requestId"], packet["requestId"])


if __name__ == "__main__":
    unittest.main()
