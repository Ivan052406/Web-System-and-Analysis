const express = require("express");
const router = express.Router();
const controller = require("./admin.controller.js");
const { requireSupabaseAuth, requireRole } = require("../../middleware/auth.middleware");

router.post("/signup", controller.handlePostSignup1);
router.post("/login", controller.handlePostLogin2);
router.get("/me", requireSupabaseAuth, requireRole("admin"), controller.handleGetMe3);

module.exports = router;
