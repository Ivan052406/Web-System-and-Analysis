const service = require("./dashboard.service.js");

async function getDashboardData(businessId) {
    const [summary, bestSeller, peakPeriod, recentSales, recentRestocks, branchPerformance] = await Promise.all([
        service.query(
            `SELECT
                (SELECT COUNT(*) FROM public.products p WHERE p.business_id = $1 AND p.status = 'active')::int AS total_products,
                (SELECT COUNT(*) FROM public.branches br WHERE br.business_id = $1 AND br.status = 'active')::int AS total_branches,
                (SELECT COUNT(*) FROM public.inventory i JOIN public.branches br ON br.branch_id = i.branch_id JOIN public.products p ON p.product_id = i.product_id WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active' AND i.quantity > 0 AND i.quantity <= p.minimum_stock)::int AS low_stock_products,
                (SELECT COUNT(*) FROM public.inventory i JOIN public.branches br ON br.branch_id = i.branch_id JOIN public.products p ON p.product_id = i.product_id WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active' AND i.quantity = 0)::int AS out_of_stock_products,
                (SELECT COUNT(*) FROM public.inventory i JOIN public.branches br ON br.branch_id = i.branch_id JOIN public.products p ON p.product_id = i.product_id WHERE br.business_id = $1 AND br.status = 'active' AND p.status = 'active' AND i.quantity > 0)::int AS available_products,
                (SELECT COALESCE(SUM(i.quantity), 0) FROM public.inventory i JOIN public.branches br ON br.branch_id = i.branch_id WHERE br.business_id = $1 AND br.status = 'active')::bigint AS total_stock_units,
                (SELECT COALESCE(SUM(s.total_amount), 0) FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE)::numeric(12,2) AS today_sales,
                (SELECT COUNT(*) FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE)::int AS total_transactions,
                (SELECT COALESCE(SUM(si.quantity), 0) FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id JOIN public.sale_items si ON si.sale_id = s.sale_id WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE)::int AS total_items_sold`,
            [businessId]
        ),
        service.query(
            `SELECT p.product_id, p.product_name, SUM(si.quantity)::int AS quantity_sold
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             JOIN public.sale_items si ON si.sale_id = s.sale_id
             JOIN public.products p ON p.product_id = si.product_id
             WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE AND p.business_id = $1
             GROUP BY p.product_id, p.product_name ORDER BY quantity_sold DESC LIMIT 1`,
            [businessId]
        ),
        service.query(
            `SELECT CASE
                WHEN s.sale_time >= TIME '06:00' AND s.sale_time < TIME '11:00' THEN 'Morning'
                WHEN s.sale_time >= TIME '11:00' AND s.sale_time < TIME '14:00' THEN 'Lunch'
                WHEN s.sale_time >= TIME '14:00' AND s.sale_time < TIME '17:00' THEN 'Afternoon'
                ELSE 'Evening' END AS period,
                COUNT(*)::int AS transactions
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             WHERE br.business_id = $1 AND s.sale_date = CURRENT_DATE
             GROUP BY 1 ORDER BY transactions DESC LIMIT 1`,
            [businessId]
        ),
        service.query(
            `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                    COALESCE(u.name, 'Shared Cashier') AS cashier, br.branch_name
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             LEFT JOIN public.users u ON u.user_id = s.user_id
             WHERE br.business_id = $1
             ORDER BY s.sale_date DESC, s.sale_time DESC, s.sale_id DESC LIMIT 12`,
            [businessId]
        ),
        service.query(
            `SELECT r.restock_id, p.product_name, sp.supplier_name, r.quantity,
                    r.restock_date, r.restock_time, br.branch_name
             FROM public.restocks r JOIN public.branches br ON br.branch_id = r.branch_id
             JOIN public.products p ON p.product_id = r.product_id
             JOIN public.suppliers sp ON sp.supplier_id = r.supplier_id
             WHERE br.business_id = $1
             ORDER BY r.restock_date DESC, r.restock_time DESC, r.restock_id DESC LIMIT 12`,
            [businessId]
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
             GROUP BY br.branch_id, br.branch_name, stock.total_stock, stock.low_stock, sold.items_sold_today
             ORDER BY br.branch_name`,
            [businessId]
        )
    ]);
    const s = summary.rows[0] || {};
    return {
        todaySales: Number(s.today_sales || 0),
        totalTransactions: Number(s.total_transactions || 0),
        totalItemsSold: Number(s.total_items_sold || 0),
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
        branchPerformance: branchPerformance.rows
    };
}

const handleGetRoot1 = async (req, res) => {
    const businessId = Number(req.staffUser?.business_id);
    if (!Number.isSafeInteger(businessId) || businessId < 1) {
        return res.status(403).json({ success: false, message: "Your account is not assigned to a business." });
    }
    try {
        const data = await getDashboardData(businessId);
        return res.json({ success: true, data, scope: "all_branches" });
    } catch (error) {
        console.error("All-branch dashboard:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load the all-branch dashboard." });
    }
};

const handleGetRecentSales2 = async (req, res) => {
    try {
        const result = await service.query(
            `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                    COALESCE(u.name, 'Shared Cashier') AS cashier, br.branch_name
             FROM public.sales s JOIN public.branches br ON br.branch_id = s.branch_id
             LEFT JOIN public.users u ON u.user_id = s.user_id
             WHERE br.business_id = $1 ORDER BY s.sale_date DESC, s.sale_time DESC LIMIT 10`,
            [req.staffUser.business_id]
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
             WHERE br.business_id = $1 ORDER BY r.restock_date DESC, r.restock_time DESC LIMIT 10`,
            [req.staffUser.business_id]
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
             GROUP BY 1 ORDER BY transactions DESC LIMIT 1`,
            [req.staffUser.business_id]
        );
        return res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        console.error("Dashboard peak period:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load peak sales period." });
    }
};

module.exports = { handleGetRoot1, handleGetRecentSales2, handleGetRecentRestocks3, handleGetPeakPeriod4 };
