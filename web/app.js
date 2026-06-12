/* ────────────────────────────────────────────
   RemoteLink — Application Logic (app.js)
   ──────────────────────────────────────────── */

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  ws: null,
  hosting: false,
  controlEnabled: false,
  sessions: [],
  localId: generateId(),
  hostFps: 10,
  hostQuality: 40,
  latencyPing: null,
  latencyStart: 0,
  frameCount: 0,
  lastFpsTime: Date.now(),
  lastFrameSize: 0,
  remoteWidth: 1920,
  remoteHeight: 1080,
};

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('local-id').textContent = state.localId;
  document.getElementById('host-session-id').textContent = state.localId;

  detectLocalIP();
  initSliders();
  initToggles();

  // FPS counter
  setInterval(updateFpsCounter, 1000);

  // Set status
  setStatus('ready', 'Ready');

  toast('👋 Welcome to RemoteLink!', 'info');
});

function generateId() {
  const r = () => Math.floor(Math.random() * 900 + 100);
  return `${r()}-${r()}-${r()}`;
}

function detectLocalIP() {
  // Use WebRTC to detect local IP
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o));
    pc.onicecandidate = e => {
      if (!e.candidate) return;
      const m = e.candidate.candidate.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
      if (m && !m[1].startsWith('127.')) {
        document.getElementById('local-ip').textContent = m[1];
        pc.close();
      }
    };
  } catch (e) {
    document.getElementById('local-ip').textContent = 'See ifconfig';
  }
}

function initSliders() {
  const fps = document.getElementById('host-fps');
  const fpsVal = document.getElementById('fps-val');
  fps.addEventListener('input', () => {
    fpsVal.textContent = fps.value;
    state.hostFps = parseInt(fps.value);
  });

  const qual = document.getElementById('host-quality');
  const qualVal = document.getElementById('quality-val');
  qual.addEventListener('input', () => {
    qualVal.textContent = qual.value;
    state.hostQuality = parseInt(qual.value);
  });
}

function initToggles() {
  document.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('active'));
  });
}

// ── Navigation ────────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
}

// ── Status ────────────────────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = `status-dot ${type}`;
  txt.textContent = text;
}

// ── Connect to Host ───────────────────────────────────────────────────────
function connectToHost() {
  const ip = document.getElementById('host-ip').value.trim();
  const port = document.getElementById('host-port').value.trim() || '8766';
  const password = document.getElementById('host-password').value;

  if (!ip) { toast('Please enter a host IP address', 'error'); return; }

  const wsUrl = `ws://${ip}:${port}`;
  openViewerSession(wsUrl, ip, password);
}

function connectBySession() {
  const sessionId = document.getElementById('session-id-input').value.trim();
  const relayHost = document.getElementById('relay-host').value.trim();
  const password = document.getElementById('session-password').value;

  if (!sessionId) { toast('Please enter a Session ID', 'error'); return; }
  if (!relayHost) { toast('Please enter a Relay Server address', 'error'); return; }

  const wsUrl = `ws://${relayHost}:8767/relay/${sessionId}`;
  openViewerSession(wsUrl, sessionId, password);
}

function openViewerSession(wsUrl, label, password) {
  toast(`🔌 Connecting to ${label}...`, 'info');
  setStatus('hosting', 'Connecting...');

  const btn = document.getElementById('connect-ip-btn');
  btn.textContent = 'Connecting...';
  btn.disabled = true;

  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    state.ws = ws;
    if (password) {
      ws.send(JSON.stringify({ type: 'auth', password }));
    }
    // Request host info
    ws.send(JSON.stringify({ type: 'get_info' }));
    toast(`✅ Connected to ${label}`, 'success');
    setStatus('online', 'Connected');
    btn.textContent = 'Connect Now';
    btn.disabled = false;
    showViewerOverlay(label, ws);
  };

  ws.onmessage = (evt) => handleViewerMessage(evt, ws);

  ws.onerror = () => {
    toast(`❌ Could not connect to ${label}`, 'error');
    setStatus('ready', 'Ready');
    btn.textContent = 'Connect Now';
    btn.disabled = false;
  };

  ws.onclose = () => {
    if (state.ws === ws) {
      toast('🔌 Disconnected from remote', 'info');
      setStatus('ready', 'Ready');
      hideViewerOverlay();
      state.ws = null;
    }
  };
}

