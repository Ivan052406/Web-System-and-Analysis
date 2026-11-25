const service = require("./dashboard.service.js");

// Branch scope from the top-bar filter.
// null = All Branches (combined), a number = only that branch.
function getBranchScope(req) {
    if (req.allBranchesSelected) return null;
    const branchId = Number(req.selectedBranchId);
    return Number.isSafeInteger(branchId) && branchId > 0 ? branchId : null;
}

async function getDashboardData(businessId, days = 7, branchId = null) {
    const [summary, businessRow, bestSeller, peakPeriod, recentSales, recentRestocks, branchPerformance, salesByDay, lowStock, topSelling] = await Promise.all([
        service.query(
            `SELECT
                (SELECT COUNT(DISTINCT i.product_id) FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                    JOIN public.products p ON p.product_id = i.product_id
                 WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active'
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS total_products,
                (SELECT COUNT(*) FROM public.branches br
                 WHERE br.business_id = $1 AND br.status = 'active'
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS total_branches,
                (SELECT COUNT(*) FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                    JOIN public.products p ON p.product_id = i.product_id
                 WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active'
                   AND i.quantity > 0 AND i.quantity <= p.minimum_stock
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS low_stock_products,
                (SELECT COUNT(*) FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                    JOIN public.products p ON p.product_id = i.product_id
                 WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active'
                   AND i.quantity = 0
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS out_of_stock_products,
                (SELECT COUNT(*) FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                    JOIN public.products p ON p.product_id = i.product_id
                 WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active'
                   AND i.quantity > 0
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS available_products,
                (SELECT COALESCE(SUM(i.quantity), 0) FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                 WHERE br.business_id = $1 AND br.status = 'active'
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::bigint AS total_stock_units,
                (SELECT COALESCE(SUM(s.total_amount), 0) FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                 WHERE br.business_id = $1 AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::numeric(12,2) AS today_sales,
                (SELECT COUNT(*) FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                 WHERE br.business_id = $1 AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS total_transactions,
                (SELECT COALESCE(SUM(si.quantity), 0) FROM public.sales s
                    JOIN public.branches br ON br.branch_id = s.branch_id
                    JOIN public.sale_items si ON si.sale_id = s.sale_id
                 WHERE br.business_id = $1 AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
                   AND ($3::int IS NULL OR br.branch_id = $3::int))::int AS total_items_sold`,
            [businessId, days, branchId]
        ),
        service.query(
            "SELECT business_name FROM public.businesses WHERE business_id = $1",
            [businessId]
        ),
        service.query(
            `SELECT p.product_id, p.product_name, SUM(si.quantity)::int AS quantity_sold
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             JOIN public.sale_items si ON si.sale_id = s.sale_id
             JOIN public.products p ON p.product_id = si.product_id
             WHERE br.business_id = $1 AND p.business_id = $1
               AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
               AND ($3::int IS NULL OR br.branch_id = $3::int)
             GROUP BY p.product_id, p.product_name ORDER BY quantity_sold DESC LIMIT 1`,
            [businessId, days, branchId]
        ),
        service.query(
            `SELECT CASE
                WHEN s.sale_time >= TIME '06:00' AND s.sale_time < TIME '11:00' THEN 'Morning'
                WHEN s.sale_time >= TIME '11:00' AND s.sale_time < TIME '14:00' THEN 'Lunch'
                WHEN s.sale_time >= TIME '14:00' AND s.sale_time < TIME '17:00' THEN 'Afternoon'
                ELSE 'Evening' END AS period,
                COUNT(*)::int AS transactions
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             WHERE br.business_id = $1
               AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
               AND ($3::int IS NULL OR br.branch_id = $3::int)
             GROUP BY 1 ORDER BY transactions DESC LIMIT 1`,
            [businessId, days, branchId]
        ),
        service.query(
            `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                    COALESCE(u.name, 'Shared Cashier') AS cashier, br.branch_name
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             LEFT JOIN public.users u ON u.user_id = s.user_id
             WHERE br.business_id = $1 AND ($2::int IS NULL OR br.branch_id = $2::int)
             ORDER BY s.sale_date DESC, s.sale_time DESC, s.sale_id DESC LIMIT 12`,
            [businessId, branchId]
        ),
        service.query(
            `SELECT r.restock_id, p.product_name, sp.supplier_name, r.quantity,
                    r.restock_date, r.restock_time, br.branch_name
             FROM public.restocks r JOIN public.branches br ON br.branch_id = r.branch_id
             JOIN public.products p ON p.product_id = r.product_id
             JOIN public.suppliers sp ON sp.supplier_id = r.supplier_id
             WHERE br.business_id = $1 AND ($2::int IS NULL OR br.branch_id = $2::int)
             ORDER BY r.restock_date DESC, r.restock_time DESC, r.restock_id DESC LIMIT 12`,
            [businessId, branchId]
        ),
        service.query(
            `SELECT br.branch_id, br.branch_name,
                    COALESCE(SUM(CASE WHEN s.sale_date = CURRENT_DATE THEN s.total_amount ELSE 0 END), 0)::numeric(12,2) AS today_sales,
                    COUNT(s.sale_id) FILTER (WHERE s.sale_date = CURRENT_DATE)::int AS transactions_today,
                    COALESCE(stock.total_stock, 0)::bigint AS stock_units,
                    COALESCE(stock.low_stock, 0)::int AS low_stock_items,
                    COALESCE(sold.items_sold_today, 0)::int AS items_sold_today
             FROM public.branches br
             LEFT JOIN public.sales s ON s.branch_id = br.branch_id
             LEFT JOIN LATERAL (
                SELECT SUM(i.quantity)::bigint AS total_stock,
                       COUNT(*) FILTER (WHERE i.quantity > 0 AND i.quantity <= p.minimum_stock)::int AS low_stock
                FROM public.inventory i JOIN public.products p ON p.product_id = i.product_id
                WHERE i.branch_id = br.branch_id AND p.status = 'active'
             ) stock ON TRUE
             LEFT JOIN LATERAL (
                SELECT SUM(si.quantity)::int AS items_sold_today
                FROM public.sales sx
                JOIN public.sale_items si ON si.sale_id = sx.sale_id
                WHERE sx.branch_id = br.branch_id AND sx.sale_date = CURRENT_DATE
             ) sold ON TRUE
             WHERE br.business_id = $1 AND br.status = 'active'
               AND ($2::int IS NULL OR br.branch_id = $2::int)
             GROUP BY br.branch_id, br.branch_name, stock.total_stock, stock.low_stock, sold.items_sold_today
             ORDER BY br.branch_name`,
            [businessId, branchId]
        ),
        service.query(
            `SELECT d::date AS sale_date,
                    COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS total_sales,
                    COUNT(s.sale_id)::int AS transactions
             FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d
             LEFT JOIN public.sales s ON s.sale_date = d::date
                  AND s.branch_id IN (
                      SELECT branch_id FROM public.branches
                      WHERE business_id = $1 AND ($3::int IS NULL OR branch_id = $3::int)
                  )
             GROUP BY d::date ORDER BY d::date`,
            [businessId, days, branchId]
        ),
        service.query(
            `SELECT p.product_name, br.branch_name, i.quantity, p.minimum_stock
             FROM public.inventory i
             JOIN public.branches br ON br.branch_id = i.branch_id
             JOIN public.products p ON p.product_id = i.product_id
             WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active'
               AND i.quantity > 0 AND i.quantity <= p.minimum_stock
               AND ($2::int IS NULL OR br.branch_id = $2::int)
             ORDER BY i.quantity ASC LIMIT 5`,
            [businessId, branchId]
        ),
        service.query(
            `SELECT p.product_id, p.product_name, SUM(si.quantity)::int AS quantity_sold
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             JOIN public.sale_items si ON si.sale_id = s.sale_id
             JOIN public.products p ON p.product_id = si.product_id
             WHERE br.business_id = $1 AND p.business_id = $1
               AND s.sale_date >= CURRENT_DATE - ($2::int - 1)
               AND ($3::int IS NULL OR br.branch_id = $3::int)
             GROUP BY p.product_id, p.product_name ORDER BY quantity_sold DESC LIMIT 5`,
            [businessId, days, branchId]
        )
    ]);

    const s = summary.rows[0] || {};
    return {
        todaySales: Number(s.today_sales || 0),
        totalTransactions: Number(s.total_transactions || 0),
        totalItemsSold: Number(s.total_items_sold || 0),
        businessName: businessRow.rows[0]?.business_name || "",
        totalProducts: Number(s.total_products || 0),
        totalBranches: Number(s.total_branches || 0),
        totalStockUnits: Number(s.total_stock_units || 0),
        lowStockProducts: Number(s.low_stock_products || 0),
        outOfStockProducts: Number(s.out_of_stock_products || 0),
        availableProducts: Number(s.available_products || 0),
        bestSellingProduct: bestSeller.rows[0] || null,
        peakCustomerPeriod: peakPeriod.rows[0] || null,
        recentTransactions: recentSales.rows,
        recentRestocking: recentRestocks.rows,
        branchPerformance: branchPerformance.rows,
        salesByDay: salesByDay.rows,
        lowStockItems: lowStock.rows,
        topSellingProducts: topSelling.rows
    };
}

