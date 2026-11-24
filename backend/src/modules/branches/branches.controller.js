const { db } = require("../../config/database");

function ownerBusinessId(req, res) {
    const id = Number(req.staffUser?.business_id);
    if (!Number.isSafeInteger(id) || id < 1) {
        res.status(403).json({ success: false, message: "Your owner account is not linked to a business." });
        return null;
    }
    return id;
}

async function listBranches(req, res) {
    const businessId = ownerBusinessId(req, res);
    if (!businessId) return;
    try {
        const result = await db.query(
            `SELECT branch_id, business_id, branch_name, address, contact, status, created_at
             FROM public.branches WHERE business_id = $1
             ORDER BY CASE WHEN branch_name = 'Main Branch' THEN 0 ELSE 1 END, branch_name`,
            [businessId]
        );
        res.set("Cache-Control", "no-store");
        return res.json({ success: true, branches: result.rows });
    } catch (error) {
        console.error("List branches:", error.message);
        return res.status(500).json({ success: false, message: "Unable to load branches." });
    }
}

async function createBranch(req, res) {
    const businessId = ownerBusinessId(req, res);
    if (!businessId) return;
    const branchName = typeof req.body.branch_name === "string" ? req.body.branch_name.trim() : "";
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const contact = typeof req.body.contact === "string" ? req.body.contact.trim() : "";
    if (!branchName || branchName.length > 150 || address.length > 500 || contact.length > 40) {
        return res.status(400).json({ success: false, message: "Enter a branch name (maximum 150 characters) and valid optional contact details." });
    }
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const inserted = await client.query(
            `INSERT INTO public.branches (business_id, branch_name, address, contact)
             VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))
             RETURNING branch_id, business_id, branch_name, address, contact, status, created_at`,
            [businessId, branchName, address, contact]
        );
        const branch = inserted.rows[0];
        await client.query(
            `INSERT INTO public.inventory (branch_id, product_id, quantity)
             SELECT $1, p.product_id, 0
             FROM public.products p
             WHERE p.business_id = $2
             ON CONFLICT (branch_id, product_id) DO NOTHING`,
            [branch.branch_id, businessId]
        );
        await client.query("COMMIT");
        return res.status(201).json({ success: true, message: "Branch created. Its inventory starts at zero; record stock for this branch in Restocking.", branch });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error.code === "23505") return res.status(409).json({ success: false, message: "A branch with that name already exists." });
        console.error("Create branch:", error.message);
        return res.status(500).json({ success: false, message: "Unable to create branch." });
    } finally {
        client.release();
    }
}

async function updateBranchStatus(req, res) {
    const businessId = ownerBusinessId(req, res);
    if (!businessId) return;
    const branchId = Number(req.params.id);
    const status = req.body.status;
    if (!Number.isSafeInteger(branchId) || branchId < 1 || !["active", "inactive"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid branch or status." });
    }
    try {
        const current = await db.query(
            `SELECT branch_id, branch_name, status
             FROM public.branches
             WHERE branch_id = $1 AND business_id = $2
             LIMIT 1`,
            [branchId, businessId]
        );
        if (!current.rowCount) return res.status(404).json({ success: false, message: "Branch not found." });
        if (status === "inactive" && current.rows[0].branch_name === "Main Branch") {
            return res.status(400).json({ success: false, message: "The Main Branch is the required primary branch and cannot be deactivated." });
        }
        const result = await db.query(
            `UPDATE public.branches SET status = $1
             WHERE branch_id = $2 AND business_id = $3
             RETURNING branch_id, branch_name, status`,
            [status, branchId, businessId]
        );
        if (status === "inactive") {
            await db.query("UPDATE public.staff_access_sessions SET revoked_at = NOW() WHERE branch_id = $1 AND revoked_at IS NULL", [branchId]);
        }
        return res.json({ success: true, branch: result.rows[0], message: `Branch ${status}.` });
    } catch (error) {
        console.error("Update branch:", error.message);
        return res.status(500).json({ success: false, message: "Unable to update branch status." });
    }
}

module.exports = { listBranches, createBranch, updateBranchStatus };
