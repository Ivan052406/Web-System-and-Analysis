
const API_URL = "/api";

let products = [];
let categories = [];
let activeCategory = "all";
let searchText = "";
let order = {};
let orderChart = null;
const isStaffSalesPage = document.body.dataset.accessRole === "staff";

document.addEventListener("DOMContentLoaded", async () => {
    if (isStaffSalesPage) {
        const authorized = await verifyStaffSession();
        if (!authorized) return;
        initializeStaffLogout();
    }

    const addForm = document.getElementById("addProductForm");
    const popup = document.getElementById("addProductPopup");
    const showAddProduct = document.getElementById("showAddProduct");

    if (showAddProduct && popup) {
        showAddProduct.addEventListener("click", () => { popup.style.display = "flex"; });
    }
    document.getElementById("cancelAddProduct")?.addEventListener("click", closePopup);
    document.getElementById("closeAddProduct")?.addEventListener("click", closePopup);
    popup?.addEventListener("click", event => {
        if (event.target === popup) closePopup();
    });

    document.getElementById("productSearch").addEventListener("input", event => {
        searchText = event.target.value.trim().toLowerCase();
        renderProducts();
    });

    document.getElementById("categoryFilters").addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;

        activeCategory = button.dataset.category;

        document.querySelectorAll(".category-button").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderProducts();
    });

    if (isStaffSalesPage) {
        document.getElementById("clearOrder")?.addEventListener("click", () => {
            order = {};
            renderOrder();
        });
        document.getElementById("completeSale")?.addEventListener("click", completeSale);
    } else {
        addForm?.addEventListener("submit", addProduct);
    }

    await loadCategories();
    await loadProducts();
    renderOrder();
});

async function verifyStaffSession() {
    const workspace = document.getElementById("staffWorkspace");
    try {
        const response = await fetch(`${API_URL}/staff/me`, {
            credentials: "same-origin",
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success !== true || result.user?.role !== "staff") {
            window.location.replace("/student/pages/login.html?role=staff");
            return false;
        }

        const name = document.getElementById("staffName");
        const business = document.getElementById("staffBusinessName");
        if (name) name.textContent = result.user.name || "Staff Cashier";
        if (business) business.textContent = `${result.user.business_name || "Business"} · ${result.user.branch_name || "Branch"}`;
        document.body.classList.add("staff-authorized");
        if (workspace) workspace.setAttribute("aria-hidden", "false");
        return true;
    } catch (error) {
        console.error("Staff session verification failed:", error);
        const message = document.getElementById("staffAccessMessage");
        if (message) message.textContent = "Unable to verify your staff session. Please confirm the CASIA server is running and sign in again.";
        return false;
    }
}

function initializeStaffLogout() {
    const button = document.getElementById("staffLogoutBtn");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = "Signing out...";
        try {
            await fetch("/api/staff/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Accept": "application/json" }
            });
        } catch (error) {
            console.warn("Staff sign-out request failed:", error);
        } finally {
            try { localStorage.removeItem("casiaSession"); } catch (_) {}
            // Keep the remembered email; the checkbox controls whether it is saved.
            window.location.replace("/student/pages/login.html?role=staff");
        }
    });
}

async function completeSale() {
    const button = document.getElementById("completeSale");
    const items = Object.values(order);

    if (!items.length) {
        alert("Please add at least one product to the order.");
        return;
    }

    const total = currentOrderTotal();
    const cashGiven = getCashTendered();
    if (cashGiven !== null && cashGiven < total) {
        showToast(`Cash received is less than the total (${formatCurrency(total)}).`, "error");
        return;
    }
    const snapshot = items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price }));

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Processing...";

    try {
        const result = await apiFetch(`${API_URL}/sales/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: items.map((item) => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            })
        });

        order = {};
        const cashInput = document.getElementById("cashTendered");
        if (cashInput) cashInput.value = "";
        renderOrder();
        await loadProducts();
        openReceipt({
            saleId: result.sale_id,
            items: snapshot,
            total,
            cash: cashGiven,
            change: cashGiven === null ? null : Math.max(0, cashGiven - total)
        });
        showToast(`Sale #${result.sale_id} completed.`, "success");
    } catch (error) {
        console.error("Complete sale error:", error);
        showToast(error.message || "The sale could not be completed. Please refresh stock and try again.", "error");
        // Refresh live inventory so the cart can be corrected after a stock conflict.
        await loadProducts();
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function closePopup() {
    const popup = document.getElementById("addProductPopup");
    if (popup) popup.style.display = "none";
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            "Accept": "application/json",
            ...(options.headers || {})
        }
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || `Request failed (${response.status}).`);
    }

    return result;
}

