"""
Host WebSocket server:
- Captures screen using stdlib only (via scrot/import on Linux, PIL fallback)
- Accepts viewer connections
- Forwards mouse/keyboard events from viewer to local system
- Pure Python stdlib WebSocket implementation
"""
import socket
import threading
import base64
import json
import hashlib
import struct
import os
import subprocess
import time
import io

# ─── Minimal WebSocket Server (no external deps) ───────────────────────────

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

def ws_handshake(conn):
    """Perform WebSocket handshake over raw socket."""
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = conn.recv(4096)
        if not chunk:
            return False
        data += chunk
    lines = data.decode(errors="replace").split("\r\n")
    key = ""
    for line in lines:
        if line.lower().startswith("sec-websocket-key:"):
            key = line.split(":", 1)[1].strip()
            break
    if not key:
        return False
    accept = base64.b64encode(
        hashlib.sha1((key + WS_MAGIC).encode()).digest()
    ).decode()
    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n"
        "\r\n"
    )
    conn.sendall(response.encode())
    return True

def ws_recv(conn):
    """Receive one WebSocket frame, return (opcode, payload_bytes) or None."""
    try:
        header = _recv_exact(conn, 2)
        if header is None:
            return None
        fin = (header[0] & 0x80) != 0
        opcode = header[0] & 0x0F
        masked = (header[1] & 0x80) != 0
        length = header[1] & 0x7F
        if length == 126:
            ext = _recv_exact(conn, 2)
            if ext is None:
                return None
            length = struct.unpack(">H", ext)[0]
        elif length == 127:
            ext = _recv_exact(conn, 8)
            if ext is None:
                return None
            length = struct.unpack(">Q", ext)[0]
        mask = _recv_exact(conn, 4) if masked else b"\x00\x00\x00\x00"
        if mask is None:
            return None
        payload = _recv_exact(conn, length)
        if payload is None:
            return None
        if masked:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return opcode, payload
    except Exception:
        return None

def _recv_exact(conn, n):
    buf = b""
    while len(buf) < n:
        try:
            chunk = conn.recv(n - len(buf))
        except Exception:
            return None
        if not chunk:
            return None
        buf += chunk
    return buf

def ws_send_text(conn, text):
    """Send a WebSocket text frame."""
    payload = text.encode("utf-8")
    _ws_send_frame(conn, 0x01, payload)

def ws_send_binary(conn, data):
    """Send a WebSocket binary frame."""
    _ws_send_frame(conn, 0x02, data)

def _ws_send_frame(conn, opcode, payload):
    length = len(payload)
    header = bytearray()
    header.append(0x80 | opcode)
    if length <= 125:
        header.append(length)
    elif length <= 65535:
        header.append(126)
        header += struct.pack(">H", length)
    else:
        header.append(127)
        header += struct.pack(">Q", length)
    try:
        conn.sendall(bytes(header) + payload)
    except Exception:
        pass

# ─── Screen Capture ─────────────────────────────────────────────────────────

def capture_screen_jpeg(quality=40, scale=0.7):
    """Capture screen as JPEG bytes. Uses scrot on Linux, fallback methods."""
    try:
        # Try scrot (common on Linux)
        import tempfile, os
        tmp = tempfile.mktemp(suffix=".jpg")
        result = subprocess.run(
            ["scrot", "-q", str(quality), tmp],
            capture_output=True, timeout=2
        )
        if result.returncode == 0 and os.path.exists(tmp):
            with open(tmp, "rb") as f:
                data = f.read()
            os.remove(tmp)
            return data
    except Exception:
        pass

    try:
        # Try import (ImageMagick)
        import tempfile
        tmp = tempfile.mktemp(suffix=".jpg")
        result = subprocess.run(
            ["import", "-window", "root", "-quality", str(quality), tmp],
            capture_output=True, timeout=3
        )
        if result.returncode == 0 and os.path.exists(tmp):
            with open(tmp, "rb") as f:
                data = f.read()
            os.remove(tmp)
            return data
    except Exception:
        pass

    try:
        # Try PIL/Pillow if available
        from PIL import ImageGrab, Image
        img = ImageGrab.grab()
        w, h = img.size
        img = img.resize((int(w * scale), int(h * scale)))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality)
        return buf.getvalue()
    except Exception:
        pass

    try:
        # Try xwd + convert fallback
        import tempfile
        tmp_xwd = tempfile.mktemp(suffix=".xwd")
        tmp_jpg = tempfile.mktemp(suffix=".jpg")
        subprocess.run(["xwd", "-root", "-silent", "-out", tmp_xwd], timeout=3, capture_output=True)
        subprocess.run(["convert", tmp_xwd, "-quality", str(quality), tmp_jpg], timeout=3, capture_output=True)
        if os.path.exists(tmp_jpg):
            with open(tmp_jpg, "rb") as f:
                data = f.read()
            for f in [tmp_xwd, tmp_jpg]:
                try: os.remove(f)
                except: pass
            return data
    except Exception:
        pass

    return None


