"""Regression tests for safe Cloud Shell kingfisher upload selection."""
import importlib.util
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "staged_md255_kingfisher.py"
spec = importlib.util.spec_from_file_location("staged_md255_kingfisher", SCRIPT)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class UploadSelectionTests(unittest.TestCase):
    def test_one_uploaded_image_is_selected(self):
        with TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            file = Path(d) / "file_original.png"
            file.write_bytes(b"kingfisher")
            self.assertEqual(helper.image_input(d), file)

    def test_four_exact_duplicate_uploads_do_not_fail_or_change_files(self):
        with TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            paths = [Path(d) / n for n in
                     ("file_original.png", "file_original (1).png",
                      "file_original (2).png", "file_original (3).png")]
            for file in paths:
                file.write_bytes(b"exact original flying kingfisher content")
            self.assertIn(helper.image_input(d), paths)
            self.assertEqual(len(list(Path(d).glob("file_*.png"))), 4)
            self.assertTrue(all(p.read_bytes() == b"exact original flying kingfisher content"
                                for p in paths))

    def test_different_images_fail_closed(self):
        with TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            (Path(d) / "file_a.png").write_bytes(b"kingfisher")
            (Path(d) / "file_b.png").write_bytes(b"different bird")
            with self.assertRaisesRegex(RuntimeError, "DIFFERENT contents"):
                helper.image_input(d)

    def test_explicit_selection_works_for_distinct_uploaded_images(self):
        with TemporaryDirectory() as d:
            a = Path(d) / "file_a.png"
            b = Path(d) / "file_b.png"
            a.write_bytes(b"original")
            b.write_bytes(b"alternative")
            with patch.dict(os.environ, {"STITCH_FORGE_SOURCE_IMAGE": str(a)}):
                self.assertEqual(helper.image_input(d), a.resolve())

    def test_explicit_selection_refuses_non_uploaded_path(self):
        with TemporaryDirectory() as d:
            a = Path(d) / "file_a.png"
            a.write_bytes(b"original")
            with patch.dict(os.environ, {"STITCH_FORGE_SOURCE_IMAGE": "/tmp/unrelated.png"}):
                with self.assertRaisesRegex(RuntimeError, "not an uploaded"):
                    helper.image_input(d)


if __name__ == "__main__":
    unittest.main()
