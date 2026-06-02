"""
Soccer Game 3D - Launcher
Reads config.json, opens browser, starts HTTP server.
"""
import json
import os
import socket
import subprocess
import threading
import time
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)

def open_browser(url, delay=2.0):
    def _open():
        time.sleep(delay)
        webbrowser.open(url)
    threading.Thread(target=_open, daemon=True).start()

def start_ngrok(port):
    """ngrokが入っていれば起動してURLを返す。なければNone。"""
    try:
        proc = subprocess.Popen(
            ['ngrok', 'http', str(port)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)  # ngrok起動待ち
        # ngrok APIからURLを取得
        import urllib.request, json as _json
        res = urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=3)
        data = _json.loads(res.read())
        tunnels = data.get('tunnels', [])
        for t in tunnels:
            if t.get('proto') == 'https':
                return t['public_url'], proc
        return None, proc
    except Exception:
        return None, None

def main():
    config = load_config()
    host = config["server"]["host"]
    port = config["server"]["port"]
    entry = config["app"]["entryPoint"]
    url = f"http://{host}:{port}/{entry}"

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # LAN IPアドレスを取得
    try:
        lan_ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        lan_ip = "取得失敗"
    lan_url = f"http://{lan_ip}:{port}/{entry}"

    # ngrok起動を試みる
    ngrok_url, ngrok_proc = start_ngrok(port)

    print("=" * 40)
    print(f"  Soccer Game 3D")
    print(f"  PC      : {url}")
    print(f"  同Wi-Fi : {lan_url}")
    if ngrok_url:
        public = f"{ngrok_url}/{entry}"
        print(f"  外部URL : {public}")
        print(f"  ※どこからでもアクセス可能")
    else:
        print(f"  外部URL : ngrokが見つかりません (https://ngrok.com)")
    print(f"  Stop: Ctrl+C")
    print("=" * 40)

    open_browser(url, delay=1.5)

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {
            **SimpleHTTPRequestHandler.extensions_map,
            ".js": "application/javascript",
            ".fbx": "application/octet-stream",
        }
        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()
        def log_message(self, fmt, *args):
            pass  # サーバーログを抑制

    handler = Handler

    server = HTTPServer(('0.0.0.0', port), handler)  # 全インターフェースで待受
    print(f"\nServing on {url}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    main()
