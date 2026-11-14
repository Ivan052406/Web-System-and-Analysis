/* ==========================================================================
   shell.js — loaded by every student page after data.js.
   Builds the side navigation, the phone menu, the toast message, the heart
   (favorite) buttons, and the small helpers (UI) the page scripts share.
   ========================================================================== */

const CONFIG = {
    LOGIN_URL: '../login/login.html',   // where Log out goes (and where visitors go if REQUIRE_LOGIN is on)
    REQUIRE_LOGIN: false                // true = send anyone who is not signed in to the login page
};

const UI = (() => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const peso = (n) => '₱' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const param = (name) => new URLSearchParams(location.search).get(name);
    const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const date = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const clock = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const storeUrl = (id) => `store-information.html?id=${encodeURIComponent(id)}`;
    const productUrl = (id) => `product-details.html?id=${encodeURIComponent(id)}`;
    const urlOf = (it) => (DB.isProduct(it) ? productUrl(it.id) : storeUrl(it.id));

    /* ----- searching: every word typed must be found somewhere ----- */
    const tokens = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (haystack, q) => { const h = String(haystack).toLowerCase(); return tokens(q).every((t) => h.includes(t)); };
    function highlight(text, q) {
        const t = tokens(q);
        if (!t.length) return esc(text);
        const re = new RegExp('(' + t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
        return String(text).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
    }

    /* ----- little pieces of html ----- */
    const stars = (avg) => `<span class="stars" style="--v:${avg.toFixed(2)}" role="img" aria-label="${avg.toFixed(1)} out of 5 stars">★★★★★</span>`;
    function ratingLine(id) {
        const s = DB.summary(id);
        return s.count
            ? `<span class="rating-line">${stars(s.avg)} ${s.avg.toFixed(1)} <small>(${s.count})</small></span>`
            : `<span class="rating-line"><small>No ratings yet</small></span>`;
    }
    function openBadge(s) {
        const o = DB.isOpen(s);
        return o === null ? '<span class="badge tag">Hours not listed</span>' : `<span class="badge ${o ? 'ok' : 'out'}">${o ? 'Open now' : 'Closed'}</span>`;
    }
    const stockBadge = (p) => `<span class="badge ${p.available ? 'ok' : 'out'}">${p.available ? 'Available' : 'Out of stock'}</span>`;
    const heart = (id) => {
        const on = DB.isFav(id);
        return `<button class="heart ${on ? 'on' : ''}" data-fav="${esc(id)}" aria-label="${on ? 'Remove from favorites' : 'Save to favorites'}" aria-pressed="${on}">${on ? '♥' : '♡'}</button>`;
    };
    const emptyBox = (title, text, icon = 'fa-store') => `<div class="empty"><i class="fa-solid ${icon}"></i><b>${title}</b>${text}</div>`;
    const NO_STORES = emptyBox('No stores yet', 'Stores appear here as soon as a store owner adds them from their store account.');

    function storeCard(s, q = '') {
        const n = DB.productsOf(s.id).length;
        return `<article class="card">
            <div class="card-top"><h3><a href="${storeUrl(s.id)}">${highlight(s.name, q)}</a></h3>${heart(s.id)}</div>
            <p class="muted small"><i class="fa-solid fa-location-dot"></i> ${highlight(s.location || s.area, q)}</p>
            <div class="card-meta">${openBadge(s)}${ratingLine(s.id)}</div>
            <p class="muted small">${n} product${n === 1 ? '' : 's'} · ${DB.hoursText(s)}</p>
            <a class="btn" href="${storeUrl(s.id)}">View store</a>
        </article>`;
    }
    function productCard(p, q = '') {
        const s = DB.storeOf(p);
        return `<article class="card">
            <div class="card-top"><h3><a href="${productUrl(p.id)}">${highlight(p.name, q)}</a></h3>${heart(p.id)}</div>
            <p class="muted small">${highlight(s.name, q)} · <span class="badge tag">${esc(p.category)}</span></p>
            <p class="price">${peso(p.price)}</p>
            <div class="card-meta">${stockBadge(p)}${ratingLine(p.id)}</div>
            <a class="btn" href="${productUrl(p.id)}">View details</a>
        </article>`;
    }

    /* ----- toast ----- */
    let timer;
    function toast(message) {
        const box = document.getElementById('toast');
        box.textContent = message;
        box.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => box.classList.remove('show'), 3000);
    }

    // refresh every heart on the page after one changes
    function syncHearts() {
        $$('[data-fav]').forEach((b) => {
            const on = DB.isFav(b.dataset.fav);
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on);
            b.textContent = on ? '♥' : '♡';
        });
        const c = document.getElementById('navFavCount');
        if (c) { c.textContent = DB.favs().length; c.hidden = !DB.favs().length; }
    }

    return { $, $$, esc, peso, param, debounce, date, clock, storeUrl, productUrl, urlOf, tokens, matches, highlight, stars, ratingLine, openBadge, stockBadge, heart, emptyBox, NO_STORES, storeCard, productCard, toast, syncHearts };
})();

