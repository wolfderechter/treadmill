import noble from "@stoprocent/noble";
import type { Peripheral } from "@stoprocent/noble"
import { decodeTreadmillData } from "./util.ts";
import { EventEmitter } from "events";

const deviceName = process.env.DEVICE_NAME || "FS-7F5603";
const RECONNECT_DELAY_MS = 2000;

export class BleManager extends EventEmitter {
  private treadmill: Peripheral | null = null;

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
            ["2acd"], // Treadmill data (notify)
          );

        const treadmillData = characteristics.find((c) => c.uuid === "2acd");
        if (!treadmillData) return;

        await treadmillData.subscribeAsync();
        treadmillData.on("data", (buffer) => {
          this.emit("data", decodeTreadmillData(buffer));
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
  private async reconnect(): Promise<void> {
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS)); // sleep for x ms
    await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only
  }

  private async cleanup(): Promise<void> {
    await this.treadmill?.disconnectAsync();
    await noble.stopScanningAsync();
  }
}
