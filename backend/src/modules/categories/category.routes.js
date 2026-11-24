const express = require("express");
const router = express.Router();
const controller = require("./category.controller.js");
const { requireAuth, requireRole } = require("../../middleware/auth.middleware");

router.get("/", requireRole("admin", "staff"), controller.handleGetRoot1);
router.post("/", requireRole("admin"), controller.handlePostRoot2);
router.put("/:id", requireRole("admin"), controller.handlePutId3);

module.exports = router;
