import "dotenv/config";
import express from "express";

const app = express();

const PORT = process.env.PORT || 5001;

app.get("/", (req, res) => {
    res.send("Courier Platform API is running");
});
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Courier Platform API is healthy"
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});