// ── Viewer Overlay ────────────────────────────────────────────────────────
function showViewerOverlay(label, ws) {
  document.getElementById('viewer-overlay').classList.remove('hidden');
  document.getElementById('viewer-host-name').textContent = label;

  const canvas = document.getElementById('remote-canvas');
  const ctx = canvas.getContext('2d');

  // Start screen stream
  ws.send(JSON.stringify({
    type: 'start_stream',
    fps: state.hostFps,
    quality: state.hostQuality
  }));

  // Start latency pings
  state.latencyPing = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      state.latencyStart = Date.now();
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 2000);

  // Mouse/keyboard control on canvas
  canvas.addEventListener('mousemove', (e) => {
    if (!state.controlEnabled) return;
    const [rx, ry] = canvasToRemote(e, canvas);
    ws.send(JSON.stringify({ type: 'mouse_move', x: rx, y: ry }));
  });

  canvas.addEventListener('click', (e) => {
    if (!state.controlEnabled) return;
    const [rx, ry] = canvasToRemote(e, canvas);
    ws.send(JSON.stringify({ type: 'mouse_click', x: rx, y: ry, button: 1 }));
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!state.controlEnabled) return;
    const [rx, ry] = canvasToRemote(e, canvas);
    ws.send(JSON.stringify({ type: 'mouse_click', x: rx, y: ry, button: 3 }));
  });

  canvas.addEventListener('wheel', (e) => {
    if (!state.controlEnabled) return;
    const [rx, ry] = canvasToRemote(e, canvas);
    ws.send(JSON.stringify({ type: 'mouse_scroll', x: rx, y: ry, direction: e.deltaY > 0 ? 'down' : 'up' }));
  });

  document.addEventListener('keydown', viewerKeyHandler);

  // Add session card
  addSessionCard(label);
}

function hideViewerOverlay() {
  document.getElementById('viewer-overlay').classList.add('hidden');
  state.controlEnabled = false;
  document.getElementById('vbtn-ctrl').classList.remove('active');
  if (state.latencyPing) { clearInterval(state.latencyPing); state.latencyPing = null; }
  document.removeEventListener('keydown', viewerKeyHandler);
}

function viewerKeyHandler(e) {
  if (!state.controlEnabled || !state.ws) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  e.preventDefault();
  const key = keyEventToXdotool(e);
  if (key) {
    state.ws.send(JSON.stringify({ type: 'key_press', key }));
  }
}

function keyEventToXdotool(e) {
  const map = {
    'Enter': 'Return', 'Backspace': 'BackSpace', 'Delete': 'Delete',
    'Escape': 'Escape', 'Tab': 'Tab', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
    'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Control': 'ctrl',
    'Alt': 'alt', 'Shift': 'shift', 'Super': 'super', 'F1': 'F1',
    'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5', 'F6': 'F6',
    'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10', 'F11': 'F11',
    'F12': 'F12', ' ': 'space', 'Home': 'Home', 'End': 'End',
    'PageUp': 'Prior', 'PageDown': 'Next',
  };
  if (map[e.key]) {
    let combo = '';
    if (e.ctrlKey && e.key !== 'Control') combo += 'ctrl+';
    if (e.altKey && e.key !== 'Alt') combo += 'alt+';
    if (e.shiftKey && e.key !== 'Shift') combo += 'shift+';
    return combo + map[e.key];
  }
  if (e.key.length === 1) {
    let combo = '';
    if (e.ctrlKey) combo += 'ctrl+';
    if (e.altKey) combo += 'alt+';
    return combo + e.key;
  }
  return null;
}

