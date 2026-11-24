/* product-search.js — Product Search: find a specific product, filter by category, price and store */
(function () {
    const { $, esc } = UI;
    const q = $('#q');
    let category = 'All';
    let cap = null;                                     // null = any price

    const storeName = (p) => (DB.storeOf(p) || {}).name || '';
    const haystack = (p) => `${p.name} ${p.description} ${p.category} ${storeName(p)}`;

    function score(p, query) {
        const name = p.name.toLowerCase();
        return UI.tokens(query).reduce((t, tok) => t + (name.startsWith(tok) ? 4 : name.includes(tok) ? 3 : 1), 0);
    }

    function render() {
        const all = DB.products(), query = q.value;
        $('#clear').hidden = !query;

        if (!all.length) {
            $('#count').textContent = '';
            $('#catChips').innerHTML = '';
            $('#results').innerHTML = DB.stores().length
                ? UI.emptyBox('No products yet', 'Products appear here as soon as a store adds them.', 'fa-bowl-food')
                : UI.NO_STORES;
            return;
        }

        /* category chips with counts */
        const cats = ['All', ...new Set(all.map((p) => p.category))];
        if (!cats.includes(category)) category = 'All';
        $('#catChips').innerHTML = cats.map((c) => {
            const n = c === 'All' ? all.length : all.filter((p) => p.category === c).length;
            return `<button class="chip${c === category ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)} · ${n}</button>`;
        }).join('');

        /* price slider reaches the most expensive product */
        const top = Math.max(10, Math.ceil(Math.max(...all.map((p) => p.price)) / 5) * 5);
        const slider = $('#maxPrice');
        slider.max = top;
        slider.value = cap === null || cap > top ? top : cap;
        $('#priceLabel').textContent = cap === null || cap >= top ? 'Price: any' : `Price: up to ${UI.peso(cap)}`;

        /* store select */
        const withProducts = DB.stores().filter((s) => all.some((p) => p.storeId === s.id));
        const chosen = $('#store').value || 'all';
        $('#store').innerHTML = `<option value="all">All stores</option>` +
            withProducts.map((s) => `<option value="${esc(s.id)}"${s.id === chosen ? ' selected' : ''}>${esc(s.name)}</option>`).join('');

        let list = all.filter((p) => UI.matches(haystack(p), query));
        if (category !== 'All') list = list.filter((p) => p.category === category);
        if (cap !== null && cap < top) list = list.filter((p) => p.price <= cap);
        if ($('#store').value !== 'all') list = list.filter((p) => p.storeId === $('#store').value);
        if ($('#availOnly').checked) list = list.filter((p) => p.available);

        const sort = $('#sort').value;
        if (sort === 'low') list.sort((a, b) => a.price - b.price);
        else if (sort === 'high') list.sort((a, b) => b.price - a.price);
        else if (sort === 'rating') list.sort((a, b) => DB.summary(b.id).avg - DB.summary(a.id).avg);
        else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else list.sort((a, b) => score(b, query) - score(a, query) || a.name.localeCompare(b.name));

        $('#count').textContent = `${list.length} product${list.length === 1 ? '' : 's'}${query.trim() ? ` for “${query.trim()}”` : ''}`;
        $('#results').innerHTML = list.length
            ? list.map((p) => UI.productCard(p, query)).join('')
            : `<div style="grid-column:1/-1">${UI.emptyBox('No products found', 'Try another word, a higher price, or clear the filters.', 'fa-magnifying-glass')}</div>`;
    }

    /* ----- recent searches ----- */
    function drawRecent() {
        const list = DB.recent('product');
        $('#recent').hidden = !list.length;
        $('#recentChips').innerHTML = list.map((t) => `<button class="chip" data-recent="${esc(t)}">${esc(t)}</button>`).join('');
    }
    $('#recentChips').addEventListener('click', (e) => { const b = e.target.closest('[data-recent]'); if (b) { q.value = b.dataset.recent; render(); } });
    $('#clearRecent').addEventListener('click', () => { DB.clearRecent('product'); drawRecent(); });

    q.addEventListener('input', UI.debounce(render, 120));
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { DB.addRecent('product', q.value); drawRecent(); } });
    $('#results').addEventListener('click', (e) => { if (e.target.closest('a') && q.value.trim()) DB.addRecent('product', q.value); });
    $('#clear').addEventListener('click', () => { q.value = ''; render(); q.focus(); });

    $('#catChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { category = b.dataset.cat; render(); } });
    $('#maxPrice').addEventListener('input', (e) => { cap = Number(e.target.value); render(); });
    ['#store', '#availOnly', '#sort'].forEach((sel) => $(sel).addEventListener('change', render));

    DB.onChange(render);
    q.value = UI.param('q') || '';
    if (UI.param('cat')) category = UI.param('cat');
    drawRecent();
    render();
})();
