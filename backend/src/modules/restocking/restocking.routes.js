const express = require("express");
const router = express.Router();
const controller = require("./restocking.controller.js");
const { requireRole, requireSpecificBranch } = require("../../middleware/auth.middleware");

// Restocking and supplier management are reserved for Business Owners/Admins.
router.use(requireRole("admin"), requireSpecificBranch);

router.get("/dashboard", controller.handleGetDashboard1);
router.get("/suppliers", controller.handleGetSuppliers2);
router.post("/suppliers", controller.handlePostSuppliers3);
router.patch("/suppliers/:supplierId", controller.handlePatchSuppliersSupplierId4);
router.get("/products", controller.handleGetProducts5);
router.get("/history", controller.handleGetHistory6);
router.post("/record", controller.handlePostRecord7);

module.exports = router;