async function loadCategories() {
    const select = document.getElementById("category");

    try {
        categories = await apiFetch(`${API_URL}/categories`);

        if (select) {
            select.replaceChildren();
            if (categories.length === 0) {
                select.add(new Option("No categories available", ""));
                select.disabled = true;
            } else {
                select.disabled = false;
                select.add(new Option("Select a category", ""));
                categories.forEach(category => {
                    select.add(new Option(category.category_name, String(category.category_id)));
                });
            }
        }
        renderCategoryFilters();
    } catch (error) {
        console.error("Error loading categories:", error);
        if (select) {
            select.replaceChildren(new Option("Could not load categories", ""));
            select.disabled = true;
        }
    }
}

function renderCategoryFilters() {
    const container = document.getElementById("categoryFilters");
    container.replaceChildren();

    const allButton = createCategoryButton("all", "All");
    allButton.classList.add("active");
    container.appendChild(allButton);

    categories.forEach(category => {
        container.appendChild(
            createCategoryButton(
                String(category.category_id),
                category.category_name
            )
        );
    });
}

function createCategoryButton(value, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = value;
    button.textContent = label;
    return button;
}

async function loadProducts() {
    const container = document.getElementById("productList");
    container.textContent = "Loading products...";

    try {
        products = await apiFetch(`${API_URL}/data`);

        // Remove deleted products from the current order.
        const existingIds = new Set(products.map(p => String(p.product_id)));

        Object.keys(order).forEach(id => {
            if (!existingIds.has(id)) delete order[id];
        });

        renderProducts();
        renderOrder();
    } catch (error) {
        console.error("Error loading products:", error);
        container.textContent = "Unable to load products. Check the server.";
    }
}

