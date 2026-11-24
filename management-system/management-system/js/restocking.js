/* ==========================================================
   restocking.js  -  Module 5: Restocking Management
   Uses Store (storage.js) and the helpers in app.js.
   ========================================================== */
'use strict';

/* ---------- rendering ---------- */
function renderRestockingPage() {
  const db = Store.db();
  const costs = db.restocks.filter((r) => r.totalCost !== null);
  setText('rsSupplierCount', db.suppliers.length);
  setText('rsTxnCount', db.restocks.length);
  setText('rsUnits', db.restocks.reduce((n, r) => n + r.qty, 0).toLocaleString('en-PH'));
  setText('rsCost', money(costs.reduce((n, r) => n + r.totalCost, 0)));

  fillSelect('rsSupplier', 'All suppliers', db.suppliers.map((s) => ({ value: s.name, label: s.name })));
  const names = Array.from(new Set(db.products.map((p) => p.name))).sort();
  fillSelect('rsProduct', 'All products', names.map((n) => ({ value: n, label: n })));

  renderSuppliers();
  renderRestockTable();
  updateRestockCharts();
}

function renderSuppliers() {
  const suppliers = Store.db().suppliers;
  $('supplierBody').innerHTML = suppliers.length ? suppliers.map((s) =>
    '<tr><td>' + escapeHtml(s.id) + '</td><td>' + escapeHtml(s.name) + '</td>' +
    '<td>' + escapeHtml(s.phone) + '</td><td>' + escapeHtml(s.email) + '</td>' +
    '<td class="wrap">' + escapeHtml(s.address) + '</td>' +
    '<td><div class="row-actions">' +
    '<button class="btn small" data-action="editSupplier" data-id="' + escapeHtml(s.id) + '">Edit</button>' +
    '<button class="btn small" data-action="deleteSupplier" data-id="' + escapeHtml(s.id) + '">Delete</button>' +
    '</div></td></tr>'
  ).join('') : emptyRow(6, 'No suppliers yet. Use "Add supplier" to create one.');
}

