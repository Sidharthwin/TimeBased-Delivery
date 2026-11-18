export default function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
        ? error.status
        : error?.code === "P2002" || error?.code === "P2004" || error?.code === "P2034"
            ? 409
            : 500;
    if (status === 500) console.error("Unhandled request error");
    return res.status(status).json({
        success: false,
        message: status === 500 ? "Internal server error" : error.message,
    });
}
