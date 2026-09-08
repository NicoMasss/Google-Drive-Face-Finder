import express, { Request, Response } from "express";
import cors from "cors";
import searchRoutes from "./routes/search.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/search", searchRoutes);

export default app;