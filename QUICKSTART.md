# 🔗 RemoteLink — Quick Start Guide

## ▶️ Start RemoteLink (LAN only — same network)

```bash
cd /home/joswin/.gemini/antigravity/scratch/remotelink
python3 remotelink.py
```
Then open: http://localhost:8765

---

## 🌍 Start RemoteLink (Internet — anyone can connect)

Open **2 terminals**:

**Terminal 1:**
```bash
cd /home/joswin/.gemini/antigravity/scratch/remotelink
python3 remotelink.py
```

**Terminal 2:**
```bash
~/.local/bin/cloudflared tunnel --url http://localhost:8765
```
Copy the `https://....trycloudflare.com` URL and share it.

---

## 🛑 Stop RemoteLink
Press `Ctrl+C` in the terminal.

---

## 📁 Project Location
/home/joswin/.gemini/antigravity/scratch/remotelink

## 🔧 If something breaks
```bash
# Reinstall cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared
```
