/* auth data-access service. Feature controllers use this shared pool boundary. */
const { db } = require("../../config/database");

async function query(sql, params = []) {
    return db.query(sql, params);
}

async function withTransaction(work) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (rollbackError) { error.rollbackError = rollbackError; }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { db, query, withTransaction };
