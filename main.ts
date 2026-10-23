import { BleManager } from "./ble-manager.ts";
import { SessionManager } from "./session-manager.ts";
import { saveSession, getSessions } from "./storage.ts";
import express from "express";
import { createWebSocketServer } from "./websocket.ts";
import { PERIOD_TO_DAYS } from "./util.ts";

const app = express();
const server = app.listen(3033, () => {
  console.log("server running on http://localhost:3033");
});
const ble: BleManager = new BleManager();
const sessions = new SessionManager(ble);
createWebSocketServer(server, ble, sessions);

sessions.on("sessionStart", (session) => {
  console.log("session started", session);
});
sessions.on("sessionEnd", (session) => {
  console.log("session ended", session);
  // only save sessions longer than 100m to db
  if (session.totalDistance > 100) saveSession(session);
});

ble.on("connected", () => {
  console.log("connected");
});

ble.on("disconnected", () => {
  console.log("disconnected");
});

await ble.connect();

const cleanup = async () => {
  await ble.cleanup();
  server.close();
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Web server
app.get("/api/session", (req, res) => {
  if (!ble.isConnected())
    return res.status(503).json({ error: "treadmill disconnected" });

  const currentSession = sessions.getCurrentSession();
  return res.json(currentSession);
});
app.get("/api/sessions", (req, res) => {
  const period = req.query.period ?? "all"; // default to sending all sessions if no period is specified
  if (period === "all") return res.json(getSessions());

  if (typeof period !== "string" || !Object.hasOwn(PERIOD_TO_DAYS, period)) {
    return res
      .status(400)
      .json({ error: "period must be: week, month, year or all" });
  }

  const days = PERIOD_TO_DAYS[period as keyof typeof PERIOD_TO_DAYS];
  return res.json(
    getSessions(new Date(Date.now() - days * 24 * 60 * 60 * 1000)),
  );
});

app.post("/api/start", async (req, res) => {
  await ble.start();
  return res.send("treadmill started");
});
app.post("/api/stop", (req, res) => {
  ble.stop();
  return res.send("treadmill stopped");
});
app.post("/api/pause", (req, res) => {
  ble.pause();
  sessions.pause();
  return res.send("treadmill paused");
});
app.post("/api/resume", (req, res) => {
  ble.resume();
  sessions.resume();
  return res.send("treadmill resumed");
});
app.post("/api/speed", (req, res) => {
  const speed = Number(req.query.speed);
  if (!speed)
    return res
      .status(400)
      .json({ error: "Missing required query parameter: speed" });

  if (!Number.isInteger(speed) || speed < 100 || speed > 2500)
    return res
      .status(400)
      .json({ error: "speed must be an integer between 100 and 2500" });

  ble.setSpeed(Number(speed));
  return res.send(`treadmill speed set to ${speed}`);
});

app.use(express.static("public"));
