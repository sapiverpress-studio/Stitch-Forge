"""Stitch Forge v0.3 regression tests. Structural checks are NOT physical stitch-out approval."""
import base64
import io
import json
import os
import struct
import unittest
import zipfile
import zlib
from pathlib import Path

from playwright.sync_api import sync_playwright

HTML = Path(__file__).resolve().parents[1] / "prototypes/stitch-forge-v0.3.html"


def synthetic_png():
    """A reproducible synthetic bitmap; no real user artwork stored in public fixtures."""
    w, h = 64, 48
    scan = bytearray()
    for y in range(h):
        scan.append(0)
        for x in range(w):
            ink = 10 <= x <= 54 and 13 <= y <= 34 and ((x-32)**2/23**2 + (y-24)**2/12**2) < 1
            scan.extend((20, 45, 85, 255) if ink else (255, 255, 255, 255))

    def chunk(tag, buf):
        return struct.pack(">I", len(buf)) + tag + buf + struct.pack(">I", zlib.crc32(tag + buf)&0xffffffff)

    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(scan)) + chunk(b"IEND", b""))


def dst_commands(data):
    assert data[:3] == b"LA:" and len(data) >= 515 and (len(data) - 512) % 3 == 0
    out = []
    x = y = 0
    ended = False
    for i in range(512, len(data), 3):
        a, b, c = data[i:i+3]
        if c == 0xf3:
            ended = True
            break
        assert c & 3 == 3 and c != 0xc3
        dx = (bool(a&1)-bool(a&2)) + 3*(bool(b&1)-bool(b&2)) + 9*(bool(a&4)-bool(a&8)) + 27*(bool(b&4)-bool(b&8)) + 81*(bool(c&4)-bool(c&8))
        dy = (bool(a&128)-bool(a&64)) + 3*(bool(b&128)-bool(b&64)) + 9*(bool(a&32)-bool(a&16)) + 27*(bool(b&32)-bool(b&16)) + 81*(bool(c&32)-bool(c&16))
        x += dx
        y -= dy
        out.append({"cmd":"JUMP" if c&128 else "STITCH", "x":x, "y":y})
    assert ended
    return out


def pes_commands(data):
    assert data[:8] == b"#PES0001"
    offset = struct.unpack_from("<I", data, 8)[0]
    assert data[offset:offset+3] == b"LA:"
    pblock = offset+512
    assert data[pblock+5:pblock+8] == b"\x31\xff\xf0"
    limit = pblock + int.from_bytes(data[pblock+2:pblock+5], "little")
    assert limit <= len(data)
    x = y = 0
    i = pblock+16
    out = []
    ended = False
    while i < limit:
        a = data[i]
        i += 1
        if a == 255:
            ended = True
            break
        if a == 254:
            assert data[i] == 176
            i += 2
            continue

        def delta(v, ix):
            if v & 128:
                z = ((v&15)<<8)|data[ix]
                return (z-4096 if z&2048 else z), bool(v&0x30), ix+1
            return (v-128 if v&64 else v), False, ix

        dx, jx, i = delta(a, i)
        dy, jy, i = delta(data[i], i+1)
        x += dx
        y += dy
        out.append({"cmd":"JUMP" if jx or jy else "STITCH", "x":x, "y":y})
    assert ended
    return out


def matches_plan(test, decoded, commands, fmt):
    """PES may insert a zero-distance sew record when resuming after a jump."""
    k = 0
    for command in decoded:
        if k < len(commands) and command == commands[k]:
            k += 1
        elif fmt == "PES" and k and command["cmd"] == "STITCH" and all(command[a] == commands[k-1][a] for a in ("x", "y")):
            pass
        else:
            test.fail(f"{fmt} mismatched command {k}: {command!r}")
    test.assertEqual(k, len(commands), f"{fmt} dropped commands")


class PrototypeRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = sync_playwright().start()
        kwargs = {"headless":True,"args":["--no-sandbox"]}
        if os.environ.get("STITCH_FORGE_CHROMIUM"):
            kwargs["executable_path"] = os.environ["STITCH_FORGE_CHROMIUM"]
        cls.browser = cls.p.chromium.launch(**kwargs)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width":393,"height":852}, is_mobile=True, has_touch=True, accept_downloads=True)
        self.errors = []
        self.page.on("pageerror", lambda e:self.errors.append(str(e)))
        self.page.set_content(HTML.read_text(encoding="utf-8"))

    def tearDown(self):
        self.assertFalse(self.errors, self.errors)
        self.page.close()

    def plan(self):
        return self.page.evaluate("window.__stitchforge_test.generate()")

    def readback(self):
        plan = self.plan()
        b = self.page.evaluate("""() => {
            const p=window.__stitchforge_test.generate(), t=window.__stitchforge_test;
            return {dst:Array.from(t.makeDst(p)),pes:Array.from(t.makePes(p))}
        }""")
        matches_plan(self, dst_commands(bytes(b["dst"])), plan["commands"], "DST")
        matches_plan(self, pes_commands(bytes(b["pes"])), plan["commands"], "PES")

    def test_mobile_playback_controls_and_restart(self):
        canvas = self.page.locator("#design").bounding_box()
        play = self.page.locator("#playBtn").bounding_box()
        self.assertLess(play["y"]-canvas["y"]-canvas["height"], 50)
        self.page.locator("#speed").select_option("8")
        self.page.locator("#playBtn").click()
        self.page.wait_for_timeout(500)
        progress = int(self.page.locator("#progressText").inner_text().split("/")[0])
        self.assertTrue(1 <= progress < 9)
        self.page.locator("#playBtn").click()
        self.page.locator("#showAllBtn").click()
        self.assertEqual(self.page.locator("#progress").input_value(), self.page.locator("#progress").get_attribute("max"))
        self.page.locator("#restartBtn").click()
        self.assertEqual(self.page.locator("#progress").input_value(), "0")

    def test_fox_pes_and_dst_roundtrip(self):
        self.assertEqual(len(self.plan()["commands"]), 225)
        self.readback()

    def test_pyembroidery_external_reader(self):
        # A separate, maintained library must be able to read our machine-file headers.
        # This checks binary readability, NOT physical stitch quality or compatibility.
        import pyembroidery
        data = self.page.evaluate("""() => {
            const p=window.__stitchforge_test.generate(), t=window.__stitchforge_test;
            return {dst:Array.from(t.makeDst(p)),pes:Array.from(t.makePes(p))}
        }""")
        for fmt in ("dst", "pes"):
            reader = getattr(pyembroidery, "read_"+fmt)
            result = reader(io.BytesIO(bytes(data[fmt])))
            self.assertIsNotNone(result, fmt)
            self.assertGreater(len(result.stitches), 100, fmt)

    def test_embedded_png_svg_tracing_fill_and_zip(self):
        png = synthetic_png()
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">'
               '<image width="64" height="48" href="data:image/png;base64,'+
               base64.b64encode(png).decode()+'"/></svg>')
        self.page.locator("#importFile").set_input_files({"name":"synthetic.svg","mimeType":"image/svg+xml","buffer":svg.encode()})
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('Raster imported')")
        self.assertTrue(self.page.locator("#tracePanel").is_visible())
        self.assertGreaterEqual(len(self.page.evaluate("window.__stitchforge_test.paths")), 1)
        self.assertIn("NOT been digitised", self.page.locator("#status").inner_text())
        self.page.locator("#stitchMode").select_option("tatami")
        self.assertGreater(len(self.plan()["commands"]), 50)
        self.readback()
        with self.page.expect_download() as item:
            self.page.locator("#zipBtn").click()
        with zipfile.ZipFile(io.BytesIO(item.value.path().read_bytes())) as z:
            self.assertIsNone(z.testzip())
            self.assertEqual(len(z.namelist()), 5)
            self.assertEqual(json.loads(z.read("design_project.json"))["settings"]["style"],"tatami")
            self.assertIn("not been tested", z.read("READ_ME_FIRST.txt").decode())

    def test_malicious_svg_rejected_without_data_loss(self):
        before = self.page.evaluate("window.__stitchforge_test.paths")
        bad = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M1 1L20 20"/></svg>'
        self.page.locator("#importFile").set_input_files({"name":"bad.svg","mimeType":"image/svg+xml","buffer":bad})
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('Import')")
        self.assertIn("blocked", self.page.locator("#status").inner_text().lower())
        self.assertEqual(before, self.page.evaluate("window.__stitchforge_test.paths"))

    def test_corrupt_png_rejected_without_data_loss(self):
        before = self.page.evaluate("window.__stitchforge_test.paths")
        self.page.locator("#importFile").set_input_files({"name":"bad.png","mimeType":"image/png","buffer":b"NOT_A_PNG"})
        self.page.wait_for_function("document.querySelector('#status').textContent.includes('Import')")
        self.assertIn("blocked", self.page.locator("#status").inner_text().lower())
        self.assertEqual(before, self.page.evaluate("window.__stitchforge_test.paths"))

    def test_hoop_bounds_block_export(self):
        self.page.locator("#designWidth").fill("250")
        self.page.locator("#hoop").fill("100")
        self.page.locator("#dstBtn").click()
        self.assertIn("blocked", self.page.locator("#status").inner_text().lower())


if __name__ == "__main__":
    unittest.main()
