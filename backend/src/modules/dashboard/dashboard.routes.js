const express = require("express");
const router = express.Router();
const controller = require("./dashboard.controller.js");

router.get("/", controller.handleGetRoot1);
router.get("/recent-sales", controller.handleGetRecentSales2);
router.get("/recent-restocks", controller.handleGetRecentRestocks3);
router.get("/peak-period", controller.handleGetPeakPeriod4);

module.exports = router;
