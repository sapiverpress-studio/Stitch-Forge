"""Explicitly gated source-pixel trial endpoint. No service starts on import."""
from hashlib import sha256
from hmac import compare_digest
import json
import os
from pathlib import Path
import subprocess

MAX_REQUEST=4000000
REASONS={
 'NATIVE_LENGTH_LIMIT':'Actual needle movement exceeded the stitch-length limit',
 'NATIVE_DENSITY_LIMIT':'Actual needle commands exceeded the local density limit',
 'SOURCE_CONTAINMENT_FAILED':'Actual needle movements leave prepared source colours',
 'NATIVE_COLOUR_ORDER_FAILED':'Decoded thread colour order differs from the prepared artwork',
 'NATIVE_SEQUENCE_FAILED':'PES/DST needle sequences differ',
 'NATIVE_RECEIPT_CHANGED':'The native phase no longer matches this source, size or worker version',
 'GEOMETRY_BUDGET_EXCEEDED':'Artwork geometry exceeds the bounded native input budget',
 'SOURCE_OR_GEOMETRY_REJECTED':'Source binding, geometry or machine-file validation failed'}


def reason(error):
    text=str(error)
    if 'stitch-length bound' in text:return 'NATIVE_LENGTH_LIMIT'
    if 'local-command-density bound' in text:return 'NATIVE_DENSITY_LIMIT'
    if 'source-containment audit' in text:return 'SOURCE_CONTAINMENT_FAILED'
    if 'colour order' in text:return 'NATIVE_COLOUR_ORDER_FAILED'
    if 'needle counts differ' in text or 'needle coordinates differ' in text:return 'NATIVE_SEQUENCE_FAILED'
    if 'receipt' in text or 'Changed native PES' in text:return 'NATIVE_RECEIPT_CHANGED'
    if 'exceeds' in text and 'budget' in text:return 'GEOMETRY_BUDGET_EXCEEDED'
    return 'SOURCE_OR_GEOMETRY_REJECTED'


def application(environ,start_response,lock):
    def reply(status,value,code=None):
        body=json.dumps({'error':value,**({'code':code} if code else {})},separators=(',',':')).encode()
        start_response(status,[('Content-Type','application/json'),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Content-Length',str(len(body)))])
        return [body]
    secret=os.environ.get('STITCH_FORGE_WORKER_TOKEN','');provided=environ.get('HTTP_AUTHORIZATION','')
    if not secret or not provided.startswith('Bearer ') or not compare_digest(provided[7:].encode(),secret.encode()):return reply('401 Unauthorized','Authentication required')
    if os.environ.get('STITCH_FORGE_ARTWORK_TRIAL_ENABLED')!='1':return reply('503 Service Unavailable','Artwork trial route is not enabled on this worker')
    if not environ.get('CONTENT_TYPE','').lower().startswith('application/json'):return reply('415 Unsupported Media Type','JSON required')
    try:size=int(environ.get('CONTENT_LENGTH',''))
    except (ValueError,TypeError):return reply('411 Length Required','Valid Content-Length required')
    if not 10<=size<=MAX_REQUEST:return reply('413 Content Too Large','Artwork request exceeds its budget')
    try:
        raw=environ['wsgi.input'].read(size)
        if len(raw)!=size:return reply('400 Bad Request','Incomplete artwork request')
        # Optional dependencies are loaded only on the explicitly enabled route.
        from artwork_packet import strict_json
        from artwork_service import process_phase,AUDIT
        obj=strict_json(raw)
    except ImportError:return reply('503 Service Unavailable','Artwork worker dependencies are unavailable')
    except (ValueError,TypeError,KeyError,OSError):return reply('422 Unprocessable Entity','Invalid artwork request')
    executable=os.environ.get('STITCH_FORGE_INKSTITCH_PATH','')
    if not executable or not Path(executable).is_file():return reply('503 Service Unavailable','Native engine is unavailable')
    if not lock.acquire(blocking=False):return reply('429 Too Many Requests','Native engine busy; no automatic retry was started')
    try:
        from inkstitch_cli import DigitiserError
        try:result=process_phase(obj,executable=Path(executable),secret=secret)
        except subprocess.TimeoutExpired:return reply('504 Gateway Timeout','Native phase exceeded its time limit; no substitute files were generated')
        except (ValueError,TypeError,KeyError,DigitiserError) as error:
            code=reason(error);return reply('422 Unprocessable Entity',REASONS[code],code)
        except OSError:return reply('503 Service Unavailable','Native engine execution unavailable')
    finally:lock.release()
    common=[('Cache-Control','private, no-store'),('X-Content-Type-Options','nosniff')]
    if isinstance(result,dict):
        body=json.dumps(result,separators=(',',':')).encode()
        status='202 Accepted' if result.get('status')=='BOUNDED_NATIVE_REPAIR_REQUIRED' else '200 OK'
        start_response(status,common+[('Content-Type','application/json'),('Content-Length',str(len(body)))])
    else:
        body=result
        start_response('200 OK',common+[('Content-Type','application/zip'),('Content-Length',str(len(body))),
            ('Content-Disposition','attachment; filename="stitch-forge-artwork-TRIAL-NOT-APPROVED.zip"'),
            ('X-Stitch-Forge-SHA256',sha256(body).hexdigest()),('X-Stitch-Forge-Audit',AUDIT)])
    return [body]
