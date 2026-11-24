
/* CASIA DEMAND AND RESTOCK INSIGHTS FRONTEND */

const INSIGHTS_API = "/api/insights";

let insightProducts = [];

let demandTrendChart = null;
let stockDemandChart = null;

let currentSettings = {
    days: 7,
    leadTime: 2,
    safetyDays: 1,
    targetDays: 7
};

document.addEventListener("DOMContentLoaded", async () => {

    bindEvents();

    await loadInsights();
});

// Load the shared CASIA navigation.

// Bind page interactions.

function bindEvents() {
    document.getElementById("refreshInsights")
        .addEventListener("click", loadInsights);

    document.getElementById("applySettings")
        .addEventListener("click", applySettings);

    document.getElementById("productSearch")
        .addEventListener("input", renderRecommendationTable);

    document.getElementById("recommendationFilter")
        .addEventListener("change", renderRecommendationTable);
}

// Display messages.

function showMessage(message, type = "success") {
    const element = document.getElementById("insightsMessage");

    element.textContent = message;
    element.className = "insights-message " + type;

    clearTimeout(element.hideTimer);

    element.hideTimer = setTimeout(() => {
        element.className = "insights-message";
        element.textContent = "";
    }, 5000);
}

// Validate the selected analysis settings.

function readSettings() {
    const days = Number(
        document.getElementById("analysisPeriod").value
    );

    const leadTime = Number(
        document.getElementById("leadTime").value
    );

    const safetyDays = Number(
        document.getElementById("safetyDays").value
    );

    const targetDays = Number(
        document.getElementById("targetDays").value
    );

    if (
        ![7, 14, 30].includes(days) ||
        !Number.isSafeInteger(leadTime) ||
        leadTime < 0 ||
        leadTime > 90 ||
        !Number.isSafeInteger(safetyDays) ||
        safetyDays < 0 ||
        safetyDays > 30 ||
        !Number.isSafeInteger(targetDays) ||
        targetDays < 1 ||
        targetDays > 90
    ) {
        throw new Error(
            "Please enter valid analysis and stock planning settings."
        );
    }

    return {
        days,
        leadTime,
        safetyDays,
        targetDays
    };
}

// Apply settings and retrieve updated calculations.

async function applySettings() {
    try {
        currentSettings = readSettings();

        await loadInsights();

        showMessage(
            "Demand analysis updated using your selected settings."
        );

    } catch (error) {
        showMessage(error.message, "error");
    }
}

// Build the API URL.

function buildInsightsUrl() {
    const params = new URLSearchParams({
        days: currentSettings.days,
        leadTime: currentSettings.leadTime,
        safetyDays: currentSettings.safetyDays,
        targetDays: currentSettings.targetDays
    });

    return `${INSIGHTS_API}/dashboard?${params.toString()}`;
}

// Request insights from the backend.

async function apiRequest(url) {
    const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            "Accept": "application/json"
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || "Unable to retrieve demand insights."
        );
    }

    return result;
}

// Load all demand and restock information.

async function loadInsights() {
    const body = document.getElementById("recommendationTableBody");

    body.innerHTML = `
        <tr>
            <td colspan="8" class="table-empty">
                Calculating demand and restock recommendations...
            </td>
        </tr>
    `;

    try {
        const result = await apiRequest(buildInsightsUrl());

        insightProducts = result.products || [];

        // Use the settings returned by the backend.

        if (result.settings) {
            currentSettings = {
                days: Number(result.settings.days),
                leadTime: Number(result.settings.lead_time),
                safetyDays: Number(result.settings.safety_days),
                targetDays: Number(result.settings.target_days)
            };
        }

        renderSummary(result.summary || {});
        renderRecommendationCounts(insightProducts);
        renderRecommendationTable();
        renderCharts(result);

    } catch (error) {
        console.error("Demand insights:", error);

        body.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showMessage(error.message, "error");
    }
}

// Render the main KPI cards.

function renderSummary(summary) {
    document.getElementById("totalUnitsSold").textContent =
        Number(summary.total_units_sold || 0).toLocaleString();

    document.getElementById("averageDailyDemand").textContent =
        formatNumber(summary.average_daily_demand);

    document.getElementById("productsNeedingRestock").textContent =
        Number(summary.products_needing_restock || 0).toLocaleString();

    document.getElementById("suggestedRestockQuantity").textContent =
        Number(summary.suggested_restock_quantity || 0).toLocaleString();
}

// Render the product status counters.

function renderRecommendationCounts(products) {
    const counts = {
        out: 0,
        now: 0,
        soon: 0,
        ok: 0,
        no_data: 0
    };

    products.forEach(product => {
        if (Object.prototype.hasOwnProperty.call(
            counts,
            product.status
        )) {
            counts[product.status]++;
        }
    });

    document.getElementById("outOfStockCount").textContent =
        counts.out;

    document.getElementById("restockNowCount").textContent =
        counts.now;

    document.getElementById("restockSoonCount").textContent =
        counts.soon;

    document.getElementById("sufficientStockCount").textContent =
        counts.ok;
}

// Status labels shown in the recommendation table.

