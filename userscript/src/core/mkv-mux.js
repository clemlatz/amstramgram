const MKV_MUX_CORE = (() => {
  const EBML = {
    Header: new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]),
    EBMLVersion: new Uint8Array([0x42, 0x86]),
    EBMLReadVersion: new Uint8Array([0x42, 0xF7]),
    EBMLMaxIDLength: new Uint8Array([0x42, 0xF2]),
    EBMLMaxSizeLength: new Uint8Array([0x42, 0xF3]),
    DocType: new Uint8Array([0x42, 0x82]),
    DocTypeVersion: new Uint8Array([0x42, 0x87]),
    DocTypeReadVersion: new Uint8Array([0x42, 0x85]),
    Void: new Uint8Array([0xEC]),
    CRC32: new Uint8Array([0xBF])
  };

  const MKV = {
    Segment: new Uint8Array([0x18, 0x53, 0x80, 0x67]),
    Info: new Uint8Array([0x15, 0x49, 0xA9, 0x66]),
    TimestampScale: new Uint8Array([0x2A, 0xD7, 0xB1]),
    Duration: new Uint8Array([0x44, 0x89]),
    MuxingApp: new Uint8Array([0x4D, 0x80]),
    WritingApp: new Uint8Array([0x57, 0x41]),
    Tracks: new Uint8Array([0x16, 0x54, 0xAE, 0x6B]),
    TrackEntry: new Uint8Array([0xAE]),
    TrackNumber: new Uint8Array([0xD7]),
    TrackUID: new Uint8Array([0x73, 0xC5]),
    TrackType: new Uint8Array([0x83]),
    FlagLacing: new Uint8Array([0x9C]),
    CodecID: new Uint8Array([0x86]),
    CodecPrivate: new Uint8Array([0x63, 0xA2]),
    Video: new Uint8Array([0xE0]),
    PixelWidth: new Uint8Array([0xB0]),
    PixelHeight: new Uint8Array([0xBA]),
    Audio: new Uint8Array([0xE1]),
    SamplingFrequency: new Uint8Array([0xB5]),
    Channels: new Uint8Array([0x9F]),
    Cluster: new Uint8Array([0x1F, 0x43, 0xB6, 0x75]),
    Timestamp: new Uint8Array([0xE7]),
    SimpleBlock: new Uint8Array([0xA3])
  };

  const TIMESTAMP_SCALE_NS = 1000000;
  // 1s clusters match what ffmpeg's matroskaenc emits by default. Larger
  // clusters (we tried 5s) caused VLC to delay audio playback by several
  // seconds because audio SimpleBlocks live deep inside a multi-MB cluster
  // body, after the video samples for the same window.
  const CLUSTER_DURATION_MICROS = 1000000;

  function toUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    return new Uint8Array(input);
  }

  function copyBytes(bytes) {
    const src = toUint8Array(bytes);
    return src.slice ? src.slice() : new Uint8Array(src);
  }

  function concatUint8Arrays(parts) {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }

  function readU16BE(buf, off) {
    return (buf[off] << 8) | buf[off + 1];
  }

  function readU32BE(buf, off) {
    return (
      (buf[off] << 24) >>> 0 |
      (buf[off + 1] << 16) |
      (buf[off + 2] << 8) |
      buf[off + 3]
    ) >>> 0;
  }

  function readS32BE(buf, off) {
    const v = readU32BE(buf, off);
    return v > 0x7fffffff ? v - 0x100000000 : v;
  }

  function readU64BE(buf, off) {
    return (BigInt(readU32BE(buf, off)) << 32n) | BigInt(readU32BE(buf, off + 4));
  }

  function writeUnsignedPayload(value) {
    let n = typeof value === "bigint" ? value : BigInt(value);
    if (n < 0n) throw new Error("EBML unsigned integer cannot be negative");
    const bytes = [];
    do {
      bytes.unshift(Number(n & 0xffn));
      n >>= 8n;
    } while (n > 0n);
    return new Uint8Array(bytes);
  }

  function writeVint(value, width) {
    const n = typeof value === "bigint" ? value : BigInt(value);
    if (n < 0n) throw new Error("VINT value cannot be negative");
    let chosen = width || 0;
    if (!chosen) {
      for (let w = 1; w <= 8; w++) {
        const max = (1n << BigInt(7 * w)) - 2n;
        if (n <= max) {
          chosen = w;
          break;
        }
      }
    }
    if (chosen < 1 || chosen > 8) throw new Error(`invalid VINT width: ${chosen}`);
    const max = (1n << BigInt(7 * chosen)) - 2n;
    if (n > max) throw new Error(`VINT value ${value} does not fit in ${chosen} bytes`);
    const out = new Uint8Array(chosen);
    let tmp = n;
    for (let i = chosen - 1; i >= 0; i--) {
      out[i] = Number(tmp & 0xffn);
      tmp >>= 8n;
    }
    out[0] |= 1 << (8 - chosen);
    return out;
  }

  function writeVintUnknownSize(width) {
    if (width < 1 || width > 8) throw new Error(`invalid unknown-size VINT width: ${width}`);
    const out = new Uint8Array(width);
    out[0] = (1 << (8 - width)) - 1;
    out[0] |= 1 << (8 - width);
    for (let i = 1; i < width; i++) out[i] = 0xff;
    return out;
  }

  function writeElement(id, payload) {
    const idBytes = toUint8Array(id);
    const payloadBytes = toUint8Array(payload);
    return concatUint8Arrays([idBytes, writeVint(payloadBytes.length), payloadBytes]);
  }

  function writeUintElement(id, value) {
    return writeElement(id, writeUnsignedPayload(value));
  }

  function writeStringElement(id, value) {
    return writeElement(id, new TextEncoder().encode(String(value)));
  }

  function writeFloatElement(id, value) {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setFloat64(0, Number(value), false);
    return writeElement(id, out);
  }

  function writeBinaryElement(id, bytes) {
    return writeElement(id, toUint8Array(bytes));
  }

  function mp4Core() {
    if (typeof MP4_REMUX_CORE === "undefined" || !MP4_REMUX_CORE) {
      throw new Error("MP4_REMUX_CORE is required before MKV_MUX_CORE");
    }
    return MP4_REMUX_CORE;
  }

  function mp4Children(buf, hdr) {
    return mp4Core().__test_readContainerChildren(buf, hdr);
  }

  function mp4BoxHeader(buf, off) {
    return mp4Core().__test_readBoxHeader(buf, off);
  }

  function mp4FindChild(buf, hdr, type) {
    return mp4Children(buf, hdr).find((c) => c.type === type) || null;
  }

  function findStsd(buf, trakHdr) {
    const mdia = mp4FindChild(buf, trakHdr, "mdia");
    if (!mdia) throw new Error("trak missing mdia");
    const minf = mp4FindChild(buf, mdia, "minf");
    if (!minf) throw new Error("trak missing minf");
    const stbl = mp4FindChild(buf, minf, "stbl");
    if (!stbl) throw new Error("trak missing stbl");
    const stsd = mp4FindChild(buf, stbl, "stsd");
    if (!stsd) throw new Error("trak missing stsd");
    return stsd;
  }

  function findSampleEntry(buf, trakHdr, expectedType) {
    const stsd = findStsd(buf, trakHdr);
    let off = stsd.contentStart + 8;
    while (off + 8 <= stsd.contentEnd) {
      const hdr = mp4BoxHeader(buf, off);
      if (hdr.size < 8 || hdr.contentEnd > stsd.contentEnd) {
        throw new Error("malformed stsd sample entry");
      }
      if (!expectedType || hdr.type === expectedType) return hdr;
      off = hdr.contentEnd;
    }
    throw new Error(`missing ${expectedType || "sample"} entry`);
  }

  function findSampleEntryChild(buf, entryHdr, type, childOffsetFromContent) {
    let off = entryHdr.contentStart + childOffsetFromContent;
    while (off + 8 <= entryHdr.contentEnd) {
      const hdr = mp4BoxHeader(buf, off);
      if (hdr.size < 8 || hdr.contentEnd > entryHdr.contentEnd) {
        throw new Error(`malformed ${entryHdr.type} child box`);
      }
      if (hdr.type === type) return hdr;
      off = hdr.contentEnd;
    }
    throw new Error(`${entryHdr.type} missing ${type}`);
  }

  function extractVp9CodecPrivate(buf, trakHdr) {
    const entry = findSampleEntry(buf, trakHdr, "vp09");
    const vpcc = findSampleEntryChild(buf, entry, "vpcC", 78);
    if (vpcc.contentEnd <= vpcc.contentStart + 4) {
      throw new Error("vpcC payload is empty");
    }
    return copyBytes(buf.subarray(vpcc.contentStart + 4, vpcc.contentEnd));
  }

  function readDescriptorSize(buf, off, end) {
    let size = 0;
    let count = 0;
    while (off < end && count < 4) {
      const b = buf[off++];
      size = (size << 7) | (b & 0x7f);
      count += 1;
      if ((b & 0x80) === 0) return { size, next: off };
    }
    throw new Error("malformed MPEG-4 descriptor size");
  }

  function findDescriptorPayload(buf, start, end, targetTag) {
    let off = start;
    while (off + 2 <= end) {
      const tag = buf[off++];
      const sizeInfo = readDescriptorSize(buf, off, end);
      const payloadStart = sizeInfo.next;
      const payloadEnd = payloadStart + sizeInfo.size;
      if (payloadEnd > end) throw new Error("MPEG-4 descriptor exceeds parent payload");
      if (tag === targetTag) return buf.subarray(payloadStart, payloadEnd);

      let childStart = payloadEnd;
      if (tag === 0x03) {
        if (payloadStart + 3 <= payloadEnd) {
          const flags = buf[payloadStart + 2];
          childStart = payloadStart + 3;
          if (flags & 0x80) childStart += 2;
          if (flags & 0x40) {
            const urlLength = childStart < payloadEnd ? buf[childStart] : 0;
            childStart += 1 + urlLength;
          }
          if (flags & 0x20) childStart += 2;
        }
      } else if (tag === 0x04) {
        childStart = payloadStart + 13;
      }

      if (childStart < payloadEnd) {
        const nested = findDescriptorPayload(buf, childStart, payloadEnd, targetTag);
        if (nested) return nested;
      }
      off = payloadEnd;
    }
    return null;
  }

  function extractAacAudioSpecificConfig(buf, trakHdr) {
    const entry = findSampleEntry(buf, trakHdr, "mp4a");
    const esds = findSampleEntryChild(buf, entry, "esds", 28);
    const payload = findDescriptorPayload(buf, esds.contentStart + 4, esds.contentEnd, 0x05);
    if (!payload || payload.length === 0) throw new Error("esds missing DecoderSpecificInfo");
    return copyBytes(payload);
  }

  function extractVideoDimensions(buf, trakHdr) {
    const entry = findSampleEntry(buf, trakHdr, "vp09");
    return {
      width: readU16BE(buf, entry.contentStart + 24),
      height: readU16BE(buf, entry.contentStart + 26)
    };
  }

  function extractAudioParams(buf, trakHdr) {
    const entry = findSampleEntry(buf, trakHdr, "mp4a");
    const sampleRateFixed = readU32BE(buf, entry.contentStart + 24);
    return {
      samplingFrequency: sampleRateFixed / 65536,
      channels: readU16BE(buf, entry.contentStart + 16)
    };
  }

  function parseTfhd(buf, tfhdHdr) {
    const flags = readU32BE(buf, tfhdHdr.contentStart) & 0x00ffffff;
    let off = tfhdHdr.contentStart + 8;
    const out = {
      flags,
      baseDataOffset: null,
      defaultSampleDuration: null,
      defaultSampleSize: null,
      defaultSampleFlags: null,
      defaultBaseIsMoof: !!(flags & 0x020000)
    };
    if (flags & 0x000001) {
      out.baseDataOffset = readU64BE(buf, off);
      off += 8;
    }
    if (flags & 0x000002) off += 4;
    if (flags & 0x000008) {
      out.defaultSampleDuration = readU32BE(buf, off);
      off += 4;
    }
    if (flags & 0x000010) {
      out.defaultSampleSize = readU32BE(buf, off);
      off += 4;
    }
    if (flags & 0x000020) {
      out.defaultSampleFlags = readU32BE(buf, off);
    }
    return out;
  }

  function parseTrunHeader(buf, trunHdr) {
    const versionAndFlags = readU32BE(buf, trunHdr.contentStart);
    const flags = versionAndFlags & 0x00ffffff;
    const version = buf[trunHdr.contentStart];
    const sampleCount = readU32BE(buf, trunHdr.contentStart + 4);
    let off = trunHdr.contentStart + 8;
    let dataOffset = null;
    let firstSampleFlags = null;
    if (flags & 0x000001) {
      dataOffset = readS32BE(buf, off);
      off += 4;
    }
    if (flags & 0x000004) {
      firstSampleFlags = readU32BE(buf, off);
      off += 4;
    }
    return { version, flags, sampleCount, dataOffset, firstSampleFlags, entriesStart: off };
  }

  function readFragmentDecodeTime(buf, moofHdr) {
    return mp4Core().__test_readFragmentDecodeTime(buf, moofHdr);
  }

  function sampleDataStartForFragment(tfhd, trun, fragment) {
    if (trun.dataOffset == null) return fragment.mdat.contentStart;
    const moofStart = fragment.moof.contentStart - fragment.moof.headerSize;
    const base = tfhd.defaultBaseIsMoof || tfhd.baseDataOffset == null
      ? BigInt(moofStart)
      : tfhd.baseDataOffset;
    const start = base + BigInt(trun.dataOffset);
    return Number(start);
  }

  function extractSampleList(buf, fragmentsOrParsed, trakHdr, options) {
    const fragments = Array.isArray(fragmentsOrParsed)
      ? fragmentsOrParsed
      : (fragmentsOrParsed && fragmentsOrParsed.fragments) || [];
    const kind = options && options.kind ? options.kind : "";
    const isAudio = kind === "audio" || findSampleEntry(buf, trakHdr).type === "mp4a";
    const timescale = BigInt(mp4Core().__test_readMdhdTimescale(buf, trakHdr));
    if (timescale === 0n) throw new Error("track timescale is zero");
    const samples = [];

    for (const fragment of fragments) {
      const traf = mp4FindChild(buf, fragment.moof, "traf");
      if (!traf) throw new Error("moof missing traf");
      const tfhdHdr = mp4FindChild(buf, traf, "tfhd");
      const trunHdr = mp4FindChild(buf, traf, "trun");
      if (!tfhdHdr) throw new Error("traf missing tfhd");
      if (!trunHdr) throw new Error("traf missing trun");

      const tfhd = parseTfhd(buf, tfhdHdr);
      const trun = parseTrunHeader(buf, trunHdr);
      const baseDecodeTime = readFragmentDecodeTime(buf, fragment.moof);
      let sampleDataOffset = sampleDataStartForFragment(tfhd, trun, fragment);
      if (sampleDataOffset < fragment.mdat.contentStart || sampleDataOffset > fragment.mdat.contentEnd) {
        throw new Error("trun data_offset points outside mdat payload");
      }
      let entryOff = trun.entriesStart;
      let decodeOffset = 0n;

      for (let i = 0; i < trun.sampleCount; i++) {
        let duration = tfhd.defaultSampleDuration;
        let size = tfhd.defaultSampleSize;
        let sampleFlags = i === 0 && trun.firstSampleFlags != null
          ? trun.firstSampleFlags
          : tfhd.defaultSampleFlags;

        if (trun.flags & 0x000100) {
          duration = readU32BE(buf, entryOff);
          entryOff += 4;
        }
        if (trun.flags & 0x000200) {
          size = readU32BE(buf, entryOff);
          entryOff += 4;
        }
        if (trun.flags & 0x000400) {
          sampleFlags = readU32BE(buf, entryOff);
          entryOff += 4;
        }
        if (trun.flags & 0x000800) entryOff += 4;
        if (!duration) throw new Error("sample duration missing");
        if (!size) throw new Error("sample size missing");

        const decodeTimeUnits = baseDecodeTime + decodeOffset;
        const decodeTimeMicros = Number((decodeTimeUnits * 1000000n) / timescale);
        const durationMicros = Number((BigInt(duration) * 1000000n) / timescale);
        samples.push({
          decodeTimeMicros,
          durationMicros,
          size,
          byteOffset: sampleDataOffset,
          isKeyframe: isAudio ? true : (((sampleFlags || 0) & 0x00010000) === 0)
        });
        sampleDataOffset += size;
        decodeOffset += BigInt(duration);
      }
    }

    return samples;
  }

  function writeEbmlHeader() {
    return writeElement(EBML.Header, concatUint8Arrays([
      writeUintElement(EBML.EBMLVersion, 1),
      writeUintElement(EBML.EBMLReadVersion, 1),
      writeUintElement(EBML.EBMLMaxIDLength, 4),
      writeUintElement(EBML.EBMLMaxSizeLength, 8),
      writeStringElement(EBML.DocType, "matroska"),
      writeUintElement(EBML.DocTypeVersion, 4),
      writeUintElement(EBML.DocTypeReadVersion, 2)
    ]));
  }

  function writeVideoTrack(opts) {
    const video = writeElement(MKV.Video, concatUint8Arrays([
      writeUintElement(MKV.PixelWidth, opts.videoWidth),
      writeUintElement(MKV.PixelHeight, opts.videoHeight)
    ]));
    // Matroska's V_VP9 mapping has no initialization data; demuxers should
    // ignore CodecPrivate for VP9, so omit it rather than writing MP4 vpcC.
    return writeElement(MKV.TrackEntry, concatUint8Arrays([
      writeUintElement(MKV.TrackNumber, 1),
      writeUintElement(MKV.TrackUID, opts.trackUidVideo || 1),
      writeUintElement(MKV.TrackType, 1),
      writeUintElement(MKV.FlagLacing, 0),
      writeStringElement(MKV.CodecID, "V_VP9"),
      video
    ]));
  }

  function writeAudioTrack(opts) {
    const audio = writeElement(MKV.Audio, concatUint8Arrays([
      writeFloatElement(MKV.SamplingFrequency, opts.audioSampleRate || 48000),
      writeUintElement(MKV.Channels, opts.audioChannels || 2)
    ]));
    return writeElement(MKV.TrackEntry, concatUint8Arrays([
      writeUintElement(MKV.TrackNumber, 2),
      writeUintElement(MKV.TrackUID, opts.trackUidAudio || 2),
      writeUintElement(MKV.TrackType, 2),
      writeUintElement(MKV.FlagLacing, 0),
      writeStringElement(MKV.CodecID, "A_AAC"),
      writeBinaryElement(MKV.CodecPrivate, opts.audioConfigBytes || new Uint8Array()),
      audio
    ]));
  }

  function writeMatroskaSkeleton(options) {
    const opts = options || {};
    const info = writeElement(MKV.Info, concatUint8Arrays([
      writeUintElement(MKV.TimestampScale, TIMESTAMP_SCALE_NS),
      writeFloatElement(MKV.Duration, opts.durationMs || 0),
      writeStringElement(MKV.MuxingApp, "Amstragram"),
      writeStringElement(MKV.WritingApp, "Amstragram")
    ]));
    const tracks = writeElement(MKV.Tracks, concatUint8Arrays([
      writeVideoTrack(opts),
      writeAudioTrack(opts)
    ]));
    return concatUint8Arrays([
      writeEbmlHeader(),
      MKV.Segment,
      writeVintUnknownSize(8),
      info,
      tracks
    ]);
  }

  function writeSimpleBlock(trackNumber, timestampDelta, isKeyframe, frameBytes) {
    if (timestampDelta < -32768 || timestampDelta > 32767) {
      throw new Error(`SimpleBlock timestamp delta out of range: ${timestampDelta}`);
    }
    const frame = toUint8Array(frameBytes);
    const track = writeVint(trackNumber);
    const payload = new Uint8Array(track.length + 3 + frame.length);
    payload.set(track, 0);
    new DataView(payload.buffer, payload.byteOffset, payload.byteLength).setInt16(track.length, timestampDelta, false);
    payload[track.length + 2] = isKeyframe ? 0x80 : 0x00;
    payload.set(frame, track.length + 3);
    return writeElement(MKV.SimpleBlock, payload);
  }

  function sampleEndMicros(sample) {
    return sample.decodeTimeMicros + (sample.durationMicros || 0);
  }

  function writeClusters(videoBuf, videoSamples, audioBuf, audioSamples, clusterDurationMicros) {
    const windowMicros = clusterDurationMicros || CLUSTER_DURATION_MICROS;
    const clusters = new Map();
    function addSamples(samples, trackNumber) {
      for (const sample of samples) {
        const index = Math.floor(sample.decodeTimeMicros / windowMicros);
        if (!clusters.has(index)) clusters.set(index, { video: [], audio: [] });
        const bucket = trackNumber === 1 ? clusters.get(index).video : clusters.get(index).audio;
        bucket.push(sample);
      }
    }
    addSamples(videoSamples, 1);
    addSamples(audioSamples, 2);

    const out = [];
    const sortedIndexes = Array.from(clusters.keys()).sort((a, b) => a - b);
    for (const index of sortedIndexes) {
      const cluster = clusters.get(index);
      const clusterTimeMs = Math.floor((index * windowMicros) / 1000);
      const parts = [writeUintElement(MKV.Timestamp, clusterTimeMs)];
      const writeTrackSamples = (samples, trackNumber, sourceBuf) => {
        const ordered = [...samples].sort((a, b) => a.decodeTimeMicros - b.decodeTimeMicros);
        for (const sample of ordered) {
          const sampleTimeMs = Math.round(sample.decodeTimeMicros / 1000);
          const delta = sampleTimeMs - clusterTimeMs;
          parts.push(writeSimpleBlock(
            trackNumber,
            delta,
            sample.isKeyframe,
            sourceBuf.subarray(sample.byteOffset, sample.byteOffset + sample.size)
          ));
        }
      };
      writeTrackSamples(cluster.video, 1, videoBuf);
      writeTrackSamples(cluster.audio, 2, audioBuf);
      out.push(writeElement(MKV.Cluster, concatUint8Arrays(parts)));
    }
    return out;
  }

  function findFirstTrak(buf, parsed) {
    const trak = mp4Children(buf, parsed.moov).find((c) => c.type === "trak");
    if (!trak) throw new Error("fMP4 source missing trak");
    return trak;
  }

  function trackDurationMs(videoSamples, audioSamples) {
    let maxMicros = 0;
    for (const sample of videoSamples) maxMicros = Math.max(maxMicros, sampleEndMicros(sample));
    for (const sample of audioSamples) maxMicros = Math.max(maxMicros, sampleEndMicros(sample));
    return maxMicros / 1000;
  }

  function mux(videoInput, audioInput, options) {
    const videoBuf = toUint8Array(videoInput);
    const audioBuf = toUint8Array(audioInput);
    const video = mp4Core().__test_parseFragmentedMp4(videoBuf);
    const audio = mp4Core().__test_parseFragmentedMp4(audioBuf);
    const videoTrak = findFirstTrak(videoBuf, video);
    const audioTrak = findFirstTrak(audioBuf, audio);

    const videoCodec = mp4Core().__test_extractCodecFourCC(videoBuf, videoTrak);
    const audioCodec = mp4Core().__test_extractCodecFourCC(audioBuf, audioTrak);
    if (videoCodec !== "vp09") throw new Error(`unsupported MKV video codec: ${videoCodec || "unknown"}`);
    if (audioCodec !== "mp4a") throw new Error(`unsupported MKV audio codec: ${audioCodec || "unknown"}`);

    const vpccBytes = extractVp9CodecPrivate(videoBuf, videoTrak);
    const audioConfigBytes = extractAacAudioSpecificConfig(audioBuf, audioTrak);
    const dimensions = extractVideoDimensions(videoBuf, videoTrak);
    const audioParams = extractAudioParams(audioBuf, audioTrak);
    const videoSamples = extractSampleList(videoBuf, video.fragments, videoTrak, { kind: "video" });
    const audioSamples = extractSampleList(audioBuf, audio.fragments, audioTrak, { kind: "audio" });
    const durationMs = trackDurationMs(videoSamples, audioSamples);
    const skeleton = writeMatroskaSkeleton({
      trackUidVideo: options && options.trackUidVideo,
      trackUidAudio: options && options.trackUidAudio,
      vpccBytes,
      audioConfigBytes,
      videoWidth: dimensions.width,
      videoHeight: dimensions.height,
      audioSampleRate: audioParams.samplingFrequency,
      audioChannels: audioParams.channels,
      durationMs
    });
    const clusters = writeClusters(videoBuf, videoSamples, audioBuf, audioSamples, CLUSTER_DURATION_MICROS);
    const output = concatUint8Arrays([skeleton, ...clusters]);
    return {
      output: output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength),
      diagnostics: {
        videoCodec,
        audioCodec,
        videoSampleCount: videoSamples.length,
        audioSampleCount: audioSamples.length,
        vp9CodecPrivateBytes: vpccBytes.length,
        aacCodecPrivateBytes: audioConfigBytes.length,
        clusterCount: clusters.length,
        durationMs,
        bytesIn: videoBuf.length + audioBuf.length,
        bytesOut: output.length
      }
    };
  }

  return {
    mux
  };
})();
// =========================================
// VIDEO RESOLVER CORE
// =========================================
// Picks the best video source for a given IG media item.
//
// Falls back to progressive when DASH is unavailable or unparseable.
//
// options.container ("mp4" | "mkv", default "mp4") chooses the output
// container reported on the plan. The dispatcher reads plan.container to pick
// MP4_REMUX_CORE vs MKV_MUX_CORE.
//
// Codec selection follows container:
//   "mp4" → all supported codecs (avc1, hvc1, vp09, av01) ranked by quality.
//           MP4_REMUX_CORE handles every codec the resolver can pick.
//   "mkv" → vp09 only — MKV_MUX_CORE is VP9-only today. When the manifest has
//           no VP9 representation, the resolver falls back to progressive,
//           which is always .mp4 (single stream, no muxing happens).
//
// Depends on DASH_MANIFEST_CORE (assigned globally at build time).
