import { BleManager } from "./ble-manager.ts";
import { SessionManager } from "./session-manager.ts";
import { saveSession } from "./storage.ts";

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
