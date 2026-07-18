import http.server, socketserver, os, sys

os.chdir('/data/data/com.termux/files/home/BangleApps')
socketserver.TCPServer.allow_reuse_address = True

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

httpd = socketserver.TCPServer(('0.0.0.0', 8080), NoCacheHandler)
print(f'Serving on http://localhost:8080', flush=True)
httpd.serve_forever()
