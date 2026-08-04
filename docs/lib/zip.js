const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function concat(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

async function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return encoder.encode(String(value ?? ''));
}

export async function buildZip(files, onProgress = () => {}) {
  const entries = [];
  let localOffset = 0;
  const localParts = [];
  const timestamp = dosDateTime(new Date());

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const name = encoder.encode(String(file.name).replace(/^\/+/, ''));
    const data = await toBytes(file.data);
    const checksum = crc32(data);
    const flags = 0x0800;

    const localHeader = concat(
      u32(0x04034B50),
      u16(20),
      u16(flags),
      u16(0),
      u16(timestamp.time),
      u16(timestamp.date),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    );
    localParts.push(localHeader, data);
    entries.push({ name, dataLength: data.length, checksum, offset: localOffset, flags });
    localOffset += localHeader.length + data.length;
    onProgress((index + 1) / files.length * 0.75);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const central = concat(
      u32(0x02014B50),
      u16(20),
      u16(20),
      u16(entry.flags),
      u16(0),
      u16(timestamp.time),
      u16(timestamp.date),
      u32(entry.checksum),
      u32(entry.dataLength),
      u32(entry.dataLength),
      u16(entry.name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      entry.name,
    );
    centralParts.push(central);
    centralSize += central.length;
  }

  const end = concat(
    u32(0x06054B50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(localOffset),
    u16(0),
  );
  onProgress(1);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}
