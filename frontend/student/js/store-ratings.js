/* store-ratings.js — Store Ratings: rate the overall experience at a store (1–5 stars + quick tags) */
(function () {
    const { $, esc } = UI;
    const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
    const TAGS = ['Clean', 'Fast service', 'Friendly staff', 'Good value', 'Fresh food', 'Long wait', 'Crowded'];

    let selected = UI.param('id');
    let draft = { n: 0, tags: [] };

    function choose(id) {
        selected = id;
        const mine = DB.myRating(id);
        draft = mine ? { n: mine.n, tags: [...(mine.tags || [])] } : { n: 0, tags: [] };
    }

    function myStats(stores) {
        const mine = stores.map((s) => DB.myRating(s.id)).filter(Boolean);
        const avg = mine.length ? (mine.reduce((t, r) => t + r.n, 0) / mine.length).toFixed(1) : '–';
        $('#mine').innerHTML = `
            <div><strong>${mine.length}/${stores.length}</strong><span>Stores I rated</span></div>
            <div><strong>${avg}</strong><span>Average I give</span></div>
            <div><strong>${stores.length - mine.length}</strong><span>Still to rate</span></div>`;
    }

    function renderList(stores) {
        $('#list').innerHTML = stores.map((s) => {
            const sum = DB.summary(s.id), mine = DB.myRating(s.id);
            return `<button class="rate-item${s.id === selected ? ' active' : ''}" data-id="${esc(s.id)}">
                <span class="ri-name">${esc(s.name)}</span>
                <span class="ri-meta">${sum.count ? `${UI.stars(sum.avg)} ${sum.avg.toFixed(1)} (${sum.count})` : 'No ratings yet'}</span>
                ${mine ? `<span class="ri-mine">You: ${mine.n}★</span>` : '<span class="ri-todo">Not rated</span>'}
            </button>`;
        }).join('');
    }

    function renderPanel() {
        const s = DB.store(selected);
        if (!s) { $('#panel').innerHTML = ''; return; }
        const sum = DB.summary(s.id), mine = DB.myRating(s.id);
        const changed = !mine || mine.n !== draft.n || (mine.tags || []).slice().sort().join() !== draft.tags.slice().sort().join();

        $('#panel').innerHTML = `
        <div class="panel">
            <h2><a href="${UI.storeUrl(s.id)}">${esc(s.name)}</a></h2>
            <p class="muted small">${esc(s.location)}</p>

            <div class="summary-row">
                <div class="big-avg"><strong>${sum.count ? sum.avg.toFixed(1) : '–'}</strong>${sum.count ? UI.stars(sum.avg) : ''}<span class="muted small">${sum.count} rating${sum.count === 1 ? '' : 's'}</span></div>
                <div class="dist">${[5, 4, 3, 2, 1].map((n) => `<div class="dist-row"><span>${n}★</span><div class="dist-bar"><span style="width:${sum.count ? (sum.dist[n - 1] / sum.count) * 100 : 0}%"></span></div><span>${sum.dist[n - 1]}</span></div>`).join('')}</div>
            </div>

            <h3 class="rate-title">${mine ? 'Your rating' : 'How was your experience?'}</h3>
            <div class="star-input" role="radiogroup" aria-label="Your rating">
                ${[1, 2, 3, 4, 5].map((n) => `<button class="star${n <= draft.n ? ' on' : ''}" data-star="${n}" role="radio" aria-checked="${n === draft.n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
                <span class="star-label">${draft.n ? LABELS[draft.n - 1] : 'Tap a star'}</span>
            </div>

            <span class="field-label top-gap">What stood out? (optional)</span>
            <div class="tag-pick">${TAGS.map((t) => `<button class="chip${draft.tags.includes(t) ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>

            <div class="rate-actions">
                <button class="btn" id="save" ${draft.n && changed ? '' : 'disabled'}>${mine ? 'Update rating' : 'Submit rating'}</button>
                ${mine ? '<button class="btn danger" id="remove">Remove my rating</button>' : ''}
                <a class="btn ghost" href="reviews.html?target=${encodeURIComponent(s.id)}">Write a review</a>
            </div>
        </div>`;
    }

    function render() {
        const stores = DB.stores();
        const query = ($('#businessSearch')?.value || '').trim().toLowerCase();
        if (!stores.length) {
            $('#mine').innerHTML = '';
            $('#list').innerHTML = '';
            $('#panel').innerHTML = UI.NO_STORES;
            $('#businessSearchCount').textContent = 'No registered businesses are available yet.';
            return;
        }

        myStats(stores);
        const filtered = stores.filter((store) =>
            !query || `${store.name} ${store.location} ${store.area}`.toLowerCase().includes(query)
        );
        $('#businessSearchCount').textContent = `${filtered.length} of ${stores.length} business${stores.length === 1 ? '' : 'es'}`;

        if (!filtered.length) {
            $('#list').innerHTML = '';
            $('#panel').innerHTML = UI.emptyBox('No matching business', 'Try another business name or location.', 'fa-magnifying-glass');
            return;
        }
        if (!filtered.some((store) => store.id === selected)) choose(filtered[0].id);
        renderList(filtered);
        renderPanel();
    }

    $('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { choose(b.dataset.id); render(); } });

    $('#panel').addEventListener('click', (e) => {
        const star = e.target.closest('[data-star]'), tag = e.target.closest('[data-tag]');
        if (star) { draft.n = Number(star.dataset.star); renderPanel(); }
        else if (tag) { const t = tag.dataset.tag; draft.tags = draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t]; renderPanel(); }
        else if (e.target.closest('#save')) {
            DB.rate(selected, draft.n, draft.tags);
            UI.toast(`Thanks! You rated ${DB.store(selected).name} ${draft.n}★.`);
            render();
        } else if (e.target.closest('#remove')) {
            DB.clearRating(selected);
            choose(selected);
            UI.toast('Your rating was removed.');
            render();
        }
    });

    $('#businessSearch')?.addEventListener('input', render);

    DB.onChange(render);
    choose(selected || '');
    render();
})();
