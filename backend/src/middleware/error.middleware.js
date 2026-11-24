module.exports = function errorMiddleware(error, req, res, next) {
    console.error("Server error:", error);
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({ success: false, message: status >= 500 ? "Internal server error." : error.message });
};
