import express from "express";

const router = express.Router()

router.post("/test", (req, res) => {
    console.log(req.body);

    res.status(201).json({
        success: true,
        receivedData: req.body
    });
});

export default router;