
/* CASIA INVENTORY MANAGEMENT FRONTEND */

const API_BASE = "/api/inventory";

let inventoryProducts = [];
let stockChart = null;
let statusChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    bindInventoryEvents();

    await loadInventory();
    await loadHistory();
});

// API request helper

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.headers || {})
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || "The request could not be completed."
        );
    }

    return result;
}

// Display messages

function showInventoryMessage(message, type = "success") {
    const element = document.getElementById("inventoryMessage");

    element.textContent = message;
    element.className = "inventory-message " + type;

    window.clearTimeout(element.hideTimer);

    element.hideTimer = window.setTimeout(() => {
        element.className = "inventory-message";
        element.textContent = "";
    }, 4500);
}

// Bind events

function bindInventoryEvents() {
    document.getElementById("refreshInventory")
        .addEventListener("click", refreshAll);

    document.getElementById("inventorySearch")
        .addEventListener("input", renderInventoryTable);

    document.getElementById("stockFilter")
        .addEventListener("change", renderInventoryTable);

    document.getElementById("openStockIn")
        .addEventListener("click", () => {
            populateProductSelect("stockInProduct");
            openModal("stockInModal");
        });

    document.getElementById("openAdjustment")
        .addEventListener("click", () => {
            populateProductSelect("adjustProduct");
            openModal("adjustmentModal");
        });

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

    document.querySelectorAll(".inventory-modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    document.getElementById("stockInForm")
        .addEventListener("submit", submitStockIn);

    document.getElementById("adjustmentForm")
        .addEventListener("submit", submitAdjustment);

    document.getElementById("minimumStockForm")
        .addEventListener("submit", submitMinimumStock);
}

// Refresh all inventory information

async function refreshAll() {
    await loadInventory();
    await loadHistory();
}

// Load products and inventory summary

async function loadInventory() {
    const tableBody = document.getElementById("inventoryTableBody");

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-empty">
                Loading inventory...
            </td>
        </tr>
    `;

    try {
        const result = await apiRequest(API_BASE);

        inventoryProducts = result.products || [];

        renderSummary(result.summary || {});
        renderInventoryTable();
        renderCharts();

    } catch (error) {
        console.error("Load inventory:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showInventoryMessage(error.message, "error");
    }
}

// Render the summary cards

function renderSummary(summary) {
    document.getElementById("totalProducts").textContent =
        Number(summary.total_products || 0).toLocaleString();

    document.getElementById("availableProducts").textContent =
        Number(summary.available_products || 0).toLocaleString();

    document.getElementById("lowStockProducts").textContent =
        Number(summary.low_stock_products || 0).toLocaleString();

    document.getElementById("outOfStockProducts").textContent =
        Number(summary.out_of_stock_products || 0).toLocaleString();
}

// Get readable stock status

function getStockStatus(quantity, minimumStock) {
    if (quantity <= 0) {
        return {
            text: "Out of Stock",
            className: "out"
        };
    }

    if (quantity <= minimumStock) {
        return {
            text: "Low Stock",
            className: "low"
        };
    }

    return {
        text: "Available",
        className: "available"
    };
}

// Render inventory table

function renderInventoryTable() {
    const body = document.getElementById("inventoryTableBody");

    const search = document.getElementById("inventorySearch")
        .value.trim().toLowerCase();

    const filter = document.getElementById("stockFilter").value;

    const filtered = inventoryProducts.filter(product => {
        const name = String(product.product_name || "").toLowerCase();
        const category = String(product.category_name || "").toLowerCase();

        const matchesSearch =
            name.includes(search) || category.includes(search);

        const matchesFilter =
            filter === "all" ||
            product.stock_status === filter;

        return matchesSearch && matchesFilter;
    });

    if (!filtered.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    No inventory products found.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = filtered.map(product => {
        const quantity = Number(product.current_stock) || 0;
        const minimum = Number(product.minimum_stock) || 0;

        const status = getStockStatus(quantity, minimum);

        const updated = product.updated_at
            ? new Date(product.updated_at).toLocaleString()
            : "Not recorded";

        return `
            <tr>
                <td class="product-cell">
                    ${escapeHTML(product.product_name)}
                </td>

                <td>
                    ${escapeHTML(product.category_name || "Uncategorized")}
                </td>

                <td class="stock-number">
                    ${quantity.toLocaleString()}
                </td>

                <td>
                    ${minimum.toLocaleString()}
                </td>

                <td>
                    <span class="stock-status ${status.className}">
                        ${status.text}
                    </span>
                </td>

                <td>${escapeHTML(updated)}</td>

                <td>
                    <button
                        type="button"
                        class="table-action"
                        data-minimum-stock="${product.product_id}">
                        Set Minimum
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll("[data-minimum-stock]").forEach(button => {
        button.addEventListener("click", () => {
            openMinimumStock(
                Number(button.dataset.minimumStock)
            );
        });
    });
}

// Render stock charts

function renderCharts() {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is unavailable.");
        return;
    }

    if (stockChart) stockChart.destroy();
    if (statusChart) statusChart.destroy();

    const labels = inventoryProducts.map(
        product => product.product_name
    );

    const stockValues = inventoryProducts.map(
        product => Number(product.current_stock) || 0
    );

    stockChart = new Chart(
        document.getElementById("stockChart"),
        {
            type: "bar",

            data: {
                labels,
                datasets: [{
                    label: "Current Stock",
                    data: stockValues,
                    backgroundColor: "#80542e",
                    borderRadius: 5,
                    maxBarThickness: 45
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    },

                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        }
    );

    const available = inventoryProducts.filter(
        p => p.stock_status === "available"
    ).length;

    const low = inventoryProducts.filter(
        p => p.stock_status === "low"
    ).length;

    const out = inventoryProducts.filter(
        p => p.stock_status === "out"
    ).length;

    statusChart = new Chart(
        document.getElementById("inventoryStatusChart"),
        {
            type: "doughnut",

            data: {
                labels: [
                    "Available",
                    "Low Stock",
                    "Out of Stock"
                ],

                datasets: [{
                    data: [available, low, out],
                    backgroundColor: [
                        "#43885c",
                        "#e3aa4d",
                        "#d75d5d"
                    ],
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "66%",

                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );
}

// Populate product dropdowns

function populateProductSelect(selectId) {
    const select = document.getElementById(selectId);

    select.replaceChildren(
        new Option("Select product", "")
    );

    inventoryProducts.forEach(product => {
        const option = new Option(
            product.product_name,
            String(product.product_id)
        );

        select.add(option);
    });
}

// Stock-in submission

async function submitStockIn(event) {
    event.preventDefault();

    const productId = Number(
        document.getElementById("stockInProduct").value
    );

    const quantity = Number(
        document.getElementById("stockInQuantity").value
    );

    const reason = document.getElementById("stockInReason")
        .value.trim();

    const button = document.getElementById("submitStockIn");

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        !reason
    ) {
        showInventoryMessage(
            "Enter a valid product, quantity, and reason.",
            "error"
        );

        return;
    }

    button.disabled = true;

    try {
        const result = await apiRequest(
            `${API_BASE}/stock-in`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    product_id: productId,
                    quantity,
                    reason
                })
            }
        );

        closeModal("stockInModal");
        document.getElementById("stockInForm").reset();

        showInventoryMessage(result.message);

        await refreshAll();

    } catch (error) {
        showInventoryMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

// Stock adjustment submission

async function submitAdjustment(event) {
    event.preventDefault();

    const productId = Number(
        document.getElementById("adjustProduct").value
    );

    const countedStock = Number(
        document.getElementById("countedStock").value
    );

    const reason = document.getElementById("adjustmentReason")
        .value.trim();

    const button = document.getElementById("submitAdjustment");

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(countedStock) ||
        countedStock < 0 ||
        !reason
    ) {
        showInventoryMessage(
            "Enter a valid product, counted stock, and reason.",
            "error"
        );

        return;
    }

    button.disabled = true;

    try {
        const result = await apiRequest(
            `${API_BASE}/adjustment`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    product_id: productId,
                    counted_stock: countedStock,
                    reason
                })
            }
        );

        closeModal("adjustmentModal");
        document.getElementById("adjustmentForm").reset();

        showInventoryMessage(result.message);

        await refreshAll();

    } catch (error) {
        showInventoryMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

// Open minimum stock form

function openMinimumStock(productId) {
    const product = inventoryProducts.find(
        p => Number(p.product_id) === productId
    );

    if (!product) return;

    document.getElementById("minimumStockProductId").value =
        productId;

    document.getElementById("minimumStockValue").value =
        Number(product.minimum_stock) || 0;

    openModal("minimumStockModal");
}

// Save minimum stock

async function submitMinimumStock(event) {
    event.preventDefault();

    const productId = Number(
        document.getElementById("minimumStockProductId").value
    );

    const minimumStock = Number(
        document.getElementById("minimumStockValue").value
    );

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(minimumStock) ||
        minimumStock < 0
    ) {
        showInventoryMessage(
            "Enter a valid minimum stock quantity.",
            "error"
        );

        return;
    }

    try {
        const result = await apiRequest(
            `${API_BASE}/${productId}/minimum-stock`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    minimum_stock: minimumStock
                })
            }
        );

        closeModal("minimumStockModal");

        showInventoryMessage(result.message);

        await loadInventory();

    } catch (error) {
        showInventoryMessage(error.message, "error");
    }
}

