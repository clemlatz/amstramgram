const DM_LIGHTSPEED_CORE = (() => {
  function parseLightspeedPayload(payloadString) {
    function toText(value) {
      return typeof value === "string" ? value : "";
    }

    function normalizePayloadText(value) {
      return toText(value).replace(/\\"/g, '"');
    }

    function decodePayloadString(value) {
      return toText(value)
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/")
        .replace(/\\\\/g, "\\");
    }

    function parseUrl(value) {
      const decoded = decodePayloadString(value).trim();
      if (!decoded) return null;
      try {
        return new URL(decoded, "https://www.instagram.com");
      } catch {
        return null;
      }
    }

    function getPathParts(value) {
      const parsed = parseUrl(value);
      if (!parsed) return [];
      return parsed.pathname.split("/").filter(Boolean).map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      });
    }

    function classifyShareKind(webUrl) {
      const parts = getPathParts(webUrl);
      for (let i = 0; i < parts.length; i++) {
        const surface = String(parts[i] || "").toLowerCase();
        if (surface === "p") return "post";
        if (surface === "reel" || surface === "reels") return "reel";
        if (surface === "stories") return "story";
      }
      return null;
    }

    function extractShortcode(webUrl, deepLink) {
      const parts = getPathParts(webUrl);
      for (let i = 0; i < parts.length - 1; i++) {
        const surface = String(parts[i] || "").toLowerCase();
        if (surface === "p" || surface === "reel" || surface === "reels") {
          return parts[i + 1] || null;
        }
      }

      const parsedDeepLink = parseUrl(deepLink);
      return parsedDeepLink?.searchParams?.get("shortcode") || null;
    }

    function extractStoryIdentity(webUrl) {
      const parts = getPathParts(webUrl);
      for (let i = 0; i < parts.length - 2; i++) {
        if (String(parts[i] || "").toLowerCase() !== "stories") continue;
        return {
          username: parts[i + 1] || null,
          storyPk: parts[i + 2] || null
        };
      }
      return { username: null, storyPk: null };
    }

    const text = normalizePayloadText(payloadString);
    if (!text || !text.includes("insertAttachmentCta")) return [];

    const entries = [];
    const seenMids = new Set();
    const ctaPattern = /"insertAttachmentCta"\s*,[\s\S]{0,240}?"ee\.(mid\.\$[^"]+)"\s*,\s*\[19\s*,\s*"[^"]*"\]\s*,\s*\[19\s*,\s*"([^"]*)"\]\s*,\s*\[19\s*,\s*"[^"]*"\]\s*,\s*"(mid\.\$[^"]+)"\s*,\s*""\s*,\s*"([^"]+)"\s*,\s*\[9\]\s*,\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*,[\s\S]{0,180}?\[19\s*,\s*"([^"]*)"\]\s*,\s*\[9\]/g;

    for (const match of text.matchAll(ctaPattern)) {
      const midFromEnvelope = decodePayloadString(match[1] || "");
      const threadIdRaw = decodePayloadString(match[2] || "");
      const mid = decodePayloadString(match[3] || midFromEnvelope);
      const opKind = decodePayloadString(match[4] || "");
      const webUrl = decodePayloadString(match[5] || "");
      const deepLink = decodePayloadString(match[6] || "");
      const mediaPkRaw = decodePayloadString(match[7] || "");

      if (!mid.startsWith("mid.$") || seenMids.has(mid)) continue;
      if (midFromEnvelope && midFromEnvelope !== mid) continue;

      const kind = classifyShareKind(webUrl);
      if (!kind) continue;
      if (opKind && opKind !== "igd_web_post_share" && opKind !== "xma_open_native") continue;

      const storyIdentity = kind === "story"
        ? extractStoryIdentity(webUrl)
        : { username: null, storyPk: null };
      const shortcode = kind === "story" ? null : extractShortcode(webUrl, deepLink);
      if (kind !== "story" && !shortcode) continue;
      if (kind === "story" && (!storyIdentity.username || !storyIdentity.storyPk)) continue;

      seenMids.add(mid);
      entries.push({
        mid,
        kind,
        shortcode,
        mediaPk: mediaPkRaw && mediaPkRaw !== "0" ? mediaPkRaw : null,
        username: storyIdentity.username,
        storyPk: storyIdentity.storyPk,
        webUrl,
        deepLink,
        threadId: threadIdRaw && threadIdRaw !== "0" ? threadIdRaw : null
      });
    }

    return entries;
  }

  return {
    parseLightspeedPayload
  };
})();
// =========================================
// DOWNLOAD PIPELINE CORE
// =========================================
