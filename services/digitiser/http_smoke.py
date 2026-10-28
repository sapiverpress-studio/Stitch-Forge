"""Exercise an already-running private staging worker using synthetic data only.

No OpenAI request. Independently decode returned PES/DST and verify failures.
"""
import argparse
import hashlib
import json
import os
import urllib.request
import urllib.error
from pathlib import Path
from format_audit import audit_zip

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8080/v1/digitise')
    parser.add_argument('--project',type=Path,required=True)
    args=parser.parse_args()
    if not (args.url.startswith('https://') or args.url.startswith('http://127.0.0.1:')):
        raise SystemExit('HTTPS required outside loopback')
    token=os.environ['STITCH_FORGE_WORKER_TOKEN']
    project=json.loads(args.project.read_bytes())
    def request(body,credential=token):
        req=urllib.request.Request(args.url,data=json.dumps(body).encode(),headers={
            'Content-Type':'application/json','Authorization':'Bearer '+credential})
        try:
            with urllib.request.urlopen(req,timeout=55) as result:
                return result.status,result.headers,result.read(3_000_001)
        except urllib.error.HTTPError as error:
            return error.code,error.headers,error.read(4096)
    for data,credential,expected in [(project,'incorrect',401),
            ({**project,'reference':'PRIVATE-SYNTHETIC'},token,422),
            ({**project,'paths':[]},token,422)]:
        code,headers,body=request(data,credential)
        assert code==expected,(code,expected)
        assert not headers.get('Content-Type','').startswith('application/zip')
        assert b'PRIVATE-SYNTHETIC' not in body
    code,headers,body=request(project)
    assert code==200,(code,body[:200])
    assert headers['X-Stitch-Forge-Audit']=='STRUCTURALLY_AUDITED_NOT_PHYSICALLY_STITCHED'
    assert int(headers['Content-Length'])==len(body)
    assert hashlib.sha256(body).hexdigest()==headers['X-Stitch-Forge-SHA256']
    reports=audit_zip(body)
    changes=sum(a.lower()!=b.lower() for a,b in zip(project['pathColors'],project['pathColors'][1:]))
    assert all(r.changes==changes for r in reports)
    print(json.dumps({'fixture':args.project.name,'sha256':hashlib.sha256(body).hexdigest(),
          'files':[r.__dict__ for r in reports],'negative_http_tests':3,
          'physical_stitch_out':'NOT TESTED'},indent=2))

if __name__=='__main__': main()
