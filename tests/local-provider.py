"""Deterministic local API fixture; never forwards requests or stores credentials."""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def do_POST(self):
        try:
            data = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            question = json.loads(data['messages'][-1]['content'])['question']
            if 'slow' in question.lower():
                time.sleep(15)
            code = 401 if 'fail' in question.lower() else 200
            answer = '4' if '2 + 2' in question else 'Paris'
            result = {'choices': [{'message': {'content': answer}}]}
        except (ValueError, KeyError, TypeError):
            code, result = 400, {'error': {'message': 'Invalid test request'}}
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        try:
            self.wfile.write(json.dumps(result).encode())
        except BrokenPipeError:
            pass

print('Local test provider listening on 127.0.0.1:8765', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
