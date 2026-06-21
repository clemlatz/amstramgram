const FILE_METADATA_CORE = (() => {
  function sanitizeFilenameToken(value, fallback = "") {
    const source = value === null || value === undefined ? "" : String(value);
    const cleaned = source
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");
    return (cleaned || fallback).slice(0, 120);
  }

  // Full filename limit is 220, not 120. Previously delegated through
  // sanitizeFilenameToken which already slices to 120, making the outer
  // 220-cap a no-op. That clipped trailing extensions when a rendered
  // template + ext landed between 117-220 chars.
  function sanitizeOutputFilename(value, fallback = "instagram_media") {
    const source = value === null || value === undefined ? "" : String(value);
    const cleaned = source
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");
    return (cleaned || fallback).slice(0, 220);
  }

  function mapDownloadTypeToFolder(meta) {
    const type = typeof meta?.type === "string" ? meta.type.trim().toLowerCase() : "";
    if (type === "post") return "posts";
    if (type === "reel") return "reels";
    if (type === "comment_media") return "comment_media";
    if (type === "highlight") return "highlights";
    if (type === "story") return "stories";
    if (type === "profile_pic") return "profile_pictures";
    if (type === "archive") return "archives";
    return "misc";
  }

  function applyTypeSubfolderToArchivePath(filename, meta, folderOptions = null) {
    const safeFilename = sanitizeOutputFilename(filename, "instagram_media");
    if (!folderOptions?.useTypeSubfolders) return safeFilename;
    const folderName = sanitizeFilenameToken(mapDownloadTypeToFolder(meta), "misc").replace(/\s+/g, "_");
    return `${folderName}/${safeFilename}`;
  }

  function makeUniqueArchivePath(path, usedPaths) {
    const normalized = String(path || "").replace(/^\/+/, "");
    if (!usedPaths.has(normalized)) {
      usedPaths.add(normalized);
      return normalized;
    }

    const slashIndex = normalized.lastIndexOf("/");
    const dir = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : "";
    const baseName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
    const dotIndex = baseName.lastIndexOf(".");
    const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
    const ext = dotIndex > 0 ? baseName.slice(dotIndex) : "";

    for (let i = 1; i <= 999; i++) {
      const candidate = `${dir}${stem} (${i})${ext}`;
      if (!usedPaths.has(candidate)) {
        usedPaths.add(candidate);
        return candidate;
      }
    }

    throw new Error("Could not create a unique archive path.");
  }

  function sanitizeFileExtension(value, fallback = "jpg") {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return /^[a-z0-9]{2,8}$/.test(normalized) ? normalized : fallback;
  }

  function extractFileExtension(filename) {
    if (typeof filename !== "string") return "";
    const normalized = filename.trim().split(/[?#]/)[0];
    const dotIndex = normalized.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === normalized.length - 1) return "";
    return sanitizeFileExtension(normalized.slice(dotIndex + 1), "");
  }

  function ensureFilenameHasExtension(filename, ext) {
    const trimmed = String(filename || "").trim();
    const safeExt = sanitizeFileExtension(ext, "jpg");
    // Only skip when the name already ends with the *intended* extension.
    // The previous regex matched any 2-8 char tail after a dot, which
    // misidentified usernames like "user.laf" as having an extension and
    // saved files without the real ext appended.
    const tailPattern = new RegExp(`\\.${safeExt}$`, "i");
    if (tailPattern.test(trimmed)) return trimmed;
    return `${trimmed}.${safeExt}`;
  }

  function extractCdnFilenameStemFromUrl(url) {
    if (typeof url !== "string" || !url) return "";
    const lastSegment = url.split("/").pop()?.split(/[?#]/)[0] || "";
    return lastSegment.replace(/\.[^.]+$/, "");
  }

  function formatDateToken(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatTimeToken(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}-${mm}-${ss}`;
  }

  function resolveDownloadFilename(defaultFilename, meta = null, namingOptions = null) {
    const fallbackBaseName = sanitizeOutputFilename(defaultFilename || "instagram_media");
    const template = namingOptions?.filenameTemplate || "";
    const extFromFallback = extractFileExtension(fallbackBaseName);
    const ext = sanitizeFileExtension(meta?.ext || extFromFallback || "jpg", "jpg");

    if (!template) {
      return ensureFilenameHasExtension(fallbackBaseName, ext);
    }

    const now = new Date();
    const numericIndex = Number(meta?.index);
    const uploadTimestamp = normalizeMetadataTimestamp(meta?.takenAt);
    const uploadDate = uploadTimestamp.unix ? new Date(uploadTimestamp.unix * 1000) : null;
    const sourceValue = sanitizeFilenameToken(stripFilenameExtension(fallbackBaseName), "instagram_media");
    const tokens = {
      source: sourceValue,
      original: sourceValue,
      username: sanitizeFilenameToken(meta?.username, "instagram"),
      full_name: sanitizeFilenameToken(meta?.fullName, ""),
      type: sanitizeFilenameToken(meta?.type, "media"),
      shortcode: sanitizeFilenameToken(meta?.shortcode, ""),
      id: sanitizeFilenameToken(meta?.id, ""),
      index: Number.isFinite(numericIndex) && numericIndex > 0 ? String(Math.floor(numericIndex)) : "",
      date: formatDateToken(now),
      time: formatTimeToken(now),
      upload_date: uploadDate ? formatDateToken(uploadDate) : "",
      upload_time: uploadDate ? formatTimeToken(uploadDate) : "",
      ext: ext
    };

    const renderedTemplate = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (fullMatch, tokenName) =>
      Object.prototype.hasOwnProperty.call(tokens, tokenName) ? tokens[tokenName] : ""
    );

    const cleaned = sanitizeOutputFilename(renderedTemplate, "");
    if (!cleaned) {
      return ensureFilenameHasExtension(fallbackBaseName, ext);
    }
    return ensureFilenameHasExtension(cleaned, ext);
  }

  function stripFilenameExtension(filename) {
    const normalized = String(filename || "").trim();
    if (!normalized) return "instagram_media";
    const slashIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
    const dotIndex = normalized.lastIndexOf(".");
    if (dotIndex > slashIndex && dotIndex > 0) {
      return normalized.slice(0, dotIndex);
    }
    return normalized;
  }

  function extractCaptionText(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    if (!value || typeof value !== "object") {
      return "";
    }
    if (typeof value.text === "string") {
      return value.text.trim();
    }
    if (Array.isArray(value.edges)) {
      for (const edge of value.edges) {
        const candidate = extractCaptionText(edge?.node || edge);
        if (candidate) return candidate;
      }
    }
    if (Array.isArray(value.items)) {
      for (const item of value.items) {
        const candidate = extractCaptionText(item);
        if (candidate) return candidate;
      }
    }
    if (value.node) {
      return extractCaptionText(value.node);
    }
    return "";
  }

  function extractHashtagsFromCaption(captionText) {
    if (typeof captionText !== "string" || !captionText.trim()) return [];
    const matches = captionText.match(/#[A-Za-z0-9_]+/g) || [];
    const tags = [];
    const seen = new Set();
    for (const match of matches) {
      const normalized = String(match || "").trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(normalized);
    }
    return tags;
  }

  function normalizeMetadataHashtags(rawHashtags, captionText = "") {
    const candidates = [];
    if (Array.isArray(rawHashtags)) {
      candidates.push(...rawHashtags);
    } else if (typeof rawHashtags === "string" && rawHashtags.trim()) {
      candidates.push(...rawHashtags.split(/[\s,]+/g));
    }
    if (candidates.length === 0) {
      return extractHashtagsFromCaption(captionText);
    }

    const tags = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const cleaned = String(candidate || "").trim().replace(/^#+/, "");
      if (!cleaned) continue;
      const safe = `#${cleaned}`;
      const key = safe.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(safe);
    }
    return tags;
  }

  function normalizeMetadataTimestamp(value) {
    const empty = { raw: value ?? null, unix: null, iso: null };
    if (value === null || value === undefined || value === "") return empty;

    let numeric = null;
    if (typeof value === "number" && Number.isFinite(value)) {
      numeric = value;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return empty;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        numeric = Number(trimmed);
      } else {
        const parsedMs = Date.parse(trimmed);
        if (!Number.isFinite(parsedMs)) return empty;
        const unixFromIso = Math.floor(parsedMs / 1000);
        if (unixFromIso <= 0) return empty;
        return {
          raw: value,
          unix: unixFromIso,
          iso: new Date(unixFromIso * 1000).toISOString()
        };
      }
    }

    if (!Number.isFinite(numeric)) return empty;
    const asSeconds = Math.abs(numeric) > 1000000000000
      ? numeric / 1000
      : numeric;
    const unix = Math.floor(asSeconds);
    if (!Number.isFinite(unix) || unix <= 0) return empty;

    try {
      const iso = new Date(unix * 1000).toISOString();
      return { raw: value, unix, iso };
    } catch {
      return empty;
    }
  }

  function buildMetadataHintFromMediaItem(item, fallbacks = {}) {
    const source = item && typeof item === "object" ? item : {};
    const base = fallbacks && typeof fallbacks === "object" ? fallbacks : {};

    // accessibility_caption is Instagram's auto-generated screen-reader alt text
    // ("Photo by X on date. May be an image of ..."), not the user-written caption.
    // It is captured separately as altText so consumers can use it for search /
    // organisation without ever conflating it with the real caption.
    const caption = extractCaptionText(
      source.caption ??
      source.captionText ??
      source.edge_media_to_caption ??
      source.edge_media_caption ??
      base.caption ??
      base.captionText ??
      ""
    );

    const altText = extractCaptionText(
      source.altText ??
      source.accessibility_caption ??
      base.altText ??
      base.accessibility_caption ??
      ""
    );

    const hashtags = normalizeMetadataHashtags(source.hashtags ?? base.hashtags, caption);
    const takenAt =
      source.takenAt ??
      source.taken_at ??
      source.taken_at_timestamp ??
      source.taken_at_ts ??
      source.timestamp ??
      source.createdAt ??
      source.created_at ??
      source.device_timestamp ??
      base.takenAt ??
      base.timestamp ??
      base.createdAt ??
      null;

    const authorIdValue =
      source.authorId ??
      source.userId ??
      source.ownerId ??
      source.author_id ??
      source.owner_id ??
      source.user_id ??
      source?.user?.pk ??
      source?.user?.id ??
      source?.owner?.pk ??
      source?.owner?.id ??
      base.authorId ??
      base.userId ??
      base.ownerId ??
      null;

    let authorUsername = "";
    if (typeof source?.user?.username === "string" && source.user.username.trim()) {
      authorUsername = source.user.username.trim();
    } else if (typeof source?.owner?.username === "string" && source.owner.username.trim()) {
      authorUsername = source.owner.username.trim();
    } else if (typeof source.authorUsername === "string" && source.authorUsername.trim()) {
      authorUsername = source.authorUsername.trim();
    } else if (typeof base.authorUsername === "string" && base.authorUsername.trim()) {
      authorUsername = base.authorUsername.trim();
    } else if (typeof base.username === "string" && base.username.trim()) {
      authorUsername = base.username.trim();
    }

    let permalink = "";
    if (typeof source.permalink === "string" && source.permalink.trim()) {
      permalink = source.permalink.trim();
    } else if (typeof base.permalink === "string" && base.permalink.trim()) {
      permalink = base.permalink.trim();
    }

    return {
      caption,
      altText,
      hashtags,
      takenAt,
      authorId: (authorIdValue === null || authorIdValue === undefined || authorIdValue === "")
        ? ""
        : String(authorIdValue),
      authorUsername,
      permalink
    };
  }

  function buildMetadataSidecarPayload(sourceUrl, mediaFilename, meta = null) {
    const metadata = meta && typeof meta === "object" ? meta : {};
    const hint = buildMetadataHintFromMediaItem(metadata, metadata);
    const normalizedTimestamp = normalizeMetadataTimestamp(hint.takenAt);
    const hashtags = normalizeMetadataHashtags(metadata.hashtags ?? hint.hashtags, hint.caption);

    const sourceUrlText = typeof sourceUrl === "string" ? sourceUrl.trim() : "";
    const filenameText = typeof mediaFilename === "string" ? mediaFilename.trim() : "";
    const type = typeof metadata.type === "string" && metadata.type.trim()
      ? metadata.type.trim()
      : "";
    const shortcode = typeof metadata.shortcode === "string" && metadata.shortcode.trim()
      ? metadata.shortcode.trim()
      : "";
    const mediaId = (metadata.id === null || metadata.id === undefined || metadata.id === "")
      ? null
      : String(metadata.id);
    const authorId = hint.authorId || null;
    const authorUsername = hint.authorUsername || null;
    const extension = sanitizeFileExtension(metadata.ext || extractFileExtension(filenameText), "");
    const numericIndex = Number(metadata.index);

    return {
      schema: "amstragram-media-metadata-v1.2",
      exportedAt: new Date().toISOString(),
      sourceUrl: sourceUrlText || null,
      permalink: hint.permalink || null,
      filename: filenameText || null,
      media: {
        type: type || null,
        shortcode: shortcode || null,
        id: mediaId,
        index: Number.isFinite(numericIndex) && numericIndex > 0 ? Math.floor(numericIndex) : null,
        extension: extension || null,
        kind: typeof metadata.mediaKind === "string" && metadata.mediaKind ? metadata.mediaKind : null,
        carouselTotal: Number.isInteger(metadata.carouselTotal) && metadata.carouselTotal >= 1
          ? metadata.carouselTotal
          : null
      },
      author: {
        id: authorId,
        username: authorUsername
      },
      caption: hint.caption || "",
      altText: hint.altText || "",
      hashtags: hashtags,
      timestamp: {
        raw: normalizedTimestamp.raw,
        unix: normalizedTimestamp.unix,
        iso: normalizedTimestamp.iso
      }
    };
  }

  function getMetadataSidecarFilenames(mediaFilename) {
    const baseName = sanitizeOutputFilename(stripFilenameExtension(mediaFilename), "instagram_media");
    return {
      json: `${baseName}.json`,
      xmp: `${baseName}.xmp`
    };
  }

  function formatXmpDate(iso) {
    if (typeof iso !== "string" || !iso) return "";
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if (!match) return "";
    const [, y, mo, d, h, mi, s, rawTz] = match;
    let offset = "Z";
    if (rawTz && rawTz !== "Z") {
      offset = rawTz.includes(":") ? rawTz : `${rawTz.slice(0, 3)}:${rawTz.slice(3)}`;
    }
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
  }

  function escapeXmlText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function truncateIptcHeadline(value) {
    const text = String(value == null ? "" : value).trim();
    return text.length > 255 ? text.slice(0, 255) : text;
  }

  function isStillImageMetadataPayload(payload) {
    const media = payload?.media && typeof payload.media === "object" ? payload.media : {};
    const type = String(media.type || "").trim().toLowerCase();
    const extension = String(media.extension || "").trim().replace(/^\./, "").toLowerCase();
    if (["mp4", "m4v", "mov", "webm", "mkv"].includes(extension)) return false;
    if (["jpg", "jpeg", "jpe", "png", "webp", "avif", "heic", "heif", "tif", "tiff"].includes(extension)) return true;
    return ["image", "photo", "picture", "profile_pic", "profile_picture"].includes(type);
  }

  // Builds an RDF/XML XMP packet. flags = { xmp, iptc, exif } controls which
  // namespaces emit tags. The XMP, IPTC, and EXIF "sidecar" toggles in the
  // settings each light up one of these flags; the resulting .xmp file is
  // valid for any combination, including individual flags.
  function buildXmpSidecarDocument(payload, flags = null) {
    const safe = payload && typeof payload === "object" ? payload : {};
    const wantXmp = flags ? flags.xmp === true : false;
    const wantIptc = flags ? flags.iptc === true : false;
    const wantExif = flags ? flags.exif === true && isStillImageMetadataPayload(safe) : false;
    if (!wantXmp && !wantIptc && !wantExif) return "";

    const author = safe.author && typeof safe.author === "object" ? safe.author : {};
    const timestamp = safe.timestamp && typeof safe.timestamp === "object" ? safe.timestamp : {};
    const rawHashtags = Array.isArray(safe.hashtags) ? safe.hashtags : [];
    const keywords = rawHashtags
      .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
      .filter(Boolean);

    const dateTimeIso = timestamp.iso || "";
    const dateTimeXmp = formatXmpDate(dateTimeIso);
    const caption = safe.caption || "";
    const altText = safe.altText || "";
    const username = author.username || "";
    const permalink = safe.permalink || "";

    const props = [];

    // dc:description and dc:subject are universal. Both XMP and IPTC consumers
    // read them. Add once if either flag is on, dedupe across the two flags.
    if ((wantXmp || wantIptc) && caption) {
      props.push(`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXmlText(caption)}</rdf:li></rdf:Alt></dc:description>`);
    }
    if ((wantXmp || wantIptc) && keywords.length > 0) {
      const items = keywords.map((kw) => `<rdf:li>${escapeXmlText(kw)}</rdf:li>`).join("");
      props.push(`<dc:subject><rdf:Bag>${items}</rdf:Bag></dc:subject>`);
    }
    if ((wantXmp || wantIptc) && altText) {
      props.push(`<Iptc4xmpExt:AltTextAccessibility><rdf:Alt><rdf:li xml:lang="x-default">${escapeXmlText(altText)}</rdf:li></rdf:Alt></Iptc4xmpExt:AltTextAccessibility>`);
    }

    if (wantXmp) {
      if (username) {
        props.push(`<dc:creator><rdf:Seq><rdf:li>${escapeXmlText(username)}</rdf:li></rdf:Seq></dc:creator>`);
      }
      if (dateTimeIso) {
        props.push(`<xmp:CreateDate>${escapeXmlText(dateTimeIso)}</xmp:CreateDate>`);
        props.push(`<xmp:ModifyDate>${escapeXmlText(dateTimeIso)}</xmp:ModifyDate>`);
        props.push(`<photoshop:DateCreated>${escapeXmlText(dateTimeIso)}</photoshop:DateCreated>`);
      }
      if (permalink) {
        props.push(`<xmpRights:WebStatement>${escapeXmlText(permalink)}</xmpRights:WebStatement>`);
      }
    }

    if (wantIptc) {
      if (caption) {
        props.push(`<Iptc4xmpCore:Headline>${escapeXmlText(truncateIptcHeadline(caption))}</Iptc4xmpCore:Headline>`);
      }
      if (username) {
        props.push(`<photoshop:Credit>${escapeXmlText(username)}</photoshop:Credit>`);
      }
    }

    if (wantExif) {
      if (dateTimeXmp) {
        props.push(`<exif:DateTimeOriginal>${escapeXmlText(dateTimeXmp)}</exif:DateTimeOriginal>`);
        props.push(`<exif:DateTimeDigitized>${escapeXmlText(dateTimeXmp)}</exif:DateTimeDigitized>`);
      }
      if (username) {
        props.push(`<tiff:Artist>${escapeXmlText(username)}</tiff:Artist>`);
      }
      if (altText) {
        props.push(`<tiff:ImageDescription>${escapeXmlText(altText)}</tiff:ImageDescription>`);
      }
    }

    if (props.length === 0) return "";

    const indented = props.map((p) => `      ${p}`).join("\n");

    return [
      // eslint-disable-next-line no-irregular-whitespace
      `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
      `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Amstragram">`,
      `  <rdf:RDF`,
      `    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`,
      `    xmlns:dc="http://purl.org/dc/elements/1.1/"`,
      `    xmlns:xmp="http://ns.adobe.com/xap/1.0/"`,
      `    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"`,
      `    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"`,
      `    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"`,
      `    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"`,
      `    xmlns:exif="http://ns.adobe.com/exif/1.0/"`,
      `    xmlns:tiff="http://ns.adobe.com/tiff/1.0/">`,
      `    <rdf:Description rdf:about="">`,
      indented,
      `    </rdf:Description>`,
      `  </rdf:RDF>`,
      `</x:xmpmeta>`,
      `<?xpacket end="w"?>`,
      ``
    ].filter((line) => line !== "").join("\n") + "\n";
  }

  function buildMetadataSidecarArchiveEntries(
    sourceUrl,
    archivePath,
    meta = null,
    archivePaths = null,
    metadataOptions = null
  ) {
    const wantJson = metadataOptions?.saveMetadataJson === true;
    const wantXmp = metadataOptions?.saveMetadataXmp === true;
    const wantIptc = metadataOptions?.saveMetadataIptc === true;
    const wantExif = metadataOptions?.saveMetadataXmpExif === true;
    const wantXmpFile = wantXmp || wantIptc || wantExif;
    if (!wantJson && !wantXmpFile) return [];

    const rawPath = String(archivePath || "").trim();
    if (!rawPath) return [];

    const slashIndex = Math.max(rawPath.lastIndexOf("/"), rawPath.lastIndexOf("\\"));
    const dotIndex = rawPath.lastIndexOf(".");
    const basePath = (dotIndex > slashIndex && dotIndex > 0)
      ? rawPath.slice(0, dotIndex)
      : rawPath;

    const payload = buildMetadataSidecarPayload(sourceUrl, rawPath, meta);
    const jsonCandidate = `${basePath}.json`;
    const xmpCandidate = `${basePath}.xmp`;
    const jsonPath = archivePaths instanceof Set
      ? makeUniqueArchivePath(jsonCandidate, archivePaths)
      : jsonCandidate;
    const xmpPath = archivePaths instanceof Set
      ? makeUniqueArchivePath(xmpCandidate, archivePaths)
      : xmpCandidate;

    const encoder = new TextEncoder();
    const entries = [];
    if (wantJson) {
      entries.push({
        path: jsonPath,
        data: encoder.encode(JSON.stringify(payload, null, 2)),
        lastModified: new Date()
      });
    }
    if (wantXmpFile) {
      const xmlText = buildXmpSidecarDocument(payload, { xmp: wantXmp, iptc: wantIptc, exif: wantExif });
      if (xmlText) {
        entries.push({
          path: xmpPath,
          data: encoder.encode(xmlText),
          lastModified: new Date()
        });
      }
    }
    return entries;
  }

  return {
    sanitizeFilenameToken,
    sanitizeOutputFilename,
    mapDownloadTypeToFolder,
    applyTypeSubfolderToArchivePath,
    makeUniqueArchivePath,
    sanitizeFileExtension,
    extractFileExtension,
    ensureFilenameHasExtension,
    extractCdnFilenameStemFromUrl,
    resolveDownloadFilename,
    stripFilenameExtension,
    extractCaptionText,
    extractHashtagsFromCaption,
    normalizeMetadataHashtags,
    normalizeMetadataTimestamp,
    buildMetadataHintFromMediaItem,
    buildMetadataSidecarPayload,
    formatXmpDate,
    buildXmpSidecarDocument,
    getMetadataSidecarFilenames,
    buildMetadataSidecarArchiveEntries
  };
})();
