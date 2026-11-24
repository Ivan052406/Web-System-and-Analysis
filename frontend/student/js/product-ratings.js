/* product-ratings.js — Product Ratings: tap stars on any product you have tried, add details if you like */
(function () {
    const { $, esc } = UI;
    const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
    const TAGS = ['Tasty', 'Fresh', 'Worth the price', 'Generous serving', 'Too salty', 'Too small', 'Not fresh'];
    const dialog = $('#detailDialog');
    let category = 'All';
    let openId = null, draft = { n: 0, tags: [] };

    const stars = (id, n) => [1, 2, 3, 4, 5].map((i) =>
        `<button class="star${i <= n ? ' on' : ''}" data-rate="${i}" data-id="${esc(id)}" aria-label="Rate ${i} star${i > 1 ? 's' : ''}">★</button>`).join('');

    function mineStats(all) {
        const mine = all.map((p) => DB.myRating(p.id)).filter(Boolean);
        const avg = mine.length ? (mine.reduce((t, r) => t + r.n, 0) / mine.length).toFixed(1) : '–';
        $('#mine').innerHTML = `
            <div><strong>${mine.length}/${all.length}</strong><span>Products I rated</span></div>
            <div><strong>${avg}</strong><span>Average I give</span></div>
            <div><strong>${all.length - mine.length}</strong><span>Still to rate</span></div>`;
    }

    function card(p) {
        const mine = DB.myRating(p.id), sum = DB.summary(p.id);
        return `<article class="card">
            <div class="card-top"><h3><a href="${UI.productUrl(p.id)}">${esc(p.name)}</a></h3><span class="price">${UI.peso(p.price)}</span></div>
            <p class="muted small">${esc((DB.storeOf(p) || {}).name || '')} · <span class="badge tag">${esc(p.category)}</span></p>
            <div class="card-meta">${UI.ratingLine(p.id)}</div>
            <div class="mine-box">
                <span class="field-label">${mine ? `Your rating: ${LABELS[mine.n - 1]}` : 'Tap to rate'}</span>
                <div class="star-row">${stars(p.id, mine ? mine.n : 0)}</div>
            </div>
            <div class="card-actions">
                <button class="btn sm ghost" data-detail="${esc(p.id)}">${mine ? 'Edit details' : 'Add details'}</button>
                ${mine ? `<button class="btn sm danger" data-clear="${esc(p.id)}">Clear</button>` : ''}
            </div>
        </article>`;
    }

    function render() {
        const all = DB.products(), query = $('#q').value;
        if (!all.length) {
            $('#mine').innerHTML = ''; $('#catChips').innerHTML = '';
            $('#results').innerHTML = DB.stores().length ? UI.emptyBox('No products to rate yet', 'Products appear here as soon as a store adds them.', 'fa-bowl-food') : UI.NO_STORES;
            return;
        }
        mineStats(all);

        const cats = ['All', ...new Set(all.map((p) => p.category))];
        if (!cats.includes(category)) category = 'All';
        $('#catChips').innerHTML = cats.map((c) => `<button class="chip${c === category ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');

        let list = all.filter((p) => UI.matches(`${p.name} ${p.category} ${(DB.storeOf(p) || {}).name}`, query));
        if (category !== 'All') list = list.filter((p) => p.category === category);
        if ($('#unrated').checked) list = list.filter((p) => !DB.myRating(p.id));

        const sort = $('#sort').value;
        if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'store') list.sort((a, b) => (DB.storeOf(a).name).localeCompare(DB.storeOf(b).name) || a.name.localeCompare(b.name));
        else list.sort((a, b) => DB.summary(b.id).avg - DB.summary(a.id).avg || a.name.localeCompare(b.name));

        $('#results').innerHTML = list.length ? list.map(card).join('')
            : `<div style="grid-column:1/-1">${UI.emptyBox('Nothing to show', 'Try another search or filter.', 'fa-magnifying-glass')}</div>`;
    }

    /* ----- details pop-up ----- */
    function drawDialog() {
        const p = DB.product(openId);
        if (!p) return;
        const sum = DB.summary(p.id), mine = DB.myRating(p.id);
        dialog.innerHTML = `
            <h2>${esc(p.name)}</h2>
            <p class="muted small">${esc((DB.storeOf(p) || {}).name || '')} · ${UI.peso(p.price)}</p>
            <div class="dist top-gap">${[5, 4, 3, 2, 1].map((n) => `<div class="dist-row"><span>${n}★</span><div class="dist-bar"><span style="width:${sum.count ? (sum.dist[n - 1] / sum.count) * 100 : 0}%"></span></div><span>${sum.dist[n - 1]}</span></div>`).join('')}</div>
            <span class="field-label top-gap">Your rating</span>
            <div class="star-row big" id="dlgStars">${stars(p.id, draft.n)}</div>
            <span class="field-label top-gap">What was it like? (optional)</span>
            <div class="tag-pick">${TAGS.map((t) => `<button class="chip${draft.tags.includes(t) ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <div class="dialog-actions">
                <button class="btn ghost" data-close>Close</button>
                <button class="btn" data-save ${draft.n ? '' : 'disabled'}>${mine ? 'Update' : 'Save rating'}</button>
            </div>`;
    }

    function openDetail(id) {
        openId = id;
        const mine = DB.myRating(id);
        draft = mine ? { n: mine.n, tags: [...(mine.tags || [])] } : { n: 0, tags: [] };
        drawDialog();
        if (!dialog.open) dialog.showModal();
    }

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog || e.target.closest('[data-close]')) return dialog.close();
        const star = e.target.closest('[data-rate]'), tag = e.target.closest('[data-tag]');
        if (star) { draft.n = Number(star.dataset.rate); drawDialog(); }
        else if (tag) { const t = tag.dataset.tag; draft.tags = draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t]; drawDialog(); }
        else if (e.target.closest('[data-save]')) {
            DB.rate(openId, draft.n, draft.tags);
            UI.toast(`Saved: ${DB.product(openId).name} ${draft.n}★.`);
            dialog.close();
            render();
        }
    });

    /* ----- page events ----- */
    $('#results').addEventListener('click', (e) => {
        const star = e.target.closest('[data-rate]');
        if (star) {
            const id = star.dataset.id, n = Number(star.dataset.rate), old = DB.myRating(id);
            DB.rate(id, n, old ? old.tags : []);
            UI.toast(`Rated ${DB.product(id).name} ${n}★ — ${LABELS[n - 1]}.`);
            return render();
        }
        const d = e.target.closest('[data-detail]'), c = e.target.closest('[data-clear]');
        if (d) openDetail(d.dataset.detail);
        if (c) { DB.clearRating(c.dataset.clear); UI.toast('Your rating was removed.'); render(); }
    });
    $('#catChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { category = b.dataset.cat; render(); } });
    $('#q').addEventListener('input', UI.debounce(render, 120));
    ['#unrated', '#sort'].forEach((s) => $(s).addEventListener('change', render));

    DB.onChange(render);
    render();
    if (UI.param('id') && DB.product(UI.param('id'))) openDetail(UI.param('id'));
})();
