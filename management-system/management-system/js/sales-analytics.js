/* ==========================================================
   sales-analytics.js  -  Module 6: Sales and Customer Analytics
   Every number and chart is calculated from the saved sales.
   ========================================================== */
'use strict';

let trendMode = 'daily'; // daily | weekly | monthly

/* ---------- calculations ---------- */
function getTotalItemsSold() {
  return Store.db().sales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0);
}

// Daily = last 14 days, weekly = last 8 weeks, monthly = last 6 months
function getTrendData(mode) {
  const now = new Date();
  const buckets = [];
  if (mode === 'daily') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({ key: dateKey(d), label: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), total: 0 });
    }
  } else if (mode === 'weekly') {
    const monday = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - i * 7);
      buckets.push({ key: dateKey(d), label: 'Week of ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), total: 0 });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: d.getFullYear() + '-' + pad(d.getMonth() + 1), label: d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }), total: 0 });
    }
  }
  const byKey = {};
  buckets.forEach((b) => { byKey[b.key] = b; });
  Store.db().sales.forEach((s) => {
    const d = new Date(s.date);
    let key;
    if (mode === 'daily') key = dateKey(d);
    else if (mode === 'weekly') key = dateKey(startOfWeek(d));
    else key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    if (byKey[key]) byKey[key].total += s.total;
  });
  buckets.forEach((b) => { b.total = round2(b.total); });
  return buckets;
}

// Products ranked by units sold (highest first)
function getBestSellers() {
  const map = {};
  Store.db().sales.forEach((s) => s.items.forEach((i) => {
    if (!map[i.productId]) map[i.productId] = { name: i.name, qty: 0, revenue: 0 };
    map[i.productId].qty += i.qty;
    map[i.productId].revenue += i.subtotal;
  }));
  return Object.values(map).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
}

