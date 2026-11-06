"""Local-only mobile browser acceptance for the isolated stage reviewer."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class StagedMobileReviewBrowserTests(unittest.TestCase):
    def test_phone_review_upload_steps_and_download_original_bound_decisions(self):
        bundle={
          "schema":"stitch-forge-offline-stage-review-v1",
          "sourcePlanSignature":"a"*64,
          "sourceSha256":"b"*64,
          "counts":{"tatami":3,"satin":0,"running":2},
          "dataOnly":True,"originalImageIncluded":False,"machineApproved":False,
          "candidates":[{
            "sourceObjectId":"114488-0","method":"curved",
            "color":"#114488",
            "estimatedFootprintAreaFraction":.59,
            "sourceGeometryStrictlyContained":True,
            "originalWorkingPixelsChanged":False,
            "fabricSewoutVerified":False
          }]
        }
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={"width":390,"height":844},
                                  device_scale_factor=2,accept_downloads=True,is_mobile=True,
                                  has_touch=True)
            errors=[]
            page.on("pageerror",lambda e: errors.append(str(e)))
            page.goto((ROOT/"site"/"staged-review.html").resolve().as_uri())
            self.assertTrue(page.locator("#next").is_disabled())
            page.locator("#file").set_input_files({
              "name":"stage-review-bundle.json","mimeType":"application/json",
              "buffer":json.dumps(bundle).encode()
            })
            self.assertIn("Verified report",page.locator("#status").inner_text())
            page.locator("#next").click()  # Tatami
            self.assertEqual(page.locator("#tatamiCount").inner_text(),"3")
            page.locator("#next").click()  # Satin
            page.locator("#candidateList input[type=checkbox]").check()
            page.locator("#next").click()  # Running
            self.assertEqual(page.locator("#runningCount").inner_text(),"2")
            page.locator("#next").click()  # Choices
            self.assertIn("1 satin candidates",page.locator("#summary").inner_text())
            with TemporaryDirectory() as tmp:
                with page.expect_download() as info:
                    page.locator("#download").click()
                download=info.value
                saved=Path(tmp)/"decisions.json"
                download.save_as(str(saved))
                result=json.loads(saved.read_text())
            self.assertEqual(result["schema"],"stitch-forge-offline-stage-decisions-v1")
            self.assertEqual(result["sourcePlanSignature"],bundle["sourcePlanSignature"])
            self.assertEqual(result["sourceSha256"],bundle["sourceSha256"])
            self.assertEqual(result["choices"],
                             [{"sourceObjectId":"114488-0","method":"curved"}])
            self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
            self.assertFalse(errors,errors)
            browser.close()


if __name__=="__main__":
    unittest.main()
