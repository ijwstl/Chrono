(() => {
  const EXTENSION_SOURCE = "browser-caption-extension";
  const PAGE_SOURCE = "browser-caption-extension-page";
  const observedTimedTextUrls = [];
  let latestPlayerResponse = null;

  installTimedTextRecorder();
  installYouTubeNavigationListeners();

  function getPlayerResponse() {
    const currentVideoId = parseYouTubeVideoId();
    const candidates = getPlayerResponseCandidates();
    const matchingResponse = candidates.find((response) => response?.videoDetails?.videoId === currentVideoId);
    if (matchingResponse) return matchingResponse;

    if (currentVideoId && candidates.length) {
      throw new Error("YouTube player data is still updating for the current video. Please try getting subtitle tracks again.");
    }

    throw new Error("Could not read YouTube player response from the current page.");
  }

  function getPlayerResponseCandidates() {
    return [
      latestPlayerResponse,
      getElementPlayerResponse(),
      window.ytInitialPlayerResponse,
      getLegacyPlayerResponse(),
      ...getScriptPlayerResponses()
    ].filter(Boolean);
  }

  function getElementPlayerResponse() {
    const watchPage = document.querySelector("ytd-watch-flexy");
    return watchPage?.playerResponse || watchPage?.playerData || null;
  }

  function getLegacyPlayerResponse() {
    const playerResponse = window.ytplayer?.config?.args?.player_response;
    if (!playerResponse) return null;
    return JSON.parse(playerResponse);
  }

  function getScriptPlayerResponses() {
    const responses = [];
    for (const script of document.scripts) {
      const text = script.textContent || "";
      const marker = "ytInitialPlayerResponse = ";
      const index = text.indexOf(marker);
      if (index === -1) continue;

      const start = index + marker.length;
      const end = findJsonEnd(text, start);
      if (end > start) responses.push(JSON.parse(text.slice(start, end)));
    }

    return responses;
  }

  function findJsonEnd(text, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
    }

    return -1;
  }

  function parseYouTubeVideoId(input = location.href) {
    const url = new URL(input, location.href);
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || "";
    return url.searchParams.get("v") || "";
  }

  function readText(node) {
    if (!node) return "";
    if (node.simpleText) return node.simpleText;
    if (Array.isArray(node.runs)) return node.runs.map((run) => run.text || "").join("");
    return "";
  }

  function normalizeTrack(track, index) {
    const language = track.languageCode || "unknown";
    const label = readText(track.name) || language;
    const isAuto = track.kind === "asr";
    const trackUrl = new URL(track.baseUrl, location.href);
    return {
      id: `${language}-${track.kind || "manual"}-${index}`,
      platform: "youtube",
      language,
      label: isAuto ? `${label} 自动字幕` : label,
      source: isAuto ? "auto" : "manual",
      kind: track.kind || trackUrl.searchParams.get("kind") || "",
      name: trackUrl.searchParams.get("name") || "",
      url: track.baseUrl
    };
  }

  function getTracks() {
    const response = getPlayerResponse();
    const details = response.videoDetails || {};
    const tracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const availableTracks = tracks
      .filter((track) => track.baseUrl)
      .map(normalizeTrack);

    return {
      platform: "youtube",
      videoId: details.videoId || parseYouTubeVideoId(),
      url: location.href,
      title: details.title || document.title.replace(/ - YouTube$/, ""),
      author: details.author,
      durationSeconds: Number(details.lengthSeconds) || undefined,
      availableTracks,
      warnings: availableTracks.length ? [] : ["Current YouTube video did not expose subtitle tracks."]
    };
  }

  async function extractSubtitle(payload) {
    const track = payload?.track;
    if (!track?.url) throw new Error("No subtitle track URL was provided.");

    const currentVideoId = parseYouTubeVideoId();
    const metadata = payload.metadata?.videoId === currentVideoId ? payload.metadata : getTracks();
    const subtitleUrl = buildSubtitleUrl(track, metadata);
    const nativeSegments = extractNativeTextTrackSegments(track);
    const { url: fetchedUrl, segments, diagnostics } = nativeSegments.length
      ? { url: "native-text-track", segments: nativeSegments, diagnostics: "" }
      : await fetchYouTubeSubtitleSegments(subtitleUrl);
    if (!segments.length) {
      throw new Error(`Subtitle file was fetched, but it had no readable text segments. ${diagnostics}`.trim());
    }

    const selectedTrack = {
      ...track,
      url: fetchedUrl
    };

    return {
      platform: "youtube",
      videoId: metadata.videoId || parseYouTubeVideoId(),
      url: metadata.url || location.href,
      title: metadata.title || document.title.replace(/ - YouTube$/, ""),
      author: metadata.author,
      selectedTrack,
      availableTracks: payload.availableTracks || [selectedTrack],
      segments,
      text: segments.map((segment) => segment.text).join("\n"),
      warnings: []
    };
  }

  function extractNativeTextTrackSegments(track) {
    const video = document.querySelector("video");
    if (!video?.textTracks?.length) return [];

    const textTracks = Array.from(video.textTracks);
    const selectedTextTrack = textTracks.find((item) => languageMatches(item.language, track.language))
      || textTracks.find((item) => item.mode === "showing")
      || textTracks.find((item) => item.mode === "hidden");

    if (!selectedTextTrack) return [];

    const previousMode = selectedTextTrack.mode;
    selectedTextTrack.mode = "hidden";
    const cues = Array.from(selectedTextTrack.cues || []);
    selectedTextTrack.mode = previousMode;

    return cues
      .map((cue) => ({
        startSeconds: Number(cue.startTime),
        durationSeconds: Number(cue.endTime) - Number(cue.startTime),
        text: String(cue.text || "").replace(/\s+/g, " ").trim()
      }))
      .filter((item) => Number.isFinite(item.startSeconds) && item.text.length > 0);
  }

  function languageMatches(left, right) {
    const normalize = (value) => String(value || "").toLowerCase().replace("_", "-");
    const normalizedLeft = normalize(left);
    const normalizedRight = normalize(right);
    return normalizedLeft === normalizedRight || normalizedLeft.split("-")[0] === normalizedRight.split("-")[0];
  }

  function buildSubtitleUrl(track, metadata) {
    const videoId = parseYouTubeVideoId() || metadata?.videoId;
    const observedUrl = findObservedTimedTextUrl(videoId, track.language);
    const sourceUrl = observedUrl || track.url;
    const parsed = new URL(sourceUrl, location.href);
    const trackParams = new URL(track.url, location.href).searchParams;
    const playerResponse = getPlayerResponse();

    parsed.searchParams.set("v", videoId);
    parsed.searchParams.set("lang", track.language);
    parsed.searchParams.set("fmt", "json3");
    applyYouTubeClientParams(parsed.searchParams);
    applyYouTubeIntegrityParams(parsed.searchParams, playerResponse);

    copyOptionalParam(parsed.searchParams, trackParams, "name");
    copyOptionalParam(parsed.searchParams, trackParams, "kind");
    copyOptionalParam(parsed.searchParams, trackParams, "tlang");

    if (track.kind && !parsed.searchParams.has("kind")) {
      parsed.searchParams.set("kind", track.kind);
    }

    return parsed.toString();
  }

  function applyYouTubeClientParams(params) {
    const client = getInnertubeClient();
    const browser = getBrowserVersion();
    const platform = navigator.platform || "Macintosh";

    params.set("c", client.clientName || "WEB");
    if (client.clientVersion) params.set("cver", client.clientVersion);
    params.set("cplayer", "UNIPLAYER");
    params.set("cbr", browser.name);
    params.set("cbrver", browser.version);
    params.set("cbrand", "apple");
    params.set("cos", platform.includes("Mac") ? "Macintosh" : platform);
    params.set("cosver", "10_15_7");
    params.set("cplatform", "DESKTOP");

    if (client.hl) params.set("hl", client.hl);
  }

  function applyYouTubeIntegrityParams(params, playerResponse) {
    const poToken = findPoToken(playerResponse);
    if (!poToken) return;

    params.set("potc", "1");
    params.set("pot", poToken);
    if (!params.has("xorb")) params.set("xorb", "2");
    if (!params.has("xobt")) params.set("xobt", "3");
    if (!params.has("xovt")) params.set("xovt", "3");
  }

  function getInnertubeClient() {
    const context = window.ytcfg?.get?.("INNERTUBE_CONTEXT") || window.ytcfg?.data_?.INNERTUBE_CONTEXT || {};
    return context.client || {};
  }

  function getBrowserVersion() {
    const match = navigator.userAgent.match(/(Chrome|CriOS)\/([0-9.]+)/);
    return {
      name: "Chrome",
      version: match?.[2] || ""
    };
  }

  function findPoToken(playerResponse) {
    return findPoTokenInObject(playerResponse)
      || findPoTokenInObject(window.ytcfg?.data_)
      || findPoTokenInObject(window.ytcfg?.get?.("WEB_PLAYER_CONTEXT_CONFIGS"))
      || findPoTokenInObject(window.ytcfg?.get?.("INNERTUBE_CONTEXT"))
      || playerResponse?.serviceIntegrityDimensions?.poToken
      || window.ytcfg?.get?.("PO_TOKEN")
      || window.ytcfg?.get?.("PLAYER_PO_TOKEN")
      || window.ytcfg?.data_?.PO_TOKEN
      || window.ytcfg?.data_?.PLAYER_PO_TOKEN
      || findPoTokenInScripts();
  }

  function findPoTokenInObject(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);

    for (const [key, child] of Object.entries(value)) {
      if (/po.?token|player.?po.?token/i.test(key) && typeof child === "string" && child.length > 20) {
        return child;
      }

      const found = findPoTokenInObject(child, seen);
      if (found) return found;
    }

    return "";
  }

  function findPoTokenInScripts() {
    for (const script of document.scripts) {
      const text = script.textContent || "";
      const match = text.match(/"poToken"\s*:\s*"([^"]+)"/)
        || text.match(/"PLAYER_PO_TOKEN"\s*:\s*"([^"]+)"/)
        || text.match(/\\"poToken\\"\s*:\s*\\"([^"]+)\\"/)
        || text.match(/\\"PLAYER_PO_TOKEN\\"\s*:\s*\\"([^"]+)\\"/);
      if (match?.[1]) return decodeEscapedString(match[1]);
    }
    return "";
  }

  function decodeEscapedString(value) {
    try {
      return JSON.parse(`"${value}"`);
    } catch (_error) {
      return value;
    }
  }

  function findObservedTimedTextUrl(videoId, language) {
    const timedTextUrls = [
      ...observedTimedTextUrls,
      ...performance.getEntriesByType("resource").map((entry) => entry.name)
    ]
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .filter((url) => /\/api\/timedtext\?/i.test(url))
      .filter((url) => {
        try {
          const parsed = new URL(url, location.href);
          return !videoId || parsed.searchParams.get("v") === videoId;
        } catch (_error) {
          return false;
        }
      });

    const sameLanguageWithPot = timedTextUrls.find((url) => urlHasLanguageAndPot(url, language));
    if (sameLanguageWithPot) return sameLanguageWithPot;

    const anyWithPot = timedTextUrls.find((url) => {
      try {
        return new URL(url, location.href).searchParams.has("pot");
      } catch (_error) {
        return false;
      }
    });
    if (anyWithPot) return anyWithPot;

    const sameLanguage = timedTextUrls.find((url) => {
      try {
        return new URL(url, location.href).searchParams.get("lang") === language;
      } catch (_error) {
        return false;
      }
    });

    return sameLanguage || timedTextUrls.at(-1) || "";
  }

  function urlHasLanguageAndPot(url, language) {
    try {
      const params = new URL(url, location.href).searchParams;
      return params.get("lang") === language && params.has("pot");
    } catch (_error) {
      return false;
    }
  }

  function installTimedTextRecorder() {
    const originalFetch = window.fetch;
    if (typeof originalFetch === "function" && !originalFetch.__bceTimedTextWrapped) {
      const wrappedFetch = function(input, init) {
        recordTimedTextUrl(typeof input === "string" ? input : input?.url);
        return originalFetch.call(this, input, init).then((response) => {
          recordPlayerResponse(input, response);
          return response;
        });
      };
      wrappedFetch.__bceTimedTextWrapped = true;
      window.fetch = wrappedFetch;
    }

    const originalOpen = window.XMLHttpRequest?.prototype?.open;
    if (originalOpen && !originalOpen.__bceTimedTextWrapped) {
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        recordTimedTextUrl(url);
        return originalOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.open.__bceTimedTextWrapped = true;
    }
  }

  function installYouTubeNavigationListeners() {
    const updateFromEvent = (event) => {
      const response = findPlayerResponseInObject(event.detail);
      if (response) updateLatestPlayerResponse(response);
    };
    const clearForNavigation = () => {
      latestPlayerResponse = null;
      observedTimedTextUrls.length = 0;
    };

    window.addEventListener("yt-navigate-start", clearForNavigation);
    window.addEventListener("yt-navigate-finish", updateFromEvent);
    window.addEventListener("yt-page-data-updated", updateFromEvent);
    window.addEventListener("yt-player-updated", updateFromEvent);
  }

  function recordPlayerResponse(input, response) {
    const url = typeof input === "string" ? input : input?.url;
    if (!url || !/\/youtubei\/v1\/player/i.test(String(url))) return;

    response.clone().json()
      .then(updateLatestPlayerResponse)
      .catch(() => {});
  }

  function updateLatestPlayerResponse(response) {
    if (response?.videoDetails?.videoId) {
      latestPlayerResponse = response;
    }
  }

  function findPlayerResponseInObject(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    if (value.videoDetails?.videoId && value.captions) return value;

    for (const child of Object.values(value)) {
      const response = findPlayerResponseInObject(child, seen);
      if (response) return response;
    }

    return null;
  }

  function recordTimedTextUrl(url) {
    if (!url || !/\/api\/timedtext\?/i.test(String(url))) return;
    const absoluteUrl = new URL(url, location.href).toString();
    observedTimedTextUrls.push(absoluteUrl);
    if (observedTimedTextUrls.length > 20) observedTimedTextUrls.shift();
  }

  function copyOptionalParam(target, source, key) {
    const value = source.get(key);
    if (value) {
      target.set(key, value);
    } else {
      target.delete(key);
    }
  }

  async function fetchYouTubeSubtitleSegments(subtitleUrl) {
    const json3Text = await fetchSubtitleText(subtitleUrl);
    const json3Segments = parseYouTubeSubtitle(json3Text);
    if (json3Segments.length) {
      return {
        url: subtitleUrl,
        segments: json3Segments,
        diagnostics: ""
      };
    }

    const vttUrl = withQueryParam(subtitleUrl, "fmt", "vtt");
    const vttText = await fetchSubtitleText(vttUrl);
    const vttSegments = parseYouTubeSubtitle(vttText);
    return {
      url: vttUrl,
      segments: vttSegments,
      diagnostics: [
        `url=${redactUrlForDiagnostics(vttUrl)}`,
        `hasPot=${new URL(vttUrl, location.href).searchParams.has("pot")}`,
        `observedTimedText=${observedTimedTextUrls.length}`,
        `json3=${describeYouTubeSubtitleBody(json3Text)}`,
        `vtt=${describeYouTubeSubtitleBody(vttText)}`
      ].join("; ")
    };
  }

  async function fetchSubtitleText(url) {
    const response = await fetch(url, {
      credentials: "include",
      referrer: location.href
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    return response.text();
  }

  function parseYouTubeSubtitle(rawText) {
    const trimmed = stripJsonPrefix(String(rawText || "")).trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return parseYouTubeJson3(trimmed);
    }

    if (trimmed.startsWith("<")) {
      return parseYouTubeXml(trimmed);
    }

    return parseVtt(trimmed);
  }

  function describeYouTubeSubtitleBody(rawText) {
    const trimmed = stripJsonPrefix(String(rawText || "")).trim();
    if (!trimmed) return "empty";

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const data = JSON.parse(trimmed);
        const events = Array.isArray(data) ? data : data.events || data.body || [];
        return `json events=${Array.isArray(events) ? events.length : 0} preview=${compactPreview(trimmed)}`;
      } catch (_error) {
        return `invalid-json preview=${compactPreview(trimmed)}`;
      }
    }

    return `text preview=${compactPreview(trimmed)}`;
  }

  function compactPreview(value) {
    return String(value || "").replace(/\s+/g, " ").slice(0, 180);
  }

  function redactUrlForDiagnostics(url) {
    const parsed = new URL(url, location.href);
    for (const key of ["signature", "pot"]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return parsed.toString();
  }

  function parseYouTubeJson3(rawText) {
    const data = JSON.parse(rawText);
    const events = Array.isArray(data) ? data : data.events || data.body || [];
    let fallbackStartSeconds = 0;

    return events
      .map((event, index) => {
        const startSeconds = parseMilliseconds(event.tStartMs ?? event.startMs ?? event.startTimeMs);
        const durationSeconds = parseMilliseconds(event.dDurationMs ?? event.durationMs);
        const text = extractYouTubeEventText(event);
        const effectiveStart = Number.isFinite(startSeconds) ? startSeconds : fallbackStartSeconds;
        fallbackStartSeconds = Number.isFinite(effectiveStart) ? effectiveStart + (durationSeconds || 0.001) : index;

        return {
          startSeconds: effectiveStart,
          durationSeconds,
          text
        };
      })
      .filter((item) => Number.isFinite(item.startSeconds) && item.text.length > 0);
  }

  function stripJsonPrefix(value) {
    return String(value || "").replace(/^\)\]\}'\s*/, "");
  }

  function parseMilliseconds(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number / 1000 : Number.NaN;
  }

  function extractYouTubeEventText(event) {
    const fromSegments = Array.isArray(event.segs)
      ? event.segs.map((segment) => segment.utf8 || segment.text || "").join("")
      : "";

    const text = fromSegments || event.utf8 || event.text || event.caption || "";
    return String(text)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseYouTubeXml(rawText) {
    const documentXml = new DOMParser().parseFromString(rawText, "text/xml");
    return Array.from(documentXml.querySelectorAll("text"))
      .map((node) => ({
        startSeconds: Number(node.getAttribute("start")),
        durationSeconds: Number(node.getAttribute("dur")) || undefined,
        text: (node.textContent || "").replace(/\s+/g, " ").trim()
      }))
      .filter((item) => Number.isFinite(item.startSeconds) && item.text.length > 0);
  }

  function parseVtt(rawText) {
    const blocks = rawText.split(/\n{2,}/);
    return blocks
      .map((block) => {
        const lines = block.split(/\r?\n/).filter(Boolean);
        const timingLine = lines.find((line) => line.includes("-->"));
        if (!timingLine) return null;
        const timingIndex = lines.indexOf(timingLine);
        const [start, end] = timingLine.split("-->").map((part) => parseVttTime(part.trim()));
        const text = lines
          .slice(timingIndex + 1)
          .join(" ")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return {
          startSeconds: start,
          durationSeconds: Number.isFinite(end) && Number.isFinite(start) ? end - start : undefined,
          text
        };
      })
      .filter((item) => item && Number.isFinite(item.startSeconds) && item.text.length > 0);
  }

  function parseVttTime(value) {
    const clean = String(value || "").replace(",", ".").split(/\s+/)[0];
    const parts = clean.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number.NaN;
  }

  function withQueryParam(url, key, value) {
    const parsed = new URL(url, location.href);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  }

  function postResult(requestId, ok, data, error) {
    window.postMessage(
      {
        source: PAGE_SOURCE,
        requestId,
        ok,
        data,
        error
      },
      window.location.origin
    );
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== EXTENSION_SOURCE || !message.requestId) return;

    try {
      if (message.action === "getTracks") {
        postResult(message.requestId, true, getTracks());
        return;
      }

      if (message.action === "extractSubtitle") {
        postResult(message.requestId, true, await extractSubtitle(message.payload));
        return;
      }

      throw new Error(`Unsupported page action: ${message.action}`);
    } catch (error) {
      postResult(message.requestId, false, null, error instanceof Error ? error.message : String(error));
    }
  });
})();
