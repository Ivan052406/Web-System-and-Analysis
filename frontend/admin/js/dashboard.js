
/* =====================================================
   CASIA MAIN DASHBOARD JAVASCRIPT
   Connects dashboard to the CASIA API
   ===================================================== */

const API_URL = "/api/dashboard";



// INITIALIZE DASHBOARD

// INITIALIZE DASHBOARD
document.addEventListener("DOMContentLoaded", async () => {

    document.addEventListener("casia:navigation-ready", adjustDashboardSpacing, { once: true });

    displayCurrentDate();

    const refreshButton = document.getElementById("refreshDashboard");

    if (refreshButton) {
        refreshButton.addEventListener("click", loadDashboard);
    }

    loadDashboard();
});


// ADJUST DASHBOARD CONTENT TO NAVIGATION WIDTH
function adjustDashboardSpacing() {
    const sidebar = document.querySelector("#nav-placeholder .navbar");

    if (!sidebar) {
        console.error("Shared navigation sidebar not found.");
        return;
    }

    const updateWidth = () => {
        const width = sidebar.getBoundingClientRect().width;

        document.documentElement.style.setProperty(
            "--navigation-width",
            `${width}px`
        );
    };

    updateWidth();

    if (window.dashboardNavObserver) {
        window.dashboardNavObserver.disconnect();
    }

    window.dashboardNavObserver = new ResizeObserver(updateWidth);
    window.dashboardNavObserver.observe(sidebar);

    window.addEventListener("resize", updateWidth);
}


// DISPLAY CURRENT DATE
function displayCurrentDate() {
    const dateElement = document.getElementById("dashboardDate");

    if (!dateElement) return;

    dateElement.textContent = new Date().toLocaleDateString(
        "en-PH",
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );
}


// LOAD DASHBOARD DATA
async function loadDashboard() {
    const refreshButton = document.getElementById("refreshDashboard");
    const originalRefreshHTML = refreshButton?.innerHTML;

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }

    hideMessage();

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        });

        const result = await response.json();

        if (response.status === 401) {
            window.location.href = "/student/pages/login.html";
            return;
        }

        if (response.status === 403) {
            throw new Error(
                result.message || "You do not have permission to access this dashboard."
            );
        }

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to retrieve dashboard data."
            );
        }

        // Accept both wrapped and flat API responses
        const data = result.data || result;

        if (!data || typeof data !== "object") {
            throw new Error("Invalid dashboard response.");
        }

        updateDashboard(data);

        showMessage(
            "Dashboard data successfully updated.",
            "success"
        );

    } catch (error) {
        console.error("Dashboard loading error:", error);

        showMessage(
            error.message || "Unable to connect to the dashboard server.",
            "error"
        );

    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalRefreshHTML;
        }
    }
}


// UPDATE ALL DASHBOARD SECTIONS
function updateDashboard(data) {
    updateStatistics(data);
    updateSummary(data);

    updateTransactions(
        Array.isArray(data.recentTransactions)
            ? data.recentTransactions
            : []
    );

    updateRestocking(
        Array.isArray(data.recentRestocking)
            ? data.recentRestocking
            : []
    );
    updateBranchPerformance(
        Array.isArray(data.branchPerformance) ? data.branchPerformance : []
    );
}


// UPDATE KPI CARDS
function updateStatistics(data) {
    setText("todaySales", formatCurrency(data.todaySales));

    setText(
        "totalTransactions",
        formatNumber(data.totalTransactions)
    );

    setText(
        "totalProducts",
        formatNumber(data.totalProducts ?? data.total_products)
    );
    setText("totalBranches", formatNumber(data.totalBranches ?? data.total_branches));

    setText(
        "lowStockProducts",
        formatNumber(data.lowStockProducts ?? data.low_stock_products)
    );
}