(function buildShell() {
    const page = document.body.dataset.page;
    const NAV = [
        ['', [['home', 'student.html', 'fa-house', 'Home']]],
        ['Discover', [['search-store', 'search-store.html', 'fa-magnifying-glass', 'Search Store'], ['store-directory', 'store-directory.html', 'fa-store', 'Store Directory'], ['product-search', 'product-search.html', 'fa-bowl-food', 'Product Search']]],
        ['Details', [['store-information', 'store-information.html', 'fa-circle-info', 'Store Information'], ['product-details', 'product-details.html', 'fa-tag', 'Product Details']]],
        ['Rate and review', [['store-ratings', 'store-ratings.html', 'fa-star', 'Store Ratings'], ['product-ratings', 'product-ratings.html', 'fa-star-half-stroke', 'Product Ratings'], ['reviews', 'reviews.html', 'fa-comment-dots', 'Reviews & Feedback']]],
        ['Tools', [['availability', 'availability.html', 'fa-circle-check', 'Availability Check'], ['favorites', 'favorites.html', 'fa-heart', 'Favorites']]]
    ];

    const me = DB.me();
    if (CONFIG.REQUIRE_LOGIN && me.email === 'guest') { location.href = CONFIG.LOGIN_URL; return; }

    const links = NAV.map(([group, items]) =>
        (group ? `<div class="nav-group">${group}</div>` : '') +
        items.map(([id, href, icon, label]) =>
            `<a class="nav-item${id === page ? ' active' : ''}" href="${href}"><i class="fa-solid ${icon}"></i> ${label}${id === 'favorites' ? ' <span class="nav-count" id="navFavCount" hidden>0</span>' : ''}</a>`).join('')
    ).join('');

    document.getElementById('sidebar').innerHTML = `
        <div class="brand"><img class="brand-logo" src="assets/images/casia-logo-white.png" alt="CASIA - Canteen Sales &amp; Inventory Analytics"><small>Student</small></div>
        <nav class="nav">${links}</nav>
        <div class="sidebar-foot">
            <div class="sidebar-user"><span class="avatar"><i class="fa-solid fa-user"></i></span><span>${UI.esc(me.name)}</span></div>
            <a href="${CONFIG.LOGIN_URL}" class="logout" id="logout"><i class="fa-solid fa-right-from-bracket"></i> Log out</a>
        </div>`;

    const title = document.getElementById('topbarTitle');
    if (title) title.textContent = document.body.dataset.title || '';
    const who = document.getElementById('topbarUser');
    if (who) who.textContent = me.email === 'guest' ? 'Browsing as guest' : `Signed in as ${me.name}`;

    // phone menu
    const sidebar = document.getElementById('sidebar'), backdrop = document.getElementById('backdrop');
    const close = () => { sidebar.classList.remove('open'); backdrop.classList.remove('open'); };
    document.getElementById('menuBtn').addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('open'); });
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    document.getElementById('logout').addEventListener('click', () => localStorage.removeItem('casiaSession'));

    // hearts work the same on every page
    document.addEventListener('click', (e) => {
        const h = e.target.closest('[data-fav]');
        if (!h) return;
        const it = DB.item(h.dataset.fav);
        const on = DB.toggleFav(h.dataset.fav);
        UI.syncHearts();
        UI.toast(on ? `Saved ${it.name} to favorites.` : `Removed ${it.name} from favorites.`);
        document.dispatchEvent(new CustomEvent('casia:fav'));
    });

    UI.syncHearts();
})();
