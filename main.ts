import noble from "@stoprocent/noble";
import { decodeTreadmillData } from "./util.ts";

const deviceName = process.env.DEVICE_NAME || "FS-7F5603";

try {
  await noble.waitForPoweredOnAsync();
  await noble.startScanningAsync(["1826"], false); // scan for FTMS devices only

  noble.on("discover", async (peripheral) => {
    if (peripheral.advertisement.localName !== deviceName) return;

    // Stop scanning for other devices
    await noble.stopScanningAsync();
    await peripheral.connectAsync();
    const { characteristics } =
      await peripheral.discoverSomeServicesAndCharacteristicsAsync(
        ["1826"], // FTMS service
        ["2acd"], // Treadmill data (notify)
      );

    const treadmillData = characteristics.find((c) => c.uuid === "2acd");
    if (treadmillData) {
      await treadmillData.subscribeAsync();
      treadmillData.on("data", (buffer) => {
        const data = decodeTreadmillData(buffer);
        console.log("decodeTreadmillData", data);
      });
    }
  });
} catch (error) {
  console.error("Failed to init bluetooth connection", error);
}
