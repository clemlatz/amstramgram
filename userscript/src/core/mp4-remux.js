const MP4_REMUX_CORE = (() => {
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
    const hi = BigInt(readU32BE(buf, off));
    const lo = BigInt(readU32BE(buf, off + 4));
    return (hi << 32n) | lo;
  }

  function writeU32BE(n) {
    const v = n >>> 0;
    return new Uint8Array([
      (v >>> 24) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 8) & 0xff,
      v & 0xff
    ]);
  }

  function writeU64BE(n) {
    const big = typeof n === "bigint" ? n : BigInt(n);
    const hi = Number((big >> 32n) & 0xffffffffn);
    const lo = Number(big & 0xffffffffn);
    const out = new Uint8Array(8);
    out.set(writeU32BE(hi), 0);
    out.set(writeU32BE(lo), 4);
    return out;
  }

  function writeFullBox(type, version, flags, payload) {
    const payloadBytes = payload instanceof Uint8Array
      ? payload
      : new Uint8Array(payload);
    const fullPayload = new Uint8Array(4 + payloadBytes.length);
    fullPayload[0] = version & 0xff;
    fullPayload[1] = (flags >>> 16) & 0xff;
    fullPayload[2] = (flags >>> 8) & 0xff;
    fullPayload[3] = flags & 0xff;
    fullPayload.set(payloadBytes, 4);
    return writeBox(type, fullPayload);
  }

  function read4CC(buf, off) {
    return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
  }

  function readBoxHeader(buf, off) {
    const size32 = readU32BE(buf, off);
    const type = read4CC(buf, off + 4);
    let size;
    let headerSize;
    if (size32 === 1) {
      const large = readU64BE(buf, off + 8);
      size = Number(large);
      headerSize = 16;
    } else if (size32 === 0) {
      size = buf.length - off;
      headerSize = 8;
    } else {
      size = size32;
      headerSize = 8;
    }
    return {
      type,
      size,
      headerSize,
      contentStart: off + headerSize,
      contentEnd: off + size
    };
  }

  const CONTAINER_TYPES = new Set([
    "moov", "trak", "edts", "mdia", "minf", "stbl", "dinf",
    "moof", "traf", "mvex"
  ]);

  function readTopLevelBoxes(buf) {
    const out = [];
    let off = 0;
    while (off < buf.length) {
      if (off + 8 > buf.length) break;
      const hdr = readBoxHeader(buf, off);
      if (hdr.size < 8 || hdr.contentEnd > buf.length) {
        throw new Error(`malformed box at offset ${off} (type=${hdr.type} size=${hdr.size})`);
      }
      out.push(hdr);
      off = hdr.contentEnd;
    }
    return out;
  }

  function readContainerChildren(buf, parentHdr) {
    if (!CONTAINER_TYPES.has(parentHdr.type)) {
      throw new Error(`box type '${parentHdr.type}' is not a known container`);
    }
    const out = [];
    let off = parentHdr.contentStart;
    while (off < parentHdr.contentEnd) {
      const hdr = readBoxHeader(buf, off);
      if (hdr.size < 8 || hdr.contentEnd > parentHdr.contentEnd) {
        throw new Error(`malformed child box at offset ${off} inside ${parentHdr.type}`);
      }
      out.push(hdr);
      off = hdr.contentEnd;
    }
    return out;
  }

  function findChild(buf, parentHdr, type) {
    const children = readContainerChildren(buf, parentHdr);
    return children.find((c) => c.type === type) || null;
  }

  function fourCCBytes(type) {
    if (typeof type !== "string" || type.length !== 4) {
      throw new Error(`invalid fourCC: ${type}`);
    }
    return new Uint8Array([
      type.charCodeAt(0),
      type.charCodeAt(1),
      type.charCodeAt(2),
      type.charCodeAt(3)
    ]);
  }

  function writeBox(type, payload) {
    const payloadBytes = payload instanceof Uint8Array
      ? payload
      : new Uint8Array(payload);
    const small = 8 + payloadBytes.length;
    if (small <= 0xffffffff - 8) {
      const out = new Uint8Array(small);
      out.set(writeU32BE(small), 0);
      out.set(fourCCBytes(type), 4);
      out.set(payloadBytes, 8);
      return out;
    }
    const large = 16 + payloadBytes.length;
    const out = new Uint8Array(large);
    out.set(writeU32BE(1), 0);
    out.set(fourCCBytes(type), 4);
    out.set(writeU64BE(BigInt(large)), 8);
    out.set(payloadBytes, 16);
    return out;
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

  // tfdt: FullBox carrying baseMediaDecodeTime in the track's own timescale.
  // v0 stores it as u32, v1 as u64. Returned as BigInt to keep callers honest.
  function readTfdtBaseMediaDecodeTime(buf, tfdtHdr) {
    const content = tfdtHdr.contentStart;
    const version = buf[content];
    if (version === 1) {
      return readU64BE(buf, content + 4);
    }
    return BigInt(readU32BE(buf, content + 4));
  }

  // mdhd FullBox holds the track's timescale (samples per second). v0 layout
  // (after version+flags): creation_time:u32 modification_time:u32 timescale:u32 duration:u32 ...
  // v1 promotes those to u64; timescale is at +20 instead of +12.
  function readMdhdTimescale(buf, trakHdr) {
    const trakChildren = readContainerChildren(buf, trakHdr);
    const mdia = trakChildren.find((c) => c.type === "mdia");
    if (!mdia) throw new Error("missing mdia");
    const mdiaChildren = readContainerChildren(buf, mdia);
    const mdhd = mdiaChildren.find((c) => c.type === "mdhd");
    if (!mdhd) throw new Error("missing mdhd");
    const version = buf[mdhd.contentStart];
    const offset = version === 1 ? mdhd.contentStart + 20 : mdhd.contentStart + 12;
    return readU32BE(buf, offset);
  }

  function readFragmentDecodeTime(buf, moofHdr) {
    const children = readContainerChildren(buf, moofHdr);
    const traf = children.find((c) => c.type === "traf");
    if (!traf) return 0n;
    const trafChildren = readContainerChildren(buf, traf);
    const tfdt = trafChildren.find((c) => c.type === "tfdt");
    if (!tfdt) return 0n;
    return readTfdtBaseMediaDecodeTime(buf, tfdt);
  }

  // Splits a fragmented MP4 into init (ftyp + moov) and a list of
  // {moof, mdat} fragment pairs. sidx/styp/ssix/emsg/free are ignored —
  // they're DASH bookkeeping that confuses some players in a remuxed file.
  function parseFragmentedMp4(buf) {
    const boxes = readTopLevelBoxes(buf);
    let ftyp = null;
    let moov = null;
    const fragments = [];
    let pendingMoof = null;
    for (const box of boxes) {
      if (box.type === "ftyp") ftyp = box;
      else if (box.type === "moov") moov = box;
      else if (box.type === "moof") pendingMoof = box;
      else if (box.type === "mdat" && pendingMoof) {
        fragments.push({ moof: pendingMoof, mdat: box });
        pendingMoof = null;
      }
    }
    if (!ftyp) throw new Error("missing ftyp");
    if (!moov) throw new Error("missing moov");
    return { ftyp, moov, fragments, sourceBuffer: buf };
  }

  // Reads the codec fourCC from a trak's stsd > <sampleEntry>. The sample
  // entry's box type IS the codec (avc1, hvc1, vp09, av01, mp4a, etc).
  // stsd is FullBox: [version+flags:u32][entry_count:u32][... entries ...].
  function extractCodecFourCC(buf, trakHdr) {
    if (!trakHdr) return null;
    const trakChildren = readContainerChildren(buf, trakHdr);
    const mdia = trakChildren.find((c) => c.type === "mdia");
    if (!mdia) return null;
    const mdiaChildren = readContainerChildren(buf, mdia);
    const minf = mdiaChildren.find((c) => c.type === "minf");
    if (!minf) return null;
    const minfChildren = readContainerChildren(buf, minf);
    const stbl = minfChildren.find((c) => c.type === "stbl");
    if (!stbl) return null;
    const stblChildren = readContainerChildren(buf, stbl);
    const stsd = stblChildren.find((c) => c.type === "stsd");
    if (!stsd) return null;
    const entryStart = stsd.contentStart + 8;
    if (entryStart + 8 > stsd.contentEnd) return null;
    const sampleEntryHdr = readBoxHeader(buf, entryStart);
    return sampleEntryHdr.type;
  }

  function cloneBox(buf, hdr) {
    return buf.subarray(hdr.contentStart - hdr.headerSize, hdr.contentEnd);
  }

  function buildFlatFtyp() {
    return writeBox("ftyp", concatUint8Arrays([
      fourCCBytes("isom"),
      writeU32BE(512),
      fourCCBytes("isom"),
      fourCCBytes("iso2"),
      fourCCBytes("mp41")
    ]));
  }

  function readMvhdTimescale(buf, mvhdHdr) {
    const version = buf[mvhdHdr.contentStart];
    return readU32BE(buf, mvhdHdr.contentStart + (version === 1 ? 20 : 12));
  }

  function scaleDuration(duration, fromTimescale, toTimescale) {
    if (!duration || !fromTimescale || !toTimescale) return 0;
    const d = typeof duration === "bigint" ? duration : BigInt(duration);
    const from = BigInt(fromTimescale);
    const to = BigInt(toTimescale);
    return Number((d * to + from - 1n) / from);
  }

  function rewriteMvhdDurationAndNextTrackId(buf, mvhdHdr, duration, newNext) {
    const out = new Uint8Array(cloneBox(buf, mvhdHdr));
    const version = out[mvhdHdr.headerSize];
    const durationOffset = mvhdHdr.headerSize + (version === 1 ? 28 : 16);
    const expectedLen = version === 1 ? 112 : 100;
    if (mvhdHdr.contentEnd - mvhdHdr.contentStart < expectedLen) {
      throw new Error("mvhd too short");
    }
    if (version === 1) out.set(writeU64BE(BigInt(duration)), durationOffset);
    else out.set(writeU32BE(duration), durationOffset);
    out.set(writeU32BE(newNext), mvhdHdr.headerSize + expectedLen - 4);
    return out;
  }

  function rewriteTkhdTrackIdAndDuration(buf, tkhdHdr, newTrackId, duration) {
    const out = new Uint8Array(cloneBox(buf, tkhdHdr));
    const version = out[tkhdHdr.headerSize];
    const trackIdOffset = tkhdHdr.headerSize + (version === 1 ? 20 : 12);
    const durationOffset = tkhdHdr.headerSize + (version === 1 ? 32 : 20);
    out.set(writeU32BE(newTrackId), trackIdOffset);
    if (version === 1) out.set(writeU64BE(BigInt(duration)), durationOffset);
    else out.set(writeU32BE(duration), durationOffset);
    return out;
  }

  function rewriteMdhdDuration(buf, mdhdHdr, duration) {
    const out = new Uint8Array(cloneBox(buf, mdhdHdr));
    const version = out[mdhdHdr.headerSize];
    const durationOffset = mdhdHdr.headerSize + (version === 1 ? 24 : 16);
    if (version === 1) out.set(writeU64BE(BigInt(duration)), durationOffset);
    else out.set(writeU32BE(duration), durationOffset);
    return out;
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

  function sampleDataStartForFragment(tfhd, trun, fragment) {
    if (trun.dataOffset == null) return fragment.mdat.contentStart;
    const moofStart = fragment.moof.contentStart - fragment.moof.headerSize;
    const base = tfhd.defaultBaseIsMoof || tfhd.baseDataOffset == null
      ? BigInt(moofStart)
      : tfhd.baseDataOffset;
    return Number(base + BigInt(trun.dataOffset));
  }

  function extractSampleList(buf, fragmentsOrParsed, trakHdr, options) {
    const fragments = Array.isArray(fragmentsOrParsed)
      ? fragmentsOrParsed
      : (fragmentsOrParsed && fragmentsOrParsed.fragments) || [];
    const kind = options && options.kind ? options.kind : "";
    const codec = extractCodecFourCC(buf, trakHdr);
    const isAudio = kind === "audio" || codec === "mp4a";
    const timescale = BigInt(readMdhdTimescale(buf, trakHdr));
    if (timescale === 0n) throw new Error("track timescale is zero");
    const samples = [];

    for (const fragment of fragments) {
      const traf = findChild(buf, fragment.moof, "traf");
      if (!traf) throw new Error("moof missing traf");
      const tfhdHdr = findChild(buf, traf, "tfhd");
      const trunHdr = findChild(buf, traf, "trun");
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
        let compositionTimeOffset = 0;

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
        if (trun.flags & 0x000800) {
          compositionTimeOffset = trun.version === 1
            ? readS32BE(buf, entryOff)
            : readU32BE(buf, entryOff);
          entryOff += 4;
        }
        if (!duration) throw new Error("sample duration missing");
        if (!size) throw new Error("sample size missing");

        const decodeTimeUnits = baseDecodeTime + decodeOffset;
        samples.push({
          decodeTimeUnits,
          duration,
          size,
          byteOffset: sampleDataOffset,
          compositionTimeOffset,
          isKeyframe: isAudio ? true : (((sampleFlags || 0) & 0x00010000) === 0),
          chunkOffset: 0
        });
        sampleDataOffset += size;
        decodeOffset += BigInt(duration);
      }
    }

    return samples;
  }

  function trackDurationUnits(samples) {
    let max = 0n;
    for (const sample of samples) {
      const end = sample.decodeTimeUnits + BigInt(sample.duration);
      if (end > max) max = end;
    }
    return max;
  }

  function writeU32Entries(values) {
    const out = new Uint8Array(values.length * 4);
    for (let i = 0; i < values.length; i++) out.set(writeU32BE(values[i]), i * 4);
    return out;
  }

  function buildStts(samples) {
    const entries = [];
    for (const sample of samples) {
      const last = entries[entries.length - 1];
      if (last && last.duration === sample.duration) last.count += 1;
      else entries.push({ count: 1, duration: sample.duration });
    }
    const payload = new Uint8Array(4 + entries.length * 8);
    payload.set(writeU32BE(entries.length), 0);
    let off = 4;
    for (const entry of entries) {
      payload.set(writeU32BE(entry.count), off);
      payload.set(writeU32BE(entry.duration), off + 4);
      off += 8;
    }
    return writeFullBox("stts", 0, 0, payload);
  }

  function buildCtts(samples) {
    if (!samples.some((s) => s.compositionTimeOffset)) return null;
    const entries = [];
    let hasNegative = false;
    for (const sample of samples) {
      if (sample.compositionTimeOffset < 0) hasNegative = true;
      const last = entries[entries.length - 1];
      if (last && last.offset === sample.compositionTimeOffset) last.count += 1;
      else entries.push({ count: 1, offset: sample.compositionTimeOffset });
    }
    const payload = new Uint8Array(4 + entries.length * 8);
    payload.set(writeU32BE(entries.length), 0);
    let off = 4;
    for (const entry of entries) {
      payload.set(writeU32BE(entry.count), off);
      payload.set(writeU32BE(entry.offset), off + 4);
      off += 8;
    }
    return writeFullBox("ctts", hasNegative ? 1 : 0, 0, payload);
  }

  function buildStsc(samples) {
    const payload = new Uint8Array(16);
    payload.set(writeU32BE(samples.length ? 1 : 0), 0);
    if (samples.length) {
      payload.set(writeU32BE(1), 4);
      payload.set(writeU32BE(1), 8);
      payload.set(writeU32BE(1), 12);
    }
    return writeFullBox("stsc", 0, 0, payload);
  }

  function buildStsz(samples) {
    const payload = new Uint8Array(8 + samples.length * 4);
    payload.set(writeU32BE(0), 0);
    payload.set(writeU32BE(samples.length), 4);
    for (let i = 0; i < samples.length; i++) {
      payload.set(writeU32BE(samples[i].size), 8 + i * 4);
    }
    return writeFullBox("stsz", 0, 0, payload);
  }

  function buildStco(samples) {
    const offsets = samples.map((s) => s.chunkOffset || 0);
    if (offsets.some((o) => o > 0xffffffff)) {
      throw new Error("MP4 output too large for stco offsets");
    }
    const payload = new Uint8Array(4 + offsets.length * 4);
    payload.set(writeU32BE(offsets.length), 0);
    payload.set(writeU32Entries(offsets), 4);
    return writeFullBox("stco", 0, 0, payload);
  }

  function buildStss(samples) {
    const syncSampleNumbers = [];
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].isKeyframe) syncSampleNumbers.push(i + 1);
    }
    if (syncSampleNumbers.length === 0 || syncSampleNumbers.length === samples.length) return null;
    const payload = new Uint8Array(4 + syncSampleNumbers.length * 4);
    payload.set(writeU32BE(syncSampleNumbers.length), 0);
    payload.set(writeU32Entries(syncSampleNumbers), 4);
    return writeFullBox("stss", 0, 0, payload);
  }

  function buildFlatStbl(buf, trakHdr, samples, isVideo) {
    const mdia = findChild(buf, trakHdr, "mdia");
    const minf = mdia ? findChild(buf, mdia, "minf") : null;
    const stbl = minf ? findChild(buf, minf, "stbl") : null;
    const stsd = stbl ? findChild(buf, stbl, "stsd") : null;
    if (!stsd) throw new Error("source missing stsd");

    const parts = [cloneBox(buf, stsd), buildStts(samples)];
    const ctts = buildCtts(samples);
    if (ctts) parts.push(ctts);
    if (isVideo) {
      const stss = buildStss(samples);
      if (stss) parts.push(stss);
    }
    parts.push(buildStsc(samples), buildStsz(samples), buildStco(samples));
    return writeBox("stbl", concatUint8Arrays(parts));
  }

  function rebuildMinfWithFlatStbl(buf, minfHdr, trakHdr, samples, isVideo) {
    const children = readContainerChildren(buf, minfHdr);
    const parts = [];
    let replaced = false;
    for (const child of children) {
      if (child.type === "stbl") {
        parts.push(buildFlatStbl(buf, trakHdr, samples, isVideo));
        replaced = true;
      } else {
        parts.push(cloneBox(buf, child));
      }
    }
    if (!replaced) parts.push(buildFlatStbl(buf, trakHdr, samples, isVideo));
    return writeBox("minf", concatUint8Arrays(parts));
  }

  function rebuildMdiaWithFlatStbl(buf, mdiaHdr, trakHdr, samples, trackDuration, isVideo) {
    const children = readContainerChildren(buf, mdiaHdr);
    const parts = [];
    for (const child of children) {
      if (child.type === "mdhd") {
        parts.push(rewriteMdhdDuration(buf, child, trackDuration));
      } else if (child.type === "minf") {
        parts.push(rebuildMinfWithFlatStbl(buf, child, trakHdr, samples, isVideo));
      } else {
        parts.push(cloneBox(buf, child));
      }
    }
    return writeBox("mdia", concatUint8Arrays(parts));
  }

  function rebuildFlatTrak(buf, trakHdr, trackId, samples, trackDuration, movieDuration, isVideo) {
    const children = readContainerChildren(buf, trakHdr);
    const parts = [];
    for (const child of children) {
      if (child.type === "tkhd") {
        parts.push(rewriteTkhdTrackIdAndDuration(buf, child, trackId, movieDuration));
      } else if (child.type === "mdia") {
        parts.push(rebuildMdiaWithFlatStbl(buf, child, trakHdr, samples, trackDuration, isVideo));
      } else if (child.type === "edts") {
        continue;
      } else {
        parts.push(cloneBox(buf, child));
      }
    }
    return writeBox("trak", concatUint8Arrays(parts));
  }

  function buildFlatMoov(videoBuf, videoMoovHdr, audioBuf, audioMoovHdr, plan) {
    const vMoovChildren = readContainerChildren(videoBuf, videoMoovHdr);
    const aMoovChildren = readContainerChildren(audioBuf, audioMoovHdr);
    const vMvhd = vMoovChildren.find((c) => c.type === "mvhd");
    const vTrak = vMoovChildren.find((c) => c.type === "trak");
    const aTrak = aMoovChildren.find((c) => c.type === "trak");
    if (!vMvhd) throw new Error("video source missing mvhd");
    if (!vTrak) throw new Error("video source missing trak");
    if (!aTrak) throw new Error("audio source missing trak");

    const mvhd = rewriteMvhdDurationAndNextTrackId(videoBuf, vMvhd, plan.movieDuration, 3);
    const videoTrak = rebuildFlatTrak(
      videoBuf,
      vTrak,
      1,
      plan.videoSamples,
      plan.videoDuration,
      plan.videoMovieDuration,
      true
    );
    const audioTrak = rebuildFlatTrak(
      audioBuf,
      aTrak,
      2,
      plan.audioSamples,
      plan.audioDuration,
      plan.audioMovieDuration,
      false
    );
    return writeBox("moov", concatUint8Arrays([mvhd, videoTrak, audioTrak]));
  }

  function mdatHeaderSizeForPayload(payloadSize) {
    return payloadSize + 8 <= 0xffffffff - 8 ? 8 : 16;
  }

  function assignChunkOffsetsAndBuildMdat(trackPlans, payloadStart) {
    const parts = [];
    let off = payloadStart;
    for (const track of trackPlans) {
      for (const sample of track.samples) {
        sample.chunkOffset = off;
        parts.push(track.buf.subarray(sample.byteOffset, sample.byteOffset + sample.size));
        off += sample.size;
      }
    }
    return writeBox("mdat", concatUint8Arrays(parts));
  }

  function remux(videoInput, audioInput, options) {
    const videoBuf = videoInput instanceof Uint8Array
      ? videoInput
      : new Uint8Array(videoInput);
    const audioBuf = audioInput instanceof Uint8Array
      ? audioInput
      : new Uint8Array(audioInput);

    const video = parseFragmentedMp4(videoBuf);
    const audio = parseFragmentedMp4(audioBuf);

    const allowedVideo = (options && Array.isArray(options.allowedVideoCodecs))
      ? options.allowedVideoCodecs
      : ["avc1", "hvc1", "vp09", "av01"];
    const allowedAudio = (options && Array.isArray(options.allowedAudioCodecs))
      ? options.allowedAudioCodecs
      : ["mp4a"];

    const videoMoovChildren = readContainerChildren(videoBuf, video.moov);
    const audioMoovChildren = readContainerChildren(audioBuf, audio.moov);
    const videoTrak = videoMoovChildren.find((c) => c.type === "trak");
    const audioTrak = audioMoovChildren.find((c) => c.type === "trak");

    const videoCodec = extractCodecFourCC(videoBuf, videoTrak);
    const audioCodec = extractCodecFourCC(audioBuf, audioTrak);
    if (videoCodec && !allowedVideo.includes(videoCodec)) {
      throw new Error(`unsupported video codec: ${videoCodec}`);
    }
    if (audioCodec && !allowedAudio.includes(audioCodec)) {
      throw new Error(`unsupported audio codec: ${audioCodec}`);
    }

    const ftypBytes = buildFlatFtyp();
    const mvhd = videoMoovChildren.find((c) => c.type === "mvhd");
    if (!mvhd) throw new Error("video source missing mvhd");
    const movieTimescale = readMvhdTimescale(videoBuf, mvhd);
    if (!movieTimescale) throw new Error("movie timescale is zero");

    const videoSamples = extractSampleList(videoBuf, video, videoTrak, { kind: "video" });
    const audioSamples = extractSampleList(audioBuf, audio, audioTrak, { kind: "audio" });
    const videoDuration = Number(trackDurationUnits(videoSamples));
    const audioDuration = Number(trackDurationUnits(audioSamples));
    const videoTimescale = readMdhdTimescale(videoBuf, videoTrak);
    const audioTimescale = readMdhdTimescale(audioBuf, audioTrak);
    const videoMovieDuration = scaleDuration(videoDuration, videoTimescale, movieTimescale);
    const audioMovieDuration = scaleDuration(audioDuration, audioTimescale, movieTimescale);
    const movieDuration = Math.max(videoMovieDuration, audioMovieDuration);

    const plan = {
      videoSamples,
      audioSamples,
      videoDuration,
      audioDuration,
      videoMovieDuration,
      audioMovieDuration,
      movieDuration
    };

    // First pass only computes the final moov size. stco box sizes are fixed
    // by sample count, so replacing zero offsets with real offsets cannot
    // change the moov length.
    const sizingMoov = buildFlatMoov(videoBuf, video.moov, audioBuf, audio.moov, plan);
    const mdatPayloadSize = videoSamples.reduce((sum, s) => sum + s.size, 0) +
      audioSamples.reduce((sum, s) => sum + s.size, 0);
    const mdatPayloadStart = ftypBytes.length + sizingMoov.length + mdatHeaderSizeForPayload(mdatPayloadSize);
    const mdatBytes = assignChunkOffsetsAndBuildMdat([
      { buf: videoBuf, samples: videoSamples },
      { buf: audioBuf, samples: audioSamples }
    ], mdatPayloadStart);
    const moovBytes = buildFlatMoov(videoBuf, video.moov, audioBuf, audio.moov, plan);
    const output = concatUint8Arrays([ftypBytes, moovBytes, mdatBytes]);

    return {
      output: output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength),
      diagnostics: {
        format: "flat_mp4",
        videoSampleCount: videoSamples.length,
        audioSampleCount: audioSamples.length,
        videoFragmentCount: video.fragments.length,
        audioFragmentCount: audio.fragments.length,
        durationSeconds: movieDuration / movieTimescale,
        videoCodec: videoCodec || null,
        audioCodec: audioCodec || null,
        bytesIn: videoBuf.length + audioBuf.length,
        bytesOut: output.length
      }
    };
  }

  return {
    remux
  };
})();
// =========================================
// MKV MUX CORE
// =========================================
// EBML / Matroska writer for VP9 + AAC sources from Instagram DASH.
//
// Kept as an alternate muxer/diagnostic path. The primary MP4 remuxer now
// defragments DASH into a regular MP4, which fixes the VLC issue without
// changing containers.
// Same input shape as MP4_REMUX_CORE.remux: two complete fMP4 ArrayBuffers,
// one video rep and one audio rep, producing one .mkv ArrayBuffer.
