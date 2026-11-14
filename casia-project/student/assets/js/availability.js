/* availability.js — Availability Check: is it in stock right now? Updates live when a store changes its list */
(function () {
    const { $, esc } = UI;
    let filter = 'all';
    let checkedAt = new Date();
    let timer = null;

    /* ----- notice products the student is watching that came back ----- */
    function backInStock() {
        const was = DB.seen();
        const back = DB.watchList().map(DB.product).filter((p) => p && p.available);
        const justNow = back.filter((p) => was[p.id] === false);
        if (justNow.length) UI.toast(`${justNow.map((p) => p.name).join(', ')} ${justNow.length > 1 ? 'are' : 'is'} back in stock!`);
        DB.saveSeen(Object.fromEntries(DB.products().map((p) => [p.id, p.available])));
        return back;
    }

    function readyText(p, s) {
        if (!p.available) return '<span class="muted">—</span>';
        const open = DB.isOpen(s);
        if (open === false) return `<span class="badge warn">Store closed · opens ${DB.hoursText(s).split(' – ')[0]}</span>`;
        return '<span class="badge ok">✓ Good to go</span>';
    }

    function render() {
        const products = DB.products(), stores = DB.stores();

        if (!products.length) {
            $('#alerts').innerHTML = '';
            $('#statusBar').innerHTML = '';
            $('#table').innerHTML = stores.length ? UI.emptyBox('No products yet', 'Products appear here as soon as a store adds them.', 'fa-bowl-food') : UI.NO_STORES;
            return;
        }

        const back = backInStock();
        $('#alerts').innerHTML = back.length
            ? `<div class="alert"><i class="fa-solid fa-bell"></i><div><strong>Back in stock!</strong> ${back.map((p) => esc(p.name)).join(', ')} ${back.length > 1 ? 'are' : 'is'} available again.</div><button class="btn sm" id="gotIt">Got it</button></div>`
            : '';

        const avail = products.filter((p) => p.available).length;
        $('#statusBar').innerHTML = `
            <div class="status-main"><strong>${avail} of ${products.length}</strong> products available right now</div>
            <div class="status-bar-track"><span style="width:${(avail / products.length) * 100}%"></span></div>
            <small class="muted">Last checked ${UI.clock(checkedAt)} · updates by itself when a store changes its list</small>`;

        const chosen = $('#store').value || 'all';
        $('#store').innerHTML = `<option value="all">All stores</option>` +
            stores.map((s) => `<option value="${esc(s.id)}"${s.id === chosen ? ' selected' : ''}>${esc(s.name)}</option>`).join('');

        let list = products.filter((p) => UI.matches(`${p.name} ${p.category}`, $('#q').value));
        if ($('#store').value !== 'all') list = list.filter((p) => p.storeId === $('#store').value);
        if (filter === 'in') list = list.filter((p) => p.available);
        if (filter === 'out') list = list.filter((p) => !p.available);
        list.sort((a, b) => b.available - a.available || a.name.localeCompare(b.name));

        document.querySelectorAll('#filter .chip').forEach((c) => c.classList.toggle('active', c.dataset.f === filter));

        $('#table').innerHTML = list.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Product</th><th>Store</th><th>Price</th><th>Status</th><th>Can I go now?</th><th></th></tr></thead>
            <tbody>${list.map((p) => {
                const s = DB.storeOf(p);
                const watching = DB.isWatching(p.id);
                return `<tr>
                    <td><a href="${UI.productUrl(p.id)}"><b>${esc(p.name)}</b></a><br><span class="muted small">${esc(p.category)}</span></td>
                    <td><a href="${UI.storeUrl(s.id)}">${esc(s.name)}</a><br>${UI.openBadge(s)}</td>
                    <td>${UI.peso(p.price)}</td>
                    <td>${UI.stockBadge(p)}${p.available && p.stock !== null && p.stock <= 5 ? `<br><span class="small warn-text">Only ${p.stock} left</span>` : ''}</td>
                    <td>${readyText(p, s)}</td>
                    <td class="actions">${!p.available || watching ? `<button class="btn sm ${watching ? '' : 'ghost'}" data-watch="${esc(p.id)}"><i class="fa-${watching ? 'solid' : 'regular'} fa-bell"></i> ${watching ? 'Watching' : 'Notify me'}</button>` : ''}</td>
                </tr>`;
            }).join('')}</tbody></table></div>`
            : UI.emptyBox('No products match', 'Try another store, filter or search.', 'fa-magnifying-glass');
    }

    /* ----- events ----- */
    document.addEventListener('click', (e) => {
        const w = e.target.closest('[data-watch]');
        if (w) {
            const p = DB.product(w.dataset.watch);
            const on = DB.toggleWatch(p.id);
            UI.toast(on ? `We'll tell you when ${p.name} is back.` : `Stopped watching ${p.name}.`);
            return render();
        }
        if (e.target.closest('#gotIt')) {
            DB.watchList().map(DB.product).filter((p) => p && p.available).forEach((p) => DB.toggleWatch(p.id));
            render();
        }
    });
    $('#filter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
    $('#store').addEventListener('change', render);
    $('#q').addEventListener('input', UI.debounce(render, 120));
    $('#refresh').addEventListener('click', () => { checkedAt = new Date(); render(); UI.toast('Availability refreshed.'); });

    function schedule() {
        clearInterval(timer);
        if ($('#auto').checked) timer = setInterval(() => { checkedAt = new Date(); render(); }, 30000);
    }
    $('#auto').addEventListener('change', schedule);

    DB.onChange(() => { checkedAt = new Date(); render(); });   // a store changed something
    render();
    schedule();
})();
