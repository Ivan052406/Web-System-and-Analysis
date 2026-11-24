/* CASIA ADMIN ROUTES
   Business Registration and Admin Login
*/



const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const service = require("./auth.service.js");
const db = service.db;

const { createSupabaseServerClient } =
    require("../../config/supabaseAuth");

const {
    requireAuth,
    requireRole
} = require("../../middleware/auth.middleware");

const APP_URL = (
    process.env.APP_URL || "http://localhost:3000"
).replace(/\/+$/, "");

// Create the email confirmation callback URL

function callbackUrl(nextPath) {
    const url = new URL("/api/auth/callback", APP_URL);
    url.searchParams.set("next", nextPath);

    return url.toString();
}

// Validate email addresses

function isValidEmail(email) {
    return typeof email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate a secure fingerprint for access-code uniqueness

function createAccessCodeFingerprint(accessCode) {
    const pepper = process.env.ACCESS_CODE_PEPPER;

    if (!pepper) {
        throw new Error("ACCESS_CODE_PEPPER is not configured.");
    }

    return crypto
        .createHmac("sha256", pepper)
        .update(accessCode, "utf8")
        .digest("hex");
}

// Compare fingerprints safely

function fingerprintsMatch(first, second) {
    if (
        typeof first !== "string" ||
        typeof second !== "string" ||
        !/^[a-f0-9]{64}$/i.test(first) ||
        !/^[a-f0-9]{64}$/i.test(second)
    ) {
        return false;
    }

    const firstBuffer = Buffer.from(first, "hex");
    const secondBuffer = Buffer.from(second, "hex");

    if (firstBuffer.length !== secondBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

// ADMIN / BUSINESS REGISTRATION
// POST /api/admin/signup



// ADMIN LOGIN
// POST /api/admin/login



// GET CURRENT ADMIN
// GET /api/admin/me

// Express request handlers extracted from the original route declarations.
const handlePostSignup1 = async (req, res) => {
    const name = typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

    const companyType = typeof req.body.company_type === "string"
        ? req.body.company_type.trim()
        : "";

    const contact = typeof req.body.contact === "string"
        ? req.body.contact.trim()
        : "";

    const email = typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const address = typeof req.body.address === "string"
        ? req.body.address.trim()
        : "";

    const password = req.body.password;

    const confirmPassword = req.body.confirm_password;

    const accessCode = typeof req.body.access_code === "string"
        ? req.body.access_code.trim()
        : "";

    if (!process.env.SUPABASE_URL ||
        !process.env.SUPABASE_PUBLISHABLE_KEY) {
        return res.status(503).json({
            success: false,
            message: "Supabase authentication is not configured."
        });
    }

    if (!process.env.ACCESS_CODE_PEPPER) {
        return res.status(503).json({
            success: false,
            message: "Business access-code verification is not configured."
        });
    }

    if (
        !name ||
        !companyType ||
        !contact ||
        !address ||
        !isValidEmail(email) ||
        typeof password !== "string" ||
        password.length < 6 ||
        password !== confirmPassword ||
        accessCode.length < 8 ||
        accessCode.length > 64
    ) {
        return res.status(400).json({
            success: false,
            message: "Please complete all fields correctly. Your business access code must contain 8 to 64 characters."
        });
    }

    let client;
    let transactionStarted = false;

    try {
        const fingerprint =
            createAccessCodeFingerprint(accessCode);

        // Check whether the access code is already used

        const existingCode = await service.query(
            `SELECT business_id
             FROM public.businesses
             WHERE access_code_fingerprint = $1
             LIMIT 1`,
            [fingerprint]
        );

        if (existingCode.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "This business access code is already being used. Please create a different code."
            });
        }

        // Check whether the business email is already registered

        const existingBusiness = await service.query(
            `SELECT business_id
             FROM public.businesses
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [email]
        );

        if (existingBusiness.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "This company email is already registered."
            });
        }

        // Hash the access code before saving it

        const accessCodeHash = await bcrypt.hash(accessCode, 12);

        const supabase = createSupabaseServerClient(req, res);

        // Create the administrator account in Supabase Auth

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    account_type: "admin"
                },
                emailRedirectTo: callbackUrl(
                    "/student/pages/login.html?role=admin&confirmed=1"
                )
            }
        });

        if (error || !data.user) {
            return res.status(400).json({
                success: false,
                message: error?.message ||
                    "Unable to create the administrator account."
            });
        }

        // Save the business and administrator profile

        client = await db.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        const businessResult = await client.query(
            `INSERT INTO public.businesses
                (
                    business_name,
                    company_type,
                    contact,
                    email,
                    address,
                    access_code_hash,
                    access_code_fingerprint
                )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING business_id`,
            [
                name,
                companyType,
                contact,
                email,
                address,
                accessCodeHash,
                fingerprint
            ]
        );

        const businessId =
            businessResult.rows[0].business_id;

        // Every newly registered business starts with a Main Branch so Staff
        // can select a branch immediately and student store listings stay valid.
        await client.query(
            `INSERT INTO public.branches (business_id, branch_name, address, contact, status)
             VALUES ($1, 'Main Branch', NULLIF($2, ''), NULLIF($3, ''), 'active')
             ON CONFLICT (business_id, branch_name) DO NOTHING`,
            [businessId, address, contact]
        );

        await client.query(
            `INSERT INTO public.users
                (
                    name,
                    username,
                    email,
                    auth_user_id,
                    role,
                    status,
                    business_id
                )
             VALUES ($1, $2, $3, $4, 'admin', 'active', $5)`,
            [
                name,
                email,
                email,
                data.user.id,
                businessId
            ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        res.set("Cache-Control", "no-store");

        return res.status(201).json({
            success: true,
            authenticated: Boolean(data.session),
            message: data.session
                ? "Business and administrator account created successfully."
                : "Business registered successfully. Please confirm your email before signing in.",
            business_id: businessId
        });

    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Admin registration:", error.message);

        if (
            error.code === "23505" &&
            error.constraint ===
                "businesses_access_code_fingerprint_unique"
        ) {
            return res.status(409).json({
                success: false,
                message: "This business access code is already being used. Please create a different code."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This business or administrator account is already registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register the business. Please check the server logs."
        });

    } finally {
        if (client) {
            client.release();
        }
    }
};

const handlePostLogin2 = async (req, res) => {
    const email = typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body.password;

    const accessCode = typeof req.body.access_code === "string"
        ? req.body.access_code.trim()
        : "";

    if (!process.env.ACCESS_CODE_PEPPER) {
        return res.status(503).json({
            success: false,
            message: "Business access-code verification is not configured."
        });
    }

    if (
        !isValidEmail(email) ||
        typeof password !== "string" ||
        !password ||
        accessCode.length < 8 ||
        accessCode.length > 64
    ) {
        return res.status(400).json({
            success: false,
            message: "Please enter your email, password, and valid business access code."
        });
    }

    let supabase;

    try {
        supabase = createSupabaseServerClient(req, res);

        // Verify the email and password through Supabase

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error || !data.user) {
            console.error("Supabase Admin sign-in failed:", {
                message: error?.message,
                status: error?.status,
                code: error?.code
            });
            return res.status(401).json({
                success: false,
                message: "Invalid administrator email or password. Check that the password and Supabase project credentials belong to this CASIA account."
            });
        }

        // Find the administrator and their registered business

        const result = await service.query(
            `SELECT
                u.user_id,
                u.name,
                u.email,
                u.role,
                u.status,
                u.business_id,
                b.business_name,
                b.status AS business_status,
                b.access_code_hash,
                b.access_code_fingerprint
             FROM public.users u
             INNER JOIN public.businesses b
                ON b.business_id = u.business_id
             WHERE u.auth_user_id = $1
             LIMIT 1`,
            [data.user.id]
        );

        if (
            !result.rowCount ||
            result.rows[0].role !== "admin" ||
            result.rows[0].status !== "active" ||
            result.rows[0].business_status !== "active"
        ) {
            await supabase.auth.signOut();

            return res.status(403).json({
                success: false,
                message: "This account does not have active administrator access."
            });
        }

        const admin = result.rows[0];

        // Verify the access code against this administrator's business

        const submittedFingerprint =
            createAccessCodeFingerprint(accessCode);

        const fingerprintValid = fingerprintsMatch(
            submittedFingerprint,
            admin.access_code_fingerprint
        );

        const hashValid = admin.access_code_hash
            ? await bcrypt.compare(
                accessCode,
                admin.access_code_hash
            )
            : false;

        if (!fingerprintValid || !hashValid) {
            await supabase.auth.signOut();

            return res.status(401).json({
                success: false,
                message: "Invalid business access code."
            });
        }

        // Remove a prior shared-code Staff session when switching to Admin.
        // Otherwise requireAuth could see the stale cashier cookie first and
        // classify this browser request as role=staff on subsequent API calls.
        res.clearCookie("casia_staff_session", {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production"
        });

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            authenticated: true,
            message: "Administrator login successful.",
            user: {
                user_id: admin.user_id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                business_id: admin.business_id,
                business_name: admin.business_name
            }
        });

    } catch (error) {
        if (supabase) {
            await supabase.auth.signOut().catch(() => {});
        }

        console.error("Admin login:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to process administrator login."
        });
    }
};

const handleGetMe3 = (req, res) => {
        res.set("Cache-Control", "no-store");

        res.json({
            success: true,
            user: req.staffUser
        });
    };

module.exports = { handlePostSignup1, handlePostLogin2, handleGetMe3 };
