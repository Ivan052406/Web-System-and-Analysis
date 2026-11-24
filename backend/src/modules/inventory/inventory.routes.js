const express = require("express");
const router = express.Router();
const controller = require("./inventory.controller.js");
const { requireRole, requireSpecificBranch } = require("../../middleware/auth.middleware");

// Staff are restricted to sales. All inventory-management endpoints are owner-only.
router.use(requireRole("admin"), requireSpecificBranch);

router.get("/", controller.handleGetRoot1);
router.get("/history", controller.handleGetHistory2);
router.patch("/:productId/minimum-stock", controller.handlePatchProductIdMinimumStock3);
router.post("/stock-in", controller.handlePostStockIn4);
router.post("/adjustment", controller.handlePostAdjustment5);

module.exports = router;
