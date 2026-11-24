/* CASIA API route registry. */
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole, resolveBranchContext } = require("../middleware/auth.middleware");

const authRoutes = require("./auth/auth.routes");
const adminRoutes = require("./auth/admin.routes");
const staffRoutes = require("./staff/staff.routes");
const studentRoutes = require("./student/student.routes");
const productRoutes = require("./products/product.routes");
const categoryRoutes = require("./categories/category.routes");
const salesRoutes = require("./sales/sales.routes");
const branchRoutes = require("./branches/branches.routes");
const dashboardRoutes = require("./dashboard/dashboard.routes");
const inventoryRoutes = require("./inventory/inventory.routes");
const restockingRoutes = require("./restocking/restocking.routes");
const analyticsRoutes = require("./analytics/analytics.routes");
const insightsRoutes = require("./insights/insights.routes");

router.get("/health", (req, res) => res.json({ success: true, message: "CASIA API is running." }));
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/staff", staffRoutes);

// All routes below require either Supabase Auth or a validated branch-locked
// staff access session. Owner branch selection is resolved once per request.
router.use(requireAuth);
router.use(resolveBranchContext);
router.use("/student", studentRoutes);
router.use("/branches", branchRoutes);
router.use("/", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/sales", salesRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/restocking", restockingRoutes);
router.use("/dashboard", requireRole("admin"), dashboardRoutes);
router.use("/analytics", requireRole("admin"), analyticsRoutes);
router.use("/insights", requireRole("admin"), insightsRoutes);

module.exports = router;
