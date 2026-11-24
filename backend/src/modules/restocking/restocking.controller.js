/* CASIA RESTOCKING MANAGEMENT ROUTES */



const service = require("./restocking.service.js");
const db = service.db;

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

function validText(value, maxLength) {
    return typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= maxLength;
}

function validDays(value) {
    const days = Number(value || 30);
    return [7, 30, 90, 365].includes(days) ? days : 30;
}

// GET RESTOCKING DASHBOARD
// GET /api/restocking/dashboard?days=30



// GET SUPPLIERS
// GET /api/restocking/suppliers



// ADD SUPPLIER
// POST /api/restocking/suppliers



// UPDATE SUPPLIER
// PATCH /api/restocking/suppliers/:supplierId



// GET PRODUCTS AVAILABLE FOR RESTOCKING
// GET /api/restocking/products



// GET RESTOCKING HISTORY
// GET /api/restocking/history



// RECORD RESTOCK
// POST /api/restocking/record

// Express request handlers extracted from the original route declarations.
const handleGetDashboard1 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const days = validDays(req.query.days);

    try {
        const [
            summaryResult,
            productChartResult,
            trendResult,
            supplierResult,
            historyResult,
            productResult
        ] = await Promise.all([

            service.query(
                `SELECT
                    COUNT(*)::int AS total_restocks,
                    COALESCE(SUM(r.quantity), 0)::int AS total_units,
                    COUNT(DISTINCT r.product_id)::int AS products_restocked,
                    COUNT(DISTINCT r.supplier_id)::int AS suppliers_used
                 FROM public.restocks r
                 INNER JOIN public.products p
                    ON p.product_id = r.product_id
                 INNER JOIN public.suppliers s
                    ON s.supplier_id = r.supplier_id
                 WHERE p.business_id = $1
                   AND s.business_id = $1
                   AND r.branch_id = $3
                   AND r.restock_date >=
                       CURRENT_DATE - ($2::int - 1)
                 `,
                [account.businessId, days, account.branchId]
            ),

            service.query(
                `SELECT
                    p.product_name,
                    SUM(r.quantity)::int AS total_quantity
                 FROM public.restocks r
                 INNER JOIN public.products p
                    ON p.product_id = r.product_id
                 INNER JOIN public.suppliers s
                    ON s.supplier_id = r.supplier_id
                 WHERE p.business_id = $1
                   AND s.business_id = $1
                   AND r.branch_id = $3
                   AND r.restock_date >=
                       CURRENT_DATE - ($2::int - 1)
                 GROUP BY p.product_id, p.product_name
                 ORDER BY total_quantity DESC
                 LIMIT 10`,
                [account.businessId, days, account.branchId]
            ),

            service.query(
                `WITH date_series AS (
                    SELECT generate_series(
                        CURRENT_DATE - ($2::int - 1),
                        CURRENT_DATE,
                        INTERVAL '1 day'
                    )::date AS restock_day
                 ),
                 daily_totals AS (
                    SELECT
                        r.restock_date,
                        SUM(r.quantity)::int AS total_quantity
                    FROM public.restocks r
                    INNER JOIN public.products p
                        ON p.product_id = r.product_id
                    INNER JOIN public.suppliers s
                        ON s.supplier_id = r.supplier_id
                    WHERE p.business_id = $1
                      AND s.business_id = $1
                      AND r.branch_id = $3
                      AND r.restock_date >=
                          CURRENT_DATE - ($2::int - 1)
                    GROUP BY r.restock_date
                 )
                 SELECT
                    TO_CHAR(d.restock_day, 'Mon DD') AS label,
                    COALESCE(t.total_quantity, 0)::int AS quantity
                 FROM date_series d
                 LEFT JOIN daily_totals t
                    ON t.restock_date = d.restock_day
                 ORDER BY d.restock_day`,
                [account.businessId, days, account.branchId]
            ),

            service.query(
                `SELECT
                    supplier_id,
                    supplier_name,
                    contact_number,
                    address,
                    status
                 FROM public.suppliers
                 WHERE business_id = $1
                 ORDER BY
                    CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                    supplier_name ASC`,
                [account.businessId]
            ),

            service.query(
                `SELECT
                    r.restock_id,
                    r.product_id,
                    p.product_name,
                    r.supplier_id,
                    s.supplier_name,
                    r.quantity,
                    r.restock_date,
                    r.restock_time,
                    r.user_id,
                    u.name AS performed_by
                 FROM public.restocks r
                 INNER JOIN public.products p
                    ON p.product_id = r.product_id
                 INNER JOIN public.suppliers s
                    ON s.supplier_id = r.supplier_id
                 LEFT JOIN public.users u
                    ON u.user_id = r.user_id
                 WHERE p.business_id = $1
                   AND s.business_id = $1
                   AND r.branch_id = $2
                 ORDER BY
                    r.restock_date DESC,
                    r.restock_time DESC,
                    r.restock_id DESC
                 LIMIT 100`,
                [account.businessId, account.branchId]
            ),

            service.query(
                `SELECT
                    p.product_id,
                    p.product_name,
                    COALESCE(i.quantity, 0)::int AS current_stock
                 FROM public.products p
                 LEFT JOIN public.inventory i
                    ON i.product_id = p.product_id AND i.branch_id = $2
                 WHERE p.business_id = $1
                   AND p.status = 'active'
                 ORDER BY p.product_name ASC`,
                [account.businessId, account.branchId]
            )
        ]);

        return res.json({
            success: true,
            days,
            summary: summaryResult.rows[0],
            productChart: productChartResult.rows,
            trendChart: trendResult.rows,
            suppliers: supplierResult.rows,
            history: historyResult.rows,
            products: productResult.rows
        });

    } catch (error) {
        console.error("Restocking dashboard:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load restocking dashboard."
        });
    }
};

