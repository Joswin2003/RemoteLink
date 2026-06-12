"""Simple HTTP server to serve the web UI"""
import http.server
import os
import mimetypes

class WebServer:
    def __init__(self, port, web_dir):
        self.port = port
        self.web_dir = web_dir

    def start(self):
        web_dir = self.web_dir
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=web_dir, **kwargs)
            def log_message(self, format, *args):
                pass  # suppress logs

        import socketserver
        with socketserver.TCPServer(("", self.port), Handler) as httpd:
            httpd.serve_forever()
