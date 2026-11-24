/* Branch-aware owner reports and visualizations. */
const service = require("./analytics.service.js");

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

function validDays(value) {
    const days = Number(value || 30);
    return [7, 30, 90, 365].includes(days) ? days : 30;
}

async function handleGetDashboard1(req, res) {
    const account = getAccount(req, res);
    if (!account) return;
    const { businessId, branchId } = account;
    const days = validDays(req.query.days);

    try {
        const params = [businessId, days, branchId];
        const [overviewResult, trendResult, bestSellingResult, categoryResult,
            trafficResult, stockResult, branchResult] = await Promise.all([
            service.query(
                `WITH branch_sales AS (
                    SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time
                    FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                    WHERE br.business_id = $1
                      AND ($3::bigint IS NULL OR s.branch_id = $3)
                      AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                      AND s.sale_date <= CURRENT_DATE
                 )
                 SELECT
                    COALESCE((SELECT SUM(total_amount) FROM branch_sales), 0)::numeric(12,2) AS total_sales,
                    (SELECT COUNT(*) FROM branch_sales)::int AS transaction_count,
                    COALESCE((
                        SELECT SUM(si.quantity)
                        FROM branch_sales bs
                        JOIN public.sale_items si ON si.sale_id = bs.sale_id
                        JOIN public.products p ON p.product_id = si.product_id
                        WHERE p.business_id = $1
                    ), 0)::int AS items_sold,
                    COALESCE((SELECT AVG(total_amount) FROM branch_sales), 0)::numeric(12,2) AS average_transaction`,
                params
            ),
            service.query(
                `WITH date_series AS (
                    SELECT generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS sales_day
                 ), daily_sales AS (
                    SELECT s.sale_date, SUM(s.total_amount)::numeric(12,2) AS total_sales
                    FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                    WHERE br.business_id = $1
                      AND ($3::bigint IS NULL OR s.branch_id = $3)
                      AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                      AND s.sale_date <= CURRENT_DATE
                    GROUP BY s.sale_date
                 )
                 SELECT TO_CHAR(d.sales_day, 'Mon DD') AS label,
                        COALESCE(ds.total_sales, 0)::numeric(12,2) AS total_sales
                 FROM date_series d LEFT JOIN daily_sales ds ON ds.sale_date = d.sales_day
                 ORDER BY d.sales_day`,
                params
            ),
            service.query(
                `SELECT p.product_id, p.product_name,
                        COALESCE(SUM(si.quantity), 0)::int AS items_sold,
                        COALESCE(SUM(si.subtotal), 0)::numeric(12,2) AS revenue
                 FROM public.sales s
                 JOIN public.branches br ON br.branch_id = s.branch_id
                 JOIN public.sale_items si ON si.sale_id = s.sale_id
                 JOIN public.products p ON p.product_id = si.product_id
                 WHERE br.business_id = $1 AND p.business_id = $1
                   AND ($3::bigint IS NULL OR s.branch_id = $3)
                   AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                   AND s.sale_date <= CURRENT_DATE
                 GROUP BY p.product_id, p.product_name
                 ORDER BY items_sold DESC, revenue DESC LIMIT 10`,
                params
            ),
            service.query(
                `SELECT COALESCE(c.category_name, 'Uncategorized') AS category_name,
                        COALESCE(SUM(si.subtotal), 0)::numeric(12,2) AS total_sales,
                        COALESCE(SUM(si.quantity), 0)::int AS items_sold
                 FROM public.sales s
                 JOIN public.branches br ON br.branch_id = s.branch_id
                 JOIN public.sale_items si ON si.sale_id = s.sale_id
                 JOIN public.products p ON p.product_id = si.product_id
                 LEFT JOIN public.categories c ON c.category_id = p.category_id
                 WHERE br.business_id = $1 AND p.business_id = $1
                   AND ($3::bigint IS NULL OR s.branch_id = $3)
                   AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                   AND s.sale_date <= CURRENT_DATE
                 GROUP BY c.category_id, c.category_name
                 ORDER BY total_sales DESC`,
                params
            ),
            service.query(
                `WITH traffic AS (
                    SELECT CASE
                        WHEN EXTRACT(HOUR FROM s.sale_time) BETWEEN 5 AND 8 THEN 'Early Morning'
                        WHEN EXTRACT(HOUR FROM s.sale_time) BETWEEN 9 AND 11 THEN 'Morning'
                        WHEN EXTRACT(HOUR FROM s.sale_time) BETWEEN 12 AND 13 THEN 'Lunch'
                        WHEN EXTRACT(HOUR FROM s.sale_time) BETWEEN 14 AND 16 THEN 'Afternoon'
                        WHEN EXTRACT(HOUR FROM s.sale_time) BETWEEN 17 AND 20 THEN 'Evening'
                        ELSE 'Other Hours' END AS period,
                        COUNT(*)::int AS transactions
                    FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                    WHERE br.business_id = $1
                      AND ($3::bigint IS NULL OR s.branch_id = $3)
                      AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                      AND s.sale_date <= CURRENT_DATE
                    GROUP BY period
                 )
                 SELECT period, transactions,
                        ROUND(transactions * 100.0 / NULLIF(SUM(transactions) OVER (), 0), 1) AS traffic_percentage
                 FROM traffic
                 ORDER BY CASE period WHEN 'Early Morning' THEN 1 WHEN 'Morning' THEN 2 WHEN 'Lunch' THEN 3 WHEN 'Afternoon' THEN 4 WHEN 'Evening' THEN 5 ELSE 6 END`,
                params
            ),
            service.query(
                `SELECT p.product_id, p.product_name,
                        COALESCE(SUM(i.quantity), 0)::int AS quantity
                 FROM public.products p
                 LEFT JOIN public.inventory i
                   ON i.product_id = p.product_id
                  AND ($2::bigint IS NULL OR i.branch_id = $2)
                 WHERE p.business_id = $1 AND p.status = 'active'
                 GROUP BY p.product_id, p.product_name
                 ORDER BY quantity DESC, p.product_name ASC LIMIT 20`,
                [businessId, branchId]
            ),
            service.query(
                `SELECT br.branch_id, br.branch_name,
                        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS total_sales,
                        COUNT(s.sale_id)::int AS transactions,
                        COALESCE((
                            SELECT SUM(si.quantity)
                            FROM public.sales sx
                            JOIN public.sale_items si ON si.sale_id = sx.sale_id
                            WHERE sx.branch_id = br.branch_id
                              AND sx.sale_date >= CURRENT_DATE - ($2::int - 1)
                              AND sx.sale_date <= CURRENT_DATE
                        ), 0)::int AS items_sold
                 FROM public.branches br
                 LEFT JOIN public.sales s
                   ON s.branch_id = br.branch_id
                  AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                  AND s.sale_date <= CURRENT_DATE
                 WHERE br.business_id = $1 AND br.status = 'active'
                   AND ($3::bigint IS NULL OR br.branch_id = $3)
                 GROUP BY br.branch_id, br.branch_name
                 ORDER BY total_sales DESC, br.branch_name ASC`,
                params
            )
        ]);

        const customerTraffic = trafficResult.rows;
        const peakPeriod = customerTraffic.length
            ? customerTraffic.reduce((highest, current) => Number(current.transactions) > Number(highest.transactions) ? current : highest)
            : null;
        return res.json({
            success: true,
            scope: branchId === null ? "all_branches" : "selected_branch",
            selectedBranchId: branchId,
            period: { days, start_date: trendResult.rows[0]?.label || null, end_date: new Date().toISOString().slice(0, 10) },
            summary: overviewResult.rows[0] || {},
            salesTrend: trendResult.rows,
            bestSellingProducts: bestSellingResult.rows,
            categorySales: categoryResult.rows,
            customerTraffic,
            peakPeriod,
            inventoryByProduct: stockResult.rows,
            branchPerformance: branchResult.rows
        });
    } catch (error) {
        console.error("Sales analytics:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load sales and branch analytics." });
    }
}

module.exports = { handleGetDashboard1 };
