# CASIA student pages

The student interface uses these sources:

- **Stores and products:** loaded from the authenticated Express endpoint `GET /api/student/catalog`, backed by Supabase PostgreSQL (`businesses`, `products`, `categories`, and `inventory`).
- **Student authentication:** the Supabase session is held in the server-managed cookie. The `casiaSession` localStorage value is only used to display the signed-in student's name in the interface; it is not an authentication credential.
- **Favorites, ratings, reviews, helpful votes, search history, viewed items, and availability watch list:** currently saved in browser localStorage, separated by the signed-in email. They do not synchronize to another browser or device and are not tamper-resistant.

Every student page loads `../js/data.js`, then `../js/shell.js`, then its page-specific script from `frontend/student/pages/`. The shell refreshes the catalog after page load and triggers the page's `DB.onChange` listener when the server data arrives.

## Required database setup

Run the three SQL files in the order shown in the root `docs/DATABASE_SETUP.md`. The role migration must be applied before newly registered User accounts can be saved with role `student`.

## Catalog fields

The API returns the store fields available in the current database: name, address/location, contact, and email. The current business schema does not contain opening hours or descriptions, so those details appear as not listed/blank. Product descriptions are also not currently stored in the backend product table.

The old `frontend/student/js/store-data.js` file is a legacy localStorage helper. It is not loaded by the active student pages; use the backend product/inventory management pages and API for real catalog changes.