// Load inventory history

async function loadHistory() {
    const body = document.getElementById("historyTableBody");

    try {
        const result = await apiRequest(`${API_BASE}/history`);

        const history = result.history || [];

        if (!history.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty">
                        No inventory history recorded yet.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = history.map(item => {
            const change = Number(item.quantity_change) || 0;

            const changeClass = change > 0
                ? "quantity-positive"
                : "quantity-negative";

            const changeText = change > 0
                ? `+${change}`
                : String(change);

            return `
                <tr>
                    <td>
                        ${new Date(item.created_at).toLocaleString()}
                    </td>

                    <td class="product-cell">
                        ${escapeHTML(item.product_name)}
                    </td>

                    <td>
                        ${escapeHTML(item.change_type)}
                    </td>

                    <td>${Number(item.quantity_before)}</td>

                    <td>${Number(item.quantity_after)}</td>

                    <td class="${changeClass}">
                        ${changeText}
                    </td>

                    <td>
                        ${escapeHTML(item.performed_by || "System")}
                    </td>

                    <td>
                        ${escapeHTML(item.reason || "—")}
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Inventory history:", error.message);

        body.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    Unable to load inventory history.
                </td>
            </tr>
        `;
    }
}

// Dialog helpers

function openModal(id) {
    document.getElementById(id).classList.add("show");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("show");
}

// Escape values before inserting database text into HTML

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );
}
