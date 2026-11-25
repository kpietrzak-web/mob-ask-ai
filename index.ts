import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { chatHandler } from "./chat";
import { attachRealtime } from "./realtime";
import { authMiddleware } from "./middleware/auth";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.post("/chat", authMiddleware, chatHandler);

app.delete("/chat", (_req, res) => res.sendStatus(204));

const server = app.listen(config.port);
attachRealtime(server);
