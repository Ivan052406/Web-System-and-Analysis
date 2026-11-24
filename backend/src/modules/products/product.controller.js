/* =====================================================
   CASIA PRODUCT ROUTES
   ===================================================== */



const service = require("./product.service.js");
const db = service.db;
const { requireRole } = require("../../middleware/auth.middleware");


// GET /api/data



// POST /api/addProduct



// PUT /api/products/:id



// PATCH /api/products/:id/status



// DELETE /api/products/:id

// Express request handlers extracted from the original route declarations.
const handleGetData1 = async (req, res) => {
    try {
        const businessId = Number(req.staffUser?.business_id);
        if (!Number.isSafeInteger(businessId) || businessId < 1) {
            return res.status(403).json({ success: false, message: "Business access is required." });
        }
        let stockJoin;
        let params;
        if (req.allBranchesSelected && req.staffUser.role === "admin") {
            stockJoin = `LEFT JOIN (
                SELECT i.product_id, SUM(i.quantity)::int AS quantity
                FROM public.inventory i
                JOIN public.branches br ON br.branch_id = i.branch_id
                WHERE br.status = 'active'
                GROUP BY i.product_id
            ) i ON i.product_id = p.product_id`;
            params = [businessId];
        } else {
            const branchId = Number(req.selectedBranchId || req.staffUser.branch_id);
            if (!Number.isSafeInteger(branchId) || branchId < 1) {
                return res.status(400).json({ success: false, message: "Select a branch first." });
            }
            stockJoin = `LEFT JOIN public.inventory i
                ON i.product_id = p.product_id AND i.branch_id = $2`;
            params = [businessId, branchId];
        }
        const result = await service.query(`
            SELECT p.product_id, p.category_id, p.product_name, p.price,
                   p.minimum_stock, p.status, p.created_at,
                   c.category_name, COALESCE(i.quantity, 0)::int AS quantity
            FROM public.products p
            LEFT JOIN public.categories c ON p.category_id = c.category_id
            ${stockJoin}
            WHERE p.business_id = $1
            ORDER BY p.product_id DESC
        `, params);
        return res.json(result.rows);
    } catch (error) {
        console.error("Load products:", error.message);
        return res.status(500).json({ success: false, message: "Failed to load products." });
    }
};

const handlePostAddProduct2 = async (req, res) => {
    const { category_id, product_name, price, minimum_stock = 0 } = req.body;

    const categoryId = Number(category_id);
    const productPrice = Number(price);
    const minStock = Number(minimum_stock);
    const businessId = Number(req.staffUser?.business_id);

    if (
        !Number.isInteger(businessId) || businessId < 1 ||
        !Number.isInteger(categoryId) || categoryId < 1 ||
        typeof product_name !== "string" || !product_name.trim() ||
        !Number.isFinite(productPrice) || productPrice < 0 ||
        !Number.isInteger(minStock) || minStock < 0
    ) {
        return res.status(400).json({
            message: "Please provide valid product information."
        });
    }

    let client;

    try {
        client = await db.connect();
        await client.query("BEGIN");

        const inserted = await client.query(
            `INSERT INTO products
                (category_id, product_name, price, minimum_stock, business_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING product_id`,
            [categoryId, product_name.trim(), productPrice, minStock, businessId]
        );

        const productId = inserted.rows[0].product_id;

        await client.query(
            `INSERT INTO public.inventory (branch_id, product_id, quantity)
             SELECT branch_id, $1, 0
             FROM public.branches
             WHERE business_id = $2 AND status = 'active'
             ON CONFLICT (branch_id, product_id) DO NOTHING`,
            [productId, businessId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Product added successfully!",
            product_id: productId
        });

    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});

        console.error("Add product:", error.message);
        res.status(500).json({ message: "Failed to add product." });

    } finally {
        if (client) client.release();
    }
};