const handleGetSuppliers2 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    try {
        const result = await service.query(
            `SELECT
                supplier_id,
                supplier_name,
                contact_number,
                address,
                status
             FROM public.suppliers
             WHERE business_id = $1
             ORDER BY supplier_name ASC`,
            [account.businessId]
        );

        return res.json({
            success: true,
            suppliers: result.rows
        });

    } catch (error) {
        console.error("Supplier retrieval:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load suppliers."
        });
    }
};

const handlePostSuppliers3 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const { supplier_name, contact_number, address } = req.body;

    const name = typeof supplier_name === "string"
        ? supplier_name.trim()
        : "";

    const contact = typeof contact_number === "string"
        ? contact_number.trim()
        : "";

    const supplierAddress = typeof address === "string"
        ? address.trim()
        : "";

    if (
        !validText(name, 100) ||
        contact.length > 30 ||
        supplierAddress.length > 255
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid supplier name, contact number, and address."
        });
    }

    try {
        const duplicate = await service.query(
            `SELECT supplier_id
             FROM public.suppliers
             WHERE business_id = $1
               AND LOWER(supplier_name) = LOWER($2)
             LIMIT 1`,
            [account.businessId, name]
        );

        if (duplicate.rowCount) {
            return res.status(409).json({
                success: false,
                message: "A supplier with this name already exists."
            });
        }

        const result = await service.query(
            `INSERT INTO public.suppliers
                (
                    supplier_name,
                    contact_number,
                    address,
                    status,
                    business_id
                )
             VALUES ($1, $2, $3, 'active', $4)
             RETURNING
                supplier_id,
                supplier_name,
                contact_number,
                address,
                status`,
            [
                name,
                contact || null,
                supplierAddress || null,
                account.businessId
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Supplier added successfully.",
            supplier: result.rows[0]
        });

    } catch (error) {
        console.error("Supplier creation:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to add supplier."
        });
    }
};

const handlePatchSuppliersSupplierId4 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const supplierId = Number(req.params.supplierId);

    const { supplier_name, contact_number, address, status } = req.body;

    const name = typeof supplier_name === "string"
        ? supplier_name.trim()
        : "";

    const contact = typeof contact_number === "string"
        ? contact_number.trim()
        : "";

    const supplierAddress = typeof address === "string"
        ? address.trim()
        : "";

    if (
        !Number.isSafeInteger(supplierId) ||
        supplierId < 1 ||
        !validText(name, 100) ||
        contact.length > 30 ||
        supplierAddress.length > 255 ||
        !["active", "inactive"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide valid supplier information."
        });
    }

    try {
        const duplicate = await service.query(
            `SELECT supplier_id
             FROM public.suppliers
             WHERE business_id = $1
               AND LOWER(supplier_name) = LOWER($2)
               AND supplier_id <> $3
             LIMIT 1`,
            [
                account.businessId,
                name,
                supplierId
            ]
        );

        if (duplicate.rowCount) {
            return res.status(409).json({
                success: false,
                message: "Another supplier already uses this name."
            });
        }

        const result = await service.query(
            `UPDATE public.suppliers
             SET
                supplier_name = $1,
                contact_number = $2,
                address = $3,
                status = $4
             WHERE supplier_id = $5
               AND business_id = $6
             RETURNING
                supplier_id,
                supplier_name,
                contact_number,
                address,
                status`,
            [
                name,
                contact || null,
                supplierAddress || null,
                status,
                supplierId,
                account.businessId
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        return res.json({
            success: true,
            message: "Supplier updated successfully.",
            supplier: result.rows[0]
        });

    } catch (error) {
        console.error("Supplier update:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update supplier."
        });
    }
};

