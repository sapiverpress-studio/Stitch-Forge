"""Private worker contract checks: no image uploads, no unaudited download."""
from io import BytesIO
from pathlib import Path
from unittest import TestCase, mock
import json
import os
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'services/digitiser'))
import worker_wsgi
from machine_job import MachineJob

PROJECT={'width':78,'hoop':150,'paths':[
 [[100,100],[260,100],[260,260],[100,260],[100,100]],
 [[140,160],[160,180]]],
 'pathStyles':['tatami','running'], 'pathColors':['#AA3344','#44CC66']}

class WorkerContractTests(TestCase):
    def call(self, project=None, token='demo-secret', **changes):
        body = json.dumps(PROJECT if project is None else project).encode()
        env={'PATH_INFO':'/v1/digitise','REQUEST_METHOD':'POST',
             'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(body)),
             'HTTP_AUTHORIZATION':'Bearer '+token,'wsgi.input':BytesIO(body)}
        env.update(changes)
        events=[]
        with mock.patch.dict(os.environ,{'STITCH_FORGE_WORKER_TOKEN':'demo-secret',
             'STITCH_FORGE_INKSTITCH_PATH':__file__}):
            with mock.patch('worker_wsgi.run_machine_job',
                 return_value=MachineJob(b'PK\\x03\\x04'+b'Z'*96,
                   ({'format':'pes','stitches':300,'changes':1,'bounds_mm':[50,50]},),
                   'a'*64)) as engine:
                response=b''.join(worker_wsgi.application(env,lambda s,h: events.append((s,dict(h)))))
        return events[0],response,engine

    def test_success_contract(self):
        result,body,engine=self.call()
        self.assertEqual(result[0],'200 OK')
        self.assertEqual(result[1]['X-Stitch-Forge-Audit'],'STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED')
        self.assertTrue(body.startswith(b'PK\\x03\\x04'))
        self.assertEqual(engine.call_count,1)
        self.assertEqual(json.loads(engine.call_args.args[0]),PROJECT)

    def test_token_auth_and_image_rejection(self):
        result,_,engine=self.call(token='incorrect')
        self.assertTrue(result[0].startswith('401'))
        engine.assert_not_called()
        for key in ('reference','svg','image','privateArtwork'):
            result,body,engine=self.call(project={**PROJECT,key:'data:image/png;base64,PRIVATE'})
            self.assertTrue(result[0].startswith('422'),key)
            self.assertNotIn(b'PRIVATE',body)
            engine.assert_not_called()

    def test_bounded_requests_and_missing_engine(self):
        result,_,engine=self.call(CONTENT_LENGTH='250001')
        self.assertTrue(result[0].startswith('413'))
        engine.assert_not_called()
        result,_,engine=self.call(CONTENT_LENGTH='garbage')
        self.assertTrue(result[0].startswith('411'))
        engine.assert_not_called()
        result,_,engine=self.call(REQUEST_METHOD='GET')
        self.assertTrue(result[0].startswith('404'))
        engine.assert_not_called()

    def test_busy_fails_closed(self):
        self.assertTrue(worker_wsgi._lock.acquire(blocking=False))
        try:
            result,_,engine=self.call()
            self.assertTrue(result[0].startswith('429'))
            engine.assert_not_called()
        finally:
            worker_wsgi._lock.release()

    def test_worker_engine_failure_does_not_leak_paths(self):
        body=json.dumps(PROJECT).encode()
        env={'PATH_INFO':'/v1/digitise','REQUEST_METHOD':'POST',
            'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(body)),
            'HTTP_AUTHORIZATION':'Bearer demo-secret','wsgi.input':BytesIO(body)}
        events=[]
        with mock.patch.dict(os.environ,{'STITCH_FORGE_WORKER_TOKEN':'demo-secret',
          'STITCH_FORGE_INKSTITCH_PATH':__file__}):
            with mock.patch('worker_wsgi.run_machine_job',
                 side_effect=worker_wsgi.DigitiserError('private-path-/home/customer/image.svg')):
                answer=b''.join(worker_wsgi.application(env,lambda s,h:events.append(s)))
        self.assertEqual(events[0],'422 Unprocessable Entity')
        self.assertNotIn(b'private-path',answer)