# ─── Input Control ───────────────────────────────────────────────────────────

def move_mouse(x, y):
    try:
        subprocess.run(["xdotool", "mousemove", str(x), str(y)], capture_output=True)
    except Exception:
        pass

def click_mouse(x, y, button=1):
    try:
        subprocess.run(["xdotool", "mousemove", str(x), str(y), "click", str(button)], capture_output=True)
    except Exception:
        pass

def press_key(key):
    try:
        subprocess.run(["xdotool", "key", key], capture_output=True)
    except Exception:
        pass

def type_text(text):
    try:
        subprocess.run(["xdotool", "type", "--clearmodifiers", text], capture_output=True)
    except Exception:
        pass

def scroll_mouse(x, y, direction):
    btn = "4" if direction == "up" else "5"
    try:
        subprocess.run(["xdotool", "mousemove", str(x), str(y), "click", btn], capture_output=True)
    except Exception:
        pass


# ─── Host Server ─────────────────────────────────────────────────────────────

class HostServer:
    def __init__(self, port=8766, password=""):
        self.port = port
        self.password = password
        self.clients = []  # list of (conn, addr, role)
        self.lock = threading.Lock()
        self.streaming = False
        self.running = True

    def start(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("0.0.0.0", self.port))
        server.listen(10)
        server.settimeout(1)
        print(f"[HostServer] WebSocket listening on port {self.port}")
        while self.running:
            try:
                conn, addr = server.accept()
                t = threading.Thread(target=self.handle_client, args=(conn, addr), daemon=True)
                t.start()
            except socket.timeout:
                continue
            except Exception as e:
                if self.running:
                    print(f"[HostServer] Accept error: {e}")

    def handle_client(self, conn, addr):
        try:
            if not ws_handshake(conn):
                conn.close()
                return
            role = "viewer"
            with self.lock:
                self.clients.append({"conn": conn, "addr": addr, "role": role})
            print(f"[HostServer] Client connected: {addr}")

            # Send welcome with host info
            info = {
                "type": "host_info",
                "hostname": socket.gethostname(),
                "os": os.name,
                "platform": self._get_platform(),
            }
            ws_send_text(conn, json.dumps(info))

            while self.running:
                frame = ws_recv(conn)
                if frame is None:
                    break
                opcode, payload = frame
                if opcode == 8:  # close
                    break
                if opcode == 1:  # text
                    self._handle_message(conn, payload.decode("utf-8"))
        except Exception as e:
            print(f"[HostServer] Client error {addr}: {e}")
        finally:
            with self.lock:
                self.clients = [c for c in self.clients if c["conn"] is not conn]
            try:
                conn.close()
            except Exception:
                pass
            print(f"[HostServer] Client disconnected: {addr}")

    def _get_platform(self):
        import platform
        return platform.system()

    def _handle_message(self, conn, text):
        try:
            msg = json.loads(text)
            t = msg.get("type", "")

            if t == "start_stream":
                threading.Thread(
                    target=self._stream_screen,
                    args=(conn, msg.get("fps", 10), msg.get("quality", 40)),
                    daemon=True
                ).start()

            elif t == "mouse_move":
                move_mouse(msg["x"], msg["y"])

            elif t == "mouse_click":
                click_mouse(msg["x"], msg["y"], msg.get("button", 1))

            elif t == "mouse_scroll":
                scroll_mouse(msg["x"], msg["y"], msg.get("direction", "down"))

            elif t == "key_press":
                press_key(msg.get("key", ""))

            elif t == "type_text":
                type_text(msg.get("text", ""))

            elif t == "ping":
                ws_send_text(conn, json.dumps({"type": "pong", "ts": time.time()}))

            elif t == "get_info":
                import platform
                info = {
                    "type": "system_info",
                    "hostname": socket.gethostname(),
                    "os": platform.system(),
                    "version": platform.version()[:60],
                    "machine": platform.machine(),
                }
                ws_send_text(conn, json.dumps(info))

        except Exception as e:
            print(f"[HostServer] Message error: {e}")

    def _stream_screen(self, conn, fps, quality):
        interval = 1.0 / max(1, min(30, fps))
        print(f"[HostServer] Starting stream fps={fps} quality={quality}")
        while self.running:
            try:
                frame_data = capture_screen_jpeg(quality=quality)
                if frame_data:
                    b64 = base64.b64encode(frame_data).decode()
                    msg = json.dumps({"type": "frame", "data": b64, "ts": time.time()})
                    ws_send_text(conn, msg)
                time.sleep(interval)
            except Exception as e:
                print(f"[HostServer] Stream error: {e}")
                break
        print("[HostServer] Stream stopped")
