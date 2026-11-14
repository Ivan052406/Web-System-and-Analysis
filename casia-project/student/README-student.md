# CASIA student pages (customer side)

Every feature is its own page with its own HTML, CSS and JavaScript:

| Feature | Page | Own files |
|---|---|---|
| Home | `student.html` | `css/student.css`, `js/student.js` |
| Search Store | `search-store.html` | `css/search-store.css`, `js/search-store.js` |
| Store Directory | `store-directory.html` | `css/store-directory.css`, `js/store-directory.js` |
| Product Search | `product-search.html` | `css/product-search.css`, `js/product-search.js` |
| View Store Information | `store-information.html?id=...` | `css/store-information.css`, `js/store-information.js` |
| View Product Details | `product-details.html?id=...` | `css/product-details.css`, `js/product-details.js` |
| Store Ratings | `store-ratings.html` | `css/store-ratings.css`, `js/store-ratings.js` |
| Product Ratings | `product-ratings.html` | `css/product-ratings.css`, `js/product-ratings.js` |
| Reviews / Feedback | `reviews.html` | `css/reviews.css`, `js/reviews.js` |
| Availability Check | `availability.html` | `css/availability.css`, `js/availability.js` |
| Favorites / Bookmarks | `favorites.html` | `css/favorites.css`, `js/favorites.js` |

Shared by all pages (so they always agree with each other):
- `css/base.css`  colors, side navigation, buttons, cards, stars
- `js/data.js`    reads the stores/products and saves what a student does
- `js/shell.js`   builds the side navigation, favorite hearts, small helpers

## Where the stores and products come from
Nothing is made up. The pages show only what the **store accounts** save. A store account
saves into the browser's `localStorage` under two keys: `casiaStores` and `casiaProducts`.

On your store-account page, include the helper and call it:

```html
<script src="../student/assets/js/store-data.js"></script>
<script>
  const store = STORE_DATA.saveStore({
      name: 'Ate Lyn Rice Meals', location: '2nd Floor, Canteen Hall',
      contact: '0918 222 3344', email: 'atelyn@casia.edu',
      open: '10:00', close: '15:00', description: 'Budget rice meals.'
  });
  STORE_DATA.saveProduct({ storeId: store.id, name: 'Chicken Adobo Meal', price: 65,
      category: 'Meals', description: 'Rice and chicken adobo.', stock: 50 });

  STORE_DATA.setAvailability(productId, false);   // sold out -> students see it right away
  STORE_DATA.removeProduct(productId);
  STORE_DATA.removeStore(storeId);                // also removes that store's products
</script>
```
Student pages that are open in another tab update by themselves when a store changes
something (the Availability Check page even tells a student when a product they are
watching is back).

Field names the pages understand (the first one is the main name):
- store:   `id`, `name`, `location` (or `address`), `contact` (or `phone`), `email`, `open`, `close`
           (numbers like 8 and 17, or text like "08:00" and "5:00 PM"), `description`, `area`
- product: `id`, `storeId`, `name`, `category`, `price`, `description`,
           `available` (or `isAvailable`), `stock` (or `quantity`)
- Leave `open`/`close` out and the page says "Hours not listed".
- Set `active: false` on a store/product to hide it.

## If your store accounts save somewhere else
(a server, Firebase, a database...) only `js/data.js` has to change: make `stores()` and
`products()` return the lists above, and every student page keeps working.

## What a student does is saved per student
Ratings, reviews, "helpful" votes, favorites, notes and the watch list are saved under the
signed-in student's email (from the login page), so two students on one computer stay apart.
Student ratings and reviews are in `casiaRatings` and `casiaReviews`, so your store/admin pages
can read them to show owners their ratings.

## Settings (top of `js/shell.js`)
- `LOGIN_URL`      where Log out goes (default `../login/login.html`)
- `REQUIRE_LOGIN`  set to `true` to send anyone who is not signed in to the login page
