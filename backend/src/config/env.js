const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../../.env");
const result = dotenv.config({ path: envPath });
if (result.error && result.error.code !== "ENOENT") throw result.error;
module.exports = process.env;
