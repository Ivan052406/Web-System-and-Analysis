
/* CASIA RESTOCKING MANAGEMENT FRONTEND */

const RESTOCK_API = "/api/restocking";

let restockData = {
    products: [],
    suppliers: [],
    history: []
};

let productRestockChart = null;
let restockTrendChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    bindRestockingEvents();
    await loadRestockingDashboard();
});

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || "The request could not be completed."
        );
    }

    return result;
}

function showMessage(message, type = "success") {
    const element = document.getElementById("restockingMessage");

    element.textContent = message;
    element.className = "restocking-message " + type;

    clearTimeout(element.hideTimer);

    element.hideTimer = setTimeout(() => {
        element.className = "restocking-message";
        element.textContent = "";
    }, 4500);
}

function bindRestockingEvents() {
    document.getElementById("refreshRestocking")
        .addEventListener("click", loadRestockingDashboard);

    document.getElementById("restockPeriod")
        .addEventListener("change", loadRestockingDashboard);

    document.getElementById("addSupplierButton")
        .addEventListener("click", openAddSupplier);

    document.getElementById("recordRestockButton")
        .addEventListener("click", openRecordRestock);

    document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

    document.querySelectorAll(".restock-modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    document.getElementById("supplierForm")
        .addEventListener("submit", saveSupplier);

    document.getElementById("recordRestockForm")
        .addEventListener("submit", saveRestock);

    document.getElementById("restockProduct")
        .addEventListener("change", showCurrentProductStock);

    document.getElementById("supplierTableBody")
        .addEventListener("click", handleSupplierTableClick);
}

async function loadRestockingDashboard() {
    const days = document.getElementById("restockPeriod").value;

    try {
        const result = await apiRequest(
            `${RESTOCK_API}/dashboard?days=${encodeURIComponent(days)}`
        );

        restockData = {
            products: result.products || [],
            suppliers: result.suppliers || [],
            history: result.history || []
        };

        renderSummary(result.summary || {});
        renderSuppliers();
        renderRestockHistory();
        renderCharts(result);

    } catch (error) {
        console.error("Restocking dashboard:", error);

        showMessage(error.message, "error");

        document.getElementById("supplierTableBody").innerHTML =
            `<tr><td colspan="5" class="table-empty">Unable to load suppliers.</td></tr>`;

        document.getElementById("restockTableBody").innerHTML =
            `<tr><td colspan="7" class="table-empty">Unable to load restocking records.</td></tr>`;
    }
}

function renderSummary(summary) {
    document.getElementById("totalRestocks").textContent =
        Number(summary.total_restocks || 0).toLocaleString();

    document.getElementById("totalUnits").textContent =
        Number(summary.total_units || 0).toLocaleString();

    document.getElementById("productsRestocked").textContent =
        Number(summary.products_restocked || 0).toLocaleString();

    document.getElementById("suppliersUsed").textContent =
        Number(summary.suppliers_used || 0).toLocaleString();
}

function renderSuppliers() {
    const body = document.getElementById("supplierTableBody");

    if (!restockData.suppliers.length) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">
                    No suppliers added yet.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = restockData.suppliers.map(supplier => `
        <tr>
            <td class="supplier-name">
                ${escapeHTML(supplier.supplier_name)}
            </td>

            <td>
                ${escapeHTML(supplier.contact_number || "—")}
            </td>

            <td>
                ${escapeHTML(supplier.address || "—")}
            </td>

            <td>
                <span class="supplier-status ${supplier.status}">
                    ${supplier.status === "active" ? "Active" : "Inactive"}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="table-action"
                    data-edit-supplier="${supplier.supplier_id}">
                    Edit
                </button>
            </td>
        </tr>
    `).join("");
}

function handleSupplierTableClick(event) {
    const button = event.target.closest("[data-edit-supplier]");
    if (!button) return;

    const supplierId = Number(button.dataset.editSupplier);

    const supplier = restockData.suppliers.find(
        item => Number(item.supplier_id) === supplierId
    );

    if (supplier) openEditSupplier(supplier);
}

function openAddSupplier() {
    document.getElementById("supplierForm").reset();

    document.getElementById("supplierId").value = "";
    document.getElementById("supplierModalTitle").textContent =
        "Add Supplier";

    document.getElementById("supplierStatusField").classList.add("hidden-field");

    openModal("supplierModal");
}

function openEditSupplier(supplier) {
    document.getElementById("supplierId").value = supplier.supplier_id;
    document.getElementById("supplierName").value = supplier.supplier_name;
    document.getElementById("supplierContact").value =
        supplier.contact_number || "";
    document.getElementById("supplierAddress").value =
        supplier.address || "";
    document.getElementById("supplierStatus").value = supplier.status;

    document.getElementById("supplierModalTitle").textContent =
        "Edit Supplier";

    document.getElementById("supplierStatusField").classList.remove("hidden-field");

    openModal("supplierModal");
}

async function saveSupplier(event) {
    event.preventDefault();

    const supplierId = document.getElementById("supplierId").value;

    const payload = {
        supplier_name: document.getElementById("supplierName").value.trim(),
        contact_number: document.getElementById("supplierContact").value.trim(),
        address: document.getElementById("supplierAddress").value.trim()
    };

    const button = document.getElementById("saveSupplierButton");
    button.disabled = true;

    try {
        let result;

        if (supplierId) {
            payload.status = document.getElementById("supplierStatus").value;

            result = await apiRequest(
                `${RESTOCK_API}/suppliers/${encodeURIComponent(supplierId)}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }
            );
        } else {
            result = await apiRequest(
                `${RESTOCK_API}/suppliers`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }
            );
        }

        closeModal("supplierModal");
        showMessage(result.message);

        await loadRestockingDashboard();

    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

function openRecordRestock() {
    const activeSuppliers = restockData.suppliers.filter(
        supplier => supplier.status === "active"
    );

    if (!activeSuppliers.length) {
        showMessage("Add or activate a supplier before recording a delivery.", "error");
        return;
    }

    if (!restockData.products.length) {
        showMessage("Add an active product before recording a delivery.", "error");
        return;
    }

    const supplierSelect = document.getElementById("restockSupplier");
    const productSelect = document.getElementById("restockProduct");

    supplierSelect.replaceChildren(new Option("Select supplier", ""));
    productSelect.replaceChildren(new Option("Select product", ""));

    activeSuppliers.forEach(supplier => {
        supplierSelect.add(
            new Option(supplier.supplier_name, String(supplier.supplier_id))
        );
    });

    restockData.products.forEach(product => {
        productSelect.add(
            new Option(product.product_name, String(product.product_id))
        );
    });

    document.getElementById("recordRestockForm").reset();
    document.getElementById("currentStockInfo").textContent =
        "Select a product to view its current stock.";

    openModal("recordRestockModal");
}

function showCurrentProductStock() {
    const productId = Number(
        document.getElementById("restockProduct").value
    );

    const product = restockData.products.find(
        item => Number(item.product_id) === productId
    );

    document.getElementById("currentStockInfo").textContent = product
        ? `Current recorded stock: ${Number(product.current_stock).toLocaleString()} units`
        : "Select a product to view its current stock.";
}

async function saveRestock(event) {
    event.preventDefault();

    const payload = {
        supplier_id: Number(document.getElementById("restockSupplier").value),
        product_id: Number(document.getElementById("restockProduct").value),
        quantity: Number(document.getElementById("restockQuantity").value),
        reference: document.getElementById("restockReference").value.trim()
    };

    if (
        !Number.isSafeInteger(payload.supplier_id) ||
        payload.supplier_id < 1 ||
        !Number.isSafeInteger(payload.product_id) ||
        payload.product_id < 1 ||
        !Number.isSafeInteger(payload.quantity) ||
        payload.quantity < 1
    ) {
        showMessage("Select a supplier and product, then enter a valid quantity.", "error");
        return;
    }

    const button = document.getElementById("saveRestockButton");
    button.disabled = true;

    try {
        const result = await apiRequest(
            `${RESTOCK_API}/record`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }
        );

        closeModal("recordRestockModal");

        document.getElementById("recordRestockForm").reset();

        showMessage(
            `${result.message} New stock: ${Number(result.current_stock).toLocaleString()} units.`
        );

        await loadRestockingDashboard();

    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

function renderRestockHistory() {
    const body = document.getElementById("restockTableBody");

    if (!restockData.history.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    No restocking records yet.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = restockData.history.map(item => `
        <tr>
            <td>#${Number(item.restock_id)}</td>
            <td>${formatDate(item.restock_date)}</td>
            <td>${formatTime(item.restock_time)}</td>
            <td class="supplier-name">${escapeHTML(item.product_name)}</td>
            <td>${escapeHTML(item.supplier_name)}</td>
            <td><strong>+${Number(item.quantity).toLocaleString()}</strong></td>
            <td>${escapeHTML(item.performed_by || "System")}</td>
        </tr>
    `).join("");
}

function renderCharts(result) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is unavailable.");
        return;
    }

    if (productRestockChart) productRestockChart.destroy();
    if (restockTrendChart) restockTrendChart.destroy();

    const productLabels = (result.productChart || []).map(
        item => item.product_name
    );

    const productQuantities = (result.productChart || []).map(
        item => Number(item.total_quantity)
    );

    productRestockChart = new Chart(
        document.getElementById("productRestockChart"),
        {
            type: "bar",

            data: {
                labels: productLabels,

                datasets: [{
                    label: "Quantity Restocked",
                    data: productQuantities,
                    backgroundColor: "#80542e",
                    borderRadius: 5,
                    maxBarThickness: 45
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { display: false }
                },

                scales: {
                    x: {
                        grid: { display: false }
                    },

                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        }
    );

    const trendLabels = (result.trendChart || []).map(
        item => item.label
    );

    const trendValues = (result.trendChart || []).map(
        item => Number(item.quantity)
    );

    restockTrendChart = new Chart(
        document.getElementById("restockTrendChart"),
        {
            type: "line",

            data: {
                labels: trendLabels,

                datasets: [{
                    label: "Units Received",
                    data: trendValues,
                    borderColor: "#80542e",
                    backgroundColor: "rgba(128, 84, 46, 0.13)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { display: false }
                },

                scales: {
                    x: {
                        grid: { display: false }
                    },

                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        }
    );
}

function openModal(id) {
    document.getElementById(id).classList.add("show");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("show");
}

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

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString();
}

function formatTime(value) {
    if (!value) return "—";

    const parts = String(value).split(":");

    if (parts.length < 2) return String(value);

    const date = new Date();
    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}
