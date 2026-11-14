/* ==========================================================================
   STORE_DATA — for the STORE ACCOUNT pages (not the student pages).

   Include this file on the page where a store owner adds or edits things:
       <script src="../student/assets/js/store-data.js"></script>
   then call, for example:
       const s = STORE_DATA.saveStore({ name: 'Ate Lyn Rice Meals', location: '2nd Floor, Canteen Hall',
                                        contact: '0918 222 3344', open: '10:00', close: '15:00' });
       STORE_DATA.saveProduct({ storeId: s.id, name: 'Chicken Adobo Meal', price: 65,
                                category: 'Meals', description: 'Rice, adobo and vegetables.', stock: 50 });
       STORE_DATA.setAvailability(productId, false);     // sold out

   Students see the change right away, even if their page is open in another tab.
   Pass an id to update an existing store/product; leave it out to add a new one.
   ========================================================================== */

const STORE_DATA = (() => {
    const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
    const write = (key, list) => localStorage.setItem(key, JSON.stringify(list));
    const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

    function upsert(key, prefix, data) {
        const list = read(key);
        const record = { ...data, id: data.id || newId(prefix) };
        const i = list.findIndex((x) => x.id === record.id);
        if (i >= 0) list[i] = { ...list[i], ...record }; else list.push(record);
        write(key, list);
        return record;
    }

    return {
        saveStore: (store) => upsert('casiaStores', 's', store),
        saveProduct: (product) => upsert('casiaProducts', 'p', product),
        setAvailability(productId, available, stock) {
            const list = read('casiaProducts');
            const p = list.find((x) => x.id === productId);
            if (!p) return false;
            p.available = available;
            if (stock !== undefined) p.stock = stock;
            write('casiaProducts', list);
            return true;
        },
        // removing a store also removes its products
        removeStore(id) {
            write('casiaStores', read('casiaStores').filter((s) => s.id !== id));
            write('casiaProducts', read('casiaProducts').filter((p) => p.storeId !== id));
        },
        removeProduct: (id) => write('casiaProducts', read('casiaProducts').filter((p) => p.id !== id)),
        stores: () => read('casiaStores'),
        products: () => read('casiaProducts')
    };
})();
