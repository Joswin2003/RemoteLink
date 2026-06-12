#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  RemoteLink Internet Host Script
#  Exposes your RemoteLink to the internet via ngrok tunnel
# ══════════════════════════════════════════════════════════════

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT=8765
WS_PORT=8766

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║      RemoteLink — Internet Hosting       ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check Python3 ──────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}❌ Python3 not found. Please install it first.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Python3: $(python3 --version)${NC}"

# ── Step 2: Install ngrok if missing ──────────────────────────
echo ""
echo -e "${BOLD}Checking ngrok...${NC}"

if ! command -v ngrok &>/dev/null; then
  echo -e "${YELLOW}⚠️  ngrok not found. Installing...${NC}"
  
  ARCH=$(uname -m)
  if [[ "$ARCH" == "x86_64" ]]; then
    NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz"
  elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz"
  else
    NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-386.tgz"
  fi

  echo "Downloading ngrok for $ARCH..."
  curl -sSL "$NGROK_URL" -o /tmp/ngrok.tgz
  tar -xzf /tmp/ngrok.tgz -C /tmp/
  sudo mv /tmp/ngrok /usr/local/bin/ngrok
  sudo chmod +x /usr/local/bin/ngrok
  rm -f /tmp/ngrok.tgz

  if ! command -v ngrok &>/dev/null; then
    echo -e "${RED}❌ ngrok installation failed. Try manual install:${NC}"
    echo "   https://ngrok.com/download"
    exit 1
  fi
  echo -e "${GREEN}✅ ngrok installed!${NC}"
else
  echo -e "${GREEN}✅ ngrok: $(ngrok version 2>/dev/null | head -1)${NC}"
fi

# ── Step 3: Check ngrok auth token ────────────────────────────
echo ""
echo -e "${BOLD}Checking ngrok authentication...${NC}"

NGROK_CONFIG="$HOME/.config/ngrok/ngrok.yml"
if [ ! -f "$NGROK_CONFIG" ] || ! grep -q "authtoken" "$NGROK_CONFIG" 2>/dev/null; then
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  ngrok requires a FREE account to tunnel ports.${NC}"
  echo ""
  echo -e "  1. Sign up free at: ${CYAN}https://dashboard.ngrok.com/signup${NC}"
  echo -e "  2. Copy your authtoken from: ${CYAN}https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
  echo -e "  3. Paste it below:"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "  Enter your ngrok authtoken: " NGROK_TOKEN
  
  if [ -z "$NGROK_TOKEN" ]; then
    echo -e "${RED}❌ No token provided. Cannot proceed.${NC}"
    echo ""
    echo -e "${BOLD}Alternative: Use LAN mode only (same network)${NC}"
    echo "  Local IP: $(hostname -I | awk '{print $1}')"
    echo "  Web UI  : http://$(hostname -I | awk '{print $1}'):$WEB_PORT"
    echo "  WS Port : $(hostname -I | awk '{print $1}'):$WS_PORT"
    echo ""
    echo "Starting RemoteLink in LAN mode..."
    cd "$DIR"
    python3 remotelink.py
    exit 0
  fi
  
  ngrok config add-authtoken "$NGROK_TOKEN"
  echo -e "${GREEN}✅ ngrok authenticated!${NC}"
else
  echo -e "${GREEN}✅ ngrok already authenticated${NC}"
fi

# ── Step 4: Start RemoteLink in background ────────────────────
echo ""
echo -e "${BOLD}Starting RemoteLink server...${NC}"
cd "$DIR"
python3 remotelink.py &
REMOTELINK_PID=$!
echo -e "${GREEN}✅ RemoteLink started (PID: $REMOTELINK_PID)${NC}"
sleep 1.5

# ── Step 5: Start ngrok tunnels ───────────────────────────────
echo ""
echo -e "${BOLD}Opening internet tunnels via ngrok...${NC}"

# Start ngrok for both ports using config
cat > /tmp/ngrok_remotelink.yml << EOF
version: "2"
tunnels:
  web:
    proto: http
    addr: $WEB_PORT
  websocket:
    proto: http
    addr: $WS_PORT
EOF

ngrok start --config /tmp/ngrok_remotelink.yml --all &
NGROK_PID=$!
echo -e "${GREEN}✅ ngrok tunnels starting... (PID: $NGROK_PID)${NC}"
sleep 3

# ── Step 6: Get tunnel URLs from ngrok API ────────────────────
echo ""
echo -e "${BOLD}Getting your public URLs...${NC}"
sleep 2

TUNNELS=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)

if [ -z "$TUNNELS" ] || [ "$TUNNELS" = "null" ]; then
  echo -e "${YELLOW}⚠️  Could not auto-detect tunnel URLs.${NC}"
  echo -e "   Open ${CYAN}http://localhost:4040${NC} in your browser to see them."
else
  WEB_URL=$(echo "$TUNNELS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tunnels = data.get('tunnels', [])
for t in tunnels:
    if str($WEB_PORT) in t.get('config', {}).get('addr', ''):
        print(t.get('public_url', ''))
        break
" 2>/dev/null)

  WS_URL=$(echo "$TUNNELS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tunnels = data.get('tunnels', [])
for t in tunnels:
    if str($WS_PORT) in t.get('config', {}).get('addr', ''):
        url = t.get('public_url', '')
        # Convert https to wss / http to ws
        url = url.replace('https://', 'wss://').replace('http://', 'ws://')
        print(url)
        break
" 2>/dev/null)

  echo ""
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  🌍 RemoteLink is LIVE on the Internet!${NC}"
  echo ""
  if [ -n "$WEB_URL" ]; then
    echo -e "  ${GREEN}🔗 Web UI (share this link):${NC}"
    echo -e "     ${CYAN}${BOLD}$WEB_URL${NC}"
  fi
  if [ -n "$WS_URL" ]; then
    echo -e ""
    echo -e "  ${GREEN}🔌 WebSocket URL:${NC}"
    echo -e "     ${CYAN}$WS_URL${NC}"
  fi
  echo ""
  echo -e "  ${YELLOW}📋 Also accessible on LAN:${NC}"
  echo -e "     http://$(hostname -I | awk '{print $1}'):$WEB_PORT"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${YELLOW}📌 Share the Web UI link with anyone to connect!${NC}"
  echo -e "  ${YELLOW}📊 ngrok dashboard: http://localhost:4040${NC}"
  echo ""
fi

# ── Cleanup on exit ───────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping RemoteLink & tunnels...${NC}"
  kill $REMOTELINK_PID 2>/dev/null
  kill $NGROK_PID 2>/dev/null
  rm -f /tmp/ngrok_remotelink.yml
  echo -e "${GREEN}Goodbye!${NC}"
}
trap cleanup EXIT INT TERM

echo -e "  Press ${BOLD}Ctrl+C${NC} to stop everything."
echo ""
wait
