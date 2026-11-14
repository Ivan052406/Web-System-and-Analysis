/* ==========================================================
   app.js  -  Shared helpers and interface code

   Used by every page:
   1. Small helper functions (dates, money, validation)
   2. Page shell (sidebar, top bar), modal, confirm, toasts
   3. Form and table helpers
   4. Chart helpers
   5. Dashboard page (index.html)

   Each page script calls startApp(renderFunction) once.
   ========================================================== */
'use strict';

const PALETTE = ['#12352e', '#e8a317', '#2f7f9e', '#b5566b', '#6b8f3e', '#7a5ea8', '#d9693c', '#4c5d66'];
const STATUS_COLORS = { ok: '#1f8a5b', low: '#e0a100', out: '#c0392b' };
const STATUS_LABEL = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' };
const HISTORY_BADGE = { 'Stock-In': 'ok', 'Stock-Out': 'out', 'Sale': 'info', 'Adjustment': 'low' };
const PERIODS = [
  { name: 'Morning', hours: '5:00 AM to 11:59 AM' },
  { name: 'Afternoon', hours: '12:00 PM to 5:59 PM' },
  { name: 'Evening', hours: '6:00 PM to 4:59 AM' }
];

/* ---------------------------------------------------------
   1. HELPER FUNCTIONS
   --------------------------------------------------------- */
function $(id) { return document.getElementById(id); }
function setText(id, text) { $(id).textContent = text; }
function pad(n) { return String(n).padStart(2, '0'); }
function round2(n) { return Math.round(n * 100) / 100; }

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
function money(n) { return pesoFormat.format(n); }

