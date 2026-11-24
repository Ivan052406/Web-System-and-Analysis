const express = require("express");
const router = express.Router();
const controller = require("./branches.controller");
const { requireRole } = require("../../middleware/auth.middleware");

router.use(requireRole("admin"));
router.get("/", controller.listBranches);
router.post("/", controller.createBranch);
router.patch("/:id/status", controller.updateBranchStatus);
module.exports = router;
