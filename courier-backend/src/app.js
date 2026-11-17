import "dotenv/config";
import express from "express";
import cors from "cors";
// CORS allows the frontend to make requests to your backend
import testRoutes from "./routes/test.routes.js";
import authRoutes from "./routes/auth.routes.js" ;
import agencyRoutes from "./routes/agency.routes.js";

const app = express();
app.use(express.json()); // this makes req.body available through json 
app.use(cors());
app.use("/api/test", testRoutes);
app.use("/api/auth" , authRoutes);
app.use("/api/agencies", agencyRoutes);
app.get("/", (req, res) => {
    res.send("Courier Platform API is running");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Courier Platform API is healthy"
    });
});

const PORT = process.env.PORT || 5001;

export default app