// UPDATE SECONDARY SUMMARY
function updateSummary(data) {
    setText(
        "totalItemsSold",
        formatNumber(data.totalItemsSold)
    );

    setText(
        "outOfStockProducts",
        formatNumber(data.outOfStockProducts ?? data.out_of_stock_products)
    );
    setText("totalStockUnits", formatNumber(data.totalStockUnits ?? data.total_stock_units));

    const peakPeriod = data.peakCustomerPeriod;

    setText(
        "peakPeriod",
        peakPeriod?.period || "No data"
    );

    setText(
        "peakTransactions",
        peakPeriod
            ? `${formatNumber(peakPeriod.transactions)} transactions`
            : "0 transactions"
    );

    const bestSeller = data.bestSellingProduct;

    setText(
        "bestSellingProduct",
        bestSeller?.product_name || "No data"
    );

    setText(
        "bestSellingQuantity",
        bestSeller
            ? `${formatNumber(bestSeller.quantity_sold)} items sold`
            : "0 items sold"
    );

    setText(
        "availableProducts",
        formatNumber(data.availableProducts ?? data.available_products)
    );

    setText(
        "overviewLowStock",
        formatNumber(data.lowStockProducts ?? data.low_stock_products)
    );

    setText(
        "overviewOutOfStock",
        formatNumber(data.outOfStockProducts ?? data.out_of_stock_products)
    );
}


// RECENT TRANSACTIONS TABLE
function updateTransactions(transactions) {
    const table = document.getElementById("transactionsTable");
    if (!table) return;
    if (!transactions.length) {
        table.innerHTML = '<tr><td colspan="6" class="empty-row">No transactions recorded yet.</td></tr>';
        return;
    }
    table.innerHTML = transactions.map(sale => `
        <tr>
            <td>#${escapeHTML(sale.sale_id)}</td>
            <td>${escapeHTML(sale.branch_name || "—")}</td>
            <td>${formatDate(sale.sale_date)}</td>
            <td>${formatTime(sale.sale_time)}</td>
            <td>${escapeHTML(sale.business_name || "Unknown Business")}</td>
            <td>${formatCurrency(sale.total_amount)}</td>
        </tr>
    `).join("");
}


// RECENT RESTOCKING TABLE
function updateRestocking(restocks) {
    const table = document.getElementById("restockingTable");
    if (!table) return;
    if (!restocks.length) {
        table.innerHTML = '<tr><td colspan="6" class="empty-row">No restocking records available.</td></tr>';
        return;
    }
    table.innerHTML = restocks.map(restock => `
        <tr>
            <td>#${escapeHTML(restock.restock_id)}</td>
            <td>${escapeHTML(restock.branch_name || "—")}</td>
            <td>${escapeHTML(restock.product_name || "Unknown")}</td>
            <td>${formatNumber(restock.quantity)}</td>
            <td>${escapeHTML(restock.supplier_name || "Unknown")}</td>
            <td>${formatDate(restock.restock_date)}</td>
        </tr>
    `).join("");
}

function updateBranchPerformance(branches) {
    const table = document.getElementById("branchPerformanceTable");
    if (!table) return;
    if (!branches.length) {
        table.innerHTML = '<tr><td colspan="6" class="empty-row">No active branches are available.</td></tr>';
        return;
    }
    table.innerHTML = branches.map(branch => `
        <tr>
            <td>${escapeHTML(branch.branch_name)}</td>
            <td>${formatCurrency(branch.today_sales)}</td>
            <td>${formatNumber(branch.transactions_today)}</td>
            <td>${formatNumber(branch.items_sold_today)}</td>
            <td>${formatNumber(branch.stock_units)}</td>
            <td>${formatNumber(branch.low_stock_items)}</td>
        </tr>
    `).join("");
}


// SET ELEMENT TEXT
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// FORMAT CURRENCY
function formatCurrency(value) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(value || 0));
}


// FORMAT NUMBERS
function formatNumber(value) {
    return new Intl.NumberFormat("en-PH").format(
        Number(value || 0)
    );
}


// FORMAT DATE
function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}


// FORMAT TIME
function formatTime(value) {
    if (!value) return "—";

    const time = String(value);

    const match = time.match(/^(\d{1,2}):(\d{2})/);

    if (!match) return escapeHTML(time);

    let hours = Number(match[1]);
    const minutes = match[2];

    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${period}`;
}


// PREVENT HTML INJECTION IN TABLE VALUES
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// DISPLAY STATUS MESSAGE
function showMessage(message, type) {
    const element = document.getElementById("dashboardMessage");

    if (!element) return;

    element.textContent = message;
    element.className = `dashboard-message ${type}`;
}


// HIDE STATUS MESSAGE
function hideMessage() {
    const element = document.getElementById("dashboardMessage");

    if (!element) return;

    element.textContent = "";
    element.className = "dashboard-message hidden";
}
