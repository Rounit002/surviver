// Builds preview.html by inlining widget.html/css/js + the fields.json defaults,
// behind a small StreamElements shim, so the widget can be driven locally.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('./widget.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./widget.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('./widget.js', import.meta.url), 'utf8');
const fields = JSON.parse(readFileSync(new URL('./fields.json', import.meta.url), 'utf8'));

const fieldData = {};
for (const [key, def] of Object.entries(fields)) fieldData[key] = def.value;
fieldData.starterTasks = 'Stream intro + chat|Warm-up games|Build the to-do overlay|Viewer submissions|Q&A + outro';

const out = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>To-Do Overlay — local test</title>
<style>
${css}

/* ── everything below is the local test harness, not the widget ── */
html, body { margin: 0; height: 100%; }
body { background: #1E1D22; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
#stage { position: fixed; inset: 0; padding: 26px; box-sizing: border-box; }
#panel {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; align-items: center;
  max-width: 92vw; padding: 10px 12px; border-radius: 12px;
  background: #26252E; border: 1px solid rgba(255,255,255,.09);
}
#panel button, #panel input {
  font: 500 12px 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #E8E5EE; background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.11); border-radius: 8px; padding: 7px 11px;
}
#panel button { cursor: pointer; }
#panel button:hover { background: rgba(255,255,255,.14); }
#panel input { width: 210px; }
</style>
</head>
<body>

<div id="stage">
${html.trim()}
</div>

<div id="panel">
  <input id="cmd" value="!task add Read the chat" spellcheck="false">
  <button onclick="send(document.getElementById('cmd').value)">Send</button>
  <button onclick="send('!task next')">!task next</button>
  <button onclick="send('!task add New task from chat')">!task add</button>
  <button onclick="send('!task undone 3')">!task undone 3</button>
  <button onclick="send('!task remove 2')">!task remove 2</button>
  <button onclick="send('!task clear')">!task clear</button>
  <button onclick="location.reload()">Reload</button>
</div>

<script>
/* ── StreamElements shim ── */
var __store = {};
window.SE_API = {
  store: {
    get: function (k) { return Promise.resolve(__store[k]); },
    set: function (k, v) { __store[k] = v; return Promise.resolve(); }
  }
};
function send(text) {
  window.dispatchEvent(new CustomEvent('onEventReceived', { detail: {
    listener: 'message',
    event: { data: { text: text, nick: 'teststreamer', badges: [{ type: 'broadcaster' }] } }
  }}));
}
</script>

<script>
${js}
</script>

<script>
window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: {
  channel: { username: 'teststreamer' },
  fieldData: ${JSON.stringify(fieldData, null, 2)}
}}));
</script>

</body>
</html>
`;

writeFileSync(new URL('./preview.html', import.meta.url), out);
console.log('preview.html written');
