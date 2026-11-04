import "dotenv/config";
import express from "express";
import cors from "cors";
// CORS allows the frontend to make requests to your backend
import testRoutes from "./routes/test.routes.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use("/api", testRoutes);

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

// app.post("/api/test", (req, res) => {
//     console.log(req.body);

//     res.status(201).json({
//         success: true,
//         receivedData: req.body
//     });
// });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});