/* CASIA student-facing read-only catalog routes. */

const service = require("./student.service.js");
const db = service.db;
const { requireRole } = require("../../middleware/auth.middleware");

// GET /api/student/catalog
// Only Student accounts can read the student-facing campus catalog.

// Express request handlers extracted from the original route declarations.
const handleGetCatalog1 = async (req, res) => {
    try {
        const [storesResult, productsResult] = await Promise.all([
            service.query(`
                SELECT
                    b.business_id AS id,
                    b.business_name AS name,
                    COALESCE(b.address, '') AS location,
                    COALESCE(b.contact, '') AS contact,
                    b.email
                FROM public.businesses b
                WHERE b.status = 'active'
                ORDER BY b.business_name ASC
            `),
            service.query(`
                SELECT
                    p.product_id AS id,
                    p.business_id AS "storeId",
                    p.product_name AS name,
                    COALESCE(c.category_name, 'Others') AS category,
                    p.price,
                    COALESCE(i.quantity, 0)::int AS stock,
                    (p.status = 'active' AND COALESCE(i.quantity, 0) > 0) AS available
                FROM public.products p
                INNER JOIN public.businesses b
                    ON b.business_id = p.business_id
                LEFT JOIN public.categories c
                    ON c.category_id = p.category_id
                LEFT JOIN (
                    SELECT i.product_id, SUM(i.quantity)::int AS quantity
                    FROM public.inventory i
                    JOIN public.branches br ON br.branch_id = i.branch_id
                    WHERE br.status = 'active'
                    GROUP BY i.product_id
                ) i ON i.product_id = p.product_id
                WHERE p.status = 'active'
                  AND b.status = 'active'
                ORDER BY p.product_name ASC
            `)
        ]);

        res.set("Cache-Control", "no-store");
        return res.json({
            success: true,
            stores: storesResult.rows,
            products: productsResult.rows
        });
    } catch (error) {
        console.error("Student catalog:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to load the student catalog. Please check the database setup."
        });
    }
};

module.exports = { handleGetCatalog1 };
