const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./modules");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.APP_URL || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const frontendPath = path.resolve(__dirname, "../../frontend");
app.get("/", (req, res) => res.redirect("/index.html"));
app.use(express.static(frontendPath));
app.use("/api", apiRoutes);
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "API endpoint not found." }));
app.use((req, res) => res.status(404).send("Page not found."));
app.use(errorMiddleware);
module.exports = app;