function getStatusDetails(status) {
    const statuses = {
        out: {
            label: "Out of Stock",
            className: "out"
        },

        now: {
            label: "Restock Now",
            className: "now"
        },

        soon: {
            label: "Restock Soon",
            className: "soon"
        },

        ok: {
            label: "Sufficient Stock",
            className: "ok"
        },

        no_data: {
            label: "No Sales Data",
            className: "no_data"
        }
    };

    return statuses[status] || statuses.no_data;
}

// Build the demand trend label.

function getTrendDetails(product) {
    const change = Number(product.demand_change) || 0;
    const trend = product.demand_trend;

    let icon = "fa-minus";
    let label = "Stable";

    if (trend === "increasing") {
        icon = "fa-arrow-trend-up";
        label = `Increasing (+${formatNumber(change)}%)`;
    } else if (trend === "decreasing") {
        icon = "fa-arrow-trend-down";
        label = `Decreasing (${formatNumber(change)}%)`;
    } else if (Number(product.units_sold) > 0) {
        label = "Stable";
    } else {
        label = "No Sales";
    }

    return {
        icon,
        label,
        className: trend
    };
}

// Render the recommendation table.

function renderRecommendationTable() {
    const body = document.getElementById("recommendationTableBody");

    const search = document.getElementById("productSearch")
        .value.trim().toLowerCase();

    const filter = document.getElementById("recommendationFilter")
        .value;

    const filtered = insightProducts.filter(product => {
        const name = String(product.product_name || "")
            .toLowerCase();

        const category = String(product.category_name || "")
            .toLowerCase();

        const matchesSearch =
            name.includes(search) || category.includes(search);

        const matchesFilter =
            filter === "all" || product.status === filter;

        return matchesSearch && matchesFilter;
    });

    document.getElementById("productResultCount").textContent =
        `${filtered.length} of ${insightProducts.length} products`;

    if (!filtered.length) {
        body.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    No products match your search or selected status.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = filtered.map(product => {
        const status = getStatusDetails(product.status);
        const trend = getTrendDetails(product);

        const daysLeft = product.days_of_stock_remaining;

        const daysLabel = daysLeft === null
            ? "No demand data"
            : `${formatNumber(daysLeft)} days`;

        const suggestedQuantity =
            Number(product.suggested_restock_quantity) || 0;

        return `
            <tr>
                <td>
                    <div class="product-cell">
                        ${escapeHTML(product.product_name)}
                    </div>
                    <small>${escapeHTML(product.category_name || "Uncategorized")}</small>
                </td>

                <td>
                    ${Number(product.current_stock).toLocaleString()}
                </td>

                <td>
                    ${Number(product.units_sold).toLocaleString()}
                </td>

                <td class="demand-value">
                    ${formatNumber(product.average_daily_demand)}
                    <small>units/day</small>
                </td>

                <td>
                    <span class="trend-label ${trend.className}">
                        <i class="fa-solid ${trend.icon}"></i>
                        ${escapeHTML(trend.label)}
                    </span>
                </td>

                <td>${daysLabel}</td>

                <td class="restock-quantity">
                    ${suggestedQuantity.toLocaleString()}
                </td>

                <td>
                    <span class="recommendation-status ${status.className}">
                        ${status.label}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

// Render demand and stock comparison visualizations.

function renderCharts(result) {
    if (typeof Chart === "undefined") {
        showMessage(
            "Chart.js could not load. Check your internet connection and refresh.",
            "error"
        );

        return;
    }

    destroyCharts();

    renderDemandTrend(result.demand_trend || []);
    renderStockDemand(result.stock_vs_demand || []);
}

// Destroy previous chart instances before re-rendering.

function destroyCharts() {
    if (demandTrendChart) {
        demandTrendChart.destroy();
        demandTrendChart = null;
    }

    if (stockDemandChart) {
        stockDemandChart.destroy();
        stockDemandChart = null;
    }
}

// Line chart: total demand over time.

function renderDemandTrend(data) {
    const labels = data.map(item => item.label);

    const values = data.map(
        item => Number(item.units_sold) || 0
    );

    demandTrendChart = new Chart(
        document.getElementById("demandTrendChart"),
        {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Total Units Sold",
                    data: values,

                    borderColor: "#80542e",
                    backgroundColor: "rgba(128, 84, 46, 0.13)",

                    fill: true,
                    tension: 0.35,

                    pointRadius: 3,
                    pointHoverRadius: 5,

                    borderWidth: 2
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: context =>
                                ` Units sold: ${Number(context.parsed.y).toLocaleString()}`
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },

                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        }
    );
}

// Grouped bar chart: stock versus daily demand.

function renderStockDemand(data) {
    const labels = data.map(
        item => item.product_name
    );

    const currentStock = data.map(
        item => Number(item.current_stock) || 0
    );

    const dailyDemand = data.map(
        item => Number(item.average_daily_demand) || 0
    );

    stockDemandChart = new Chart(
        document.getElementById("stockDemandChart"),
        {
            type: "bar",

            data: {
                labels,

                datasets: [
                    {
                        label: "Current Stock",
                        data: currentStock,
                        backgroundColor: "#80542e",
                        borderRadius: 4,
                        maxBarThickness: 36
                    },

                    {
                        label: "Average Daily Demand",
                        data: dailyDemand,
                        backgroundColor: "#d5ab72",
                        borderRadius: 4,
                        maxBarThickness: 36
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                plugins: {
                    legend: {
                        position: "bottom"
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },

                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );
}

// Number formatting.

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Escape database text before displaying it in the table.

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
