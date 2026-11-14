/* ==========================================================
   inventory.js  -  Module 4: Inventory Management
   Uses Store (storage.js) and the helpers in app.js.
   ========================================================== */
'use strict';

/* ---------- rendering ---------- */
function renderInventoryPage() {
  const prods = Store.db().products;
  const low = prods.filter((p) => Store.getStatus(p) === 'low').length;
  const out = prods.filter((p) => Store.getStatus(p) === 'out').length;

  setText('invTotalProducts', prods.length);
  setText('invTotalUnits', prods.reduce((n, p) => n + p.stock, 0).toLocaleString('en-PH'));
  setText('invLow', low);
  setText('invOut', out);
  $('stockAlerts').innerHTML = stockAlertsHtml();

  fillSelect('invCategory', 'All categories', Store.db().categories.map((c) => ({ value: c, label: c })));
  renderInventoryTable();
  renderInventoryHistory();
  updateInventoryCharts();
}

function renderInventoryTable() {
  const db = Store.db();
  const q = $('invSearch').value.trim().toLowerCase();
  const cat = $('invCategory').value;
  const status = $('invStatus').value;
  const rows = db.products.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (status && Store.getStatus(p) !== status) return false;
    if (q && !(p.id + ' ' + p.name + ' ' + p.category).toLowerCase().includes(q)) return false;
    return true;
  });
  $('invTableBody').innerHTML = rows.length ? rows.map((p) =>
    '<tr><td>' + escapeHtml(p.id) + '</td><td>' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.category) + '</td>' +
    '<td class="num">' + money(p.price) + '</td><td class="num"><strong>' + p.stock + '</strong></td>' +
    '<td class="num">' + p.minStock + '</td><td>' + statusBadge(p) + '</td>' +
    '<td><div class="row-actions">' +
    '<button class="btn small" data-action="sell" data-id="' + escapeHtml(p.id) + '"' + (p.stock <= 0 ? ' disabled title="Out of stock"' : '') + '>Deduct</button>' +
    '<button class="btn small" data-action="stockin" data-id="' + escapeHtml(p.id) + '">Stock-in</button>' +
    '<button class="btn small" data-action="adjust" data-id="' + escapeHtml(p.id) + '">Adjust</button>' +
    '<button class="btn small" data-action="editProduct" data-id="' + escapeHtml(p.id) + '">Edit</button>' +
    '<button class="btn small" data-action="deleteProduct" data-id="' + escapeHtml(p.id) + '">Delete</button>' +
    '</div></td></tr>'
  ).join('') : emptyRow(8, db.products.length ? 'No products match your filters.' : 'No products found. Add your first product to get started.');
}

