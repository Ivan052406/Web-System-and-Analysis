/* CASIA DEMAND AND RESTOCK INSIGHTS ROUTES */



const service = require("./insights.service.js");
const db = service.db;

function getAccount(req, res) {
    const businessId = Number(req.staffUser?.business_id);
    if (!Number.isSafeInteger(businessId) || businessId < 1) {
        res.status(403).json({ success: false, message: "Your administrator account is not assigned to a valid business." });
        return null;
    }
    const branchId = req.allBranchesSelected ? null : Number(req.selectedBranchId);
    if (branchId !== null && (!Number.isSafeInteger(branchId) || branchId < 1)) {
        res.status(400).json({ success: false, message: "Select a valid branch or All Branches." });
        return null;
    }
    return { businessId, branchId };
}

function validNumber(value, fallback, minimum, maximum) {
    const number = Number(value);

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    if (
        !Number.isSafeInteger(number) ||
        number < minimum ||
        number > maximum
    ) {
        return null;
    }

    return number;
}

const STATUS_ORDER = {
    out: 0,
    now: 1,
    soon: 2,
    ok: 3,
    no_data: 4
};

// GET DEMAND AND RESTOCK INSIGHTS
// GET /api/insights/dashboard

// Express request handlers extracted from the original route declarations.
const handleGetDashboard1 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;
    const { businessId, branchId } = account;

    const days = validNumber(req.query.days, 7, 7, 30);
    const leadTime = validNumber(req.query.leadTime, 2, 0, 90);
    const safetyDays = validNumber(req.query.safetyDays, 1, 0, 30);
    const targetDays = validNumber(req.query.targetDays, 7, 1, 90);

    if (
        ![7, 14, 30].includes(days) ||
        leadTime === null ||
        safetyDays === null ||
        targetDays === null
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid demand analysis settings."
        });
    }

    try {
        // Retrieve current stock and sales for the selected and comparison periods.

        const productResult = await service.query(
            `WITH bounds AS (
                SELECT
                    (NOW() AT TIME ZONE 'Asia/Manila')::date AS today,
                    $2::int AS period_days
            ),

            daily_sales AS (
                SELECT
                    si.product_id,
                    s.sale_date,
                    SUM(si.quantity)::int AS units_sold
                FROM public.sales s
                INNER JOIN public.users u
                    ON u.user_id = s.user_id
                INNER JOIN public.sale_items si
                    ON si.sale_id = s.sale_id
                INNER JOIN public.products p
                    ON p.product_id = si.product_id
                CROSS JOIN bounds b
                WHERE u.business_id = $1
                  AND p.business_id = $1
                  AND ($3::bigint IS NULL OR s.branch_id = $3)
                  AND s.sale_date >=
                      b.today - ((b.period_days * 2) - 1)
                  AND s.sale_date <= b.today
                GROUP BY
                    si.product_id,
                    s.sale_date
            )

            SELECT
                p.product_id,
                p.product_name,
                c.category_name,

                COALESCE(i.quantity, 0)::int AS current_stock,

                COALESCE(
                    SUM(d.units_sold) FILTER (
                        WHERE d.sale_date >=
                            b.today - (b.period_days - 1)
                    ),
                    0
                )::int AS selected_units,

                COALESCE(
                    SUM(d.units_sold) FILTER (
                        WHERE d.sale_date <
                            b.today - (b.period_days - 1)
                    ),
                    0
                )::int AS previous_units

            FROM public.products p

            CROSS JOIN bounds b

            LEFT JOIN public.categories c
                ON c.category_id = p.category_id

            LEFT JOIN (
                SELECT i.product_id, SUM(i.quantity)::int AS quantity
                FROM public.inventory i
                JOIN public.branches br ON br.branch_id = i.branch_id
                WHERE br.business_id = $1
                  AND ($3::bigint IS NULL OR i.branch_id = $3)
                GROUP BY i.product_id
            ) i ON i.product_id = p.product_id

            LEFT JOIN daily_sales d
                ON d.product_id = p.product_id

            WHERE p.business_id = $1
              AND p.status = 'active'

            GROUP BY
                p.product_id,
                p.product_name,
                c.category_name,
                i.quantity,
                b.today,
                b.period_days

            ORDER BY p.product_name ASC`,
            [businessId, days, branchId]
        );

        // Retrieve daily demand for the line chart.

        const trendResult = await service.query(
            `WITH bounds AS (
                SELECT
                    (NOW() AT TIME ZONE 'Asia/Manila')::date AS today,
                    $2::int AS period_days
            ),

            date_series AS (
                SELECT generate_series(
                    b.today - (b.period_days - 1),
                    b.today,
                    INTERVAL '1 day'
                )::date AS sales_day
                FROM bounds b
            ),

            daily_totals AS (
                SELECT
                    s.sale_date,
                    SUM(si.quantity)::int AS units_sold
                FROM public.sales s
                INNER JOIN public.users u
                    ON u.user_id = s.user_id
                INNER JOIN public.sale_items si
                    ON si.sale_id = s.sale_id
                INNER JOIN public.products p
                    ON p.product_id = si.product_id
                CROSS JOIN bounds b
                WHERE u.business_id = $1
                  AND p.business_id = $1
                  AND ($3::bigint IS NULL OR s.branch_id = $3)
                  AND s.sale_date >=
                      b.today - (b.period_days - 1)
                  AND s.sale_date <= b.today
                GROUP BY s.sale_date
            )

            SELECT
                d.sales_day,
                TO_CHAR(d.sales_day, 'Mon DD') AS label,
                COALESCE(t.units_sold, 0)::int AS units_sold

            FROM date_series d

            LEFT JOIN daily_totals t
                ON t.sale_date = d.sales_day

            ORDER BY d.sales_day`,
            [businessId, days, branchId]
        );

        // Calculate demand and restock recommendations.

        const products = productResult.rows.map(product => {
            const stock = Number(product.current_stock) || 0;
            const selectedUnits = Number(product.selected_units) || 0;
            const previousUnits = Number(product.previous_units) || 0;

            const averageDemand = selectedUnits / days;
            const previousAverage = previousUnits / days;

            const demandChange = previousAverage > 0
                ? ((averageDemand - previousAverage) / previousAverage) * 100
                : averageDemand > 0
                    ? 100
                    : 0;

            let trend = "stable";

            if (demandChange > 5) {
                trend = "increasing";
            } else if (demandChange < -5) {
                trend = "decreasing";
            }

            const daysLeft = averageDemand > 0
                ? stock / averageDemand
                : null;

            const coverageDays =
                leadTime + safetyDays + targetDays;

            let status = "ok";

            if (averageDemand <= 0) {
                status = "no_data";
            } else if (stock <= 0) {
                status = "out";
            } else if (daysLeft <= leadTime) {
                status = "now";
            } else if (daysLeft <= coverageDays) {
                status = "soon";
            }

            const suggestedRestock = status === "ok" ||
                status === "no_data"
                ? 0
                : Math.max(
                    0,
                    Math.ceil(
                        averageDemand * coverageDays - stock
                    )
                );

            return {
                product_id: product.product_id,
                product_name: product.product_name,
                category_name: product.category_name,

                current_stock: stock,
                units_sold: selectedUnits,

                average_daily_demand: Number(
                    averageDemand.toFixed(2)
                ),

                previous_average_daily_demand: Number(
                    previousAverage.toFixed(2)
                ),

                demand_change: Number(
                    demandChange.toFixed(2)
                ),

                demand_trend: trend,

                days_of_stock_remaining: daysLeft === null
                    ? null
                    : Number(daysLeft.toFixed(1)),

                status,

                suggested_restock_quantity: suggestedRestock
            };
        });

        // Prioritize products that need restocking.

        products.sort((a, b) => {
            const statusDifference =
                STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

            if (statusDifference !== 0) {
                return statusDifference;
            }

            return a.days_of_stock_remaining -
                b.days_of_stock_remaining;
        });

        const restockProducts = products.filter(
            product => ["out", "now", "soon"].includes(product.status)
        );

        const totalUnitsSold = products.reduce(
            (sum, product) => sum + product.units_sold,
            0
        );

        const totalDailyDemand = products.reduce(
            (sum, product) => sum + product.average_daily_demand,
            0
        );

        const totalSuggestedQuantity = products.reduce(
            (sum, product) =>
                sum + product.suggested_restock_quantity,
            0
        );

        const summary = {
            total_products: products.length,

            total_units_sold: totalUnitsSold,

            average_daily_demand: Number(
                totalDailyDemand.toFixed(2)
            ),

            products_needing_restock: restockProducts.length,

            suggested_restock_quantity: totalSuggestedQuantity,

            out_of_stock_products: products.filter(
                p => p.status === "out"
            ).length,

            increasing_demand_products: products.filter(
                p => p.demand_trend === "increasing"
            ).length
        };

        const stockDemandChart = [...products]
            .filter(p => p.average_daily_demand > 0 || p.current_stock > 0)
            .sort((a, b) =>
                b.average_daily_demand - a.average_daily_demand
            )
            .slice(0, 10)
            .map(p => ({
                product_id: p.product_id,
                product_name: p.product_name,
                current_stock: p.current_stock,
                average_daily_demand: p.average_daily_demand
            }));

        return res.json({
            success: true,

            scope: branchId === null ? "all_branches" : "selected_branch",
            selectedBranchId: branchId,

            settings: {
                days,
                lead_time: leadTime,
                safety_days: safetyDays,
                target_days: targetDays
            },

            summary,

            products,

            demand_trend: trendResult.rows,

            stock_vs_demand: stockDemandChart
        });

    } catch (error) {
        console.error("Demand insights:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to calculate demand and restock insights."
        });
    }
};

module.exports = { handleGetDashboard1 };
