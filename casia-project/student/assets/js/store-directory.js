/* store-directory.js — Store Directory: every store, grouped A–Z, with area filter, sort and two views */
(function () {
    const { $, esc } = UI;
    let area = 'All', view = 'cards';

    const productCount = (s) => DB.productsOf(s.id).length;
    const openRank = (s) => { const o = DB.isOpen(s); return o === true ? 0 : o === null ? 1 : 2; };   // open, hours not listed, closed

    const SORTERS = {
        name: (a, b) => a.name.localeCompare(b.name),
        rating: (a, b) => DB.summary(b.id).avg - DB.summary(a.id).avg || a.name.localeCompare(b.name),
        open: (a, b) => openRank(a) - openRank(b) || a.name.localeCompare(b.name),
        products: (a, b) => productCount(b) - productCount(a) || a.name.localeCompare(b.name)
    };

    function row(s) {
        return `<div class="row">
            <div class="row-main"><a href="${UI.storeUrl(s.id)}">${esc(s.name)}</a><span class="muted small">${esc(s.location || s.area)}</span></div>
            <span class="row-hours muted small">${DB.hoursText(s)}</span>
            ${UI.openBadge(s)}
            ${UI.ratingLine(s.id)}
            <span class="muted small row-count">${productCount(s)} products</span>
            ${UI.heart(s.id)}
            <a class="btn sm" href="${UI.storeUrl(s.id)}">View</a>
        </div>`;
    }

    function render() {
        const all = DB.stores();
        const sort = $('#sort').value;

        // area chips with counts
        const areas = ['All', ...new Set(all.map((s) => s.area))];
        if (!areas.includes(area)) area = 'All';
        $('#areaChips').innerHTML = areas.map((a) => {
            const n = a === 'All' ? all.length : all.filter((s) => s.area === a).length;
            return `<button class="chip${a === area ? ' active' : ''}" data-area="${esc(a)}">${esc(a)} · ${n}</button>`;
        }).join('');

        const list = all.filter((s) => area === 'All' || s.area === area).sort(SORTERS[sort]);
        const dir = $('#directory'), letters = $('#letters');

        if (!all.length) { letters.hidden = true; dir.innerHTML = UI.NO_STORES; return; }

        // A–Z sort groups stores under their first letter
        const grouped = sort === 'name';
        const groups = grouped
            ? list.reduce((m, s) => { const l = s.name[0].toUpperCase(); (m[l] = m[l] || []).push(s); return m; }, {})
            : { '': list };

        letters.hidden = !grouped;
        if (grouped) {
            const have = Object.keys(groups);
            letters.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) =>
                have.includes(l) ? `<a href="#letter-${l}">${l}</a>` : `<span>${l}</span>`).join('');
        }

        dir.innerHTML = Object.entries(groups).map(([letter, stores]) => `
            ${letter ? `<h2 class="letter" id="letter-${letter}">${letter}</h2>` : ''}
            ${view === 'cards' ? `<div class="grid">${stores.map((s) => UI.storeCard(s)).join('')}</div>` : `<div class="rows">${stores.map(row).join('')}</div>`}`).join('');
    }

    $('#areaChips').addEventListener('click', (e) => { const b = e.target.closest('[data-area]'); if (b) { area = b.dataset.area; render(); } });
    $('#sort').addEventListener('change', render);
    [['viewCards', 'cards'], ['viewList', 'list']].forEach(([id, v]) => $('#' + id).addEventListener('click', () => {
        view = v;
        $('#viewCards').classList.toggle('active', v === 'cards');
        $('#viewList').classList.toggle('active', v === 'list');
        render();
    }));

    DB.onChange(render);
    render();
})();
