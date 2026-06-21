const MEDIA_SELECTION_CORE = (() => {
  const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp"]);
  const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "m4s"]);

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function cleanUrl(value) {
    const url = String(value || "").trim();
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) return "";
    if (!/^https?:\/\//i.test(url)) return "";
    return url;
  }

  function inferExt(url, fallback) {
    const match = String(url || "").match(/\.([A-Za-z0-9]{2,5})(?:[?#]|$)/);
    const ext = match?.[1]?.toLowerCase() || "";
    if (ext === "jpeg") return "jpg";
    if (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) return ext;
    return fallback;
  }

  function area(candidate) {
    return (Number(candidate?.width) || 0) * (Number(candidate?.height) || 0);
  }

  function visibleResolution(candidate) {
    const width = Number(candidate?.width) || 0;
    const height = Number(candidate?.height) || 0;
    return width && height ? Math.min(width, height) : (width || height || 0);
  }

  function rankByQuality(candidates) {
    return asArray(candidates)
      .filter((candidate) => cleanUrl(candidate?.url))
      .sort((a, b) => {
        const resolutionDiff = visibleResolution(b) - visibleResolution(a);
        if (resolutionDiff !== 0) return resolutionDiff;

        const areaDiff = area(b) - area(a);
        if (areaDiff !== 0) return areaDiff;

        return (Number(b?.bandwidth) || 0) - (Number(a?.bandwidth) || 0);
      });
  }

  function collectImageCandidates(item) {
    return rankByQuality([
      ...asArray(item?.image_versions2?.candidates),
      ...asArray(item?.display_resources),
      item?.display_url ? { url: item.display_url, width: item.dimensions?.width, height: item.dimensions?.height } : null,
      item?.thumbnail_src ? { url: item.thumbnail_src, width: item.dimensions?.width, height: item.dimensions?.height } : null,
      item?.thumbnail_url ? { url: item.thumbnail_url, width: item.dimensions?.width, height: item.dimensions?.height } : null
    ].filter(Boolean));
  }

  function collectVideoVersions(item) {
    return rankByQuality([
      ...asArray(item?.video_versions),
      ...asArray(item?.video_versions?.candidates),
      ...asArray(item?.video_resources),
      item?.video_url ? { url: item.video_url, width: item.original_width || item.dimensions?.width, height: item.original_height || item.dimensions?.height } : null
    ].filter(Boolean));
  }

  function itemLooksVideo(item, intent) {
    if (intent === "video") return true;
    if (item?.media_type === 2 || item?.is_video === true) return true;
    if (typeof item?.video_dash_manifest === "string" && item.video_dash_manifest.trim()) return true;
    if (collectVideoVersions(item).length > 0) return true;
    const typename = String(item?.__typename || item?.typename || "");
    return /\bvideo\b/i.test(typename) || /GraphVideo/i.test(typename);
  }

  function buildFallback(reason, attempted, extra = {}) {
    return {
      reason,
      attempted: Array.isArray(attempted) ? attempted : [],
      ...extra
    };
  }

  function selectResolvedVideo(item, deps) {
    const resolver = deps?.videoResolver || (typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null);
    if (!resolver || typeof resolver.resolve !== "function") return null;
    try {
      const plan = resolver.resolve({ item, options: deps?.videoResolverOptions || {} });
      if (!plan?.video?.url) return null;
      return {
        source: plan.source === "dash" ? "dash" : "progressive",
        url: plan.video.url,
        width: Number(plan.video.width) || 0,
        height: Number(plan.video.height) || 0,
        ext: plan.container || inferExt(plan.video.url, "mp4"),
        videoPlan: plan,
        resolverFallbackReason: plan.source === "dash" ? "" : (plan.diagnostics?.fallbackReason || "dash_unavailable")
      };
    } catch {
      return null;
    }
  }

  function selectBestVideo(context, deps) {
    const item = context?.item || {};
    const attempted = ["dash"];

    const resolvedVideo = selectResolvedVideo(item, deps);
    if (resolvedVideo?.source === "dash") {
      return { selected: resolvedVideo, fallback: null };
    }

    if (resolvedVideo?.source === "progressive") {
      attempted.push("progressive");
      return {
        selected: resolvedVideo,
        fallback: buildFallback("dash_unavailable", attempted, {
          resolverReason: resolvedVideo.resolverFallbackReason || ""
        })
      };
    }

    attempted.push("progressive");
    const progressive = collectVideoVersions(item)[0];
    if (progressive?.url) {
      return {
        selected: {
          source: "progressive",
          url: cleanUrl(progressive.url),
          width: Number(progressive.width) || 0,
          height: Number(progressive.height) || 0,
          ext: inferExt(progressive.url, "mp4"),
          videoPlan: null
        },
        fallback: buildFallback("dash_unavailable", attempted)
      };
    }

    attempted.push("dom_video");
    const domVideo = context?.domMedia?.kind === "video" ? context.domMedia : null;
    if (domVideo && cleanUrl(domVideo.url)) {
      return {
        selected: {
          source: "dom_video",
          url: cleanUrl(domVideo.url),
          width: Number(domVideo.width) || 0,
          height: Number(domVideo.height) || 0,
          ext: inferExt(domVideo.url, "mp4"),
          videoPlan: null
        },
        fallback: buildFallback("api_video_unavailable", attempted)
      };
    }

    attempted.push("poster");
    const poster = collectImageCandidates(item)[0] || (context?.domMedia?.kind === "image" ? context.domMedia : null);
    if (poster && cleanUrl(poster.url)) {
      return {
        selected: {
          source: "poster",
          url: cleanUrl(poster.url),
          width: Number(poster.width) || 0,
          height: Number(poster.height) || 0,
          ext: inferExt(poster.url, "jpg"),
          videoPlan: null
        },
        fallback: buildFallback("video_unavailable_poster_only", attempted, { mediaKindChanged: true })
      };
    }

    return { selected: null, fallback: buildFallback("no_video_candidate", attempted) };
  }

  function selectBestImage(context) {
    const item = context?.item || {};
    const attempted = ["api_image"];
    const best = collectImageCandidates(item)[0];
    if (best?.url) {
      return {
        selected: {
          source: "api_image",
          url: cleanUrl(best.url),
          width: Number(best.width) || 0,
          height: Number(best.height) || 0,
          ext: inferExt(best.url, "jpg"),
          videoPlan: null
        },
        fallback: null
      };
    }

    attempted.push("dom_image");
    const domImage = context?.domMedia?.kind === "image" ? context.domMedia : null;
    if (domImage && cleanUrl(domImage.url)) {
      return {
        selected: {
          source: "dom_image",
          url: cleanUrl(domImage.url),
          width: Number(domImage.width) || 0,
          height: Number(domImage.height) || 0,
          ext: inferExt(domImage.url, "jpg"),
          videoPlan: null
        },
        fallback: buildFallback("api_image_unavailable", attempted)
      };
    }

    return { selected: null, fallback: buildFallback("no_image_candidate", attempted) };
  }

  function selectBestMedia(context, deps = {}) {
    const item = context?.item || {};
    const type = context?.type || "media";
    const intent = context?.mediaKindIntent || "unknown";
    const wantsVideo = itemLooksVideo(item, intent);
    const result = wantsVideo ? selectBestVideo(context, deps) : selectBestImage(context);
    const selected = result.selected;
    const mediaKind = wantsVideo && selected?.source !== "poster" ? "video" : "image";

    return {
      type,
      mediaKind,
      identity: context?.identity || {},
      selected,
      fallback: result.fallback,
      diagnostics: result.fallback ? [result.fallback] : []
    };
  }

  return {
    selectBestMedia
  };
})();
// =========================================
// DM LIGHTSPEED CORE
// =========================================
