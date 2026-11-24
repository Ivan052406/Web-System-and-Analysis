const express = require("express");
const router = express.Router();
const controller = require("./staff.controller.js");
const { requireAuth, requireRole } = require("../../middleware/auth.middleware");

router.post("/branches", controller.handlePostBranches);
router.post("/access", controller.handlePostAccess);
router.get("/me", requireAuth, requireRole("staff"), controller.handleGetMe);
router.post("/logout", requireAuth, requireRole("staff"), controller.handlePostLogout);
module.exports = router;
