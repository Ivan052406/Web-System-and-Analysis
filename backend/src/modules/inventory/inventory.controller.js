/* CASIA INVENTORY MANAGEMENT ROUTES */



const service = require("./inventory.service.js");
const db = service.db;

// Get the business and user from the authenticated session

function getAccount(req, res) {
    const businessId = Number(req.staffUser?.business_id);
    const userId = Number(req.staffUser?.user_id);
    const branchId = Number(req.selectedBranchId);

    if (
        !Number.isSafeInteger(businessId) ||
        businessId < 1 ||
        !Number.isSafeInteger(userId) || userId < 1 ||
        !Number.isSafeInteger(branchId) || branchId < 1
    ) {
        res.status(403).json({
            success: false,
            message: "Your account is not assigned to a valid business."
        });

        return null;
    }

    return { businessId, userId, branchId };
}

function stockStatus(quantity, minimumStock) {
    if (quantity <= 0) return "out";
    if (quantity <= minimumStock) return "low";
    return "available";
}

// GET INVENTORY
// GET /api/inventory



// GET INVENTORY HISTORY
// GET /api/inventory/history



// UPDATE MINIMUM STOCK
// PATCH /api/inventory/:productId/minimum-stock



// MANUAL STOCK-IN
// POST /api/inventory/stock-in



// STOCK ADJUSTMENT
// POST /api/inventory/adjustment

// Express request handlers extracted from the original route declarations.
const handleGetRoot1 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    try {
        const result = await service.query(
            `SELECT
                p.product_id,
                p.product_name,
                p.price,
                p.minimum_stock,
                p.status AS product_status,
                p.category_id,
                c.category_name,
                COALESCE(i.quantity, 0) AS current_stock,
                i.updated_at,
                CASE
                    WHEN COALESCE(i.quantity, 0) <= 0
                        THEN 'out'
                    WHEN COALESCE(i.quantity, 0) <= p.minimum_stock
                        THEN 'low'
                    ELSE 'available'
                END AS stock_status
             FROM public.products p
             LEFT JOIN public.categories c
                ON c.category_id = p.category_id
             LEFT JOIN public.inventory i
                ON i.product_id = p.product_id AND i.branch_id = $2
             WHERE p.business_id = $1
             ORDER BY p.product_name ASC`,
            [account.businessId, account.branchId]
        );

        const products = result.rows.map(product => ({
            ...product,
            price: Number(product.price),
            minimum_stock: Number(product.minimum_stock),
            current_stock: Number(product.current_stock)
        }));

        const totalProducts = products.length;

        const lowStock = products.filter(
            p => p.stock_status === "low"
        ).length;

        const outOfStock = products.filter(
            p => p.stock_status === "out"
        ).length;

        const available = products.filter(
            p => p.stock_status === "available"
        ).length;

        return res.json({
            success: true,
            summary: {
                total_products: totalProducts,
                available_products: available,
                low_stock_products: lowStock,
                out_of_stock_products: outOfStock
            },
            products
        });

    } catch (error) {
        console.error("Inventory retrieval:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load inventory."
        });
    }
};

const handleGetHistory2 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    try {
        const result = await service.query(
            `SELECT
                h.history_id,
                h.product_id,
                p.product_name,
                h.change_type,
                h.quantity_before,
                h.quantity_after,
                h.quantity_change,
                h.reason,
                h.created_at,
                u.name AS performed_by
             FROM public.inventory_history h
             INNER JOIN public.products p
                ON p.product_id = h.product_id
             LEFT JOIN public.users u
                ON u.user_id = h.user_id
             WHERE p.business_id = $1 AND h.branch_id = $2
             ORDER BY h.created_at DESC
             LIMIT 200`,
            [account.businessId, account.branchId]
        );

        return res.json({
            success: true,
            history: result.rows
        });

    } catch (error) {
        console.error("Inventory history:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load inventory history."
        });
    }
};

const handlePatchProductIdMinimumStock3 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const productId = Number(req.params.productId);
    const minimumStock = Number(req.body.minimum_stock);

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(minimumStock) ||
        minimumStock < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid product and minimum stock value."
        });
    }

    try {
        const result = await service.query(
            `UPDATE public.products
             SET minimum_stock = $1
             WHERE product_id = $2
               AND business_id = $3
             RETURNING product_id, product_name, minimum_stock`,
            [
                minimumStock,
                productId,
                account.businessId
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        return res.json({
            success: true,
            message: "Minimum stock updated successfully.",
            product: result.rows[0]
        });

    } catch (error) {
        console.error("Minimum stock update:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update minimum stock."
        });
    }
};

