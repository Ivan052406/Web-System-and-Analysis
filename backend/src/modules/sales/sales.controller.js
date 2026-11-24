/* =====================================================
   CASIA SALES ROUTES
   ===================================================== */



const service = require("./sales.service.js");
const db = service.db;
const { requireRole } = require("../../middleware/auth.middleware");

// POST /api/sales/complete



// GET /api/sales/recent



// GET /api/sales/summary

// Express request handlers extracted from the original route declarations.
const handlePostComplete1 = async (req, res) => {
    const { items } = req.body;
    const userId = req.staffUser.user_id;
    const businessId = Number(req.staffUser.business_id);
    const branchId = Number(req.selectedBranchId || req.staffUser.branch_id);

    if (!Number.isInteger(businessId) || businessId < 1 || !Number.isSafeInteger(branchId) || branchId < 1) {
        return res.status(403).json({
            success: false,
            message: "Your account is not assigned to an active business."
        });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            message: "Please add at least one product to the order."
        });
    }

    // Combine repeated product IDs
    const quantities = new Map();

    for (const item of items) {
        if (!item || typeof item !== "object") {
            return res.status(400).json({ success: false, message: "Invalid order item." });
        }
        const id = Number(item.product_id);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(id) || id < 1 ||
            !Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({
                message: "Invalid product or quantity."
            });
        }

        quantities.set(id, (quantities.get(id) || 0) + quantity);
    }

    let client;

    try {
        client = await db.connect();
        await client.query("BEGIN");

        const orderItems = [];
        let totalAmount = 0;

        for (const [productId, quantity] of quantities) {
            const productResult = await client.query(
                `SELECT product_id, product_name, price, status
                 FROM public.products
                 WHERE product_id = $1
                   AND business_id = $2
                 FOR UPDATE`,
                [productId, businessId]
            );

            if (!productResult.rowCount ||
                productResult.rows[0].status !== "active") {
                const error = new Error("A selected product is unavailable.");
                error.statusCode = 409;
                throw error;
            }

            const stockResult = await client.query(
                `SELECT quantity
                 FROM inventory
                 WHERE product_id = $1 AND branch_id = $2
                 FOR UPDATE`,
                [productId, branchId]
            );

            if (!stockResult.rowCount) {
                const error = new Error("Inventory record is missing.");
                error.statusCode = 409;
                throw error;
            }

            const product = productResult.rows[0];
            const stockBefore = Number(stockResult.rows[0].quantity);

            if (quantity > stockBefore) {
                const error = new Error(
                    `Insufficient stock for ${product.product_name}. Available: ${stockBefore}.`
                );
                error.statusCode = 409;
                throw error;
            }

            const unitPrice = Number(product.price);
            const subtotal = unitPrice * quantity;
            const stockAfter = stockBefore - quantity;

            totalAmount += subtotal;

            orderItems.push({
                product_id: productId,
                product_name: product.product_name,
                quantity,
                unit_price: unitPrice,
                subtotal,
                stock_before: stockBefore,
                stock_after: stockAfter
            });
        }

        const saleResult = await client.query(
            `INSERT INTO sales
                (user_id, branch_id, total_amount, sale_date, sale_time)
             VALUES ($1, $2, $3, CURRENT_DATE, LOCALTIME)
             RETURNING sale_id, sale_date, sale_time`,
            [userId, branchId, totalAmount]
        );

        const sale = saleResult.rows[0];

        for (const item of orderItems) {
            await client.query(
                `INSERT INTO sale_items
                    (sale_id, product_id, quantity, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    sale.sale_id,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    item.subtotal
                ]
            );

            await client.query(
                `UPDATE inventory
                 SET quantity = $1
                 WHERE product_id = $2 AND branch_id = $3`,
                [item.stock_after, item.product_id, branchId]
            );

            await client.query(
                `INSERT INTO inventory_history
                    (product_id, branch_id, user_id, change_type,
                     quantity_before, quantity_after, quantity_change, reason)
                 VALUES ($1, $2, $3, 'sale', $4, $5, $6, $7)`,
                [
                    item.product_id,
                    branchId,
                    userId,
                    item.stock_before,
                    item.stock_after,
                    -item.quantity,
                    `Sale #${sale.sale_id}`
                ]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Sale completed successfully.",
            sale_id: sale.sale_id,
            total_amount: totalAmount,
            items: orderItems
        });

    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});

        console.error("Complete sale:", error.message);

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Failed to complete sale."
        });

    } finally {
        if (client) client.release();
    }
};

const handleGetRecent2 = async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    try {
        let result;
        if (req.staffUser?.role === "admin" && req.allBranchesSelected) {
            result = await service.query(
                `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                        b.business_name AS business_name, br.branch_name
                 FROM public.sales s
                 JOIN public.branches br ON br.branch_id = s.branch_id
                 LEFT JOIN public.businesses b ON b.business_id = br.business_id
                 WHERE br.business_id = $1
                 ORDER BY s.sale_date DESC, s.sale_time DESC, s.sale_id DESC
                 LIMIT $2`,
                [req.staffUser.business_id, limit]
            );
        } else {
            const branchId = Number(req.selectedBranchId || req.staffUser?.branch_id);
            if (!Number.isSafeInteger(branchId) || branchId < 1) {
                return res.status(400).json({ success: false, message: "Select a branch to view recent sales." });
            }
            result = await service.query(
                `SELECT s.sale_id, s.total_amount, s.sale_date, s.sale_time,
                        b.business_name AS business_name, br.branch_name
                 FROM public.sales s
                 JOIN public.branches br ON br.branch_id = s.branch_id
                 LEFT JOIN public.users u ON u.user_id = s.user_id
                 WHERE s.branch_id = $1 AND br.business_id = $2
                 ORDER BY s.sale_date DESC, s.sale_time DESC, s.sale_id DESC
                 LIMIT $3`,
                [branchId, req.staffUser.business_id, limit]
            );
        }
        return res.json(result.rows);
    } catch (error) {
        console.error("Recent sales:", error.message);
        return res.status(500).json({ message: "Failed to load sales." });
    }
};

const handleGetSummary3 = async (req, res) => {
    try {
        const allBranches = req.staffUser?.role === "admin" && req.allBranchesSelected;
        const branchId = Number(req.selectedBranchId || req.staffUser?.branch_id);
        const values = allBranches ? [req.staffUser.business_id] : [branchId, req.staffUser.business_id];
        const branchClause = allBranches ? "br.business_id = $1" : "s.branch_id = $1 AND br.business_id = $2";
        const result = await service.query(
            `SELECT COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS today_sales,
                    COUNT(*)::int AS transaction_count
             FROM public.sales s
             JOIN public.branches br ON br.branch_id = s.branch_id
             WHERE ${branchClause} AND s.sale_date = CURRENT_DATE`,
            values
        );
        const itemResult = await service.query(
            `SELECT COALESCE(SUM(si.quantity), 0)::int AS items_sold
             FROM public.sales s
             JOIN public.branches br ON br.branch_id = s.branch_id
             JOIN public.sale_items si ON si.sale_id = s.sale_id
             WHERE ${branchClause} AND s.sale_date = CURRENT_DATE`,
            values
        );
        return res.json({
            todaySales: Number(result.rows[0].today_sales),
            transactionCount: Number(result.rows[0].transaction_count),
            itemsSold: Number(itemResult.rows[0].items_sold)
        });
    } catch (error) {
        console.error("Sales summary:", error.message);
        return res.status(500).json({ message: "Failed to load sales summary." });
    }
};

module.exports = { handlePostComplete1, handleGetRecent2, handleGetSummary3 };
