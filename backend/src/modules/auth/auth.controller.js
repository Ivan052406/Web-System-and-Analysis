/* CASIA USER AUTHENTICATION ROUTES
   User Registration, Login,  OAuth, and Password Recovery
*/



const service = require("./auth.service.js");
const db = service.db;

const { createSupabaseServerClient } =
    require("../../config/supabaseAuth");

const APP_URL = (
    process.env.APP_URL || "http://localhost:3000"
).replace(/\/+$/, "");

// Validate email addresses

function isValidEmail(email) {
    return typeof email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate passwords

function validPassword(password) {
    return typeof password === "string" &&
        password.length >= 6;
}

// Validate redirect destinations

function safeNextPath(value) {
    if (
        typeof value !== "string" ||
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\")
    ) {
        return "/student/pages/login.html";
    }

    return value;
}

// Generate authentication callback URLs

function callbackUrl(nextPath) {
    const url = new URL("/api/auth/callback", APP_URL);

    url.searchParams.set(
        "next",
        safeNextPath(nextPath)
    );

    return url.toString();
}

// Generate password recovery verification URL

function recoveryConfirmUrl(role = "user") {
    const url = new URL("/api/auth/confirm", APP_URL);
    if (role === "admin") url.searchParams.set("role", "admin");
    return url.toString();
}

// Create the corresponding CASIA student profile

async function createStudentProfile(user) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
        throw new Error(
            "The authenticated account has no email."
        );
    }

    const existing = await service.query(
        `SELECT user_id
         FROM public.users
         WHERE auth_user_id = $1
         LIMIT 1`,
        [user.id]
    );

    if (existing.rowCount) {
        return existing.rows[0];
    }

    const result = await service.query(
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
         VALUES ($1, $2, $3, $4, 'student', 'active', NULL)
         RETURNING
            user_id,
            name,
            email,
            role,
            business_id`,
        [
            user.user_metadata?.full_name ||
                email.split("@")[0],
            email,
            email,
            user.id
        ]
    );

    return result.rows[0];
}

// Resolve a Supabase-authenticated account during email/OAuth callbacks.
// Existing Business Owner profiles are already linked. Legacy Staff profiles
// can be linked by matching the authenticated email; otherwise public sign-up
// callbacks create the expected Student profile.
async function ensureAuthProfile(user) {
    const existing = await service.query(
        `SELECT user_id, role FROM public.users WHERE auth_user_id = $1 LIMIT 1`,
        [user.id]
    );
    if (existing.rowCount) return existing.rows[0];

    const email = user.email?.trim().toLowerCase();
    if (email) {
        const legacyStaff = await service.query(
            `SELECT user_id FROM public.users
             WHERE role = 'staff' AND status = 'active'
               AND auth_user_id IS NULL
               AND (LOWER(COALESCE(email, '')) = LOWER($1)
                    OR LOWER(COALESCE(username, '')) = LOWER($1))
             ORDER BY user_id ASC LIMIT 1`,
            [email]
        );
        if (legacyStaff.rowCount) {
            await service.query(
                `UPDATE public.users SET auth_user_id = $1,
                    email = COALESCE(NULLIF(email, ''), $2)
                 WHERE user_id = $3 AND auth_user_id IS NULL`,
                [user.id, email, legacyStaff.rows[0].user_id]
            );
            const linked = await service.query(
                `SELECT user_id, role FROM public.users WHERE auth_user_id = $1 LIMIT 1`,
                [user.id]
            );
            if (linked.rowCount) return linked.rows[0];
        }
    }

    return createStudentProfile(user);
}

// USER REGISTRATION
// POST /api/auth/signup



// USER LOGIN
// POST /api/auth/signin





// AUTHENTICATION CALLBACK
// GET /api/auth/callback



// FORGOT PASSWORD
// POST /api/auth/forgot-password



// VERIFY PASSWORD RECOVERY EMAIL
// GET /api/auth/confirm



// UPDATE PASSWORD
// POST /api/auth/update-password



// SIGN OUT
// POST /api/auth/signout

// Express request handlers extracted from the original route declarations.
const handlePostSignup1 = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            !isValidEmail(email) ||
            !validPassword(password)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid name, email, and password."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const supabase =
            createSupabaseServerClient(req, res);

        const { data, error } =
            await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: {
                        full_name: name.trim()
                    },
                    emailRedirectTo: callbackUrl(
                        "/student/pages/login.html?confirmed=1"
                    )
                }
            });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (!data.user) {
            return res.status(400).json({
                success: false,
                message: "Unable to create the account."
            });
        }

        await createStudentProfile({
            ...data.user,
            email: data.user.email,
            user_metadata: {
                ...data.user.user_metadata,
                full_name: name.trim()
            }
        });

        res.set("Cache-Control", "no-store");

        return res.status(201).json({
            success: true,
            authenticated: Boolean(data.session),
            message: data.session
                ? "Account created successfully."
                : "Account created. Please confirm your email first."
        });

    } catch (error) {
        console.error("User registration failed:", {
            message: error.message,
            code: error.code,
            constraint: error.constraint,
            detail: error.detail
        });

        if (error.code === "23514" && /users_role_check/i.test(error.constraint || "")) {
            return res.status(503).json({
                success: false,
                code: "CASIA_STUDENT_ROLE_MIGRATION_REQUIRED",
                message: "The database is still using the old role restriction. Run database/migrations/004_auth_login_repairs.sql in Supabase, then try registering again."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "An account with this email or username already exists. Try signing in instead."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register your account. Check the backend terminal for the database error."
        });
    }
};

const handlePostSignin2 = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            !isValidEmail(email) ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email and password."
            });
        }

        const supabase =
            createSupabaseServerClient(req, res);

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            });

        if (error || !data.user) {
            console.error("Supabase Student sign-in failed:", {
                message: error?.message,
                status: error?.status,
                code: error?.code
            });
            return res.status(401).json({
                success: false,
                message: "Invalid email or password. Check that this account was created in the Supabase project configured in backend/.env."
            });
        }

        const profile = await service.query(
            `SELECT
                user_id,
                name,
                email,
                role,
                status,
                business_id
             FROM public.users
             WHERE auth_user_id = $1
             LIMIT 1`,
            [data.user.id]
        );

        if (!profile.rowCount) {
            await supabase.auth.signOut();

            return res.status(403).json({
                success: false,
                message: "Your account does not have a CASIA profile."
            });
        }

        if (profile.rows[0].role !== "student") {
            await supabase.auth.signOut();
            return res.status(403).json({
                success: false,
                message: "This is not a Student account. Choose Admin Login or Staff Login."
            });
        }

        if (profile.rows[0].status !== "active") {
            await supabase.auth.signOut();

            return res.status(403).json({
                success: false,
                message: "Your CASIA account is inactive."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            authenticated: true,
            message: "Sign in successful.",
            user: profile.rows[0]
        });

    } catch (error) {
        console.error(
            "User sign in:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to sign in."
        });
    }
};

const handleGetCallback3 = async (req, res) => {
    try {
        const code = req.query.code;

        const nextPath = safeNextPath(
            req.query.next
        );

        if (typeof code !== "string" || !code) {
            return res.redirect(
                "/student/pages/login.html?error=invalid_callback"
            );
        }

        const supabase =
            createSupabaseServerClient(req, res);

        const { error } =
            await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error(
                "Authentication callback:",
                error.message
            );

            return res.redirect(
                "/student/pages/login.html?error=authentication"
            );
        }

        const { data, error: userError } =
            await supabase.auth.getUser();

        if (userError || !data.user) {
            return res.redirect(
                "/student/pages/login.html?error=account"
            );
        }

        // Resolve the existing profile or provision the Student profile for public sign-up.

        await ensureAuthProfile(data.user);

        res.set("Cache-Control", "no-store");

        return res.redirect(303, nextPath);

    } catch (error) {
        console.error(
            "Authentication callback:",
            error.message
        );

        return res.redirect(
            "/student/pages/login.html?error=callback"
        );
    }
};

const handlePostForgotPassword4 = async (req, res) => {
    try {
        const email = typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const requestedRole = req.body.role === "admin" ? "admin" : "user";
        const supabase = createSupabaseServerClient(req, res);

        // Supabase sends the recovery email. The callback keeps the Admin/User
        // context so the reset flow returns to the appropriate login tab.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: recoveryConfirmUrl(requestedRole)
        });

        if (error) {
            console.error("Password recovery email delivery failed:", {
                message: error.message,
                status: error.status,
                code: error.code,
                name: error.name
            });

            return res.status(503).json({
                success: false,
                code: "SUPABASE_RECOVERY_EMAIL_FAILED",
                message: "Supabase could not send the recovery email. Configure Custom SMTP in Supabase Authentication settings and allow http://localhost:3000/api/auth/confirm in the Auth redirect URLs, then try again."
            });
        }

        res.set("Cache-Control", "no-store");

        // Do not reveal whether the email is registered.

        return res.json({
            success: true,
            message: "If an account exists with this email, a password reset link has been sent. Please check your inbox."
        });

    } catch (error) {
        console.error(
            "Forgot password:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to process your password recovery request."
        });
    }
};

const handleGetConfirm5 = async (req, res) => {
    const tokenHash =
        typeof req.query.token_hash === "string"
            ? req.query.token_hash
            : "";

    const type = req.query.type;
    const role = req.query.role === "admin" ? "admin" : "user";
    const forgotPage = role === "admin"
        ? "/student/pages/forgot-password.html?role=admin"
        : "/student/pages/forgot-password.html";
    const recoveryErrorUrl = (code) =>
        `${forgotPage}${forgotPage.includes("?") ? "&" : "?"}error=${encodeURIComponent(code)}`;

    if (!tokenHash || type !== "recovery") {
        return res.redirect(recoveryErrorUrl("invalid"));
    }

    try {
        const supabase =
            createSupabaseServerClient(req, res);

        const { error } =
            await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "recovery"
            });

        if (error) {
            console.error(
                "Password recovery verification:",
                error.message
            );

            return res.redirect(recoveryErrorUrl("expired"));
        }

        res.set("Cache-Control", "no-store");

        // The recovery session is now stored in the response cookies.

        return res.redirect(
            303,
            role === "admin"
                ? "/student/pages/reset-password.html?role=admin"
                : "/student/pages/reset-password.html"
        );

    } catch (error) {
        console.error(
            "Password recovery verification:",
            error.message
        );

        return res.redirect(recoveryErrorUrl("failed"));
    }
};

const handlePostUpdatePassword6 = async (req, res) => {
    try {
        const password = req.body.password;

        const confirmPassword =
            req.body.confirm_password;

        if (
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Your password must contain at least 8 characters."
            });
        }

        if (
            typeof confirmPassword !== "string" ||
            password !== confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Your passwords do not match."
            });
        }

        const supabase =
            createSupabaseServerClient(req, res);

        // Verify that a valid recovery session exists.

        const { data: userData, error: userError } =
            await supabase.auth.getUser();

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message: "Your password reset link is invalid or has expired. Please request a new one."
            });
        }

        // Update the authenticated account's password.

        const { error } =
            await supabase.auth.updateUser({
                password
            });

        if (error) {
            console.error(
                "Password update:",
                error.message
            );

            return res.status(400).json({
                success: false,
                message: error.message ||
                    "Unable to update your password."
            });
        }

        // End the recovery session after the password is changed.

        const { error: signOutError } =
            await supabase.auth.signOut();

        if (signOutError) {
            console.error(
                "Recovery session sign out:",
                signOutError.message
            );
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            message: "Your password has been updated successfully."
        });

    } catch (error) {
        console.error(
            "Password update:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update your password."
        });
    }
};

const handlePostSignout7 = async (req, res) => {
    try {
        const supabase =
            createSupabaseServerClient(req, res);

        const { error } =
            await supabase.auth.signOut();

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Unable to sign out."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            message: "Signed out successfully."
        });

    } catch (error) {
        console.error(
            "Sign out:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to sign out."
        });
    }
};

module.exports = { handlePostSignup1, handlePostSignin2, handleGetCallback3, handlePostForgotPassword4, handleGetConfirm5, handlePostUpdatePassword6, handlePostSignout7 };
