/* store-information.js — Store Information: location, contact details, hours, and the products on sale */
(function () {
    const { $, esc } = UI;
    const id = UI.param('id');
    let filter = 'all';                                 // products: all / in / out
    let query = '';

    $('#crumbs').innerHTML = '<a href="student.html">Home</a> › <a href="store-directory.html">Store Directory</a>';

    /* ----- no store chosen (or it was removed): pick one ----- */
    function picker(missing) {
        const stores = DB.stores();
        $('#crumbs').innerHTML = '<a href="student.html">Home</a> › Store Information';
        $('#content').innerHTML = `
            <div class="page-head"><h1>Store Information</h1><p>${missing ? 'That store is not available any more. Pick another one.' : 'Choose a store to see where it is, how to reach it, and what it sells.'}</p></div>
            ${stores.length ? `<div class="grid">${stores.map((s) => UI.storeCard(s)).join('')}</div>` : UI.NO_STORES}`;
    }

    function whenText(s) {
        if (!DB.hasHours(s)) return '';
        const open = DB.isOpen(s);
        return open ? `Closes at ${DB.hoursText(s).split(' – ')[1]}` : `Opens at ${DB.hoursText(s).split(' – ')[0]}`;
    }

    function render() {
        const s = DB.store(id);
        if (!s) return picker(Boolean(id));

        const products = DB.productsOf(s.id);
        const shown = products
            .filter((p) => filter === 'all' || (filter === 'in') === p.available)
            .filter((p) => UI.matches(`${p.name} ${p.category}`, query))
            .sort((a, b) => b.available - a.available || a.name.localeCompare(b.name));
        const inStock = products.filter((p) => p.available).length;
        const reviews = DB.reviewsFor(s.id).slice(0, 3);
        const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.location}`)}`;
        const phone = s.contact.replace(/[^\d+]/g, '');

        $('#crumbs').innerHTML = `<a href="student.html">Home</a> › <a href="store-directory.html">Store Directory</a> › ${esc(s.name)}`;
        document.title = `${s.name} | CASIA Canteen`;

        $('#content').innerHTML = `
        <section class="panel store-head">
            <div>
                <h1>${esc(s.name)}</h1>
                <div class="card-meta">${UI.openBadge(s)}<span class="badge tag">${esc(s.area)}</span>${UI.ratingLine(s.id)}</div>
                ${s.description ? `<p class="about">${esc(s.description)}</p>` : ''}
            </div>
            <div class="head-actions">${UI.heart(s.id)}
                <a class="btn sm" href="store-ratings.html?id=${encodeURIComponent(s.id)}"><i class="fa-solid fa-star"></i> Rate this store</a>
            </div>
        </section>

        <section class="info-grid">
            <div class="info-card">
                <h3><i class="fa-solid fa-location-dot"></i> Location</h3>
                <p>${esc(s.location || 'Not listed')}</p>
                ${s.location ? `<a class="btn sm ghost" href="${maps}" target="_blank" rel="noopener">Open in Maps</a>` : ''}
            </div>
            <div class="info-card">
                <h3><i class="fa-solid fa-phone"></i> Contact</h3>
                ${s.contact ? `<p><a href="tel:${esc(phone)}">${esc(s.contact)}</a></p>` : '<p class="muted">No phone listed</p>'}
                ${s.email ? `<p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}
                <div class="info-actions">
                    ${s.contact ? `<a class="btn sm" href="tel:${esc(phone)}">Call</a><button class="btn sm ghost" id="copyPhone">Copy number</button>` : ''}
                    ${s.email ? `<a class="btn sm ghost" href="mailto:${esc(s.email)}">Email</a>` : ''}
                </div>
            </div>
            <div class="info-card">
                <h3><i class="fa-regular fa-clock"></i> Opening hours</h3>
                <p>${DB.hoursText(s)}</p>
                <p class="muted small">${whenText(s)}</p>
            </div>
        </section>

        <h2 class="section-title">Products (${inStock} of ${products.length} available)</h2>
        <div class="toolbar">
            <div class="chips" id="pFilter">
                <button class="chip${filter === 'all' ? ' active' : ''}" data-f="all">All</button>
                <button class="chip${filter === 'in' ? ' active' : ''}" data-f="in">Available</button>
                <button class="chip${filter === 'out' ? ' active' : ''}" data-f="out">Out of stock</button>
            </div>
            <input class="input search" id="pq" type="search" placeholder="Search this store's products" value="${esc(query)}" aria-label="Search this store's products">
        </div>
        ${products.length ? (shown.length ? `<div class="rows">${shown.map((p) => `
            <div class="row">
                <div class="row-main"><a href="${UI.productUrl(p.id)}">${esc(p.name)}</a><span class="muted small">${esc(p.category)}${p.description ? ' · ' + esc(p.description) : ''}</span></div>
                <span class="price">${UI.peso(p.price)}</span>
                ${UI.stockBadge(p)}
                ${UI.heart(p.id)}
            </div>`).join('')}</div>` : UI.emptyBox('No products match', 'Try another filter.', 'fa-magnifying-glass'))
            : UI.emptyBox('No products listed yet', 'This store has not added any products.', 'fa-bowl-food')}

        <h2 class="section-title">What students say</h2>
        ${reviews.length ? reviews.map((r) => `<div class="mini-review"><p>${esc(r.text)}</p><small>${esc(r.author)} · ${UI.date(r.date)}</small></div>`).join('') : '<p class="muted">No reviews yet.</p>'}
        <p class="more"><a class="btn sm ghost" href="reviews.html?target=${encodeURIComponent(s.id)}">Write or read reviews</a></p>`;

        const copy = $('#copyPhone');
        if (copy) copy.addEventListener('click', () => {
            (navigator.clipboard ? navigator.clipboard.writeText(s.contact) : Promise.reject()).then(
                () => UI.toast('Phone number copied.'), () => UI.toast(`Number: ${s.contact}`));
        });
        $('#pFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
        $('#pq').addEventListener('input', UI.debounce((e) => { query = e.target.value; render(); const box = $('#pq'); box.focus(); box.setSelectionRange(query.length, query.length); }, 150));
    }

    if (id && DB.store(id)) DB.pushViewed(id);
    DB.onChange(render);
    document.addEventListener('casia:fav', render);
    render();
})();
