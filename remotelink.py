#!/usr/bin/env python3
"""
RemoteLink - Cross-platform remote desktop application
Works between Linux and Windows over same network or internet
"""
import sys
import os
import threading
import webbrowser
import time
import platform

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server.host_server import HostServer
from server.web_server import WebServer
from server.relay_server import RelayServer

# Load platform-specific handlers
if platform.system() == "Windows":
    try:
        import server.windows_host  # patches host_server functions
    except Exception as e:
        print(f"[Warning] Windows host module error: {e}")

def main():
    print("""
╔══════════════════════════════════════════╗
║         RemoteLink v1.0                  ║
║   Cross-Platform Remote Desktop App      ║
║   Linux ↔ Windows   |   LAN & Internet   ║
╚══════════════════════════════════════════╝
    """)

    plat = platform.system()
    print(f"   Platform : {plat} ({platform.machine()})")
    print(f"   Python   : {sys.version.split()[0]}")

    web_port = 8765
    ws_port  = 8766

    # Start WebSocket host server
    host_server = HostServer(ws_port)
    ws_thread = threading.Thread(target=host_server.start, daemon=True)
    ws_thread.start()

    # Start HTTP server for Web UI
    web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
    web_server = WebServer(web_port, web_dir)
    web_thread = threading.Thread(target=web_server.start, daemon=True)
    web_thread.start()

    time.sleep(0.8)

    url = f"http://localhost:{web_port}"
    print(f"\n✅ RemoteLink is running!")
    print(f"   Web UI     : {url}")
    print(f"   WS Port    : {ws_port}  (share your IP + this port)")
    print(f"\n   Opening browser...")
    webbrowser.open(url)
    print(f"\n   Press Ctrl+C to stop\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping RemoteLink... Goodbye!")
        sys.exit(0)

if __name__ == "__main__":
    main()

