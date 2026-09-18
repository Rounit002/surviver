/* ══════════════════════════════════════════════════════════════
   Stream To-Do Overlay
   Chat commands (default prefix !task, aliases in handle()):
     !task add Build the overlay
     !task done 3          !task next
     !task undone 3        !task edit 3 New wording
     !task remove 3        !task clear
   ══════════════════════════════════════════════════════════════ */

var FD = {};                 // fieldData from the widget settings
var CHANNEL = '';            // broadcaster's login name
var tasks = [];              // [{ t: "text", d: true|false }]
var saveTimer = null;
var STORE_KEY = 'todo_overlay_v1';

var $wrap, $list, $done, $total;

/* ─────────────── boot ─────────────── */
window.addEventListener('onWidgetLoad', function (obj) {
  var detail = obj.detail || {};
  FD = detail.fieldData || {};
  CHANNEL = ((detail.channel && detail.channel.username) || '').toLowerCase();

  $wrap  = document.getElementById('todo-wrap');
  $list  = document.getElementById('todo-list');
  $done  = document.getElementById('todo-done');
  $total = document.getElementById('todo-total');

  applyFields();
  load();
});

function applyFields() {
  var s = $wrap.style;
  var px = function (v, fallback) {
    var n = parseFloat(v);
    return (isNaN(n) ? fallback : n) + 'px';
  };

  if (FD.fontFamily) s.setProperty('--font', "'" + FD.fontFamily + "', system-ui, sans-serif");
  s.setProperty('--w', px(FD.width, 262));
  s.setProperty('--fs', px(FD.fontSize, 13));
  s.setProperty('--gap', px(FD.rowGap, 5));
  s.setProperty('--radius', px(FD.cornerRadius, 8));
  s.setProperty('--pad-y', px(FD.rowPaddingY, 7));
  s.setProperty('--pad-x', px(FD.rowPaddingX, 10));
  s.setProperty('--dur', (FD.animations === 'off' ? 0 : (parseInt(FD.animSpeed, 10) || 320)) + 'ms');

  s.setProperty('--head-color',  FD.headColor    || '#DCD6CA');
  s.setProperty('--count-color', FD.countColor   || '#9E988C');
  s.setProperty('--todo-bg',     FD.todoBg       || '#EDE9E0');
  s.setProperty('--todo-text',   FD.todoText     || '#6E675D');
  s.setProperty('--todo-box',    FD.todoBox      || '#C6BDAD');
  s.setProperty('--current-bg',  FD.currentBg    || '#F7F4ED');
  s.setProperty('--current-text',FD.currentText  || '#3F3A33');
  s.setProperty('--current-box', FD.currentBox   || '#B9AF9E');
  s.setProperty('--done-bg',     FD.doneBg       || '#E7EDE6');
  s.setProperty('--done-text',   FD.doneText     || '#93AB97');
  s.setProperty('--done-strike', FD.doneStrike   || '#B6C8B8');

  document.getElementById('todo-title').textContent = FD.headerText || 'TODAY';
  document.getElementById('todo-head').style.display = (FD.showHeader === 'off') ? 'none' : 'flex';
  document.getElementById('todo-count').style.display = (FD.showCounter === 'off') ? 'none' : 'block';
  document.getElementById('todo-empty').textContent = FD.emptyText || 'No tasks yet';
}

/* ─────────────── storage ─────────────── */
function load() {
  var seed = function () {
    tasks = String(FD.starterTasks || '')
      .split(/[\n|]/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean)
      .map(function (x) { return { t: x, d: false }; });
  };

  if (typeof SE_API === 'undefined' || !SE_API.store) { seed(); renderAll(); return; }

  SE_API.store.get(STORE_KEY).then(function (data) {
    if (data && Object.prototype.toString.call(data.tasks) === '[object Array]') tasks = data.tasks;
    else seed();
    renderAll();
  }).catch(function () { seed(); renderAll(); });
}

function save() {
  if (typeof SE_API === 'undefined' || !SE_API.store) return;
  clearTimeout(saveTimer);
  // debounced: SE throttles store writes
  saveTimer = setTimeout(function () {
    SE_API.store.set(STORE_KEY, { tasks: tasks });
  }, 800);
}

/* ─────────────── chat ─────────────── */
window.addEventListener('onEventReceived', function (obj) {
  var detail = obj.detail || {};
  if (detail.listener !== 'message') return;

  var data = (detail.event && detail.event.data) || {};
  var raw = String(data.text || '').trim();
  var prefix = String(FD.command || '!task').toLowerCase();
  var lower = raw.toLowerCase();

  if (lower !== prefix && lower.indexOf(prefix + ' ') !== 0) return;
  if (!allowed(data)) return;

  handle(raw.slice(prefix.length).trim());
});

function allowed(data) {
  var level = FD.permission || 'mods';
  if (level === 'everyone') return true;

  var badges = data.badges || [];
  var has = function (type) {
    for (var i = 0; i < badges.length; i++) if (badges[i].type === type) return true;
    return false;
  };
  var isBroadcaster = has('broadcaster') || String(data.nick || '').toLowerCase() === CHANNEL;

  if (level === 'broadcaster') return isBroadcaster;
  return isBroadcaster || has('moderator');   // 'mods'
}

