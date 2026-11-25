const express = require("express");
const router = express.Router();
const controller = require("./product.controller.js");
const { requireAuth, requireRole } = require("../../middleware/auth.middleware");

router.get("/data", requireRole("admin", "staff"), controller.handleGetData1);
router.post("/addProduct", requireRole("admin"), controller.handlePostAddProduct2);
router.put("/products/:id", requireRole("admin"), controller.handlePutProductsId3);
router.post("/products/:id/image", requireRole("admin"), controller.handlePostProductImage6);
router.delete("/products/:id/image", requireRole("admin"), controller.handleDeleteProductImage7);
router.patch("/products/:id/status", requireRole("admin"), controller.handlePatchProductsIdStatus4);
router.delete("/products/:id", requireRole("admin"), controller.handleDeleteProductsId5);

module.exports = router;