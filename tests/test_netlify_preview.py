"""Netlify static preview smoke test: source is functional, not machine approved."""
import os
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "site" / "index.html"
CONFIG = ROOT / "netlify.toml"


class NetlifyPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        opts = {"headless": True}
        if os.environ.get("STITCH_FORGE_CHROMIUM"):
            opts["executable_path"] = os.environ["STITCH_FORGE_CHROMIUM"]
        cls.browser = cls.playwright.chromium.launch(**opts)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_static_configuration_and_experimental_label(self):
        self.assertTrue(HTML.is_file())
        self.assertIn('publish = "site"', CONFIG.read_text())
        html = HTML.read_text()
        self.assertIn('noindex,nofollow', html)
        self.assertIn('Engineering preview, not a retail-ready digitiser', html)
        self.assertNotIn('No repository or deployment changes', html)

    def test_mobile_editor_and_stitch_playback(self):
        page = self.browser.new_page(viewport={"width": 390, "height": 844}, accept_downloads=True)
        try:
            failures = []
            page.on("pageerror", lambda err: failures.append(str(err)))
            page.set_content(HTML.read_text(), wait_until="load")
            self.assertEqual(page.locator("#stitchCount").inner_text(), "207")
            page.locator("#restartBtn").click()
            page.locator("#playBtn").click()
            page.wait_for_timeout(350)
            self.assertNotIn(page.locator("#progressText").inner_text(), ("0 / 0", "0 / 225"))
            self.assertEqual(failures, [])
        finally:
            page.close()

    def test_mobile_export_zip(self):
        page = self.browser.new_page(viewport={"width": 390, "height": 844}, accept_downloads=True)
        try:
            page.set_content(HTML.read_text(), wait_until="load")
            with page.expect_download(timeout=10000) as pending:
                page.locator("#zipBtn").click()
            self.assertTrue(pending.value.suggested_filename.endswith("_prototype.zip"))
        finally:
            page.close()
