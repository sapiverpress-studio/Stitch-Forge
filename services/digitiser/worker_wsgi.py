"""Optional isolated Ink/Stitch WSGI worker contract.

Deploy ONLY behind authenticated HTTPS reverse proxy with process/memory/CPU
limits and a single request worker. Merely importing this module starts nothing.
Never put the worker token, engine path or original artwork in the browser.
"""
from hmac import compare_digest
from pathlib import Path
from threading import Lock
import json
import os

from machine_job import run_machine_job
from project_bridge import MAX_PROJECT_BYTES
from inkstitch_cli import DigitiserError

_lock = Lock()
_ALLOWED_KEYS = frozenset({'paths','pathStyles','pathColors','pathSettings','width',
                           'hoop','settings','stitchMode','threadColor','design_width_mm'})
MAX_REQUEST = 250_000

def application(environ, start_response):
    def response(status, value, extra=()):
        payload = json.dumps({'error': value}, separators=(',', ':')).encode('ascii')
        start_response(status, [('Content-Type', 'application/json'),
                                ('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),
                                ('Content-Length',str(len(payload))), *extra])
        return [payload]

    if environ.get('PATH_INFO') != '/v1/digitise' or environ.get('REQUEST_METHOD') != 'POST':
        return response('404 Not Found','Unavailable')
    secret = os.environ.get('STITCH_FORGE_WORKER_TOKEN','')
    provided = environ.get('HTTP_AUTHORIZATION','')
    if not secret or not provided.startswith('Bearer ') or not compare_digest(
            provided.removeprefix('Bearer ').encode(), secret.encode()):
        return response('401 Unauthorized','Authentication required')
    if not environ.get('CONTENT_TYPE','').lower().startswith('application/json'):
        return response('415 Unsupported Media Type','JSON required')
    raw_length = environ.get('CONTENT_LENGTH','')
    try:
        size = int(raw_length)
    except (TypeError, ValueError):
        return response('411 Length Required','Valid Content-Length required')
    if size < 10 or size > MAX_REQUEST:
        return response('413 Content Too Large','Geometry request exceeds size limit')
    try:
        data = environ['wsgi.input'].read(size)
    except (OSError, KeyError):
        return response('400 Bad Request','Unreadable request')
    if len(data) != size:
        return response('400 Bad Request','Incomplete request')
    try:
        obj = json.loads(data, parse_constant=lambda c: (_ for _ in ()).throw(ValueError()))
        if not isinstance(obj,dict) or set(obj) - _ALLOWED_KEYS:
            raise ValueError()
        # A reference image, arbitrary SVG or embed may never reach this worker.
        if 'paths' not in obj or 'pathColors' not in obj:
            raise ValueError()
    except (ValueError,UnicodeError,TypeError):
        return response('422 Unprocessable Entity','Unsupported geometry-only project')
    executable = os.environ.get('STITCH_FORGE_INKSTITCH_PATH','')
    if not executable or not Path(executable).is_file():
        return response('503 Service Unavailable','Engine not configured')
    if not _lock.acquire(blocking=False):
        return response('429 Too Many Requests','Engine busy; retry later')
    try:
        try:
            result = run_machine_job(data, executable=Path(executable), timeout_seconds=90)
        except (DigitiserError,ValueError):
            # Do not expose raw engine messages, paths, artwork or credentials.
            return response('422 Unprocessable Entity','Geometry or structural machine audit failed')
        except OSError:
            return response('503 Service Unavailable','Engine execution unavailable')
    finally:
        _lock.release()
    headers = [('Content-Type','application/zip'), ('Cache-Control','private, no-store'),
               ('X-Content-Type-Options','nosniff'),
               ('Content-Disposition','attachment; filename="stitch-forge-UNTESTED.zip"'),
               ('Content-Length',str(len(result.payload))),
               ('X-Stitch-Forge-SHA256',result.digest),
               ('X-Stitch-Forge-Audit','STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED')]
    start_response('200 OK',headers)
    return [result.payload]
