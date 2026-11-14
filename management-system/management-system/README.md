# Store Manager (Modules 4, 5 and 6)

Inventory Management, Restocking Management, and Sales & Customer Analytics.
Plain HTML, CSS, JavaScript, Chart.js and LocalStorage. No frameworks, no build step.

## Run in Visual Studio Code
1. Unzip this folder.
2. In VS Code choose File > Open Folder and pick `management-system`.
3. When VS Code suggests the "Live Server" extension, click Install
   (or install it from the Extensions panel).
4. Right-click `index.html` > "Open with Live Server".
   The site opens at http://127.0.0.1:5500.

You can also just double-click `index.html`. Internet is needed the first time
because Chart.js and the fonts load from a CDN.

## Files for each module
| Module | HTML | CSS | JavaScript |
|---|---|---|---|
| Dashboard | index.html | css/style.css | js/app.js |
| Inventory | modules/inventory.html | css/inventory.css | js/inventory.js |
| Restocking | modules/restocking.html | css/restocking.css | js/restocking.js |
| Sales & Analytics | modules/sales-analytics.html | css/sales-analytics.css | js/sales-analytics.js |

Shared by every page: `css/style.css` (layout and common styles),
`js/storage.js` (saved data and stock rules), `js/app.js` (sidebar, modal, charts).

## Notes
- The system starts empty. Add products, suppliers, restocks and sales yourself.
- Data is saved in the browser's LocalStorage. Use "Clear all data" (top bar) to erase it.