// Sales total per category (categories come from the user's own products)
function getCategorySales() {
  const map = {};
  Store.db().sales.forEach((s) => s.items.forEach((i) => {
    if (!map[i.category]) map[i.category] = { category: i.category, qty: 0, revenue: 0 };
    map[i.category].qty += i.qty;
    map[i.category].revenue += i.subtotal;
  }));
  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

// Transactions per time period, percentage share, and the busiest period
function getTraffic() {
  const sales = Store.db().sales;
  const counts = { Morning: 0, Afternoon: 0, Evening: 0 };
  sales.forEach((s) => { counts[getPeriod(s.date)] += 1; });
  const total = sales.length;
  const rows = PERIODS.map((p) => ({
    name: p.name, hours: p.hours, count: counts[p.name],
    percent: total > 0 ? (counts[p.name] / total) * 100 : 0
  }));
  let peak = null;
  if (total > 0) peak = rows.reduce((best, r) => (r.count > best.count ? r : best), rows[0]);
  return { rows, total, peak };
}

/* ---------- rendering ---------- */
function renderSalesPage() {
  const sales = Store.db().sales;
  const today = Store.getTodayStats();
  setText('anToday', money(today.total));
  setText('anTodaySub', today.count + ' transaction(s) today');
  setText('anTxns', sales.length.toLocaleString('en-PH'));
  setText('anTxnsSub', 'All time, ' + today.count + ' today');
  setText('anItems', getTotalItemsSold().toLocaleString('en-PH'));
  setText('anItemsSub', 'All time, ' + today.items + ' today');

  const traffic = getTraffic();
  if (traffic.peak) {
    setText('anPeakName', traffic.peak.name);
    setText('anPeakSub', traffic.peak.count + ' transactions, ' + traffic.peak.percent.toFixed(1) + '% of total');
  } else {
    setText('anPeakName', 'No data');
    setText('anPeakSub', 'Record a sale to see the busiest period');
  }

  const best = getBestSellers();
  $('bestBody').innerHTML = best.length ? best.slice(0, 10).map((b, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(b.name) + '</td><td class="num">' + b.qty + '</td><td class="num">' + money(b.revenue) + '</td></tr>'
  ).join('') : emptyRow(4, 'No sales yet.');

  const cats = getCategorySales();
  $('catBody').innerHTML = cats.length ? cats.map((c) =>
    '<tr><td>' + escapeHtml(c.category) + '</td><td class="num">' + c.qty + '</td><td class="num">' + money(c.revenue) + '</td></tr>'
  ).join('') : emptyRow(3, 'No sales yet.');

  $('trafficBody').innerHTML = traffic.rows.map((r) =>
    '<tr><td>' + (traffic.peak && traffic.peak.name === r.name ? '<strong>' + r.name + ' (peak)</strong>' : r.name) +
    '</td><td>' + r.hours + '</td><td class="num">' + r.count + '</td><td class="num">' + r.percent.toFixed(1) + '%</td></tr>'
  ).join('');

  renderTransactions();
  updateSalesCharts();
}

function renderTransactions() {
  const sales = Store.db().sales;
  const q = $('txnSearch').value.trim().toLowerCase();
  const day = $('txnDate').value;
  const rows = sales.filter((s) => {
    if (day && dateKey(s.date) !== day) return false;
    if (q && !(s.id + ' ' + s.items.map((i) => i.name).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const shown = rows.slice(0, 300);
  const sum = rows.reduce((n, s) => n + s.total, 0);
  setText('txnCount', rows.length + ' transaction(s), ' + money(sum) + ' total' + (rows.length > shown.length ? ' (showing the latest 300)' : ''));
  $('txnBody').innerHTML = shown.length ? shown.map((s) =>
    '<tr><td>' + escapeHtml(s.id) + '</td><td>' + fmtDateTime(s.date) + '</td>' +
    '<td class="wrap">' + s.items.map((i) => escapeHtml(i.name) + ' ×' + i.qty + ' (' + money(i.subtotal) + ')').join(', ') + '</td>' +
    '<td class="num">' + s.items.reduce((n, i) => n + i.qty, 0) + '</td>' +
    '<td class="num"><strong>' + money(s.total) + '</strong></td>' +
    '<td><span class="badge ok">' + s.status + '</span></td></tr>'
  ).join('') : emptyRow(6, sales.length ? 'No transactions match your filters.' : 'No sales transactions yet.');
}

/* ---------- charts ---------- */
function updateSalesCharts() {
  const noSales = !Store.db().sales.length;

  const trend = getTrendData(trendMode);
  drawChart('anLineChart', 'line', trend.map((b) => b.label), [{
    label: 'Sales', data: trend.map((b) => b.total),
    borderColor: PALETTE[0], backgroundColor: 'rgba(232,163,23,.18)', fill: true, tension: 0.3, pointRadius: 3
  }], { plugins: { legend: { display: false }, tooltip: pesoTooltip }, scales: { y: pesoTick } });
  setChartEmpty('anLineChart', trend.every((b) => b.total === 0), noSales ? 'No completed sales yet.' : 'No sales in this period.');

  const best = getBestSellers().slice(0, 8);
  drawChart('anBestChart', 'bar', best.map((b) => b.name), [{
    label: 'Units sold', data: best.map((b) => b.qty), backgroundColor: PALETTE[1]
  }], { indexAxis: 'y', plugins: noLegend, scales: { x: intTicks } });
  setChartEmpty('anBestChart', noSales, 'No sales yet. Best sellers will appear here.');

  const cats = getCategorySales();
  drawChart('anCatChart', 'doughnut', cats.map((c) => c.category), [{
    data: cats.map((c) => round2(c.revenue)), backgroundColor: PALETTE
  }], { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + money(ctx.parsed) } } } });
  setChartEmpty('anCatChart', noSales, 'No sales yet. Category sales will appear here.');

  const traffic = getTraffic();
  drawChart('anTrafficChart', 'doughnut', traffic.rows.map((r) => r.name), [{
    data: traffic.rows.map((r) => r.count), backgroundColor: [PALETTE[1], PALETTE[2], PALETTE[0]]
  }], { cutout: '62%', plugins: { legend: { position: 'bottom' } } });
  setChartEmpty('anTrafficChart', noSales, 'No transactions yet. Customer traffic will appear here.');
}

/* ---------- sales form ---------- */
function openSaleModal() {
  if (!requireProducts()) return;
  const token = makeToken();
  openModal({
    title: 'New sale', submitLabel: 'Complete sale', wide: true,
    body:
      '<div><div id="saleLines"></div>' +
      '<button type="button" class="btn ghost small" id="addSaleLine">Add another product</button>' +
      '<p class="sale-total">Total: <strong id="saleTotal">' + money(0) + '</strong></p></div>',
    onOpen: () => {
      const box = $('saleLines');
      // Recalculates each line subtotal and the grand total
      const updateTotals = () => {
        let total = 0;
        box.querySelectorAll('.sale-line').forEach((row) => {
          const p = Store.getProduct(row.querySelector('.line-product').value);
          const qty = Number(row.querySelector('.line-qty').value);
          const subtotal = p && qty > 0 ? p.price * qty : 0;
          row.querySelector('.line-sub').textContent = money(subtotal);
          total += subtotal;
        });
        setText('saleTotal', money(total));
      };
      const addLine = () => {
        const row = document.createElement('div');
        row.className = 'sale-line';
        row.innerHTML = '<select class="line-product" aria-label="Product">' + productOptions('', true) + '</select>' +
          '<input class="line-qty" type="number" min="1" step="1" placeholder="Qty" aria-label="Quantity">' +
          '<span class="line-sub">' + money(0) + '</span>' +
          '<button type="button" class="icon-btn remove-line" aria-label="Remove this line">×</button>';
        box.appendChild(row);
      };
      addLine();
      $('addSaleLine').addEventListener('click', addLine);
      box.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-line') && box.children.length > 1) {
          e.target.closest('.sale-line').remove();
          updateTotals();
        }
      });
      box.addEventListener('input', updateTotals);
      box.addEventListener('change', updateTotals);
    },
    onSubmit: (v, form) => {
      const items = [];
      form.querySelectorAll('.sale-line').forEach((row) => {
        const productId = row.querySelector('.line-product').value;
        const qty = row.querySelector('.line-qty').value;
        if (productId || qty !== '') items.push({ productId, qty }); // skip fully empty lines
      });
      const r = Store.recordSale(items, token);
      if (r.error) return r.error;
      showToast('Sale ' + r.sale.id + ' completed: ' + money(r.sale.total) + '.', 'success');
      refreshPage();
      return null;
    }
  });
}

/* ---------- events ---------- */
function setupSalesEvents() {
  $('btnNewSale').addEventListener('click', openSaleModal);
  ['txnSearch', 'txnDate'].forEach((id) => $(id).addEventListener('input', renderTransactions));
  $('txnClear').addEventListener('click', () => {
    ['txnSearch', 'txnDate'].forEach((id) => { $(id).value = ''; });
    renderTransactions();
  });
  $('trendFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    trendMode = btn.dataset.mode;
    $('trendFilter').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    updateSalesCharts();
  });
}

setupSalesEvents();
startApp(renderSalesPage);
