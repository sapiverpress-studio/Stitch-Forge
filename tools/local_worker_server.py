"""Loopback-only native worker for local full-app acceptance. No deployment."""
from pathlib import Path
import sys
from socketserver import ThreadingMixIn
from wsgiref.simple_server import make_server,WSGIServer,WSGIRequestHandler
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from worker_wsgi import application


class Server(ThreadingMixIn,WSGIServer):
    daemon_threads=False


class Quiet(WSGIRequestHandler):
    def log_message(self,*args):pass  # Never log original pixels, tokens or bodies.


if __name__=='__main__':
    with make_server('127.0.0.1',0,application,server_class=Server,handler_class=Quiet) as server:
        print(server.server_port,flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