function canvasToRemote(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = state.remoteWidth / canvas.clientWidth;
  const scaleY = state.remoteHeight / canvas.clientHeight;
  return [
    Math.round((e.clientX - rect.left) * scaleX),
    Math.round((e.clientY - rect.top) * scaleY)
  ];
}

function handleViewerMessage(evt, ws) {
  try {
    const msg = JSON.parse(evt.data);

    if (msg.type === 'frame') {
      renderFrame(msg.data);
      state.frameCount++;
      state.lastFrameSize = Math.round(msg.data.length * 0.75 / 1024);
      document.getElementById('stat-size').textContent = `${state.lastFrameSize} KB`;
    }

    if (msg.type === 'pong') {
      const latency = Date.now() - state.latencyStart;
      document.getElementById('viewer-latency').textContent = `${latency} ms`;
    }

    if (msg.type === 'system_info') {
      document.getElementById('viewer-host-name').textContent =
        `${msg.hostname} (${msg.os})`;
    }

    if (msg.type === 'host_info') {
      document.getElementById('viewer-host-name').textContent =
        `${msg.hostname} (${msg.platform})`;
    }

    if (msg.type === 'chat') {
      addChatMessage(msg.from || 'Remote', msg.text, 'recv');
    }

  } catch (e) {
    console.error('Message parse error:', e);
  }
}

function renderFrame(b64) {
  const canvas = document.getElementById('remote-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
      state.remoteWidth = img.width;
      state.remoteHeight = img.height;
    }
    ctx.drawImage(img, 0, 0);
  };
  img.src = 'data:image/jpeg;base64,' + b64;
}

function updateFpsCounter() {
  const now = Date.now();
  const elapsed = (now - state.lastFpsTime) / 1000;
  const fps = Math.round(state.frameCount / elapsed);
  document.getElementById('stat-fps').textContent = `${fps} FPS`;
  state.frameCount = 0;
  state.lastFpsTime = now;
}

// ── Viewer Controls ───────────────────────────────────────────────────────
function toggleControl() {
  state.controlEnabled = !state.controlEnabled;
  const btn = document.getElementById('vbtn-ctrl');
  btn.classList.toggle('active', state.controlEnabled);
  btn.textContent = state.controlEnabled ? '🖱️ Control ON' : '🖱️ Control';
  const canvas = document.getElementById('remote-canvas');
  canvas.style.cursor = state.controlEnabled ? 'crosshair' : 'default';
  toast(state.controlEnabled ? '🖱️ Mouse & keyboard control enabled' : '⛔ Control disabled', 'info');
}

