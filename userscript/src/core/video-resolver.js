const VIDEO_RESOLVER_CORE = (() => {
  function videoResolutionScore(rep) {
    const w = Number(rep?.width) || 0;
    const h = Number(rep?.height) || 0;
    return w && h ? Math.min(w, h) : (w || h || 0);
  }

  function videoAreaScore(rep) {
    return (Number(rep?.width) || 0) * (Number(rep?.height) || 0);
  }

  function compareVideoQuality(a, b) {
    const resA = videoResolutionScore(a);
    const resB = videoResolutionScore(b);
    if (resA !== resB) return resB - resA;

    const areaA = videoAreaScore(a);
    const areaB = videoAreaScore(b);
    if (areaA !== areaB) return areaB - areaA;

    const bwA = Number(a?.bandwidth) || 0;
    const bwB = Number(b?.bandwidth) || 0;
    return bwB - bwA;
  }

  function pickProgressive(versions) {
    if (!Array.isArray(versions)) return null;
    const withUrl = versions.filter((v) => v && typeof v.url === "string" && v.url);
    if (withUrl.length === 0) return null;
    const ranked = [...withUrl].sort(compareVideoQuality);
    return ranked[0];
  }

  function codecPrefix(codecsAttr) {
    return String(codecsAttr || "").trim().slice(0, 4).toLowerCase();
  }

  function pickContainer(container) {
    return container === "mkv" ? "mkv" : "mp4";
  }

  function pickDashVideo(reps, allowedCodecs) {
    if (!Array.isArray(reps)) return null;
    const allowed = (allowedCodecs || []).map((c) => String(c).toLowerCase());
    const filtered = reps.filter((r) => r && r.baseUrl && allowed.includes(codecPrefix(r.codecs)));
    if (filtered.length === 0) return null;
    const ranked = [...filtered].sort(compareVideoQuality);
    return ranked[0];
  }

  function pickDashAudio(reps, allowedCodecs) {
    if (!Array.isArray(reps)) return null;
    const allowed = (allowedCodecs || []).map((c) => String(c).toLowerCase());
    const filtered = reps.filter((r) => r && r.baseUrl && allowed.includes(codecPrefix(r.codecs)));
    if (filtered.length === 0) return null;
    const ranked = [...filtered].sort((a, b) => (Number(b.bandwidth) || 0) - (Number(a.bandwidth) || 0));
    return ranked[0];
  }

  const ALL_SUPPORTED_VIDEO_CODECS = ["avc1", "hvc1", "vp09", "av01"];
  const MKV_SUPPORTED_VIDEO_CODECS = ["vp09"];
  const DEFAULT_AUDIO_CODECS = ["mp4a"];

  function allowedVideoCodecs(container, override) {
    if (Array.isArray(override) && override.length > 0) return override;
    return container === "mkv" ? MKV_SUPPORTED_VIDEO_CODECS : ALL_SUPPORTED_VIDEO_CODECS;
  }

  function describeRep(rep) {
    if (!rep) return "";
    const parts = [];
    if (rep.width && rep.height) parts.push(`${rep.width}x${rep.height}`);
    if (rep.bandwidth) parts.push(`${Math.round(rep.bandwidth / 1000)}kbps`);
    if (rep.codecs) parts.push(rep.codecs);
    return parts.join(" ");
  }

  function toRankedProgressive(versions) {
    const list = Array.isArray(versions) ? versions : [];
    return [...list]
      .filter((v) => v && v.url)
      .sort(compareVideoQuality);
  }

  function buildProgressivePlan(item, options, fallbackReason) {
    const ranked = toRankedProgressive(item && item.video_versions);
    const best = ranked[0] || null;
    if (!best) return null;
    return {
      source: "progressive",
      tier: "progressive",
      container: "mp4",
      video: {
        url: best.url,
        bandwidth: Number(best.bandwidth) || null,
        width: Number(best.width) || null,
        height: Number(best.height) || null,
        codecs: null,
        contentLength: null,
        frameRate: null
      },
      audio: null,
      muxRequired: false,
      diagnostics: {
        chosen: { description: describeRep({ width: best.width, height: best.height, bandwidth: best.bandwidth }) || "progressive" },
        progressiveCandidatesRanked: ranked.map((r) => ({ url: r.url, width: r.width || null, height: r.height || null, bandwidth: r.bandwidth || null })),
        fallbackReason: fallbackReason || null,
        alternatives: []
      }
    };
  }

  function buildDashPlan(videoRep, audioRep, container) {
    const tier = (videoRep.height && videoRep.height >= 1080) || (videoRep.width && videoRep.width >= 1080)
      ? "dash_hq"
      : "dash_sd";
    return {
      source: "dash",
      tier,
      container: pickContainer(container),
      video: {
        url: videoRep.baseUrl,
        bandwidth: videoRep.bandwidth || null,
        width: videoRep.width || null,
        height: videoRep.height || null,
        codecs: videoRep.codecs || null,
        contentLength: videoRep.contentLength || null,
        frameRate: videoRep.frameRate || null
      },
      audio: audioRep
        ? {
            url: audioRep.baseUrl,
            bandwidth: audioRep.bandwidth || null,
            codecs: audioRep.codecs || null,
            contentLength: audioRep.contentLength || null,
            channels: audioRep.audioChannels || null
          }
        : null,
      muxRequired: !!audioRep,
      diagnostics: {
        chosen: { description: describeRep(videoRep) + (audioRep ? " + " + describeRep(audioRep) : " (video only)") },
        alternatives: [],
        fallbackReason: null,
        progressiveCandidatesRanked: []
      }
    };
  }

  function resolve(input) {
    if (!input || typeof input !== "object") return null;
    const item = input.item || {};
    const options = input.options || {};
    const container = options.container === "mkv" ? "mkv" : "mp4";
    const allowedVideo = allowedVideoCodecs(container, options.allowedVideoCodecs);
    const allowedAudio = options.allowedAudioCodecs || DEFAULT_AUDIO_CODECS;

    const progressiveVersions = item.video_versions;
    const hasProgressive = Array.isArray(progressiveVersions) && progressiveVersions.length > 0;

    const manifestXml = (typeof input.dashManifestXml === "string" && input.dashManifestXml)
      ? input.dashManifestXml
      : (typeof item.video_dash_manifest === "string" && item.video_dash_manifest)
        ? item.video_dash_manifest
        : "";

    if (!manifestXml) {
      return hasProgressive ? buildProgressivePlan(item, options, null) : null;
    }

    let parsed;
    try {
      parsed = DASH_MANIFEST_CORE.parse(manifestXml);
    } catch (e) {
      return hasProgressive
        ? buildProgressivePlan(item, options, `manifest parse: ${e.message}`)
        : null;
    }

    const videoSet = parsed.adaptationSets.find((a) => a.contentType === "video");
    const audioSet = parsed.adaptationSets.find((a) => a.contentType === "audio");

    if (!videoSet) {
      return hasProgressive
        ? buildProgressivePlan(item, options, "no video AdaptationSet")
        : null;
    }

    const videoRep = pickDashVideo(videoSet.representations, allowedVideo);
    if (!videoRep) {
      const reason = container === "mkv"
        ? "no VP9 in DASH (MKV requires VP9)"
        : "no supported video codec in DASH";
      return hasProgressive
        ? buildProgressivePlan(item, options, reason)
        : null;
    }

    const audioRep = audioSet ? pickDashAudio(audioSet.representations, allowedAudio) : null;

    return buildDashPlan(videoRep, audioRep, container);
  }

  return {
    resolve,
    __test_pickProgressive: pickProgressive,
    __test_pickDashVideo: pickDashVideo,
    __test_pickDashAudio: pickDashAudio,
    __test_pickContainer: pickContainer,
    __test_allowedVideoCodecs: allowedVideoCodecs,
    __test_ALL_SUPPORTED_VIDEO_CODECS: ALL_SUPPORTED_VIDEO_CODECS
  };
})();
// =========================================
// MEDIA SELECTION CORE
// =========================================
