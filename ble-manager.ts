import noble from "@stoprocent/noble";
import type { Characteristic, Peripheral } from "@stoprocent/noble";
import { decodeTreadmillData } from "./util.ts";
import { EventEmitter } from "events";

const deviceName = process.env.DEVICE_NAME || "FS-7F5603";
const RECONNECT_DELAY_MS = 2000;

// OP codes: see '4.16.1 Fitness Machine Control Point Procedure Requirements' of the FTMS manual
// 0x00: request control
// 0x02: set speed
// 0x07: start (0x01) or resume (0x02)
// 0x08: stop (0x01) or pause (0x02)
export class BleManager extends EventEmitter {
  private treadmill: Peripheral | null = null;
  private treadmillWrite: Characteristic | null = null;

  isConnected(): boolean {
    return this.treadmill !== null;
  }

  async setSpeed(speed: number): Promise<void> {
    if (!this.treadmillWrite) return;

    await this.requestControl();

    const speedBuffer = Buffer.alloc(3);
    speedBuffer.writeUInt8(0x02, 0);
    speedBuffer.writeUInt16LE(speed, 1);
    await this.treadmillWrite.writeAsync(speedBuffer, false);
  }
  async start(): Promise<void> {
    if (!this.treadmillWrite) return;

    await this.requestControl();

    const speedBuffer = Buffer.alloc(3);
    speedBuffer.writeUInt8(0x07, 0);
    speedBuffer.writeUInt16LE(0, 1);
    await this.treadmillWrite.writeAsync(speedBuffer, false);
  }
  async resume(): Promise<void> {
    if (!this.treadmillWrite) return;

    await this.requestControl();

    const speedBuffer = Buffer.alloc(3);
    speedBuffer.writeUInt8(0x07, 0);
    speedBuffer.writeUInt16LE(0x02, 1);
    await this.treadmillWrite.writeAsync(speedBuffer, false);
  }
  async stop(): Promise<void> {
    if (!this.treadmillWrite) return;

    await this.requestControl();

    const speedBuffer = Buffer.alloc(3);
    speedBuffer.writeUInt8(0x08, 0);
    speedBuffer.writeUInt16LE(0x01, 1);
    await this.treadmillWrite.writeAsync(speedBuffer, false);
  }
  async pause(): Promise<void> {
    if (!this.treadmillWrite) return;

    await this.requestControl();

    const speedBuffer = Buffer.alloc(3);
    speedBuffer.writeUInt8(0x08, 0);
    speedBuffer.writeUInt16LE(0x02, 1);
    await this.treadmillWrite.writeAsync(speedBuffer, false);
  }

  async connect(): Promise<void> {
    await noble.waitForPoweredOnAsync();
    await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only

    noble.on("discover", async (peripheral) => {
      if (peripheral.advertisement.localName !== deviceName) return;

      // Stop scanning for other devices
      await noble.stopScanningAsync();
      this.treadmill = peripheral;

      try {
        await peripheral.connectAsync();
        const { characteristics } =
          await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            ["1826"], // FTMS service
            ["2acd", "2ad9"], // Treadmill data (notify and write)
          );
        const treadmillData = characteristics.find((c) => c.uuid === "2acd");
        this.treadmillWrite =
          characteristics.find((c) => c.uuid === "2ad9") ?? null;

        if (!treadmillData) return;

        await treadmillData.subscribeAsync();
        treadmillData.on("data", (buffer) => {
          this.emit("data", decodeTreadmillData(buffer));
        });

        await this.treadmillWrite?.subscribeAsync();
        this.treadmillWrite?.on("data", (buffer) => {
          // this is the response from the treadmill
          console.log("control point response", buffer);
        });

        this.emit("connected");

        peripheral.on("disconnect", () => {
          this.treadmill = null;
          this.emit("disconnected");
          this.reconnect();
        });
      } catch (error) {
        this.emit("disconnected");
        this.reconnect();
      }
    });
  }

  async cleanup(): Promise<void> {
    await this.treadmill?.disconnectAsync();
    await noble.stopScanningAsync();
  }

  private async reconnect(): Promise<void> {
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS)); // sleep for x ms
    await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only
  }

  private async requestControl(): Promise<void> {
    if (!this.treadmillWrite) return;

    const responsePromise = this.waitForResponse();
    const requestControl = Buffer.alloc(1);
    requestControl.writeUInt8(0x00, 0);
    await this.treadmillWrite.writeAsync(requestControl, false);
    const response = await responsePromise;

    if (response[2] !== 0x01) {
      throw new Error(`Request control failed with result: ${response[2]}`);
    }
  }

  private waitForResponse(): Promise<Buffer> {
    return new Promise((resolve) => {
      this.treadmillWrite!.once("data", (buffer) => {
        resolve(buffer);
      });
    });
  }
}