function parseRangeDays(value) {
    const allowed = [1, 7, 14, 30];
    const days = Number(value);
    return allowed.includes(days) ? days : 7;
}

const handleGetRoot1 = async (req, res) => {
    const businessId = Number(req.staffUser?.business_id);
    if (!Number.isSafeInteger(businessId) || businessId < 1) {
        return res.status(403).json({ success: false, message: "Your account is not assigned to a business." });
    }
    try {
        const data = await getDashboardData(businessId, parseRangeDays(req.query.days), getBranchScope(req));
        return res.json({ success: true, data, scope: getBranchScope(req) ? "branch" : "all_branches" });
    } catch (error) {
        console.error("Dashboard:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load the dashboard." });
    }
};

const handleGetRecentSales2 = async (req, res) => {
    try {
        const result = await service.query(
            `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                    COALESCE(u.name, 'Shared Cashier') AS cashier, br.branch_name
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             LEFT JOIN public.users u ON u.user_id = s.user_id
             WHERE br.business_id = $1 AND ($2::int IS NULL OR br.branch_id = $2::int)
             ORDER BY s.sale_date DESC, s.sale_time DESC LIMIT 10`,
            [req.staffUser.business_id, getBranchScope(req)]
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Dashboard recent sales:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load recent sales." });
    }
};

const handleGetRecentRestocks3 = async (req, res) => {
    try {
        const result = await service.query(
            `SELECT r.restock_id, p.product_name, sp.supplier_name, r.quantity,
                    r.restock_date, r.restock_time, br.branch_name
             FROM public.restocks r JOIN public.branches br ON br.branch_id = r.branch_id
             JOIN public.products p ON p.product_id = r.product_id
             JOIN public.suppliers sp ON sp.supplier_id = r.supplier_id
             WHERE br.business_id = $1 AND ($2::int IS NULL OR br.branch_id = $2::int)
             ORDER BY r.restock_date DESC, r.restock_time DESC LIMIT 10`,
            [req.staffUser.business_id, getBranchScope(req)]
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Dashboard recent restocks:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load recent restocks." });
    }
};

const handleGetPeakPeriod4 = async (req, res) => {
    try {
        const result = await service.query(
            `SELECT CASE WHEN s.sale_time >= TIME '06:00' AND s.sale_time < TIME '11:00' THEN 'Morning'
                         WHEN s.sale_time >= TIME '11:00' AND s.sale_time < TIME '14:00' THEN 'Lunch'
                         WHEN s.sale_time >= TIME '14:00' AND s.sale_time < TIME '17:00' THEN 'Afternoon'
                         ELSE 'Evening' END AS period, COUNT(*)::int AS transactions
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE
               AND ($2::int IS NULL OR br.branch_id = $2::int)
             GROUP BY 1 ORDER BY transactions DESC LIMIT 1`,
            [req.staffUser.business_id, getBranchScope(req)]
        );
        return res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        console.error("Dashboard peak period:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load peak sales period." });
    }
};

module.exports = { handleGetRoot1, handleGetRecentSales2, handleGetRecentRestocks3, handleGetPeakPeriod4 };