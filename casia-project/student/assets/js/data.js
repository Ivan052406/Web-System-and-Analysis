/* ==========================================================================
   CASIA student pages — shared data layer (every page loads this first).

   WHERE THE DATA COMES FROM
   Stores and products are added by the stores themselves from their store
   accounts. Those accounts save them in this browser's localStorage under:
       casiaStores     -> a list of stores
       casiaProducts   -> a list of products
   (assets/js/store-data.js is a small helper the store-account pages can use to
   write them in exactly the right shape.) Nothing is made up here: until a store
   adds something, the student pages show an empty message.

   If your store accounts save somewhere else (a server, Firebase...), only this
   file has to change: make stores() and products() return the same shapes, and
   every student page keeps working.

   store   = { id, name, area, location, contact, email, open, close, description }
   product = { id, storeId, name, category, price, description, available, stock }
     open / close  hours as 24-hour numbers (8 and 17 = 8:00 AM to 5:00 PM)
                   or text like "08:00". Leave them out and hours show as "not listed".
     available     true / false. If it is missing, stock above 0 counts as available.
   Common alternative field names (address, phone, quantity, isAvailable...) are
   understood too, see normStore and normProduct below.

   What a student does (ratings, reviews, favorites, watch list) is saved per
   signed-in student (their email), so two students on one computer stay apart.
   ========================================================================== */

