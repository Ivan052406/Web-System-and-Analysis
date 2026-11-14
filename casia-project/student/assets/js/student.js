/* student.js — Home page: greeting, quick numbers, the 10 features, open stores, recently viewed */
(function () {
    const { $, esc } = UI;

    const FEATURES = [
        ['search-store.html', 'fa-magnifying-glass', 'Search Store', 'Find a store by name, place or what it sells'],
        ['store-directory.html', 'fa-store', 'Store Directory', 'Browse every store on campus'],
        ['product-search.html', 'fa-bowl-food', 'Product Search', 'Look for the exact food or drink you need'],
        ['store-information.html', 'fa-circle-info', 'Store Information', 'Location, contact details and products'],
        ['product-details.html', 'fa-tag', 'Product Details', 'Price, description and availability'],
        ['store-ratings.html', 'fa-star', 'Store Ratings', 'Rate your overall store experience'],
        ['product-ratings.html', 'fa-star-half-stroke', 'Product Ratings', 'Rate the products you have tried'],
        ['reviews.html', 'fa-comment-dots', 'Reviews & Feedback', 'Leave comments and read others'],
        ['availability.html', 'fa-circle-check', 'Availability Check', 'See what is in stock before you go'],
        ['favorites.html', 'fa-heart', 'Favorites', 'Your saved stores and products']
    ];

    const me = DB.me();
    $('#greeting').textContent = me.email === 'guest' ? 'Welcome!' : `Hi, ${DB.first(me.name)}!`;

    function render() {
        const stores = DB.stores(), products = DB.products();
        const open = stores.filter((s) => DB.isOpen(s) === true);
        const available = products.filter((p) => p.available);

        $('#greetingSub').textContent = stores.length
            ? `${open.length} of ${stores.length} store${stores.length === 1 ? ' is' : 's are'} open right now.`
            : 'Stores will show up here as soon as they are added.';

        const stats = [
            ['fa-store', stores.length, 'Stores', 'store-directory.html'],
            ['fa-circle-check', available.length, 'Products available', 'availability.html'],
            ['fa-heart', DB.favs().length, 'My favorites', 'favorites.html'],
            ['fa-comment-dots', DB.myReviews().length, 'My reviews', 'reviews.html']
        ];
        $('#stats').innerHTML = stats.map(([icon, n, label, href]) =>
            `<a class="stat" href="${href}"><span class="stat-icon"><i class="fa-solid ${icon}"></i></span><div><strong>${n}</strong><span>${label}</span></div></a>`).join('');

        // products the student is watching that are available again
        const back = DB.watchList().map(DB.product).filter((p) => p && p.available);
        $('#alerts').innerHTML = back.length
            ? `<div class="alert"><i class="fa-solid fa-bell"></i><div><strong>Back in stock!</strong> ${back.map((p) => esc(p.name)).join(', ')} ${back.length > 1 ? 'are' : 'is'} available again.</div><a class="btn sm" href="availability.html">Check</a></div>`
            : '';

        $('#tiles').innerHTML = FEATURES.map(([href, icon, label, text]) =>
            `<a class="tile" href="${href}"><i class="fa-solid ${icon}"></i><strong>${label}</strong><span>${text}</span></a>`).join('');

        $('#openNow').innerHTML = !stores.length
            ? UI.NO_STORES
            : open.length
                ? `<div class="grid">${open.slice(0, 4).map((s) => UI.storeCard(s)).join('')}</div>`
                : UI.emptyBox('Everything is closed right now', 'Check the Store Directory for opening hours.', 'fa-moon');

        const seen = DB.viewed().slice(0, 4).map(DB.item);
        $('#viewedBlock').hidden = !seen.length;
        $('#viewed').innerHTML = seen.map((it) => (DB.isProduct(it) ? UI.productCard(it) : UI.storeCard(it))).join('');
    }

    render();
    DB.onChange(render);                                 // a store changed something in another tab
    document.addEventListener('casia:fav', render);
})();
