/* Shared-code staff entry. Staff select an active branch after validating the
 * business access code created during business registration. */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { db } = require("../../config/database");

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const SESSION_MS = 8 * 60 * 60 * 1000;
const COOKIE_NAME = "casia_staff_session";

function fingerprint(value) {
    const pepper = process.env.ACCESS_CODE_PEPPER;
    if (!pepper) throw new Error("ACCESS_CODE_PEPPER is not configured.");
    return crypto.createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function getClientKey(req) { return String(req.ip || req.socket?.remoteAddress || "unknown"); }
function checkRateLimit(req, res) {
    const key = getClientKey(req);
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && now < entry.resetAt && entry.count >= MAX_ATTEMPTS) {
        res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        res.status(429).json({ success: false, message: "Too many incorrect access-code attempts. Please try again later." });
        return false;
    }
    if (!entry || now >= entry.resetAt) attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return true;
}
function recordAttempt(req, success) {
    const key = getClientKey(req);
    if (success) { attempts.delete(key); return; }
    const entry = attempts.get(key) || { count: 0, resetAt: Date.now() + WINDOW_MS };
    entry.count += 1;
    attempts.set(key, entry);
}
function setStaffCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MS
    });
}
function clearStaffCookie(res) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
}

async function findBusinessByCode(code) {
    const codeFingerprint = fingerprint(code);
    const result = await db.query(
        `SELECT business_id, business_name, status, access_code_hash, access_code_fingerprint
         FROM public.businesses
         WHERE access_code_fingerprint = $1
         LIMIT 1`,
        [codeFingerprint]
    );
    if (!result.rowCount) return null;
    const business = result.rows[0];
    const matches = business.status === "active" && business.access_code_hash
        ? await bcrypt.compare(code, business.access_code_hash)
        : false;
    return matches ? business : null;
}

async function handlePostBranches(req, res) {
    if (!checkRateLimit(req, res)) return;
    const code = typeof req.body.access_code === "string" ? req.body.access_code.trim() : "";
    if (code.length < 8 || code.length > 64) {
        recordAttempt(req, false);
        return res.status(400).json({ success: false, message: "Enter the business staff access code." });
    }
    try {
        const business = await findBusinessByCode(code);
        if (!business) {
            recordAttempt(req, false);
            return res.status(401).json({ success: false, message: "Invalid staff access code or inactive business." });
        }
        const result = await db.query(
            `SELECT branch_id, branch_name
             FROM public.branches
             WHERE business_id = $1 AND status = 'active'
             ORDER BY CASE WHEN branch_name = 'Main Branch' THEN 0 ELSE 1 END, branch_name`,
            [business.business_id]
        );
        if (!result.rowCount) return res.status(409).json({ success: false, message: "This business has no active branches. Ask the Business Owner to add or reactivate a branch." });
        recordAttempt(req, true);
        res.set("Cache-Control", "no-store");
        return res.json({ success: true, business_name: business.business_name, branches: result.rows });
    } catch (error) {
        console.error("Staff branch lookup:", error.message);
        return res.status(500).json({ success: false, message: "Unable to verify the staff access code." });
    }
}

async function handlePostAccess(req, res) {
    if (!checkRateLimit(req, res)) return;
    const code = typeof req.body.access_code === "string" ? req.body.access_code.trim() : "";
    const branchId = Number(req.body.branch_id);
    if (code.length < 8 || code.length > 64 || !Number.isSafeInteger(branchId) || branchId < 1) {
        recordAttempt(req, false);
        return res.status(400).json({ success: false, message: "Enter the staff access code and choose a branch." });
    }
    let client;
    try {
        const business = await findBusinessByCode(code);
        if (!business) {
            recordAttempt(req, false);
            return res.status(401).json({ success: false, message: "Invalid staff access code or inactive business." });
        }
        const branch = await db.query(
            `SELECT branch_id, branch_name FROM public.branches
             WHERE branch_id = $1 AND business_id = $2 AND status = 'active' LIMIT 1`,
            [branchId, business.business_id]
        );
        if (!branch.rowCount) {
            recordAttempt(req, false);
            return res.status(403).json({ success: false, message: "That branch is not active for this business." });
        }

        client = await db.connect();
        await client.query("BEGIN");
        const cashierResult = await client.query(
            `INSERT INTO public.users (name, username, password, role, status, business_id)
             VALUES ('Shared Cashier', $1, NULL, 'staff', 'active', $2)
             ON CONFLICT (username) DO UPDATE SET status = 'active', business_id = EXCLUDED.business_id
             RETURNING user_id, name`,
            [`shared-cashier-${business.business_id}`, business.business_id]
        );
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = sha256(token);
        await client.query(
            `INSERT INTO public.staff_access_sessions
                (token_hash, business_id, branch_id, cashier_user_id, expires_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '8 hours')`,
            [tokenHash, business.business_id, branchId, cashierResult.rows[0].user_id]
        );
        await client.query("COMMIT");
        setStaffCookie(res, token);
        recordAttempt(req, true);
        res.set("Cache-Control", "no-store");
        return res.json({
            success: true,
            redirectUrl: "/admin/pages/staff-dashboard.html",
            user: { name: cashierResult.rows[0].name, role: "staff", business_id: business.business_id, business_name: business.business_name, branch_id: branchId, branch_name: branch.rows[0].branch_name }
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        console.error("Staff access:", error.message);
        return res.status(500).json({ success: false, message: "Unable to open the cashier session. Please check that migration 003 has been applied." });
    } finally {
        if (client) client.release();
    }
}

async function handleGetMe(req, res) {
    if (!req.staffUser || req.staffUser.role !== "staff" || !req.staffSession) {
        return res.status(403).json({ success: false, message: "A valid staff branch session is required." });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, user: req.staffUser, expires_at: req.staffSession.expires_at });
}

async function handlePostLogout(req, res) {
    try {
        if (req.staffSession?.tokenHash) {
            await db.query("UPDATE public.staff_access_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL", [req.staffSession.tokenHash]);
        }
    } catch (error) {
        console.error("Staff logout:", error.message);
    }
    clearStaffCookie(res);
    return res.json({ success: true, message: "Staff session closed." });
}

module.exports = { handlePostBranches, handlePostAccess, handleGetMe, handlePostLogout, COOKIE_NAME, sha256 };
