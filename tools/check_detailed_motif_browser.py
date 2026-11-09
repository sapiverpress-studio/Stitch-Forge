#!/usr/bin/env python3
"""Android-sized Chromium acceptance using a real hosted or loopback app.

The supplied private image stays in the browser during hosted preview smoke.
For native acceptance, provide the owner token via the local test environment.
"""
import argparse
import json
import os
from pathlib import Path
import tempfile
from zipfile import ZipFile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def run(url, artwork, out, executable=None, native=False, variant="body", black_satin=None):
    with sync_playwright() as p:
        chromium = p.chromium.launch(executable_path=executable, args=['--no-sandbox', '--disable-gpu'])
        context = chromium.new_context(**p.devices['Pixel 7'], accept_downloads=True)
        page = context.new_page()
        urls, errors = [], []
        page.on('request', lambda request: urls.append(request.url))
        page.on('pageerror', lambda error: errors.append(str(error)))
        response = page.goto(url, wait_until='domcontentloaded')
        assert response.status == 200
        get = lambda id: page.locator('#'+id)
        expect(get('sfQuickArtworkType')).to_have_value('simple')
        expect(get('sfQuickGenerate')).to_be_disabled()
        get('sfQuickArtworkType').select_option('detailed')
        with page.expect_file_chooser() as chooser:
            get('sfQuickUpload').click()
        chooser.value.set_files(str(artwork))
        expect(get('sfQuickOriginal')).to_be_visible()
        get('sfDetailedPrepare').click()
        expect(get('sfDetailedReview')).to_be_visible(timeout=20000)
        expect(get('sfDetailedPreset')).to_have_text('Smoother body fills')
        before = get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
        variants = [('balanced','Balanced'),('detail','Preserve more detail'),('clean','Fewer shapes'),('body','Smoother body fills')]
        for key, label in variants:
            get('sfDetailedRetry').click()
            expect(get('sfDetailedPreset')).to_have_text(label, timeout=20000)
            if key == 'balanced':
                balanced = get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
            if key == 'detail':
                assert balanced != get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
        assert before == get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
        if variant != 'body':
            for key,label in variants:
                get('sfDetailedRetry').click()
                expect(get('sfDetailedPreset')).to_have_text(label, timeout=20000)
                if key == variant:
                    break
        approved = get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
        expect(get('sfQuickGenerate')).to_be_hidden()
        expect(get('sfQuickZip')).to_be_disabled()
        assert not any('/api/' in url for url in urls)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        if black_satin is not None:
            expect(get('sfDetailedSatin')).to_be_checked()
            get('sfDetailedSatin').uncheck()
            expect(get('sfDetailedSatinOverlay')).to_be_hidden()
            get('sfDetailedApprove').click()
            expect(get('sfQuickGenerate')).to_be_enabled()
            if black_satin:
                get('sfDetailedSatin').check()
                expect(get('sfDetailedSatinOverlay')).to_be_visible()
                expect(get('sfDetailedPalette').locator('li').last).to_have_text('#000000')
                expect(get('sfQuickGenerate')).to_be_hidden()
                expect(get('sfQuickZip')).to_be_disabled()
        get('sfDetailedApprove').click()
        expect(get('sfQuickGenerate')).to_be_enabled()
        get('sfQuickGenerate').click()
        expect(get('sfQuickToken')).to_be_visible()
        assert not any('/api/' in url for url in urls)
        if native:
            rejected='wrong-local-test-value'
            page.evaluate('value=>window.StitchForgeTokenStore.save(value)',rejected)
            get('sfQuickToken').fill(rejected)
            get('sfQuickGenerate').click()
            expect(get('sfQuickStatus')).to_contain_text('Token rejected')
            expect(get('sfQuickToken')).to_have_value('')
            expect(get('sfQuickGenerate')).to_be_enabled()
            expect(get('sfDetailedReview')).to_be_visible()
            expect(get('sfQuickZip')).to_be_disabled()
            assert page.evaluate('window.StitchForgeTokenStore.read()')==''
            owner=os.environ['STITCH_FORGE_LOCAL_OWNER_TOKEN']
            get('sfQuickToken').fill(owner)
            get('sfQuickProductName').fill('Detailed motif acceptance')
            get('sfQuickGenerate').click()
            expect(get('sfQuickZip')).to_be_enabled(timeout=180000)
            assert page.evaluate('value=>window.StitchForgeTokenStore.read()===value',owner)
            expect(get('sfQuickCanvas')).to_be_visible()
            expect(get('sfQuickReplay')).to_be_enabled()
            get('sfQuickReplay').click()
            out.mkdir(parents=True, exist_ok=True)
            for button, ext in [('sfQuickPES','pes'),('sfQuickDST','dst'),('sfQuickZip','zip'),
                                ('sfDetailedSave','sfmotif')]:
                with page.expect_download(timeout=30000) as download:
                    get(button).click()
                download.value.save_as(out/('detailed-motif.'+ext))
            with ZipFile(out/'detailed-motif.zip') as bundle:
                assert bundle.testzip() is None
                for fmt in ['pes','dst']:
                    assert bundle.read('artwork-trial.'+fmt)==(out/('detailed-motif.'+fmt)).read_bytes()
                assert 'native-artwork-input.svg' in bundle.namelist()
                assert 'approved-illustration.png' in bundle.namelist()
                report = json.loads(bundle.read('machine-report.json'))
                if black_satin is not None:
                    assert bool(report.get('satinFinish')) == black_satin
                if black_satin:
                    assert report['satinFinish']['needleStitches'] > 0
                    assert b'inkstitch:satin_column="true"' in bundle.read('native-artwork-input.svg')
            page.reload(wait_until='domcontentloaded')
            with page.expect_file_chooser() as chooser:
                get('sfDetailedOpen').click()
            chooser.value.set_files(str(out/'detailed-motif.sfmotif'))
            expect(get('sfQuickStatus')).to_contain_text('Saved motif opened', timeout=30000)
            expect(get('sfQuickGenerate')).to_be_hidden()
            expect(get('sfQuickZip')).to_be_disabled()
            assert approved == get('sfDetailedAfter').evaluate('(canvas)=>canvas.toDataURL()')
            if black_satin is not None:
                assert get('sfDetailedSatin').is_checked() == black_satin
            get('sfDetailedApprove').click()
            get('sfQuickWidth').fill('90')
            expect(get('sfDetailedReview')).to_be_hidden()
            expect(get('sfQuickGenerate')).to_be_hidden()
        assert not any('/api/analyse-embroidery' in url or '/api/reconstruct-embroidery' in url for url in urls)
        assert not errors, errors
        print(json.dumps({'result':'PASS','device':'Pixel 7 Chromium emulation',
                          'viewport':page.viewport_size,'nativeDownloadAndReopen':native,'http':response.status,
                          'variant':variant,'blackSatin':black_satin}))
        chromium.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--image', type=Path, default=ROOT/'tests/fixtures/artwork-evaluation/macaw.png')
    parser.add_argument('--chromium')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--native', action='store_true')
    parser.add_argument('--variant', choices=['body','balanced','detail','clean'], default='body')
    parser.add_argument('--black-satin', action=argparse.BooleanOptionalAction, default=None)
    args = parser.parse_args()
    if args.native and not args.out:
        parser.error('--native requires --out')
    with tempfile.TemporaryDirectory() as tmp:
        run(args.url,args.image.resolve(),args.out or Path(tmp),args.chromium,args.native,args.variant,args.black_satin)
