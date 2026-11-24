/* Shared Chart.js styling so every analytics chart looks consistent. */
if (window.Chart) {
    Chart.defaults.font.family = "Arial, sans-serif";
    Chart.defaults.color = "#6f5b4a";
    Chart.defaults.borderColor = "#efe6db";
    Chart.defaults.animation.duration = 600;
    Chart.defaults.plugins.tooltip.backgroundColor = "#3a2616";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
}


/* CASIA SALES AND CUSTOMER ANALYTICS FRONTEND */

const ANALYTICS_API = "/api/analytics";

let salesTrendChart = null;
let bestSellingChart = null;
let categorySalesChart = null;
let customerTrafficChart = null;
let inventoryByProductChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    bindAnalyticsEvents();
    await loadAnalytics();
});

async function apiRequest(url) {
    const response = await fetch(url, {
        credentials: "same-origin"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message || "Unable to retrieve analytics."
        );
    }

    return result;
}

function bindAnalyticsEvents() {
    document.getElementById("refreshAnalytics")
        .addEventListener("click", loadAnalytics);

    document.getElementById("analyticsPeriod")
        .addEventListener("change", loadAnalytics);
}

function showAnalyticsMessage(message, type = "error") {
    const element = document.getElementById("analyticsMessage");

    element.textContent = message;
    element.className = "analytics-message " + type;

    window.clearTimeout(element.hideTimer);

    element.hideTimer = window.setTimeout(() => {
        element.textContent = "";
        element.className = "analytics-message";
    }, 5000);
}

