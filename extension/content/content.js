(() => {
if (window.__BCE_CONTENT_SCRIPT_LOADED__) {
  return;
}
window.__BCE_CONTENT_SCRIPT_LOADED__ = true;

const EXTENSION_SOURCE = "browser-caption-extension";
const PAGE_SOURCE = "browser-caption-extension-page";

let pageScriptInjected = false;
let pageScriptReady = null;
const pendingRequests = new Map();

function injectPageScript() {
  if (pageScriptInjected || document.getElementById("bce-bilibili-page-script")) {
    pageScriptInjected = true;
    return pageScriptReady || Promise.resolve();
  }

  pageScriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "bce-bilibili-page-script";
    script.src = chrome.runtime.getURL("injected/bilibili-page.js");
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      pageScriptInjected = false;
      pageScriptReady = null;
      script.remove();
      reject(new Error("Failed to inject the Bilibili page extractor."));
    };
    (document.documentElement || document.head).appendChild(script);
  });
  pageScriptInjected = true;
  return pageScriptReady;
}

async function sendToPage(action, payload = {}) {
  await injectPageScript();
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.postMessage(
    {
      source: EXTENSION_SOURCE,
      requestId,
      action,
      payload
    },
    window.location.origin
  );

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out while waiting for the page extractor."));
    }, 30000);

    pendingRequests.set(requestId, { resolve, reject, timeoutId });
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.source !== PAGE_SOURCE || !message.requestId) return;

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  window.clearTimeout(pending.timeoutId);
  pendingRequests.delete(message.requestId);

  if (message.ok) {
    pending.resolve(message.data);
  } else {
    pending.reject(new Error(message.error || "Bilibili extraction failed."));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  const actionByType = {
    BCE_GET_BILIBILI_TRACKS: "getTracks"
  };
  const action = actionByType[message.type];
  if (!action && message.type !== "BCE_EXTRACT_BILIBILI_SUBTITLE") return false;

  const request = message.type === "BCE_EXTRACT_BILIBILI_SUBTITLE"
    ? extractSubtitleInContent(message.payload || {})
    : sendToPage(action, message.payload || {});

  request
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function extractSubtitleInContent(payload) {
  const track = payload.track;
  if (!track?.url) {
    throw new Error("No subtitle track URL was provided.");
  }

  const subtitleUrl = normalizeSubtitleUrl(track.url);
  const response = await fetch(subtitleUrl, {
    credentials: "omit",
    referrer: window.location.href
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${subtitleUrl}`);
  }

  const subtitle = await response.json();
  const segments = (subtitle.body || [])
    .map((item) => ({
      startSeconds: Number(item.from),
      durationSeconds: typeof item.from === "number" && typeof item.to === "number" ? item.to - item.from : undefined,
      text: String(item.content || "").replace(/\s+/g, " ").trim()
    }))
    .filter((item) => Number.isFinite(item.startSeconds) && item.text.length > 0);

  if (!segments.length) {
    throw new Error("Subtitle file was fetched, but it had no readable text segments.");
  }

  const metadata = payload.metadata || {};
  const selectedTrack = {
    ...track,
    url: subtitleUrl
  };

  return {
    platform: "bilibili",
    videoId: metadata.videoId || parseBvidFromUrl(window.location.href),
    url: metadata.url || window.location.href,
    title: metadata.title || document.title,
    author: metadata.author,
    selectedTrack,
    availableTracks: payload.availableTracks || [selectedTrack],
    segments,
    text: segments.map((segment) => segment.text).join("\n"),
    warnings: []
  };
}

function normalizeSubtitleUrl(url) {
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("https//")) return url.replace(/^https\/\//, "https://");
  if (url.startsWith("http//")) return url.replace(/^http\/\//, "http://");
  return url;
}

function parseBvidFromUrl(url) {
  return (url || "").match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] || "";
}
})();
