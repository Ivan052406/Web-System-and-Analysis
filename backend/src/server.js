require("./config/env");
const app = require("./app");
const { db, testDatabaseConnection } = require("./config/database");
const PORT = Number(process.env.PORT || 3000);
let server;
let shuttingDown = false;

async function startServer() {
    try {
        console.log("Connecting to Supabase PostgreSQL...");
        await testDatabaseConnection();
        server = app.listen(PORT, () => {
            console.log("\nCASIA SERVER STARTED");
            console.log(`Server URL: http://localhost:${PORT}`);
            console.log("Database: Supabase PostgreSQL");
            console.log("API: /api\n");
        });
    } catch (error) {
        console.error("Unable to start CASIA server:", error.message);
        try { await db.end(); } catch (closeError) { console.error("Database shutdown error:", closeError.message); }
        process.exitCode = 1;
    }
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received. Closing CASIA server...`);
    try {
        if (server) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        await db.end();
        console.log("Database connection closed. CASIA server stopped.");
        process.exitCode = 0;
    } catch (error) { console.error("Shutdown error:", error.message); process.exitCode = 1; }
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
startServer();