function renderRestockTable() {
  const db = Store.db();
  const q = $('rsSearch').value.trim().toLowerCase();
  const supplier = $('rsSupplier').value;
  const product = $('rsProduct').value;
  const from = $('rsFrom').value;
  const to = $('rsTo').value;
  const rows = db.restocks.filter((r) => {
    if (supplier && r.supplierName !== supplier) return false;
    if (product && r.productName !== product) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (q && !(r.id + ' ' + r.supplierName + ' ' + r.productName).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const units = rows.reduce((n, r) => n + r.qty, 0);
  setText('rsCount', rows.length + ' record(s), ' + units + ' unit(s) received');
  $('rsBody').innerHTML = rows.length ? rows.map((r) =>
    '<tr><td>' + escapeHtml(r.id) + '</td><td>' + escapeHtml(r.productName) + '</td><td>' + escapeHtml(r.supplierName) + '</td>' +
    '<td class="num"><strong>' + r.qty + '</strong></td>' +
    '<td class="num">' + (r.unitCost === null ? '-' : money(r.unitCost)) + '</td>' +
    '<td class="num">' + (r.totalCost === null ? '-' : money(r.totalCost)) + '</td>' +
    '<td>' + fmtDate(r.date) + '</td><td><span class="badge ok">' + r.status + '</span></td></tr>'
  ).join('') : emptyRow(8, db.restocks.length ? 'No restock records match your filters.' : 'No restocking history yet.');
}

/* ---------- charts (use the saved restock records) ---------- */
function updateRestockCharts() {
  const restocks = Store.db().restocks;
  const perProduct = {};
  restocks.forEach((r) => { perProduct[r.productName] = (perProduct[r.productName] || 0) + r.qty; });
  const ranked = Object.keys(perProduct).sort((a, b) => perProduct[b] - perProduct[a]);
  drawChart('rsBarChart', 'bar', ranked, [{
    label: 'Units restocked', data: ranked.map((n) => perProduct[n]), backgroundColor: PALETTE[2]
  }], { plugins: noLegend, scales: { y: intTicks } });
  setChartEmpty('rsBarChart', !restocks.length, 'No restocking records yet.');

  const perDay = {};
  restocks.forEach((r) => { perDay[r.date] = (perDay[r.date] || 0) + r.qty; });
  const days = Object.keys(perDay).sort();
  drawChart('rsLineChart', 'line', days.map(fmtDate), [{
    label: 'Units received', data: days.map((d) => perDay[d]),
    borderColor: PALETTE[0], backgroundColor: 'rgba(18,53,46,.12)', fill: true, tension: 0.3, pointRadius: 4
  }], { plugins: noLegend, scales: { y: intTicks } });
  setChartEmpty('rsLineChart', !restocks.length, 'No restocking activity yet.');
}

/* ---------- forms ---------- */
function openSupplierModal(editId) {
  const s = editId ? Store.db().suppliers.find((x) => x.id === editId) : null;
  const val = (key) => (s ? escapeHtml(s[key]) : '');
  openModal({
    title: s ? 'Edit supplier' : 'Add supplier', submitLabel: s ? 'Save changes' : 'Add supplier',
    body:
      '<label class="field"><span>Supplier name</span><input type="text" name="name" maxlength="80" value="' + val('name') + '"></label>' +
      '<div class="row2">' +
      '<label class="field"><span>Contact number</span><input type="tel" name="phone" maxlength="20" value="' + val('phone') + '"></label>' +
      '<label class="field"><span>Email</span><input type="email" name="email" maxlength="80" value="' + val('email') + '"></label></div>' +
      '<label class="field"><span>Address</span><textarea name="address" rows="2" maxlength="160">' + val('address') + '</textarea></label>',
    onSubmit: (v) => {
      const err = Store.saveSupplier(v, editId);
      if (err) return err;
      showToast(s ? 'Supplier updated.' : 'Supplier added.', 'success');
      refreshPage();
      return null;
    }
  });
}

function openRestockModal() {
  if (!requireProducts()) return;
  const suppliers = Store.db().suppliers;
  if (!suppliers.length) { showToast('Add a supplier first.', 'error'); return; }
  const token = makeToken();
  openModal({
    title: 'Record restock', submitLabel: 'Record restock',
    body:
      '<label class="field"><span>Supplier</span><select name="supplierId"><option value="">Select a supplier</option>' +
      suppliers.map((s) => '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Product</span><select name="productId">' + productOptions('') + '</select></label>' +
      '<p class="hint" id="mHint"></p>' +
      '<div class="row2">' +
      '<label class="field"><span>Quantity received</span><input type="number" name="qty" min="1" step="1"></label>' +
      '<label class="field"><span>Unit cost (₱) <span class="muted">(optional)</span></span><input type="number" name="unitCost" min="0" step="0.01"></label></div>' +
      '<label class="field"><span>Restock date</span><input type="date" name="dateStr" max="' + todayKey() + '" value="' + todayKey() + '"></label>',
    onOpen: (form) => bindStockHint(form, 'mHint'),
    onSubmit: (v) => {
      const r = Store.recordRestock({
        supplierId: v.supplierId, productId: v.productId, qty: v.qty,
        unitCost: v.unitCost, dateStr: v.dateStr, token: token
      });
      if (r.error) return r.error;
      showToast(r.restock.id + ' recorded. ' + r.restock.productName + ' stock increased by ' + r.restock.qty + '.', 'success');
      refreshPage();
      return null;
    }
  });
}

/* ---------- events ---------- */
function setupRestockingEvents() {
  $('btnAddSupplier').addEventListener('click', () => openSupplierModal(null));
  $('btnRestock').addEventListener('click', openRestockModal);

  $('supplierBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'editSupplier') openSupplierModal(id);
    else if (btn.dataset.action === 'deleteSupplier') {
      const s = Store.db().suppliers.find((x) => x.id === id);
      confirmDialog('Delete supplier "' + s.name + '"? Past restock records will keep the supplier name.',
        () => { Store.deleteSupplier(id); refreshPage(); showToast('Supplier deleted.', 'success'); }, 'Delete supplier');
    }
  });

  ['rsSearch', 'rsSupplier', 'rsProduct', 'rsFrom', 'rsTo'].forEach((id) => $(id).addEventListener('input', renderRestockTable));
  $('rsClear').addEventListener('click', () => {
    ['rsSearch', 'rsSupplier', 'rsProduct', 'rsFrom', 'rsTo'].forEach((id) => { $(id).value = ''; });
    renderRestockTable();
  });
}

setupRestockingEvents();
startApp(renderRestockingPage);