const handlePostStockIn4 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity);

    const reason = typeof req.body.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        !reason
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide a product, positive stock quantity, and reason."
        });
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const product = await client.query(
            `SELECT product_id, product_name
             FROM public.products
             WHERE product_id = $1
               AND business_id = $2
             FOR UPDATE`,
            [
                productId,
                account.businessId
            ]
        );

        if (!product.rowCount) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Product not found in your business."
            });
        }

        // Ensure an inventory record exists.

        await client.query(
            `INSERT INTO public.inventory
                (branch_id, product_id, quantity)
             VALUES ($1, $2, 0)
             ON CONFLICT (branch_id, product_id) DO NOTHING`,
            [account.branchId, productId]
        );

        const stockResult = await client.query(
            `SELECT quantity
             FROM public.inventory
             WHERE product_id = $1 AND branch_id = $2
             FOR UPDATE`,
            [productId, account.branchId]
        );

        const previousStock = Number(
            stockResult.rows[0].quantity
        );

        const newStock = previousStock + quantity;

        if (!Number.isSafeInteger(newStock)) {
            throw new Error("Stock quantity exceeds the allowed limit.");
        }

        await client.query(
            `UPDATE public.inventory
             SET quantity = $1
             WHERE product_id = $2 AND branch_id = $3`,
            [newStock, productId, account.branchId]
        );

        await client.query(
            `INSERT INTO public.inventory_history
                (
                    product_id,
                    branch_id,
                    user_id,
                    change_type,
                    quantity_before,
                    quantity_after,
                    quantity_change,
                    reason
                )
             VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7)`,
            [
                productId,
                account.branchId,
                account.userId,
                previousStock,
                newStock,
                quantity,
                `Manual stock-in: ${reason}`
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Stock-in recorded successfully.",
            previous_stock: previousStock,
            added_quantity: quantity,
            current_stock: newStock
        });

    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Inventory stock-in:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to record stock-in."
        });

    } finally {
        client.release();
    }
};

const handlePostAdjustment5 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const productId = Number(req.body.product_id);
    const countedStock = Number(req.body.counted_stock);

    const reason = typeof req.body.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(countedStock) ||
        countedStock < 0 ||
        !reason
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid product, counted stock, and adjustment reason."
        });
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const product = await client.query(
            `SELECT product_id, product_name
             FROM public.products
             WHERE product_id = $1
               AND business_id = $2
             FOR UPDATE`,
            [
                productId,
                account.businessId
            ]
        );

        if (!product.rowCount) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Product not found in your business."
            });
        }

        await client.query(
            `INSERT INTO public.inventory
                (branch_id, product_id, quantity)
             VALUES ($1, $2, 0)
             ON CONFLICT (branch_id, product_id) DO NOTHING`,
            [account.branchId, productId]
        );

        const stockResult = await client.query(
            `SELECT quantity
             FROM public.inventory
             WHERE product_id = $1 AND branch_id = $2
             FOR UPDATE`,
            [productId, account.branchId]
        );

        const previousStock = Number(
            stockResult.rows[0].quantity
        );

        const quantityChange = countedStock - previousStock;

        if (quantityChange === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "The counted stock is the same as the recorded stock. No adjustment is needed."
            });
        }

        await client.query(
            `UPDATE public.inventory
             SET quantity = $1
             WHERE product_id = $2 AND branch_id = $3`,
            [
                countedStock,
                productId,
                account.branchId
            ]
        );

        await client.query(
            `INSERT INTO public.inventory_history
                (
                    product_id,
                    branch_id,
                    user_id,
                    change_type,
                    quantity_before,
                    quantity_after,
                    quantity_change,
                    reason
                )
             VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7)`,
            [
                productId,
                account.branchId,
                account.userId,
                previousStock,
                countedStock,
                quantityChange,
                reason
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Stock adjustment completed successfully.",
            previous_stock: previousStock,
            current_stock: countedStock,
            quantity_change: quantityChange
        });

    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Inventory adjustment:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to adjust inventory."
        });

    } finally {
        client.release();
    }
};

module.exports = { handleGetRoot1, handleGetHistory2, handlePatchProductIdMinimumStock3, handlePostStockIn4, handlePostAdjustment5 };