function toggleFullscreen() {
  const overlay = document.getElementById('viewer-overlay');
  if (!document.fullscreenElement) {
    overlay.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function toggleChat() {
  document.getElementById('chat-sidebar').classList.toggle('hidden');
  document.getElementById('vbtn-chat').classList.toggle('active');
}

function cycleQuality() {
  const qualities = [20, 40, 60, 80];
  state.hostQuality = qualities[(qualities.indexOf(state.hostQuality) + 1) % qualities.length] || 40;
  const btn = document.getElementById('vbtn-quality');
  btn.textContent = `📊 Q:${state.hostQuality}`;
  if (state.ws) {
    state.ws.send(JSON.stringify({ type: 'start_stream', fps: state.hostFps, quality: state.hostQuality }));
  }
}

function disconnectSession() {
  if (state.ws) { state.ws.close(); state.ws = null; }
  hideViewerOverlay();
  toast('🔌 Disconnected', 'info');
  setStatus('ready', 'Ready');
}

// ── Hosting ───────────────────────────────────────────────────────────────
function startHosting() {
  document.getElementById('start-host-btn').classList.add('hidden');
  document.getElementById('stop-host-btn').classList.remove('hidden');
  document.getElementById('host-status-label').textContent = 'Hosting Active';
  document.getElementById('host-status-label').classList.add('active');
  document.getElementById('pulse-ring').classList.add('active');
  state.hosting = true;
  setStatus('hosting', 'Hosting');
  toast(`🖥️ Hosting started! Share your IP or Session ID`, 'success');
}

function stopHosting() {
  document.getElementById('start-host-btn').classList.remove('hidden');
  document.getElementById('stop-host-btn').classList.add('hidden');
  document.getElementById('host-status-label').textContent = 'Not Hosting';
  document.getElementById('host-status-label').classList.remove('active');
  document.getElementById('pulse-ring').classList.remove('active');
  state.hosting = false;
  setStatus('ready', 'Ready');
  toast('⬛ Hosting stopped', 'info');
}

// ── Sessions ──────────────────────────────────────────────────────────────
function addSessionCard(label) {
  const container = document.getElementById('sessions-container');
  const emptyState = container.querySelector('.empty-state-large');
  if (emptyState) emptyState.remove();

  const id = `session-${Date.now()}`;
  const card = document.createElement('div');
  card.className = 'session-card';
  card.id = id;
  card.innerHTML = `
    <div class="sc-header">
      <div class="sc-icon">🖥️</div>
      <div>
        <div class="sc-name">${escHtml(label)}</div>
        <div class="sc-sub">Active session</div>
      </div>
    </div>
    <div class="sc-stats">
      <div class="sc-stat">FPS: <span id="${id}-fps">--</span></div>
      <div class="sc-stat">Latency: <span id="${id}-lat">--</span></div>
    </div>
    <button class="btn-danger" onclick="disconnectSession()">Disconnect</button>
  `;
  container.appendChild(card);
  state.sessions.push({ id, label });
}

// ── Chat ──────────────────────────────────────────────────────────────────
function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  if (state.ws) {
    state.ws.send(JSON.stringify({ type: 'chat', text }));
  }
  addChatMessage('You', text, 'sent');
  input.value = '';
}

function addChatMessage(from, text, dir) {
  const msgs = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = `chat-msg ${dir}`;
  el.innerHTML = `<div>${escHtml(text)}</div><div class="cmeta">${from} · ${new Date().toLocaleTimeString()}</div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

// ── File Transfer ─────────────────────────────────────────────────────────
function handleFileDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  files.forEach(queueFileTransfer);
}

function handleFileSelect(e) {
  Array.from(e.target.files).forEach(queueFileTransfer);
}

function queueFileTransfer(file) {
  if (!state.ws) { toast('Not connected to any remote host', 'error'); return; }

  const queue = document.getElementById('transfer-queue');
  const id = `ft-${Date.now()}`;
  const item = document.createElement('div');
  item.className = 'transfer-item';
  item.id = id;
  item.innerHTML = `<div class="ti-name">📄 ${escHtml(file.name)} (${formatBytes(file.size)})</div>
    <div class="ti-progress"><div class="ti-bar" id="${id}-bar" style="width:0%"></div></div>`;
  queue.appendChild(item);

  // Send file in chunks
  const CHUNK = 32768;
  const reader = new FileReader();
  let offset = 0;

  function sendChunk() {
    const slice = file.slice(offset, offset + CHUNK);
    reader.readAsArrayBuffer(slice);
  }

  reader.onload = (e) => {
    const b64 = arrayBufferToBase64(e.target.result);
    const pct = Math.min(100, Math.round((offset / file.size) * 100));
    document.getElementById(`${id}-bar`).style.width = `${pct}%`;

    if (state.ws) {
      state.ws.send(JSON.stringify({
        type: 'file_chunk',
        name: file.name,
        offset,
        total: file.size,
        data: b64,
        last: offset + CHUNK >= file.size,
      }));
    }

    offset += CHUNK;
    if (offset < file.size) {
      setTimeout(sendChunk, 20);
    } else {
      document.getElementById(`${id}-bar`).style.width = '100%';
      toast(`✅ Sent: ${file.name}`, 'success');
    }
  };

  sendChunk();
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ── Utilities ─────────────────────────────────────────────────────────────
function copyLocalId() {
  const id = document.getElementById('local-id').textContent;
  navigator.clipboard.writeText(id).then(() => toast('✅ Session ID copied!', 'success'));
}

function toggleSetting(el) {
  el.classList.toggle('active');
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