const DB = (() => {
    const KEYS = {
        stores: 'casiaStores', products: 'casiaProducts', ratings: 'casiaRatings',
        reviews: 'casiaReviews', favs: 'casiaFavs', watch: 'casiaWatch',
        helpful: 'casiaHelpful', recent: 'casiaRecentSearches', viewed: 'casiaViewed',
        seen: 'casiaAvailSeen'
    };

    /* ---------- storage ---------- */
    const read = (key, fallback) => {
        try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
        catch { return fallback; }
    };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };

    /* ---------- tidy up whatever the store accounts saved ---------- */
    const pick = (obj, names) => { for (const n of names) if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n]; return undefined; };

    // "8", 8, "08:30", "8:30 AM", "5 PM"  ->  8, 8, 8.5, 8.5, 17   (undefined when it can't be read)
    function hourOf(v) {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v !== 'string') return undefined;
        const m = v.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
        if (!m) return undefined;
        let h = Number(m[1]); const mins = Number(m[2] || 0), ap = (m[3] || '').toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return h + mins / 60;
    }

    function normStore(r) {
        if (!r || r.active === false || r.deleted) return null;
        const id = pick(r, ['id', 'storeId', '_id']), name = pick(r, ['name', 'storeName']);
        if (id === undefined || !name) return null;
        const location = pick(r, ['location', 'address']) || '';
        return {
            id: String(id), name: String(name),
            location: String(location),
            area: String(pick(r, ['area', 'building', 'zone']) || location.split(',').pop().trim() || 'Campus'),
            contact: String(pick(r, ['contact', 'phone', 'contactNumber', 'mobile']) || ''),
            email: String(pick(r, ['email']) || ''),
            open: hourOf(pick(r, ['open', 'opening', 'openTime', 'opensAt'])),
            close: hourOf(pick(r, ['close', 'closing', 'closeTime', 'closesAt'])),
            description: String(pick(r, ['description', 'about']) || '')
        };
    }

    function normProduct(r) {
        if (!r || r.active === false || r.deleted) return null;
        const id = pick(r, ['id', 'productId', '_id']), name = pick(r, ['name', 'productName']);
        const storeId = pick(r, ['storeId', 'store_id', 'store']);
        if (id === undefined || !name || storeId === undefined) return null;
        const stock = Number(pick(r, ['stock', 'quantity', 'qty']));
        const flag = pick(r, ['available', 'isAvailable', 'inStock']);
        return {
            id: String(id), storeId: String(storeId), name: String(name),
            category: String(pick(r, ['category', 'type']) || 'Others'),
            price: Number(pick(r, ['price', 'cost'])) || 0,
            description: String(pick(r, ['description', 'details']) || ''),
            stock: Number.isFinite(stock) ? stock : null,
            available: flag !== undefined ? Boolean(flag) : (Number.isFinite(stock) ? stock > 0 : true)
        };
    }

    /* ---------- who is signed in ---------- */
    const me = () => {
        const s = read('casiaSession', null);
        return s && s.email ? { email: s.email, name: s.name || s.email.split('@')[0] } : { email: 'guest', name: 'Guest' };
    };
    const first = (name) => String(name).split(' ')[0];

    /* ---------- stores and products ---------- */
    const stores = () => read(KEYS.stores, []).map(normStore).filter(Boolean);
    const products = () => {
        const ids = new Set(stores().map((s) => s.id));
        return read(KEYS.products, []).map(normProduct).filter((p) => p && ids.has(p.storeId));   // hide products of removed stores
    };
    const store = (id) => stores().find((s) => s.id === String(id));
    const product = (id) => products().find((p) => p.id === String(id));
    const item = (id) => store(id) || product(id);
    const isProduct = (it) => Boolean(it) && 'storeId' in it;
    const productsOf = (storeId) => products().filter((p) => p.storeId === storeId);
    const storeOf = (p) => store(p.storeId);

    const hour12 = (h) => { const whole = Math.floor(h), mins = Math.round((h - whole) * 60); return `${whole % 12 || 12}:${String(mins).padStart(2, '0')} ${whole < 12 ? 'AM' : 'PM'}`; };
    const hasHours = (s) => s.open !== undefined && s.close !== undefined;
    const hoursText = (s) => (hasHours(s) ? `${hour12(s.open)} – ${hour12(s.close)}` : 'Hours not listed');
    // true / false, or null when the store did not list its hours
    const isOpen = (s, d = new Date()) => {
        if (!hasHours(s)) return null;
        const h = d.getHours() + d.getMinutes() / 60;
        return s.open <= s.close ? h >= s.open && h < s.close : h >= s.open || h < s.close;
    };

    /* ---------- ratings (store overall experience, and products) ---------- */
    const ratingsAll = () => read(KEYS.ratings, {});

    const myRating = (id) => (ratingsAll()[id] || {})[me().email] || null;   // { n, tags, at } or null

    function rate(id, n, tags = []) {
        const all = ratingsAll();
        all[id] = all[id] || {};
        all[id][me().email] = { n, tags, at: new Date().toISOString() };
        write(KEYS.ratings, all);
    }
    function clearRating(id) {
        const all = ratingsAll();
        if (all[id]) { delete all[id][me().email]; write(KEYS.ratings, all); }
    }

    // average, number of ratings and the 1-5 star split, from the students' ratings
    function summary(id) {
        const dist = [0, 0, 0, 0, 0];
        Object.values(ratingsAll()[id] || {}).forEach((r) => { dist[r.n - 1]++; });
        const count = dist.reduce((a, b) => a + b, 0);
        const avg = count ? dist.reduce((t, c, i) => t + c * (i + 1), 0) / count : 0;
        return { avg, count, dist };
    }

    /* ---------- reviews and feedback ---------- */
    const reviewsAll = () => read(KEYS.reviews, []).filter((r) => item(r.targetId));
    const reviewsFor = (targetId) => reviewsAll().filter((r) => r.targetId === targetId).sort((a, b) => b.date.localeCompare(a.date));
    const myReviews = () => reviewsAll().filter((r) => r.email === me().email).sort((a, b) => b.date.localeCompare(a.date));

    function addReview({ targetId, type, text }) {
        const list = read(KEYS.reviews, []);
        const r = { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), targetId, type, text, author: me().name, email: me().email, date: new Date().toISOString() };
        list.push(r);
        write(KEYS.reviews, list);
        return r;
    }
    function updateReview(id, text) {
        write(KEYS.reviews, read(KEYS.reviews, []).map((r) => (r.id === id && r.email === me().email ? { ...r, text, edited: true } : r)));
    }
    function deleteReview(id) {
        write(KEYS.reviews, read(KEYS.reviews, []).filter((r) => !(r.id === id && r.email === me().email)));
    }

    // "helpful" votes: one per student, not on your own review
    const helpfulAll = () => read(KEYS.helpful, {});
    const helpfulCount = (id) => (helpfulAll()[id] || []).length;
    const iFoundHelpful = (id) => (helpfulAll()[id] || []).includes(me().email);
    function toggleHelpful(id) {
        const r = reviewsAll().find((x) => x.id === id);
        if (!r || r.email === me().email) return false;
        const all = helpfulAll();
        const list = all[id] || [];
        all[id] = list.includes(me().email) ? list.filter((e) => e !== me().email) : [...list, me().email];
        write(KEYS.helpful, all);
        return true;
    }

    /* ---------- favorites / bookmarks ---------- */
    const favsAll = () => read(KEYS.favs, {});
    const favs = () => (favsAll()[me().email] || []).filter((f) => item(f.id));   // [{ id, at, note }]
    const isFav = (id) => favs().some((f) => f.id === id);
    function toggleFav(id) {
        const all = favsAll(), mine = all[me().email] || [];
        const on = mine.some((f) => f.id === id);
        all[me().email] = on ? mine.filter((f) => f.id !== id) : [...mine, { id, at: new Date().toISOString(), note: '' }];
        write(KEYS.favs, all);
        return !on;
    }
    function setNote(id, note) {
        const all = favsAll();
        all[me().email] = (all[me().email] || []).map((f) => (f.id === id ? { ...f, note } : f));
        write(KEYS.favs, all);
    }
    function clearFavs() {
        const all = favsAll();
        all[me().email] = [];
        write(KEYS.favs, all);
    }

    /* ---------- availability watch list ("tell me when it is back") ---------- */
    const watchAll = () => read(KEYS.watch, {});
    const watchList = () => (watchAll()[me().email] || []).filter((id) => product(id));
    const isWatching = (id) => watchList().includes(id);
    function toggleWatch(id) {
        const all = watchAll(), mine = all[me().email] || [];
        const on = mine.includes(id);
        all[me().email] = on ? mine.filter((x) => x !== id) : [...mine, id];
        write(KEYS.watch, all);
        return !on;
    }

    /* ---------- recent searches and recently viewed ---------- */
    const recent = (kind) => (read(KEYS.recent, {})[kind] || []);
    function addRecent(kind, q) {
        const text = q.trim();
        if (text.length < 2) return;
        const all = read(KEYS.recent, {});
        all[kind] = [text, ...(all[kind] || []).filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, 6);
        write(KEYS.recent, all);
    }
    function clearRecent(kind) {
        const all = read(KEYS.recent, {});
        all[kind] = [];
        write(KEYS.recent, all);
    }
    const viewed = () => read(KEYS.viewed, []).filter((id) => item(id));
    function pushViewed(id) {
        write(KEYS.viewed, [id, ...read(KEYS.viewed, []).filter((x) => x !== id)].slice(0, 8));
    }

    // availability the student last saw (used to spot "back in stock")
    const seen = () => read(KEYS.seen, {});
    const saveSeen = (map) => write(KEYS.seen, map);

    /* ---------- live updates: another tab (a store account) changed the data ---------- */
    const listeners = [];
    window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('casia')) listeners.forEach((fn) => fn(e.key)); });
    const onChange = (fn) => listeners.push(fn);

    return {
        KEYS, read, write, me, first,
        stores, products, store, product, item, isProduct, productsOf, storeOf, hoursText, hasHours, isOpen,
        myRating, rate, clearRating, summary,
        reviewsAll, reviewsFor, myReviews, addReview, updateReview, deleteReview, helpfulCount, iFoundHelpful, toggleHelpful,
        favs, isFav, toggleFav, setNote, clearFavs,
        watchList, isWatching, toggleWatch,
        recent, addRecent, clearRecent, viewed, pushViewed, seen, saveSeen,
        onChange
    };
})();
