import { EventEmitter } from "events";
import type { TreadmillData } from "./util.ts";
import { BleManager } from "./ble-manager.ts";
import { randomUUIDv7 } from "crypto";

export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  totalDistance: number;
  totalEnergy: number;
  currentSpeed: number;
}

export class SessionManager extends EventEmitter {
  private session: Session | null = null;

  constructor(ble: BleManager) {
    super();
    ble.on("data", (data) => this.ingest(data));
  }

  getCurrentSession(): Session | null {
    return this.session;
  }

  private ingest(data: TreadmillData): void {
    // Session management: detect workouts based on speed changes
    // if speed > 0 and no active session: start session
    // if active session: update session with latest data
    // if active session && speed === 0: end session, save to DB
    const speed = data.INSTANTANEOUS_SPEED ?? 0;
    if (!this.session && speed > 0) {
      this.startSession(data);
      return;
    }

    if (this.session) {
      if (speed > 0) {
        this.updateSession(data);
      } else if (speed === 0) {
        this.endSession();
      }
    }
  }

  private startSession(data: TreadmillData): void {
    this.session = {
      id: randomUUIDv7(),
      startTime: new Date(),
      totalDistance: data.TOTAL_DISTANCE ?? 0,
      totalEnergy: data.TOTAL_ENERGY ?? 0,
      currentSpeed: data.INSTANTANEOUS_SPEED ?? 0,
    };
    this.emit("sessionStart", this.session);
  }

  private updateSession(data: TreadmillData): void {
    if (!this.session) return;

    this.session.currentSpeed =
      data.INSTANTANEOUS_SPEED ?? this.session.currentSpeed;
    this.session.totalDistance =
      data.TOTAL_DISTANCE ?? this.session.totalDistance;
    this.session.totalEnergy = data.TOTAL_ENERGY ?? this.session.totalEnergy;
  }

  private endSession(): void {
    if (!this.session) return;

    this.session.currentSpeed = 0;
    this.session.endTime = new Date();
    this.emit("sessionEnd", this.session);
    this.session = null;
  }
}
