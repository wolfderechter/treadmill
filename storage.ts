import { DatabaseSync } from "node:sqlite";
import type { Session } from "./session-manager.ts";

const db = new DatabaseSync("treadmill.db");
db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            startTime TEXT NOT NULL,
            elapsedTime INTEGER NOT NULL,
            totalDistance INTEGER NOT NULL,
            totalEnergy INTEGER NOT NULL
        )
    `);

export function saveSession(session: Session) {
  const insert = db.prepare(`
    INSERT INTO sessions (id, startTime, elapsedTime, totalDistance, totalEnergy)
    VALUES (?, ?, ?, ?, ?)
  `);

  insert.run(
    session.id,
    session.startTime.toISOString(),
    session.elapsedTime,
    session.totalDistance,
    session.totalEnergy,
  );
}

export function getSessions(since?: Date) {
  if (!since)
    return db
      .prepare(
        `
    SELECT * FROM sessions ORDER BY startTime DESC
    `,
      )
      .all();

  return db
    .prepare(
      `
    SELECT * FROM sessions WHERE startTime >= ? ORDER BY startTime DESC
    `,
    )
    .all(since.toISOString());
}
