import { withBindings } from "@stoprocent/noble";
import type { Characteristic, Peripheral } from "@stoprocent/noble";
import { decodeTreadmillData } from "./util.ts";
import { EventEmitter } from "events";
import PQueue from "p-queue";

const deviceName = process.env.DEVICE_NAME || "FS-7F5603";
const RECONNECT_DELAY_MS = 2000;
// Go through BlueZ over D-Bus instead of the raw HCI socket
process.env.NOBLE_BINDINGS = "dbus";
const noble = withBindings("default");

// OP codes: see '4.16.1 Fitness Machine Control Point Procedure Requirements' of the FTMS manual
// 0x00: request control
// 0x02: set speed
// 0x07: start (0x01) or resume (0x02)
// 0x08: stop (0x01) or pause (0x02)

function log(message: string, buffer?: Buffer): void {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`, buffer ?? "");
}

export class BleManager extends EventEmitter {
  private treadmill: Peripheral | null = null;
  private treadmillWrite: Characteristic | null = null;
  private queue = new PQueue({ concurrency: 1, timeout: 5000 });

  isConnected(): boolean {
    return this.treadmill !== null;
  }

  setSpeed(speed: number): Promise<void> {
    return this.controlPoint(0x02, speed, "setSpeed");
  }
  start(): Promise<void> {
    return this.controlPoint(0x07, 0x00, "start");
  }
  resume(): Promise<void> {
    return this.controlPoint(0x07, 0x02, "resume");
  }
  stop(): Promise<void> {
    return this.controlPoint(0x08, 0x01, "stop");
  }
  pause(): Promise<void> {
    return this.controlPoint(0x08, 0x02, "pause");
  }

  private controlPoint(
    opcode: number,
    value: number,
    label: string,
  ): Promise<void> {
    const buffer = Buffer.alloc(3);
    buffer.writeUInt8(opcode, 0);
    buffer.writeUInt16LE(value, 1);
    // Errors are logged here so fire-and-forget callers can't turn into
    // unhandled rejections.
    return this.queue
      .add(() => this.sendControlPoint(buffer))
      .catch((error) =>
        console.error(`${label} failed:`, (error as Error).message),
      );
  }

  private async sendControlPoint(buffer: Buffer): Promise<void> {
    if (!this.treadmillWrite) return; // disconnected, nothing to send
    await this.treadmillWrite.writeAsync(buffer, false);
  }

  async connect(): Promise<void> {
    await noble.waitForPoweredOnAsync();

    // Register before scanning: with D-Bus, devices BlueZ already knows about are reported while startScanningAsync is still running (resulting in a race condition).
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
          log("control point response", buffer);
        });

        // Take over the FTMS control point once per connection
        // afterwards the treadmill accepts speed/start/stop writes without a requestControl
        try {
          await this.queue.add(() => this.requestControl());
        } catch (error) {
          console.error("requestControl failed:", (error as Error).message);
        }

        this.emit("connected");

        peripheral.once("disconnect", () => {
          log("treadmill disconnected");
          this.treadmill = null;
          this.treadmillWrite = null;
          this.emit("disconnected");
          this.reconnect();
        });
      } catch (error) {
        this.treadmill = null;
        this.treadmillWrite = null;
        this.emit("disconnected");
        this.reconnect();
      }
    });

    await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only
  }

  async cleanup(): Promise<void> {
    await this.queue.onIdle();
    await this.treadmill?.disconnectAsync();
    await noble.stopScanningAsync();
  }

  private async reconnect(): Promise<void> {
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS)); // sleep for x ms
    await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only
  }

  private async requestControl(): Promise<void> {
    if (!this.treadmillWrite) return;

    const requestControl = Buffer.alloc(1);
    requestControl.writeUInt8(0x00, 0);
    // Start listening before writing: with D-Bus the response can arrive before writeAsync resolves.
    const [response] = await Promise.all([
      this.waitForResponse(),
      this.treadmillWrite.writeAsync(requestControl, false),
    ]);

    if (response[2] !== 0x01) {
      throw new Error(`Request control failed with result: ${response[2]}`);
    }
  }

  // Wait for the control point response. The timeout removes the listener if
  // the treadmill never answers, instead of leaking it.
  private waitForResponse(timeoutMs = 500): Promise<Buffer> {
    const characteristic = this.treadmillWrite!;
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const onData = (buffer: Buffer) => {
        clearTimeout(timer);
        resolve(buffer);
      };
      timer = setTimeout(() => {
        characteristic.off("data", onData);
        reject(new Error("control point response timed out"));
      }, timeoutMs);
      characteristic.once("data", onData);
    });
  }
}
