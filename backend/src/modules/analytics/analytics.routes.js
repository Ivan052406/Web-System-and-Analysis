const express = require("express");
const router = express.Router();
const controller = require("./analytics.controller.js");

router.get("/dashboard", controller.handleGetDashboard1);

module.exports = router;
