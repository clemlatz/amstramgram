const STORY_MATCHING_CORE = (() => {
  function normalizeMediaId(value) {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    return raw.split("_")[0] || raw;
  }

  function mediaIdsMatch(left, right) {
    const a = normalizeMediaId(left);
    const b = normalizeMediaId(right);
    if (!a || !b) return false;
    return a === b;
  }

  function extractMediaIdFromUrl(url, logError) {
    if (!url) return null;

    try {
      const pathname = String(url).split("?")[0];
      const filename = pathname.split("/").pop() || "";

      const filenameMatch = filename.match(/^(\d{9,})_(\d{10,})/);
      if (filenameMatch) {
        return filenameMatch[1] + "_" + filenameMatch[2];
      }

      const numericMatch = filename.match(/^(\d{9,})/);
      if (numericMatch) {
        return numericMatch[1];
      }

      const pathMatch = pathname.match(/\/(\d{17,20})\//);
      if (pathMatch) {
        return pathMatch[1];
      }
    } catch (err) {
      if (typeof logError === "function") {
        logError("[Amstragram] Error extracting media ID from URL:", err?.message || err);
      }
    }

    return null;
  }

  function urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;

    const getPath = (url) => {
      try {
        const parsed = new URL(url);
        return parsed.pathname;
      } catch {
        return String(url).split("?")[0];
      }
    };

    const path1 = getPath(url1);
    const path2 = getPath(url2);
    if (path1 === path2) return true;

    const file1 = path1.split("/").pop();
    const file2 = path2.split("/").pop();
    if (file1 && file2 && file1 === file2) return true;

    const id1 = extractMediaIdFromUrl(url1);
    const id2 = extractMediaIdFromUrl(url2);
    if (id1 && id2 && id1 === id2) return true;

    return false;
  }

  function findItemByTargetMediaId(items, targetMediaId) {
    if (!Array.isArray(items) || items.length === 0 || !targetMediaId) return null;
    const target = String(targetMediaId);
    return items.find((item) => {
      const pk = String(item?.pk || item?.id || "");
      return mediaIdsMatch(pk, target);
    }) || null;
  }

  function findItemByPosterUrl(items, videoPosterUrl) {
    if (!Array.isArray(items) || items.length === 0 || !videoPosterUrl || String(videoPosterUrl).startsWith("data:")) {
      return null;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const candidates = item?.image_versions2?.candidates;
      if (!Array.isArray(candidates)) continue;
      for (const candidate of candidates) {
        if (urlsMatch(videoPosterUrl, candidate?.url)) {
          return item;
        }
      }
    }

    return null;
  }

  function findItemByVisibleMedia(items, visibleMedia) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const visibleUrl = visibleMedia?.url;
    if (!visibleUrl) return null;

    const visibleUrlId = extractMediaIdFromUrl(visibleUrl);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const videos = Array.isArray(item?.video_versions) ? item.video_versions : [];
      for (const video of videos) {
        if (urlsMatch(visibleUrl, video?.url)) {
          return item;
        }
      }

      const images = Array.isArray(item?.image_versions2?.candidates)
        ? item.image_versions2.candidates
        : [];
      for (const image of images) {
        if (urlsMatch(visibleUrl, image?.url)) {
          return item;
        }
        const apiUrlId = extractMediaIdFromUrl(image?.url);
        if (visibleUrlId && apiUrlId && visibleUrlId === apiUrlId) {
          return item;
        }
      }
    }

    return null;
  }

  function selectStoryItemBySignals(options) {
    const items = Array.isArray(options?.items) ? options.items : [];
    if (items.length === 0) return null;

    const byTarget = findItemByTargetMediaId(items, options?.targetMediaId);
    if (byTarget) return byTarget;

    const byPoster = findItemByPosterUrl(items, options?.videoPosterUrl);
    if (byPoster) return byPoster;

    const byVisible = findItemByVisibleMedia(items, options?.visibleMedia);
    if (byVisible) return byVisible;

    const idx = Number(options?.currentIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < items.length) {
      return items[idx];
    }

    return null;
  }

  function resolveStoryDomMedia(options) {
    const hasVideo = !!options?.hasVideo;
    const videoUrl = typeof options?.videoUrl === "string" ? options.videoUrl : "";
    const videoPosterUrl = typeof options?.videoPosterUrl === "string" ? options.videoPosterUrl : "";
    const imageUrl = typeof options?.imageUrl === "string" ? options.imageUrl : "";
    const imageWidth = Number(options?.imageWidth) || 1080;
    const videoWidth = Number(options?.videoWidth) || 1080;

    if (hasVideo) {
      if (videoUrl && !videoUrl.startsWith("blob:")) {
        return {
          type: "video",
          posterUrl: videoPosterUrl,
          data: { video_versions: [{ url: videoUrl, width: videoWidth }] }
        };
      }
      return {
        type: "video-needs-api",
        posterUrl: videoPosterUrl,
        data: null
      };
    }

    if (imageUrl && !imageUrl.startsWith("data:")) {
      return {
        type: "image",
        data: { image_versions2: { candidates: [{ url: imageUrl, width: imageWidth }] } }
      };
    }

    return null;
  }

  return {
    normalizeMediaId,
    mediaIdsMatch,
    extractMediaIdFromUrl,
    urlsMatch,
    findItemByTargetMediaId,
    findItemByPosterUrl,
    findItemByVisibleMedia,
    selectStoryItemBySignals,
    resolveStoryDomMedia
  };
})();