function renderProducts() {
    const container = document.getElementById("productList");
    container.replaceChildren();

    const filtered = products.filter(product => {
        const matchesSearch =
            String(product.product_name).toLowerCase().includes(searchText) ||
            String(product.category_name || "").toLowerCase().includes(searchText);

        const matchesCategory =
            activeCategory === "all" ||
            String(product.category_id) === activeCategory;

        return matchesSearch && matchesCategory;
    });

    document.getElementById("productCount").textContent =
        `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
        container.textContent = products.length
            ? "No products match your search."
            : (isStaffSalesPage ? "No active products are available for sales." : "No products added yet. Use Add Product to get started.");
        container.className = "product-grid";
        return;
    }

    filtered.forEach(product => {
        const stock = Number(product.quantity) || 0;
        const minimum = Number(product.minimum_stock) || 0;
        const price = Number(product.price) || 0;

        const card = document.createElement("article");
        card.className = "product-card";

        const top = document.createElement("div");
        top.className = "product-card-top";

        const emoji = document.createElement("span");
        emoji.className = "product-icon";
        emoji.textContent = getProductEmoji(product.category_name);

        const stockLabel = document.createElement("span");
        stockLabel.className = "stock-label";

        if (stock <= 0) {
            stockLabel.textContent = "Out of stock";
            stockLabel.classList.add("out");
        } else if (stock <= minimum) {
            stockLabel.textContent = `Low stock: ${stock}`;
            stockLabel.classList.add("low");
        } else {
            stockLabel.textContent = `Stock: ${stock}`;
        }

        top.append(emoji, stockLabel);

        const name = document.createElement("h3");
        name.className = "product-name";
        name.textContent = product.product_name;

        const category = document.createElement("div");
        category.className = "product-category";
        category.textContent = product.category_name || "Uncategorized";

        const priceLabel = document.createElement("div");
        priceLabel.className = "product-price";
        priceLabel.textContent = formatCurrency(price);

        const actions = document.createElement("div");
        actions.className = "product-card-actions";

        if (isStaffSalesPage) {
            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "add-order-button";
            addButton.textContent = stock > 0 ? "+ Add to Order" : "Out of Stock";
            addButton.disabled = stock <= 0 || String(product.status).toLowerCase() !== "active";
            addButton.addEventListener("click", () => addToOrder(product));
            actions.append(addButton);
        } else {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-product-btn";
            deleteButton.textContent = "Delete Product";
            deleteButton.addEventListener("click", () => deleteProduct(product));
            actions.append(deleteButton);
        }
        card.append(top, name, category, priceLabel, actions);
        container.appendChild(card);
    });
}

function getProductEmoji(categoryName = "") {
    const category = categoryName.toLowerCase();

    if (category.includes("drink")) return "🥤";
    if (category.includes("food") || category.includes("meal")) return "🍱";
    if (category.includes("snack")) return "🍟";
    if (category.includes("dessert")) return "🍰";

    return "🛍️";
}

function addToOrder(product) {
    const id = String(product.product_id);
    const stock = Number(product.quantity) || 0;

    if (String(product.status).toLowerCase() !== "active") {
        alert("This product is inactive.");
        return;
    }

    if (stock < 1) {
        alert("This product is out of stock.");
        return;
    }

    const currentQuantity = order[id]?.quantity || 0;

    if (currentQuantity >= stock) {
        alert("The order quantity cannot exceed available stock.");
        return;
    }

    order[id] = {
        product_id: product.product_id,
        name: product.product_name,
        price: Number(product.price),
        quantity: currentQuantity + 1,
        stock
    };

    renderOrder();
}

function changeOrderQuantity(id, change) {
    const item = order[id];
    if (!item) return;

    const nextQuantity = item.quantity + change;

    if (nextQuantity <= 0) {
        delete order[id];
    } else if (nextQuantity > item.stock) {
        alert("The order quantity cannot exceed available stock.");
        return;
    } else {
        item.quantity = nextQuantity;
    }

    renderOrder();
}

function renderOrder() {
    const container = document.getElementById("currentOrder");
    if (!container) return;
    container.replaceChildren();

    const items = Object.values(order);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    document.getElementById("orderCount").textContent =
        `${totalQuantity} item${totalQuantity === 1 ? "" : "s"}`;

    document.getElementById("orderItems").textContent = totalQuantity;
    document.getElementById("orderTotal").textContent = formatCurrency(total);
    updateChangeDue(total);

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-order";

        const icon = document.createElement("span");
        icon.className = "empty-icon";
        icon.textContent = "🛒";

        const message = document.createElement("p");
        message.textContent = "Your order is empty";

        const hint = document.createElement("small");
        hint.textContent = "Select a product to get started.";

        empty.append(icon, message, hint);
        container.appendChild(empty);
    } else {
        items.forEach(item => {
            const row = document.createElement("div");
            row.className = "order-row";

            const info = document.createElement("div");

            const name = document.createElement("div");
            name.className = "order-product-name";
            name.textContent = item.name;

            const linePrice = document.createElement("div");
            linePrice.className = "order-line-price";
            linePrice.textContent =
                `${formatCurrency(item.price)} each · ` +
                `${formatCurrency(item.price * item.quantity)} total`;

            const controls = document.createElement("div");
            controls.className = "order-controls";

            const minus = document.createElement("button");
            minus.type = "button";
            minus.className = "quantity-button";
            minus.textContent = "−";
            minus.setAttribute("aria-label", `Decrease ${item.name} quantity`);
            minus.addEventListener("click", () =>
                changeOrderQuantity(String(item.product_id), -1)
            );

            const quantity = document.createElement("span");
            quantity.className = "quantity-value";
            quantity.textContent = item.quantity;

            const plus = document.createElement("button");
            plus.type = "button";
            plus.className = "quantity-button";
            plus.textContent = "+";
            plus.setAttribute("aria-label", `Increase ${item.name} quantity`);
            plus.disabled = item.quantity >= item.stock;
            plus.addEventListener("click", () =>
                changeOrderQuantity(String(item.product_id), 1)
            );

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-order-item";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                delete order[String(item.product_id)];
                renderOrder();
            });

            controls.append(minus, quantity, plus, remove);
            info.append(name, linePrice, controls);

            row.append(info);
            container.appendChild(row);
        });
    }

    updateOrderChart(items);
}

function updateOrderChart(items) {
    const canvas = document.getElementById("orderChart");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = items.map(item => item.name);
    const quantities = items.map(item => item.quantity);

    if (orderChart) {
        orderChart.data.labels = labels;
        orderChart.data.datasets[0].data = quantities;
        orderChart.update();
        return;
    }

    orderChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Order Quantity",
                data: quantities,
                backgroundColor: "#3485ed",
                borderRadius: 6,
                maxBarThickness: 44
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

async function addProduct(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');

    const name = document.getElementById("productName").value.trim();
    const categoryId = Number(document.getElementById("category").value);
    const price = Number(document.getElementById("productPrice").value);
    if (
        !name ||
        !Number.isInteger(categoryId) || categoryId < 1 ||
        !Number.isFinite(price) || price < 0
    ) {
        alert("Enter a valid name, category, and price.");
        return;
    }

    button.disabled = true;

    try {
        const result = await apiFetch(`${API_URL}/addProduct`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category_id: categoryId,
                product_name: name,
                price
            })
        });

        alert(result.message || "Product added successfully!");
        form.reset();
        closePopup();
        await loadProducts();
    } catch (error) {
        console.error("Add product error:", error);
        alert(error.message || "Could not add the product.");
    } finally {
        button.disabled = false;
    }
}

async function deleteProduct(product) {
    if (!confirm(`Are you sure you want to delete "${product.product_name}"?`)) {
        return;
    }

    try {
        const result = await apiFetch(
            `${API_URL}/products/${product.product_id}`,
            { method: "DELETE" }
        );

        // Remove it from the displayed order too.
        delete order[String(product.product_id)];

        alert(result.message || "Product deleted.");
        await loadProducts();
    } catch (error) {
        console.error("Delete product error:", error);
        alert(error.message || "Could not delete the product.");
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(amount);
}

/* ---------- Checkout helpers: payment, receipt, toast ---------- */

function currentOrderTotal() {
    return Object.values(order).reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCashTendered() {
    const input = document.getElementById("cashTendered");
    if (!input || input.value === "") return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
}

function updateChangeDue(total) {
    const changeEl = document.getElementById("changeDue");
    if (!changeEl) return;
    const cash = getCashTendered();
    changeEl.textContent = cash === null ? formatCurrency(0) : formatCurrency(Math.max(0, cash - total));
}

function showToast(message, type = "success") {
    let stack = document.getElementById("toastStack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "toastStack";
        stack.className = "toast-stack";
        stack.setAttribute("role", "status");
        stack.setAttribute("aria-live", "polite");
        document.body.appendChild(stack);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.classList.add("toast-hide"), 3200);
    setTimeout(() => toast.remove(), 3600);
}

function openReceipt({ saleId, items, total, cash, change }) {
    const modal = document.getElementById("receiptModal");
    if (!modal) return;

    const business = document.getElementById("staffBusinessName")?.textContent || "CASIA";
    document.getElementById("receiptBusiness").textContent = business;
    document.getElementById("receiptMeta").textContent =
        `Transaction #${saleId} · ${new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`;

    const lines = document.getElementById("receiptLines");
    lines.replaceChildren();
    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "receipt-line";
        const name = document.createElement("span");
        name.textContent = `${item.quantity} x ${item.name}`;
        const amount = document.createElement("strong");
        amount.textContent = formatCurrency(item.price * item.quantity);
        row.append(name, amount);
        lines.appendChild(row);
    });

    document.getElementById("receiptTotal").textContent = formatCurrency(total);
    const hasCash = cash !== null;
    document.getElementById("receiptTenderedRow").hidden = !hasCash;
    document.getElementById("receiptChangeRow").hidden = !hasCash;
    if (hasCash) {
        document.getElementById("receiptTendered").textContent = formatCurrency(cash);
        document.getElementById("receiptChange").textContent = formatCurrency(change);
    }

    modal.hidden = false;
    document.getElementById("printReceipt")?.focus();
}

function closeReceipt() {
    const modal = document.getElementById("receiptModal");
    if (modal) modal.hidden = true;
}

document.getElementById("cashTendered")?.addEventListener("input", () => updateChangeDue(currentOrderTotal()));
document.getElementById("printReceipt")?.addEventListener("click", () => window.print());
document.getElementById("closeReceipt")?.addEventListener("click", closeReceipt);
document.getElementById("receiptModal")?.addEventListener("click", event => {
    if (event.target.id === "receiptModal") closeReceipt();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeReceipt();
});
