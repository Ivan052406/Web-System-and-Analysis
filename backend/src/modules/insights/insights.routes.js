const express = require("express");
const router = express.Router();
const controller = require("./insights.controller.js");

router.get("/dashboard", controller.handleGetDashboard1);

module.exports = router;