// Stops user text from being read as HTML
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function dateKey(value) { // "2026-11-13" using the local date
  const d = new Date(value);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function todayKey() { return dateKey(new Date()); }
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
// Timestamp for a chosen date: "now" if it is today, otherwise noon of that day
function whenFromDateKey(key) {
  if (key === todayKey()) return new Date().toISOString();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function isPositiveInt(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n > 0;
}
function isNonNegativeInt(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n >= 0;
}

// A new token is made each time a form opens. Submitting the same token twice is rejected.
function makeToken() { return 'tok-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10); }

function getPeriod(value) { // Morning, Afternoon or Evening
  const h = new Date(value).getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 18) return 'Afternoon';
  return 'Evening';
}
function startOfWeek(d) { // Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

/* ---------------------------------------------------------
   2. PAGE SHELL, MODAL, CONFIRM, TOASTS
   --------------------------------------------------------- */
let renderCallback = null;
let modalHandler = null;

// Builds the sidebar, top bar, modal and toast area on every page
function buildShell() {
  const root = document.body.dataset.root || '';
  const page = document.body.dataset.page;
  const links = [
    { page: 'dashboard', label: 'Dashboard', href: 'index.html' },
    { page: 'inventory', label: 'Inventory Management', href: 'modules/inventory.html' },
    { page: 'restocking', label: 'Restocking Management', href: 'modules/restocking.html' },
    { page: 'sales', label: 'Sales & Customer Analytics', href: 'modules/sales-analytics.html' }
  ];
  $('sidebar').innerHTML =
    '<div class="brand"><span class="brand-mark" aria-hidden="true">SM</span><span class="brand-name">Store Manager</span></div>' +
    '<nav class="nav">' + links.map((l) =>
      '<a class="nav-item' + (l.page === page ? ' active' : '') + '" href="' + root + l.href + '">' + escapeHtml(l.label) + '</a>'
    ).join('') + '</nav>';

  $('topbar').innerHTML =
    '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">☰</button>' +
    '<h1>' + escapeHtml(document.body.dataset.title || '') + '</h1>' +
    '<div class="topbar-right"><span class="clock" id="clock"></span>' +
    '<button class="btn ghost small" id="btnClearData">Clear all data</button></div>';

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  document.querySelector('.app').appendChild(overlay);

  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-backdrop" id="modal" hidden><div class="modal" id="modalBox" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
    '<div class="modal-head"><h2 id="modalTitle"></h2><button class="icon-btn" id="modalClose" aria-label="Close dialog">×</button></div>' +
    '<form id="modalForm" novalidate><div class="modal-body" id="modalBody"></div>' +
    '<p class="form-error" id="modalError" role="alert" hidden></p>' +
    '<div class="modal-foot"><button type="button" class="btn ghost" id="modalCancel">Cancel</button>' +
    '<button type="submit" class="btn primary" id="modalSubmit">Save</button></div></form></div></div>' +
    '<div class="toasts" id="toasts" aria-live="polite"></div>');
}

function bindShellEvents() {
  const open = () => { $('sidebar').classList.add('open'); $('sidebarOverlay').classList.add('show'); };
  const close = () => { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('show'); };
  $('menuBtn').addEventListener('click', open);
  $('sidebarOverlay').addEventListener('click', close);

  $('btnClearData').addEventListener('click', () => confirmDialog(
    'This permanently deletes ALL products, suppliers, restocks, sales and history. Continue?',
    () => { Store.clearAll(); refreshPage(); showToast('All data cleared.', 'success'); },
    'Delete everything'
  ));

  $('modalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!modalHandler) return;
    const submitBtn = $('modalSubmit');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;                    // blocks double-clicks
    let error = null;
    try {
      error = modalHandler(Object.fromEntries(new FormData(e.target)), e.target);
    } catch (err) {
      error = 'Something went wrong: ' + err.message;
    }
    submitBtn.disabled = false;
    if (error) { showModalError(error); showToast(error, 'error'); } else { closeModal(); }
  });
  $('modalClose').addEventListener('click', closeModal);
  $('modalCancel').addEventListener('click', closeModal);
  $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

  const tick = () => setText('clock', new Date().toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
  tick();
  setInterval(tick, 30000);
}

// Every page calls this once with its own render function
function startApp(renderFn) {
  renderCallback = renderFn;
  buildShell();
  bindShellEvents();
  renderFn();
  // If data changes in another tab, refresh this page too
  window.addEventListener('storage', (e) => {
    if (e.key === Store.KEY) { Store.reload(); refreshPage(); }
  });
  if (typeof Chart === 'undefined' && document.querySelector('canvas')) {
    showToast('Charts could not load. Check your internet connection and refresh.', 'error');
  }
}

function refreshPage() { if (renderCallback) renderCallback(); }

// opts: title, body (HTML), submitLabel, danger, wide, onOpen(form), onSubmit(values, form)
// onSubmit returns null on success or an error message.
function openModal(opts) {
  setText('modalTitle', opts.title);
  $('modalBody').innerHTML = opts.body;
  setText('modalSubmit', opts.submitLabel || 'Save');
  $('modalSubmit').className = 'btn ' + (opts.danger ? 'danger' : 'primary');
  $('modalBox').className = 'modal' + (opts.wide ? ' wide' : '');
  $('modalError').hidden = true;
  $('modal').hidden = false;
  modalHandler = opts.onSubmit;
  if (opts.onOpen) opts.onOpen($('modalForm'));
  const first = $('modalBody').querySelector('input:not([disabled]), select, textarea');
  if (first) first.focus(); else $('modalSubmit').focus();
}
function closeModal() { $('modal').hidden = true; modalHandler = null; }
function showModalError(message) { setText('modalError', message); $('modalError').hidden = false; }

function confirmDialog(message, onYes, confirmLabel) {
  openModal({
    title: 'Please confirm', body: '<p>' + escapeHtml(message) + '</p>',
    submitLabel: confirmLabel || 'Confirm', danger: true,
    onSubmit: () => { onYes(); return null; }
  });
}

function showToast(message, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = message;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------------------------------------------------------
   3. FORM AND TABLE HELPERS
   --------------------------------------------------------- */
// <option> list built from the shared product list (never from fixed data)
function productOptions(selectedId, disableOutOfStock) {
  return '<option value="">Select a product</option>' +
    Store.db().products.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) =>
      '<option value="' + escapeHtml(p.id) + '"' + (p.id === selectedId ? ' selected' : '') +
      (disableOutOfStock && p.stock <= 0 ? ' disabled' : '') + '>' +
      escapeHtml(p.name) + ' (stock: ' + p.stock + ')</option>'
    ).join('');
}

// Stops a form from opening when no products exist yet
function requireProducts() {
  if (Store.db().products.length) return true;
  showToast('Add a product in Inventory Management first.', 'error');
  return false;
}

// Shows the recorded stock under a product select (select must be named productId)
function bindStockHint(form, hintId) {
  const select = form.elements.productId;
  const hint = $(hintId);
  const update = () => {
    const p = Store.getProduct(select.value);
    hint.textContent = p ? 'Recorded stock: ' + p.stock + ' (' + STATUS_LABEL[Store.getStatus(p)] + ', minimum ' + p.minStock + ')' : '';
  };
  select.addEventListener('change', update);
  update();
}

function emptyRow(cols, text) { return '<tr class="empty-row"><td colspan="' + cols + '">' + text + '</td></tr>'; }
function statusBadge(p) {
  const s = Store.getStatus(p);
  return '<span class="badge ' + s + '">' + STATUS_LABEL[s] + '</span>';
}

// Fills a <select> but keeps the user's current choice
function fillSelect(id, firstLabel, options) {
  const el = $(id);
  const previous = el.value;
  el.innerHTML = '<option value="">' + firstLabel + '</option>' +
    options.map((o) => '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</option>').join('');
  if (options.some((o) => o.value === previous)) el.value = previous;
}

// Builds the warning boxes for low and out-of-stock products
function stockAlertsHtml() {
  const prods = Store.db().products;
  const low = prods.filter((p) => Store.getStatus(p) === 'low');
  const out = prods.filter((p) => Store.getStatus(p) === 'out');
  let html = '';
  if (out.length) {
    html += '<div class="alert danger"><strong>Out of stock:</strong> ' + out.map((p) => escapeHtml(p.name)).join(', ') +
      '. Sales are blocked until these are restocked.</div>';
  }
  if (low.length) {
    html += '<div class="alert warn"><strong>Low stock:</strong> ' +
      low.map((p) => escapeHtml(p.name) + ' (' + p.stock + ' left, minimum ' + p.minStock + ')').join(', ') + '.</div>';
  }
  return html;
}

/* ---------------------------------------------------------
   4. CHART HELPERS
   --------------------------------------------------------- */
const charts = {};
const noLegend = { legend: { display: false } };
const intTicks = { beginAtZero: true, ticks: { precision: 0 } };
const pesoTick = { beginAtZero: true, ticks: { callback: (v) => '₱' + v.toLocaleString('en-PH') } };
const pesoTooltip = { callbacks: { label: (ctx) => ' ' + money(ctx.parsed.y) } };

// Creates the chart the first time, then only updates its data
function drawChart(id, type, labels, datasets, options) {
  if (typeof Chart === 'undefined') return; // Chart.js did not load
  if (charts[id]) {
    charts[id].data.labels = labels;
    charts[id].data.datasets = datasets;
    charts[id].update();
    return;
  }
  charts[id] = new Chart($(id), {
    type: type, data: { labels: labels, datasets: datasets },
    options: Object.assign({ responsive: true, maintainAspectRatio: false }, options || {})
  });
}

// Shows a message instead of an empty chart
function setChartEmpty(id, isEmpty, message) {
  const box = $(id).parentElement;
  let note = box.querySelector('.chart-empty');
  if (!note) {
    note = document.createElement('div');
    note.className = 'chart-empty';
    box.appendChild(note);
  }
  note.textContent = message;
  note.hidden = !isEmpty;
  $(id).style.visibility = isEmpty ? 'hidden' : 'visible';
}

/* ---------------------------------------------------------
   5. DASHBOARD PAGE (index.html)
   --------------------------------------------------------- */
function renderDashboard() {
  const db = Store.db();
  const prods = db.products;
  const today = Store.getTodayStats();
  setText('dashProducts', prods.length);
  setText('dashStock', prods.reduce((n, p) => n + p.stock, 0).toLocaleString('en-PH'));
  setText('dashLow', prods.filter((p) => Store.getStatus(p) === 'low').length);
  setText('dashOut', prods.filter((p) => Store.getStatus(p) === 'out').length);
  setText('dashToday', money(today.total));
  setText('dashTxns', today.count);

  let alerts = stockAlertsHtml();
  if (!alerts) {
    alerts = prods.length
      ? '<p class="muted">No stock alerts. Every product is above its minimum level.</p>'
      : '<p class="muted">No products found. Add your first product in Inventory Management to get started.</p>';
  }
  $('dashAlerts').innerHTML = alerts;

  const recent = db.history.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  $('dashRecent').innerHTML = recent.length ? recent.map((h) =>
    '<tr><td>' + fmtDateTime(h.date) + '</td><td>' + escapeHtml(h.productName) + '</td>' +
    '<td><span class="badge ' + HISTORY_BADGE[h.type] + '">' + h.type + '</span></td>' +
    '<td class="num ' + (h.change >= 0 ? 'pos' : 'neg') + '">' + (h.change >= 0 ? '+' : '−') + Math.abs(h.change) + '</td>' +
    '<td class="num">' + h.updated + '</td></tr>'
  ).join('') : emptyRow(5, 'No inventory activity yet.');
}

if (document.body.dataset.page === 'dashboard') startApp(renderDashboard);
