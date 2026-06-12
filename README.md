# 🔗 RemoteLink — Cross-Platform Remote Desktop

> Connect Linux ↔ Windows over the same network or the internet. No registration required.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Screen Streaming** | Live JPEG-compressed screen streaming |
| **Mouse Control** | Remote mouse move, click, right-click, scroll |
| **Keyboard Control** | Full keyboard forwarding with modifier keys |
| **File Transfer** | Drag & drop file sending with progress bar |
| **Live Chat** | Text chat during a session |
| **Direct IP** | Connect over LAN via IP address |
| **Session ID** | Connect across networks via relay server |
| **No install** | Pure Python stdlib — no pip needed on Linux |
| **Cross-platform** | Works on Linux & Windows |

---

## 🚀 Quick Start

### On Linux (Host or Viewer)
```bash
cd remotelink
bash start_linux.sh
```

### On Windows (Host or Viewer)
```
Double-click: start_windows.bat
```

The app opens in your browser at **http://localhost:8765**

---

## 🌐 How to Connect Two Computers

### Same Network (LAN)
1. Start RemoteLink on **Computer A** (host)
2. Go to **Host** tab → click **Start Hosting**
3. Note the **Local IP** shown (e.g. `192.168.1.100`)
4. On **Computer B**, open RemoteLink → **Connect** tab
5. Enter Computer A's IP + port `8766` → **Connect Now**

### Different Networks (Internet)
1. Set up a relay server (any Linux VPS)
2. Run: `python3 remotelink.py` on the VPS
3. Share your **Session ID** with the other user
4. Enter the relay server address + session ID to connect

---

## 📁 Project Structure

```
remotelink/
├── remotelink.py          # Main entry point
├── start_linux.sh         # Linux launch script
├── start_windows.bat      # Windows launch script
├── server/
│   ├── host_server.py     # WebSocket server + screen capture + input control
│   ├── web_server.py      # HTTP server for the web UI
│   ├── relay_server.py    # Relay server stub (NAT traversal)
│   └── windows_host.py    # Windows WinAPI screen capture & input
└── web/
    ├── index.html         # Main UI
    ├── style.css          # Dark premium UI styles
    └── app.js             # WebSocket client + all UI logic
```

---

## 🔧 Dependencies

### Linux
- `scrot` — screen capture: `sudo apt install scrot`
- `xdotool` — mouse/keyboard: `sudo apt install xdotool`
- Python 3.6+ (stdlib only)

### Windows
- Python 3.6+ from python.org
- `Pillow` — screen capture: `pip install pillow`
- `pywin32` — WinAPI input: `pip install pywin32`

---

## 🔒 Security Notes

- Set a **password** on the Host tab before sharing your IP
- Only run on trusted networks without a password
- For internet use, deploy the relay server on a VPS with TLS (nginx proxy)
- All WebSocket frames are masked per the WS spec

---

## 🛣️ Roadmap

- [ ] End-to-end encryption (AES-256)
- [ ] H.264 video stream (FFmpeg)
- [ ] Audio forwarding
- [ ] Clipboard sync
- [ ] STUN/TURN NAT traversal
- [ ] Mobile viewer (PWA)
