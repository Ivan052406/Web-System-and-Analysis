/* search-store.js — Search Store: type to find stores by name, place, or something they sell */
(function () {
    const { $, esc } = UI;
    const q = $('#q'), results = $('#results'), suggest = $('#suggest');
    let active = -1;                                    // highlighted suggestion

    /* ----- what counts as a match ----- */
    const sells = (s) => DB.productsOf(s.id);
    const haystack = (s) => [s.name, s.area, s.location, s.description, ...sells(s).map((p) => `${p.name} ${p.category}`)].join(' ');

    function score(s, query) {                          // name matches rank first, then place, then products
        const name = s.name.toLowerCase(), place = `${s.area} ${s.location}`.toLowerCase();
        return UI.tokens(query).reduce((t, tok) => t + (name.startsWith(tok) ? 4 : name.includes(tok) ? 3 : place.includes(tok) ? 2 : 1), 0);
    }

    /* ----- results ----- */
    function card(s, query) {
        const hit = UI.tokens(query).length ? sells(s).filter((p) => UI.matches(`${p.name} ${p.category}`, query)).slice(0, 3) : [];
        const n = sells(s).length;
        return `<article class="card">
            <div class="card-top"><h3><a href="${UI.storeUrl(s.id)}" data-result>${UI.highlight(s.name, query)}</a></h3>${UI.heart(s.id)}</div>
            <p class="muted small"><i class="fa-solid fa-location-dot"></i> ${UI.highlight(s.location || s.area, query)}</p>
            ${hit.length ? `<p class="sells small"><i class="fa-solid fa-utensils"></i> Sells ${hit.map((p) => `<b>${UI.highlight(p.name, query)}</b>`).join(', ')}</p>` : ''}
            <div class="card-meta">${UI.openBadge(s)}${UI.ratingLine(s.id)}</div>
            <p class="muted small">${n} product${n === 1 ? '' : 's'} · ${DB.hoursText(s)}</p>
            <a class="btn" href="${UI.storeUrl(s.id)}" data-result>View store</a>
        </article>`;
    }

    function render() {
        const all = DB.stores(), query = q.value;
        $('#clear').hidden = !query;

        // area filter keeps its choice when the list changes
        const areas = ['All areas', ...new Set(all.map((s) => s.area))];
        const chosen = $('#area').value || 'All areas';
        $('#area').innerHTML = areas.map((a) => `<option${a === chosen ? ' selected' : ''}>${esc(a)}</option>`).join('');

        if (!all.length) { $('#count').textContent = ''; results.innerHTML = UI.NO_STORES; return; }

        let list = all.filter((s) => UI.matches(haystack(s), query));
        if ($('#area').value !== 'All areas') list = list.filter((s) => s.area === $('#area').value);
        if ($('#openOnly').checked) list = list.filter((s) => DB.isOpen(s) === true);

        const sort = $('#sort').value;
        if (sort === 'rating') list.sort((a, b) => DB.summary(b.id).avg - DB.summary(a.id).avg);
        else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else list.sort((a, b) => score(b, query) - score(a, query) || a.name.localeCompare(b.name));

        $('#count').textContent = `${list.length} store${list.length === 1 ? '' : 's'}${query.trim() ? ` for “${query.trim()}”` : ''}`;
        results.innerHTML = list.length
            ? list.map((s) => card(s, query)).join('')
            : `<div style="grid-column:1/-1">${UI.emptyBox('No stores found', 'Try another word, or clear the filters.', 'fa-magnifying-glass')}</div>`;
    }

    /* ----- suggestions under the box ----- */
    function suggestions() {
        const query = q.value.trim();
        if (!query) return [];
        const out = [];
        DB.stores().forEach((s) => { if (UI.matches(s.name, query)) out.push({ text: s.name, tag: 'Store' }); });
        DB.stores().forEach((s) => { if (UI.matches(s.area, query) && !out.some((o) => o.text === s.area)) out.push({ text: s.area, tag: 'Area' }); });
        DB.products().forEach((p) => { if (UI.matches(p.name, query) && !out.some((o) => o.text === p.name)) out.push({ text: p.name, tag: 'Sold here' }); });
        return out.slice(0, 6);
    }

    function drawSuggest() {
        const list = suggestions();
        active = -1;
        suggest.hidden = !list.length;
        suggest.innerHTML = list.map((o, i) =>
            `<li role="option" id="sg${i}" data-text="${esc(o.text)}">${UI.highlight(o.text, q.value)} <em>${o.tag}</em></li>`).join('');
    }

    function pick(text) {
        q.value = text;
        suggest.hidden = true;
        DB.addRecent('store', text);
        drawRecent();
        render();
    }

    suggest.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(li.dataset.text); } });

    q.addEventListener('keydown', (e) => {
        const items = [...suggest.children];
        if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; }
        else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; }
        else if (e.key === 'Enter') { e.preventDefault(); pick(active >= 0 ? items[active].dataset.text : q.value); return; }
        else if (e.key === 'Escape') { suggest.hidden = true; return; }
        else return;
        items.forEach((li, i) => li.classList.toggle('active', i === active));
    });

    q.addEventListener('input', UI.debounce(() => { drawSuggest(); render(); }, 120));
    q.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 120));
    $('#clear').addEventListener('click', () => { q.value = ''; suggest.hidden = true; render(); q.focus(); });

    /* ----- recent searches ----- */
    function drawRecent() {
        const list = DB.recent('store');
        $('#recent').hidden = !list.length;
        $('#recentChips').innerHTML = list.map((t) => `<button class="chip" data-recent="${esc(t)}">${esc(t)}</button>`).join('');
    }
    $('#recentChips').addEventListener('click', (e) => { const b = e.target.closest('[data-recent]'); if (b) pick(b.dataset.recent); });
    $('#clearRecent').addEventListener('click', () => { DB.clearRecent('store'); drawRecent(); });

    // remember what was typed when a result is opened
    results.addEventListener('click', (e) => { if (e.target.closest('[data-result]') && q.value.trim()) DB.addRecent('store', q.value); });

    ['#area', '#openOnly', '#sort'].forEach((sel) => $(sel).addEventListener('change', render));
    DB.onChange(render);
    document.addEventListener('casia:fav', () => {});   // hearts update themselves

    q.value = UI.param('q') || '';
    drawRecent();
    render();
})();
