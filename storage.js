/* ==========================================================
   storage.js  -  Shared data for Modules 4, 5 and 6

   Everything is saved in LocalStorage under ONE key, so all
   pages (Dashboard, Inventory, Restocking, Sales) read and
   write the same products, suppliers, history, restocks and
   sales. The system starts completely empty.

   Other files use this through the global object `Store`.
   Helper functions such as todayKey() live in app.js.
   ========================================================== */
const Store = (function () {
  'use strict';

  const KEY = 'wbms_modules_4_5_6_v3';
  let db = loadFromStorage();

  /* ---------- storage ---------- */
  function emptyDB() {
    return {
      products: [], categories: [], suppliers: [],
      history: [], restocks: [], sales: [],
      counters: { product: 0, supplier: 0, restock: 0, sale: 0, move: 0 }
    };
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales) && parsed.counters) return parsed;
      }
    } catch (err) { /* damaged data: start empty */ }
    return emptyDB();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (err) {
      if (typeof showToast === 'function') showToast('Could not save data. Browser storage may be full or blocked.', 'error');
      return false;
    }
  }

  function reload() { db = loadFromStorage(); }
  function clearAll() { db = emptyDB(); save(); }

  // Creates IDs like P001, SUP-001, RST-0001, TXN-0001
  function nextId(kind) {
    db.counters[kind] += 1;
    const n = db.counters[kind];
    if (kind === 'product') return 'P' + String(n).padStart(3, '0');
    if (kind === 'supplier') return 'SUP-' + String(n).padStart(3, '0');
    if (kind === 'restock') return 'RST-' + String(n).padStart(4, '0');
    if (kind === 'sale') return 'TXN-' + String(n).padStart(4, '0');
    return 'MOV-' + String(n).padStart(5, '0');
  }

  /* ---------- products ---------- */
  function getProduct(id) { return db.products.find((p) => p.id === id); }

  // 'out' = 0 units, 'low' = above 0 and at/below minimum, 'ok' = otherwise
  function getStatus(p) {
    if (p.stock <= 0) return 'out';
    if (p.stock <= p.minStock) return 'low';
    return 'ok';
  }

  // The category list is rebuilt from the products, so it only holds categories in use
  function syncCategories() {
    const seen = {};
    const list = [];
    db.products.forEach((p) => {
      const k = p.category.toLowerCase();
      if (!seen[k]) { seen[k] = true; list.push(p.category); }
    });
    db.categories = list.sort((a, b) => a.localeCompare(b));
  }

  // The ONE place where stock changes. It always writes an inventory history record.
  function changeStock(product, delta, type, reason, ref, whenISO) {
    const previous = product.stock;
    const updated = previous + delta;
    if (updated < 0) throw new Error('Stock cannot go below zero.'); // safety net
    product.stock = updated;
    db.history.push({
      id: nextId('move'), date: whenISO || new Date().toISOString(),
      productId: product.id, productName: product.name,
      type: type,            // Stock-In | Stock-Out | Sale | Adjustment
      change: delta, prev: previous, updated: updated,
      reason: reason || '', ref: ref || ''
    });
  }

  // Add or edit a product. Returns an error message, or null on success.
  function saveProduct(values, editId) {
    const name = (values.name || '').trim();
    let category = (values.category || '').trim();
    if (!name) return 'Enter a product name.';
    if (!category) return 'Enter a category.';
    const price = String(values.price || '').trim();
    if (price === '' || isNaN(Number(price)) || Number(price) <= 0) return 'Enter a selling price greater than 0.';
    if (!isNonNegativeInt(values.minStock)) return 'Enter the minimum stock level as a whole number (0 or more).';
    if (db.products.some((p) => p.id !== editId && p.name.toLowerCase() === name.toLowerCase())) {
      return 'A product named "' + name + '" already exists.';
    }
    // Reuse the spelling of a category another product already uses ("food" becomes "Food")
    const sameCategory = db.products.find((p) => p.id !== editId && p.category.toLowerCase() === category.toLowerCase());
    if (sameCategory) category = sameCategory.category;

    if (editId) {
      const p = getProduct(editId);
      p.name = name; p.category = category;
      p.price = round2(Number(price)); p.minStock = Number(values.minStock);
      // Keep all modules consistent: update name/category on existing records
      db.history.forEach((h) => { if (h.productId === p.id) h.productName = p.name; });
      db.restocks.forEach((r) => { if (r.productId === p.id) r.productName = p.name; });
      db.sales.forEach((s) => s.items.forEach((i) => {
        if (i.productId === p.id) { i.name = p.name; i.category = p.category; }
      }));
    } else {
      if (!isNonNegativeInt(values.stock)) return 'Enter the current stock as a whole number (0 or more).';
      let id = (values.productId || '').trim().toUpperCase();
      if (id) {
        if (!/^[A-Z0-9_-]{1,20}$/.test(id)) return 'Product ID can only use letters, numbers, hyphens and underscores (max 20 characters).';
        if (getProduct(id)) return 'Product ID "' + id + '" is already in use.';
      } else {
        do { id = nextId('product'); } while (getProduct(id)); // skip IDs the user typed
      }
      const p = { id, name, category, price: round2(Number(price)), stock: 0, minStock: Number(values.minStock) };
      db.products.push(p);
      if (Number(values.stock) > 0) changeStock(p, Number(values.stock), 'Stock-In', 'Opening stock', 'OPENING');
    }
    syncCategories();
    save();
    return null;
  }

  // Why a product cannot be deleted (or null if it is safe)
  function getDeleteBlocker(id) {
    if (db.sales.some((s) => s.items.some((i) => i.productId === id))) return 'it appears in sales transactions';
    if (db.restocks.some((r) => r.productId === id)) return 'it has restocking records';
    if (db.history.some((h) => h.productId === id && h.ref !== 'OPENING')) return 'it has stock movement history';
    return null;
  }

  function deleteProduct(id) {
    if (getDeleteBlocker(id)) return;
    db.products = db.products.filter((p) => p.id !== id);
    db.history = db.history.filter((h) => h.productId !== id); // only its opening-stock entry can remain
    syncCategories();
    save();
  }

  /* ---------- manual stock movements (Module 4) ---------- */
  function stockIn(productId, qty, reason) {
    const p = getProduct(productId);
    if (!p) return 'Please select a product.';
    if (!isPositiveInt(qty)) return 'Enter a whole-number quantity above 0.';
    changeStock(p, Number(qty), 'Stock-In', reason || 'Stock received');
    save();
    return null;
  }

  function stockOut(productId, qty, reason) {
    const p = getProduct(productId);
    if (!p) return 'Please select a product.';
    if (!isPositiveInt(qty)) return 'Enter a whole-number quantity above 0.';
    if (!reason || !reason.trim()) return 'Enter a reason for the stock-out.';
    if (p.stock <= 0) return p.name + ' is out of stock.';
    if (Number(qty) > p.stock) return 'Only ' + p.stock + ' unit(s) of ' + p.name + ' available.';
    changeStock(p, -Number(qty), 'Stock-Out', reason.trim());
    save();
    return null;
  }

  function adjustStock(productId, newQty, reason) {
    const p = getProduct(productId);
    if (!p) return 'Please select a product.';
    if (!isNonNegativeInt(newQty)) return 'Enter the counted quantity as a whole number (0 or more).';
    if (!reason || !reason.trim()) return 'Enter a reason for the adjustment.';
    const target = Number(newQty);
    if (target === p.stock) return 'The counted quantity matches the recorded stock. No adjustment needed.';
    changeStock(p, target - p.stock, 'Adjustment', reason.trim());
    save();
    return null;
  }

  /* ---------- suppliers and restocking (Module 5) ---------- */
  function saveSupplier(values, editId) {
    const s = {
      name: (values.name || '').trim(), phone: (values.phone || '').trim(),
      email: (values.email || '').trim(), address: (values.address || '').trim()
    };
    if (!s.name) return 'Enter the supplier name.';
    if (!/^[0-9+()\-\s]{7,20}$/.test(s.phone)) return 'Enter a valid contact number (7 to 20 characters: digits, + - ( ) and spaces).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return 'Enter a valid email address.';
    if (!s.address) return 'Enter the supplier address.';
    if (db.suppliers.some((x) => x.id !== editId && x.name.toLowerCase() === s.name.toLowerCase())) {
      return 'A supplier named "' + s.name + '" already exists.';
    }
    if (editId) {
      const existing = db.suppliers.find((x) => x.id === editId);
      Object.assign(existing, s);
      db.restocks.forEach((r) => { if (r.supplierId === editId) r.supplierName = s.name; });
    } else {
      db.suppliers.push(Object.assign({ id: nextId('supplier') }, s));
    }
    save();
    return null;
  }

  function deleteSupplier(id) {
    db.suppliers = db.suppliers.filter((s) => s.id !== id); // old restock records keep the supplier name
    save();
  }

  // Records a restock AND increases stock in one step. Returns { error } or { restock }.
  // data = { supplierId, productId, qty, unitCost (optional), dateStr, token }
  function recordRestock(data) {
    if (data.token && db.restocks.some((r) => r.token === data.token)) {
      return { error: 'This restock was already recorded.' };          // duplicate protection
    }
    const supplier = db.suppliers.find((s) => s.id === data.supplierId);
    const product = getProduct(data.productId);
    if (!supplier) return { error: 'Please select a supplier.' };
    if (!product) return { error: 'Please select a product.' };
    if (!isPositiveInt(data.qty)) return { error: 'Enter a whole-number quantity above 0.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateStr || '')) return { error: 'Choose the restock date.' };
    if (data.dateStr > todayKey()) return { error: 'The restock date cannot be in the future.' };
    let unitCost = null;
    if (String(data.unitCost || '').trim() !== '') {
      if (isNaN(Number(data.unitCost)) || Number(data.unitCost) < 0) return { error: 'Unit cost must be a number (0 or more), or left blank.' };
      unitCost = round2(Number(data.unitCost));
    }

    const id = nextId('restock');
    const when = whenFromDateKey(data.dateStr);
    const qty = Number(data.qty);
    changeStock(product, qty, 'Stock-In', 'Restock ' + id + ' from ' + supplier.name, id, when);
    const restock = {
      id, token: data.token || id,
      supplierId: supplier.id, supplierName: supplier.name,
      productId: product.id, productName: product.name,
      qty, unitCost, totalCost: unitCost === null ? null : round2(unitCost * qty),
      date: data.dateStr, createdAt: when, status: 'Completed'
    };
    db.restocks.push(restock);
    save();
    return { restock };
  }

  /* ---------- sales (Module 6) ---------- */
  // items = [{ productId, qty }]. Everything is checked BEFORE any stock changes.
  function recordSale(items, token) {
    if (token && db.sales.some((s) => s.token === token)) return { error: 'This sale was already recorded.' };
    if (!items.length) return { error: 'Add at least one product to the sale.' };

    const totals = {};   // combine lines that use the same product
    for (const item of items) {
      const p = getProduct(item.productId);
      if (!p) return { error: 'Select an existing product for every line.' };
      if (!isPositiveInt(item.qty)) return { error: 'Enter a whole-number quantity above 0 for ' + p.name + '.' };
      totals[p.id] = (totals[p.id] || 0) + Number(item.qty);
    }
    for (const id of Object.keys(totals)) {
      const p = getProduct(id);
      if (p.stock <= 0) return { error: p.name + ' is out of stock and cannot be sold.' };
      if (totals[id] > p.stock) return { error: 'Only ' + p.stock + ' unit(s) of ' + p.name + ' available. You entered ' + totals[id] + '.' };
    }

    const saleId = nextId('sale');
    const when = new Date().toISOString();
    let total = 0;
    const lines = Object.keys(totals).map((id) => {
      const p = getProduct(id);
      const subtotal = round2(totals[id] * p.price);
      changeStock(p, -totals[id], 'Sale', 'Sold in ' + saleId, saleId, when);
      total += subtotal;
      return { productId: id, name: p.name, category: p.category, qty: totals[id], price: p.price, subtotal };
    });
    const sale = { id: saleId, token: token || saleId, date: when, items: lines, total: round2(total), status: 'Completed' };
    db.sales.push(sale);
    save();
    return { sale };
  }

  function getTodayStats() {
    const key = todayKey();
    const todays = db.sales.filter((s) => dateKey(s.date) === key);
    return {
      total: todays.reduce((sum, s) => sum + s.total, 0),
      count: todays.length,
      items: todays.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0)
    };
  }

  return {
    KEY, db: () => db, reload, clearAll,
    getProduct, getStatus, saveProduct, getDeleteBlocker, deleteProduct,
    stockIn, stockOut, adjustStock,
    saveSupplier, deleteSupplier, recordRestock,
    recordSale, getTodayStats
  };
})();