const handlePutProductsId3 = async (req, res) => {
    const productId = Number(req.params.id);
    const businessId = Number(req.staffUser?.business_id);
    const { category_id, product_name, price, minimum_stock } = req.body;

    if (!Number.isInteger(businessId) || businessId < 1) {
        return res.status(403).json({ message: "Your account is not assigned to an active business." });
    }

    if (
        !Number.isInteger(productId) || productId < 1 ||
        !Number.isInteger(Number(category_id)) ||
        typeof product_name !== "string" || !product_name.trim() ||
        !Number.isFinite(Number(price)) || Number(price) < 0 ||
        !Number.isInteger(Number(minimum_stock)) ||
        Number(minimum_stock) < 0
    ) {
        return res.status(400).json({
            message: "Invalid product information."
        });
    }

    try {
        const result = await service.query(
            `UPDATE products
             SET category_id = $1,
                 product_name = $2,
                 price = $3,
                 minimum_stock = $4
             WHERE product_id = $5
               AND business_id = $6
             RETURNING *`,
            [
                Number(category_id),
                product_name.trim(),
                Number(price),
                Number(minimum_stock),
                productId,
                businessId
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({ message: "Product not found." });
        }

        res.json({
            success: true,
            message: "Product updated successfully.",
            product: result.rows[0]
        });

    } catch (error) {
        console.error("Update product:", error.message);
        res.status(500).json({ message: "Failed to update product." });
    }
};

const handlePatchProductsIdStatus4 = async (req, res) => {
    const productId = Number(req.params.id);
    const businessId = Number(req.staffUser?.business_id);
    const { status } = req.body;

    if (!Number.isInteger(businessId) || businessId < 1) {
        return res.status(403).json({ message: "Your account is not assigned to an active business." });
    }

    if (!Number.isInteger(productId) || productId < 1 ||
        !["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Invalid product status." });
    }

    try {
        const result = await service.query(
            `UPDATE products
             SET status = $1
             WHERE product_id = $2
               AND business_id = $3
             RETURNING product_id, status`,
            [status, productId, businessId]
        );

        if (!result.rowCount) {
            return res.status(404).json({ message: "Product not found." });
        }

        res.json({
            success: true,
            message: "Product status updated.",
            product: result.rows[0]
        });

    } catch (error) {
        console.error("Change product status:", error.message);
        res.status(500).json({ message: "Failed to update status." });
    }
};

const handleDeleteProductsId5 = async (req, res) => {
    const productId = Number(req.params.id);
    const businessId = Number(req.staffUser?.business_id);

    if (!Number.isInteger(businessId) || businessId < 1) {
        return res.status(403).json({ message: "Your account is not assigned to an active business." });
    }

    if (!Number.isInteger(productId) || productId < 1) {
        return res.status(400).json({ message: "Invalid product ID." });
    }

    let client;

    try {
        client = await db.connect();
        await client.query("BEGIN");

        const product = await client.query(
            `SELECT product_id FROM public.products
             WHERE product_id = $1
               AND business_id = $2
             FOR UPDATE`,
            [productId, businessId]
        );

        if (!product.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Product not found." });
        }

        const sales = await client.query(
            "SELECT COUNT(*) AS total FROM sale_items WHERE product_id = $1",
            [productId]
        );

        const restocks = await client.query(
            "SELECT COUNT(*) AS total FROM public.restocks WHERE product_id = $1",
            [productId]
        );
        const inventoryHistory = await client.query(
            "SELECT COUNT(*) AS total FROM public.inventory_history WHERE product_id = $1",
            [productId]
        );

        if (
            Number(sales.rows[0].total) > 0 ||
            Number(restocks.rows[0].total) > 0 ||
            Number(inventoryHistory.rows[0].total) > 0
        ) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "This product has transaction history. Deactivate it instead."
            });
        }

        await client.query(
            "DELETE FROM inventory WHERE product_id = $1",
            [productId]
        );

        await client.query(
            "DELETE FROM products WHERE product_id = $1",
            [productId]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Product deleted successfully!"
        });

    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});

        console.error("Delete product:", error.message);
        res.status(500).json({ message: "Failed to delete product." });

    } finally {
        if (client) client.release();
    }
};

module.exports = { handleGetData1, handlePostAddProduct2, handlePutProductsId3, handlePatchProductsIdStatus4, handleDeleteProductsId5 };