function handle(rest) {
  if (!rest) return;

  var sp = rest.indexOf(' ');
  var verb = (sp < 0 ? rest : rest.slice(0, sp)).toLowerCase();
  var arg = sp < 0 ? '' : rest.slice(sp + 1).trim();

  switch (verb) {
    case 'add': case 'a': case '+':
      addTask(arg); break;

    case 'done': case 'd': case 'check': case 'x':
      setDone(num(arg), true); break;

    case 'undone': case 'u': case 'uncheck':
      setDone(num(arg), false); break;

    case 'next': case 'n':
      setDone(firstOpen(), true); break;

    case 'edit': case 'e':
      var esp = arg.indexOf(' ');
      if (esp > 0) editTask(num(arg.slice(0, esp)), arg.slice(esp + 1).trim());
      break;

    case 'remove': case 'rm': case 'del': case 'delete': case '-':
      removeTask(num(arg)); break;

    case 'clear': case 'reset':
      clearAll(); break;
  }
}

function num(s) { return parseInt(s, 10) - 1; }              // chat is 1-based
function firstOpen() {
  for (var i = 0; i < tasks.length; i++) if (!tasks[i].d) return i;
  return -1;
}
function valid(i) { return i >= 0 && i < tasks.length; }

/* ─────────────── mutations ─────────────── */
function addTask(text) {
  text = String(text || '').trim().slice(0, parseInt(FD.maxLength, 10) || 80);
  if (!text) return;
  if (tasks.length >= (parseInt(FD.maxTasks, 10) || 8)) return;

  tasks.push({ t: text, d: false });
  var row = buildRow(tasks[tasks.length - 1]);
  row.classList.add('collapsed');
  $list.appendChild(row);
  expand(row);
  refresh();
  save();
}

function setDone(i, state) {
  if (!valid(i) || tasks[i].d === state) return;
  tasks[i].d = state;

  var row = $list.children[i];
  if (row && state) {
    row.classList.add('pop');
    setTimeout(function () { row.classList.remove('pop'); }, 460);
  }
  refresh();
  save();
}

function editTask(i, text) {
  text = String(text || '').trim().slice(0, parseInt(FD.maxLength, 10) || 80);
  if (!valid(i) || !text) return;
  tasks[i].t = text;
  var label = $list.children[i] && $list.children[i].querySelector('.t-label');
  if (label) label.textContent = text;
  save();
}

function removeTask(i) {
  if (!valid(i)) return;
  var row = $list.children[i];
  tasks.splice(i, 1);
  save();

  if (!row) { renderAll(); return; }
  collapse(row, function () {
    row.parentNode && row.parentNode.removeChild(row);
    renumber();
    refresh();
  });
}

function clearAll() {
  tasks = [];
  save();
  var rows = Array.prototype.slice.call($list.children);
  if (!rows.length) { refresh(); return; }
  rows.forEach(function (row, n) {
    setTimeout(function () {
      collapse(row, function () { row.parentNode && row.parentNode.removeChild(row); refresh(); });
    }, n * 45);
  });
}

/* ─────────────── rendering ─────────────── */
function renderAll() {
  $list.innerHTML = '';
  tasks.forEach(function (task, i) {
    var row = buildRow(task);
    row.classList.add('collapsed');
    $list.appendChild(row);
    setTimeout(function () { expand(row); }, i * 60);   // gentle stagger on load
  });
  renumber();
  refresh();
}

function buildRow(task) {
  var row = document.createElement('div');
  row.className = 't-row';

  var html = '';
  if (FD.showNumbers === 'on') html += '<span class="t-num"></span>';
  html +=
    '<span class="t-mark">' +
      '<span class="t-box"></span>' +
      '<svg class="t-tick" viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 6.5"></path></svg>' +
    '</span>' +
    '<span class="t-label"></span>';

  row.innerHTML = html;
  row.querySelector('.t-label').textContent = task.t;   // textContent — chat input is never parsed as HTML
  return row;
}

function renumber() {
  if (FD.showNumbers !== 'on') return;
  for (var i = 0; i < $list.children.length; i++) {
    var n = $list.children[i].querySelector('.t-num');
    if (n) n.textContent = (i + 1) + '.';
  }
}

/* keeps classes, counter and visibility in sync with `tasks` */
function refresh() {
  var open = firstOpen();

  for (var i = 0; i < $list.children.length; i++) {
    var row = $list.children[i];
    var task = tasks[i];
    if (!task) continue;
    row.classList.toggle('done', !!task.d);
    row.classList.toggle('current', i === open);
  }

  var doneCount = tasks.filter(function (x) { return x.d; }).length;
  $done.textContent = doneCount;
  $total.textContent = tasks.length;

  // only call it empty once the leaving rows have finished animating out
  var empty = tasks.length === 0 && $list.children.length === 0;
  $wrap.classList.toggle('is-empty', empty);
  $wrap.classList.toggle('hidden', empty && FD.hideWhenEmpty === 'on');
}

/* ─────────────── height animation helpers ─────────────── */
function expand(row) {
  // measure the row at its natural height, then play it open from collapsed
  row.style.maxHeight = 'none';
  row.classList.remove('collapsed');
  var h = row.scrollHeight;

  row.classList.add('collapsed');
  row.style.maxHeight = '';
  void row.offsetHeight;                 // force the browser to take the collapsed state

  row.style.maxHeight = h + 'px';
  row.classList.remove('collapsed');
  setTimeout(function () { row.style.maxHeight = 'none'; }, parseInt(FD.animSpeed, 10) || 320);
}

function collapse(row, done) {
  row.style.maxHeight = row.scrollHeight + 'px';
  void row.offsetHeight;                 // force the browser to take that height
  row.classList.add('collapsed');
  setTimeout(done, (parseInt(FD.animSpeed, 10) || 320) + 40);
}
