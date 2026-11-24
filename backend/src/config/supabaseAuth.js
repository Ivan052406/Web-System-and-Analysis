/* =====================================================
   CASIA SUPABASE AUTH CLIENT
   Express adapter for @supabase/ssr cookie handling.

   IMPORTANT: use parseCookieHeader/serializeCookieHeader from @supabase/ssr.
   Generic cookie parsers can decode/re-encode chunked auth cookies differently
   and lead to invalid JSON, missing sessions, and repeated login redirects.
   ===================================================== */

const {
    createServerClient,
    parseCookieHeader,
    serializeCookieHeader
} = require("@supabase/ssr");

function createSupabaseServerClient(req, res) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            "Supabase authentication is not configured. Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env."
        );
    }

    return createServerClient(supabaseUrl, supabaseKey, {
        cookieOptions: {
            path: "/",
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        },
        cookies: {
            getAll() {
                return parseCookieHeader(req.headers.cookie || "");
            },

            setAll(cookiesToSet, headers = {}) {
                const existingHeader = res.getHeader("Set-Cookie");
                const setCookieHeaders = Array.isArray(existingHeader)
                    ? [...existingHeader]
                    : existingHeader
                        ? [String(existingHeader)]
                        : [];

                for (const { name, value, options } of cookiesToSet) {
                    setCookieHeaders.push(
                        serializeCookieHeader(name, value, options)
                    );
                }

                if (setCookieHeaders.length) {
                    res.setHeader("Set-Cookie", setCookieHeaders);
                }

                for (const [key, value] of Object.entries(headers || {})) {
                    res.setHeader(key, value);
                }
            }
        }
    });
}

module.exports = { createSupabaseServerClient };
