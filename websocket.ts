import { WebSocketServer, WebSocket } from "ws";
import type { BleManager } from "./ble-manager.ts";
import type {
  Session,
  SessionManager,
  SessionState,
} from "./session-manager.ts";
import type { Server } from "node:http";

type WSMessage =
  | { type: "connection"; payload: "connected" | "disconnected" }
  | { type: "session"; payload: Session | null }
  | { type: "state"; payload: SessionState };

export function createWebSocketServer(
  server: Server,
  ble: BleManager,
  sessions: SessionManager,
): void {
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  function broadcast(msg: WSMessage) {
    for (const client of clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      client.send(JSON.stringify(msg));
    }
  }

  ble.on("connected", () =>
    broadcast({ type: "connection", payload: "connected" }),
  );
  ble.on("disconnected", () =>
    broadcast({ type: "connection", payload: "disconnected" }),
  );
  sessions.on("sessionStart", (s) => {
    broadcast({ type: "session", payload: s });
  });
  sessions.on("sessionEnd", () => {
    broadcast({ type: "session", payload: null });
  });
  sessions.on("sessionData", (s) => {
    broadcast({ type: "session", payload: s });
  });
  sessions.on("stateChange", (state: SessionState) => {
    broadcast({ type: "state", payload: state });
  });

  wss.on("connection", (ws) => {
    clients.add(ws);

    // send connection status and session to client upon connection
    ws.send(
      JSON.stringify({
        type: "connection",
        payload: ble.isConnected() ? "connected" : "disconnected",
      }),
    );
    ws.send(
      JSON.stringify({
        type: "session",
        payload: sessions.getCurrentSession(),
      }),
    );

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });
}