const handleGetProducts5 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    try {
        const result = await service.query(
            `SELECT
                p.product_id,
                p.product_name,
                p.minimum_stock,
                COALESCE(i.quantity, 0)::int AS current_stock
             FROM public.products p
             LEFT JOIN public.inventory i
                ON i.product_id = p.product_id AND i.branch_id = $2
             WHERE p.business_id = $1
               AND p.status = 'active'
             ORDER BY p.product_name ASC`,
            [account.businessId, account.branchId]
        );

        return res.json({
            success: true,
            products: result.rows
        });

    } catch (error) {
        console.error("Restocking products:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load products."
        });
    }
};

const handleGetHistory6 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    try {
        const result = await service.query(
            `SELECT
                r.restock_id,
                r.product_id,
                p.product_name,
                r.supplier_id,
                s.supplier_name,
                r.quantity,
                r.restock_date,
                r.restock_time,
                u.name AS performed_by
             FROM public.restocks r
             INNER JOIN public.products p
                ON p.product_id = r.product_id
             INNER JOIN public.suppliers s
                ON s.supplier_id = r.supplier_id
             LEFT JOIN public.users u
                ON u.user_id = r.user_id
             WHERE p.business_id = $1
               AND s.business_id = $1
               AND r.branch_id = $2
             ORDER BY
                r.restock_date DESC,
                r.restock_time DESC,
                r.restock_id DESC
             LIMIT 200`,
            [account.businessId, account.branchId]
        );

        return res.json({
            success: true,
            history: result.rows
        });

    } catch (error) {
        console.error("Restocking history:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load restocking history."
        });
    }
};

const handlePostRecord7 = async (req, res) => {
    const account = getAccount(req, res);
    if (!account) return;

    const supplierId = Number(req.body.supplier_id);
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity);

    const reference = typeof req.body.reference === "string"
        ? req.body.reference.trim()
        : "";

    if (
        !Number.isSafeInteger(supplierId) ||
        supplierId < 1 ||
        !Number.isSafeInteger(productId) ||
        productId < 1 ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        reference.length > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "Select a supplier and product, then enter a valid positive quantity."
        });
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const supplierResult = await client.query(
            `SELECT supplier_id
             FROM public.suppliers
             WHERE supplier_id = $1
               AND business_id = $2
               AND status = 'active'
             FOR UPDATE`,
            [
                supplierId,
                account.businessId
            ]
        );

        if (!supplierResult.rowCount) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "The selected supplier is unavailable."
            });
        }

        const productResult = await client.query(
            `SELECT product_id, product_name
             FROM public.products
             WHERE product_id = $1
               AND business_id = $2
               AND status = 'active'
             FOR UPDATE`,
            [
                productId,
                account.businessId
            ]
        );

        if (!productResult.rowCount) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "The selected product is unavailable."
            });
        }

        await client.query(
            `INSERT INTO public.inventory
                (branch_id, product_id, quantity)
             VALUES ($1, $2, 0)
             ON CONFLICT (branch_id, product_id) DO NOTHING`,
            [account.branchId, productId]
        );

        const inventoryResult = await client.query(
            `SELECT quantity
             FROM public.inventory
             WHERE product_id = $1 AND branch_id = $2
             FOR UPDATE`,
            [productId, account.branchId]
        );

        const previousStock = Number(
            inventoryResult.rows[0].quantity
        );

        const newStock = previousStock + quantity;

        if (!Number.isSafeInteger(newStock)) {
            throw new Error("The resulting stock quantity is too large.");
        }

        await client.query(
            `UPDATE public.inventory
             SET quantity = $1,
                 updated_at = NOW()
             WHERE product_id = $2 AND branch_id = $3`,
            [
                newStock,
                productId,
                account.branchId
            ]
        );

        const restockResult = await client.query(
            `INSERT INTO public.restocks
                (
                    supplier_id,
                    product_id,
                    branch_id,
                    quantity,
                    restock_date,
                    restock_time,
                    user_id
                )
             VALUES (
                $1,
                $2,
                $3,
                $4,
                CURRENT_DATE,
                LOCALTIME,
                $5
             )
             RETURNING restock_id, restock_date, restock_time`,
            [
                supplierId,
                productId,
                account.branchId,
                quantity,
                account.userId
            ]
        );

        const reason = reference
            ? `Supplier delivery. Reference: ${reference}`
            : "Supplier delivery";

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
             VALUES ($1, $2, $3, 'restock', $4, $5, $6, $7)`,
            [
                productId,
                account.branchId,
                account.userId,
                previousStock,
                newStock,
                quantity,
                reason
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Restocking record saved and inventory updated successfully.",
            restock: restockResult.rows[0],
            previous_stock: previousStock,
            added_quantity: quantity,
            current_stock: newStock
        });

    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});

        console.error("Record restock:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to record this restock."
        });

    } finally {
        client.release();
    }
};

module.exports = { handleGetDashboard1, handleGetSuppliers2, handlePostSuppliers3, handlePatchSuppliersSupplierId4, handleGetProducts5, handleGetHistory6, handlePostRecord7 };
