const ZIP_CORE = (() => {
  const UTF8_ENCODER = new TextEncoder();
  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      table[i] = crc >>> 0;
    }
    return table;
  })();

  function computeCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function toDosDateTime(inputDate) {
    const date = inputDate instanceof Date ? inputDate : new Date();
    const year = Math.max(1980, date.getFullYear());
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);
    return {
      dosTime: (hours << 11) | (minutes << 5) | seconds,
      dosDate: ((year - 1980) << 9) | (month << 5) | day
    };
  }

  function isArrayBufferLike(value) {
    return value instanceof ArrayBuffer ||
      Object.prototype.toString.call(value) === "[object ArrayBuffer]";
  }

  async function createStoredZipBlob(entries) {
    const files = Array.isArray(entries) ? entries : [];
    if (files.length === 0) {
      throw new Error("No files to zip.");
    }
    if (files.length > 65535) {
      throw new Error("ZIP entry count exceeds standard limit (65535).");
    }

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of files) {
      const filePath = String(entry?.path || "").replace(/^\/+/, "");
      if (!filePath) continue;

      const nameBytes = UTF8_ENCODER.encode(filePath);
      // Coerce defensively: Tampermonkey can hand us cross-realm TypedArrays
      // where `instanceof Uint8Array` is false even though the value walks and
      // talks like one. ArrayBuffer.isView is realm-agnostic and catches every
      // TypedArray + DataView shape.
      const raw = entry?.data;
      let data;
      if (raw instanceof Uint8Array) {
        data = raw;
      } else if (ArrayBuffer.isView(raw)) {
        data = new Uint8Array(raw.buffer, raw.byteOffset || 0, raw.byteLength);
      } else if (isArrayBufferLike(raw)) {
        data = new Uint8Array(raw);
      } else if (raw && typeof raw.arrayBuffer === "function") {
        data = new Uint8Array(await raw.arrayBuffer());
      } else {
        data = new Uint8Array(0);
      }
      const crc = computeCrc32(data);
      const dateInfo = toDosDateTime(entry?.lastModified || new Date());

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dateInfo.dosTime, true);
      localView.setUint16(12, dateInfo.dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dateInfo.dosTime, true);
      centralView.setUint16(14, dateInfo.dosDate, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      localParts.push(localHeader, data);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    }

    const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endOfCentralDirectory = new Uint8Array(22);
    const eocdView = new DataView(endOfCentralDirectory.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, centralParts.length, true);
    eocdView.setUint16(10, centralParts.length, true);
    eocdView.setUint32(12, centralDirectorySize, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, endOfCentralDirectory], { type: "application/zip" });
  }

  return {
    computeCrc32,
    toDosDateTime,
    createStoredZipBlob
  };
})();
// =========================================
// HOTKEY CORE
// =========================================
