#!/bin/bash
# ──────────────────────────────────────────────────────────
#  RemoteLink Setup & Launch Script for Linux
# ──────────────────────────────────────────────────────────

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         RemoteLink Setup                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Python3
if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 not found. Please install it first."
  exit 1
fi
echo "✅ Python3: $(python3 --version)"

# Check required tools for screen capture
echo ""
echo "Checking screen capture tools..."
CAPTURE_OK=false

if command -v scrot &>/dev/null; then
  echo "  ✅ scrot found (primary capture tool)"
  CAPTURE_OK=true
elif command -v import &>/dev/null; then
  echo "  ✅ ImageMagick 'import' found"
  CAPTURE_OK=true
elif python3 -c "from PIL import ImageGrab" &>/dev/null 2>&1; then
  echo "  ✅ Pillow ImageGrab found"
  CAPTURE_OK=true
fi

if [ "$CAPTURE_OK" = false ]; then
  echo "  ⚠️  No screen capture tool found."
  echo "     Installing scrot..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y scrot xdotool
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y scrot xdotool
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm scrot xdotool
  fi
fi

# Check xdotool (for mouse/keyboard control)
if command -v xdotool &>/dev/null; then
  echo "  ✅ xdotool found (mouse/keyboard control)"
else
  echo "  ⚠️  xdotool not found - mouse/keyboard control will be limited"
  echo "     Run: sudo apt-get install xdotool"
fi

echo ""
echo "Starting RemoteLink..."
echo ""
cd "$DIR"
python3 remotelink.py
