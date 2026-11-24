const express = require("express");
const router = express.Router();
const controller = require("./auth.controller.js");

router.post("/signup", controller.handlePostSignup1);
router.post("/signin", controller.handlePostSignin2);
router.get("/callback", controller.handleGetCallback3);
router.post("/forgot-password", controller.handlePostForgotPassword4);
router.get("/confirm", controller.handleGetConfirm5);
router.post("/update-password", controller.handlePostUpdatePassword6);
router.post("/signout", controller.handlePostSignout7);

module.exports = router;
