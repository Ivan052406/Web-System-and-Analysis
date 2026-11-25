
/* CASIA authentication middleware: Supabase owner/student accounts plus
 * short-lived, branch-locked shared-code cashier sessions. */

const crypto = require("crypto");
const { createSupabaseServerClient } = require("../config/supabaseAuth");
const { db } = require("../config/database");

const STAFF_COOKIE = "casia_staff_session";

function readCookie(req, name) {
    const raw = req.headers.cookie || "";

    for (const part of raw.split(";")) {
        const index = part.indexOf("=");

        if (index < 0) continue;

        const key = part.slice(0, index).trim();

        if (key === name) {
            return decodeURIComponent(part.slice(index + 1).trim());
        }
    }

    return null;
}

async function loadStaffSession(req) {
    const token = readCookie(req, STAFF_COOKIE);

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        return null;
    }

    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    const result = await db.query(
        `SELECT s.session_id, s.token_hash, s.expires_at,
                u.user_id, u.name, u.role, u.status,
                b.business_id, b.business_name, b.status AS business_status,
                br.branch_id, br.branch_name, br.status AS branch_status
         FROM public.staff_access_sessions s
         JOIN public.users u
           ON u.user_id = s.cashier_user_id
          AND u.business_id = s.business_id
         JOIN public.businesses b
           ON b.business_id = s.business_id
         JOIN public.branches br
           ON br.branch_id = s.branch_id
          AND br.business_id = s.business_id
         WHERE s.token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    if (!result.rowCount) {
        return null;
    }

    const row = result.rows[0];

    if (
        row.status !== "active" ||
        row.business_status !== "active" ||
        row.branch_status !== "active" ||
        row.role !== "staff"
    ) {
        await db.query(
            `UPDATE public.staff_access_sessions
             SET revoked_at = NOW()
             WHERE token_hash = $1
               AND revoked_at IS NULL`,
            [tokenHash]
        );

        return null;
    }

    return {
        tokenHash,
        expires_at: row.expires_at,
        user: {
            user_id: row.user_id,
            name: row.name || "Staff Cashier",
            role: "staff",
            status: row.status,
            business_id: row.business_id,
            business_name: row.business_name,
            branch_id: row.branch_id,
            branch_name: row.branch_name
        }
    };
}

/*
 * Supabase-only authentication.
 * Does not inspect the shared Staff cookie.
 */
// Short-lived cache of verified Supabase logins. Calling Supabase on every API
// request is the slowest step; a verified login is reused for 60 seconds.
const AUTH_CACHE = new Map();
const AUTH_CACHE_TTL_MS = 60 * 1000;

function authCacheKey(req) {
    const cookie = req.headers.cookie || "";
    if (!cookie) return null;
    return crypto.createHash("sha256").update(cookie).digest("hex");
}

async function requireSupabaseAuth(req, res, next) {
    try {
        const supabase = createSupabaseServerClient(req, res);
        const cacheKey = authCacheKey(req);
        const cached = cacheKey ? AUTH_CACHE.get(cacheKey) : null;

        if (cached && cached.expiresAt > Date.now()) {
            req.supabase = supabase;
            req.authUser = cached.authUser;
            req.staffUser = { ...cached.account };
            return next();
        }

        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to continue."
            });
        }

        const result = await db.query(
            `SELECT user_id, name, username, email, auth_user_id,
                    role, status, business_id
             FROM public.users
             WHERE auth_user_id = $1
             LIMIT 1`,
            [data.user.id]
        );

        if (!result.rows.length) {
            return res.status(403).json({
                success: false,
                message: "Your account is not linked to a CASIA user profile."
            });
        }

        const account = result.rows[0];

        if (account.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive."
            });
        }

        if (account.role === "admin") {
            if (!account.business_id) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not assigned to a business."
                });
            }

            const businessResult = await db.query(
                `SELECT status
                 FROM public.businesses
                 WHERE business_id = $1
                 LIMIT 1`,
                [account.business_id]
            );

            if (
                !businessResult.rowCount ||
                businessResult.rows[0].status !== "active"
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Your business is inactive. Please contact support."
                });
            }
        }

        if (cacheKey) {
            if (AUTH_CACHE.size > 1000) AUTH_CACHE.clear();
            AUTH_CACHE.set(cacheKey, {
                expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
                authUser: data.user,
                account
            });
        }

        req.supabase = supabase;
        req.authUser = data.user;
        req.staffUser = account;

        return next();

    } catch (error) {
        console.error(
            "Supabase authentication middleware:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify your account."
        });
    }
}

/*
 * Student-only authentication.
 * Always verifies the Supabase account directly.
 * Bypasses the shared Staff cookie.
 */
async function requireStudentAuth(req, res, next) {
    return requireSupabaseAuth(req, res, () => {

        if (
            !req.staffUser ||
            req.staffUser.role !== "student"
        ) {
            return res.status(403).json({
                success: false,
                message: "Student account access only."
            });
        }

        return next();
    });
}

/*
 * General authentication for routes shared by Admin and Staff.
 */
async function requireAuth(req, res, next) {
    try {
        const staffSession = await loadStaffSession(req);

        if (staffSession) {
            req.staffUser = staffSession.user;

            req.staffSession = {
                tokenHash: staffSession.tokenHash,
                expires_at: staffSession.expires_at
            };

            req.selectedBranchId = Number(
                staffSession.user.branch_id
            );

            req.allBranchesSelected = false;

            return next();
        }

        return requireSupabaseAuth(req, res, next);

    } catch (error) {
        console.error(
            "Authentication middleware:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify your account."
        });
    }
}

async function resolveBranchContext(req, res, next) {
    if (req.staffUser?.role !== "admin") {
        return next();
    }

    const businessId = Number(req.staffUser.business_id);
    const raw = req.get("X-CASIA-Branch-Id");

    if (raw === "all") {
        req.selectedBranchId = null;
        req.allBranchesSelected = true;

        return next();
    }

    try {
        let branchId = raw ? Number(raw) : null;
        let result;

        if (
            branchId &&
            Number.isSafeInteger(branchId) &&
            branchId > 0
        ) {
            result = await db.query(
                `SELECT branch_id
                 FROM public.branches
                 WHERE branch_id = $1
                   AND business_id = $2
                   AND status = 'active'
                 LIMIT 1`,
                [branchId, businessId]
            );

        } else {
            result = await db.query(
                `SELECT branch_id
                 FROM public.branches
                 WHERE business_id = $1
                   AND status = 'active'
                 ORDER BY
                   CASE WHEN branch_name = 'Main Branch'
                   THEN 0 ELSE 1 END,
                   branch_id
                 LIMIT 1`,
                [businessId]
            );
        }

        if (!result.rowCount) {
            return res.status(409).json({
                success: false,
                message: "No active business branch is available. Create or activate a branch first."
            });
        }

        req.selectedBranchId = Number(
            result.rows[0].branch_id
        );

        req.allBranchesSelected = false;

        return next();

    } catch (error) {
        console.error(
            "Resolve branch context:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to resolve the selected branch. Apply migration 003."
        });
    }
}

function requireSpecificBranch(req, res, next) {
    if (!req.selectedBranchId) {
        return res.status(400).json({
            success: false,
            message: "Select one branch from the top navigation before managing branch inventory."
        });
    }

    return next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {

        if (
            !req.staffUser ||
            !allowedRoles.includes(req.staffUser.role)
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action."
            });
        }

        return next();
    };
}

module.exports = {
    requireAuth,
    requireSupabaseAuth,
    requireStudentAuth,
    requireRole,
    resolveBranchContext,
    requireSpecificBranch
};