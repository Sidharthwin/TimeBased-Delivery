import "dotenv/config";
import express from "express";
import cors from "cors";
// CORS allows the frontend to make requests to your backend
import testRoutes from "./routes/test.routes.js";
import authRoutes from "./routes/auth.routes.js" ;
import agencyRoutes from "./routes/agency.routes.js";
import consignmentRoutes from "./routes/consignment.routes.js";
import deliveryRoutes from "./routes/delivery.routes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use("/api/test", testRoutes);
app.use("/api/auth" , authRoutes);
app.use("/api/agencies", agencyRoutes);
app.use("/api", consignmentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.get("/", (req, res) => {
    res.send("Courier Platform API is running");
});

app.use(notFound);
app.use(errorHandler);

export default app
