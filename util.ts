/**
 * Decoder for Bluetooth FTMS (Fitness Machine Service) Treadmill Data characteristic.
 *
 * Packet layout: a 16-bit little-endian flags field, followed by a variable
 * set of fields. Each field is only present if its corresponding bit is set
 * in `flags` (except INSTANTANEOUS_SPEED, whose bit is inverted: 0 = present).
 * Fields appear in a fixed order and must be read in that order, since each
 * one's offset depends on the size of every optional field before it.
 *
 * Reference: Bluetooth FTMS spec, Treadmill Data characteristic (0x2ACD).
 */

type FieldSize = 1 | 2 | 3;

interface FieldDef {
  name: string;
  bit: number;
  size: FieldSize;
  signed?: boolean;
  invertedFlag?: boolean;
}

const TREADMILL_DATA_FIELDS: FieldDef[] = [
  { name: "INSTANTANEOUS_SPEED", bit: 0, size: 2, invertedFlag: true }, // bit=0 means present
  { name: "AVERAGE_SPEED", bit: 1, size: 2 },
  { name: "TOTAL_DISTANCE", bit: 2, size: 3 }, // UInt24
  { name: "INCLINATION", bit: 3, size: 2, signed: true },
  { name: "RAMP_ANGLE_SETTING", bit: 3, size: 2, signed: true },
  { name: "ELEVATION_GAIN_POSITIVE", bit: 4, size: 2 },
  { name: "ELEVATION_GAIN_NEGATIVE", bit: 4, size: 2 },
  { name: "INSTANTANEOUS_PACE", bit: 5, size: 1 },
  { name: "AVERAGE_PACE", bit: 6, size: 1 },
  { name: "TOTAL_ENERGY", bit: 7, size: 2 },
  { name: "ENERGY_PER_HOUR", bit: 7, size: 2 }, // not used - device reports as unavailable
  { name: "ENERGY_PER_MINUTE", bit: 7, size: 1 }, // not used - device reports as unavailable
  { name: "HEART_RATE", bit: 8, size: 1 },
  { name: "METABOLIC_EQUIVALENT", bit: 9, size: 1 },
  { name: "ELAPSED_TIME", bit: 10, size: 2 },
  { name: "REMAINING_TIME", bit: 11, size: 2 },
  { name: "FORCE_ON_BELT", bit: 12, size: 2, signed: true },
  { name: "POWER_OUTPUT", bit: 12, size: 2, signed: true },
];

// FTMS "not available" sentinel values per integer width.
const NOT_AVAILABLE: Record<FieldSize, number> = {
  1: 0xff,
  2: 0xffff,
  3: 0xffffff,
};

function readField(
  buffer: Buffer,
  offset: number,
  size: FieldSize,
  signed?: boolean,
): number {
  if (signed) {
    if (size === 1) return buffer.readInt8(offset);
    if (size === 2) return buffer.readInt16LE(offset);
    if (size === 3) return buffer.readIntLE(offset, 3);
  } else {
    if (size === 1) return buffer.readUInt8(offset);
    if (size === 2) return buffer.readUInt16LE(offset);
    if (size === 3) return buffer.readUIntLE(offset, 3);
  }
  throw new Error(`Unsupported field size: ${size}`);
}

export interface DecodeOptions {
  /** Include _flags/_bytesConsumed/_bufferLength in the result for debugging. */
  includeRaw?: boolean;
}

export interface TreadmillData {
  INSTANTANEOUS_SPEED?: number | null;
  AVERAGE_SPEED?: number | null;
  TOTAL_DISTANCE?: number | null;
  INCLINATION?: number | null;
  RAMP_ANGLE_SETTING?: number | null;
  ELEVATION_GAIN_POSITIVE?: number | null;
  ELEVATION_GAIN_NEGATIVE?: number | null;
  INSTANTANEOUS_PACE?: number | null;
  AVERAGE_PACE?: number | null;
  TOTAL_ENERGY?: number | null;
  ENERGY_PER_HOUR?: number | null;
  ENERGY_PER_MINUTE?: number | null;
  HEART_RATE?: number | null;
  METABOLIC_EQUIVALENT?: number | null;
  ELAPSED_TIME?: number | null;
  REMAINING_TIME?: number | null;
  FORCE_ON_BELT?: number | null;
  POWER_OUTPUT?: number | null;
  _flags?: string;
  _bytesConsumed?: number;
  _bufferLength?: number;
}

/**
 * Decode a raw FTMS Treadmill Data buffer into a labeled object.
 *
 * @param buffer - raw characteristic value
 * @param options
 * @returns decoded fields, keyed by name. Fields reported as "not available" by the device are set to null.
 */
export function decodeTreadmillData(
  buffer: Buffer,
  options: DecodeOptions = {},
): TreadmillData {
  const { includeRaw = false } = options;
  const flags = buffer.readUInt16LE(0);
  let offset = 2;
  const result: TreadmillData = {};

  for (const field of TREADMILL_DATA_FIELDS) {
    const bitSet = (flags & (1 << field.bit)) !== 0;
    const present = field.invertedFlag ? !bitSet : bitSet;
    if (!present) continue;

    const rawValue = readField(buffer, offset, field.size, field.signed);
    const isNotAvailable =
      !field.signed && rawValue === NOT_AVAILABLE[field.size];
    (result as Record<string, number | null>)[field.name] = isNotAvailable
      ? null
      : rawValue;

    offset += field.size;
  }

  if (includeRaw) {
    result._flags = flags.toString(2).padStart(16, "0");
    result._bytesConsumed = offset;
    result._bufferLength = buffer.length;
  }

  return result;
}

export const PERIOD_TO_DAYS = {
  week: 7,
  month: 30,
  year: 365,
};
