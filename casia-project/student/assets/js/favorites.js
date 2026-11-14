/* favorites.js — Favorites: saved stores and products, each with a private note */
(function () {
    const { $, esc } = UI;
    let tab = 'all';
    let editing = null;                                 // id of the favorite whose note is being edited

    const kind = (f) => (DB.isProduct(DB.item(f.id)) ? 'products' : 'stores');

    function card(f) {
        const it = DB.item(f.id);
        const isP = DB.isProduct(it);
        const s = isP ? DB.storeOf(it) : it;
        const body = isP
            ? `<p class="muted small"><a href="${UI.storeUrl(s.id)}">${esc(s.name)}</a> · <span class="badge tag">${esc(it.category)}</span></p>
               <p class="price">${UI.peso(it.price)}</p>
               <div class="card-meta">${UI.stockBadge(it)}${UI.ratingLine(it.id)}</div>`
            : `<p class="muted small"><i class="fa-solid fa-location-dot"></i> ${esc(it.location || it.area)}</p>
               <div class="card-meta">${UI.openBadge(it)}${UI.ratingLine(it.id)}</div>
               <p class="muted small">${DB.hoursText(it)}</p>`;

        const note = editing === it.id
            ? `<textarea class="input" id="noteText" maxlength="140" placeholder="A note only you can see">${esc(f.note || '')}</textarea>
               <div class="note-actions"><button class="btn sm" data-savenote="${esc(it.id)}">Save</button><button class="btn sm ghost" data-cancelnote>Cancel</button></div>`
            : `<div class="note">${f.note ? `<p>“${esc(f.note)}”</p>` : '<p class="muted small">No note yet</p>'}<button class="btn link small" data-note="${esc(it.id)}">${f.note ? 'Edit note' : 'Add a note'}</button></div>`;

        return `<article class="card">
            <div class="card-top"><h3><a href="${UI.urlOf(it)}">${esc(it.name)}</a></h3>${UI.heart(it.id)}</div>
            ${body}
            ${note}
            <p class="muted small">Saved ${UI.date(f.at)}</p>
            <a class="btn" href="${UI.urlOf(it)}">${isP ? 'View details' : 'View store'}</a>
        </article>`;
    }

    function render() {
        const all = DB.favs();
        const stores = all.filter((f) => kind(f) === 'stores'), products = all.filter((f) => kind(f) === 'products');
        $('#favTools').hidden = !all.length;
        $('#cAll').textContent = all.length;
        $('#cStores').textContent = stores.length;
        $('#cProducts').textContent = products.length;
        document.querySelectorAll('#tabs .chip').forEach((c) => c.classList.toggle('active', c.dataset.tab === tab));

        const favP = products.map((f) => DB.item(f.id)), favS = stores.map((f) => DB.item(f.id));
        const sum = $('#summary');
        sum.hidden = !all.length;
        sum.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${favP.filter((p) => p.available).length} of ${favP.length} saved product${favP.length === 1 ? ' is' : 's are'} available · ${favS.filter((s) => DB.isOpen(s) === true).length} of ${favS.length} saved store${favS.length === 1 ? ' is' : 's are'} open now.`;

        if (!all.length) {
            $('#list').innerHTML = UI.emptyBox('No favorites yet', 'Tap the heart on a store or product to save it here. Try <a href="search-store.html">Search Store</a> or <a href="product-search.html">Product Search</a>.', 'fa-heart');
            return;
        }

        let list = tab === 'all' ? [...all] : tab === 'stores' ? stores : products;
        list.sort($('#sort').value === 'name'
            ? (a, b) => DB.item(a.id).name.localeCompare(DB.item(b.id).name)
            : (a, b) => b.at.localeCompare(a.at));

        $('#list').innerHTML = list.length ? `<div class="grid">${list.map(card).join('')}</div>`
            : UI.emptyBox(`No ${tab} saved`, 'Tap the heart on one to save it.', 'fa-heart');
    }

    $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
    $('#sort').addEventListener('change', render);
    $('#clearAll').addEventListener('click', () => {
        if (!confirm('Remove all your favorites?')) return;
        DB.clearFavs(); UI.syncHearts(); UI.toast('All favorites removed.'); render();
    });

    $('#list').addEventListener('click', (e) => {
        const t = (s) => e.target.closest(s);
        if (t('[data-note]')) { editing = t('[data-note]').dataset.note; render(); const box = $('#noteText'); if (box) box.focus(); }
        else if (t('[data-cancelnote]')) { editing = null; render(); }
        else if (t('[data-savenote]')) {
            DB.setNote(t('[data-savenote]').dataset.savenote, $('#noteText').value.trim());
            editing = null; UI.toast('Note saved.'); render();
        }
    });

    document.addEventListener('casia:fav', render);     // heart pressed: the card leaves the list
    DB.onChange(render);
    render();
})();
