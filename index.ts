import express from "express";
import { config } from "./config";
import { chatHandler } from "./chat";
import { attachRealtime } from "./realtime";

const app = express();
app.use(express.json());

app.post("/chat", chatHandler);

app.delete("/chat", (_req, res) => res.sendStatus(204));

const server = app.listen(config.port);
attachRealtime(server);
