from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add no-cache headers for every response
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        # Always serve tracker.html at root
        if self.path == "/" or self.path == "/index.html":
            self.path = "/tracker.html"
        return super().do_GET()

    def log_message(self, format, *args):
        # Clean log output
        print("%s - - [%s] %s" %
              (self.client_address[0],
               self.log_date_time_string(),
               format % args))

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with HTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving tracker (no cache) on port {PORT} (http://localhost:{PORT}/)")
        httpd.serve_forever()
