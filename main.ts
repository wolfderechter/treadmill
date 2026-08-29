import { BleManager } from "./ble-manager.ts";
import { SessionManager } from "./session-manager.ts";
import { saveSession, getAllSessions } from "./storage.ts";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();
const server = serve(app);
const ble: BleManager = new BleManager();
const sessions = new SessionManager(ble);

sessions.on("sessionStart", (session) => {
  console.log("session started", session);
});
sessions.on("sessionEnd", (session) => {
  console.log("session ended", session);
  saveSession(session);
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
app.get("/api/session", (c) => {
  const currentSession = sessions.getCurrentSession();
  return c.json(currentSession);
});
app.get("/api/sessions", (c) => {
  const sessions = getAllSessions();
  console.log("all", sessions);
  return c.json(sessions);
});

app.post("/api/start", (c) => {
  ble.start();
  return c.text("treadmill started");
});
app.post("/api/stop", (c) => {
  ble.stop();
  return c.text("treadmill stopped");
});
app.post("/api/pause", (c) => {
  ble.pause();
  return c.text("treadmill paused");
});
app.post("/api/resume", (c) => {
  ble.resume();
  return c.text("treadmill resumed");
});
app.post("/api/speed", (c) => {
  const speed = c.req.query("speed");
  if (!speed)
    return c.json({ error: "Missing required query parameter: speed" }, 400);

  ble.setSpeed(Number(speed));
  return c.text(`treadmill speed set to ${speed}`);
});
