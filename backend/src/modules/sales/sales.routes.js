const express = require("express");
const router = express.Router();
const controller = require("./sales.controller.js");
const { requireRole } = require("../../middleware/auth.middleware");

router.post("/complete", requireRole("staff"), controller.handlePostComplete1);
router.get("/recent", requireRole("admin", "staff"), controller.handleGetRecent2);
router.get("/summary", requireRole("admin", "staff"), controller.handleGetSummary3);

module.exports = router;
