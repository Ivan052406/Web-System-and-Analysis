
/* =========================================================
   CASIA DATABASE CONFIGURATION
   Supabase PostgreSQL Connection
   ========================================================= */

const { Pool } = require("pg");

// Ensure DATABASE_URL exists
if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is missing. Please check your backend/.env file."
    );
}

// Create PostgreSQL connection pool
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
async function testDatabaseConnection() {
    const result = await db.query("SELECT NOW()");

    console.log("Connected to Supabase successfully!");
    console.log("Database time:", result.rows[0].now);
}

module.exports = {
    db,
    testDatabaseConnection
};
