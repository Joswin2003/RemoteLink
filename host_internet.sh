#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  RemoteLink — Internet Hosting via Cloudflare Tunnel
#  No account needed. No login. Instant public URL.
# ══════════════════════════════════════════════════════════════

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT=8765
WS_PORT=8766

# Find cloudflared
CLOUDFLARED=""
for p in "cloudflared" "$HOME/.local/bin/cloudflared" "/usr/local/bin/cloudflared"; do
  if command -v "$p" &>/dev/null || [ -x "$p" ]; then
    CLOUDFLARED="$p"
    break
  fi
done

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║    RemoteLink — Internet Hosting (Cloudflare)    ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Kill any old instances ─────────────────────────────────────
pkill -f "python3 remotelink.py" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 0.5

# ── Start RemoteLink ───────────────────────────────────────────
echo -e "${BOLD}[1/3] Starting RemoteLink server...${NC}"
cd "$DIR"
python3 remotelink.py > /tmp/remotelink.log 2>&1 &
REMOTELINK_PID=$!
sleep 2

# Verify it started
if ! kill -0 $REMOTELINK_PID 2>/dev/null; then
  echo -e "${RED}❌ RemoteLink failed to start. Check /tmp/remotelink.log${NC}"
  cat /tmp/remotelink.log
  exit 1
fi
echo -e "${GREEN}✅ RemoteLink running (PID: $REMOTELINK_PID)${NC}"

# ── Start Cloudflare tunnel for Web UI ────────────────────────
echo ""
echo -e "${BOLD}[2/3] Opening Cloudflare tunnel for Web UI (port $WEB_PORT)...${NC}"
$CLOUDFLARED tunnel --url http://localhost:$WEB_PORT --no-autoupdate > /tmp/cf_web.log 2>&1 &
CF_WEB_PID=$!

echo -e "${BOLD}[3/3] Opening Cloudflare tunnel for WebSocket (port $WS_PORT)...${NC}"
$CLOUDFLARED tunnel --url http://localhost:$WS_PORT --no-autoupdate > /tmp/cf_ws.log 2>&1 &
CF_WS_PID=$!

# ── Wait for URLs to appear ────────────────────────────────────
echo ""
echo -e "${YELLOW}Waiting for tunnel URLs...${NC}"
WEB_URL=""
WS_URL=""
for i in $(seq 1 20); do
  sleep 1
  if [ -z "$WEB_URL" ]; then
    WEB_URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' /tmp/cf_web.log 2>/dev/null | head -1)
  fi
  if [ -z "$WS_URL" ]; then
    WS_URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' /tmp/cf_ws.log 2>/dev/null | head -1)
  fi
  if [ -n "$WEB_URL" ] && [ -n "$WS_URL" ]; then
    break
  fi
  echo -ne "  Waiting... ${i}s\r"
done

echo ""
echo ""
if [ -n "$WEB_URL" ]; then
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  🌍 RemoteLink is LIVE on the Internet!${NC}"
  echo ""
  echo -e "  ${GREEN}🔗 Web UI — Share this with anyone:${NC}"
  echo -e "     ${CYAN}${BOLD}$WEB_URL${NC}"
  echo ""
  if [ -n "$WS_URL" ]; then
    WS_URL_WS="${WS_URL/https:\/\//wss://}"
    echo -e "  ${GREEN}🔌 WebSocket URL (for manual connect):${NC}"
    echo -e "     ${CYAN}$WS_URL_WS${NC}"
  fi
  echo ""
  echo -e "  ${YELLOW}📋 LAN access (same network):${NC}"
  echo -e "     http://$(hostname -I | awk '{print $1}'):$WEB_PORT"
  echo ""
  echo -e "  ${BOLD}📌 How the remote person connects:${NC}"
  echo -e "     1. Open the Web UI link above in their browser"
  echo -e "     2. Go to 'Connect' tab"
  echo -e "     3. Enter the WS URL and click Connect"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Open browser on host
  xdg-open "$WEB_URL" 2>/dev/null || true
else
  echo -e "${RED}❌ Could not get tunnel URL. Showing tunnel log:${NC}"
  tail -20 /tmp/cf_web.log
  echo ""
  echo -e "${YELLOW}Try opening manually: http://localhost:$WEB_PORT${NC}"
fi

echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop everything"
echo ""

# ── Cleanup ────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping all services...${NC}"
  kill $REMOTELINK_PID 2>/dev/null
  kill $CF_WEB_PID 2>/dev/null
  kill $CF_WS_PID 2>/dev/null
  pkill -f "python3 remotelink.py" 2>/dev/null
  pkill -f "cloudflared tunnel" 2>/dev/null
  echo -e "${GREEN}✅ All stopped. Goodbye!${NC}"
}
trap cleanup EXIT INT TERM

wait $REMOTELINK_PID
