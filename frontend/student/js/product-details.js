/* product-details.js — Product Details: name, price, description, availability, and where to find it */
(function () {
    const { $, esc } = UI;
    const id = UI.param('id');
    let checkedAt = new Date();

    $('#crumbs').innerHTML = '<a href="home.html">Home</a> › <a href="product-search.html">Product Search</a>';

    function picker(missing) {
        const products = DB.products();
        $('#crumbs').innerHTML = '<a href="home.html">Home</a> › Product Details';
        $('#content').innerHTML = `
            <div class="page-head"><h1>Product Details</h1><p>${missing ? 'That product is not available any more. Pick another one.' : 'Choose a product to see its price, description and availability.'}</p></div>
            ${products.length ? `<div class="grid">${products.map((p) => UI.productCard(p)).join('')}</div>`
                : (DB.stores().length ? UI.emptyBox('No products yet', 'Products appear here as soon as a store adds them.', 'fa-bowl-food') : UI.NO_STORES)}`;
    }

    function stockLine(p) {
        if (!p.available) return 'Currently out of stock';
        if (p.stock === null) return 'In stock';
        return p.stock <= 5 ? `Only ${p.stock} left` : 'In stock';
    }

    function render() {
        const p = DB.product(id);
        if (!p) return picker(Boolean(id));

        const s = DB.storeOf(p);
        const open = DB.isOpen(s);
        const sum = DB.summary(p.id);
        const mine = DB.myRating(p.id);
        const reviews = DB.reviewsFor(p.id).slice(0, 3);
        const related = [
            ...DB.productsOf(s.id).filter((x) => x.id !== p.id),
            ...DB.products().filter((x) => x.storeId !== s.id && x.category === p.category)
        ].slice(0, 3);

        $('#crumbs').innerHTML = `<a href="home.html">Home</a> › <a href="product-search.html">Product Search</a> › ${esc(p.name)}`;
        document.title = `${p.name} | CASIA Canteen`;

        $('#content').innerHTML = `
        <section class="panel product-head">
            <div class="product-main">
                <span class="badge tag">${esc(p.category)}</span>
                <h1>${esc(p.name)}</h1>
                <p class="big-price">${UI.peso(p.price)}</p>
                <p class="desc">${esc(p.description || 'No description added yet.')}</p>
                <div class="card-meta">${UI.ratingLine(p.id)}</div>
            </div>
            <div class="avail ${p.available ? 'is-ok' : 'is-out'}">
                <i class="fa-solid ${p.available ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                <strong>${p.available ? 'Available' : 'Out of stock'}</strong>
                <span>${stockLine(p)}</span>
                ${p.available && open === false ? `<span class="note">The store is closed right now (${DB.hoursText(s)}).</span>` : ''}
                <small>Checked at ${UI.clock(checkedAt)} · <button class="btn link" id="recheck">Check again</button></small>
                ${p.available ? '' : `<button class="btn sm ${DB.isWatching(p.id) ? '' : 'ghost'}" id="watch"><i class="fa-${DB.isWatching(p.id) ? 'solid' : 'regular'} fa-bell"></i> ${DB.isWatching(p.id) ? 'Watching' : 'Tell me when it is back'}</button>`}
            </div>
        </section>

        <section class="info-grid">
            <div class="info-card">
                <h3><i class="fa-solid fa-store"></i> Sold at</h3>
                <p><a href="${UI.storeUrl(s.id)}"><b>${esc(s.name)}</b></a></p>
                <div class="card-meta">${UI.openBadge(s)}</div>
                <p class="muted small">${esc(s.location)}</p>
                <a class="btn sm ghost" href="${UI.storeUrl(s.id)}">Store information</a>
            </div>
            <div class="info-card">
                <h3><i class="fa-solid fa-star"></i> Student ratings</h3>
                ${sum.count ? `<p><b class="avg">${sum.avg.toFixed(1)}</b> ${UI.stars(sum.avg)} <span class="muted small">${sum.count} rating${sum.count === 1 ? '' : 's'}</span></p>
                    <div class="dist">${[5, 4, 3, 2, 1].map((n) => `<div class="dist-row"><span>${n}★</span><div class="dist-bar"><span style="width:${(sum.dist[n - 1] / sum.count) * 100}%"></span></div><span>${sum.dist[n - 1]}</span></div>`).join('')}</div>`
                    : '<p class="muted">No ratings yet. Be the first!</p>'}
                <p class="small">${mine ? `You rated it ${mine.n}★.` : ''}</p>
                <a class="btn sm ghost" href="product-ratings.html?id=${encodeURIComponent(p.id)}">${mine ? 'Change my rating' : 'Rate this product'}</a>
            </div>
            <div class="info-card">
                <h3><i class="fa-solid fa-heart"></i> Save it</h3>
                <p class="muted small">Add it to your favorites to find it quickly next time.</p>
                ${UI.heart(p.id)}
                <a class="btn sm ghost" href="reviews.html?target=${encodeURIComponent(p.id)}">Write a review</a>
            </div>
        </section>

        <h2 class="section-title">What students say</h2>
        ${reviews.length ? reviews.map((r) => `<div class="mini-review"><p>${esc(r.text)}</p><small>${esc(r.author)} · ${UI.date(r.date)}</small></div>`).join('') : '<p class="muted">No reviews yet.</p>'}

        ${related.length ? `<h2 class="section-title">You might also like</h2><div class="grid">${related.map((x) => UI.productCard(x)).join('')}</div>` : ''}`;

        $('#recheck').addEventListener('click', () => { checkedAt = new Date(); render(); UI.toast('Availability checked.'); });
        const w = $('#watch');
        if (w) w.addEventListener('click', () => {
            const on = DB.toggleWatch(p.id);
            UI.toast(on ? `We'll show an alert when ${p.name} is back.` : `Stopped watching ${p.name}.`);
            render();
        });
    }

    if (id && DB.product(id)) DB.pushViewed(id);
    DB.onChange(() => { checkedAt = new Date(); render(); });   // a store updated its products
    document.addEventListener('casia:fav', render);
    render();
})();
