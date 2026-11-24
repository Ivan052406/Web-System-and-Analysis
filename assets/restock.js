/* CanteenIQ – Demand & Restock Insights */

/* ==========================================================
   1. DATA – optional starting list.

   You can leave this empty: staff add, edit and delete products
   on the page, and the list is saved in this browser.

   Each product:
     n        product name
     stock    current stock
     trend    units sold per day, Mon–Sun (7 numbers)

   Example:
     { n: "Iced Tea", stock: 8, trend: [40, 45, 55, 50, 60, 70, 65] }

   Everything else (average demand, trend direction, days of stock
   left, restock status and quantity) is worked out from these three.
   ========================================================== */
const products = [];

/* ==========================================================
   2. APP – everything below renders and runs the page
   ========================================================== */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const COLORS = ["#5b3e31", "#dba17f", "#a8643a", "#8a8f5c", "#d9c2b0"];
  const OTHERS_COLOR = "#cfc3bb";
  const GRID_COLOR = "rgba(91,62,49,.12)";
  const MAX_TREND_LINES = 3;
  const MAX_STOCK_BARS = 8;
  const STEADY_BAND = 5; // demand change (%) smaller than this counts as "steady"

  const KEYS = { products: "casiaRestockProducts", settings: "casiaRestockSettings" };
  const DEFAULTS = { leadTime: 2, safetyDays: 1, targetDays: 7 };

  const STATUS = {
    out:  { label: "Out of stock", pill: "pill-out",  rank: 0 },
    now:  { label: "Restock now",  pill: "pill-need", rank: 1 },
    soon: { label: "Restock soon", pill: "pill-soon", rank: 2 },
    ok:   { label: "OK",           pill: "pill-ok",   rank: 3 },
  };

  const SAMPLE = [
    { n: "Iced Tea",         stock: 8,   trend: [40, 45, 55, 50, 60, 70, 65] },
    { n: "Chicken Adobo",    stock: 150, trend: [30, 32, 31, 33, 30, 28, 29] },
    { n: "Siomai",           stock: 45,  trend: [25, 24, 22, 20, 18, 15, 14] },
    { n: "Bottled Water",    stock: 260, trend: [50, 52, 48, 55, 51, 49, 53] },
    { n: "Banana Cue",       stock: 0,   trend: [12, 14, 13, 15, 16, 18, 20] },
    { n: "Fried Rice",       stock: 70,  trend: [20, 22, 21, 23, 22, 24, 23] },
    { n: "Iced Coffee",      stock: 40,  trend: [18, 19, 22, 24, 26, 30, 33] },
  ];

  const EMPTY = {
    table: "No products yet. Add one, import a CSV, or load sample data to see suggestions.",
    trend: ["No demand data yet", "Add products with their daily sales to see how demand changes."],
    stock: ["Nothing to compare yet", "Add products and stock levels to compare them with demand."],
    share: ["No demand split yet", "Sales by product will show up here."],
  };

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const sum = (list, pick = (n) => n) => list.reduce((total, item) => total + pick(item), 0);
  const mean = (list) => (list.length ? sum(list) / list.length : 0);

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmt = (n) =>
    Number.isInteger(n)
      ? n.toLocaleString()
      : (Math.round(n * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const emptyHtml = ([title, message]) =>
    `<div class="empty"><b>${title}</b><span>${message}</span></div>`;
  const canvasHtml = (id) => `<div class="chart"><canvas id="${id}"></canvas></div>`;

  const baseOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { position: "top", align: "start", labels: { boxWidth: 10 } } },
  };
  const axes = (extra = {}) => ({
    x: { grid: { display: false } },
    y: { grid: { color: GRID_COLOR }, ...extra },
  });

  /* ---------- Saved data ---------- */
  function readStorage(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: keep working without saving */ }
  }

  // Makes sure a product has an id, a clean name/stock and exactly 7 non-negative sales numbers
  function cleanProduct(p) {
    let trend = Array.isArray(p.trend) ? p.trend.slice(0, 7) : [];
    if (!trend.length && Number.isFinite(p.demand)) trend = Array(7).fill(p.demand); // old format: one "demand" number
    while (trend.length < 7) trend.push(0);
    return {
      id: p.id || newId(),
      n: String(p.n || "").trim(),
      stock: Math.max(0, Number(p.stock) || 0),
      trend: trend.map((v) => Math.max(0, Number(v) || 0)),
    };
  }

  function loadItems() {
    const saved = readStorage(KEYS.products);
    return (Array.isArray(saved) ? saved : products).map(cleanProduct).filter((p) => p.n);
  }

  function loadSettings() {
    return { ...DEFAULTS, ...(readStorage(KEYS.settings) || {}) };
  }

  const state = {
    items: loadItems(),
    settings: loadSettings(),
    filter: "all",
    query: "",
    sort: { key: "status", dir: 1 },
    trendPick: "top3",
    editingId: null,
  };
  let charts = {};

  const saveItems = () => writeStorage(KEYS.products, state.items);
  const saveSettings = () => writeStorage(KEYS.settings, state.settings);

  /* ==========================================================
     3. CALCULATIONS – the five insights
     ========================================================== */
  function analyse(p, s) {
    const total = sum(p.trend);
    const avg = mean(p.trend);                    // 1. average daily demand (7-day mean)
    const recent = mean(p.trend.slice(-3));       // last 3 days
    const early = mean(p.trend.slice(0, 3));      // first 3 days

    // 2. demand trend: last 3 days compared with the first 3 days of the week
    const change = early > 0 ? ((recent - early) / early) * 100 : recent > 0 ? 100 : 0;
    const direction = change >= STEADY_BAND ? "up" : change <= -STEADY_BAND ? "down" : "flat";

    // expected daily demand: leans on recent days so a rising or falling product is not misjudged
    const demand = 0.6 * avg + 0.4 * recent;

    // 3. current stock vs demand: how many days the stock will last
    const daysLeft = demand > 0 ? p.stock / demand : Infinity;

    // 4. restock suggestion
    const reorderDays = s.leadTime + s.safetyDays;
    let status = "ok";
    if (demand > 0) {
      if (p.stock <= 0) status = "out";
      else if (daysLeft < s.leadTime) status = "now";   // will run out before a delivery arrives
      else if (daysLeft < reorderDays) status = "soon"; // inside the reorder window
    }

    // 5. suggested restock quantity: enough to cover the delivery wait plus the target days of sales
    const restock = status === "ok" ? 0 : Math.max(1, Math.ceil(demand * (s.leadTime + s.targetDays) - p.stock));

    return { ...p, total, avg, recent, change, direction, demand, daysLeft, status, restock, needed: demand * reorderDays };
  }

  const analyseAll = () => state.items.map((p) => analyse(p, state.settings));
  const needsRestock = (r) => r.status !== "ok";

  /* ==========================================================
     4. RENDER – KPIs, controls, table
     ========================================================== */
  function renderKpis(list) {
    const low = list.filter(needsRestock);
    $("kpi-sold").textContent = sum(list, (p) => p.total).toLocaleString();
    $("kpi-demand").textContent = fmt(sum(list, (p) => p.demand));
    $("kpi-restock").textContent = sum(low, (p) => p.restock).toLocaleString();
    $("kpi-count").textContent = low.length;
    $("kpi-count").classList.toggle("alert", low.length > 0);
  }

  function renderCounts(list) {
    const low = list.filter(needsRestock).length;
    $("count-all").textContent = list.length;
    $("count-low").textContent = low;
    $("count-ok").textContent = list.length - low;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === state.filter));
  }

  function renderControls(list) {
    renderCounts(list);

    $("set-lead").value = state.settings.leadTime;
    $("set-safety").value = state.settings.safetyDays;
    $("set-target").value = state.settings.targetDays;

    const options = [["top3", "Top 3 products"], ["total", "All products (total)"], ...list.map((p) => [p.id, p.n])];
    if (!options.some(([v]) => v === state.trendPick)) state.trendPick = "top3";
    $("trend-pick").innerHTML = options
      .map(([v, label]) => `<option value="${esc(v)}"${v === state.trendPick ? " selected" : ""}>${esc(label)}</option>`)
      .join("");

    $("btn-export").disabled = !list.length;
    $("btn-clear").disabled = !list.length;
  }

  const trendHtml = (p) => {
    const icon = p.direction === "up" ? "▲" : p.direction === "down" ? "▼" : "▶";
    const label = p.direction === "flat" ? "Steady" : `${Math.abs(Math.round(p.change))}%`;
    return `<span class="trend trend-${p.direction}">${icon} ${label}</span>`;
  };

  const daysHtml = (p) =>
    Number.isFinite(p.daysLeft)
      ? `<span class="${p.status === "ok" ? "" : "days-low"}">${fmt(p.daysLeft)} day${p.daysLeft === 1 ? "" : "s"}</span>`
      : `<span class="muted">No sales</span>`;

  const SORTERS = {
    n:      (a, b) => a.n.localeCompare(b.n),
    stock:  (a, b) => a.stock - b.stock,
    demand: (a, b) => a.demand - b.demand,
    change: (a, b) => a.change - b.change,
    days:   (a, b) => (a.daysLeft === b.daysLeft ? 0 : a.daysLeft - b.daysLeft),
    restock:(a, b) => a.restock - b.restock,
    status: (a, b) => STATUS[a.status].rank - STATUS[b.status].rank || SORTERS.days(a, b),
  };

  const byUrgency = (list) => [...list].sort(SORTERS.status);

  function renderTable(list) {
    const q = state.query.trim().toLowerCase();
    let rows = list.filter((p) => {
      if (state.filter === "low" && !needsRestock(p)) return false;
      if (state.filter === "ok" && needsRestock(p)) return false;
      return !q || p.n.toLowerCase().includes(q);
    });
    rows.sort((a, b) => SORTERS[state.sort.key](a, b) * state.sort.dir);

    document.querySelectorAll("th[data-sort]").forEach((th) => {
      const active = th.dataset.sort === state.sort.key;
      th.classList.toggle("sorted", active);
      th.setAttribute("aria-sort", active ? (state.sort.dir === 1 ? "ascending" : "descending") : "none");
    });

    if (!list.length) {
      $("restock-rows").innerHTML =
        `<tr><td colspan="8" class="table-empty">${EMPTY.table}<br><button class="btn btn-sm" data-act="sample">Load sample data</button></td></tr>`;
      return;
    }
    if (!rows.length) {
      $("restock-rows").innerHTML = `<tr><td colspan="8" class="table-empty">No products match.</td></tr>`;
      return;
    }

    $("restock-rows").innerHTML = rows.map((p) => `<tr data-id="${esc(p.id)}">
        <td>${esc(p.n)}</td>
        <td>${fmt(p.stock)}</td>
        <td>${fmt(p.demand)}</td>
        <td>${trendHtml(p)}</td>
        <td>${daysHtml(p)}</td>
        <td>${p.restock ? `<b>${fmt(p.restock)}</b>` : `<span class="muted">—</span>`}</td>
        <td><span class="pill ${STATUS[p.status].pill}">${STATUS[p.status].label}</span></td>
        <td class="actions">
          ${needsRestock(p) ? `<button class="btn btn-sm btn-primary" data-act="restock" title="Add the suggested quantity to stock">Restock</button>` : ""}
          <button class="btn btn-sm btn-ghost" data-act="edit">Edit</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-act="delete">Delete</button>
        </td>
      </tr>`).join("");
  }

  /* ==========================================================
     5. RENDER – charts
     ========================================================== */
  function destroyCharts() {
    Object.values(charts).forEach((c) => c.destroy());
    charts = {};
  }

  function trendChart(list) {
    let sets;
    if (state.trendPick === "total") {
      sets = [{ n: "All products", trend: DAYS.map((_, d) => sum(list, (p) => p.trend[d])) }];
    } else if (state.trendPick === "top3") {
      sets = [...list].sort((a, b) => b.demand - a.demand).slice(0, MAX_TREND_LINES);
    } else {
      sets = list.filter((p) => p.id === state.trendPick);
    }
    return new Chart($("trend"), {
      type: "line",
      data: {
        labels: DAYS,
        datasets: sets.map((p, i) => ({
          label: p.n, data: p.trend,
          borderColor: COLORS[i], backgroundColor: COLORS[i],
          tension: 0.35, pointRadius: 3,
        })),
      },
      options: { ...baseOptions, scales: axes({ beginAtZero: true, title: { display: true, text: "Units sold" } }) },
    });
  }

  function stockChart(list) {
    const top = byUrgency(list).slice(0, MAX_STOCK_BARS);
    return new Chart($("stock"), {
      type: "bar",
      data: {
        labels: top.map((p) => p.n),
        datasets: [
          { label: "Current stock", data: top.map((p) => p.stock), backgroundColor: COLORS[0], borderRadius: 3 },
          { label: "Needed until restock arrives", data: top.map((p) => Math.ceil(p.needed)), backgroundColor: COLORS[1], borderRadius: 3 },
        ],
      },
      options: { ...baseOptions, scales: axes({ beginAtZero: true }) },
    });
  }

  function shareChart(list) {
    const ranked = [...list].sort((a, b) => b.demand - a.demand);
    const top = ranked.slice(0, COLORS.length);
    const rest = sum(ranked.slice(COLORS.length), (p) => p.demand);
    const labels = top.map((p) => p.n);
    const values = top.map((p) => p.demand);
    const colors = COLORS.slice(0, top.length);
    if (rest > 0) { labels.push("Others"); values.push(rest); colors.push(OTHERS_COLOR); }

    const total = sum(values) || 1;
    return new Chart($("share"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data: values.map((v) => Math.round((v / total) * 100)), backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        ...baseOptions, cutout: "62%",
        plugins: {
          legend: { position: "right", labels: { boxWidth: 10 } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
        },
      },
    });
  }

  function renderCharts(list) {
    destroyCharts();
    if (!list.length) {
      $("trend-box").innerHTML = emptyHtml(EMPTY.trend);
      $("stock-box").innerHTML = emptyHtml(EMPTY.stock);
      $("share-box").innerHTML = emptyHtml(EMPTY.share);
      return;
    }
    if (typeof Chart === "undefined") {
      const msg = emptyHtml(["Charts could not load", "Check your internet connection and refresh the page."]);
      $("trend-box").innerHTML = $("stock-box").innerHTML = $("share-box").innerHTML = msg;
      return;
    }
    $("trend-box").innerHTML = canvasHtml("trend");
    $("stock-box").innerHTML = canvasHtml("stock");
    $("share-box").innerHTML = canvasHtml("share");
    charts = { trend: trendChart(list), stock: stockChart(list), share: shareChart(list) };
  }

  function refresh() {
    const list = analyseAll();
    renderKpis(list);
    renderControls(list);
    renderTable(list);
    renderCharts(list);
  }

  /* ==========================================================
     6. ACTIONS – add, edit, delete, restock, import, export
     ========================================================== */
  let toastTimer;
  function toast(message) {
    const box = $("toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 3200);
  }

  const findItem = (id) => state.items.find((p) => p.id === id);
  const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

  /* ----- Add / edit form ----- */
  const dialog = $("product-dialog");

  function buildWeekInputs() {
    $("week-grid").innerHTML = DAYS.map((d, i) =>
      `<label>${d}<input type="number" min="0" step="1" inputmode="numeric" data-day="${i}" required></label>`).join("");
  }

  function openForm(id) {
    const p = id ? findItem(id) : null;
    state.editingId = p ? p.id : null;
    $("dialog-title").textContent = p ? "Edit product" : "Add product";
    $("p-name").value = p ? p.n : "";
    $("p-stock").value = p ? p.stock : "";
    document.querySelectorAll("[data-day]").forEach((el) => { el.value = p ? p.trend[el.dataset.day] : ""; });
    $("form-error").textContent = "";
    dialog.showModal();
    $("p-name").focus();
  }

  function submitForm(event) {
    event.preventDefault();
    const name = $("p-name").value.trim();
    const stock = Number($("p-stock").value);
    const trend = [...document.querySelectorAll("[data-day]")].map((el) => Number(el.value));
    const fail = (text) => { $("form-error").textContent = text; };

    if (!name) return fail("Enter a product name.");
    if (state.items.some((p) => p.id !== state.editingId && sameName(p.n, name))) return fail(`"${name}" is already on the list. Edit it instead.`);
    if ($("p-stock").value === "" || !Number.isInteger(stock) || stock < 0) return fail("Current stock must be a whole number, 0 or more.");
    if (trend.some((v, i) => document.querySelectorAll("[data-day]")[i].value === "" || !Number.isInteger(v) || v < 0)) {
      return fail("Fill in units sold for all 7 days (whole numbers, 0 or more).");
    }

    const item = { id: state.editingId || newId(), n: name, stock, trend };
    state.items = state.editingId
      ? state.items.map((p) => (p.id === state.editingId ? item : p))
      : [...state.items, item];
    saveItems();
    dialog.close();
    refresh();
    toast(state.editingId ? `Updated ${name}.` : `Added ${name}.`);
  }

  /* ----- Row buttons ----- */
  function onTableClick(event) {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "sample") return loadSample();

    const id = btn.closest("tr").dataset.id;
    const p = findItem(id);
    if (!p) return;

    if (btn.dataset.act === "edit") return openForm(id);

    if (btn.dataset.act === "delete") {
      if (!confirm(`Delete ${p.n}? This cannot be undone.`)) return;
      state.items = state.items.filter((x) => x.id !== id);
      saveItems();
      refresh();
      return toast(`Deleted ${p.n}.`);
    }

    if (btn.dataset.act === "restock") {
      const qty = analyse(p, state.settings).restock;
      p.stock += qty;
      saveItems();
      refresh();
      toast(`Added ${qty.toLocaleString()} units to ${p.n}.`);
    }
  }

  function loadSample() {
    state.items = SAMPLE.map(cleanProduct);
    saveItems();
    refresh();
    document.querySelector(".table-wrap").scrollLeft = 0;
    toast("Sample data loaded.");
  }

  /* ----- CSV ----- */
  function parseCsvLine(line) {
    const cells = [];
    let cur = "", quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  }

  const isCount = (text) => text !== "" && Number.isFinite(Number(text)) && Number(text) >= 0;

  async function importCsv(file) {
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim());
    let added = 0, updated = 0, skipped = 0;

    lines.forEach((line, i) => {
      const cells = parseCsvLine(line);
      if (i === 0 && !isCount(cells[1] ?? "")) return;             // header row
      const nums = cells.slice(1, 9);
      if (!cells[0] || nums.length < 8 || !nums.every(isCount)) { skipped++; return; }

      const item = cleanProduct({ n: cells[0], stock: Math.round(Number(nums[0])), trend: nums.slice(1).map((v) => Math.round(Number(v))) });
      const existing = state.items.find((p) => sameName(p.n, item.n));
      if (existing) { Object.assign(existing, { stock: item.stock, trend: item.trend }); updated++; }
      else { state.items.push(item); added++; }
    });

    saveItems();
    refresh();
    toast(`Imported: ${added} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}.`);
  }

  function exportCsv() {
    const quote = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = ["Product", "Current stock", "Avg daily demand", "Demand change %", "Days of stock left", "Suggested restock", "Status"];
    const rows = byUrgency(analyseAll()).map((p) => [
      quote(p.n), p.stock, Math.round(p.demand * 10) / 10, Math.round(p.change),
      Number.isFinite(p.daysLeft) ? Math.round(p.daysLeft * 10) / 10 : "", p.restock, STATUS[p.status].label,
    ]);
    const blob = new Blob([[head, ...rows].map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "restock-suggestions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ==========================================================
     7. EVENTS
     ========================================================== */
  function bindEvents() {
    $("btn-add").addEventListener("click", () => openForm(null));
    $("btn-import").addEventListener("click", () => $("csv-input").click());
    $("csv-input").addEventListener("change", (e) => { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ""; });
    $("btn-export").addEventListener("click", exportCsv);
    $("btn-clear").addEventListener("click", () => {
      if (!confirm("Delete ALL products? This cannot be undone.")) return;
      state.items = [];
      saveItems();
      refresh();
    });

    $("product-form").addEventListener("submit", submitForm);
    $("dialog-cancel").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

    $("restock-rows").addEventListener("click", onTableClick);

    document.querySelectorAll("th[data-sort] button").forEach((b) => b.addEventListener("click", () => {
      const key = b.closest("th").dataset.sort;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : 1 };
      renderTable(analyseAll());
    }));

    document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      state.filter = c.dataset.filter;
      const list = analyseAll();
      renderCounts(list);
      renderTable(list);
    }));

    $("search").addEventListener("input", (e) => { state.query = e.target.value; renderTable(analyseAll()); });
    $("trend-pick").addEventListener("change", (e) => { state.trendPick = e.target.value; refresh(); });

    // Settings: recalculate everything as soon as a value changes
    [["set-lead", "leadTime", 0], ["set-safety", "safetyDays", 0], ["set-target", "targetDays", 1]].forEach(([id, key, min]) => {
      $(id).addEventListener("input", (e) => {
        const value = Number(e.target.value);
        if (e.target.value === "" || !Number.isFinite(value) || value < min) return;
        state.settings[key] = value;
        saveSettings();
        const list = analyseAll();
        renderKpis(list);
        renderCounts(list);
        renderTable(list);
        renderCharts(list);
      });
    });
    $("btn-reset-settings").addEventListener("click", () => { state.settings = { ...DEFAULTS }; saveSettings(); refresh(); });

    // Phone menu
    const sidebar = $("sidebar");
    $("menuBtn").addEventListener("click", (e) => { e.stopPropagation(); sidebar.classList.toggle("show"); });
    document.addEventListener("click", (e) => { if (!sidebar.contains(e.target)) sidebar.classList.remove("show"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") sidebar.classList.remove("show"); });
  }

  /* ---------- Init ---------- */
  function init() {
    if (typeof Chart !== "undefined") {
      Chart.defaults.color = "#8a7468";
      Chart.defaults.font.family = "Montserrat, sans-serif";
      Chart.defaults.font.size = 11;
    }
    buildWeekInputs();
    bindEvents();
    refresh();
  }

  init();
})();