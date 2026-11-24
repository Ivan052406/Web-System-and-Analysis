const express = require("express");
const router = express.Router();
const controller = require("./student.controller.js");
const { requireAuth, requireRole } = require("../../middleware/auth.middleware");

router.get("/catalog", requireRole("student"), controller.handleGetCatalog1);

module.exports = router;
