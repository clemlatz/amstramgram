const DASH_MANIFEST_CORE = (() => {
  function decodeEntities(str) {
    const s = str === null || str === undefined ? "" : String(str);
    if (!s || s.indexOf("&") === -1) return s;
    return s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function attrMatch(tag, name) {
    const re = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);
    const m = tag.match(re);
    return m ? decodeEntities(m[1]) : null;
  }

  function attrInt(tag, name) {
    const raw = attrMatch(tag, name);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function parseRepresentationOpeningTag(tag) {
    return {
      id: attrMatch(tag, "id"),
      bandwidth: attrInt(tag, "bandwidth"),
      codecs: attrMatch(tag, "codecs"),
      mimeType: attrMatch(tag, "mimeType"),
      width: attrInt(tag, "width"),
      height: attrInt(tag, "height"),
      frameRate: attrMatch(tag, "frameRate"),
      audioSamplingRate: attrInt(tag, "audioSamplingRate"),
      contentLength: attrInt(tag, "FBContentLength")
    };
  }

  function parseRange(rangeStr) {
    if (!rangeStr) return null;
    const parts = String(rangeStr).split("-");
    if (parts.length !== 2) return null;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Array.of(a, b);
  }

  function parseRepresentation(repXml) {
    const openMatch = repXml.match(/<Representation\b[^>]*>/);
    if (!openMatch) return null;
    const base = parseRepresentationOpeningTag(openMatch[0]);

    const baseUrlMatch = repXml.match(/<BaseURL\b[^>]*>([\s\S]*?)<\/BaseURL>/);
    const baseUrl = baseUrlMatch ? decodeEntities(baseUrlMatch[1]).trim() : null;

    const segmentBaseMatch = repXml.match(/<SegmentBase\b[^>]*>/);
    const indexRange = segmentBaseMatch ? parseRange(attrMatch(segmentBaseMatch[0], "indexRange")) : null;

    const initMatch = repXml.match(/<Initialization\b[^>]*\/>/);
    const initializationRange = initMatch ? parseRange(attrMatch(initMatch[0], "range")) : null;

    const channelMatch = repXml.match(/<AudioChannelConfiguration\b[^>]*\/>/);
    const audioChannels = channelMatch ? attrInt(channelMatch[0], "value") : null;

    return {
      ...base,
      baseUrl,
      indexRange,
      initializationRange,
      audioChannels
    };
  }

  function splitByTag(xml, tagName) {
    const openRe = new RegExp(`<${tagName}\\b[^>]*>`, "g");
    const results = [];
    let m;
    while ((m = openRe.exec(xml)) !== null) {
      const start = m.index;
      const closeRe = new RegExp(`</${tagName}>`, "g");
      closeRe.lastIndex = openRe.lastIndex;
      const close = closeRe.exec(xml);
      if (!close) break;
      const end = close.index + close[0].length;
      results.push(xml.slice(start, end));
      openRe.lastIndex = end;
    }
    return results;
  }

  function parseAdaptationSet(asXml) {
    const openMatch = asXml.match(/<AdaptationSet\b[^>]*>/);
    if (!openMatch) return null;
    const contentType = attrMatch(openMatch[0], "contentType");
    const id = attrMatch(openMatch[0], "id");

    const repXmls = splitByTag(asXml, "Representation");
    const representations = repXmls
      .map(parseRepresentation)
      .filter((r) => r !== null);

    return { id, contentType, representations };
  }

  function parse(xmlString) {
    const xml = xmlString === null || xmlString === undefined ? "" : String(xmlString);
    if (!xml.trim()) throw new Error("empty manifest");
    const mpdMatch = xml.match(/<MPD\b[^>]*>/);
    if (!mpdMatch) throw new Error("no <MPD> root element");
    const profiles = attrMatch(mpdMatch[0], "profiles") || "";
    if (profiles.indexOf("isoff-on-demand") === -1) {
      throw new Error(`unsupported DASH profile: ${profiles || "(missing)"}`);
    }
    const mediaPresentationDuration = attrMatch(mpdMatch[0], "mediaPresentationDuration") || "";

    const asXmls = splitByTag(xml, "AdaptationSet");
    const adaptationSets = asXmls
      .map(parseAdaptationSet)
      .filter((a) => a !== null);

    return { profiles, mediaPresentationDuration, adaptationSets };
  }

  return {
    parse,
    __test_decodeEntities: decodeEntities,
    __test_parseRepresentationOpeningTag: parseRepresentationOpeningTag,
    __test_parseRepresentation: parseRepresentation,
    __test_parseAdaptationSet: parseAdaptationSet
  };
})();
// =========================================
// MP4 REMUX CORE
// =========================================
// ISO BMFF (MP4 / fragmented MP4) reader, writer, and remuxer.
//
// Takes two complete fMP4 ArrayBuffers — one video track, one audio track,
// as Instagram serves them via DASH — and produces one regular MP4 with a
// populated sample table and a single mdat. This mirrors ffmpeg's useful bit:
// defragmenting DASH, not transcoding.
//
// Codec data (avcC / hvcC / vpcC / av1C / esds), timing data (trun, tfdt),
// and media bytes are copied. We rewrite the movie/track durations and build
// stts/stsc/stsz/stco/stss from the fragments so players like VLC do not have
// to interpret Instagram's fragmented MP4 structure.
