/* =====================================================
   CASIA CATEGORY ROUTES
   ===================================================== */



const service = require("./category.service.js");
const db = service.db;
const { requireRole } = require("../../middleware/auth.middleware");

// GET /api/categories


// POST /api/categories


// PUT /api/categories/:id

// Express request handlers extracted from the original route declarations.
const handleGetRoot1 = async (req, res) => {
    try {
        const result = await service.query(`
            SELECT category_id, category_name
            FROM categories
            ORDER BY category_id ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("Get categories:", error.message);
        res.status(500).json({ message: "Failed to load categories." });
    }
};

const handlePostRoot2 = async (req, res) => {
    const { category_name } = req.body;

    if (typeof category_name !== "string" || !category_name.trim()) {
        return res.status(400).json({
            message: "Category name is required."
        });
    }

    try {
        const result = await service.query(
            `INSERT INTO categories (category_name)
             VALUES ($1)
             RETURNING *`,
            [category_name.trim()]
        );

        res.status(201).json({
            success: true,
            message: "Category added successfully.",
            category: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "This category already exists."
            });
        }

        console.error("Add category:", error.message);
        res.status(500).json({ message: "Failed to add category." });
    }
};

const handlePutId3 = async (req, res) => {
    const id = Number(req.params.id);
    const { category_name } = req.body;

    if (!Number.isInteger(id) || id < 1 ||
        typeof category_name !== "string" || !category_name.trim()) {
        return res.status(400).json({ message: "Invalid category information." });
    }

    try {
        const result = await service.query(
            `UPDATE categories
             SET category_name = $1
             WHERE category_id = $2
             RETURNING *`,
            [category_name.trim(), id]
        );

        if (!result.rowCount) {
            return res.status(404).json({ message: "Category not found." });
        }

        res.json({
            success: true,
            message: "Category updated.",
            category: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ message: "Category name already exists." });
        }

        console.error("Update category:", error.message);
        res.status(500).json({ message: "Failed to update category." });
    }
};

module.exports = { handleGetRoot1, handlePostRoot2, handlePutId3 };