function renderInventoryHistory() {
  const db = Store.db();
  const q = $('histSearch').value.trim().toLowerCase();
  const type = $('histType').value;
  const from = $('histFrom').value;
  const to = $('histTo').value;
  const rows = db.history.filter((h) => {
    if (type && h.type !== type) return false;
    const k = dateKey(h.date);
    if (from && k < from) return false;
    if (to && k > to) return false;
    if (q && !(h.productName + ' ' + h.reason).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const shown = rows.slice(0, 300);
  setText('histCount', rows.length + ' record(s)' + (rows.length > shown.length ? ', showing the latest 300' : ''));
  $('histBody').innerHTML = shown.length ? shown.map((h) =>
    '<tr><td>' + fmtDateTime(h.date) + '</td><td>' + escapeHtml(h.productName) + '</td>' +
    '<td><span class="badge ' + HISTORY_BADGE[h.type] + '">' + h.type + '</span></td>' +
    '<td class="num ' + (h.change >= 0 ? 'pos' : 'neg') + '">' + (h.change >= 0 ? '+' : '−') + Math.abs(h.change) + '</td>' +
    '<td class="num">' + h.prev + '</td><td class="num">' + h.updated + '</td>' +
    '<td class="wrap">' + escapeHtml(h.reason) + '</td></tr>'
  ).join('') : emptyRow(7, db.history.length ? 'No inventory movements match your filters.' : 'No inventory history yet.');
}

/* ---------- charts ---------- */
function updateInventoryCharts() {
  const prods = Store.db().products;
  drawChart('invBarChart', 'bar', prods.map((p) => p.name), [{
    label: 'Current stock', data: prods.map((p) => p.stock),
    backgroundColor: prods.map((p) => STATUS_COLORS[Store.getStatus(p)])
  }], { plugins: noLegend, scales: { y: intTicks } });
  setChartEmpty('invBarChart', !prods.length, 'No products yet. Add a product to see stock levels.');

  const counts = { ok: 0, low: 0, out: 0 };
  prods.forEach((p) => { counts[Store.getStatus(p)] += 1; });
  drawChart('invDonutChart', 'doughnut', ['Available', 'Low stock', 'Out of stock'], [{
    data: [counts.ok, counts.low, counts.out],
    backgroundColor: [STATUS_COLORS.ok, STATUS_COLORS.low, STATUS_COLORS.out]
  }], { cutout: '62%', plugins: { legend: { position: 'bottom' } } });
  setChartEmpty('invDonutChart', !prods.length, 'No products yet. Stock status will appear here.');
}

/* ---------- forms ---------- */
function openProductModal(editId) {
  const p = editId ? Store.getProduct(editId) : null;
  openModal({
    title: p ? 'Edit product' : 'Add product', submitLabel: p ? 'Save changes' : 'Add product',
    body:
      (p ? '<label class="field"><span>Product ID</span><input type="text" value="' + escapeHtml(p.id) + '" disabled></label>'
         : '<label class="field"><span>Product ID <span class="muted">(leave blank to generate)</span></span><input type="text" name="productId" maxlength="20"></label>') +
      '<label class="field"><span>Product name</span><input type="text" name="name" maxlength="60" value="' + (p ? escapeHtml(p.name) : '') + '"></label>' +
      '<label class="field"><span>Category</span><input type="text" name="category" list="categoryList" maxlength="30" placeholder="Type a category" value="' + (p ? escapeHtml(p.category) : '') + '">' +
      '<datalist id="categoryList">' + Store.db().categories.map((c) => '<option value="' + escapeHtml(c) + '">').join('') + '</datalist></label>' +
      '<div class="row2">' +
      '<label class="field"><span>Selling price (₱)</span><input type="number" name="price" min="0" step="0.01" value="' + (p ? p.price : '') + '"></label>' +
      '<label class="field"><span>Minimum stock level</span><input type="number" name="minStock" min="0" step="1" value="' + (p ? p.minStock : '') + '"></label></div>' +
      (p ? '<p class="hint">Current stock is ' + p.stock + '. To change it, use Stock-in, Deduct, or Adjust so the change is recorded in history.</p>'
         : '<label class="field"><span>Current stock</span><input type="number" name="stock" min="0" step="1"></label>'),
    onSubmit: (v) => {
      const err = Store.saveProduct(v, editId);
      if (err) return err;
      showToast(p ? 'Product updated in all modules.' : 'Product added.', 'success');
      refreshPage();
      return null;
    }
  });
}

function openDeductModal(preId) {
  if (!requireProducts()) return;
  const token = makeToken();
  openModal({
    title: 'Deduct stock', submitLabel: 'Deduct stock',
    body:
      '<label class="field"><span>Type</span><select name="kind">' +
      '<option value="Sale">Sale (creates a sales transaction)</option>' +
      '<option value="Stock-Out">Stock-out (damaged, expired, own use)</option></select></label>' +
      '<label class="field"><span>Product</span><select name="productId">' + productOptions(preId) + '</select></label>' +
      '<p class="hint" id="mHint"></p>' +
      '<label class="field"><span>Quantity</span><input type="number" name="qty" min="1" step="1"></label>' +
      '<label class="field"><span>Reason <span class="muted">(required for stock-out)</span></span><input type="text" name="reason" maxlength="120"></label>',
    onOpen: (form) => bindStockHint(form, 'mHint'),
    onSubmit: (v) => {
      if (v.kind === 'Sale') {
        const r = Store.recordSale([{ productId: v.productId, qty: v.qty }], token);
        if (r.error) return r.error;
        showToast('Sale ' + r.sale.id + ' recorded. Stock updated.', 'success');
      } else {
        const err = Store.stockOut(v.productId, v.qty, v.reason);
        if (err) return err;
        showToast('Stock-out recorded.', 'success');
      }
      refreshPage();
      return null;
    }
  });
}

function openStockInModal(preId) {
  if (!requireProducts()) return;
  openModal({
    title: 'Stock-in', submitLabel: 'Add to stock',
    body:
      '<label class="field"><span>Product</span><select name="productId">' + productOptions(preId) + '</select></label>' +
      '<p class="hint" id="mHint"></p>' +
      '<label class="field"><span>Quantity received</span><input type="number" name="qty" min="1" step="1"></label>' +
      '<label class="field"><span>Note <span class="muted">(optional)</span></span><input type="text" name="reason" maxlength="120" placeholder="Stock received"></label>',
    onOpen: (form) => bindStockHint(form, 'mHint'),
    onSubmit: (v) => {
      const err = Store.stockIn(v.productId, v.qty, (v.reason || '').trim());
      if (err) return err;
      showToast('Stock-in recorded. Stock increased by ' + v.qty + '.', 'success');
      refreshPage();
      return null;
    }
  });
}

function openAdjustModal(preId) {
  if (!requireProducts()) return;
  openModal({
    title: 'Adjust stock', submitLabel: 'Save adjustment',
    body:
      '<label class="field"><span>Product</span><select name="productId">' + productOptions(preId) + '</select></label>' +
      '<p class="hint" id="mHint"></p>' +
      '<label class="field"><span>Counted quantity (actual physical count)</span><input type="number" name="newQty" min="0" step="1"></label>' +
      '<label class="field"><span>Reason</span><input type="text" name="reason" maxlength="120" placeholder="Example: damaged items found during count"></label>',
    onOpen: (form) => bindStockHint(form, 'mHint'),
    onSubmit: (v) => {
      const err = Store.adjustStock(v.productId, v.newQty, v.reason);
      if (err) return err;
      showToast('Stock adjusted to ' + v.newQty + '.', 'success');
      refreshPage();
      return null;
    }
  });
}

/* ---------- events ---------- */
function setupInventoryEvents() {
  $('btnSell').addEventListener('click', () => openDeductModal(''));
  $('btnStockIn').addEventListener('click', () => openStockInModal(''));
  $('btnAdjust').addEventListener('click', () => openAdjustModal(''));
  $('btnAddProduct').addEventListener('click', () => openProductModal(null));

  // One listener handles the buttons inside the table rows
  $('invTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'sell') openDeductModal(id);
    else if (action === 'stockin') openStockInModal(id);
    else if (action === 'adjust') openAdjustModal(id);
    else if (action === 'editProduct') openProductModal(id);
    else if (action === 'deleteProduct') {
      const p = Store.getProduct(id);
      const blocker = Store.getDeleteBlocker(id);
      if (blocker) { showToast('Cannot delete "' + p.name + '" because ' + blocker + '.', 'error'); return; }
      confirmDialog('Delete product "' + p.name + '"? This cannot be undone.',
        () => { Store.deleteProduct(id); refreshPage(); showToast('Product deleted.', 'success'); }, 'Delete product');
    }
  });

  ['invSearch', 'invCategory', 'invStatus'].forEach((id) => $(id).addEventListener('input', renderInventoryTable));
  ['histSearch', 'histType', 'histFrom', 'histTo'].forEach((id) => $(id).addEventListener('input', renderInventoryHistory));
  $('histClear').addEventListener('click', () => {
    ['histSearch', 'histType', 'histFrom', 'histTo'].forEach((id) => { $(id).value = ''; });
    renderInventoryHistory();
  });
}

setupInventoryEvents();
startApp(renderInventoryPage);
