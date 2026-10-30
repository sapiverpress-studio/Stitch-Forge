"""Source/auth transaction tests and actual native phases; synthetic controls."""
import base64
import copy
import gzip
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest import mock
import zipfile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/digitiser'))
try:
    import numpy as np
    from artwork_packet import decode_packet,foreground,strict_json
    from artwork_service import process_phase,signature,verify_receipt,repair_signature,repair_objects,source_repair_candidates
    from artwork_trial import checked_masks,build_trial_svg
    import worker_wsgi
    AVAILABLE=True
except ImportError:
    AVAILABLE=False

SECRET='local-test-worker-secret-with-32-characters'


@unittest.skipUnless(AVAILABLE,'Optional artwork worker dependencies are not installed')
class ArtworkServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=TemporaryDirectory();folder=Path(cls.temp.name)
        cls.rgba=np.zeros((128,128,4),np.uint8);cls.rgba[15:112,15:112]=[70,130,190,255];cls.rgba[40:60,40:60]=0;cls.rgba[25:30,85:90]=[5,5,5,255]
        file=folder/'source.rgba';file.write_bytes(cls.rgba.tobytes())
        code="const fs=require('fs'),A=require('./site/artwork-pipeline.js');(async()=>{const p=await A.pack(new Uint8ClampedArray(fs.readFileSync(process.argv[1])),128,128);console.log(JSON.stringify({...p.packet,phase:'pes'}));})().catch(e=>{console.error(e);process.exitCode=1;});"
        cls.packet=json.loads(subprocess.check_output(['node','-e',code,str(file)],cwd=ROOT))

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_independent_source_foreground_and_binding_match_actual_client(self):
        plan,meta,identity,evidence=decode_packet(self.packet);masks,_=checked_masks(plan)
        self.assertTrue(np.array_equal(np.logical_or.reduce(list(masks.values())),foreground(self.rgba)))
        self.assertEqual(identity,self.packet['requestId']);self.assertTrue(evidence['foregroundIndependentlyVerified'])
        self.assertFalse(evidence['clientObjectAlgorithmRecomputed']);self.assertFalse(plan['machineEligible'])

    def test_missing_eye_is_rejected_even_with_a_recomputed_packet_hash(self):
        obj=copy.deepcopy(self.packet);labels=bytearray(gzip.decompress(base64.b64decode(obj['labelsGzip'])));labels[26*128+86]=0
        obj['labelsGzip']=base64.b64encode(gzip.compress(labels)).decode()
        raw=gzip.decompress(base64.b64decode(obj['rgbaGzip']));obj['requestId']=sha256(obj['header'].encode()+raw+labels).hexdigest()
        with self.assertRaisesRegex(ValueError,'foreground'):decode_packet(obj)

    def test_wrong_source_gzip_bombs_unknown_fields_and_nonfinite_json_fail(self):
        for mutate in [lambda x:x.update(svg='<script/>'),lambda x:x.update(rgbaGzip=base64.b64encode(gzip.compress(bytes(128*128*4+1))).decode()),
                       lambda x:x.update(requestId='0'*64),lambda x:x.update(labelsGzip='invalid!!')]:
            p=copy.deepcopy(self.packet);mutate(p)
            with self.assertRaises(ValueError):decode_packet(p)
        for text in ['{"x":1,"x":2}','{"width":NaN}']:
            with self.assertRaises(ValueError):strict_json(text)

    def test_short_lived_native_receipt_binds_source_svg_size_and_bytes(self):
        p=copy.deepcopy(self.packet);plan,_,identity,_=decode_packet(p);svg,_,_=build_trial_svg(plan)
        r={'requestId':identity,'pesSha256':'0'*64,'svgSha256':sha256(svg).hexdigest(),'issuedAt':1000};r['mac']=signature(r,SECRET)
        p.update(phase='dst',receipt=r,pesBase64='')
        for mutate in [lambda x:x['receipt'].update(requestId='b'*64),lambda x:x['receipt'].update(issuedAt=0),lambda x:x['receipt'].update(svgSha256='f'*64),lambda x:x.update(pesBase64='AA==')]:
            bad=copy.deepcopy(p);mutate(bad)
            with self.assertRaises(ValueError):verify_receipt(bad,identity,svg,SECRET,1001)

    def test_repair_authority_is_source_bound_short_lived_and_cannot_expand(self):
        r={'requestId':self.packet['requestId'],'objectIds':['050505-0-p0'],'issuedAt':1000};r['mac']=repair_signature(r,SECRET)
        self.assertEqual(repair_objects(r,self.packet['requestId'],SECRET,1001),('050505-0-p0',))
        for mutate in [lambda x:x.update(requestId='0'*64),lambda x:x.update(objectIds=['4080C0-0']),
                       lambda x:x.update(issuedAt=0),lambda x:x.update(objectIds=['050505-0']*13)]:
            bad=copy.deepcopy(r);mutate(bad)
            with self.assertRaises(ValueError):repair_objects(bad,self.packet['requestId'],SECRET,1001)

    def test_repair_uses_source_ids_and_refuses_large_or_ambiguous_omissions(self):
        plan,_,_,_=decode_packet(self.packet);scale=80/128
        fault={'color':'#050505','fromMm':[2+86*scale,2+26*scale],'toMm':[2+88*scale,2+28*scale]}
        report={'decoded':[{'needlePointsOutsideWorkingColour':0,'needleSegmentsOutsideWorkingColour':1,'firstOutsideSegments':[fault]}]}
        ids=source_repair_candidates(plan,report);self.assertEqual(ids,['050505-0-p0'])
        _,m,masks=build_trial_svg(plan,partition_fills=True,running_overrides=ids)
        self.assertEqual(m['nativeRepairObjects'][0]['pixels'],25);self.assertFalse(m['machineEligible'])
        original,_=checked_masks(plan);self.assertTrue(all(np.array_equal(masks[c],original[c]) for c in masks))
        for invalid in [['not-a-source-object'],['4682BE-0-p0']]:
            with self.assertRaises(ValueError):build_trial_svg(plan,partition_fills=True,running_overrides=invalid)
        report['decoded'][0]['needlePointsOutsideWorkingColour']=1
        with self.assertRaises(ValueError):source_repair_candidates(plan,report)

    def call_worker(self,packet=None,enabled='1',token=SECRET):
        data=json.dumps(self.packet if packet is None else packet).encode();events=[]
        env={'PATH_INFO':'/v1/artwork-trial','REQUEST_METHOD':'POST','CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(data)),
            'HTTP_AUTHORIZATION':'Bearer '+token,'wsgi.input':BytesIO(data)}
        with mock.patch.dict(os.environ,{'STITCH_FORGE_ARTWORK_TRIAL_ENABLED':enabled,'STITCH_FORGE_WORKER_TOKEN':SECRET,'STITCH_FORGE_INKSTITCH_PATH':__file__}):
            body=b''.join(worker_wsgi.application(env,lambda status,headers:events.append((status,dict(headers)))))
        return events[0],body

    def test_worker_gates_and_busy_share_the_existing_engine_lock(self):
        self.assertTrue(self.call_worker(enabled='0')[0][0].startswith('503'))
        self.assertTrue(self.call_worker(token='wrong')[0][0].startswith('401'))
        self.assertTrue(worker_wsgi._lock.acquire(False))
        try:self.assertTrue(self.call_worker()[0][0].startswith('429'))
        finally:worker_wsgi._lock.release()
        self.assertTrue(self.call_worker(packet={**self.packet,'svg':'private-text'})[0][0].startswith('422'))

    @unittest.skipUnless(os.environ.get('STITCH_FORGE_INKSTITCH'),'Actual local engine not configured')
    def test_two_real_native_phases_complete_source_contained_archive(self):
        first=process_phase(self.packet,executable=os.environ['STITCH_FORGE_INKSTITCH'],secret=SECRET,epoch=1000)
        second={**self.packet,'phase':'dst','pesBase64':first['pesBase64'],'receipt':first['receipt']}
        payload=process_phase(second,executable=os.environ['STITCH_FORGE_INKSTITCH'],secret=SECRET,epoch=1001)
        with zipfile.ZipFile(BytesIO(payload)) as z:
            self.assertIsNone(z.testzip());report=json.loads(z.read('machine-report.json'));preview=json.loads(z.read('decoded-preview.json'))
            self.assertTrue(z.read('artwork-trial.pes').startswith(b'#PES0060'))
            self.assertEqual(report['requestId'],self.packet['requestId']);self.assertFalse(report['machineEligible'])
            self.assertEqual(report['decoded'][0]['needleStitches'],report['decoded'][1]['needleStitches'])
            self.assertTrue(preview['segments']);self.assertEqual(preview['requestId'],self.packet['requestId'])
            self.assertTrue(all(d['needlePointsOutsideWorkingColour']==d['needleSegmentsOutsideWorkingColour']==0 for d in report['decoded']))


if __name__=='__main__':unittest.main()
