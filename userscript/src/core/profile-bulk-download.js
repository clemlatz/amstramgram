const PROFILE_BULK_DOWNLOAD_CORE = (() => {
  const { sleepMs, randomIntBetween } = UTILITIES_CORE;
  const {
    collectTaggedTasksFromProfilePageFallback,
    extractHttpStatusCodeFromError,
    extractTaggedFeedMediaItems,
    extractTaggedGraphQLPageInfo,
    extractTaggedShortcodesFromPayloadDeep,
    fetchHighlightInfoDirect,
    fetchPostInfoFromHtml,
    fetchPostInfoWithFallback,
    fetchProfileInfoDirect,
    getAppID,
    getBestStoryItemMedia,
    gmFetch,
    isLikelyInstagramShortcode,
    isRetryableTaggedRequestStatus,
    isValidHdProfilePicUrl,
    mediaContainsTaggedProfile,
    normalizeProfilePicUrl,
    summarizeTaggedItemForTrace,
    tryGraphQLTaggedFeed,
  } = PAGE_HANDLERS_CORE;
  const { sanitizeAmstramgramUrl, sanitizeProfileDownloadSelection, getProfileDownloadSelectionLabel } = SETTINGS_SCHEMA_CORE;

  const TAGGED_TRACE_ENABLED = false;

  function showToast(message, durationMs = 3500) {
    return TOAST_CORE.showToast(message, durationMs, { elementId: "ig-hd-toast" });
  }

  function taggedTrace(eventLabel, details) {
    try {
      if (typeof console === "undefined" || typeof console.log !== "function") return;
      if (typeof details === "undefined") {
        console.log("[Amstragram Tagged Trace]", eventLabel);
      } else {
        console.log("[Amstragram Tagged Trace]", eventLabel, details);
      }
    } catch {
      // Never let debug tracing break downloads.
    }
  }

  // Injected from main.js via _init()
  let RUNTIME_CONFIG = {};
  let _userSettingsGetter = () => null;
  function _getSettings() { return _userSettingsGetter(); }
  function debugLog(...args) {
    if (!RUNTIME_CONFIG.enableDebugLogs) return;
    console.log(...args);
  }

  let getDownloadHistoryKeyForTask = () => "";
  let hasDownloadedHistoryKey = () => false;
  let ensureBatchRunRecord = () => {};
  let showBatchProgressIndicator = () => {};
  let getActiveBulkPolicy = () => null;
  let generateBatchJobId = () => "";
  let runBatchDownloadTasks = async () => {};
  let syncAmstramgramShortcodes = () => {};

  function _init(ctx) {
    if (ctx.runtimeConfig) RUNTIME_CONFIG = ctx.runtimeConfig;
    if (ctx.getUserSettings) _userSettingsGetter = ctx.getUserSettings;
    if (ctx.getDownloadHistoryKeyForTask) getDownloadHistoryKeyForTask = ctx.getDownloadHistoryKeyForTask;
    if (ctx.hasDownloadedHistoryKey) hasDownloadedHistoryKey = ctx.hasDownloadedHistoryKey;
    if (ctx.ensureBatchRunRecord) ensureBatchRunRecord = ctx.ensureBatchRunRecord;
    if (ctx.showBatchProgressIndicator) showBatchProgressIndicator = ctx.showBatchProgressIndicator;
    if (ctx.getActiveBulkPolicy) getActiveBulkPolicy = ctx.getActiveBulkPolicy;
    if (ctx.generateBatchJobId) generateBatchJobId = ctx.generateBatchJobId;
    if (ctx.runBatchDownloadTasks) runBatchDownloadTasks = ctx.runBatchDownloadTasks;
    if (ctx.syncAmstramgramShortcodes) syncAmstramgramShortcodes = ctx.syncAmstramgramShortcodes;
  }

  // =========================================
  // PROFILE BULK DOWNLOAD ORCHESTRATION
  // =========================================

  function selectProfileItemMediaForDownload(item, options = {}) {
    const hasCarousel = Array.isArray(item?.carousel_media) && item.carousel_media.length > 0;
    if (!hasCarousel) return [item];

    if (options?.includeAllCarouselMedia !== false) {
      return item.carousel_media;
    }

    const taggedMatches = item.carousel_media.filter((media) =>
      mediaContainsTaggedProfile(media, options?.taggedUserId, options?.taggedUsername)
    );
    if (taggedMatches.length > 0) return taggedMatches;

    // Some payloads only retain the sidecar-level tag signal.
    if (mediaContainsTaggedProfile(item, options?.taggedUserId, options?.taggedUsername)) {
      return [item.carousel_media[0]];
    }

    // Fallback to the slide represented by the tagged grid tile (first sidecar item).
    return [item.carousel_media[0]];
  }

  function selectProfileMediaCandidateForDownload(media, context = {}) {
    const settings = (typeof _getSettings() !== "undefined" && _getSettings() && _getSettings().downloads) || {};
    const container = settings.videoContainer === "mkv" ? "mkv" : "mp4";
    const mediaType = context?.mediaType || (media?.product_type === "clips" ? "reel" : "post");
    const shortcode = context?.shortcode || media?.code || media?.shortcode || media?.id || media?.pk || "";
    const hasVideoVersions = Array.isArray(media?.video_versions) && media.video_versions.length > 0;
    const mediaKindIntent = (media?.media_type === 2 || media?.is_video === true || hasVideoVersions || typeof media?.video_url === "string")
      ? "video"
      : "unknown";
    const selectedMedia = MEDIA_SELECTION_CORE.selectBestMedia({
      type: mediaType,
      mediaKindIntent: mediaKindIntent,
      identity: { shortcode: shortcode, index: context?.index || 1 },
      item: media
    }, {
      videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
      videoResolverOptions: { container }
    });

    let url = selectedMedia.selected?.url || "";
    if (selectedMedia.mediaKind === "video" && selectedMedia.selected?.source === "dash") {
      const videos = Array.isArray(media?.video_versions)
        ? [...media.video_versions].filter((candidate) => typeof candidate?.url === "string" && candidate.url.trim())
        : [];
      videos.sort((a, b) => {
        const areaA = (Number(a?.width) || 0) * (Number(a?.height) || 0);
        const areaB = (Number(b?.width) || 0) * (Number(b?.height) || 0);
        if (areaA !== areaB) return areaB - areaA;
        return (Number(b?.bandwidth) || 0) - (Number(a?.bandwidth) || 0);
      });
      url = videos[0]?.url || url;
    }

    return {
      isVideo: selectedMedia.mediaKind === "video",
      url: url,
      ext: selectedMedia.selected?.ext || (selectedMedia.mediaKind === "video" ? "mp4" : "jpg"),
      videoPlan: selectedMedia.selected?.videoPlan || null,
      fallback: selectedMedia.fallback || null,
      selectedSource: selectedMedia.selected?.source || ""
    };
  }

  async function hydrateMediaItemForDesktopDash(item) {
    const isVideo = Array.isArray(item?.video_versions) && item.video_versions.length > 0;
    if (!isVideo || typeof item?.video_dash_manifest === "string") return item;

    const shortcode = item?.code || item?.shortcode || "";
    if (!isLikelyInstagramShortcode(shortcode)) return item;
    if (typeof fetchPostInfoWithFallback !== "function") return item;

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
    try {
      const hydrated = await Promise.race([fetchPostInfoWithFallback(shortcode), timeoutPromise]);
      return hydrated || item;
    } catch (err) {
      if (typeof debugLog === "function") {
        debugLog("[Amstragram] desktop DASH hydration failed for", shortcode, ":", err?.message || err);
      }
      return item;
    }
  }

  function buildProfilePictureDownloadTask(username, profilePicUrl, userId = "") {
    const normalizedUrl = normalizeProfilePicUrl(profilePicUrl);
    if (!isValidHdProfilePicUrl(normalizedUrl)) return null;
    const ext = FILE_METADATA_CORE.extractFileExtension(normalizedUrl) || "jpg";
    return {
      url: normalizedUrl,
      filename: `${username}_profile.${ext}`,
      meta: {
        type: "profile_pic",
        username: username,
        shortcode: "",
        id: userId || username,
        index: 1,
        ext: ext,
        caption: "",
        altText: "",
        hashtags: [],
        takenAt: null,
        authorId: userId || "",
        authorUsername: username,
        permalink: `https://www.instagram.com/${username}/`,
        mediaKind: "image",
        carouselTotal: 1
      }
    };
  }

  function buildProfileItemDownloadTasks(item, username, options = {}) {
    const mediaItems = selectProfileItemMediaForDownload(item, options);
    const shortcode = item?.code || item?.id || item?.pk || "post";
    const isReel = options?.isReel === true || item?.product_type === "clips";
    const mediaType = isReel ? "reel" : "post";
    const permalinkBase = isReel ? "reel" : "p";
    const postPermalink = shortcode ? `https://www.instagram.com/${permalinkBase}/${shortcode}/` : "";
    const sharedMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, {
      username: username,
      permalink: postPermalink
    });
    const tasks = [];

    for (let i = 0; i < mediaItems.length; i++) {
      const media = mediaItems[i] || {};
      const selected = selectProfileMediaCandidateForDownload(media, {
        mediaType: mediaType,
        shortcode: shortcode,
        index: i + 1
      });
      const url = selected.url || "";

      if (!url) continue;
      const suffix = mediaItems.length > 1 ? `_${i + 1}` : "";
      const mediaId = media?.pk || media?.id || `${i + 1}`;
      const mediaMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(media, sharedMetadata);
      tasks.push({
        url: url,
        videoPlan: selected.isVideo ? (selected.videoPlan || null) : null,
        filename: `${username}_${shortcode}${suffix}.${selected.ext}`,
        meta: {
          type: mediaType,
          username: username,
          shortcode: shortcode,
          id: mediaId,
          index: i + 1,
          ext: selected.ext,
          caption: mediaMetadata.caption || sharedMetadata.caption || "",
          altText: mediaMetadata.altText || sharedMetadata.altText || "",
          hashtags: mediaMetadata.hashtags || sharedMetadata.hashtags || [],
          takenAt: mediaMetadata.takenAt ?? sharedMetadata.takenAt ?? null,
          authorId: mediaMetadata.authorId || sharedMetadata.authorId || "",
          authorUsername: mediaMetadata.authorUsername || sharedMetadata.authorUsername || username,
          permalink: mediaMetadata.permalink || sharedMetadata.permalink || postPermalink,
          mediaKind: selected.isVideo ? "video" : "image",
          carouselTotal: mediaItems.length
        },
        diagnostic: selected.fallback ? {
          level: "fallback",
          surface: "bulk",
          type: mediaType,
          mediaKind: selected.isVideo ? "video" : "image",
          identity: { shortcode: shortcode },
          attempted: selected.fallback.attempted || [],
          selected: { source: selected.selectedSource || "", container: selected.ext },
          bestUnavailableReason: selected.fallback.reason || "fallback"
        } : null
      });
    }

    return tasks;
  }

  async function resolveProfileUserId(username, appId) {
    const profileUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const profileData = await gmFetch(profileUrl, {
      headers: { "X-IG-App-ID": appId },
      useMobileUA: true
    });
    const userId = profileData?.data?.user?.id;
    if (!userId) throw new Error("Could not get profile user ID");
    return userId;
  }

  function normalizeHighlightTrayId(value) {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    return raw.replace(/^highlight:/i, "");
  }

  function extractHighlightTrayEntries(trayData) {
    const candidates = [];
    if (Array.isArray(trayData?.tray)) candidates.push(...trayData.tray);
    if (Array.isArray(trayData?.items)) candidates.push(...trayData.items);
    if (Array.isArray(trayData?.highlight_reels)) candidates.push(...trayData.highlight_reels);

    if (trayData?.reels && typeof trayData.reels === "object") {
      for (const reel of Object.values(trayData.reels)) {
        if (reel && typeof reel === "object") {
          candidates.push(reel);
        }
      }
    }

    const normalized = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const rawId = candidate.id || candidate.pk || candidate.reel_id || candidate.reel?.id || "";
      const highlightId = normalizeHighlightTrayId(rawId);
      if (!highlightId) continue;
      if (seen.has(highlightId)) continue;
      seen.add(highlightId);
      normalized.push({
        id: highlightId,
        title: candidate.title || candidate.name || "",
        source: candidate
      });
    }
    return normalized;
  }

  function buildProfileHighlightDownloadTasks(items, username, highlightId, highlightTitle = "") {
    if (!Array.isArray(items)) return [];
    const tasks = [];
    const normalizedHighlightId = normalizeHighlightTrayId(highlightId) || "highlight";
    const safeTitle = FILE_METADATA_CORE.sanitizeFilenameToken(highlightTitle, "");
    const highlightLabel = safeTitle || normalizedHighlightId;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const media = getBestStoryItemMedia(item);
      if (!media.url) continue;
      const itemId = item?.pk || item?.id || `${i + 1}`;
      const itemMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, { username: username });
      tasks.push({
        url: media.url,
        videoPlan: media.isVideo ? (media.videoPlan || null) : null,
        filename: `${username}_highlight_${highlightLabel}_${itemId}.${media.ext}`,
        meta: {
          type: "highlight",
          username: username,
          shortcode: normalizedHighlightId,
          id: itemId,
          index: i + 1,
          ext: media.ext,
          caption: itemMetadata.caption || "",
          altText: itemMetadata.altText || "",
          hashtags: itemMetadata.hashtags || [],
          takenAt: itemMetadata.takenAt ?? null,
          authorId: itemMetadata.authorId || "",
          authorUsername: itemMetadata.authorUsername || username,
          permalink: itemMetadata.permalink || "",
          mediaKind: media.isVideo ? "video" : "image",
          carouselTotal: 1
        }
      });
    }
    return tasks;
  }

  async function collectProfileHighlightDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (_getSettings()?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      // Highlights never early-terminate (items are not guaranteed to be
      // time-ordered), but include the flag for caller shape consistency.
      dateFilterTerminatedEarly: false
    });

    const trayUrl = `https://i.instagram.com/api/v1/highlights/${userId}/highlights_tray/`;
    const trayData = await gmFetch(trayUrl, {
      headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
      useMobileUA: true
    });

    const highlights = extractHighlightTrayEntries(trayData);
    if (highlights.length === 0) return buildResult();

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      const response = await fetchHighlightInfoDirect(highlight.id, null, appId);
      if (!response?.success) {
        debugLog("[Amstragram] Highlight fetch failed for", highlight.id, ":", response?.error || "Unknown error");
        continue;
      }

      const highlightItems = Array.isArray(response?.allItemsData)
        ? response.allItemsData
        : (Array.isArray(response?.data?.items) ? response.data.items : []);

      // Per-item filter gate: highlights items are NOT guaranteed to be
      // time-ordered, so we skip out-of-range items individually and never
      // terminate early. Filtered items are dropped before task construction
      // so they don't consume the maxItems budget.
      const filteredHighlightItems = [];
      for (const highlightItem of highlightItems) {
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(highlightItem?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          continue; // skip this item, NEVER break
        }
        dateFilterCounters.matched += 1;
        filteredHighlightItems.push(highlightItem);
      }

      const highlightTasks = buildProfileHighlightDownloadTasks(filteredHighlightItems, username, highlight.id, highlight.title);

      for (const task of highlightTasks) {
        const key = `${task.url}|${task.filename}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(task);
        if (limit > 0 && collected.length >= limit) {
          return buildResult();
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering highlights... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (collected.length >= _getSettings().safetyThresholdCount && i < highlights.length - 1) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    return buildResult();
  }

  async function collectProfileDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (_getSettings()?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    const deltaSyncEnabled = POSTS_FEED_SUPPORTS_DELTA_SYNC
      && !!_getSettings()?.downloads?.skipPreviouslyDownloaded;
    let deltaSyncConsecutiveHits = 0;
    let deltaSyncSkippedCount = 0;
    let deltaSyncTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly,
      deltaSyncTerminatedEarly,
      deltaSyncSkippedCount
    });

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Profile feed pagination guard triggered at 800 pages.");
        break;
      }
      const url = maxId
        ? `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(maxId)}`
        : `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33`;
      const page = await gmFetch(url, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useMobileUA: true
      });

      const items = Array.isArray(page?.items) ? page.items : [];
      if (items.length === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 3) {
          debugLog("[Amstragram] Profile feed: stopping after 3 consecutive empty pages (more_available was:", page?.more_available, ")");
          break;
        }
      } else {
        emptyPageStreak = 0;
      }
      for (const item of items) {
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          // Early termination: the posts feed is newest-first for non-pinned items.
          // Pinned posts (up to 3) sit at the top regardless of age and must not
          // trigger termination — otherwise an old pinned post kills pagination
          // before we ever see recent uploads.
          if (dateCheck.belowLowerBound
              && !isPinnedPost(item)
              && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
            dateFilterTerminatedEarly = true;
            break;
          }
          continue;
        }
        dateFilterCounters.matched += 1;

        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username);
        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (deltaSyncEnabled) {
            const historyKey = getDownloadHistoryKeyForTask(task);
            if (historyKey && hasDownloadedHistoryKey(historyKey)) {
              deltaSyncConsecutiveHits += 1;
              deltaSyncSkippedCount += 1;
              continue;
            } else {
              deltaSyncConsecutiveHits = 0;
            }
          }
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering posts... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (deltaSyncEnabled
          && deltaSyncConsecutiveHits >= DELTA_SYNC_CONSECUTIVE_HIT_THRESHOLD) {
        deltaSyncTerminatedEarly = true;
      }

      if (deltaSyncEnabled && deltaSyncSkippedCount > 0 && onProgressText) {
        onProgressText(
          `Collecting posts... ${collected.length} new, ${deltaSyncSkippedCount} already downloaded`
          + (deltaSyncTerminatedEarly ? " (stopping early)" : "")
        );
      }

      if (deltaSyncTerminatedEarly) break;

      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      // Keep small jobs snappy: only pace list-pagination once we cross the same threshold.
      if (collected.length >= _getSettings().safetyThresholdCount && pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    // Per-collector summary log removed — the consolidated summary for all
    // four content types is emitted by startProfileBulkDownload after all
    // collectors have run (Task 5 Step 5.7).
    return buildResult();
  }

  // Early termination on these endpoints is pending empirical verification.
  // Until we confirm reels and tagged return items in strictly descending
  // taken_at order via cursor pagination, filtering is applied per-item
  // but termination is disabled — the full pagination runs to its usual cap.
  const REELS_FEED_SUPPORTS_EARLY_TERMINATION = false;
  const TAGGED_FEED_SUPPORTS_EARLY_TERMINATION = false;
  const DELTA_SYNC_CONSECUTIVE_HIT_THRESHOLD = 66;
  const POSTS_FEED_SUPPORTS_DELTA_SYNC = true;

  // Instagram pins up to 3 posts at the top of the profile feed regardless of age.
  // Pinned posts break the newest-first ordering the date filter's early-termination
  // relies on, so they must be skipped when deciding whether to stop pagination.
  function isPinnedPost(item) {
    const pinnedIds = item?.timeline_pinned_user_ids;
    if (Array.isArray(pinnedIds) && pinnedIds.length > 0) return true;
    return item?.is_pinned === true || item?.is_pinned_for_account === true;
  }

  async function collectProfileReelDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (_getSettings()?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly
    });

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Reels feed pagination guard triggered at 800 pages.");
        break;
      }
      const url = maxId
        ? `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(maxId)}`
        : `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33`;
      const page = await gmFetch(url, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useMobileUA: true
      });

      const items = Array.isArray(page?.items) ? page.items : [];
      if (items.length === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 3) {
          debugLog("[Amstragram] Reels feed: stopping after 3 consecutive empty pages (more_available was:", page?.more_available, ")");
          break;
        }
      } else {
        emptyPageStreak = 0;
      }
      for (const item of items) {
        if (item?.product_type !== "clips") continue;
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          // Early termination only fires when the feature flag is on AND the item
          // is below the lower bound. The reels endpoint is not yet empirically
          // confirmed to return items in strict descending taken_at order via
          // cursor pagination, so the flag stays false until verified.
          if (REELS_FEED_SUPPORTS_EARLY_TERMINATION
              && dateCheck.belowLowerBound
              && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
            dateFilterTerminatedEarly = true;
            break;
          }
          continue;
        }
        dateFilterCounters.matched += 1;

        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username);
        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering reels... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      if (collected.length >= _getSettings().safetyThresholdCount && pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    return buildResult();
  }

  async function collectTaggedProfileDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const includeAllCarouselMedia = options?.includeAllCarouselMedia === true;
    const onProgress = typeof options?.onProgress === "function" ? options.onProgress : null;
    const dateFilter = (_getSettings()?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    const retryCount = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryCount, 0, 0, 8);
    const retryBackoffMs = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryBackoffMs, 0, 0, 600000);
    const traceSampleLimit = 5;
    let maxId = null;
    let taggedGraphQlCursor = null;
    let shouldTryTaggedGraphQl = true;
    const seenTaggedGraphQlCursors = new Set();
    const attemptedTaggedGraphQlShortcodes = new Set();
    let pageCount = 0;
    let showedBlockedByClientNotice = false;
    let lastProgressEmitAt = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly
    });
    // Shared gate used before building tasks from any tagged item. Returns true
    // if the item passes the filter. Updates counters and, when the feature
    // flag is enabled, flips dateFilterTerminatedEarly when we see an item
    // below the lower bound. Caller must check dateFilterTerminatedEarly to
    // break out of the surrounding loops.
    const passesTaggedDateFilter = (item) => {
      const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
      dateFilterCounters.scanned += 1;
      if (!dateCheck.pass) {
        if (dateCheck.reason === "no-date") {
          dateFilterCounters.noDateSkipped += 1;
        } else if (dateCheck.reason === "out-of-range") {
          dateFilterCounters.outOfRange += 1;
        }
        if (TAGGED_FEED_SUPPORTS_EARLY_TERMINATION
            && dateCheck.belowLowerBound
            && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
          dateFilterTerminatedEarly = true;
        }
        return false;
      }
      dateFilterCounters.matched += 1;
      return true;
    };
    const addUniqueCollectedTask = (task) => {
      const key = `${task.url}|${task.filename}`;
      if (seen.has(key)) return false;
      seen.add(key);
      collected.push(task);
      return true;
    };
    const emitTaggedCollectionProgress = (overrides = {}, force = false) => {
      if (!onProgress) return;
      const now = Date.now();
      if (!force && now - lastProgressEmitAt < 250) return;
      lastProgressEmitAt = now;
      try {
        onProgress({
          stage: "collect",
          source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
          pageCount,
          collected: collected.length,
          limit,
          ...overrides
        });
      } catch (progressErr) {
        debugLog("[Amstragram] Tagged progress callback failed:", progressErr?.message || progressErr);
      }
    };

    TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector start", {
      username: String(username || ""),
      userId: String(userId || ""),
      appId: String(appId || ""),
      limit,
      includeAllCarouselMedia,
      retryCount,
      retryBackoffMs
    });
    emitTaggedCollectionProgress({ stage: "start", source: "tagged", message: "Starting tagged post scan..." }, true);

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Tagged feed pagination guard triggered at 800 pages.");
        emitTaggedCollectionProgress({ stage: "guard-stop", source: "tagged", message: "Stopped after 800 pages (safety guard)." }, true);
        break;
      }

      TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector loop", {
        pageCount,
        collected: collected.length,
        shouldTryTaggedGraphQl,
        taggedGraphQlCursor,
        maxId
      });
      emitTaggedCollectionProgress({
        stage: "page-request",
        source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
        message: shouldTryTaggedGraphQl
          ? `Requesting tagged page ${pageCount} (GraphQL)...`
          : `Requesting tagged page ${pageCount} (legacy API)...`
      });

      if (shouldTryTaggedGraphQl) {
        try {
          const graphQlPage = await tryGraphQLTaggedFeed(userId, appId, taggedGraphQlCursor);
          let graphQlPageAddedTasks = 0;
          const graphQlItems = extractTaggedFeedMediaItems(graphQlPage);
          const graphQlDirectShortcodes = new Set();
          const graphQlItemsWithoutShortcodes = [];
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL page extracted", {
            pageCount,
            graphQlItems: graphQlItems.length,
            itemSample: graphQlItems.slice(0, traceSampleLimit).map((item) =>
              summarizeTaggedItemForTrace(item, userId, username)
            )
          });
          emitTaggedCollectionProgress({
            stage: "graphql-page",
            source: "graphql",
            message: `GraphQL page ${pageCount}: ${graphQlItems.length} item(s) found`
          }, true);

          for (const item of graphQlItems) {
            const itemShortcode = item?.code || item?.shortcode || "";
            if (isLikelyInstagramShortcode(itemShortcode)) {
              graphQlDirectShortcodes.add(itemShortcode);
              continue;
            }

            graphQlItemsWithoutShortcodes.push(item);
          }

          // Tagged Relay feed nodes often contain grid-sized media URLs.
          // Prefer shortcode resolution (post fetch path) whenever a shortcode is available.
          for (const item of graphQlItemsWithoutShortcodes) {
            if (!passesTaggedDateFilter(item)) {
              if (dateFilterTerminatedEarly) break;
              continue;
            }
            const hydratedItem = await hydrateMediaItemForDesktopDash(item);
            const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username, {
              includeAllCarouselMedia: includeAllCarouselMedia,
              taggedUserId: userId,
              taggedUsername: username
            });
            for (const task of itemTasks) {
              if (!addUniqueCollectedTask(task)) continue;
              graphQlPageAddedTasks += 1;
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }
          }
          if (dateFilterTerminatedEarly) break;

          const graphQlShortcodes = Array.from(new Set([
            ...graphQlDirectShortcodes,
            ...extractTaggedShortcodesFromPayloadDeep(graphQlPage)
          ]));
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode extraction", {
            pageCount,
            shortcodeCount: graphQlShortcodes.length,
            shortcodeSample: graphQlShortcodes.slice(0, 12),
            directShortcodeCount: graphQlDirectShortcodes.size
          });
          emitTaggedCollectionProgress({
            stage: "graphql-resolve",
            source: "graphql",
            subProcessed: 0,
            subTotal: graphQlShortcodes.length,
            message: graphQlShortcodes.length > 0
              ? `Resolving tagged posts to media (0/${graphQlShortcodes.length})...`
              : `GraphQL page ${pageCount}: no shortcodes to resolve`
          }, true);
          for (let i = 0; i < graphQlShortcodes.length; i++) {
            const shortcode = graphQlShortcodes[i];
            if (!isLikelyInstagramShortcode(shortcode)) continue;
            if (attemptedTaggedGraphQlShortcodes.has(shortcode)) continue;
            attemptedTaggedGraphQlShortcodes.add(shortcode);
            emitTaggedCollectionProgress({
              stage: "graphql-resolve",
              source: "graphql",
              subProcessed: i + 1,
              subTotal: graphQlShortcodes.length,
              message: `Resolving tagged posts to media (${i + 1}/${graphQlShortcodes.length})...`
            });

            let mediaItem = null;
            for (let attempt = 0; attempt <= retryCount; attempt++) {
              try {
                mediaItem = await fetchPostInfoWithFallback(shortcode);
                if (!mediaItem) {
                  mediaItem = await fetchPostInfoFromHtml(shortcode);
                }
                break;
              } catch (err) {
                const statusCode = extractHttpStatusCodeFromError(err);
                const shouldRetry = isRetryableTaggedRequestStatus(statusCode) && attempt < retryCount;
                if (!shouldRetry) {
                  TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode resolve failed", {
                    shortcode,
                    attempt,
                    statusCode,
                    error: String(err?.message || err)
                  });
                  debugLog("[Amstragram] GraphQL tagged shortcode fetch failed:", shortcode, err?.message || err);
                  emitTaggedCollectionProgress({
                    stage: "graphql-resolve",
                    source: "graphql",
                    subProcessed: i + 1,
                    subTotal: graphQlShortcodes.length,
                    message: `Tagged post lookup failed (${i + 1}/${graphQlShortcodes.length}); continuing...`
                  });
                  break;
                }
                const backoffMs = retryBackoffMs * (attempt + 1);
                if (backoffMs > 0) await sleepMs(backoffMs);
              }
            }

            if (!mediaItem) continue;

            TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode resolved", {
              shortcode,
              itemSummary: summarizeTaggedItemForTrace(mediaItem, userId, username)
            });

            if (!passesTaggedDateFilter(mediaItem)) {
              if (dateFilterTerminatedEarly) break;
              continue;
            }

            const itemTasks = buildProfileItemDownloadTasks(mediaItem, username, {
              includeAllCarouselMedia: includeAllCarouselMedia,
              taggedUserId: userId,
              taggedUsername: username
            });
            for (const task of itemTasks) {
              if (!addUniqueCollectedTask(task)) continue;
              graphQlPageAddedTasks += 1;
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }

            if (i < graphQlShortcodes.length - 1) {
              const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
              if (delayMs > 0) await sleepMs(delayMs);
            }
          }
          if (dateFilterTerminatedEarly) break;
          emitTaggedCollectionProgress({
            stage: "graphql-page-done",
            source: "graphql",
            message: `Finished GraphQL page ${pageCount} • queued ${collected.length} file(s)`
          }, true);

          const graphQlPageInfo = extractTaggedGraphQLPageInfo(graphQlPage);
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL page_info", {
            pageCount,
            pageInfo: graphQlPageInfo,
            pageAddedTasks: graphQlPageAddedTasks,
            totalCollected: collected.length
          });
          if (!graphQlPageInfo) {
            debugLog("[Amstragram] Tagged GraphQL returned data without usable page_info; falling back to legacy tagged API pagination.");
            shouldTryTaggedGraphQl = false;
            emitTaggedCollectionProgress({
              stage: "legacy-fallback",
              source: "legacy",
              message: "GraphQL pagination metadata missing; switching to legacy API..."
            }, true);
          } else if (graphQlPageInfo.hasNextPage) {
            const nextCursor = graphQlPageInfo.endCursor;
            if (!nextCursor) {
              debugLog("[Amstragram] Tagged GraphQL page_info indicated more pages but no end_cursor; falling back to legacy tagged API pagination.");
              shouldTryTaggedGraphQl = false;
              emitTaggedCollectionProgress({
                stage: "legacy-fallback",
                source: "legacy",
                message: "GraphQL cursor missing; switching to legacy API..."
              }, true);
            } else {
              const normalizedCursor = String(nextCursor);
              if (seenTaggedGraphQlCursors.has(normalizedCursor)) {
                debugLog("[Amstragram] Tagged GraphQL pagination cursor repeated; stopping to avoid a loop.");
                break;
              }
              seenTaggedGraphQlCursors.add(normalizedCursor);
              taggedGraphQlCursor = normalizedCursor;

              if (pageCount > 0) {
                const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
                if (delayMs > 0) await sleepMs(delayMs);
              }
              continue;
            }
          } else {
            debugLog("[Amstragram] Tagged GraphQL pagination reached final page.");
            emitTaggedCollectionProgress({
              stage: "complete",
              source: "graphql",
              message: `Tagged GraphQL scan complete • queued ${collected.length} file(s)`
            }, true);
            break;
          }

          if (graphQlItems.length === 0 && graphQlShortcodes.length === 0 && graphQlPageAddedTasks === 0) {
            debugLog("[Amstragram] Tagged GraphQL returned no usable items; continuing with legacy tagged API fallback.");
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL no usable data", { pageCount });
            shouldTryTaggedGraphQl = false;
            emitTaggedCollectionProgress({
              stage: "legacy-fallback",
              source: "legacy",
              message: "GraphQL returned no usable tagged items; trying legacy API..."
            }, true);
          }
        } catch (graphQlErr) {
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL branch error", {
            pageCount,
            error: String(graphQlErr?.message || graphQlErr)
          });
          debugLog("[Amstragram] Tagged GraphQL fetch failed; falling back to legacy tagged API pagination:", graphQlErr?.message || graphQlErr);
          shouldTryTaggedGraphQl = false;
          emitTaggedCollectionProgress({
            stage: "legacy-fallback",
            source: "legacy",
            message: "GraphQL request failed; switching to legacy API..."
          }, true);
        }
      }

      const querySuffix = maxId
        ? `count=33&max_id=${encodeURIComponent(maxId)}`
        : "count=33";
      const requestHeaders = {
        "X-IG-App-ID": appId,
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest"
      };
      const requestCandidates = [
        `https://i.instagram.com/api/v1/usertags/${userId}/feed/?${querySuffix}`,
        `https://i.instagram.com/api/v1/feed/usertag/${userId}/?${querySuffix}`,
        `https://i.instagram.com/api/v1/feed/tagged/${userId}/?${querySuffix}`,
        `https://www.instagram.com/api/v1/usertags/${userId}/feed/?${querySuffix}`,
        `https://www.instagram.com/api/v1/feed/usertag/${userId}/?${querySuffix}`,
        `https://www.instagram.com/api/v1/feed/tagged/${userId}/?${querySuffix}`
      ];
      let page = null;
      let lastError = null;

      for (const taggedFeedUrl of requestCandidates) {
        for (let attempt = 0; attempt <= retryCount; attempt++) {
          try {
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API request", {
              pageCount,
              attempt,
              url: taggedFeedUrl
            });
            emitTaggedCollectionProgress({
              stage: "legacy-request",
              source: "legacy",
              message: `Trying tagged legacy API (${attempt + 1}/${retryCount + 1})...`
            });
            page = await gmFetch(taggedFeedUrl, {
              headers: requestHeaders,
              useMobileUA: taggedFeedUrl.startsWith("https://i.instagram.com/")
            });
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API success", {
              pageCount,
              attempt,
              url: taggedFeedUrl,
              topLevelKeys: Object.keys(page || {}),
              nestedDataKeys: Object.keys(page?.data || {})
            });
            if (page && typeof page === "object") break;
          } catch (err) {
            lastError = err;
            const statusCode = extractHttpStatusCodeFromError(err);
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API error", {
              pageCount,
              attempt,
              url: taggedFeedUrl,
              statusCode,
              error: String(err?.message || err)
            });
            const shouldRetry = isRetryableTaggedRequestStatus(statusCode) && attempt < retryCount;
            if (!shouldRetry) break;
            const backoffMs = retryBackoffMs * (attempt + 1);
            if (backoffMs > 0) await sleepMs(backoffMs);
          }
        }
        if (page && typeof page === "object") break;
      }

      if (!page || typeof page !== "object") {
        const errText = String(lastError?.message || lastError || "");
        const blockedByClient = /ERR_BLOCKED_BY_CLIENT|blocked by client/i.test(errText);
        if (blockedByClient && !showedBlockedByClientNotice) {
          showedBlockedByClientNotice = true;
          showToast("Tagged bulk requests were blocked by a browser extension. Trying same-origin fallback...", 5200);
        }

        const sameOriginCandidates = requestCandidates.filter((url) => url.startsWith("https://www.instagram.com/"));
        emitTaggedCollectionProgress({
          stage: "legacy-same-origin",
          source: "legacy",
          message: "Legacy API blocked/unavailable; trying same-origin requests..."
        }, true);
        for (const taggedFeedUrl of sameOriginCandidates) {
          try {
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin request", { pageCount, url: taggedFeedUrl });
            const response = await fetch(taggedFeedUrl, {
              method: "GET",
              credentials: "include",
              headers: requestHeaders
            });
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin response", {
              pageCount,
              url: taggedFeedUrl,
              status: response.status,
              ok: response.ok
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            page = await response.json();
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin JSON parsed", {
              pageCount,
              url: taggedFeedUrl,
              topLevelKeys: Object.keys(page || {}),
              nestedDataKeys: Object.keys(page?.data || {})
            });
            if (page && typeof page === "object") break;
          } catch (err) {
            lastError = err;
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin error", {
              pageCount,
              url: taggedFeedUrl,
              error: String(err?.message || err)
            });
          }
        }
      }

      if (!page || typeof page !== "object") {
        debugLog("[Amstragram] Tagged API feed unavailable; trying tagged page fallback:", lastError?.message || lastError);
        if (!showedBlockedByClientNotice) {
          showToast("Tagged API feed unavailable; trying tagged page fallback...", 4200);
        }
        if (collected.length > 0) {
          emitTaggedCollectionProgress({
            stage: "fallback-stop",
            source: "fallback",
            message: `Tagged API unavailable after partial results • queued ${collected.length} file(s)`
          }, true);
          return buildResult();
        }
        const remainingLimit = limit > 0 ? Math.max(0, limit - collected.length) : 0;
        if (limit === 0 || remainingLimit > 0) {
          try {
            emitTaggedCollectionProgress({
              stage: "fallback-page",
              source: "fallback",
              message: "Tagged API unavailable; scanning the tagged page directly..."
            }, true);
            const fallbackTasks = await collectTaggedTasksFromProfilePageFallback(
              username,
              userId,
              policy,
              remainingLimit,
              { includeAllCarouselMedia: includeAllCarouselMedia }
            );
            // Fallback tasks are pre-built from the profile page and do not
            // carry raw taken_at data, so the date filter cannot be applied
            // here. This path is a best-effort last resort when both the
            // legacy API and GraphQL are unavailable.
            for (const task of fallbackTasks) {
              addUniqueCollectedTask(task);
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }
            emitTaggedCollectionProgress({
              stage: "fallback-page-done",
              source: "fallback",
              message: `Tagged page fallback complete • queued ${collected.length} file(s)`
            }, true);
          } catch (fallbackErr) {
            debugLog("[Amstragram] Tagged page fallback failed after API errors:", fallbackErr?.message || fallbackErr);
            emitTaggedCollectionProgress({
              stage: "fallback-error",
              source: "fallback",
              message: "Tagged page fallback failed."
            }, true);
          }
        }
        return buildResult();
      }

      const items = extractTaggedFeedMediaItems(page);
      TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy page extracted", {
        pageCount,
        itemCount: items.length,
        itemSample: items.slice(0, traceSampleLimit).map((item) =>
          summarizeTaggedItemForTrace(item, userId, username)
        )
      });
      emitTaggedCollectionProgress({
        stage: "legacy-page",
        source: "legacy",
        message: `Legacy tagged page ${pageCount}: ${items.length} item(s) found`
      }, true);
      for (const item of items) {
        if (!passesTaggedDateFilter(item)) {
          if (dateFilterTerminatedEarly) break;
          continue;
        }
        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username, {
          includeAllCarouselMedia: includeAllCarouselMedia,
          taggedUserId: userId,
          taggedUsername: username
        });
        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }
      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy pagination", {
        pageCount,
        hasMore,
        nextMaxId: nextMaxId ? String(nextMaxId) : null,
        totalCollected: collected.length
      });
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      if (pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector complete", {
      totalTasks: collected.length,
      usedGraphQl: !shouldTryTaggedGraphQl || seenTaggedGraphQlCursors.size > 0 || attemptedTaggedGraphQlShortcodes.size > 0,
      graphQlCursorCount: seenTaggedGraphQlCursors.size,
      graphQlResolvedShortcodes: attemptedTaggedGraphQlShortcodes.size
    });
    emitTaggedCollectionProgress({
      stage: "complete",
      source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
      message: `Tagged collection complete • queued ${collected.length} file(s)`
    }, true);

    return buildResult();
  }

  async function startProfileBulkDownload(username, options = {}) {
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    if (!/^[A-Za-z0-9._]+$/.test(normalizedUsername)) {
      throw new Error("Invalid username");
    }

    const amstramgramBaseUrl = sanitizeAmstramgramUrl(_getSettings()?.downloads?.amstramgramUrl ?? "");
    if (amstramgramBaseUrl) {
      try {
        const { added, total } = await syncAmstramgramShortcodes(amstramgramBaseUrl);
        if (added > 0) showToast(`Amstramgram: synced ${added} new shortcode${added !== 1 ? "s" : ""} (${total} total).`, 4000);
      } catch (err) {
        showToast(`Amstramgram sync failed: ${err?.message || "Unknown error"}`, 4000);
      }
    }

    const policy = options?.policy && typeof options.policy === "object"
      ? options.policy
      : getActiveBulkPolicy();
    const maxItems = UTILITIES_CORE.toBoundedPositiveInt(options?.maxItems, _getSettings().profileDownload.maxItems, 0, 20000);
    const selection = sanitizeProfileDownloadSelection({
      includePosts: (typeof options?.includePosts === "boolean")
        ? options.includePosts
        : _getSettings().profileDownload.includePosts,
      includeReels: (typeof options?.includeReels === "boolean")
        ? options.includeReels
        : _getSettings().profileDownload.includeReels,
      includeHighlights: (typeof options?.includeHighlights === "boolean")
        ? options.includeHighlights
        : _getSettings().profileDownload.includeHighlights,
      includeTagged: (typeof options?.includeTagged === "boolean")
        ? options.includeTagged
        : _getSettings().profileDownload.includeTagged,
      includeProfilePicture: (typeof options?.includeProfilePicture === "boolean")
        ? options.includeProfilePicture
        : _getSettings().profileDownload.includeProfilePicture,
      taggedIncludeAllCarouselMedia: (typeof options?.taggedIncludeAllCarouselMedia === "boolean")
        ? options.taggedIncludeAllCarouselMedia
        : _getSettings().profileDownload.taggedIncludeAllCarouselMedia
    });
    const includePosts = selection.includePosts;
    const includeReels = selection.includeReels;
    const includeHighlights = selection.includeHighlights;
    const includeTagged = selection.includeTagged;
    const includeProfilePicture = selection.includeProfilePicture;
    const taggedIncludeAllCarouselMedia = includeTagged && selection.taggedIncludeAllCarouselMedia;
    const hasAnyTarget = includePosts || includeReels || includeHighlights || includeTagged || includeProfilePicture;
    if (!hasAnyTarget) {
      showToast(`Profile @${normalizedUsername}: no download targets selected.`, 5500);
      return { total: 0, completed: 0, failed: 0 };
    }
    const selectionLabel = getProfileDownloadSelectionLabel({
      includePosts,
      includeReels,
      includeHighlights,
      includeTagged,
      includeProfilePicture,
      taggedIncludeAllCarouselMedia
    });
    const profileBatchLabel = `Profile @${normalizedUsername} (${selectionLabel})`;
    const appId = getAppID();
    const profileBulkJobId = generateBatchJobId();
    const profileBulkSetupStartedAt = Date.now();
    let profileBulkSetupVisible = false;
    let profileBulkSetupLastUiUpdateAt = 0;

    function updateProfileBulkSetupProgress(progress = {}, force = false) {
      const now = Date.now();
      if (!force && now - profileBulkSetupLastUiUpdateAt < 150) return;
      profileBulkSetupLastUiUpdateAt = now;
      const stage = typeof progress?.stage === "string" ? progress.stage : "collect";
      const source = typeof progress?.source === "string" ? progress.source : "tagged";
      const page = Math.max(0, Number(progress?.pageCount) || 0);
      const collectedCount = Math.max(0, Number(progress?.collected) || 0);
      const subProcessed = Math.max(0, Number(progress?.subProcessed) || 0);
      const subTotal = Math.max(0, Number(progress?.subTotal) || 0);
      const rawPhase = typeof progress?.phase === "string" ? progress.phase.trim() : "";
      const rawMessage = typeof progress?.message === "string" ? progress.message.trim() : "";
      let phase = rawPhase || rawMessage;
      if (!phase) {
        if (stage === "graphql-resolve" && subTotal > 0) {
          phase = `collecting tagged posts • resolving posts ${subProcessed}/${subTotal}`;
        } else if (page > 0) {
          phase = `collecting tagged posts • ${source.toUpperCase()} page ${page}`;
        } else {
          phase = "collecting tagged posts";
        }
      }
      if (page > 0 && stage !== "graphql-resolve" && !/page\s+\d+/i.test(phase)) {
        phase = `${phase} • page ${page}`;
      }

      showBatchProgressIndicator({
        jobId: profileBulkJobId,
        label: profileBatchLabel,
        mode: _getSettings()?.downloads?.bulkAsZip ? "zip" : "download",
        state: "running",
        phase: phase,
        total: 0,
        processed: collectedCount,
        completed: 0,
        failed: 0,
        cancelled: 0,
        indeterminate: true,
        elapsedMs: Math.max(0, now - profileBulkSetupStartedAt),
        forceVisible: true
      });
      profileBulkSetupVisible = true;
    }

    function finishProfileBulkSetupProgress(status = "completed", phase = "") {
      if (!profileBulkSetupVisible) return;
      showBatchProgressIndicator({
        jobId: profileBulkJobId,
        label: profileBatchLabel,
        mode: _getSettings()?.downloads?.bulkAsZip ? "zip" : "download",
        state: "finished",
        status: status,
        phase: phase || "batch preparation finished",
        total: 0,
        processed: 0,
        completed: 0,
        failed: status === "failed" ? 1 : 0,
        cancelled: 0,
        indeterminate: false,
        elapsedMs: Math.max(0, Date.now() - profileBulkSetupStartedAt),
        forceVisible: false,
        final: true
      });
      profileBulkSetupVisible = false;
    }

    showToast(`Profile @${normalizedUsername}: collecting ${selectionLabel.toLowerCase()}...`, 3200);

    try {
      updateProfileBulkSetupProgress({
        stage: "prepare",
        phase: "preparing batch",
        collected: 0
      }, true);
      let userId = "";
      let profilePicTask = null;
      if (includeProfilePicture) {
        updateProfileBulkSetupProgress({
          stage: "resolve-profile",
          phase: "resolving profile info",
          collected: 0
        }, true);
        const profileInfo = await fetchProfileInfoDirect(normalizedUsername, appId);
        if (profileInfo?.userId) {
          userId = String(profileInfo.userId);
        }
        if (profileInfo?.success && profileInfo?.hdUrl) {
          profilePicTask = buildProfilePictureDownloadTask(normalizedUsername, profileInfo.hdUrl, userId);
          if (!profilePicTask) {
            showToast(`Profile @${normalizedUsername}: profile picture URL was invalid, skipping it.`, 5000);
          }
        } else if (profileInfo?.error) {
          showToast(`Profile @${normalizedUsername}: profile picture unavailable (${profileInfo.error}).`, 5000);
        }
      }

      const needsFeedCollections = includePosts || includeReels || includeHighlights || includeTagged;
      if (!userId && needsFeedCollections) {
        updateProfileBulkSetupProgress({
          stage: "resolve-profile",
          phase: "resolving profile info",
          collected: 0
        }, true);
        userId = await resolveProfileUserId(normalizedUsername, appId);
      }

      const scopedTasks = [];
      const seen = new Set();
      const addUniqueScopedTasks = (tasks) => {
        for (const task of tasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          scopedTasks.push(task);
          if (maxItems > 0 && scopedTasks.length >= maxItems) break;
        }
      };
      const addUniqueExtraTask = (task) => {
        if (!task || !task.url || !task.filename) return;
        const key = `${task.url}|${task.filename}`;
        if (seen.has(key)) return;
        seen.add(key);
        scopedTasks.push(task);
      };

      // Shared counters merged from all four collectors in this bulk run.
      // Step 5.6: a single object reflects the combined totals used for
      // the consolidated summary log at the end.
      const combinedDateFilterCounters = { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
      let combinedDateFilterTerminatedEarly = false;
      const mergeDateFilterCounters = (result) => {
        const counters = result && result.dateFilterCounters;
        if (counters) {
          combinedDateFilterCounters.scanned += Number(counters.scanned) || 0;
          combinedDateFilterCounters.matched += Number(counters.matched) || 0;
          combinedDateFilterCounters.outOfRange += Number(counters.outOfRange) || 0;
          combinedDateFilterCounters.noDateSkipped += Number(counters.noDateSkipped) || 0;
        }
        if (result && result.dateFilterTerminatedEarly === true) {
          combinedDateFilterTerminatedEarly = true;
        }
      };
      let combinedDeltaSyncSkippedCount = 0;
      let combinedDeltaSyncTerminatedEarly = false;
      const mergeDeltaSyncCounters = (result) => {
        combinedDeltaSyncSkippedCount += Number(result?.deltaSyncSkippedCount) || 0;
        if (result?.deltaSyncTerminatedEarly === true) {
          combinedDeltaSyncTerminatedEarly = true;
        }
      };

      if (includePosts) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "posts",
            phase: "collecting posts",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting posts...`, 2600);
          const postResult = await collectProfileDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "posts",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(postResult.tasks);
          mergeDateFilterCounters(postResult);
          mergeDeltaSyncCounters(postResult);
        }
      }

      if (includeReels && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "reels",
            phase: "collecting reels",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting reels...`, 2600);
          const reelResult = await collectProfileReelDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "reels",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(reelResult.tasks);
          mergeDateFilterCounters(reelResult);
        }
      }

      if (includeHighlights && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "highlights",
            phase: "collecting highlights",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting highlights...`, 2600);
          const highlightResult = await collectProfileHighlightDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "highlights",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(highlightResult.tasks);
          mergeDateFilterCounters(highlightResult);
        }
      }

      if (includeTagged && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "tagged",
            phase: "collecting tagged posts",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting tagged posts...`, 2600);
          updateProfileBulkSetupProgress({
            stage: "start",
            source: "tagged",
            pageCount: 0,
            collected: scopedTasks.length,
            phase: "collecting tagged posts"
          }, true);
          const taggedResult = await collectTaggedProfileDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              includeAllCarouselMedia: taggedIncludeAllCarouselMedia,
              onProgress: (progress) => {
                updateProfileBulkSetupProgress({
                  ...progress,
                  collected: scopedTasks.length + Math.max(0, Number(progress?.collected) || 0)
                });
              }
            }
          );
          addUniqueScopedTasks(taggedResult.tasks);
          mergeDateFilterCounters(taggedResult);
        }
      }

      // Consolidated date-filter summary (Step 5.7). Emitted once per bulk run,
      // after every collector has completed, reflecting combined totals across
      // posts + reels + highlights + tagged.
      const activeDateFilter = _getSettings()?.profileDownload?.dateFilter;
      if (activeDateFilter && activeDateFilter.enabled === true) {
        let summary = `[Amstragram] Date filter: collected ${combinedDateFilterCounters.matched} items across all content types`
          + ` (${combinedDateFilterCounters.matched} of ${combinedDateFilterCounters.scanned} scanned`;
        if (combinedDateFilterCounters.noDateSkipped > 0) {
          summary += `; ${combinedDateFilterCounters.noDateSkipped} skipped: no date`;
        }
        summary += `)`;
        if (combinedDateFilterTerminatedEarly) {
          summary += ` — one or more feeds stopped early (remaining items are older than start date)`;
        }
        debugLog(summary);
      }
      if (combinedDeltaSyncSkippedCount > 0) {
        debugLog(`[Amstragram] Delta sync: skipped ${combinedDeltaSyncSkippedCount} already-downloaded item(s)${combinedDeltaSyncTerminatedEarly ? " (terminated early)" : ""}.`);
      }

      if (profilePicTask) {
        addUniqueExtraTask(profilePicTask);
      }

      if (scopedTasks.length === 0) {
        finishProfileBulkSetupProgress("completed", "no downloadable content found");
        showToast(`Profile @${normalizedUsername}: no downloadable content found for selected targets.`, 5500);
        return { total: 0, completed: 0, failed: 0 };
      }

      const labelSuffix = selectionLabel;
      showToast(`Profile @${normalizedUsername}: ${scopedTasks.length} file(s) queued (${labelSuffix}).`, 3200);
      if (combinedDeltaSyncSkippedCount > 0) {
        ensureBatchRunRecord({ jobId: profileBulkJobId }).skipped = combinedDeltaSyncSkippedCount;
      }
      if (profileBulkSetupVisible) {
        showBatchProgressIndicator({
          jobId: profileBulkJobId,
          label: profileBatchLabel,
          mode: _getSettings()?.downloads?.bulkAsZip ? "zip" : "download",
          state: "running",
          phase: "queued, starting downloads",
          total: Math.max(1, scopedTasks.length),
          processed: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          skipped: combinedDeltaSyncSkippedCount,
          indeterminate: false,
          elapsedMs: Math.max(0, Date.now() - profileBulkSetupStartedAt),
          forceVisible: false
        });
        profileBulkSetupVisible = false;
      }
      return await runBatchDownloadTasks(scopedTasks, policy, {
        label: `Profile @${normalizedUsername} (${labelSuffix})`,
        jobId: profileBulkJobId
      });
    } catch (err) {
      finishProfileBulkSetupProgress("failed", "batch preparation failed");
      const message = err?.message || "Unknown error";
      if (message.includes("429")) {
        showToast(`Profile @${normalizedUsername}: rate-limited (HTTP 429).`, 7000);
      } else {
        showToast(`Profile @${normalizedUsername}: ${message}`, 7000);
      }
      throw err;
    }
  }

  return { _init, startProfileBulkDownload, hydrateMediaItemForDesktopDash, buildProfileItemDownloadTasks };
})();