async function loadAnalytics() {
    const days = document.getElementById("analyticsPeriod").value;

    try {
        const result = await apiRequest(
            `${ANALYTICS_API}/dashboard?days=${encodeURIComponent(days)}`
        );

        renderSummary(result.summary || {});
        renderPeakPeriod(result.peakPeriod);
        renderProductPerformance(result.bestSellingProducts || []);
        renderBranchPerformance(result.branchPerformance || []);
        renderCharts(result);

    } catch (error) {
        console.error("Analytics retrieval:", error);

        showAnalyticsMessage(error.message, "error");

        document.getElementById("branchPerformanceBody").innerHTML = `
            <tr><td colspan="4" class="table-empty">Unable to load branch performance.</td></tr>
        `;
        document.getElementById("productPerformanceBody").innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    Unable to load product performance.
                </td>
            </tr>
        `;
    }
}

function renderSummary(summary) {
    document.getElementById("totalSales").textContent =
        formatCurrency(Number(summary.total_sales) || 0);

    document.getElementById("transactionCount").textContent =
        Number(summary.transaction_count || 0).toLocaleString();

    document.getElementById("itemsSold").textContent =
        Number(summary.items_sold || 0).toLocaleString();

    document.getElementById("averageTransaction").textContent =
        formatCurrency(Number(summary.average_transaction) || 0);
}

function renderPeakPeriod(peak) {
    const title = document.getElementById("peakPeriod");
    const description = document.getElementById("peakDescription");

    const transactions = document.getElementById("peakTransactions");
    const percentage = document.getElementById("peakPercentage");

    if (!peak || Number(peak.transactions) < 1) {
        title.textContent = "No Sales Yet";

        description.textContent =
            "There are no completed transactions for the selected period.";

        transactions.textContent = "0";
        percentage.textContent = "0%";

        return;
    }

    title.textContent = peak.period;

    description.textContent =
        "This time period recorded the highest number of transactions.";

    transactions.textContent =
        Number(peak.transactions).toLocaleString();

    percentage.textContent =
        `${Number(peak.traffic_percentage || 0).toFixed(1)}%`;
}

function renderProductPerformance(products) {
    const body = document.getElementById("productPerformanceBody");

    if (!products.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    No completed product sales found for this period.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = products.map((product, index) => `
        <tr>
            <td class="rank-number">#${index + 1}</td>

            <td class="product-name">
                ${escapeHTML(product.product_name)}
            </td>

            <td>
                ${Number(product.items_sold).toLocaleString()}
            </td>

            <td class="revenue-value">
                ${formatCurrency(Number(product.revenue) || 0)}
            </td>
        </tr>
    `).join("");
}

function renderCharts(result) {
    if (typeof Chart === "undefined") {
        showAnalyticsMessage(
            "Chart.js could not load. Check your internet connection and refresh.",
            "error"
        );

        return;
    }

    destroyCharts();

    renderSalesTrend(result.salesTrend || []);
    renderBestSellingProducts(result.bestSellingProducts || []);
    renderCategorySales(result.categorySales || []);
    renderCustomerTraffic(result.customerTraffic || []);
    renderInventoryByProduct(result.inventoryByProduct || []);
}

function destroyCharts() {
    [
        salesTrendChart,
        bestSellingChart,
        categorySalesChart,
        customerTrafficChart,
        inventoryByProductChart
    ].forEach(chart => {
        if (chart) chart.destroy();
    });

    salesTrendChart = null;
    bestSellingChart = null;
    categorySalesChart = null;
    customerTrafficChart = null;
    inventoryByProductChart = null;
}

// Sales trend line chart

function renderSalesTrend(data) {
    const labels = data.map(item => item.label);

    const values = data.map(
        item => Number(item.total_sales) || 0
    );

    salesTrendChart = new Chart(
        document.getElementById("salesTrendChart"),
        {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Daily Sales",
                    data: values,
                    borderColor: "#80542e",
                    backgroundColor: "rgba(128, 84, 46, 0.13)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: context =>
                                ` Sales: ${formatCurrency(context.parsed.y)}`
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
                            callback: value =>
                                "₱" + Number(value).toLocaleString()
                        }
                    }
                }
            }
        }
    );
}

// Best-selling products horizontal bar chart

function renderBestSellingProducts(data) {
    const labels = data.map(item => item.product_name);

    const values = data.map(
        item => Number(item.items_sold) || 0
    );

    bestSellingChart = new Chart(
        document.getElementById("bestSellingChart"),
        {
            type: "bar",

            data: {
                labels,

                datasets: [{
                    label: "Items Sold",
                    data: values,
                    backgroundColor: "#80542e",
                    borderRadius: 5,
                    maxBarThickness: 33
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    },

                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        }
    );
}

// Category sales doughnut chart

function renderCategorySales(data) {
    const labels = data.map(item => item.category_name);

    const values = data.map(
        item => Number(item.total_sales) || 0
    );

    categorySalesChart = new Chart(
        document.getElementById("categorySalesChart"),
        {
            type: "doughnut",

            data: {
                labels,

                datasets: [{
                    data: values,

                    backgroundColor: [
                        "#80542e",
                        "#c28b53",
                        "#dfbd8d",
                        "#8f9b68",
                        "#a7b8c5",
                        "#b58a9b",
                        "#b3a18a"
                    ],

                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",

                plugins: {
                    legend: {
                        position: "bottom"
                    },

                    tooltip: {
                        callbacks: {
                            label: context =>
                                ` ${context.label}: ${formatCurrency(context.parsed)}`
                        }
                    }
                }
            }
        }
    );
}

// Customer traffic doughnut chart

function renderCustomerTraffic(data) {
    const labels = data.map(item => item.period);

    const values = data.map(
        item => Number(item.transactions) || 0
    );

    const percentages = data.map(
        item => Number(item.traffic_percentage) || 0
    );

    customerTrafficChart = new Chart(
        document.getElementById("customerTrafficChart"),
        {
            type: "doughnut",

            data: {
                labels,

                datasets: [{
                    data: values,

                    backgroundColor: [
                        "#80542e",
                        "#c28b53",
                        "#dfbd8d",
                        "#8f9b68",
                        "#a7b8c5",
                        "#b58a9b"
                    ],

                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",

                plugins: {
                    legend: {
                        position: "bottom"
                    },

                    tooltip: {
                        callbacks: {
                            label: context => {
                                const index = context.dataIndex;

                                return ` ${context.label}: ` +
                                    `${Number(context.parsed).toLocaleString()} ` +
                                    `transactions (${percentages[index].toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        }
    );
}

function renderInventoryByProduct(data) {
    const canvas = document.getElementById("inventoryByProductChart");
    if (!canvas) return;
    inventoryByProductChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: data.map(item => item.product_name),
            datasets: [{
                label: "Available Stock",
                data: data.map(item => Number(item.quantity) || 0),
                backgroundColor: "#a7863b",
                borderRadius: 5,
                maxBarThickness: 38
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderBranchPerformance(branches) {
    const body = document.getElementById("branchPerformanceBody");
    if (!body) return;
    if (!branches.length) {
        body.innerHTML = '<tr><td colspan="4" class="table-empty">No branch sales found for this period.</td></tr>';
        return;
    }
    body.innerHTML = branches.map(branch => `
        <tr>
            <td>${escapeHTML(branch.branch_name)}</td>
            <td>${formatCurrency(Number(branch.total_sales) || 0)}</td>
            <td>${Number(branch.transactions || 0).toLocaleString()}</td>
            <td>${Number(branch.items_sold || 0).toLocaleString()}</td>
        </tr>
    `).join("");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(amount);
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
